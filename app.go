package main

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"
)

type App struct {
	ctx          context.Context
	client       *http.Client
	store        *profileStore
	initErr      error
	previewMu    sync.Mutex
	previewSeq   uint64
	previewFiles map[string]attachmentPreviewFile
}

type attachmentPreviewFile struct {
	path        string
	contentType string
}

func NewApp() *App {
	store, err := newProfileStore()

	return &App{
		client:       &http.Client{Timeout: 20 * time.Second},
		store:        store,
		initErr:      err,
		previewFiles: map[string]attachmentPreviewFile{},
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

		file, ok := a.attachmentPreviewFile(previewID)
		if !ok {
			http.NotFound(writer, request)
			return
		}

		contentType := file.contentType
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		writer.Header().Set("Content-Type", contentType)
		writer.Header().Set("X-Content-Type-Options", "nosniff")
		http.ServeFile(writer, request, file.path)
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
