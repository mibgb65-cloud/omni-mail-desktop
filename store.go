package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type profileStore struct {
	mu                sync.Mutex
	path              string
	selectedProfileID string
	profiles          []storedProfile
}

type storedProfile struct {
	ID          string
	Name        string
	BaseURL     string
	DeviceLabel string
	Token       string
	AdminToken  string
	AdminEmail  string
	CreatedAt   string
	UpdatedAt   string
	LastUsedAt  string
}

type profileFile struct {
	SelectedProfileID string          `json:"selectedProfileId"`
	Profiles          []profileRecord `json:"profiles"`
}

type profileRecord struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	BaseURL        string `json:"baseUrl"`
	DeviceLabel    string `json:"deviceLabel"`
	Token          string `json:"token"`
	TokenProtected bool   `json:"tokenProtected"`
	AdminToken     string `json:"adminToken"`
	AdminProtected bool   `json:"adminProtected"`
	AdminEmail     string `json:"adminEmail"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
	LastUsedAt     string `json:"lastUsedAt"`
}

func newProfileStore() (*profileStore, error) {
	path, err := profileStorePath()
	if err != nil {
		return nil, err
	}

	store := &profileStore{path: path}
	if err := store.load(); err != nil {
		return nil, err
	}

	return store, nil
}

func profileStorePath() (string, error) {
	if dir, err := os.UserConfigDir(); err == nil {
		appDir := filepath.Join(dir, "OmniMailDesktop")
		if err := os.MkdirAll(appDir, 0o700); err == nil {
			return filepath.Join(appDir, "profiles.json"), nil
		}
	}

	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}

	appDir := filepath.Join(wd, ".omnimail-desktop")
	if err := os.MkdirAll(appDir, 0o700); err != nil {
		return "", err
	}

	return filepath.Join(appDir, "profiles.json"), nil
}

func (s *profileStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	content, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}

	var file profileFile
	if err := json.Unmarshal(content, &file); err != nil {
		return err
	}

	s.selectedProfileID = file.SelectedProfileID
	s.profiles = make([]storedProfile, 0, len(file.Profiles))
	for _, record := range file.Profiles {
		s.profiles = append(s.profiles, storedProfile{
			ID:          record.ID,
			Name:        record.Name,
			BaseURL:     record.BaseURL,
			DeviceLabel: record.DeviceLabel,
			Token:       unprotectSecret(record.Token, record.TokenProtected),
			AdminToken:  unprotectSecret(record.AdminToken, record.AdminProtected),
			AdminEmail:  record.AdminEmail,
			CreatedAt:   record.CreatedAt,
			UpdatedAt:   record.UpdatedAt,
			LastUsedAt:  record.LastUsedAt,
		})
	}

	if s.selectedProfileID == "" && len(s.profiles) > 0 {
		s.selectedProfileID = s.profiles[0].ID
	}

	return nil
}

func (s *profileStore) saveLocked() error {
	file := profileFile{
		SelectedProfileID: s.selectedProfileID,
		Profiles:          make([]profileRecord, 0, len(s.profiles)),
	}

	for _, profile := range s.profiles {
		token, protected := protectSecret(profile.Token)
		adminToken, adminProtected := protectSecret(profile.AdminToken)
		file.Profiles = append(file.Profiles, profileRecord{
			ID:             profile.ID,
			Name:           profile.Name,
			BaseURL:        profile.BaseURL,
			DeviceLabel:    profile.DeviceLabel,
			Token:          token,
			TokenProtected: protected,
			AdminToken:     adminToken,
			AdminProtected: adminProtected,
			AdminEmail:     profile.AdminEmail,
			CreatedAt:      profile.CreatedAt,
			UpdatedAt:      profile.UpdatedAt,
			LastUsedAt:     profile.LastUsedAt,
		})
	}

	content, err := json.MarshalIndent(file, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.path, content, 0o600)
}

func (s *profileStore) selectedID() string {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.selectedProfileID
}

func (s *profileStore) listPublic() []Profile {
	s.mu.Lock()
	defer s.mu.Unlock()

	profiles := make([]Profile, 0, len(s.profiles))
	for _, profile := range s.profiles {
		profiles = append(profiles, profile.public())
	}

	return profiles
}

func (s *profileStore) get(id string) (storedProfile, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, profile := range s.profiles {
		if profile.ID == id {
			return profile, true
		}
	}

	return storedProfile{}, false
}

func (s *profileStore) upsert(input ProfileInput) (storedProfile, error) {
	baseURL, err := normalizeBaseURL(input.BaseURL)
	if err != nil {
		return storedProfile{}, err
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = hostLabel(baseURL)
	}

	now := time.Now().Format(time.RFC3339)

	s.mu.Lock()
	defer s.mu.Unlock()

	for index, profile := range s.profiles {
		if profile.ID != input.ID {
			continue
		}

		if profile.BaseURL != baseURL {
			profile.Token = ""
			profile.DeviceLabel = ""
			profile.AdminToken = ""
			profile.AdminEmail = ""
		}

		profile.Name = name
		profile.BaseURL = baseURL
		profile.UpdatedAt = now
		s.profiles[index] = profile
		s.selectedProfileID = profile.ID
		return profile, s.saveLocked()
	}

	profile := storedProfile{
		ID:        newID(),
		Name:      name,
		BaseURL:   baseURL,
		CreatedAt: now,
		UpdatedAt: now,
	}

	s.profiles = append(s.profiles, profile)
	s.selectedProfileID = profile.ID

	return profile, s.saveLocked()
}

func (s *profileStore) updateToken(id string, token string, label string) (storedProfile, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return storedProfile{}, errors.New("device token is required")
	}

	now := time.Now().Format(time.RFC3339)

	s.mu.Lock()
	defer s.mu.Unlock()

	for index, profile := range s.profiles {
		if profile.ID != id {
			continue
		}

		profile.Token = token
		profile.DeviceLabel = strings.TrimSpace(label)
		profile.UpdatedAt = now
		profile.LastUsedAt = now
		s.profiles[index] = profile
		s.selectedProfileID = profile.ID
		return profile, s.saveLocked()
	}

	return storedProfile{}, errors.New("profile not found")
}

func (s *profileStore) updateAdminSession(id string, token string, user *APIUser) (storedProfile, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return storedProfile{}, errors.New("admin token is required")
	}

	adminEmail := ""
	if user != nil {
		adminEmail = strings.TrimSpace(user.Email)
	}
	now := time.Now().Format(time.RFC3339)

	s.mu.Lock()
	defer s.mu.Unlock()

	for index, profile := range s.profiles {
		if profile.ID != id {
			continue
		}

		profile.AdminToken = token
		profile.AdminEmail = adminEmail
		profile.UpdatedAt = now
		profile.LastUsedAt = now
		s.profiles[index] = profile
		s.selectedProfileID = profile.ID
		return profile, s.saveLocked()
	}

	return storedProfile{}, errors.New("profile not found")
}

func (s *profileStore) clearAdminSession(id string) (storedProfile, error) {
	now := time.Now().Format(time.RFC3339)

	s.mu.Lock()
	defer s.mu.Unlock()

	for index, profile := range s.profiles {
		if profile.ID != id {
			continue
		}

		profile.AdminToken = ""
		profile.AdminEmail = ""
		profile.UpdatedAt = now
		s.profiles[index] = profile
		s.selectedProfileID = profile.ID
		return profile, s.saveLocked()
	}

	return storedProfile{}, errors.New("profile not found")
}

func (s *profileStore) markUsed(id string) error {
	now := time.Now().Format(time.RFC3339)

	s.mu.Lock()
	defer s.mu.Unlock()

	for index, profile := range s.profiles {
		if profile.ID != id {
			continue
		}

		profile.LastUsedAt = now
		s.profiles[index] = profile
		s.selectedProfileID = id
		return s.saveLocked()
	}

	return nil
}

func (s *profileStore) selectProfile(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if id == "" {
		s.selectedProfileID = ""
		return s.saveLocked()
	}

	for _, profile := range s.profiles {
		if profile.ID == id {
			s.selectedProfileID = id
			return s.saveLocked()
		}
	}

	return errors.New("profile not found")
}

func (s *profileStore) delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	next := s.profiles[:0]
	found := false
	for _, profile := range s.profiles {
		if profile.ID == id {
			found = true
			continue
		}
		next = append(next, profile)
	}

	if !found {
		return errors.New("profile not found")
	}

	s.profiles = next
	if s.selectedProfileID == id {
		s.selectedProfileID = ""
		if len(s.profiles) > 0 {
			s.selectedProfileID = s.profiles[0].ID
		}
	}

	return s.saveLocked()
}

func (p storedProfile) public() Profile {
	return Profile{
		ID:                p.ID,
		Name:              p.Name,
		BaseURL:           p.BaseURL,
		DeviceLabel:       p.DeviceLabel,
		HasToken:          p.Token != "",
		TokenPreview:      tokenPreview(p.Token),
		HasAdminSession:   p.AdminToken != "",
		AdminEmail:        p.AdminEmail,
		AdminTokenPreview: tokenPreview(p.AdminToken),
		CreatedAt:         p.CreatedAt,
		UpdatedAt:         p.UpdatedAt,
		LastUsedAt:        p.LastUsedAt,
	}
}

func newID() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return time.Now().Format("20060102150405.000000000")
	}

	return hex.EncodeToString(bytes[:])
}

func tokenPreview(token string) string {
	if token == "" {
		return ""
	}

	if len(token) <= 14 {
		return "***"
	}

	return token[:8] + "..." + token[len(token)-6:]
}
