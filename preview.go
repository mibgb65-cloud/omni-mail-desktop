package main

import (
	"bytes"
	"errors"
	"io"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

func normalizePreviewMime(contentType string, filename string) string {
	mimeType := strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	if mimeType != "" && mimeType != "application/octet-stream" {
		return mimeType
	}

	lowerName := strings.ToLower(filename)
	switch {
	case strings.HasSuffix(lowerName, ".png"):
		return "image/png"
	case strings.HasSuffix(lowerName, ".jpg"), strings.HasSuffix(lowerName, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(lowerName, ".gif"):
		return "image/gif"
	case strings.HasSuffix(lowerName, ".webp"):
		return "image/webp"
	case strings.HasSuffix(lowerName, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(lowerName, ".pdf"):
		return "application/pdf"
	case strings.HasSuffix(lowerName, ".txt"), strings.HasSuffix(lowerName, ".log"), strings.HasSuffix(lowerName, ".md"):
		return "text/plain"
	case strings.HasSuffix(lowerName, ".json"):
		return "application/json"
	case strings.HasSuffix(lowerName, ".csv"):
		return "text/csv"
	case strings.HasSuffix(lowerName, ".xml"):
		return "application/xml"
	default:
		return "application/octet-stream"
	}
}

func attachmentPreviewType(mimeType string) string {
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return "image"
	case mimeType == "application/pdf":
		return "pdf"
	case strings.HasPrefix(mimeType, "text/"),
		strings.Contains(mimeType, "json"),
		strings.Contains(mimeType, "xml"),
		strings.Contains(mimeType, "csv"):
		return "text"
	default:
		return "file"
	}
}

func previewTempPattern(filename string) string {
	if strings.HasSuffix(strings.ToLower(filename), ".pdf") {
		return "omnimail-attachment-preview-*.pdf"
	}

	return "omnimail-attachment-preview-*"
}

func attachmentPreviewURL(previewID string, filename string) string {
	return "/attachment-preview/" + url.PathEscape(previewID) + "/" + url.PathEscape(safeDownloadName(filename))
}

func attachmentPreviewIDFromPath(path string) (string, bool) {
	const routePrefix = "/attachment-preview/"
	if !strings.HasPrefix(path, routePrefix) {
		return "", false
	}

	remaining := strings.TrimPrefix(path, routePrefix)
	previewID, _, _ := strings.Cut(remaining, "/")
	if previewID == "" {
		return "", false
	}

	decodedID, err := url.PathUnescape(previewID)
	if err != nil {
		return "", false
	}

	return decodedID, true
}

func replaceFile(sourcePath string, targetPath string) error {
	targetInfo, err := os.Stat(targetPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return os.Rename(sourcePath, targetPath)
		}
		return err
	}
	if targetInfo.IsDir() {
		return errors.New("download path is a directory")
	}

	backupPath := targetPath + ".omnimail-backup-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	if err := os.Rename(targetPath, backupPath); err != nil {
		return err
	}

	if err := os.Rename(sourcePath, targetPath); err != nil {
		_ = os.Rename(backupPath, targetPath)
		return err
	}

	_ = os.Remove(backupPath)
	return nil
}

func (a *App) attachmentPreviewFile(previewID string) (attachmentPreviewFile, bool) {
	a.previewMu.Lock()
	defer a.previewMu.Unlock()

	file, ok := a.previewFiles[previewID]
	return file, ok
}

func (a *App) registerAttachmentPreview(path string, contentType string) string {
	a.previewMu.Lock()
	defer a.previewMu.Unlock()

	if a.previewFiles == nil {
		a.previewFiles = map[string]attachmentPreviewFile{}
	}

	a.previewSeq++
	previewID := strconv.FormatUint(a.previewSeq, 10)
	a.previewFiles[previewID] = attachmentPreviewFile{
		path:        path,
		contentType: contentType,
	}
	return previewID
}

func readTextPreview(path string, maxBytes int64) (string, bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", false, err
	}
	defer file.Close()

	content, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
	if err != nil {
		return "", false, err
	}

	truncated := int64(len(content)) > maxBytes
	if truncated {
		content = content[:maxBytes]
	}

	text := strings.ToValidUTF8(string(content), "\uFFFD")
	return text, truncated, nil
}

func pdfFileHasEncryptionDictionary(path string) bool {
	content, err := os.ReadFile(path)
	if err != nil {
		return false
	}

	return pdfHasEncryptionDictionary(content)
}

func pdfHasEncryptionDictionary(content []byte) bool {
	return bytes.Contains(content, []byte("/Encrypt"))
}
