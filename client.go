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
	"slices"
	"strings"
)

type apiEnvelope struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

var errDownloadExceedsSizeLimit = errors.New("download exceeds size limit")

func (a *App) apiRequest(baseURL string, token string, method string, path string, body any, target any) error {
	data, err := a.apiRequestData(baseURL, token, method, path, body)
	if err != nil {
		return err
	}

	if target == nil || len(data) == 0 || string(data) == "null" {
		return nil
	}

	if err := json.Unmarshal(data, target); err != nil {
		return err
	}

	return nil
}

func (a *App) apiRequestData(baseURL string, token string, method string, path string, body any) (json.RawMessage, error) {
	var requestBody io.Reader

	if body != nil {
		content, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}

		requestBody = bytes.NewReader(content)
	}

	request, err := http.NewRequestWithContext(a.appContext(), method, apiURL(baseURL, path), requestBody)
	if err != nil {
		return nil, err
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
		return nil, err
	}
	defer response.Body.Close()

	content, err := readLimited(response.Body, 10*1024*1024)
	if err != nil {
		return nil, err
	}

	var envelope apiEnvelope
	if err := json.Unmarshal(content, &envelope); err != nil {
		return nil, fmt.Errorf("API response was not JSON: HTTP %d", response.StatusCode)
	}

	if response.StatusCode >= 400 || envelope.Code >= 400 {
		message := envelope.Message
		if message == "" {
			message = response.Status
		}
		return nil, errors.New(message)
	}

	return envelope.Data, nil
}

func (a *App) apiDownload(baseURL string, token string, path string) ([]byte, string, error) {
	var content bytes.Buffer
	contentType, _, err := a.apiDownloadTo(baseURL, token, path, &content, 100*1024*1024)
	if err != nil {
		return nil, "", err
	}

	return content.Bytes(), contentType, nil
}

func (a *App) apiDownloadTo(baseURL string, token string, path string, target io.Writer, maxBytes int64) (string, int64, error) {
	request, err := http.NewRequestWithContext(a.appContext(), http.MethodGet, apiURL(baseURL, path), nil)
	if err != nil {
		return "", 0, err
	}

	request.Header.Set("X-Client-Type", "desktop")
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response, err := a.client.Do(request)
	if err != nil {
		return "", 0, err
	}
	defer response.Body.Close()

	if response.StatusCode >= 400 {
		content, err := readLimited(response.Body, 1024*1024)
		if err != nil {
			return "", 0, err
		}

		var envelope apiEnvelope
		if err := json.Unmarshal(content, &envelope); err == nil && envelope.Message != "" {
			return "", 0, errors.New(envelope.Message)
		}

		return "", 0, fmt.Errorf("download failed: HTTP %d", response.StatusCode)
	}

	if maxBytes > 0 && response.ContentLength > maxBytes {
		return "", 0, errDownloadExceedsSizeLimit
	}

	reader := io.Reader(response.Body)
	if maxBytes > 0 {
		reader = io.LimitReader(response.Body, maxBytes+1)
	}

	size, err := io.Copy(target, reader)
	if err != nil {
		return "", size, err
	}

	if maxBytes > 0 && size > maxBytes {
		return "", size, errDownloadExceedsSizeLimit
	}

	return response.Header.Get("Content-Type"), size, nil
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
var reservedWindowsFilenames = []string{
	"CON",
	"PRN",
	"AUX",
	"NUL",
	"COM1",
	"COM2",
	"COM3",
	"COM4",
	"COM5",
	"COM6",
	"COM7",
	"COM8",
	"COM9",
	"LPT1",
	"LPT2",
	"LPT3",
	"LPT4",
	"LPT5",
	"LPT6",
	"LPT7",
	"LPT8",
	"LPT9",
}

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

	value = avoidReservedWindowsFilename(value)
	value = truncateFilenameRunes(value, 160)
	if value == "" {
		return "attachment"
	}

	return value
}

func readLimited(reader io.Reader, maxBytes int64) ([]byte, error) {
	content, err := io.ReadAll(io.LimitReader(reader, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) > maxBytes {
		return nil, fmt.Errorf("API response exceeded %d bytes", maxBytes)
	}

	return content, nil
}

func avoidReservedWindowsFilename(value string) string {
	name := value
	if dot := strings.LastIndex(name, "."); dot > 0 {
		name = name[:dot]
	}
	name = strings.Trim(name, ". ")
	if slices.Contains(reservedWindowsFilenames, strings.ToUpper(name)) {
		return "_" + value
	}

	return value
}

func truncateFilenameRunes(value string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}

	runes := []rune(value)
	if len(runes) <= maxRunes {
		return value
	}

	extension := ""
	if dot := strings.LastIndex(value, "."); dot > 0 && dot < len(value)-1 {
		extension = value[dot:]
	}
	extensionRunes := []rune(extension)
	if len(extensionRunes) > 0 && len(extensionRunes) < maxRunes-8 {
		baseRunes := []rune(value[:len(value)-len(extension)])
		return strings.Trim(string(baseRunes[:maxRunes-len(extensionRunes)]), ". ") + extension
	}

	return strings.Trim(string(runes[:maxRunes]), ". ")
}
