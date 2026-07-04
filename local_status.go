package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

func (a *App) GetAppInfo() (*AppInfo, error) {
	cacheInfo, _ := scanUpdateInstallerCache()
	return &AppInfo{
		Version:                  currentAppVersion(),
		StoragePath:              a.storagePath(),
		LogPath:                  a.logPath,
		UpdateCachePath:          cacheInfo.Path,
		UpdateCacheSize:          cacheInfo.Size,
		UpdateCacheFiles:         cacheInfo.Files,
		ActiveAttachmentPreviews: a.attachmentPreviewCount(),
	}, nil
}

func (a *App) GetRecentApplicationLogs(limit int) (*ApplicationLogResult, error) {
	if limit <= 0 || limit > 500 {
		limit = 120
	}

	return &ApplicationLogResult{
		Path:    a.logPath,
		Entries: parseApplicationLogLines(readRecentLogLines(a.logPath, limit)),
	}, nil
}

func (a *App) GetUpdateCacheInfo() (*UpdateCacheInfo, error) {
	return scanUpdateInstallerCache()
}

func (a *App) ClearUpdateCache() (*CacheClearResult, error) {
	result, err := removeUpdateInstallerCache()
	if err != nil {
		return nil, err
	}
	a.logEvent("info", "update cache cleared", map[string]any{
		"path":  result.Path,
		"size":  result.RemovedSize,
		"files": result.RemovedFiles,
	})
	return result, nil
}

func (a *App) ClearAttachmentPreviewCache() (*CacheClearResult, error) {
	result := a.clearAttachmentPreviewCache()
	a.logEvent("info", "attachment preview cache cleared", map[string]any{
		"size":  result.RemovedSize,
		"files": result.RemovedFiles,
	})
	return result, nil
}

func parseApplicationLogLines(lines []string) []ApplicationLogEntry {
	entries := make([]ApplicationLogEntry, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		var entry ApplicationLogEntry
		if err := json.Unmarshal([]byte(line), &entry); err == nil {
			entries = append(entries, entry)
			continue
		}
		entries = append(entries, ApplicationLogEntry{Raw: line})
	}
	return entries
}

func scanUpdateInstallerCache() (*UpdateCacheInfo, error) {
	root, err := updateInstallerRoot()
	if err != nil {
		return nil, err
	}

	result := &UpdateCacheInfo{Path: root}
	entries, err := os.ReadDir(root)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return result, nil
		}
		return nil, err
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		path := filepath.Join(root, entry.Name())
		size, files := directorySize(path)
		info, _ := entry.Info()
		version := UpdateCacheVersion{
			Version: entry.Name(),
			Size:    size,
			Files:   files,
		}
		if info != nil {
			version.ModifiedAt = info.ModTime().UTC().Format(time.RFC3339)
		}
		result.Size += size
		result.Files += files
		result.Versions = append(result.Versions, version)
	}

	sort.Slice(result.Versions, func(left int, right int) bool {
		return result.Versions[left].ModifiedAt > result.Versions[right].ModifiedAt
	})
	return result, nil
}

func removeUpdateInstallerCache() (*CacheClearResult, error) {
	info, err := scanUpdateInstallerCache()
	if err != nil {
		return nil, err
	}

	result := &CacheClearResult{
		Path:         info.Path,
		RemovedSize:  info.Size,
		RemovedFiles: info.Files,
	}
	if info.Path == "" {
		return result, nil
	}

	entries, err := os.ReadDir(info.Path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return result, nil
		}
		return nil, err
	}
	for _, entry := range entries {
		path := filepath.Join(info.Path, entry.Name())
		relativePath, err := filepath.Rel(info.Path, path)
		if err != nil || strings.HasPrefix(relativePath, "..") || filepath.IsAbs(relativePath) {
			return nil, errors.New("update cache path is outside the cache root")
		}
		if err := os.RemoveAll(path); err != nil {
			return nil, err
		}
	}
	return result, nil
}

func directorySize(path string) (int64, int) {
	var total int64
	var files int
	_ = filepath.WalkDir(path, func(filePath string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return nil
		}
		total += info.Size()
		files++
		return nil
	})
	return total, files
}
