package main

type InitialState struct {
	Profiles          []Profile `json:"profiles"`
	SelectedProfileID string    `json:"selectedProfileId"`
	StoragePath       string    `json:"storagePath"`
}

type Profile struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	BaseURL           string `json:"baseUrl"`
	DeviceLabel       string `json:"deviceLabel"`
	DeviceID          string `json:"deviceId"`
	HasToken          bool   `json:"hasToken"`
	TokenPreview      string `json:"tokenPreview"`
	HasAdminSession   bool   `json:"hasAdminSession"`
	AdminEmail        string `json:"adminEmail"`
	AdminTokenPreview string `json:"adminTokenPreview"`
	CreatedAt         string `json:"createdAt"`
	UpdatedAt         string `json:"updatedAt"`
	LastUsedAt        string `json:"lastUsedAt"`
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

type DomainInput struct {
	ProfileID string `json:"profileId"`
	Domain    string `json:"domain"`
}

type DomainRecord struct {
	Domain  string `json:"domain"`
	Kind    string `json:"kind"`
	Enabled bool   `json:"enabled"`
}

type AccountUpdateInput struct {
	ProfileID string `json:"profileId"`
	AccountID string `json:"accountId"`
	Name      string `json:"name"`
	Enabled   *bool  `json:"enabled,omitempty"`
}

type AccountDeleteInput struct {
	ProfileID string `json:"profileId"`
	AccountID string `json:"accountId"`
}

type AccountSettingsRequest struct {
	ProfileID string `json:"profileId"`
	AccountID string `json:"accountId"`
}

type AccountSettingsInput struct {
	ProfileID string          `json:"profileId"`
	AccountID string          `json:"accountId"`
	Settings  AccountSettings `json:"settings"`
}

type AccountSettings struct {
	Enabled           bool              `json:"enabled"`
	CreatedAt         string            `json:"createdAt"`
	LastActivity      string            `json:"lastActivity"`
	ForwardingEnabled bool              `json:"forwardingEnabled"`
	ForwardTo         string            `json:"forwardTo"`
	KeepLocalCopy     bool              `json:"keepLocalCopy"`
	Retention         string            `json:"retention"`
	SaveAttachments   bool              `json:"saveAttachments"`
	DefaultView       string            `json:"defaultView"`
	ShowPreview       bool              `json:"showPreview"`
	Signature         string            `json:"signature"`
	Rules             []AccountRule     `json:"rules"`
	APITokens         []AccountAPIToken `json:"apiTokens"`
}

type AccountRule struct {
	ID       string `json:"id"`
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    string `json:"value"`
	Action   string `json:"action"`
	Enabled  bool   `json:"enabled"`
}

type AccountAPIToken struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Scope     string `json:"scope"`
	CreatedAt string `json:"createdAt"`
	LastUsed  string `json:"lastUsed"`
	Enabled   bool   `json:"enabled"`
}

type DNSHealthRequest struct {
	ProfileID string `json:"profileId"`
	Domain    string `json:"domain"`
}

type DNSHealth struct {
	Domain      string     `json:"domain"`
	GeneratedAt string     `json:"generatedAt"`
	Ready       bool       `json:"ready"`
	Checks      []DNSCheck `json:"checks"`
}

type DNSCheck struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	OK       bool     `json:"ok"`
	Required bool     `json:"required"`
	Records  []string `json:"records"`
	Hint     string   `json:"hint"`
	Status   string   `json:"status"`
}

type CleanupInput struct {
	ProfileID     string `json:"profileId"`
	RetentionDays int    `json:"retentionDays"`
	DryRun        bool   `json:"dryRun"`
}

type CleanupResult struct {
	DryRun        bool   `json:"dryRun"`
	RetentionDays int    `json:"retentionDays"`
	Cutoff        string `json:"cutoff"`
	Messages      int    `json:"messages"`
	Attachments   int    `json:"attachments"`
	Accounts      int    `json:"accounts"`
}

type DeviceUpdateInput struct {
	ProfileID  string `json:"profileId"`
	DeviceID   string `json:"deviceId"`
	ClientType string `json:"clientType"`
	Label      string `json:"label"`
	Scope      string `json:"scope"`
	Enabled    *bool  `json:"enabled,omitempty"`
}

type DeviceDeleteInput struct {
	ProfileID string `json:"profileId"`
	DeviceID  string `json:"deviceId"`
}

type UserInput struct {
	ProfileID   string `json:"profileId"`
	UserID      string `json:"userId"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
	AvatarColor string `json:"avatarColor"`
	Enabled     *bool  `json:"enabled,omitempty"`
}

type ChangePasswordInput struct {
	ProfileID       string `json:"profileId"`
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type ProfileActionInput struct {
	ProfileID string `json:"profileId"`
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

type EndpointHealth struct {
	ProfileID   string               `json:"profileId"`
	CheckedAt   string               `json:"checkedAt"`
	Connection  *ConnectionStatus    `json:"connection"`
	Diagnostics *EndpointDiagnostics `json:"diagnostics"`
	Error       string               `json:"error"`
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
	ID             string `json:"id"`
	Email          string `json:"email"`
	Role           string `json:"role"`
	AuthType       string `json:"authType"`
	ClientType     string `json:"clientType"`
	Label          string `json:"label"`
	Scope          string `json:"scope"`
	DisplayName    string `json:"displayName"`
	AvatarColor    string `json:"avatarColor"`
	Enabled        bool   `json:"enabled"`
	SessionVersion int    `json:"sessionVersion"`
	LastLoginAt    string `json:"lastLoginAt"`
	LastLoginIP    string `json:"lastLoginIp"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
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
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
	LastSeenAt   string `json:"lastSeenAt"`
	RevokedAt    string `json:"revokedAt"`
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
	Enabled       bool   `json:"enabled"`
	DeletedAt     string `json:"deletedAt"`
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
