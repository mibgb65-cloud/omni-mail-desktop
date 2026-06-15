package main

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
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

	app := &App{previewFiles: map[string]string{}}
	previewID := app.registerAttachmentPreview(path)
	request := httptest.NewRequest(http.MethodGet, attachmentPreviewURL(previewID, "invoice.pdf"), nil)
	response := httptest.NewRecorder()

	app.assetHandler().ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}
	if got := response.Body.String(); got != "%PDF-1.7" {
		t.Fatalf("body = %q, want PDF bytes", got)
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
