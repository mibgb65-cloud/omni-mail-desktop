package main

import (
	"errors"
	"net/http"
	"strings"
	"time"
)

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
