package main

import "testing"

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
}
