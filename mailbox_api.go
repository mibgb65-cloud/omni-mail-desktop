package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

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
	messageLimit := normalizeMessageLimit(input.MessageLimit)
	messageOffset := input.MessageOffset
	if messageOffset < 0 {
		messageOffset = 0
	}
	payload.MessageLimit = messageLimit
	payload.MessageOffset = messageOffset

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
		query := url.Values{}
		query.Set("accountId", selectedAccountID)
		query.Set("limit", strconv.Itoa(messageLimit))
		query.Set("offset", strconv.Itoa(messageOffset))
		data, err := a.apiRequestData(
			profile.BaseURL,
			profile.Token,
			http.MethodGet,
			"/api/v1/messages?"+query.Encode(),
			nil,
		)
		if err != nil {
			return nil, err
		}

		messages, total, hasMore, err := decodeMessagesPayload(data, messageLimit, messageOffset)
		if err != nil {
			return nil, err
		}
		payload.Messages = messages
		payload.TotalMessages = total
		payload.HasMoreMessages = hasMore
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

func normalizeMessageLimit(value int) int {
	switch {
	case value <= 0:
		return 50
	case value > 200:
		return 200
	default:
		return value
	}
}

type messagesPagePayload struct {
	Messages      []Message `json:"messages"`
	Items         []Message `json:"items"`
	Total         int       `json:"total"`
	TotalMessages int       `json:"totalMessages"`
	HasMore       *bool     `json:"hasMore"`
	NextOffset    int       `json:"nextOffset"`
}

func decodeMessagesPayload(data json.RawMessage, limit int, offset int) ([]Message, int, bool, error) {
	if len(data) == 0 || string(data) == "null" {
		return []Message{}, 0, false, nil
	}

	var messages []Message
	if err := json.Unmarshal(data, &messages); err == nil {
		return messages, len(messages), false, nil
	}

	var page messagesPagePayload
	if err := json.Unmarshal(data, &page); err != nil {
		return nil, 0, false, err
	}

	messages = page.Messages
	if messages == nil {
		messages = page.Items
	}
	if messages == nil {
		messages = []Message{}
	}

	total := page.TotalMessages
	if total == 0 {
		total = page.Total
	}
	if total == 0 {
		total = offset + len(messages)
	}

	hasMore := false
	if page.HasMore != nil {
		hasMore = *page.HasMore
	} else if total > offset+len(messages) {
		hasMore = true
	} else if limit > 0 && page.NextOffset > offset+len(messages) {
		hasMore = true
	}

	return messages, total, hasMore, nil
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
