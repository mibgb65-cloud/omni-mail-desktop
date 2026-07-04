package main

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) ListAuditLogs(input AuditLogRequest) ([]AuditLog, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	limit := input.Limit
	if limit <= 0 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}

	var logs []AuditLog
	path := "/api/v1/audit-logs?limit=" + queryEscape(strconv.Itoa(limit))
	if err := a.apiRequest(profile.BaseURL, profile.Token, http.MethodGet, path, nil, &logs); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return logs, nil
}

func (a *App) SendMessage(input SendMessageInput) (*SendResult, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	payload := map[string]string{
		"accountId": input.AccountID,
		"to":        strings.TrimSpace(input.To),
		"subject":   strings.TrimSpace(input.Subject),
		"text":      input.Text,
	}
	if cc := strings.TrimSpace(input.Cc); cc != "" {
		payload["cc"] = cc
	}
	if bcc := strings.TrimSpace(input.Bcc); bcc != "" {
		payload["bcc"] = bcc
	}

	var result SendResult
	if err := a.apiRequest(profile.BaseURL, profile.Token, http.MethodPost, "/api/v1/messages/send", payload, &result); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &result, nil
}

func (a *App) ArchiveMessage(input MessageActionInput) (*Message, error) {
	return a.messageAction(input, "/api/v1/messages/"+pathEscape(input.MessageID)+"/archive", http.MethodPost)
}

func (a *App) UnarchiveMessage(input MessageActionInput) (*Message, error) {
	return a.messageAction(input, "/api/v1/messages/"+pathEscape(input.MessageID)+"/unarchive", http.MethodPost)
}

func (a *App) DeleteMessage(input MessageActionInput) (*Message, error) {
	return a.messageAction(input, "/api/v1/messages/"+pathEscape(input.MessageID), http.MethodDelete)
}

func (a *App) SetMessageStatus(input MessageStatusInput) (*Message, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	if input.MessageID == "" {
		return nil, errors.New("message id is required")
	}

	payload := map[string]bool{}
	if input.Read != nil {
		payload["read"] = *input.Read
	}
	if input.Starred != nil {
		payload["starred"] = *input.Starred
	}
	if len(payload) == 0 {
		return nil, errors.New("at least one status field is required")
	}

	var result Message
	if err := a.apiRequest(
		profile.BaseURL,
		profile.Token,
		http.MethodPatch,
		"/api/v1/messages/"+pathEscape(input.MessageID)+"/status",
		payload,
		&result,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &result, nil
}

func (a *App) DownloadAttachment(input DownloadAttachmentInput) (*DownloadResult, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	filename := safeDownloadName(input.Filename)
	path, err := wailsruntime.SaveFileDialog(a.appContext(), wailsruntime.SaveDialogOptions{
		DefaultFilename: filename,
		Title:           "Save attachment",
	})
	if err != nil {
		return nil, err
	}

	if path == "" {
		return nil, errors.New("download canceled")
	}

	tempFile, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".download-*")
	if err != nil {
		return nil, err
	}
	tempPath := tempFile.Name()
	keepTempFile := false
	defer func() {
		if !keepTempFile {
			_ = os.Remove(tempPath)
		}
	}()

	_, size, err := a.apiDownloadTo(
		profile.BaseURL,
		profile.Token,
		"/api/v1/attachments/"+pathEscape(input.AttachmentID),
		tempFile,
		0,
	)
	closeErr := tempFile.Close()
	if err != nil {
		return nil, err
	}
	if closeErr != nil {
		return nil, closeErr
	}

	if err := replaceFile(tempPath, path); err != nil {
		return nil, err
	}
	keepTempFile = true

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &DownloadResult{
		Path: path,
		Size: size,
	}, nil
}

