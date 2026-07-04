package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	maxUpdateInstallerBytes     = 250 * 1024 * 1024
	retainedUpdateCacheVersions = 2
)

func (a *App) DownloadUpdateInstaller() (*UpdateInstallResult, error) {
	release, err := a.fetchLatestRelease()
	if err != nil {
		return nil, err
	}

	info := a.updateInfoFromRelease(release, currentAppVersion())
	if !info.UpdateAvailable {
		return nil, errors.New("no update is available")
	}
	if info.DownloadURL == "" || info.InstallerName == "" {
		return nil, errors.New("release does not include a Windows installer")
	}
	a.emitUpdateProgress(UpdateDownloadProgress{Version: info.LatestVersion, Status: "preparing"})

	dir, err := updateInstallerDirectory(info.LatestVersion)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}

	installerPath := filepath.Join(dir, safeDownloadName(info.InstallerName))
	expectedHash, err := a.expectedInstallerHash(info)
	if err != nil {
		return nil, err
	}

	if result, ok := a.cachedUpdateInstaller(installerPath, info.LatestVersion, expectedHash); ok {
		a.cleanupOldUpdateInstallers(info.LatestVersion)
		return result, nil
	}

	ctx, _, err := a.beginUpdateDownload()
	if err != nil {
		return nil, err
	}
	defer a.finishUpdateDownload()

	size, err := a.downloadURLToFileWithProgress(ctx, info.DownloadURL, installerPath, maxUpdateInstallerBytes, info.LatestVersion)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			a.emitUpdateProgress(UpdateDownloadProgress{Version: info.LatestVersion, Status: "canceled"})
			return nil, errors.New("update download canceled")
		}
		a.emitUpdateProgress(UpdateDownloadProgress{Version: info.LatestVersion, Status: "error", Error: err.Error()})
		return nil, err
	}

	a.emitUpdateProgress(UpdateDownloadProgress{Version: info.LatestVersion, Status: "verifying", BytesReceived: size, TotalBytes: size, Percent: 100, Path: installerPath})
	actualHash, err := fileSHA256(installerPath)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(actualHash, expectedHash) {
		_ = os.Remove(installerPath)
		a.emitUpdateProgress(UpdateDownloadProgress{Version: info.LatestVersion, Status: "error", Error: "checksum mismatch"})
		return nil, errors.New("downloaded installer checksum did not match the release checksum")
	}

	a.logEvent("info", "update installer downloaded", map[string]any{
		"version": info.LatestVersion,
		"path":    installerPath,
		"sha256":  actualHash,
		"size":    size,
	})
	a.emitUpdateProgress(UpdateDownloadProgress{Version: info.LatestVersion, Status: "verified", BytesReceived: size, TotalBytes: size, Percent: 100, Path: installerPath})
	a.cleanupOldUpdateInstallers(info.LatestVersion)

	return &UpdateInstallResult{
		Version: info.LatestVersion,
		Path:    installerPath,
		Size:    size,
		SHA256:  actualHash,
	}, nil
}

func (a *App) CancelUpdateDownload() {
	a.updateMu.Lock()
	cancel := a.updateCancel
	a.updateCancel = nil
	a.updateMu.Unlock()

	if cancel != nil {
		cancel()
	}
}

func (a *App) LaunchUpdateInstaller(path string) error {
	if err := validateUpdateInstallerPath(path); err != nil {
		return err
	}

	command := exec.Command(path)
	command.Dir = filepath.Dir(path)
	if err := command.Start(); err != nil {
		return err
	}

	a.logEvent("info", "update installer launched", map[string]any{"path": path})
	go func() {
		time.Sleep(700 * time.Millisecond)
		wailsruntime.Quit(a.appContext())
	}()
	return nil
}

func (a *App) beginUpdateDownload() (context.Context, context.CancelFunc, error) {
	a.updateMu.Lock()
	defer a.updateMu.Unlock()

	if a.updateCancel != nil {
		return nil, nil, errors.New("update download is already running")
	}

	ctx, cancel := context.WithCancel(a.appContext())
	a.updateCancel = cancel
	return ctx, cancel, nil
}

func (a *App) finishUpdateDownload() {
	a.updateMu.Lock()
	a.updateCancel = nil
	a.updateMu.Unlock()
}

