package main

import (
	"path/filepath"
	"testing"
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
