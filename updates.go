package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

const githubLatestReleaseURL = "https://api.github.com/repos/mibgb65-cloud/omni-mail-desktop/releases/latest"

type githubRelease struct {
	TagName     string               `json:"tag_name"`
	Name        string               `json:"name"`
	HTMLURL     string               `json:"html_url"`
	Body        string               `json:"body"`
	PublishedAt string               `json:"published_at"`
	Assets      []githubReleaseAsset `json:"assets"`
}

type githubReleaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

func (a *App) CheckForUpdates() (*UpdateInfo, error) {
	request, err := http.NewRequestWithContext(a.appContext(), http.MethodGet, githubLatestReleaseURL, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	request.Header.Set("User-Agent", "OmniMailDesktop/"+currentAppVersion())

	response, err := a.client.Do(request)
	if err != nil {
		a.logEvent("error", "update check failed", map[string]any{"error": err.Error()})
		return nil, err
	}
	defer response.Body.Close()

	content, err := readLimited(response.Body, 1024*1024)
	if err != nil {
		return nil, err
	}
	if response.StatusCode >= 400 {
		err := errors.New(response.Status)
		a.logEvent("error", "update check failed", map[string]any{"status": response.Status})
		return nil, err
	}

	var release githubRelease
	if err := json.Unmarshal(content, &release); err != nil {
		return nil, err
	}

	info := release.updateInfo(currentAppVersion())
	a.logEvent("info", "update check completed", map[string]any{
		"currentVersion":  info.CurrentVersion,
		"latestVersion":   info.LatestVersion,
		"updateAvailable": info.UpdateAvailable,
	})
	return info, nil
}

func (release githubRelease) updateInfo(currentVersion string) *UpdateInfo {
	latestVersion := strings.TrimPrefix(strings.TrimSpace(release.TagName), "v")
	info := &UpdateInfo{
		CurrentVersion: currentVersion,
		LatestVersion:  latestVersion,
		ReleaseURL:     release.HTMLURL,
		PublishedAt:    release.PublishedAt,
		Name:           release.Name,
		Body:           truncateReleaseBody(release.Body),
	}
	info.DownloadURL = installerDownloadURL(release.Assets)
	info.UpdateAvailable = compareVersions(latestVersion, currentVersion) > 0
	return info
}

func installerDownloadURL(assets []githubReleaseAsset) string {
	for _, asset := range assets {
		name := strings.ToLower(asset.Name)
		if strings.HasSuffix(name, ".exe") && !strings.HasSuffix(name, ".sha256") {
			return asset.BrowserDownloadURL
		}
	}
	return ""
}

func truncateReleaseBody(value string) string {
	value = strings.TrimSpace(value)
	if len([]rune(value)) <= 2000 {
		return value
	}
	return string([]rune(value)[:2000])
}

func compareVersions(left string, right string) int {
	leftParts := versionParts(left)
	rightParts := versionParts(right)
	length := max(len(leftParts), len(rightParts))

	for index := 0; index < length; index++ {
		leftValue := partAt(leftParts, index)
		rightValue := partAt(rightParts, index)
		if leftValue > rightValue {
			return 1
		}
		if leftValue < rightValue {
			return -1
		}
	}
	return 0
}

var versionNumberPattern = regexp.MustCompile(`\d+`)

func versionParts(value string) []int {
	matches := versionNumberPattern.FindAllString(strings.TrimSpace(value), -1)
	parts := make([]int, 0, len(matches))
	for _, match := range matches {
		number, err := strconv.Atoi(match)
		if err == nil {
			parts = append(parts, number)
		}
	}
	return parts
}

func partAt(parts []int, index int) int {
	if index >= len(parts) {
		return 0
	}
	return parts[index]
}