func (a *App) expectedInstallerHash(info *UpdateInfo) (string, error) {
	if hash := normalizeSHA256(info.SHA256); hash != "" {
		return hash, nil
	}
	if info.ChecksumURL == "" {
		return "", errors.New("release does not include an installer checksum")
	}

	checksumContent, err := a.downloadURL(info.ChecksumURL, 64*1024)
	if err != nil {
		return "", err
	}
	return parseSHA256Checksum(string(checksumContent))
}

func (a *App) cachedUpdateInstaller(path string, version string, expectedHash string) (*UpdateInstallResult, bool) {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return nil, false
	}

	actualHash, err := fileSHA256(path)
	if err != nil || !strings.EqualFold(actualHash, expectedHash) {
		_ = os.Remove(path)
		return nil, false
	}

	a.logEvent("info", "cached update installer verified", map[string]any{
		"version": version,
		"path":    path,
		"sha256":  actualHash,
		"size":    info.Size(),
	})
	a.emitUpdateProgress(UpdateDownloadProgress{Version: version, Status: "cached", BytesReceived: info.Size(), TotalBytes: info.Size(), Percent: 100, Path: path})

	return &UpdateInstallResult{
		Version: version,
		Path:    path,
		Size:    info.Size(),
		SHA256:  actualHash,
	}, true
}

func (a *App) emitUpdateProgress(progress UpdateDownloadProgress) {
	wailsruntime.EventsEmit(a.appContext(), "omnimail:update-download-progress", progress)
}

func updateInstallerRoot() (string, error) {
	baseDir, err := os.UserCacheDir()
	if err != nil || strings.TrimSpace(baseDir) == "" {
		baseDir = os.TempDir()
	}
	if strings.TrimSpace(baseDir) == "" {
		return "", errors.New("update cache directory is not available")
	}

	return filepath.Join(baseDir, "OmniMailDesktop", "updates"), nil
}

func updateInstallerDirectory(version string) (string, error) {
	root, err := updateInstallerRoot()
	if err != nil {
		return "", err
	}

	return filepath.Join(root, safeDownloadName(version)), nil
}

