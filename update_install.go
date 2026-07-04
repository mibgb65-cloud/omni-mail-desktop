package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const maxUpdateInstallerBytes = 250 * 1024 * 1024

func (a *App) DownloadUpdateInstaller() (*UpdateInstallResult, error) {
	release, err := a.fetchLatestRelease()
	if err != nil {
		return nil, err
	}

	info := release.updateInfo(currentAppVersion())
	if !info.UpdateAvailable {
		return nil, errors.New("no update is available")
	}
	if info.DownloadURL == "" || info.InstallerName == "" {
		return nil, errors.New("release does not include a Windows installer")
	}
	if info.ChecksumURL == "" {
		return nil, errors.New("release does not include an installer checksum")
	}

	dir, err := updateInstallerDirectory(info.LatestVersion)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}

	installerPath := filepath.Join(dir, safeDownloadName(info.InstallerName))
	size, err := a.downloadURLToFile(info.DownloadURL, installerPath, maxUpdateInstallerBytes)
	if err != nil {
		return nil, err
	}

	actualHash, err := fileSHA256(installerPath)
	if err != nil {
		return nil, err
	}

	checksumContent, err := a.downloadURL(info.ChecksumURL, 64*1024)
	if err != nil {
		return nil, err
	}
	expectedHash, err := parseSHA256Checksum(string(checksumContent))
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(actualHash, expectedHash) {
		_ = os.Remove(installerPath)
		return nil, errors.New("downloaded installer checksum did not match the release checksum")
	}

	a.logEvent("info", "update installer downloaded", map[string]any{
		"version": info.LatestVersion,
		"path":    installerPath,
		"sha256":  actualHash,
		"size":    size,
	})

	return &UpdateInstallResult{
		Version: info.LatestVersion,
		Path:    installerPath,
		Size:    size,
		SHA256:  actualHash,
	}, nil
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

func updateInstallerDirectory(version string) (string, error) {
	baseDir, err := os.UserCacheDir()
	if err != nil || strings.TrimSpace(baseDir) == "" {
		baseDir = os.TempDir()
	}
	if strings.TrimSpace(baseDir) == "" {
		return "", errors.New("update cache directory is not available")
	}

	return filepath.Join(baseDir, "OmniMailDesktop", "updates", safeDownloadName(version)), nil
}

func validateUpdateInstallerPath(path string) error {
	if strings.TrimSpace(path) == "" {
		return errors.New("installer path is required")
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	cacheRoot, err := updateInstallerDirectory("")
	if err != nil {
		return err
	}
	root := filepath.Clean(filepath.Dir(cacheRoot))
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
	request, err := http.NewRequestWithContext(a.appContext(), http.MethodGet, url, nil)
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
