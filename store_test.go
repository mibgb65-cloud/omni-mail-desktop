package main

import (
	"path/filepath"
	"testing"
)

func TestProfileStorePathUsesDataDirOverride(t *testing.T) {
	dataDir := filepath.Join(t.TempDir(), "custom-data")
	t.Setenv("OMNIMAIL_DESKTOP_DATA_DIR", dataDir)

	got, err := profileStorePath()
	if err != nil {
		t.Fatalf("profileStorePath returned error: %v", err)
	}

	want := filepath.Join(dataDir, "profiles.json")
	if got != want {
		t.Fatalf("profileStorePath() = %q, want %q", got, want)
	}
}