func validateUpdateInstallerPath(path string) error {
	if strings.TrimSpace(path) == "" {
		return errors.New("installer path is required")
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	root, err := updateInstallerRoot()
	if err != nil {
		return err
	}
	root = filepath.Clean(root)
	relativePath, err := filepath.Rel(root, absPath)
	if err != nil || strings.HasPrefix(relativePath, "..") || filepath.IsAbs(relativePath) {
		return errors.New("installer path is outside the update cache")
	}

	name := strings.ToLower(filepath.Base(absPath))
	if !strings.HasPrefix(name, "omnimaildesktop-setup-") || !strings.HasSuffix(name, ".exe") {
		return errors.New("installer path is not an OmniMail Desktop setup executable")
	}
	return nil
}

func (a *App) cleanupOldUpdateInstallers(keepVersion string) {
	if err := cleanupUpdateInstallerCache(keepVersion, retainedUpdateCacheVersions); err != nil {
		a.logEvent("warn", "update cache cleanup failed", map[string]any{"error": err.Error()})
	}
}

func cleanupUpdateInstallerCache(keepVersion string, keepRecent int) error {
	root, err := updateInstallerRoot()
	if err != nil {
		return err
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}

	type cacheDir struct {
		name     string
		path     string
		modified time.Time
	}
	dirs := make([]cacheDir, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		dirs = append(dirs, cacheDir{
			name:     entry.Name(),
			path:     filepath.Join(root, entry.Name()),
			modified: info.ModTime(),
		})
	}

	sort.Slice(dirs, func(left int, right int) bool {
		return dirs[left].modified.After(dirs[right].modified)
	})

	keep := map[string]bool{}
	if strings.TrimSpace(keepVersion) != "" {
		keep[safeDownloadName(keepVersion)] = true
	}
	for index := 0; index < len(dirs) && index < keepRecent; index++ {
		keep[dirs[index].name] = true
	}
	for _, dir := range dirs {
		if keep[dir.name] {
			continue
		}
		if err := os.RemoveAll(dir.path); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) downloadURL(url string, maxBytes int64) ([]byte, error) {
	request, err := http.NewRequestWithContext(a.appContext(), http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("User-Agent", "OmniMailDesktop/"+currentAppVersion())

	response, err := a.client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		return nil, fmt.Errorf("download failed: HTTP %d", response.StatusCode)
	}
	return readLimited(response.Body, maxBytes)
}

func (a *App) downloadURLToFile(url string, targetPath string, maxBytes int64) (int64, error) {
	return a.downloadURLToFileWithProgress(a.appContext(), url, targetPath, maxBytes, "")
}

func (a *App) downloadURLToFileWithProgress(ctx context.Context, url string, targetPath string, maxBytes int64, version string) (int64, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	request.Header.Set("User-Agent", "OmniMailDesktop/"+currentAppVersion())

	response, err := a.client.Do(request)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		return 0, fmt.Errorf("download failed: HTTP %d", response.StatusCode)
	}
	if maxBytes > 0 && response.ContentLength > maxBytes {
		return 0, errDownloadExceedsSizeLimit
	}

	tempFile, err := os.CreateTemp(filepath.Dir(targetPath), "."+filepath.Base(targetPath)+".download-*")
	if err != nil {
		return 0, err
	}
	tempPath := tempFile.Name()
	keepTempFile := false
	defer func() {
		if !keepTempFile {
			_ = os.Remove(tempPath)
		}
	}()

	reader := io.Reader(response.Body)
	if maxBytes > 0 {
		reader = io.LimitReader(response.Body, maxBytes+1)
	}
	totalBytes := response.ContentLength
	if totalBytes < 0 {
		totalBytes = 0
	}
	if version != "" {
		reader = newUpdateProgressReader(reader, totalBytes, func(bytesReceived int64, total int64) {
			a.emitUpdateProgress(UpdateDownloadProgress{
				Version:       version,
				Status:        "downloading",
				BytesReceived: bytesReceived,
				TotalBytes:    total,
				Percent:       updateDownloadPercent(bytesReceived, total),
				Path:          targetPath,
			})
		})
	}
	size, copyErr := io.Copy(tempFile, reader)
	closeErr := tempFile.Close()
	if copyErr != nil {
		return 0, copyErr
	}
	if closeErr != nil {
		return 0, closeErr
	}
	if maxBytes > 0 && size > maxBytes {
		return 0, errDownloadExceedsSizeLimit
	}

	if err := replaceFile(tempPath, targetPath); err != nil {
		return 0, err
	}
	keepTempFile = true
	return size, nil
}

type updateProgressReader struct {
	reader     io.Reader
	total      int64
	read       int64
	lastEmit   time.Time
	onProgress func(bytesReceived int64, totalBytes int64)
}

func newUpdateProgressReader(reader io.Reader, total int64, onProgress func(bytesReceived int64, totalBytes int64)) *updateProgressReader {
	return &updateProgressReader{
		reader:     reader,
		total:      total,
		onProgress: onProgress,
	}
}

func (reader *updateProgressReader) Read(buffer []byte) (int, error) {
	n, err := reader.reader.Read(buffer)
	if n > 0 {
		reader.read += int64(n)
		now := time.Now()
		if reader.lastEmit.IsZero() || now.Sub(reader.lastEmit) >= 120*time.Millisecond || (reader.total > 0 && reader.read >= reader.total) {
			reader.lastEmit = now
			reader.onProgress(reader.read, reader.total)
		}
	}
	return n, err
}

func updateDownloadPercent(bytesReceived int64, totalBytes int64) int {
	if totalBytes <= 0 || bytesReceived <= 0 {
		return 0
	}
	percent := int(bytesReceived * 100 / totalBytes)
	if percent > 100 {
		return 100
	}
	return percent
}

func fileSHA256(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func parseSHA256Checksum(content string) (string, error) {
	fields := strings.Fields(content)
	if len(fields) == 0 {
		return "", errors.New("checksum file is empty")
	}

	hash := strings.ToLower(strings.TrimSpace(fields[0]))
	if len(hash) != 64 {
		return "", errors.New("checksum file does not contain a SHA256 hash")
	}
	if _, err := hex.DecodeString(hash); err != nil {
		return "", err
	}
	return hash, nil
}
