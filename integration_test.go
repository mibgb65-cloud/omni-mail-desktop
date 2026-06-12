//go:build integration

package main

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLocalWorkerIntegration(t *testing.T) {
	baseURL := os.Getenv("OMNIMAIL_TEST_BASE_URL")
	if baseURL == "" {
		t.Skip("OMNIMAIL_TEST_BASE_URL is not set")
	}

	app := &App{
		client: &http.Client{Timeout: 5 * time.Second},
		store: &profileStore{
			path: filepath.Join(t.TempDir(), "profiles.json"),
		},
	}

	status, err := app.TestBaseURL(baseURL, "")
	if err != nil {
		t.Fatalf("TestBaseURL returned error: %v", err)
	}
	if !status.OK {
		t.Fatalf("expected base URL to be reachable, got %q", status.Message)
	}
	if status.Health == nil || status.Health.Service != "omnimail" {
		t.Fatalf("unexpected health response: %#v", status.Health)
	}

	profile, err := app.SaveProfile(ProfileInput{
		Name:    "Local Worker",
		BaseURL: baseURL,
	})
	if err != nil {
		t.Fatalf("SaveProfile returned error: %v", err)
	}

	profile, err = app.SaveProfileToken(TokenInput{
		ProfileID:   profile.ID,
		DeviceToken: "mock-token",
		DeviceLabel: "Integration Test",
	})
	if err != nil {
		t.Fatalf("SaveProfileToken returned error: %v", err)
	}
	if !profile.HasToken {
		t.Fatal("expected profile to have a token")
	}

	mailbox, err := app.LoadMailbox(MailboxRequest{ProfileID: profile.ID, Domain: "omnimail.dev"})
	if err != nil {
		t.Fatalf("LoadMailbox returned error: %v", err)
	}
	if len(mailbox.Domains) == 0 {
		t.Fatal("expected domains")
	}
	if len(mailbox.Accounts) == 0 {
		t.Fatal("expected accounts")
	}

	sendResult, err := app.SendMessage(SendMessageInput{
		ProfileID: profile.ID,
		AccountID: mailbox.Accounts[0].ID,
		To:        "test@example.com",
		Subject:   "Integration smoke",
		Text:      "Smoke test from OmniMail Desktop.",
	})
	if err != nil {
		t.Fatalf("SendMessage returned error: %v", err)
	}
	if !sendResult.Queued {
		t.Fatalf("expected queued send result, got %#v", sendResult)
	}
}
