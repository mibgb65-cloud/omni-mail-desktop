package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		name  string
		left  string
		right string
		want  int
	}{
		{name: "equal with v prefix", left: "v1.0.5", right: "1.0.5", want: 0},
		{name: "patch newer", left: "1.0.10", right: "1.0.9", want: 1},
		{name: "minor older", left: "1.1.0", right: "1.2.0", want: -1},
		{name: "missing patch equals zero", left: "1.2", right: "1.2.0", want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := compareVersions(tt.left, tt.right)
			if got != tt.want {
				t.Fatalf("compareVersions(%q, %q) = %d, want %d", tt.left, tt.right, got, tt.want)
			}
		})
	}
}

func TestGithubReleaseUpdateInfo(t *testing.T) {
	release := githubRelease{
		TagName: "v1.0.6",
		HTMLURL: "https://example.com/release",
		Assets: []githubReleaseAsset{
			{Name: "OmniMailDesktop-Setup-1.0.6.exe.sha256", BrowserDownloadURL: "checksum"},
			{Name: "OmniMailDesktop-Setup-1.0.6.exe", BrowserDownloadURL: "installer"},
		},
	}

	info := release.updateInfo("1.0.5")
	if !info.UpdateAvailable {
		t.Fatal("expected update to be available")
	}
	if info.LatestVersion != "1.0.6" {
		t.Fatalf("LatestVersion = %q, want 1.0.6", info.LatestVersion)
	}
	if info.DownloadURL != "installer" {
		t.Fatalf("DownloadURL = %q, want installer", info.DownloadURL)
	}
	if info.ChecksumURL != "checksum" {
		t.Fatalf("ChecksumURL = %q, want checksum", info.ChecksumURL)
	}
	if info.InstallerName != "OmniMailDesktop-Setup-1.0.6.exe" {
		t.Fatalf("InstallerName = %q, want OmniMailDesktop-Setup-1.0.6.exe", info.InstallerName)
	}
}

func TestApplyUpdateManifest(t *testing.T) {
	hash := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	release := githubRelease{
		TagName: "v1.0.10",
		HTMLURL: "https://example.com/release",
		Assets: []githubReleaseAsset{
			{Name: "OmniMailDesktop-Setup-1.0.11.exe", BrowserDownloadURL: "asset-installer", Size: 1234},
			{Name: "OmniMailDesktop-Setup-1.0.11.exe.sha256", BrowserDownloadURL: "checksum"},
		},
	}
	info := release.updateInfo("1.0.10")

	applyUpdateManifest(info, &release, &updateManifest{
		Version:    "1.0.11",
		Channel:    "stable",
		MinVersion: "v1.0.7",
		Mandatory:  true,
		Installer: updateManifestInstaller{
			Name:   "OmniMailDesktop-Setup-1.0.11.exe",
			URL:    "manifest-installer",
			SHA256: hash,
			Size:   4321,
		},
		Notes:       "Manifest notes",
		PublishedAt: "2026-07-04T00:00:00Z",
	})

	if !info.UpdateAvailable {
		t.Fatal("expected manifest version to be available")
	}
	if info.DownloadURL != "manifest-installer" {
		t.Fatalf("DownloadURL = %q, want manifest-installer", info.DownloadURL)
	}
	if info.SHA256 != hash {
		t.Fatalf("SHA256 = %q, want %q", info.SHA256, hash)
	}
	if info.InstallerSize != 4321 {
		t.Fatalf("InstallerSize = %d, want 4321", info.InstallerSize)
	}
	if info.MinVersion != "1.0.7" || !info.Mandatory {
		t.Fatalf("manifest policy not applied: min=%q mandatory=%v", info.MinVersion, info.Mandatory)
	}
	if info.Body != "Manifest notes" {
		t.Fatalf("Body = %q, want Manifest notes", info.Body)
	}
}

