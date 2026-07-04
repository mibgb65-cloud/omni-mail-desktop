package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseApplicationLogLines(t *testing.T) {
	entries := parseApplicationLogLines([]string{
		`{"at":"2026-07-04T00:00:00Z","level":"info","message":"started","fields":{"version":"1.0.12"}}`,
		`not-json`,
	})

	if len(entries) != 2 {
		t.Fatalf("len(entries) = %d, want 2", len(entries))
	}
	if entries[0].Message != "started" || entries[0].Fields["version"] != "1.0.12" {
		t.Fatalf("unexpected parsed entry: %#v", entries[0])
	}
	if entries[1].Raw != "not-json" {
		t.Fatalf("Raw = %q, want not-json", entries[1].Raw)
	}
}

func TestRemoveUpdateInstallerCache(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("LocalAppData", tempDir)
	t.Setenv("XDG_CACHE_HOME", tempDir)

	dir, err := updateInstallerDirectory("1.0.12")
	if err != nil {
		t.Fatalf("updateInstallerDirectory returned error: %v", err)
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatalf("MkdirAll returned error: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "OmniMailDesktop-Setup-1.0.12.exe"), []byte("installer"), 0o600); err != nil {
		t.Fatalf("WriteFile returned error: %v", err)
	}

	info, err := scanUpdateInstallerCache()
	if err != nil {
		t.Fatalf("scanUpdateInstallerCache returned error: %v", err)
	}
	if info.Size != 9 || info.Files != 1 {
		t.Fatalf("cache info = size %d files %d, want 9 and 1", info.Size, info.Files)
	}

	result, err := removeUpdateInstallerCache()
	if err != nil {
		t.Fatalf("removeUpdateInstallerCache returned error: %v", err)
	}
	if result.RemovedSize != 9 || result.RemovedFiles != 1 {
		t.Fatalf("clear result = size %d files %d, want 9 and 1", result.RemovedSize, result.RemovedFiles)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatalf("expected cache version directory to be removed, stat error: %v", err)
	}
}
