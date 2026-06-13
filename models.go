package main

type InitialState struct {
	Profiles          []Profile `json:"profiles"`
	SelectedProfileID string    `json:"selectedProfileId"`
	StoragePath       string    `json:"storagePath"`
}

type Profile struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	BaseURL      string `json:"baseUrl"`
	DeviceLabel  string `json:"deviceLabel"`
	HasToken     bool   `json:"hasToken"`
	TokenPreview string `json:"tokenPreview"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
	LastUsedAt   string `json:"lastUsedAt"`
}

type ProfileInput struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	BaseURL string `json:"baseUrl"`
}

type TokenInput struct {
	ProfileID   string `json:"profileId"`
	DeviceToken string `json:"deviceToken"`
	DeviceLabel string `json:"deviceLabel"`
}

type DeviceAuthInput struct {
	ProfileID   string `json:"profileId"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	DeviceLabel string `json:"deviceLabel"`
	Setup       bool   `json:"setup"`
}

type MailboxRequest struct {
	ProfileID string `json:"profileId"`
	Domain    string `json:"domain"`
	AccountID string `json:"accountId"`
}

type SendMessageInput struct {
	ProfileID string `json:"profileId"`
	AccountID string `json:"accountId"`
	To        string `json:"to"`
	Cc        string `json:"cc"`
	Bcc       string `json:"bcc"`
	Subject   string `json:"subject"`
	Text      string `json:"text"`
}

type SendResult struct {
	Queued    bool   `json:"queued"`
	Provider  string `json:"provider"`
	MessageID string `json:"messageId"`
}

type MessageActionInput struct {
	ProfileID string `json:"profileId"`
	MessageID string `json:"messageId"`
}

type MessageStatusInput struct {
	ProfileID string `json:"profileId"`
	MessageID string `json:"messageId"`
	Read      *bool  `json:"read,omitempty"`
	Starred   *bool  `json:"starred,omitempty"`
}

type DownloadAttachmentInput struct {
	ProfileID    string `json:"profileId"`
	AttachmentID string `json:"attachmentId"`
	Filename     string `json:"filename"`
}

type DownloadResult struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
}

type MailboxPayload struct {
	Profile           Profile   `json:"profile"`
	Domains           []string  `json:"domains"`
	Accounts          []Account `json:"accounts"`
	Messages          []Message `json:"messages"`
	SelectedDomain    string    `json:"selectedDomain"`
	SelectedAccountID string    `json:"selectedAccountId"`
}

type ConnectionStatus struct {
	BaseURL    string      `json:"baseUrl"`
	OK         bool        `json:"ok"`
	Message    string      `json:"message"`
	AuthError  string      `json:"authError"`
	Health     *HealthData `json:"health"`
	AuthStatus *AuthStatus `json:"authStatus"`
}

type HealthData struct {
	Service string `json:"service"`
	Runtime string `json:"runtime"`
	Storage string `json:"storage"`
}

type AuthStatus struct {
	Storage       string   `json:"storage"`
	RequiresSetup bool     `json:"requiresSetup"`
	Authenticated bool     `json:"authenticated"`
	User          *APIUser `json:"user"`
}

type APIUser struct {
	ID         string `json:"id"`
	Email      string `json:"email"`
	Role       string `json:"role"`
	AuthType   string `json:"authType"`
	ClientType string `json:"clientType"`
	Label      string `json:"label"`
	Scope      string `json:"scope"`
}

type AuthResult struct {
	Token string   `json:"token"`
	User  *APIUser `json:"user"`
}

type DeviceResult struct {
	ID           string `json:"id"`
	ClientType   string `json:"clientType"`
	Label        string `json:"label"`
	Scope        string `json:"scope"`
	DeviceToken  string `json:"deviceToken"`
	TokenPreview string `json:"tokenPreview"`
	Enabled      bool   `json:"enabled"`
}

type Account struct {
	ID            string `json:"id"`
	Domain        string `json:"domain"`
	Address       string `json:"address"`
	Name          string `json:"name"`
	Label         string `json:"label"`
	Subject       string `json:"subject"`
	Preview       string `json:"preview"`
	LatestSubject string `json:"latestSubject"`
	LatestPreview string `json:"latestPreview"`
	Time          string `json:"time"`
	LatestAt      string `json:"latestAt"`
	Unread        int    `json:"unread"`
}

type Message struct {
	ID          string       `json:"id"`
	AccountID   string       `json:"accountId"`
	Direction   string       `json:"direction"`
	Author      string       `json:"author"`
	Email       string       `json:"email"`
	Subject     string       `json:"subject"`
	Body        string       `json:"body"`
	Preview     string       `json:"preview"`
	Time        string       `json:"time"`
	ReadAt      string       `json:"readAt"`
	StarredAt   string       `json:"starredAt"`
	ArchivedAt  string       `json:"archivedAt"`
	DeletedAt   string       `json:"deletedAt"`
	Attachments []Attachment `json:"attachments"`
}

type Attachment struct {
	ID           string `json:"id"`
	Filename     string `json:"filename"`
	MimeType     string `json:"mimeType"`
	Size         int64  `json:"size"`
	Downloadable bool   `json:"downloadable"`
}
