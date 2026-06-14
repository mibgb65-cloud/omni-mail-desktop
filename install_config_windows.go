//go:build windows

package main

import (
	"strings"

	"golang.org/x/sys/windows/registry"
)

const installerRegistryPath = `Software\OmniMail\OmniMailDesktop`

func installedDataDir() (string, bool) {
	key, err := registry.OpenKey(registry.CURRENT_USER, installerRegistryPath, registry.QUERY_VALUE)
	if err != nil {
		return "", false
	}
	defer key.Close()

	dir, _, err := key.GetStringValue("DataDir")
	if err != nil {
		return "", false
	}

	dir = strings.TrimSpace(dir)
	return dir, dir != ""
}
