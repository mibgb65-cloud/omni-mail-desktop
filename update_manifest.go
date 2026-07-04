package main

import (
	"encoding/json"
	"strings"
)

const (
	updateManifestAssetName = "update-manifest.json"
	maxUpdateManifestBytes  = 256 * 1024
)

type updateManifest struct {
	Version         string                  `json:"version"`
	Tag             string                  `json:"tag"`
	Channel         string                  `json:"channel"`
	MinVersion      string                  `json:"minVersion"`
	Mandatory       bool                    `json:"mandatory"`
	BlockedVersions []string                `json:"blockedVersions"`
	Installer       updateManifestInstaller `json:"installer"`
	Notes           string                  `json:"notes"`
	PublishedAt     string                  `json:"publishedAt"`
}

type updateManifestInstaller struct {
	Name   string `json:"name"`
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
	Size   int64  `json:"size"`
}

func (a *App) updateInfoFromRelease(release *githubRelease, currentVersion string) *UpdateInfo {
	info := release.updateInfo(currentVersion)
	asset := manifestAsset(release.Assets)
	if asset == nil || strings.TrimSpace(asset.BrowserDownloadURL) == "" {
		return info
	}

	manifest, err := a.fetchUpdateManifest(asset.BrowserDownloadURL)
	if err != nil {
		a.logEvent("warn", "update manifest ignored", map[string]any{"error": err.Error()})
		return info
	}

	applyUpdateManifest(info, release, manifest)
	return info
}

func (a *App) fetchUpdateManifest(url string) (*updateManifest, error) {
	content, err := a.downloadURL(url, maxUpdateManifestBytes)
	if err != nil {
		return nil, err
	}

	var manifest updateManifest
	if err := json.Unmarshal(content, &manifest); err != nil {
		return nil, err
	}
	return &manifest, nil
}

func applyUpdateManifest(info *UpdateInfo, release *githubRelease, manifest *updateManifest) {
	if version := manifestVersion(manifest); version != "" {
		info.LatestVersion = version
	}
	if channel := strings.TrimSpace(manifest.Channel); channel != "" {
		info.Channel = channel
	}
	if minVersion := normalizeVersion(manifest.MinVersion); minVersion != "" {
		info.MinVersion = minVersion
	}
	info.Mandatory = manifest.Mandatory
	if manifestRequiresUpdate(info.CurrentVersion, info.MinVersion, manifest.BlockedVersions) {
		info.Mandatory = true
	}

	if name := strings.TrimSpace(manifest.Installer.Name); name != "" {
		info.InstallerName = name
		if asset := assetByName(release.Assets, name); asset != nil {
			info.DownloadURL = asset.BrowserDownloadURL
			info.InstallerSize = asset.Size
		}
	}
	if url := strings.TrimSpace(manifest.Installer.URL); url != "" {
		info.DownloadURL = url
	}
	if hash := normalizeSHA256(manifest.Installer.SHA256); hash != "" {
		info.SHA256 = hash
	}
	if manifest.Installer.Size > 0 {
		info.InstallerSize = manifest.Installer.Size
	}
	if notes := truncateReleaseBody(manifest.Notes); notes != "" {
		info.Body = notes
	}
	if publishedAt := strings.TrimSpace(manifest.PublishedAt); publishedAt != "" {
		info.PublishedAt = publishedAt
	}

	info.UpdateAvailable = compareVersions(info.LatestVersion, info.CurrentVersion) > 0
}

func manifestVersion(manifest *updateManifest) string {
	if version := normalizeVersion(manifest.Version); version != "" {
		return version
	}
	return normalizeVersion(manifest.Tag)
}

func normalizeVersion(value string) string {
	return strings.TrimPrefix(strings.TrimSpace(value), "v")
}

func normalizeSHA256(value string) string {
	hash := strings.ToLower(strings.TrimSpace(value))
	if len(hash) != 64 {
		return ""
	}
	return hash
}

func manifestRequiresUpdate(currentVersion string, minVersion string, blockedVersions []string) bool {
	currentVersion = normalizeVersion(currentVersion)
	if minVersion != "" && compareVersions(currentVersion, minVersion) < 0 {
		return true
	}
	for _, version := range blockedVersions {
		if normalizeVersion(version) == currentVersion {
			return true
		}
	}
	return false
}

func manifestAsset(assets []githubReleaseAsset) *githubReleaseAsset {
	return assetByName(assets, updateManifestAssetName)
}

func assetByName(assets []githubReleaseAsset, name string) *githubReleaseAsset {
	expected := strings.ToLower(strings.TrimSpace(name))
	for index := range assets {
		asset := &assets[index]
		if strings.ToLower(asset.Name) == expected {
			return asset
		}
	}
	return nil
}
