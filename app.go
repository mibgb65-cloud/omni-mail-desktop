package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx          context.Context
	client       *http.Client
	store        *profileStore
	initErr      error
	previewMu    sync.Mutex
	previewSeq   uint64
	previewFiles map[string]string
}

func NewApp() *App {
	store, err := newProfileStore()

	return &App{
		client:       &http.Client{Timeout: 20 * time.Second},
		store:        store,
		initErr:      err,
		previewFiles: map[string]string{},
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) shutdown(context.Context) {
	a.releaseAllAttachmentPreviews()
}

func (a *App) appContext() context.Context {
	if a.ctx != nil {
		return a.ctx
	}

	return context.Background()
}

func (a *App) assetHandler() http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		previewID, ok := attachmentPreviewIDFromPath(request.URL.Path)
		if !ok {
			http.NotFound(writer, request)
			return
		}

		path, ok := a.attachmentPreviewPath(previewID)
		if !ok {
			http.NotFound(writer, request)
			return
		}

		writer.Header().Set("Content-Type", "application/pdf")
		writer.Header().Set("X-Content-Type-Options", "nosniff")
		http.ServeFile(writer, request, path)
	})
}

func (a *App) ensureReady() error {
	if a.initErr != nil {
		return a.initErr
	}

	if a.store == nil {
		return errors.New("profile store is not available")
	}

	return nil
}

func (a *App) GetInitialState() (*InitialState, error) {
	if err := a.ensureReady(); err != nil {
		return nil, err
	}

	return &InitialState{
		Profiles:          a.store.listPublic(),
		SelectedProfileID: a.store.selectedID(),
		StoragePath:       a.store.path,
	}, nil
}

func (a *App) SaveProfile(input ProfileInput) (*Profile, error) {
	if err := a.ensureReady(); err != nil {
		return nil, err
	}

	profile, err := a.store.upsert(input)
	if err != nil {
		return nil, err
	}

	public := profile.public()
	return &public, nil
}

func (a *App) DeleteProfile(id string) error {
	if err := a.ensureReady(); err != nil {
		return err
	}

	return a.store.delete(id)
}

func (a *App) SelectProfile(id string) error {
	if err := a.ensureReady(); err != nil {
		return err
	}

	return a.store.selectProfile(id)
}

func (a *App) SaveProfileToken(input TokenInput) (*Profile, error) {
	if err := a.ensureReady(); err != nil {
		return nil, err
	}

	profile, err := a.store.updateToken(input.ProfileID, input.DeviceToken, input.DeviceLabel, "")
	if err != nil {
		return nil, err
	}

	public := profile.public()
	return &public, nil
}

func (a *App) TestBaseURL(baseURL string, token string) (*ConnectionStatus, error) {
	normalized, err := normalizeBaseURL(baseURL)
	if err != nil {
		return nil, err
	}

	status := &ConnectionStatus{
		BaseURL: normalized,
		OK:      false,
		Message: "unreachable",
	}

	var health HealthData
	if err := a.apiRequest(normalized, token, http.MethodGet, "/api/health", nil, &health); err != nil {
		status.Message = err.Error()
		return status, nil
	}

	status.OK = true
	status.Message = "ok"
	status.Health = &health

	var auth AuthStatus
	if err := a.apiRequest(normalized, token, http.MethodGet, "/api/v1/auth/status", nil, &auth); err != nil {
		status.AuthError = err.Error()
	} else {
		status.AuthStatus = &auth
	}

	return status, nil
}