func (a *App) PreviewAttachment(input DownloadAttachmentInput) (*AttachmentPreview, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	tempFile, err := os.CreateTemp("", previewTempPattern(input.Filename))
	if err != nil {
		return nil, err
	}
	tempPath := tempFile.Name()
	keepTempFile := false
	defer func() {
		if !keepTempFile {
			_ = os.Remove(tempPath)
		}
	}()

	contentType, size, err := a.apiDownloadTo(
		profile.BaseURL,
		profile.Token,
		"/api/v1/attachments/"+pathEscape(input.AttachmentID)+"?disposition=inline",
		tempFile,
		12*1024*1024,
	)
	closeErr := tempFile.Close()
	if err != nil {
		if errors.Is(err, errDownloadExceedsSizeLimit) {
			return nil, errors.New("attachment is too large to preview")
		}
		return nil, err
	}
	if closeErr != nil {
		return nil, closeErr
	}

	mimeType := normalizePreviewMime(contentType, input.Filename)
	previewType := attachmentPreviewType(mimeType)
	if previewType == "file" {
		return nil, errors.New("attachment type is not previewable")
	}

	preview := &AttachmentPreview{
		Filename:    safeDownloadName(input.Filename),
		MimeType:    mimeType,
		Size:        size,
		PreviewType: previewType,
	}
	tempPreviewPath := ""
	tempPreviewContentType := mimeType

	switch previewType {
	case "pdf":
		if !strings.HasSuffix(strings.ToLower(tempPath), ".pdf") {
			pdfPath := tempPath + ".pdf"
			if err := os.Rename(tempPath, pdfPath); err == nil {
				tempPath = pdfPath
			}
		}

		preview.Encrypted = pdfFileHasEncryptionDictionary(tempPath)
		tempPreviewPath = tempPath
	case "image":
		tempPreviewPath = tempPath
	case "text":
		text, truncated, err := readTextPreview(tempPath, 512*1024)
		if err != nil {
			return nil, err
		}
		preview.Text = text
		preview.TextTruncated = truncated
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	if tempPreviewPath != "" {
		preview.PreviewID = a.registerAttachmentPreview(tempPreviewPath, tempPreviewContentType)
		preview.PreviewURL = attachmentPreviewURL(preview.PreviewID, preview.Filename)
		keepTempFile = true
	}

	return preview, nil
}

func (a *App) ReleaseAttachmentPreview(previewID string) error {
	if previewID == "" {
		return nil
	}

	a.previewMu.Lock()
	file, ok := a.previewFiles[previewID]
	if ok {
		delete(a.previewFiles, previewID)
	}
	a.previewMu.Unlock()

	if !ok {
		return nil
	}

	if err := os.Remove(file.path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	return nil
}

func (a *App) releaseAllAttachmentPreviews() {
	a.previewMu.Lock()
	paths := make([]string, 0, len(a.previewFiles))
	for previewID, file := range a.previewFiles {
		paths = append(paths, file.path)
		delete(a.previewFiles, previewID)
	}
	a.previewMu.Unlock()

	for _, path := range paths {
		_ = os.Remove(path)
	}
}

func (a *App) attachmentPreviewCount() int {
	a.previewMu.Lock()
	defer a.previewMu.Unlock()

	return len(a.previewFiles)
}

func (a *App) clearAttachmentPreviewCache() *CacheClearResult {
	a.previewMu.Lock()
	paths := make([]string, 0, len(a.previewFiles))
	for previewID, file := range a.previewFiles {
		paths = append(paths, file.path)
		delete(a.previewFiles, previewID)
	}
	a.previewMu.Unlock()

	result := &CacheClearResult{}
	for _, path := range paths {
		info, err := os.Stat(path)
		if err == nil && !info.IsDir() {
			result.RemovedSize += info.Size()
			result.RemovedFiles++
		}
		_ = os.Remove(path)
	}
	return result
}

func (a *App) profileForRequest(profileID string) (storedProfile, error) {
	if err := a.ensureReady(); err != nil {
		return storedProfile{}, err
	}

	profile, ok := a.store.get(profileID)
	if !ok {
		return storedProfile{}, errors.New("profile not found")
	}

	if profile.Token == "" {
		return storedProfile{}, errors.New("profile has no device token")
	}

	return profile, nil
}

func (a *App) adminProfileForRequest(profileID string) (storedProfile, error) {
	if err := a.ensureReady(); err != nil {
		return storedProfile{}, err
	}

	profile, ok := a.store.get(profileID)
	if !ok {
		return storedProfile{}, errors.New("profile not found")
	}

	if profile.AdminToken == "" {
		return storedProfile{}, errors.New("profile has no admin session")
	}

	return profile, nil
}

func (a *App) messageAction(input MessageActionInput, path string, method string) (*Message, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	if input.MessageID == "" {
		return nil, errors.New("message id is required")
	}

	var result Message
	if err := a.apiRequest(profile.BaseURL, profile.Token, method, path, nil, &result); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &result, nil
}
