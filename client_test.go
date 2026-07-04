package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestNormalizeBaseURL(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "adds https", input: "mail.example.com", want: "https://mail.example.com"},
		{name: "trims slash", input: "https://mail.example.com/", want: "https://mail.example.com"},
		{name: "strips api path", input: "https://mail.example.com/api", want: "https://mail.example.com"},
		{name: "keeps subpath", input: "https://example.com/omnimail/", want: "https://example.com/omnimail"},
		{name: "drops query", input: "https://mail.example.com?x=1", want: "https://mail.example.com"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := normalizeBaseURL(test.input)
			if err != nil {
				t.Fatalf("normalizeBaseURL returned error: %v", err)
			}

			if got != test.want {
				t.Fatalf("normalizeBaseURL() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestNormalizeBaseURLRejectsInvalidScheme(t *testing.T) {
	if _, err := normalizeBaseURL("ftp://mail.example.com"); err == nil {
		t.Fatal("expected invalid scheme error")
	}
}

func TestAttachmentPreviewTypeFromMimeAndFilename(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		filename    string
		wantMime    string
		wantType    string
	}{
		{name: "uses image content type", contentType: "image/png; charset=binary", filename: "file.bin", wantMime: "image/png", wantType: "image"},
		{name: "falls back to pdf extension", contentType: "application/octet-stream", filename: "invoice.pdf", wantMime: "application/pdf", wantType: "pdf"},
		{name: "falls back to json extension", contentType: "", filename: "data.json", wantMime: "application/json", wantType: "text"},
		{name: "unknown is not previewable", contentType: "", filename: "archive.zip", wantMime: "application/octet-stream", wantType: "file"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			gotMime := normalizePreviewMime(test.contentType, test.filename)
			if gotMime != test.wantMime {
				t.Fatalf("normalizePreviewMime() = %q, want %q", gotMime, test.wantMime)
			}

			gotType := attachmentPreviewType(gotMime)
			if gotType != test.wantType {
				t.Fatalf("attachmentPreviewType() = %q, want %q", gotType, test.wantType)
			}
		})
	}
}

func TestPDFHasEncryptionDictionary(t *testing.T) {
	if !pdfHasEncryptionDictionary([]byte("%PDF-1.7\ntrailer\n<< /Encrypt 5 0 R >>")) {
		t.Fatal("expected PDF encryption dictionary to be detected")
	}

	if pdfHasEncryptionDictionary([]byte("%PDF-1.7\ntrailer\n<< /Root 1 0 R >>")) {
		t.Fatal("did not expect unencrypted PDF to be marked encrypted")
	}
}

func TestPreviewTempPatternKeepsPDFExtension(t *testing.T) {
	if got := previewTempPattern("invoice.pdf"); !strings.HasSuffix(got, ".pdf") {
		t.Fatalf("previewTempPattern() = %q, want .pdf suffix", got)
	}
}

func TestAttachmentPreviewURLRoundTripsID(t *testing.T) {
	previewID := "preview 1"
	got := attachmentPreviewURL(previewID, "invoice 2026.pdf")
	parsedID, ok := attachmentPreviewIDFromPath(got)
	if !ok {
		t.Fatalf("attachmentPreviewIDFromPath(%q) did not parse", got)
	}
	if parsedID != previewID {
		t.Fatalf("parsed preview ID = %q, want %q", parsedID, previewID)
	}
}

func TestAttachmentPreviewHandlerServesRegisteredFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "invoice.pdf")
	if err := os.WriteFile(path, []byte("%PDF-1.7"), 0o600); err != nil {
		t.Fatalf("write PDF: %v", err)
	}

	app := &App{previewFiles: map[string]attachmentPreviewFile{}}
	previewID := app.registerAttachmentPreview(path, "application/pdf")
	request := httptest.NewRequest(http.MethodGet, attachmentPreviewURL(previewID, "invoice.pdf"), nil)
	response := httptest.NewRecorder()

	app.assetHandler().ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if got := response.Body.String(); got != "%PDF-1.7" {
		t.Fatalf("body = %q, want PDF bytes", got)
	}
	if got := response.Header().Get("Content-Type"); got != "application/pdf" {
		t.Fatalf("content type = %q, want application/pdf", got)
	}
}

func TestAPIDownloadToRejectsLargeResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Length", "6")
		_, _ = writer.Write([]byte("abcdef"))
	}))
	defer server.Close()

	app := &App{client: server.Client()}
	var content bytes.Buffer
	_, _, err := app.apiDownloadTo(server.URL, "", "/attachment", &content, 3)
	if !errors.Is(err, errDownloadExceedsSizeLimit) {
		t.Fatalf("apiDownloadTo() error = %v, want errDownloadExceedsSizeLimit", err)
	}
}

func TestReplaceFileOverwritesTarget(t *testing.T) {
	dir := t.TempDir()
	sourcePath := filepath.Join(dir, "source.tmp")
	targetPath := filepath.Join(dir, "invoice.pdf")

	if err := os.WriteFile(sourcePath, []byte("new"), 0o600); err != nil {
		t.Fatalf("write source: %v", err)
	}
	if err := os.WriteFile(targetPath, []byte("old"), 0o600); err != nil {
		t.Fatalf("write target: %v", err)
	}

	if err := replaceFile(sourcePath, targetPath); err != nil {
		t.Fatalf("replaceFile returned error: %v", err)
	}

	content, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatalf("read target: %v", err)
	}
	if string(content) != "new" {
		t.Fatalf("target content = %q, want new", content)
	}
	if _, err := os.Stat(sourcePath); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("source still exists after replace: %v", err)
	}
}

