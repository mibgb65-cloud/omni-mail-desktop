package main

import (
	"encoding/json"
	"strings"

	_ "embed"
)

//go:embed wails.json
var wailsConfigBytes []byte

type wailsConfig struct {
	Info struct {
		ProductVersion string `json:"productVersion"`
	} `json:"info"`
}

func currentAppVersion() string {
	var config wailsConfig
	if err := json.Unmarshal(wailsConfigBytes, &config); err != nil {
		return "0.0.0"
	}

	version := strings.TrimSpace(config.Info.ProductVersion)
	if version == "" {
		return "0.0.0"
	}

	return version
}
