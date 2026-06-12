package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
)

type apiEnvelope struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func (a *App) apiRequest(baseURL string, token string, method string, path string, body any, target any) error {
	var requestBody io.Reader

	if body != nil {
		content, err := json.Marshal(body)
		if err != nil {
			return err
		}

		requestBody = bytes.NewReader(content)
	}

	request, err := http.NewRequestWithContext(a.appContext(), method, apiURL(baseURL, path), requestBody)
	if err != nil {
		return err
	}

	request.Header.Set("Accept", "application/json")
	request.Header.Set("X-Client-Type", "desktop")
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := a.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	content, err := io.ReadAll(io.LimitReader(response.Body, 10*1024*1024))
	if err != nil {
		return err
	}

	var envelope apiEnvelope
	if err := json.Unmarshal(content, &envelope); err != nil {
		return fmt.Errorf("API response was not JSON: HTTP %d", response.StatusCode)
	}

	if response.StatusCode >= 400 || envelope.Code >= 400 {
		message := envelope.Message
		if message == "" {
			message = response.Status
		}
		return errors.New(message)
	}

	if target == nil || len(envelope.Data) == 0 || string(envelope.Data) == "null" {
		return nil
	}

	if err := json.Unmarshal(envelope.Data, target); err != nil {
		return err
	}

	return nil
}

func (a *App) apiDownload(baseURL string, token string, path string) ([]byte, string, error) {
	request, err := http.NewRequestWithContext(a.appContext(), http.MethodGet, apiURL(baseURL, path), nil)
	if err != nil {
		return nil, "", err
	}

	request.Header.Set("X-Client-Type", "desktop")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := a.client.Do(request)
	if err != nil {
		return nil, "", err
	}
	defer response.Body.Close()

	content, err := io.ReadAll(io.LimitReader(response.Body, 100*1024*1024))
	if err != nil {
		return nil, "", err
	}

	if response.StatusCode >= 400 {
		var envelope apiEnvelope
		if err := json.Unmarshal(content, &envelope); err == nil && envelope.Message != "" {
			return nil, "", errors.New(envelope.Message)
		}

		return nil, "", fmt.Errorf("download failed: HTTP %d", response.StatusCode)
	}

	return content, response.Header.Get("Content-Type"), nil
}

func normalizeBaseURL(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", errors.New("base URL is required")
	}

	if !strings.Contains(value, "://") {
		value = "https://" + value
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return "", err
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", errors.New("base URL must use http or https")
	}

	if parsed.Host == "" {
		return "", errors.New("base URL host is required")
	}

	parsed.RawQuery = ""
	parsed.Fragment = ""
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	if parsed.Path == "/api" {
		parsed.Path = ""
	}

	return parsed.String(), nil
}

func apiURL(baseURL string, path string) string {
	return strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(path, "/")
}

func queryEscape(value string) string {
	return url.QueryEscape(value)
}

func pathEscape(value string) string {
	return url.PathEscape(value)
}

func hostLabel(baseURL string) string {
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Hostname() == "" {
		return baseURL
	}

	return parsed.Hostname()
}

var unsafeFilenamePattern = regexp.MustCompile(`[<>:"/\\|?*\x00-\x1f]+`)

func safeDownloadName(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "attachment"
	}

	value = unsafeFilenamePattern.ReplaceAllString(value, "_")
	value = strings.Trim(value, ". ")
	if value == "" {
		return "attachment"
	}

	if len(value) > 160 {
		value = value[:160]
	}

	return value
}