func TestManifestRequiresUpdate(t *testing.T) {
	if !manifestRequiresUpdate("1.0.10", "1.0.11", nil) {
		t.Fatal("expected current version below minVersion to require update")
	}
	if !manifestRequiresUpdate("1.0.10", "", []string{"v1.0.10"}) {
		t.Fatal("expected blocked current version to require update")
	}
	if manifestRequiresUpdate("1.0.11", "1.0.10", []string{"1.0.9"}) {
		t.Fatal("expected current version to remain optional")
	}
}

func TestParseSHA256Checksum(t *testing.T) {
	hash := "c204cda56d0acd01ddc150aaddf861ee2b7715717d3ce4a4075c62c4aebcc5db"
	got, err := parseSHA256Checksum(hash + "  OmniMailDesktop-Setup-1.0.6.exe\n")
	if err != nil {
		t.Fatalf("parseSHA256Checksum returned error: %v", err)
	}
	if got != hash {
		t.Fatalf("parseSHA256Checksum = %q, want %q", got, hash)
	}
}

func TestValidateUpdateInstallerPath(t *testing.T) {
	dir, err := updateInstallerDirectory("1.0.7")
	if err != nil {
		t.Fatalf("updateInstallerDirectory returned error: %v", err)
	}

	validPath := filepath.Join(dir, "OmniMailDesktop-Setup-1.0.7.exe")
	if err := validateUpdateInstallerPath(validPath); err != nil {
		t.Fatalf("validateUpdateInstallerPath returned error: %v", err)
	}

	if err := validateUpdateInstallerPath(filepath.Join(dir, "other.exe")); err == nil {
		t.Fatal("expected non-OmniMail installer name to be rejected")
	}
}

func TestCleanupUpdateInstallerCache(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("LocalAppData", tempDir)
	t.Setenv("XDG_CACHE_HOME", tempDir)

	versions := []string{"1.0.7", "1.0.8", "1.0.9"}
	for index, version := range versions {
		dir, err := updateInstallerDirectory(version)
		if err != nil {
			t.Fatalf("updateInstallerDirectory returned error: %v", err)
		}
		if err := os.MkdirAll(dir, 0o700); err != nil {
			t.Fatalf("MkdirAll returned error: %v", err)
		}
		stamp := time.Now().Add(time.Duration(index) * time.Minute)
		if err := os.Chtimes(dir, stamp, stamp); err != nil {
			t.Fatalf("Chtimes returned error: %v", err)
		}
	}

	if err := cleanupUpdateInstallerCache("1.0.8", 1); err != nil {
		t.Fatalf("cleanupUpdateInstallerCache returned error: %v", err)
	}

	assertDirExists(t, "1.0.8")
	assertDirExists(t, "1.0.9")
	assertDirRemoved(t, "1.0.7")
}

func TestUpdateDownloadPercent(t *testing.T) {
	tests := []struct {
		name          string
		bytesReceived int64
		totalBytes    int64
		want          int
	}{
		{name: "unknown total", bytesReceived: 10, totalBytes: 0, want: 0},
		{name: "half", bytesReceived: 50, totalBytes: 100, want: 50},
		{name: "clamped", bytesReceived: 120, totalBytes: 100, want: 100},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := updateDownloadPercent(tt.bytesReceived, tt.totalBytes)
			if got != tt.want {
				t.Fatalf("updateDownloadPercent(%d, %d) = %d, want %d", tt.bytesReceived, tt.totalBytes, got, tt.want)
			}
		})
	}
}

func assertDirExists(t *testing.T, version string) {
	t.Helper()

	dir, err := updateInstallerDirectory(version)
	if err != nil {
		t.Fatalf("updateInstallerDirectory returned error: %v", err)
	}
	if _, err := os.Stat(dir); err != nil {
		t.Fatalf("expected %s to exist: %v", dir, err)
	}
}

func assertDirRemoved(t *testing.T, version string) {
	t.Helper()

	dir, err := updateInstallerDirectory(version)
	if err != nil {
		t.Fatalf("updateInstallerDirectory returned error: %v", err)
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatalf("expected %s to be removed, stat error: %v", dir, err)
	}
}
