package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	logFilename     = "omnimail-desktop.log"
	maxLogFileBytes = 1024 * 1024
	keepLogBytes    = 512 * 1024
)

type localLogEntry struct {
	At      string         `json:"at"`
	Level   string         `json:"level"`
	Message string         `json:"message"`
	Fields  map[string]any `json:"fields,omitempty"`
}

type diagnosticPackageFile struct {
	GeneratedAt    string          `json:"generatedAt"`
	AppVersion     string          `json:"appVersion"`
	StoragePath    string          `json:"storagePath"`
	LogPath        string          `json:"logPath"`
	Report         json.RawMessage `json:"report,omitempty"`
	ReportText     string          `json:"reportText,omitempty"`
	RecentLogLines []string        `json:"recentLogLines"`
}

func (a *App) configureLocalLog() {
	dir := ""
	if a.store != nil && a.store.path != "" {
		dir = filepath.Dir(a.store.path)
	} else if configDir, err := os.UserConfigDir(); err == nil {
		dir = filepath.Join(configDir, "OmniMailDesktop")
	}
	if dir == "" {
		return
	}

	a.logPath = filepath.Join(dir, logFilename)
	a.logEvent("info", "startup", map[string]any{"version": currentAppVersion()})
}

func (a *App) SaveDiagnosticPackage(input DiagnosticPackageInput) (*DiagnosticPackageResult, error) {
	defaultName := safeDiagnosticFilename(input.Filename)
	path, err := wailsruntime.SaveFileDialog(a.appContext(), wailsruntime.SaveDialogOptions{
		DefaultFilename: defaultName,
		Title:           "Save diagnostic package",
		Filters: []wailsruntime.FileFilter{{
			DisplayName: "JSON files (*.json)",
			Pattern:     "*.json",
		}},
	})
	if err != nil {
		return nil, err
	}
	if path == "" {
		return nil, errors.New("diagnostic export canceled")
	}

	content, err := a.diagnosticPackageContent(input.Report)
	if err != nil {
		return nil, err
	}

	tempFile, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".tmp-*")
	if err != nil {
		return nil, err
	}
	tempPath := tempFile.Name()
	keepTempFile := false
	defer func() {
		if !keepTempFile {
			_ = os.Remove(tempPath)
		}
	}()

	size, writeErr := tempFile.Write(content)
	closeErr := tempFile.Close()
	if writeErr != nil {
		return nil, writeErr
	}
	if closeErr != nil {
		return nil, closeErr
	}

	if err := replaceFile(tempPath, path); err != nil {
		return nil, err
	}
	keepTempFile = true
	a.logEvent("info", "diagnostic package saved", map[string]any{"path": path, "size": size})

	return &DiagnosticPackageResult{Path: path, Size: int64(size)}, nil
}

func (a *App) diagnosticPackageContent(report string) ([]byte, error) {
	file := diagnosticPackageFile{
		GeneratedAt:    time.Now().UTC().Format(time.RFC3339),
		AppVersion:     currentAppVersion(),
		StoragePath:    a.storagePath(),
		LogPath:        a.logPath,
		RecentLogLines: readRecentLogLines(a.logPath, 200),
	}

	report = strings.TrimSpace(report)
	if json.Valid([]byte(report)) {
		file.Report = json.RawMessage(report)
	} else if report != "" {
		file.ReportText = report
	}

	return json.MarshalIndent(file, "", "  ")
}

func (a *App) storagePath() string {
	if a.store == nil {
		return ""
	}
	return a.store.path
}

func (a *App) logEvent(level string, message string, fields map[string]any) {
	if a.logPath == "" {
		return
	}

	a.logMu.Lock()
	defer a.logMu.Unlock()

	if err := os.MkdirAll(filepath.Dir(a.logPath), 0o700); err != nil {
		return
	}
	trimLogFile(a.logPath)

	file, err := os.OpenFile(a.logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return
	}
	defer file.Close()

	entry := localLogEntry{
		At:      time.Now().UTC().Format(time.RFC3339),
		Level:   level,
		Message: message,
		Fields:  fields,
	}
	_ = json.NewEncoder(file).Encode(entry)
}

func trimLogFile(path string) {
	info, err := os.Stat(path)
	if err != nil || info.Size() <= maxLogFileBytes {
		return
	}

	content, err := os.ReadFile(path)
	if err != nil || len(content) <= keepLogBytes {
		return
	}
	_ = os.WriteFile(path, content[len(content)-keepLogBytes:], 0o600)
}

func readRecentLogLines(path string, limit int) []string {
	if path == "" || limit <= 0 {
		return []string{}
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return []string{}
	}
	if len(content) > keepLogBytes {
		content = content[len(content)-keepLogBytes:]
	}

	lines := strings.Split(strings.TrimRight(string(content), "\r\n"), "\n")
	if len(lines) == 1 && lines[0] == "" {
		return []string{}
	}
	if len(lines) > limit {
		lines = lines[len(lines)-limit:]
	}
	return lines
}

func safeDiagnosticFilename(value string) string {
	if strings.TrimSpace(value) == "" {
		return "omnimail-diagnostics.json"
	}

	value = safeDownloadName(value)
	if !strings.HasSuffix(strings.ToLower(value), ".json") {
		value += ".json"
	}
	return value
}
