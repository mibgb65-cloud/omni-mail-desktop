package main

import "testing"

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