func (a *App) AuthorizeProfile(input DeviceAuthInput) (*Profile, error) {
	if err := a.ensureReady(); err != nil {
		return nil, err
	}

	profile, ok := a.store.get(input.ProfileID)
	if !ok {
		return nil, errors.New("profile not found")
	}

	authPath := "/api/v1/auth/login"
	if input.Setup {
		authPath = "/api/v1/auth/setup"
	}

	var auth AuthResult
	if err := a.apiRequest(profile.BaseURL, "", http.MethodPost, authPath, map[string]string{
		"email":    input.Email,
		"password": input.Password,
	}, &auth); err != nil {
		return nil, err
	}

	if auth.Token == "" {
		return nil, errors.New("authentication response did not include a token")
	}

	label := input.DeviceLabel
	if label == "" {
		label = "Windows Desktop"
	}

	var device DeviceResult
	if err := a.apiRequest(profile.BaseURL, auth.Token, http.MethodPost, "/api/v1/devices/register", map[string]string{
		"clientType": "desktop",
		"label":      label,
		"scope":      "read_write",
	}, &device); err != nil {
		return nil, err
	}

	if device.DeviceToken == "" {
		return nil, errors.New("device registration response did not include a device token")
	}

	updated, err := a.store.updateToken(profile.ID, device.DeviceToken, label, device.ID)
	if err != nil {
		return nil, err
	}

	updated, err = a.store.updateAdminSession(profile.ID, auth.Token, auth.User)
	if err != nil {
		return nil, err
	}

	public := updated.public()
	return &public, nil
}

func (a *App) AuthorizeAdminSession(input DeviceAuthInput) (*Profile, error) {
	if err := a.ensureReady(); err != nil {
		return nil, err
	}

	profile, ok := a.store.get(input.ProfileID)
	if !ok {
		return nil, errors.New("profile not found")
	}

	authPath := "/api/v1/auth/login"
	if input.Setup {
		authPath = "/api/v1/auth/setup"
	}

	var auth AuthResult
	if err := a.apiRequest(profile.BaseURL, "", http.MethodPost, authPath, map[string]string{
		"email":    input.Email,
		"password": input.Password,
	}, &auth); err != nil {
		return nil, err
	}

	if auth.Token == "" {
		return nil, errors.New("authentication response did not include a token")
	}

	updated, err := a.store.updateAdminSession(profile.ID, auth.Token, auth.User)
	if err != nil {
		return nil, err
	}

	public := updated.public()
	return &public, nil
}

func (a *App) ClearAdminSession(input ProfileActionInput) (*Profile, error) {
	if err := a.ensureReady(); err != nil {
		return nil, err
	}

	updated, err := a.store.clearAdminSession(input.ProfileID)
	if err != nil {
		return nil, err
	}

	public := updated.public()
	return &public, nil
}

func (a *App) ValidateAdminSession(input ProfileActionInput) (*AuthStatus, error) {
	profile, err := a.adminProfileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	var status AuthStatus
	if err := a.apiRequest(profile.BaseURL, profile.AdminToken, http.MethodGet, "/api/v1/auth/status", nil, &status); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &status, nil
}