func TestSafeDownloadNamePreservesExtensionAndAvoidsReservedNames(t *testing.T) {
	name := strings.Repeat("发", 200) + ".pdf"
	got := safeDownloadName(name)
	if !strings.HasSuffix(got, ".pdf") {
		t.Fatalf("safeDownloadName() = %q, want .pdf suffix", got)
	}
	if len([]rune(got)) > 160 {
		t.Fatalf("safeDownloadName() rune length = %d, want <= 160", len([]rune(got)))
	}

	if got := safeDownloadName("CON.txt"); got != "_CON.txt" {
		t.Fatalf("safeDownloadName(CON.txt) = %q, want _CON.txt", got)
	}
}

func TestDecodeMessagesPayloadSupportsArrayAndPagedObject(t *testing.T) {
	arrayPayload := json.RawMessage(`[{"id":"m1"},{"id":"m2"}]`)
	messages, total, hasMore, err := decodeMessagesPayload(arrayPayload, 50, 0)
	if err != nil {
		t.Fatalf("decode array: %v", err)
	}
	if len(messages) != 2 || total != 2 || hasMore {
		t.Fatalf("array decode = len %d total %d hasMore %v", len(messages), total, hasMore)
	}

	pagePayload := json.RawMessage(`{"messages":[{"id":"m3"}],"total":3}`)
	messages, total, hasMore, err = decodeMessagesPayload(pagePayload, 1, 1)
	if err != nil {
		t.Fatalf("decode page: %v", err)
	}
	if len(messages) != 1 || total != 3 || !hasMore {
		t.Fatalf("page decode = len %d total %d hasMore %v", len(messages), total, hasMore)
	}
}

func TestLoadMailboxSendsPagination(t *testing.T) {
	var messageQuery string
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/api/v1/domains":
			writeAPIData(t, writer, []string{"example.com"})
		case "/api/v1/accounts":
			writeAPIData(t, writer, []Account{{ID: "account-1", Address: "inbox@example.com", Domain: "example.com"}})
		case "/api/v1/messages":
			messageQuery = request.URL.RawQuery
			writeAPIData(t, writer, map[string]any{
				"messages": []Message{{ID: "message-1", Subject: "Hello"}},
				"total":    75,
			})
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	app := &App{
		client: server.Client(),
		store: &profileStore{
			path: filepath.Join(t.TempDir(), "profiles.json"),
			profiles: []storedProfile{{
				ID:      "profile-1",
				BaseURL: server.URL,
				Token:   "token",
			}},
		},
	}

	mailbox, err := app.LoadMailbox(MailboxRequest{
		ProfileID:     "profile-1",
		MessageLimit:  25,
		MessageOffset: 50,
	})
	if err != nil {
		t.Fatalf("LoadMailbox returned error: %v", err)
	}
	if messageQuery != "accountId=account-1&limit=25&offset=50" {
		t.Fatalf("message query = %q, want pagination params", messageQuery)
	}
	if len(mailbox.Messages) != 1 || mailbox.TotalMessages != 75 || !mailbox.HasMoreMessages {
		t.Fatalf("unexpected mailbox page: %#v", mailbox)
	}
}

func TestPreviewAttachmentImageUsesPreviewURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/v1/attachments/attachment-1" {
			http.NotFound(writer, request)
			return
		}

		writer.Header().Set("Content-Type", "image/png")
		_, _ = writer.Write([]byte("png-bytes"))
	}))
	defer server.Close()

	app := &App{
		client:       server.Client(),
		previewFiles: map[string]attachmentPreviewFile{},
		store: &profileStore{
			path: filepath.Join(t.TempDir(), "profiles.json"),
			profiles: []storedProfile{{
				ID:      "profile-1",
				BaseURL: server.URL,
				Token:   "token",
			}},
		},
	}

	preview, err := app.PreviewAttachment(DownloadAttachmentInput{
		ProfileID:    "profile-1",
		AttachmentID: "attachment-1",
		Filename:     "image.png",
	})
	if err != nil {
		t.Fatalf("PreviewAttachment returned error: %v", err)
	}
	defer app.ReleaseAttachmentPreview(preview.PreviewID)

	if preview.PreviewType != "image" || preview.PreviewURL == "" || preview.PreviewID == "" {
		t.Fatalf("unexpected image preview: %#v", preview)
	}
	if preview.DataURL != "" {
		t.Fatalf("DataURL = %q, want empty", preview.DataURL)
	}
}

func TestMarkUsedSkipsRecentWrite(t *testing.T) {
	path := filepath.Join(t.TempDir(), "profiles.json")
	if err := os.WriteFile(path, []byte("sentinel"), 0o600); err != nil {
		t.Fatalf("write sentinel: %v", err)
	}

	store := &profileStore{
		path:              path,
		selectedProfileID: "profile-1",
		profiles: []storedProfile{{
			ID:         "profile-1",
			LastUsedAt: time.Now().Format(time.RFC3339),
		}},
	}
	if err := store.markUsed("profile-1"); err != nil {
		t.Fatalf("markUsed returned error: %v", err)
	}

	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read sentinel: %v", err)
	}
	if string(content) != "sentinel" {
		t.Fatalf("markUsed rewrote recent profile file: %q", content)
	}
}

func writeAPIData(t *testing.T, writer http.ResponseWriter, data any) {
	t.Helper()

	content, err := json.Marshal(data)
	if err != nil {
		t.Fatalf("marshal data: %v", err)
	}
	if err := json.NewEncoder(writer).Encode(apiEnvelope{
		Code: 200,
		Data: content,
	}); err != nil {
		t.Fatalf("write API envelope: %v", err)
	}
}
