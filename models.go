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

type AccountInput struct {
	ProfileID string `json:"profileId"`
	Domain    string `json:"domain"`
	LocalPart string `json:"localPart"`
	Address   string `json:"address"`
	Name      string `json:"name"`
}

type AuditLogRequest struct {
	ProfileID string `json:"profileId"`
	Limit     int    `json:"limit"`
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

type AttachmentPreview struct {
	Filename    string `json:"filename"`
	MimeType    string `json:"mimeType"`
	Size        int64  `json:"size"`
	PreviewType string `json:"previewType"`
	DataURL     string `json:"dataUrl"`
	Text        string `json:"text"`
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

type EndpointDiagnostics struct {
	Service           string              `json:"service"`
	Runtime           string              `json:"runtime"`
	Storage           string              `json:"storage"`
	GeneratedAt       string              `json:"generatedAt"`
	Bindings          DiagnosticBindings  `json:"bindings"`
	ConfiguredDomains []string            `json:"configuredDomains"`
	Counts            DiagnosticCounts    `json:"counts"`
	Latest            DiagnosticLatest    `json:"latest"`
	Setup             *DiagnosticProgress `json:"setup"`
}

type DiagnosticBindings struct {
	D1        bool `json:"d1"`
	R2        bool `json:"r2"`
	Assets    bool `json:"assets"`
	JWTSecret bool `json:"jwtSecret"`
}

type DiagnosticCounts struct {
	Domains          int `json:"domains"`
	Accounts         int `json:"accounts"`
	EnabledAccounts  int `json:"enabledAccounts"`
	Messages         int `json:"messages"`
	UnreadMessages   int `json:"unreadMessages"`
	StarredMessages  int `json:"starredMessages"`
	ArchivedMessages int `json:"archivedMessages"`
	Attachments      int `json:"attachments"`
	Devices          int `json:"devices"`
	AuditLogs        int `json:"auditLogs"`
	Users            int `json:"users"`
}

type DiagnosticLatest struct {
	Inbound *LatestInboundMessage `json:"inbound"`
	Audit   *AuditLog             `json:"audit"`
}

type LatestInboundMessage struct {
	ID             string `json:"id"`
	AccountID      string `json:"accountId"`
	AccountAddress string `json:"accountAddress"`
	FromEmail      string `json:"fromEmail"`
	Subject        string `json:"subject"`
	ReceivedAt     string `json:"receivedAt"`
}

type DiagnosticProgress struct {
	Ready             bool             `json:"ready"`
	Completed         int              `json:"completed"`
	Total             int              `json:"total"`
	CompletedRequired int              `json:"completedRequired"`
	TotalRequired     int              `json:"totalRequired"`
	NextStep          *DiagnosticStep  `json:"nextStep"`
	Steps             []DiagnosticStep `json:"steps"`
}

type DiagnosticStep struct {
	ID       string `json:"id"`
	Label    string `json:"label"`
	Required bool   `json:"required"`
	Complete bool   `json:"complete"`
	Hint     string `json:"hint"`
}

type AuditLog struct {
	ID           string         `json:"id"`
	ActorID      string         `json:"actorId"`
	ActorEmail   string         `json:"actorEmail"`
	Action       string         `json:"action"`
	ResourceType string         `json:"resourceType"`
	ResourceID   string         `json:"resourceId"`
	Summary      string         `json:"summary"`
	Metadata     map[string]any `json:"metadata"`
	IP           string         `json:"ip"`
	CreatedAt    string         `json:"createdAt"`
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