func (a *App) LoadMailbox(input MailboxRequest) (*MailboxPayload, error) {
	if err := a.ensureReady(); err != nil {
		return nil, err
	}

	profile, ok := a.store.get(input.ProfileID)
	if !ok {
		return nil, errors.New("profile not found")
	}

	if profile.Token == "" {
		return nil, errors.New("profile has no device token")
	}

	payload := &MailboxPayload{
		Profile: profile.public(),
	}

	var domains []string
	if err := a.apiRequest(profile.BaseURL, profile.Token, http.MethodGet, "/api/v1/domains", nil, &domains); err != nil {
		return nil, err
	}

	payload.Domains = domains
	selectedDomain := input.Domain
	if selectedDomain == "" && len(domains) > 0 {
		selectedDomain = domains[0]
	}
	payload.SelectedDomain = selectedDomain

	accountsPath := "/api/v1/accounts"
	if selectedDomain != "" {
		accountsPath += "?domain=" + queryEscape(selectedDomain)
	}

	var accounts []Account
	if err := a.apiRequest(profile.BaseURL, profile.Token, http.MethodGet, accountsPath, nil, &accounts); err != nil {
		return nil, err
	}

	payload.Accounts = accounts
	selectedAccountID := input.AccountID
	if selectedAccountID == "" && len(accounts) > 0 {
		selectedAccountID = accounts[0].ID
	}
	payload.SelectedAccountID = selectedAccountID

	if selectedAccountID != "" {
		var messages []Message
		path := "/api/v1/messages?accountId=" + queryEscape(selectedAccountID)
		if err := a.apiRequest(profile.BaseURL, profile.Token, http.MethodGet, path, nil, &messages); err != nil {
			return nil, err
		}

		payload.Messages = messages
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return payload, nil
}

func (a *App) CreateAccount(input AccountInput) (*Account, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	payload := map[string]string{
		"name": strings.TrimSpace(input.Name),
	}

	address := strings.TrimSpace(input.Address)
	if address != "" {
		payload["address"] = address
	} else {
		localPart := strings.TrimSpace(input.LocalPart)
		domain := strings.TrimSpace(input.Domain)
		if localPart == "" || domain == "" {
			return nil, errors.New("mailbox name and domain are required")
		}
		payload["localPart"] = localPart
		payload["domain"] = domain
	}

	var account Account
	if err := a.apiRequest(profile.BaseURL, profile.Token, http.MethodPost, "/api/v1/accounts", payload, &account); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &account, nil
}

func (a *App) CreateDomain(input DomainInput) (*DomainRecord, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	domain := strings.TrimSpace(input.Domain)
	if domain == "" {
		return nil, errors.New("domain is required")
	}

	var result DomainRecord
	if err := a.apiRequest(profile.BaseURL, profile.Token, http.MethodPost, "/api/v1/domains", map[string]string{
		"domain": domain,
	}, &result); err != nil {
		return nil, err
	}

	if result.Domain == "" {
		result.Domain = domain
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &result, nil
}

func (a *App) UpdateAccount(input AccountUpdateInput) (*Account, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(input.AccountID) == "" {
		return nil, errors.New("account id is required")
	}

	payload := map[string]any{}
	if name := strings.TrimSpace(input.Name); name != "" {
		payload["name"] = name
	}
	if input.Enabled != nil {
		payload["enabled"] = *input.Enabled
	}
	if len(payload) == 0 {
		return nil, errors.New("at least one account field is required")
	}

	var account Account
	if err := a.apiRequest(
		profile.BaseURL,
		profile.Token,
		http.MethodPatch,
		"/api/v1/accounts/"+pathEscape(input.AccountID),
		payload,
		&account,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &account, nil
}

func (a *App) DeleteAccount(input AccountDeleteInput) (*Account, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(input.AccountID) == "" {
		return nil, errors.New("account id is required")
	}

	var account Account
	if err := a.apiRequest(
		profile.BaseURL,
		profile.Token,
		http.MethodDelete,
		"/api/v1/accounts/"+pathEscape(input.AccountID),
		nil,
		&account,
	); err != nil {
		return nil, err
	}

	if account.ID == "" {
		account.ID = input.AccountID
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &account, nil
}

func (a *App) GetAccountSettings(input AccountSettingsRequest) (*AccountSettings, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(input.AccountID) == "" {
		return nil, errors.New("account id is required")
	}

	var settings AccountSettings
	if err := a.apiRequest(
		profile.BaseURL,
		profile.Token,
		http.MethodGet,
		"/api/v1/accounts/"+pathEscape(input.AccountID)+"/settings",
		nil,
		&settings,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &settings, nil
}

func (a *App) SaveAccountSettings(input AccountSettingsInput) (*AccountSettings, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(input.AccountID) == "" {
		return nil, errors.New("account id is required")
	}

	var settings AccountSettings
	if err := a.apiRequest(
		profile.BaseURL,
		profile.Token,
		http.MethodPut,
		"/api/v1/accounts/"+pathEscape(input.AccountID)+"/settings",
		input.Settings,
		&settings,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &settings, nil
}

func (a *App) GetDomainDNSHealth(input DNSHealthRequest) (*DNSHealth, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	domain := strings.TrimSpace(input.Domain)
	if domain == "" {
		return nil, errors.New("domain is required")
	}

	var health DNSHealth
	if err := a.apiRequest(
		profile.BaseURL,
		profile.Token,
		http.MethodGet,
		"/api/v1/system/dns-health?domain="+queryEscape(domain),
		nil,
		&health,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &health, nil
}

func (a *App) RunSystemCleanup(input CleanupInput) (*CleanupResult, error) {
	profile, err := a.adminProfileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	retentionDays := input.RetentionDays
	if retentionDays <= 0 {
		retentionDays = 90
	}

	var result CleanupResult
	if err := a.apiRequest(
		profile.BaseURL,
		profile.AdminToken,
		http.MethodPost,
		"/api/v1/system/cleanup",
		map[string]any{
			"retentionDays": retentionDays,
			"dryRun":        input.DryRun,
		},
		&result,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &result, nil
}

func (a *App) ListDevices(input ProfileActionInput) ([]DeviceResult, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	var devices []DeviceResult
	if err := a.apiRequest(profile.BaseURL, profile.Token, http.MethodGet, "/api/v1/devices", nil, &devices); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return devices, nil
}

func (a *App) UpdateDevice(input DeviceUpdateInput) (*DeviceResult, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(input.DeviceID) == "" {
		return nil, errors.New("device id is required")
	}

	payload := map[string]any{}
	if label := strings.TrimSpace(input.Label); label != "" {
		payload["label"] = label
	}
	if clientType := strings.TrimSpace(input.ClientType); clientType != "" {
		payload["clientType"] = clientType
	}
	if scope := strings.TrimSpace(input.Scope); scope != "" {
		payload["scope"] = scope
	}
	if input.Enabled != nil {
		payload["enabled"] = *input.Enabled
	}
	if len(payload) == 0 {
		return nil, errors.New("at least one device field is required")
	}

	var device DeviceResult
	if err := a.apiRequest(
		profile.BaseURL,
		profile.Token,
		http.MethodPatch,
		"/api/v1/devices/"+pathEscape(input.DeviceID),
		payload,
		&device,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &device, nil
}

func (a *App) RevokeDevice(input DeviceDeleteInput) (*DeviceResult, error) {
	profile, err := a.profileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(input.DeviceID) == "" {
		return nil, errors.New("device id is required")
	}

	var device DeviceResult
	if err := a.apiRequest(
		profile.BaseURL,
		profile.Token,
		http.MethodDelete,
		"/api/v1/devices/"+pathEscape(input.DeviceID),
		nil,
		&device,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &device, nil
}

func (a *App) ListUsers(input ProfileActionInput) ([]APIUser, error) {
	profile, err := a.adminProfileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	var users []APIUser
	if err := a.apiRequest(profile.BaseURL, profile.AdminToken, http.MethodGet, "/api/v1/users", nil, &users); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return users, nil
}

func (a *App) CreateUser(input UserInput) (*APIUser, error) {
	profile, err := a.adminProfileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	var user APIUser
	if err := a.apiRequest(
		profile.BaseURL,
		profile.AdminToken,
		http.MethodPost,
		"/api/v1/users",
		map[string]string{
			"email":       strings.TrimSpace(input.Email),
			"password":    input.Password,
			"displayName": strings.TrimSpace(input.DisplayName),
			"avatarColor": strings.TrimSpace(input.AvatarColor),
		},
		&user,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &user, nil
}

func (a *App) UpdateUser(input UserInput) (*APIUser, error) {
	profile, err := a.adminProfileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(input.UserID) == "" {
		return nil, errors.New("user id is required")
	}

	payload := map[string]any{}
	if displayName := strings.TrimSpace(input.DisplayName); displayName != "" {
		payload["displayName"] = displayName
	}
	if avatarColor := strings.TrimSpace(input.AvatarColor); avatarColor != "" {
		payload["avatarColor"] = avatarColor
	}
	if input.Enabled != nil {
		payload["enabled"] = *input.Enabled
	}
	if len(payload) == 0 {
		return nil, errors.New("at least one user field is required")
	}

	var user APIUser
	if err := a.apiRequest(
		profile.BaseURL,
		profile.AdminToken,
		http.MethodPatch,
		"/api/v1/users/"+pathEscape(input.UserID),
		payload,
		&user,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &user, nil
}

func (a *App) ChangePassword(input ChangePasswordInput) (*AuthResult, error) {
	profile, err := a.adminProfileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	var result AuthResult
	if err := a.apiRequest(
		profile.BaseURL,
		profile.AdminToken,
		http.MethodPost,
		"/api/v1/auth/change-password",
		map[string]string{
			"currentPassword": input.CurrentPassword,
			"newPassword":     input.NewPassword,
		},
		&result,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}
	if result.Token != "" {
		if _, err := a.store.updateAdminSession(profile.ID, result.Token, result.User); err != nil {
			return nil, err
		}
	}

	return &result, nil
}

func (a *App) RevokeSessions(input ProfileActionInput) (*AuthResult, error) {
	profile, err := a.adminProfileForRequest(input.ProfileID)
	if err != nil {
		return nil, err
	}

	var result AuthResult
	if err := a.apiRequest(
		profile.BaseURL,
		profile.AdminToken,
		http.MethodPost,
		"/api/v1/auth/revoke-sessions",
		nil,
		&result,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}
	if result.Token != "" {
		if _, err := a.store.updateAdminSession(profile.ID, result.Token, result.User); err != nil {
			return nil, err
		}
	}

	return &result, nil
}

func (a *App) GetEndpointDiagnostics(profileID string) (*EndpointDiagnostics, error) {
	profile, err := a.profileForRequest(profileID)
	if err != nil {
		return nil, err
	}

	var diagnostics EndpointDiagnostics
	if err := a.apiRequest(
		profile.BaseURL,
		profile.Token,
		http.MethodGet,
		"/api/v1/system/diagnostics",
		nil,
		&diagnostics,
	); err != nil {
		return nil, err
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	return &diagnostics, nil
}

func (a *App) CheckEndpointHealth(profileID string) (*EndpointHealth, error) {
	if err := a.ensureReady(); err != nil {
		return nil, err
	}

	profile, ok := a.store.get(profileID)
	if !ok {
		return nil, errors.New("profile not found")
	}

	health := &EndpointHealth{
		ProfileID: profile.ID,
		CheckedAt: time.Now().Format(time.RFC3339),
		Connection: &ConnectionStatus{
			BaseURL: profile.BaseURL,
			OK:      false,
			Message: "unreachable",
		},
	}

	var healthData HealthData
	if err := a.apiRequest(profile.BaseURL, profile.Token, http.MethodGet, "/api/health", nil, &healthData); err != nil {
		health.Connection.Message = err.Error()
		health.Error = err.Error()
		return health, nil
	}

	health.Connection.OK = true
	health.Connection.Message = "ok"
	health.Connection.Health = &healthData

	var auth AuthStatus
	if err := a.apiRequest(profile.BaseURL, profile.Token, http.MethodGet, "/api/v1/auth/status", nil, &auth); err != nil {
		health.Connection.AuthError = err.Error()
	} else {
		health.Connection.AuthStatus = &auth
	}

	if profile.Token == "" {
		return health, nil
	}

	var diagnostics EndpointDiagnostics
	if err := a.apiRequest(
		profile.BaseURL,
		profile.Token,
		http.MethodGet,
		"/api/v1/system/diagnostics",
		nil,
		&diagnostics,
	); err != nil {
		health.Error = err.Error()
		return health, nil
	}

	health.Diagnostics = &diagnostics
	return health, nil
}

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
	case "image", "text":
		content, err := os.ReadFile(tempPath)
		if err != nil {
			return nil, err
		}
		preview.DataURL = "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(content)
		if previewType == "text" {
			preview.Text = string(content)
		}
	}

	if err := a.store.markUsed(profile.ID); err != nil {
		return nil, err
	}

	if tempPreviewPath != "" {
		preview.PreviewID = a.registerAttachmentPreview(tempPreviewPath)
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
	path, ok := a.previewFiles[previewID]
	if ok {
		delete(a.previewFiles, previewID)
	}
	a.previewMu.Unlock()

	if !ok {
		return nil
	}

	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	return nil
}

func (a *App) releaseAllAttachmentPreviews() {
	a.previewMu.Lock()
	paths := make([]string, 0, len(a.previewFiles))
	for previewID, path := range a.previewFiles {
		paths = append(paths, path)
		delete(a.previewFiles, previewID)
	}
	a.previewMu.Unlock()

	for _, path := range paths {
		_ = os.Remove(path)
	}
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

func (a *App) attachmentPreviewPath(previewID string) (string, bool) {
	a.previewMu.Lock()
	defer a.previewMu.Unlock()

	path, ok := a.previewFiles[previewID]
	return path, ok
}

func (a *App) registerAttachmentPreview(path string) string {
	a.previewMu.Lock()
	defer a.previewMu.Unlock()

	if a.previewFiles == nil {
		a.previewFiles = map[string]string{}
	}

	a.previewSeq++
	previewID := strconv.FormatUint(a.previewSeq, 10)
	a.previewFiles[previewID] = path
	return previewID
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
