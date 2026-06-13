import {useEffect, useMemo, useRef, useState} from 'react';
import {
    Activity,
    Archive,
    ArchiveRestore,
    ArrowLeft,
    CircleAlert,
    CircleCheck,
    ClipboardList,
    Copy,
    Database,
    Download,
    Eye,
    FileText,
    Globe2,
    Inbox,
    KeyRound,
    ListChecks,
    Mail,
    MailOpen,
    MailPlus,
    Maximize2,
    Minus,
    Moon,
    MoreHorizontal,
    PanelLeftClose,
    PanelLeftOpen,
    Pencil,
    Plus,
    Power,
    RefreshCw,
    Search,
    Send,
    Settings,
    ShieldCheck,
    Star,
    Sun,
    Trash2,
    X
} from 'lucide-react';
import './App.css';
import {
    Quit,
    WindowMinimise,
    WindowSetDarkTheme,
    WindowSetLightTheme,
    WindowToggleMaximise
} from '../wailsjs/runtime/runtime';
import {
    ArchiveMessage,
    AuthorizeAdminSession,
    AuthorizeProfile,
    ChangePassword,
    ClearAdminSession,
    CreateAccount,
    CreateDomain,
    CreateUser,
    DeleteAccount,
    DeleteMessage,
    DeleteProfile,
    DownloadAttachment,
    GetAccountSettings,
    GetDomainDNSHealth,
    GetEndpointDiagnostics,
    GetInitialState,
    ListAuditLogs,
    ListDevices,
    ListUsers,
    LoadMailbox,
    PreviewAttachment,
    RevokeDevice,
    RevokeSessions,
    RunSystemCleanup,
    SaveAccountSettings,
    SaveProfile,
    SaveProfileToken,
    SelectProfile,
    SendMessage,
    SetMessageStatus,
    TestBaseURL,
    UnarchiveMessage,
    UpdateAccount,
    UpdateDevice,
    UpdateUser
} from '../wailsjs/go/main/App';

const emptyProfileForm = {id: '', name: '', baseUrl: ''};
const emptyAccountForm = {localPart: '', name: ''};
const emptyDomainForm = {domain: ''};
const emptyAuthForm = {email: '', password: '', deviceLabel: 'Windows 桌面端', setup: false};
const emptyComposeForm = {to: '', cc: '', bcc: '', subject: '', text: ''};
const emptyAdminSessionForm = {email: '', password: '', setup: false};
const emptyUserForm = {email: '', password: '', displayName: '', avatarColor: '#dbe7ff'};
const emptyPasswordForm = {currentPassword: '', newPassword: ''};
const defaultMailboxSettings = {
    enabled: true,
    createdAt: '',
    lastActivity: '',
    forwardingEnabled: false,
    forwardTo: '',
    keepLocalCopy: true,
    retention: 'forever',
    saveAttachments: true,
    defaultView: 'inbox',
    showPreview: true,
    signature: '',
    rules: [],
    apiTokens: []
};
const layoutDefaults = {
    sidebar: 292,
    list: 388
};
const layoutLimits = {
    sidebar: {min: 240, max: 420},
    list: {min: 300, max: 560}
};

const folders = [
    {id: 'inbox', label: '收件箱', icon: Inbox},
    {id: 'sent', label: '已发送', icon: Send},
    {id: 'archive', label: '归档', icon: Archive},
    {id: 'all', label: '全部邮件', icon: Mail}
];

const settingsTabs = [
    {id: 'general', label: '常规', icon: Settings},
    {id: 'mailbox', label: '邮箱设置', icon: Mail},
    {id: 'dns', label: 'DNS', icon: Globe2},
    {id: 'devices', label: '设备 Token', icon: ShieldCheck},
    {id: 'maintenance', label: '维护', icon: Database},
    {id: 'security', label: '安全', icon: KeyRound}
];

function upsertProfile(profiles, profile) {
    const exists = profiles.some((item) => item.id === profile.id);
    return exists
        ? profiles.map((item) => item.id === profile.id ? profile : item)
        : [profile, ...profiles];
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function readStoredWidth(key, fallback, limits) {
    const raw = localStorage.getItem(key);
    if (raw === null) {
        return fallback;
    }

    const stored = Number(raw);
    if (!Number.isFinite(stored)) {
        return fallback;
    }

    return clamp(stored, limits.min, limits.max);
}

function recipientAddress(value) {
    const match = String(value || '').match(/<([^<>]+)>/);
    return (match?.[1] || value || '').trim();
}

function splitRecipients(value) {
    return String(value || '')
        .split(/[,\n;，；]+/)
        .map(recipientAddress)
        .filter(Boolean);
}

function invalidRecipients(value) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return splitRecipients(value).filter((recipient) => !emailPattern.test(recipient));
}

function normalizeDomainInput(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');
}

function composeHasContent(form) {
    return Object.values(form || {}).some((value) => String(value || '').trim());
}

function isUnreadMessage(message) {
    return Boolean(
        message
        && message.direction !== 'outbound'
        && !message.readAt
        && !message.archivedAt
        && !message.deletedAt
    );
}

function isAccountEnabled(account) {
    return Boolean(account && account.enabled !== false && !account.deletedAt);
}

function isStarredMessage(message) {
    return Boolean(message?.starredAt);
}

function isTypingTarget(event) {
    const tagName = event.target?.tagName?.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || event.target?.isContentEditable;
}

function formatMessageTime(value) {
    return value || '刚刚';
}

function formatProfileDate(value) {
    if (!value) {
        return '从未';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDateTime(value) {
    if (!value) {
        return '暂无';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

const auditActionLabels = {
    'account.delete': '删除邮箱账号',
    'account.settings_update': '更新邮箱设置',
    'account.update': '更新邮箱账号',
    'auth.change_password': '修改密码',
    'auth.login': '管理员登录',
    'auth.logout': '退出登录',
    'auth.revoke_sessions': '撤销会话',
    'auth.setup': '初始化管理员',
    'auth.update_profile': '更新资料',
    'device.create': '创建设备 Token',
    'device.revoke': '撤销设备 Token',
    'device.update': '更新设备 Token',
    'domain.create': '添加域名',
    'mail.received': '收到邮件',
    'mail.rules_applied': '应用收信规则',
    'message.delete': '删除邮件',
    'message.send': '发送邮件',
    'message.status_update': '更新邮件状态',
    'user.create': '创建用户',
    'user.update': '更新用户'
};

function formatAuditAction(action) {
    return auditActionLabels[action] || action || '未知操作';
}

function formatCount(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '0';
}

function metadataSummary(metadata) {
    const entries = Object.entries(metadata || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');
    if (!entries.length) {
        return '';
    }

    return entries.slice(0, 3).map(([key, value]) => {
        const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `${key}: ${text}`;
    }).join(' · ');
}

function formatFileSize(value) {
    if (!value || value <= 0) {
        return '未知大小';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
}

function normalizeMailboxSettings(settings = {}) {
    return {
        ...defaultMailboxSettings,
        ...settings,
        enabled: settings.enabled !== false,
        forwardingEnabled: Boolean(settings.forwardingEnabled),
        forwardTo: settings.forwardTo || '',
        keepLocalCopy: settings.keepLocalCopy !== false,
        retention: settings.retention || defaultMailboxSettings.retention,
        saveAttachments: settings.saveAttachments !== false,
        defaultView: settings.defaultView || defaultMailboxSettings.defaultView,
        showPreview: settings.showPreview !== false,
        signature: settings.signature || '',
        rules: Array.isArray(settings.rules) ? settings.rules : [],
        apiTokens: Array.isArray(settings.apiTokens) ? settings.apiTokens : []
    };
}

function attachmentKind(attachment) {
    const mimeType = attachment.mimeType || '';
    const filename = attachment.filename || '';
    const extension = filename.includes('.') ? filename.split('.').pop().toUpperCase() : '文件';

    if (mimeType.startsWith('image/')) {
        return {label: '图片', short: 'IMG'};
    }

    if (mimeType === 'application/pdf') {
        return {label: 'PDF', short: 'PDF'};
    }

    if (mimeType.includes('zip') || mimeType.includes('archive') || ['ZIP', 'RAR', '7Z'].includes(extension)) {
        return {label: '压缩包', short: 'ZIP'};
    }

    if (mimeType.includes('spreadsheet') || ['XLS', 'XLSX', 'CSV'].includes(extension)) {
        return {label: '表格', short: 'XLS'};
    }

    if (mimeType.includes('word') || ['DOC', 'DOCX'].includes(extension)) {
        return {label: '文档', short: 'DOC'};
    }

    if (mimeType.startsWith('text/') || ['TXT', 'MD', 'LOG'].includes(extension)) {
        return {label: '文本', short: 'TXT'};
    }

    return {label: extension, short: extension.slice(0, 3)};
}

function attachmentMime(attachment = {}) {
    return String(attachment.mimeType || '').toLowerCase();
}

function isTextPreviewMime(mimeType = '') {
    return mimeType.startsWith('text/')
        || mimeType.includes('json')
        || mimeType.includes('xml')
        || mimeType.includes('csv');
}

function isPreviewableAttachment(attachment = {}) {
    const mimeType = attachmentMime(attachment);
    const filename = String(attachment.filename || '').toLowerCase();

    return mimeType.startsWith('image/')
        || mimeType === 'application/pdf'
        || isTextPreviewMime(mimeType)
        || /\.(png|jpe?g|gif|webp|svg|pdf|txt|log|md|json|csv|xml)$/.test(filename);
}

function App() {
    const [profiles, setProfiles] = useState([]);
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [profileForm, setProfileForm] = useState(emptyProfileForm);
    const [accountForm, setAccountForm] = useState(emptyAccountForm);
    const [domainForm, setDomainForm] = useState(emptyDomainForm);
    const [authForm, setAuthForm] = useState(emptyAuthForm);
    const [composeForm, setComposeForm] = useState(emptyComposeForm);
    const [composeOptionsOpen, setComposeOptionsOpen] = useState(false);
    const [hasSavedDraft, setHasSavedDraft] = useState(false);
    const [manualToken, setManualToken] = useState('');
    const [status, setStatus] = useState(null);
    const [storagePath, setStoragePath] = useState('');
    const [workspace, setWorkspace] = useState(null);
    const [sidebarPage, setSidebarPage] = useState('profiles');
    const [contentPage, setContentPage] = useState('start');
    const [profileReturnPage, setProfileReturnPage] = useState('start');
    const [authReturnPage, setAuthReturnPage] = useState('start');
    const [endpointDiagnostics, setEndpointDiagnostics] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [insightsProfileId, setInsightsProfileId] = useState('');
    const [selectedMessageId, setSelectedMessageId] = useState('');
    const [activeFolder, setActiveFolder] = useState('inbox');
    const [searchQuery, setSearchQuery] = useState('');
    const [busy, setBusy] = useState('');
    const [toast, setToast] = useState(null);
    const [theme, setTheme] = useState(() => localStorage.getItem('omnimail_desktop_theme') || 'light');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('omnimail_sidebar_collapsed') === 'true');
    const [sidebarWidth, setSidebarWidth] = useState(() => readStoredWidth('omnimail_sidebar_width', layoutDefaults.sidebar, layoutLimits.sidebar));
    const [listWidth, setListWidth] = useState(() => readStoredWidth('omnimail_list_width', layoutDefaults.list, layoutLimits.list));
    const [resizingPanel, setResizingPanel] = useState('');
    const [composerOpen, setComposerOpen] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const searchInputRef = useRef(null);
    const manualUnreadMessageRef = useRef('');

    const selectedProfile = useMemo(
        () => profiles.find((profile) => profile.id === selectedProfileId) || null,
        [profiles, selectedProfileId]
    );

    const selectedAccount = useMemo(
        () => (workspace?.accounts || []).find((account) => account.id === workspace?.selectedAccountId) || null,
        [workspace]
    );

    const composeDraftKey = useMemo(() => (
        selectedProfile?.id && workspace?.selectedAccountId
            ? `omnimail_compose_draft:${selectedProfile.id}:${workspace.selectedAccountId}`
            : ''
    ), [selectedProfile?.id, workspace?.selectedAccountId]);

    const canClearCurrentDraft = Boolean(composeDraftKey && (hasSavedDraft || composeHasContent(composeForm)));

    const visibleMessages = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return (workspace?.messages || []).filter((message) => {
            const folderMatch = activeFolder === 'all'
                || (activeFolder === 'sent' && message.direction === 'outbound')
                || (activeFolder === 'archive' && Boolean(message.archivedAt))
                || (activeFolder === 'inbox' && message.direction !== 'outbound' && !message.archivedAt);

            if (!folderMatch) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                message.subject,
                message.author,
                message.email,
                message.preview,
                message.body
            ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
        });
    }, [activeFolder, searchQuery, workspace]);

    const selectedMessage = useMemo(() => (
        visibleMessages.find((message) => message.id === selectedMessageId)
        || visibleMessages[0]
        || null
    ), [selectedMessageId, visibleMessages]);

    const folderCounts = useMemo(() => {
        const messages = workspace?.messages || [];
        return {
            inbox: messages.filter((message) => message.direction !== 'outbound' && !message.archivedAt).length,
            sent: messages.filter((message) => message.direction === 'outbound').length,
            archive: messages.filter((message) => message.archivedAt).length,
            all: messages.length
        };
    }, [workspace]);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('omnimail_desktop_theme', theme);
        if (theme === 'dark') {
            WindowSetDarkTheme();
        } else {
            WindowSetLightTheme();
        }
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('omnimail_sidebar_collapsed', String(sidebarCollapsed));
    }, [sidebarCollapsed]);

    useEffect(() => {
        localStorage.setItem('omnimail_sidebar_width', String(sidebarWidth));
    }, [sidebarWidth]);

    useEffect(() => {
        localStorage.setItem('omnimail_list_width', String(listWidth));
    }, [listWidth]);

    useEffect(() => {
        setEndpointDiagnostics(null);
        setAuditLogs([]);
        setInsightsProfileId('');
    }, [selectedProfileId]);

    useEffect(() => {
        if (!composerOpen) {
            return;
        }

        if (!composeDraftKey) {
            setComposeForm(emptyComposeForm);
            setComposeOptionsOpen(false);
            setHasSavedDraft(false);
            return;
        }

        const rawDraft = localStorage.getItem(composeDraftKey);
        if (!rawDraft) {
            setComposeForm(emptyComposeForm);
            setComposeOptionsOpen(false);
            setHasSavedDraft(false);
            return;
        }

        try {
            const draft = {...emptyComposeForm, ...JSON.parse(rawDraft)};
            setComposeForm(draft);
            setComposeOptionsOpen(Boolean(draft.cc || draft.bcc));
            setHasSavedDraft(true);
        } catch {
            localStorage.removeItem(composeDraftKey);
            setComposeForm(emptyComposeForm);
            setComposeOptionsOpen(false);
            setHasSavedDraft(false);
        }
    }, [composerOpen, composeDraftKey]);

    useEffect(() => {
        if (!composerOpen || !composeDraftKey || !composeHasContent(composeForm)) {
            return undefined;
        }

        const timer = window.setTimeout(() => {
            localStorage.setItem(composeDraftKey, JSON.stringify(composeForm));
            setHasSavedDraft(true);
        }, 250);

        return () => window.clearTimeout(timer);
    }, [composerOpen, composeDraftKey, composeForm]);

    useEffect(() => () => {
        document.body.classList.remove('is-resizing-panels');
    }, []);

    useEffect(() => {
        loadInitialState();
    }, []);

    useEffect(() => {
        setSelectedMessageId(visibleMessages[0]?.id || '');
    }, [activeFolder, searchQuery, workspace?.selectedAccountId]);

    useEffect(() => {
        if (manualUnreadMessageRef.current && manualUnreadMessageRef.current !== selectedMessage?.id) {
            manualUnreadMessageRef.current = '';
        }
    }, [selectedMessage?.id]);

    useEffect(() => {
        if (
            !selectedProfile
            || !workspace?.selectedAccountId
            || !isUnreadMessage(selectedMessage)
            || manualUnreadMessageRef.current === selectedMessage?.id
        ) {
            return undefined;
        }

        const timer = window.setTimeout(() => {
            handleSetMessageStatus(selectedMessage, {read: true}, {silent: true});
        }, 500);

        return () => window.clearTimeout(timer);
    }, [
        selectedMessage?.id,
        selectedMessage?.readAt,
        selectedMessage?.archivedAt,
        selectedMessage?.deletedAt,
        selectedProfile?.id,
        workspace?.selectedAccountId
    ]);

    useEffect(() => {
        if (!toast) {
            return undefined;
        }

        const timer = window.setTimeout(() => setToast(null), 3200);
        return () => window.clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
        function handleKeyDown(event) {
            if (isTypingTarget(event)) {
                return;
            }

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                searchInputRef.current?.focus();
                return;
            }

            if (event.key === '/') {
                event.preventDefault();
                searchInputRef.current?.focus();
                return;
            }

            if (event.key.toLowerCase() === 'j') {
                event.preventDefault();
                selectRelativeMessage(1);
                return;
            }

            if (event.key.toLowerCase() === 'k') {
                event.preventDefault();
                selectRelativeMessage(-1);
                return;
            }

            if (event.key.toLowerCase() === 'r') {
                event.preventDefault();
                reloadCurrentMailbox();
                return;
            }

            if (event.key.toLowerCase() === 'n') {
                event.preventDefault();
                setComposerOpen(true);
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedMessageId, visibleMessages, selectedProfile, workspace]);

    function showToast(type, title, message = '') {
        setToast({type, title, message});
    }

    function selectRelativeMessage(delta) {
        if (visibleMessages.length === 0) {
            return;
        }

        const currentIndex = Math.max(0, visibleMessages.findIndex((message) => message.id === selectedMessageId));
        const nextIndex = Math.min(Math.max(currentIndex + delta, 0), visibleMessages.length - 1);
        setSelectedMessageId(visibleMessages[nextIndex].id);
    }

    function setLayoutWidth(panel, value) {
        if (panel === 'sidebar') {
            setSidebarWidth(clamp(value, layoutLimits.sidebar.min, layoutLimits.sidebar.max));
            return;
        }

        setListWidth(clamp(value, layoutLimits.list.min, layoutLimits.list.max));
    }

    function adjustLayoutWidth(panel, delta) {
        if (panel === 'sidebar') {
            setSidebarWidth((value) => clamp(value + delta, layoutLimits.sidebar.min, layoutLimits.sidebar.max));
            return;
        }

        setListWidth((value) => clamp(value + delta, layoutLimits.list.min, layoutLimits.list.max));
    }

    function resetLayoutWidth(panel) {
        setLayoutWidth(panel, layoutDefaults[panel]);
    }

    function resetLayoutPreferences() {
        localStorage.removeItem('omnimail_sidebar_width');
        localStorage.removeItem('omnimail_list_width');
        localStorage.removeItem('omnimail_sidebar_collapsed');
        setSidebarCollapsed(false);
        setSidebarWidth(layoutDefaults.sidebar);
        setListWidth(layoutDefaults.list);
        showToast('success', '布局已恢复默认');
    }

    function clearCurrentDraft() {
        if (composeDraftKey) {
            localStorage.removeItem(composeDraftKey);
        }
        setComposeForm(emptyComposeForm);
        setComposeOptionsOpen(false);
        setHasSavedDraft(false);
        showToast('success', '当前草稿已清空');
    }

    function startPanelResize(panel, event) {
        if (panel === 'sidebar' && sidebarCollapsed) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = panel === 'sidebar' ? sidebarWidth : listWidth;
        setResizingPanel(panel);
        document.body.classList.add('is-resizing-panels');

        function handlePointerMove(moveEvent) {
            setLayoutWidth(panel, startWidth + moveEvent.clientX - startX);
        }

        function handlePointerUp() {
            setResizingPanel('');
            document.body.classList.remove('is-resizing-panels');
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        }

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
    }

    function handleResizeKey(panel, event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home') {
            return;
        }

        event.preventDefault();

        if (event.key === 'Home') {
            resetLayoutWidth(panel);
            return;
        }

        const direction = event.key === 'ArrowRight' ? 1 : -1;
        adjustLayoutWidth(panel, direction * (event.shiftKey ? 32 : 12));
    }

    async function loadInitialState() {
        setBusy('initial');

        try {
            const state = await GetInitialState();
            const nextProfiles = state.profiles || [];
            setProfiles(nextProfiles);
            setStoragePath(state.storagePath || '');
            setSelectedProfileId('');
            setSidebarPage('profiles');
            setContentPage('start');
            setWorkspace(null);
        } catch (loadError) {
            showToast('error', '加载本地配置失败', loadError.message || '请检查本地配置文件权限。');
        } finally {
            setBusy('');
        }
    }

    async function handleProfileSubmit(event) {
        event.preventDefault();
        setBusy('profile');

        try {
            const profile = await SaveProfile(profileForm);
            setProfiles((current) => upsertProfile(current, profile));
            setSelectedProfileId(profile.id);
            setSidebarPage('mailbox');
            setContentPage('mail');
            setProfileForm(emptyProfileForm);
            setWorkspace(null);
            await testConnection(profile.baseUrl, '');
            showToast('success', '接入点已保存', profile.baseUrl);
        } catch (saveError) {
            showToast('error', '保存接入点失败', saveError.message || 'Base URL 无效。');
        } finally {
            setBusy('');
        }
    }

    async function handleSelectProfile(profile) {
        setSelectedProfileId(profile.id);
        setSidebarPage('mailbox');
        setStatus(null);
        setWorkspace(null);
        setContextMenu(null);
        await SelectProfile(profile.id).catch(() => null);

        if (profile.hasToken) {
            setContentPage('mail');
            await loadMailbox({profileId: profile.id});
        } else {
            await testConnection(profile.baseUrl, '');
            setAuthReturnPage('start');
            setContentPage('auth');
        }
    }

    function handleAddProfile() {
        setProfileForm(emptyProfileForm);
        setProfileReturnPage(contentPage === 'profile' ? 'start' : contentPage);
        setProfileMenuOpen(false);
        setContentPage('profile');
    }

    function handleCloseProfileEditor() {
        setProfileForm(emptyProfileForm);
        setContentPage(profileReturnPage || (selectedProfile ? 'mail' : 'start'));
    }

    function handleBackToProfiles() {
        setSidebarPage('profiles');
        setContentPage('start');
        setProfileMenuOpen(false);
        setContextMenu(null);
    }

    function handleAddAccount() {
        if (!selectedProfile?.hasToken) {
            showToast('error', '接入点尚未授权', '请先保存当前接入点的 Device Token。');
            return;
        }

        if (!workspace?.selectedDomain) {
            showToast('error', '缺少域名', '请先选择或加载一个域名。');
            return;
        }

        setAccountForm(emptyAccountForm);
        setProfileMenuOpen(false);
        setContextMenu(null);
        setContentPage('account');
    }

    function handleCloseAccountEditor() {
        setAccountForm(emptyAccountForm);
        setContentPage('mail');
    }

    async function handleOpenAccountManager() {
        if (!selectedProfile?.hasToken) {
            showToast('error', '接入点尚未授权', '授权后才能管理邮箱账号。');
            return;
        }

        setProfileMenuOpen(false);
        setContextMenu(null);
        setContentPage('accounts');
        if (!workspace) {
            await loadMailbox({profileId: selectedProfile.id});
        }
    }

    async function handleOpenDomainManager() {
        if (!selectedProfile?.hasToken) {
            showToast('error', '接入点尚未授权', '授权后才能管理域名。');
            return;
        }

        setProfileMenuOpen(false);
        setContextMenu(null);
        setContentPage('domains');
        if (!workspace) {
            await loadMailbox({profileId: selectedProfile.id});
        }
    }

    function handleOpenProfileManager() {
        setProfileMenuOpen(false);
        setContentPage('endpoints');
    }

    async function handleOpenAuth(profile = selectedProfile) {
        if (!profile) {
            return;
        }

        if (selectedProfileId !== profile.id) {
            setWorkspace(null);
        }
        setSelectedProfileId(profile.id);
        setStatus(null);
        setContextMenu(null);
        setProfileMenuOpen(false);
        setAuthReturnPage(contentPage === 'auth' ? 'start' : contentPage);
        setContentPage('auth');
        await SelectProfile(profile.id).catch(() => null);
        await testConnection(profile.baseUrl, '').catch(() => null);
    }

    function handleCloseAuthPage() {
        setAuthForm(emptyAuthForm);
        setManualToken('');
        setContentPage(authReturnPage || (selectedProfile?.hasToken ? 'mail' : 'start'));
    }

    async function handleTestProfile(profile) {
        if (!profile) {
            return;
        }

        await testConnection(profile.baseUrl, '');
    }

    function handleEditProfile(profile) {
        setProfileForm({id: profile.id, name: profile.name, baseUrl: profile.baseUrl});
        setProfileReturnPage(contentPage === 'profile' ? 'endpoints' : contentPage);
        setProfileMenuOpen(false);
        setContentPage('profile');
    }

    async function handleDeleteProfile(profile) {
        if (!window.confirm(`删除接入点「${profile.name}」？`)) {
            return;
        }

        setBusy('delete');

        try {
            await DeleteProfile(profile.id);
            setProfiles((current) => current.filter((item) => item.id !== profile.id));
            if (selectedProfileId === profile.id) {
                setSelectedProfileId('');
                setWorkspace(null);
                setStatus(null);
                setSidebarPage('profiles');
                setContentPage('start');
            }
            showToast('success', '接入点已删除');
        } catch (deleteError) {
            showToast('error', '删除失败', deleteError.message || '请稍后重试。');
        } finally {
            setBusy('');
        }
    }

    async function testConnection(baseUrl = selectedProfile?.baseUrl, token = '') {
        if (!baseUrl) {
            return;
        }

        setBusy('test');

        try {
            const result = await TestBaseURL(baseUrl, token);
            setStatus(result);
            if (result?.authStatus?.requiresSetup) {
                setAuthForm((current) => ({...current, setup: true}));
            }
            showToast(result.ok ? 'success' : 'error', result.ok ? '连接成功' : '连接失败', result.message);
        } catch (testError) {
            showToast('error', '连接测试失败', testError.message || '无法访问该接入点。');
        } finally {
            setBusy('');
        }
    }

    async function loadEndpointInsights(profile = selectedProfile) {
        if (!profile) {
            return;
        }

        if (!profile.hasToken) {
            showToast('error', '接入点尚未授权', '保存 Device Token 后才能读取诊断和审计日志。');
            return;
        }

        setBusy('insights');

        try {
            const [diagnostics, logs] = await Promise.all([
                GetEndpointDiagnostics(profile.id),
                ListAuditLogs({profileId: profile.id, limit: 30})
            ]);
            setEndpointDiagnostics(diagnostics || null);
            setAuditLogs(logs || []);
            setInsightsProfileId(profile.id);
            showToast('success', '接入点诊断已更新', profile.baseUrl);
        } catch (insightError) {
            showToast('error', '加载接入点诊断失败', insightError.message || '请检查当前接入点 Token 权限。');
        } finally {
            setBusy('');
        }
    }

    async function handleAuthorize(event) {
        event.preventDefault();
        if (!selectedProfile) {
            return;
        }

        setBusy('auth');

        try {
            const profile = await AuthorizeProfile({...authForm, profileId: selectedProfile.id});
            setProfiles((current) => upsertProfile(current, profile));
            setAuthForm(emptyAuthForm);
            setSidebarPage('mailbox');
            setContentPage('mail');
            await loadMailbox({profileId: profile.id});
            showToast('success', '当前接入点已授权', '设备 Token 只保存到这个接入点，不影响其他接入点。');
        } catch (authError) {
            showToast('error', '授权失败', authError.message || '请检查管理员账号密码。');
        } finally {
            setBusy('');
        }
    }

    async function handleManualToken(event) {
        event.preventDefault();
        if (!selectedProfile) {
            return;
        }

        setBusy('token');

        try {
            const profile = await SaveProfileToken({
                profileId: selectedProfile.id,
                deviceToken: manualToken,
                deviceLabel: authForm.deviceLabel || 'Windows 桌面端'
            });
            setProfiles((current) => upsertProfile(current, profile));
            setManualToken('');
            setSidebarPage('mailbox');
            setContentPage('mail');
            await loadMailbox({profileId: profile.id});
            showToast('success', 'Token 已保存', '该 Token 仅用于当前接入点。');
        } catch (tokenError) {
            showToast('error', '保存 Token 失败', tokenError.message || 'Token 不能为空。');
        } finally {
            setBusy('');
        }
    }

    async function handleAccountSubmit(event) {
        event.preventDefault();
        if (!selectedProfile || !workspace?.selectedDomain) {
            return;
        }

        const localPart = accountForm.localPart.trim();
        if (!localPart) {
            showToast('error', '缺少邮箱名称', '请输入 @ 前面的邮箱前缀。');
            return;
        }
        if (localPart.includes('@')) {
            showToast('error', '邮箱名称不需要包含域名', `这里只填写 @${workspace.selectedDomain} 前面的部分。`);
            return;
        }

        setBusy('account');

        try {
            const account = await CreateAccount({
                profileId: selectedProfile.id,
                domain: workspace.selectedDomain,
                localPart,
                name: accountForm.name.trim()
            });
            setAccountForm(emptyAccountForm);
            setContentPage('mail');
            await loadMailbox({
                profileId: selectedProfile.id,
                domain: account.domain || workspace.selectedDomain,
                accountId: account.id
            });
            showToast('success', '邮箱账号已添加', account.address || `${localPart}@${workspace.selectedDomain}`);
        } catch (accountError) {
            showToast('error', '添加邮箱账号失败', accountError.message || '请检查邮箱名称和域名。');
        } finally {
            setBusy('');
        }
    }

    async function handleDomainSubmit(event) {
        event.preventDefault();
        if (!selectedProfile) {
            return;
        }

        const domain = normalizeDomainInput(domainForm.domain);
        if (!domain || !domain.includes('.') || domain.includes('@')) {
            showToast('error', '域名格式不正确', '请输入类似 mail.example.com 的域名。');
            return;
        }

        setBusy('domain');

        try {
            const result = await CreateDomain({
                profileId: selectedProfile.id,
                domain
            });
            const nextDomain = result.domain || domain;
            setDomainForm(emptyDomainForm);
            await loadMailbox({
                profileId: selectedProfile.id,
                domain: nextDomain,
                accountId: ''
            });
            setContentPage('domains');
            showToast('success', '域名已添加', nextDomain);
        } catch (domainError) {
            showToast('error', '添加域名失败', domainError.message || '请检查 Worker 域名配置。');
        } finally {
            setBusy('');
        }
    }

    async function handleUpdateAccount(account, patch) {
        if (!selectedProfile || !account?.id) {
            return null;
        }

        const nextName = typeof patch.name === 'string' ? patch.name.trim() : account.name || account.label || account.address;
        if (!nextName && typeof patch.enabled !== 'boolean') {
            showToast('error', '没有可保存的账号变更');
            return null;
        }

        setBusy('account-update');

        try {
            const updated = await UpdateAccount({
                profileId: selectedProfile.id,
                accountId: account.id,
                name: nextName,
                enabled: typeof patch.enabled === 'boolean' ? patch.enabled : undefined
            });
            await loadMailbox({
                profileId: selectedProfile.id,
                domain: workspace?.selectedDomain || updated.domain || account.domain,
                accountId: workspace?.selectedAccountId || account.id
            });
            showToast('success', '邮箱账号已更新', updated.address || account.address);
            return updated;
        } catch (updateError) {
            showToast('error', '更新邮箱账号失败', updateError.message || '请稍后重试。');
            return null;
        } finally {
            setBusy('');
        }
    }

    async function handleDeleteAccount(account) {
        if (!selectedProfile || !account?.id) {
            return;
        }

        if (!window.confirm(`删除邮箱账号「${account.address}」？`)) {
            return;
        }

        setBusy('account-delete');

        try {
            await DeleteAccount({
                profileId: selectedProfile.id,
                accountId: account.id
            });
            await loadMailbox({
                profileId: selectedProfile.id,
                domain: workspace?.selectedDomain || account.domain,
                accountId: workspace?.selectedAccountId === account.id ? '' : workspace?.selectedAccountId || ''
            });
            showToast('success', '邮箱账号已删除', account.address);
        } catch (deleteError) {
            showToast('error', '删除邮箱账号失败', deleteError.message || '请稍后重试。');
        } finally {
            setBusy('');
        }
    }

    async function handleCopyText(value, label = '内容') {
        if (!value) {
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            showToast('success', `${label}已复制`, value);
        } catch (copyError) {
            showToast('error', '复制失败', copyError.message || '当前系统不允许访问剪贴板。');
        }
    }

    async function loadMailbox(request) {
        const profileId = request.profileId || selectedProfileId;
        if (!profileId) {
            return;
        }

        setBusy('mailbox');

        try {
            const data = await LoadMailbox({...request, profileId});
            setWorkspace(data);
            setProfiles((current) => upsertProfile(current, data.profile));
        } catch (mailError) {
            setWorkspace(null);
            showToast('error', '加载邮箱失败', mailError.message || '请检查接入点和 Token。');
        } finally {
            setBusy('');
        }
    }

    async function reloadCurrentMailbox() {
        if (!selectedProfile) {
            return;
        }

        await loadMailbox({
            profileId: selectedProfile.id,
            domain: workspace?.selectedDomain || '',
            accountId: workspace?.selectedAccountId || ''
        });
    }

    async function handleSendMessage(event) {
        event.preventDefault();
        if (!selectedProfile || !workspace?.selectedAccountId) {
            return;
        }

        const to = splitRecipients(composeForm.to);
        const cc = splitRecipients(composeForm.cc);
        const bcc = splitRecipients(composeForm.bcc);
        const invalid = [
            ...invalidRecipients(composeForm.to),
            ...invalidRecipients(composeForm.cc),
            ...invalidRecipients(composeForm.bcc)
        ];

        if (!to.length) {
            showToast('error', '缺少收件人', '请至少填写一个收件人邮箱。');
            return;
        }

        if (invalid.length) {
            showToast('error', '邮箱格式不正确', invalid.slice(0, 3).join('，'));
            return;
        }

        if (!composeForm.subject.trim()) {
            showToast('error', '缺少主题', '请填写一个清晰的邮件主题。');
            return;
        }

        setBusy('send');

        try {
            const result = await SendMessage({
                profileId: selectedProfile.id,
                accountId: workspace.selectedAccountId,
                to: to.join(', '),
                cc: cc.join(', '),
                bcc: bcc.join(', '),
                subject: composeForm.subject.trim(),
                text: composeForm.text
            });
            if (composeDraftKey) {
                localStorage.removeItem(composeDraftKey);
            }
            setComposeForm(emptyComposeForm);
            setComposeOptionsOpen(false);
            setHasSavedDraft(false);
            setComposerOpen(false);
            showToast('success', '邮件已提交', result.provider ? `处理方式：${result.provider}` : '已提交到 OmniMail。');
            await reloadCurrentMailbox();
        } catch (sendError) {
            showToast('error', '发送失败', sendError.message || '请检查收件人与主题。');
        } finally {
            setBusy('');
        }
    }

    async function handleArchiveMessage(message) {
        if (!selectedProfile || !message) {
            return;
        }

        setBusy('message-action');

        try {
            const payload = {profileId: selectedProfile.id, messageId: message.id};
            if (message.archivedAt) {
                await UnarchiveMessage(payload);
                showToast('success', '已移回收件箱');
            } else {
                await ArchiveMessage(payload);
                showToast('success', '已归档');
            }
            await reloadCurrentMailbox();
        } catch (actionError) {
            showToast('error', '更新邮件失败', actionError.message || '请稍后重试。');
        } finally {
            setBusy('');
        }
    }

    async function handleDeleteMessage(message) {
        if (!selectedProfile || !message || !window.confirm('删除这封邮件？')) {
            return;
        }

        setBusy('message-action');

        try {
            await DeleteMessage({profileId: selectedProfile.id, messageId: message.id});
            showToast('success', '邮件已删除');
            await reloadCurrentMailbox();
        } catch (deleteError) {
            showToast('error', '删除失败', deleteError.message || '请稍后重试。');
        } finally {
            setBusy('');
        }
    }

    async function handleSetMessageStatus(message, payload, options = {}) {
        if (!selectedProfile || !message) {
            return;
        }

        setBusy('message-action');

        try {
            const updated = await SetMessageStatus({
                profileId: selectedProfile.id,
                messageId: message.id,
                ...payload
            });
            const affectsUnread = typeof payload.read === 'boolean'
                && message.direction !== 'outbound'
                && !message.archivedAt
                && !message.deletedAt;
            const unreadDelta = affectsUnread
                ? payload.read
                    ? message.readAt ? 0 : -1
                    : message.readAt ? 1 : 0
                : 0;
            if (!options.silent && typeof payload.read === 'boolean') {
                manualUnreadMessageRef.current = payload.read ? '' : message.id;
            }

            setWorkspace((current) => {
                if (!current) {
                    return current;
                }

                const accountId = message.accountId || current.selectedAccountId;
                return {
                    ...current,
                    accounts: unreadDelta === 0
                        ? current.accounts
                        : (current.accounts || []).map((account) => (
                            account.id === accountId
                                ? {...account, unread: Math.max(0, Number(account.unread || 0) + unreadDelta)}
                                : account
                        )),
                    messages: (current.messages || []).map((item) => (
                        item.id === message.id ? {...item, ...updated} : item
                    ))
                };
            });

            if (!options.silent) {
                const title = typeof payload.starred === 'boolean'
                    ? payload.starred ? '已添加星标' : '已取消星标'
                    : payload.read ? '已标记为已读' : '已标记为未读';
                showToast('success', title);
            }
        } catch (statusError) {
            if (!options.silent) {
                showToast('error', '更新邮件状态失败', statusError.message || '请稍后重试。');
            }
        } finally {
            setBusy('');
        }
    }

    async function handleDownloadAttachment(attachment) {
        if (!selectedProfile || !attachment) {
            return;
        }

        setBusy('download');

        try {
            const result = await DownloadAttachment({
                profileId: selectedProfile.id,
                attachmentId: attachment.id,
                filename: attachment.filename
            });
            showToast('success', '附件已保存', result.path);
        } catch (downloadError) {
            if (downloadError.message !== 'download canceled') {
                showToast('error', '下载失败', downloadError.message || '附件无法下载。');
            }
        } finally {
            setBusy('');
        }
    }

    async function handlePreviewAttachment(attachment) {
        if (!selectedProfile || !attachment) {
            return null;
        }

        setBusy('preview');

        try {
            return await PreviewAttachment({
                profileId: selectedProfile.id,
                attachmentId: attachment.id,
                filename: attachment.filename
            });
        } finally {
            setBusy('');
        }
    }

    function openContextMenu(event, message) {
        event.preventDefault();
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            message
        });
    }

    const showEndpointPage = contentPage === 'endpoints';
    const showProfilePage = contentPage === 'profile';
    const showAuthPage = contentPage === 'auth';
    const showAccountPage = contentPage === 'account';
    const showAccountManagerPage = contentPage === 'accounts';
    const showDomainManagerPage = contentPage === 'domains';
    const showStartPage = contentPage === 'start' || (!selectedProfile && !showEndpointPage && !showProfilePage);
    const showSettingsPage = contentPage === 'settings';

    return (
        <div className="window-shell">
            <TitleBar theme={theme} toggleTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} />
            <div
                className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${resizingPanel ? 'resizing' : ''}`}
                style={{
                    '--sidebar-width': `${sidebarCollapsed ? 68 : sidebarWidth}px`,
                    '--list-width': `${listWidth}px`
                }}
                onClick={() => setContextMenu(null)}
            >
                <a className="skip-link" href="#reader">跳到邮件内容</a>

                <Sidebar
                    activeFolder={activeFolder}
                    authForm={authForm}
                    busy={busy}
                    collapsed={sidebarCollapsed}
                    folderCounts={folderCounts}
                    onAccountChange={(accountId) => loadMailbox({
                        profileId: selectedProfile?.id,
                        domain: workspace?.selectedDomain || '',
                        accountId
                    })}
                    onAddAccount={handleAddAccount}
                    onAddProfile={handleAddProfile}
                    onAuth={() => handleOpenAuth(selectedProfile)}
                    onBackToProfiles={handleBackToProfiles}
                    onDeleteProfile={handleDeleteProfile}
                    onDomainChange={(domain) => loadMailbox({profileId: selectedProfile?.id, domain})}
                    onEditProfile={handleEditProfile}
                    onFolderChange={setActiveFolder}
                    onManageAccounts={handleOpenAccountManager}
                    onManageDomains={handleOpenDomainManager}
                    onManageProfiles={handleOpenProfileManager}
                    onCompose={() => setComposerOpen(true)}
                    onProfileSelect={handleSelectProfile}
                    onToggle={() => setSidebarCollapsed((value) => !value)}
                    profiles={profiles}
                    profileMenuOpen={profileMenuOpen}
                    sidebarPage={sidebarPage}
                    selectedProfile={selectedProfile}
                    selectedProfileId={selectedProfileId}
                    setProfileMenuOpen={setProfileMenuOpen}
                    status={status}
                    theme={theme}
                    toggleTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
                    workspace={workspace}
                />

                <ResizeHandle
                    active={resizingPanel === 'sidebar'}
                    hidden={sidebarCollapsed}
                    label="调整侧栏宽度"
                    max={layoutLimits.sidebar.max}
                    min={layoutLimits.sidebar.min}
                    onDoubleClick={() => resetLayoutWidth('sidebar')}
                    onKeyDown={(event) => handleResizeKey('sidebar', event)}
                    onPointerDown={(event) => startPanelResize('sidebar', event)}
                    value={sidebarWidth}
                />

                {showProfilePage ? (
                    <ProfileEditorPage
                        busy={busy}
                        form={profileForm}
                        onBack={handleCloseProfileEditor}
                        onChange={setProfileForm}
                        onSubmit={handleProfileSubmit}
                    />
                ) : showEndpointPage ? (
                    <EndpointManagerPage
                        busy={busy}
                        onAddProfile={handleAddProfile}
                        onAuth={handleOpenAuth}
                        onBack={() => setContentPage(selectedProfile ? 'mail' : 'start')}
                        onDeleteProfile={handleDeleteProfile}
                        onEditProfile={handleEditProfile}
                        onProfileSelect={handleSelectProfile}
                        onTestProfile={handleTestProfile}
                        profiles={profiles}
                        selectedProfileId={selectedProfileId}
                        status={status}
                    />
                ) : showAuthPage && selectedProfile ? (
                    <AuthPage
                        authForm={authForm}
                        busy={busy}
                        manualToken={manualToken}
                        onAuthFormChange={setAuthForm}
                        onBack={handleCloseAuthPage}
                        onManualToken={handleManualToken}
                        onManualTokenChange={setManualToken}
                        onSubmit={handleAuthorize}
                        profile={selectedProfile}
                        status={status}
                    />
                ) : showStartPage ? (
                    <StartPage
                        busy={busy}
                        onAddProfile={handleAddProfile}
                        onManageProfiles={handleOpenProfileManager}
                        profiles={profiles}
                    />
                ) : showAccountPage && selectedProfile ? (
                    <AccountEditorPage
                        busy={busy}
                        domain={workspace?.selectedDomain || ''}
                        form={accountForm}
                        onBack={handleCloseAccountEditor}
                        onChange={setAccountForm}
                        onSubmit={handleAccountSubmit}
                        profile={selectedProfile}
                    />
                ) : showAccountManagerPage && selectedProfile ? (
                    <AccountManagerPage
                        accounts={workspace?.accounts || []}
                        busy={busy}
                        domain={workspace?.selectedDomain || ''}
                        onAddAccount={handleAddAccount}
                        onBack={() => setContentPage('mail')}
                        onCopy={handleCopyText}
                        onDeleteAccount={handleDeleteAccount}
                        onSelectAccount={(accountId) => loadMailbox({
                            profileId: selectedProfile.id,
                            domain: workspace?.selectedDomain || '',
                            accountId
                        })}
                        onUpdateAccount={handleUpdateAccount}
                        selectedAccountId={workspace?.selectedAccountId || ''}
                    />
                ) : showDomainManagerPage && selectedProfile ? (
                    <DomainManagerPage
                        busy={busy}
                        domains={workspace?.domains || []}
                        form={domainForm}
                        onBack={() => setContentPage('mail')}
                        onChange={setDomainForm}
                        onCopy={handleCopyText}
                        onSelectDomain={(domain) => loadMailbox({profileId: selectedProfile.id, domain})}
                        onSubmit={handleDomainSubmit}
                        selectedDomain={workspace?.selectedDomain || ''}
                        selectedProfile={selectedProfile}
                    />
                ) : showSettingsPage ? (
                    <SettingsPage
                        auditLogs={auditLogs}
                        busy={busy}
                        canClearCurrentDraft={canClearCurrentDraft}
                        diagnostics={endpointDiagnostics}
                        insightsProfileId={insightsProfileId}
                        onBack={() => setContentPage('mail')}
                        onClearCurrentDraft={clearCurrentDraft}
                        onLoadInsights={loadEndpointInsights}
                        onNotify={showToast}
                        onOpenProfiles={handleOpenProfileManager}
                        onProfileUpdate={(profile) => setProfiles((current) => upsertProfile(current, profile))}
                        onReloadMailbox={reloadCurrentMailbox}
                        onResetLayout={resetLayoutPreferences}
                        selectedAccount={selectedAccount}
                        selectedProfile={selectedProfile}
                        status={status}
                        storagePath={storagePath}
                        theme={theme}
                        toggleTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
                        workspace={workspace}
                    />
                ) : (
                    <>
                        <EmailListPanel
                            activeFolder={activeFolder}
                            busy={busy}
                            messages={visibleMessages}
                            onCompose={() => setComposerOpen(true)}
                            onContextMenu={openContextMenu}
                            onMessageSelect={setSelectedMessageId}
                            onReload={reloadCurrentMailbox}
                            searchInputRef={searchInputRef}
                            searchQuery={searchQuery}
                            selectedMessageId={selectedMessage?.id || ''}
                            selectedProfile={selectedProfile}
                            setSearchQuery={setSearchQuery}
                            workspace={workspace}
                        />

                        <ResizeHandle
                            active={resizingPanel === 'list'}
                            label="调整邮件列表宽度"
                            max={layoutLimits.list.max}
                            min={layoutLimits.list.min}
                            onDoubleClick={() => resetLayoutWidth('list')}
                            onKeyDown={(event) => handleResizeKey('list', event)}
                            onPointerDown={(event) => startPanelResize('list', event)}
                            value={listWidth}
                        />

                        <main id="reader" className={`reader-panel ${composerOpen ? 'composing' : ''}`}>
                            {composerOpen ? (
                                <Composer
                                    account={selectedAccount}
                                    busy={busy}
                                    form={composeForm}
                                    hasSavedDraft={hasSavedDraft}
                                    optionsOpen={composeOptionsOpen}
                                    onChange={setComposeForm}
                                    onClearDraft={clearCurrentDraft}
                                    onClose={() => setComposerOpen(false)}
                                    onSubmit={handleSendMessage}
                                    onToggleOptions={() => setComposeOptionsOpen((value) => !value)}
                                />
                            ) : (
                                <>
                                    <ReaderToolbar
                                        busy={busy}
                                        onArchive={() => handleArchiveMessage(selectedMessage)}
                                        onDelete={() => handleDeleteMessage(selectedMessage)}
                                        onOpenSettings={() => setContentPage('settings')}
                                        onReload={reloadCurrentMailbox}
                                        onSetStatus={handleSetMessageStatus}
                                        selectedMessage={selectedMessage}
                                        selectedProfile={selectedProfile}
                                    />

                                    <ReadingView
                                        busy={busy}
                                        message={selectedMessage}
                                        onArchive={handleArchiveMessage}
                                        onDelete={handleDeleteMessage}
                                        onDownload={handleDownloadAttachment}
                                        onPreview={handlePreviewAttachment}
                                        onSetStatus={handleSetMessageStatus}
                                        selectedProfile={selectedProfile}
                                    />
                                </>
                            )}
                        </main>
                    </>
                )}

                {contextMenu ? (
                    <ContextMenu
                        contextMenu={contextMenu}
                        onArchive={handleArchiveMessage}
                        onClose={() => setContextMenu(null)}
                        onDelete={handleDeleteMessage}
                        onSetStatus={handleSetMessageStatus}
                    />
                ) : null}

                <Toast toast={toast} onClose={() => setToast(null)} />
            </div>
        </div>
    );
}

function TitleBar({theme, toggleTheme}) {
    return (
        <header className="titlebar" aria-label="窗口标题栏">
            <div className="titlebar-drag-region">
                <div className="titlebar-brand">
                    <span className="titlebar-logo">OM</span>
                    <strong>OmniMail Desktop</strong>
                </div>
            </div>
            <div className="titlebar-actions">
                <button className="titlebar-tool" type="button" onClick={toggleTheme} aria-label="切换亮色暗色模式" title="切换亮色暗色模式">
                    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <button className="window-control" type="button" onClick={WindowMinimise} aria-label="最小化" title="最小化">
                    <Minus size={15} />
                </button>
                <button className="window-control" type="button" onClick={WindowToggleMaximise} aria-label="最大化或还原" title="最大化或还原">
                    <Maximize2 size={14} />
                </button>
                <button className="window-control close" type="button" onClick={Quit} aria-label="关闭" title="关闭">
                    <X size={15} />
                </button>
            </div>
        </header>
    );
}

function ResizeHandle({active = false, hidden = false, label, max, min, onDoubleClick, onKeyDown, onPointerDown, value}) {
    if (hidden) {
        return <div className="resize-handle hidden" aria-hidden="true" />;
    }

    return (
        <button
            className={`resize-handle ${active ? 'active' : ''}`}
            type="button"
            role="separator"
            aria-label={label}
            aria-orientation="vertical"
            aria-valuemax={max}
            aria-valuemin={min}
            aria-valuenow={value}
            title={`${label}；双击恢复默认宽度`}
            onDoubleClick={onDoubleClick}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
        />
    );
}

function Sidebar({
    activeFolder,
    busy,
    collapsed,
    folderCounts,
    onAccountChange,
    onAddAccount,
    onAddProfile,
    onAuth,
    onBackToProfiles,
    onCompose,
    onDeleteProfile,
    onDomainChange,
    onEditProfile,
    onFolderChange,
    onManageAccounts,
    onManageDomains,
    onManageProfiles,
    onProfileSelect,
    onToggle,
    profiles,
    profileMenuOpen,
    sidebarPage,
    selectedProfile,
    selectedProfileId,
    setProfileMenuOpen,
    status,
    theme,
    toggleTheme,
    workspace
}) {
    const domains = workspace?.domains || [];
    const accounts = workspace?.accounts || [];
    const mailboxLoading = Boolean(selectedProfile?.hasToken) && busy === 'mailbox' && !workspace;
    const isProfilePage = sidebarPage === 'profiles';

    if (isProfilePage) {
        return (
            <aside className="sidebar profile-picker-sidebar" aria-label="接入点选择">
                <div className="sidebar-top">
                    <div className="workspace-heading" title="OmniMail Desktop">
                        <strong>OmniMail</strong>
                        <small>选择一个接入点开始</small>
                    </div>
                    <IconButton
                        icon={collapsed ? PanelLeftOpen : PanelLeftClose}
                        label={collapsed ? '展开侧栏' : '收起侧栏'}
                        onClick={onToggle}
                    />
                </div>

                <div className="profile-picker-intro">
                    <p>接入点</p>
                    <h2>选择邮箱服务</h2>
                    <span>每个接入点独立保存授权、域名和邮箱账号。</span>
                </div>

                <div className="nav-section endpoint-section profile-picker-list" aria-label="接入点">
                    <div className="section-row">
                        <SectionLabel>可用接入点</SectionLabel>
                        <IconButton icon={Plus} label="添加接入点" onClick={onAddProfile} />
                    </div>
                    {profiles.map((profile) => (
                        <button
                            className={`endpoint-card ${profile.id === selectedProfileId ? 'active' : ''}`}
                            key={profile.id}
                            type="button"
                            onClick={() => onProfileSelect(profile)}
                        >
                            <span>{profile.name}</span>
                            <small>{profile.baseUrl}</small>
                            <em>{profile.hasToken ? profile.tokenPreview : '未授权'}</em>
                        </button>
                    ))}
                    {!profiles.length ? <MutedLine>添加第一个 Worker Base URL</MutedLine> : null}
                </div>

                <div className="profile-picker-actions">
                    <button type="button" onClick={toggleTheme}>
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
                    </button>
                    <button type="button" onClick={onManageProfiles}>
                        <ShieldCheck size={16} />
                        <span>管理接入点</span>
                    </button>
                </div>
            </aside>
        );
    }

    return (
        <aside className="sidebar mailbox-sidebar" aria-label="邮箱导航">
            <div className="sidebar-top mailbox-sidebar-top">
                <button className="sidebar-back-button" type="button" onClick={onBackToProfiles} aria-label="返回接入点选择" title="返回接入点选择">
                    <ArrowLeft size={17} />
                </button>
                <div className="mailbox-context-heading" title={selectedProfile?.baseUrl || '未选择接入点'}>
                    <strong>{selectedProfile?.name || '未选择接入点'}</strong>
                    <small>{selectedProfile?.baseUrl || '返回选择接入点'}</small>
                </div>
                <IconButton
                    icon={collapsed ? PanelLeftOpen : PanelLeftClose}
                    label={collapsed ? '展开侧栏' : '收起侧栏'}
                    onClick={onToggle}
                />
            </div>

            <button className="compose-primary" type="button" onClick={onCompose} disabled={!workspace?.selectedAccountId}>
                <MailPlus size={17} />
                <span>写邮件</span>
            </button>

            {!selectedProfile ? (
                <SidebarNotice
                    title="未选择接入点"
                    detail="返回上一层选择接入点后再进入邮箱。"
                    actionLabel="返回选择"
                    onAction={onBackToProfiles}
                />
            ) : !selectedProfile.hasToken ? (
                <SidebarNotice
                    title="接入点未授权"
                    detail="授权后显示该接入点下的域名和邮箱账号。"
                    actionLabel="授权"
                    onAction={onAuth}
                />
            ) : (
                <div className="resource-scope" aria-label="当前接入点资源">
                    <nav className="nav-section mailbox-folder-section" aria-label="当前邮箱文件夹">
                        <SectionLabel>文件夹</SectionLabel>
                        {folders.map((folder) => (
                            <NavItem
                                key={folder.id}
                                active={folder.id === activeFolder}
                                count={folderCounts[folder.id] || 0}
                                icon={folder.icon}
                                label={folder.label}
                                onClick={() => onFolderChange(folder.id)}
                            />
                        ))}
                    </nav>

                    <div className="nav-section resource-section">
                        <SectionLabel>域名</SectionLabel>
                        {domains.map((domain) => (
                            <button
                                className={`domain-item ${domain === workspace?.selectedDomain ? 'active' : ''}`}
                                key={domain}
                                type="button"
                                onClick={() => onDomainChange(domain)}
                            >
                                <span>{domain}</span>
                            </button>
                        ))}
                        {mailboxLoading ? <MutedLine>正在加载域名</MutedLine> : null}
                        {!mailboxLoading && !domains.length ? <MutedLine>暂无域名</MutedLine> : null}
                    </div>

                    <div className="nav-section accounts-section resource-section">
                        <div className="section-row">
                            <SectionLabel>邮箱账号</SectionLabel>
                            <IconButton
                                icon={Plus}
                                label="添加邮箱账号"
                                onClick={onAddAccount}
                                disabled={!workspace?.selectedDomain}
                            />
                        </div>
                        {accounts.map((account) => (
                            <button
                                className={`account-chip ${account.id === workspace?.selectedAccountId ? 'active' : ''}`}
                                key={account.id}
                                type="button"
                                onClick={() => onAccountChange(account.id)}
                                title={account.address}
                            >
                                <span>{account.address}</span>
                                {account.unread ? <small>{account.unread}</small> : null}
                            </button>
                        ))}
                        {mailboxLoading ? <MutedLine>正在加载邮箱账号</MutedLine> : null}
                        {!mailboxLoading && !accounts.length ? <MutedLine>暂无邮箱账号</MutedLine> : null}
                    </div>
                </div>
            )}

            <div className="sidebar-footer">
                <button className="endpoint-button" type="button" onClick={() => setProfileMenuOpen(!profileMenuOpen)}>
                    <span className="endpoint-avatar"><ShieldCheck size={16} /></span>
                    <span>
                        <strong>{selectedProfile?.name || '未选择接入点'}</strong>
                        <small>
                            {selectedProfile?.hasToken
                                ? `当前接入点已授权${status?.health?.storage ? ` · ${status.health.storage}` : ''}`
                                : '每个接入点独立授权'}
                        </small>
                    </span>
                    <MoreHorizontal size={17} />
                </button>

                {profileMenuOpen ? (
                    <div className="endpoint-menu">
                        <button type="button" onClick={toggleTheme}>
                            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                            {theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
                        </button>
                        <button type="button" onClick={onAuth} disabled={!selectedProfile}>
                            <KeyRound size={16} />
                            授权当前接入点
                        </button>
                        <button type="button" onClick={onManageProfiles}>
                            <ShieldCheck size={16} />
                            管理接入点
                        </button>
                        <button type="button" onClick={onManageDomains} disabled={!selectedProfile?.hasToken}>
                            <Globe2 size={16} />
                            管理域名
                        </button>
                        <button type="button" onClick={onManageAccounts} disabled={!selectedProfile?.hasToken}>
                            <Mail size={16} />
                            管理邮箱账号
                        </button>
                        <button type="button" onClick={() => selectedProfile && onEditProfile(selectedProfile)} disabled={!selectedProfile}>
                            <Settings size={16} />
                            编辑接入点
                        </button>
                        <button className="danger" type="button" onClick={() => selectedProfile && onDeleteProfile(selectedProfile)} disabled={!selectedProfile || busy === 'delete'}>
                            <Trash2 size={16} />
                            删除接入点
                        </button>
                    </div>
                ) : null}
            </div>
        </aside>
    );
}

function StartPage({onAddProfile, onManageProfiles, profiles}) {
    const authorizedCount = profiles.filter((profile) => profile.hasToken).length;

    return (
        <main id="reader" className="workspace-page start-page" aria-label="接入点起始页">
            <section className="start-page-content">
                <header className="start-page-header">
                    <p>OmniMail Desktop</p>
                    <h1>选择一个接入点开始</h1>
                    <small>桌面端不会默认进入任何邮箱。选择接入点后，再加载该接入点下的域名、邮箱账号和邮件。</small>
                </header>

                <div className="start-page-actions">
                    <button className="primary-action compact" type="button" onClick={onAddProfile}>
                        <Plus size={16} />
                        添加接入点
                    </button>
                    <button type="button" onClick={onManageProfiles}>
                        <ShieldCheck size={16} />
                        管理接入点
                    </button>
                </div>

                <div className="start-page-summary">
                    <span>
                        <strong>{profiles.length}</strong>
                        <small>已保存接入点</small>
                    </span>
                    <span>
                        <strong>{authorizedCount}</strong>
                        <small>已授权</small>
                    </span>
                    <span>
                        <strong>{profiles.length - authorizedCount}</strong>
                        <small>待授权</small>
                    </span>
                </div>

                <div className="start-page-notes">
                    <p>
                        <ShieldCheck size={16} />
                        每个接入点独立保存授权状态和 Device Token。
                    </p>
                    <p>
                        <Mail size={16} />
                        邮箱数据只在选中接入点后加载。
                    </p>
                    <p>
                        <Database size={16} />
                        可同时维护多个 Worker Base URL。
                    </p>
                </div>
            </section>
        </main>
    );
}

function EmailListPanel({
    activeFolder,
    busy,
    messages,
    onCompose,
    onContextMenu,
    onMessageSelect,
    onReload,
    searchInputRef,
    searchQuery,
    selectedMessageId,
    selectedProfile,
    setSearchQuery,
    workspace
}) {
    const folder = folders.find((item) => item.id === activeFolder);

    return (
        <section className="list-panel" aria-label="邮件列表">
            <header className="list-header">
                <div>
                    <p>当前视图</p>
                    <h1>{folder?.label || '邮件'}</h1>
                </div>
                <div className="list-actions">
                    <IconButton icon={RefreshCw} label="刷新" onClick={onReload} disabled={!selectedProfile || busy === 'mailbox'} spinning={busy === 'mailbox'} />
                    <IconButton icon={MailPlus} label="写邮件" onClick={onCompose} disabled={!workspace?.selectedAccountId} />
                </div>
            </header>

            <div className="search-box">
                <Search size={16} />
                <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索发件人、主题或正文"
                    aria-label="搜索邮件"
                />
                <kbd>Ctrl K</kbd>
            </div>

            <div className="message-list" role="listbox" aria-label="邮件">
                {busy === 'initial' || busy === 'mailbox' ? (
                    <LoadingList />
                ) : messages.length > 0 ? (
                    messages.map((message) => (
                        <EmailListItem
                            key={message.id}
                            message={message}
                            onContextMenu={(event) => onContextMenu(event, message)}
                            onSelect={() => onMessageSelect(message.id)}
                            selected={message.id === selectedMessageId}
                        />
                    ))
                ) : (
                    <EmptyState
                        icon={Inbox}
                        title={selectedProfile ? (workspace?.selectedAccountId ? '这里还没有邮件' : '先选择邮箱账号') : '先添加一个接入点'}
                        body={selectedProfile ? (workspace?.selectedAccountId ? '切换文件夹、搜索词或等待新的邮件进入。' : '选择邮箱账号后会加载对应邮件。') : '添加 OmniMail Worker Base URL 后即可加载邮箱。'}
                        action={selectedProfile && workspace?.selectedAccountId ? (
                            <button className="primary-action compact" type="button" onClick={onCompose}>
                                <MailPlus size={16} />
                                写邮件
                            </button>
                        ) : null}
                    />
                )}
            </div>
        </section>
    );
}

function EmailListItem({message, onContextMenu, onSelect, selected}) {
    const unread = isUnreadMessage(message);
    const starred = isStarredMessage(message);

    return (
        <button
            className={`mail-row ${selected ? 'selected' : ''} ${unread ? 'unread' : ''} ${starred ? 'starred' : ''}`}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={onSelect}
            onContextMenu={onContextMenu}
        >
            <span className={`unread-dot ${unread ? 'visible' : ''}`} />
            <span className="mail-row-main">
                <span className="mail-row-top">
                    <strong>{message.author || message.email || '未知发件人'}</strong>
                    <span className="mail-row-time">
                        {starred ? <Star size={12} fill="currentColor" /> : null}
                        <time>{formatMessageTime(message.time)}</time>
                    </span>
                </span>
                <span className="mail-row-subject">{message.subject || '无主题'}</span>
                <span className="mail-row-preview">{message.preview || message.body || '无预览内容'}</span>
            </span>
        </button>
    );
}

function ReaderToolbar({busy, onArchive, onDelete, onOpenSettings, onReload, onSetStatus, selectedMessage, selectedProfile}) {
    const unread = isUnreadMessage(selectedMessage);
    const starred = isStarredMessage(selectedMessage);

    return (
        <header className="reader-toolbar">
            <div>
                <p>{selectedProfile?.baseUrl || '未选择接入点'}</p>
                <h2>{selectedMessage?.subject || '阅读区'}</h2>
            </div>
            <div className="toolbar-actions">
                <IconButton icon={RefreshCw} label="刷新" onClick={onReload} disabled={!selectedProfile || busy === 'mailbox'} spinning={busy === 'mailbox'} />
                <IconButton
                    icon={unread ? MailOpen : Mail}
                    label={unread ? '标记已读' : '标记未读'}
                    onClick={() => onSetStatus(selectedMessage, {read: unread})}
                    disabled={!selectedMessage || selectedMessage.direction === 'outbound' || busy === 'message-action'}
                />
                <IconButton
                    active={starred}
                    icon={Star}
                    label={starred ? '取消星标' : '添加星标'}
                    onClick={() => onSetStatus(selectedMessage, {starred: !starred})}
                    disabled={!selectedMessage || busy === 'message-action'}
                />
                <IconButton icon={selectedMessage?.archivedAt ? ArchiveRestore : Archive} label={selectedMessage?.archivedAt ? '取消归档' : '归档'} onClick={onArchive} disabled={!selectedMessage || busy === 'message-action'} />
                <IconButton icon={Trash2} label="删除" onClick={onDelete} disabled={!selectedMessage || busy === 'message-action'} tone="danger" />
                <IconButton icon={Settings} label="设置" onClick={onOpenSettings} />
            </div>
        </header>
    );
}

function ReadingView({busy, message, onArchive, onDelete, onDownload, onPreview, onSetStatus, selectedProfile}) {
    const [detailsExpanded, setDetailsExpanded] = useState(false);
    const [attachmentPreview, setAttachmentPreview] = useState({
        status: 'idle',
        attachment: null,
        result: null,
        error: ''
    });

    useEffect(() => {
        setDetailsExpanded(false);
        setAttachmentPreview({
            status: 'idle',
            attachment: null,
            result: null,
            error: ''
        });
    }, [message?.id]);

    async function openAttachmentPreview(attachment) {
        if (!onPreview || !attachment.downloadable || !isPreviewableAttachment(attachment)) {
            return;
        }

        setAttachmentPreview({
            status: 'loading',
            attachment,
            result: null,
            error: ''
        });

        try {
            const result = await onPreview(attachment);
            setAttachmentPreview({
                status: 'ready',
                attachment,
                result,
                error: ''
            });
        } catch (previewError) {
            setAttachmentPreview({
                status: 'error',
                attachment,
                result: null,
                error: previewError.message || '附件预览失败'
            });
        }
    }

    function closeAttachmentPreview() {
        setAttachmentPreview({
            status: 'idle',
            attachment: null,
            result: null,
            error: ''
        });
    }

    if (busy === 'initial') {
        return <ReadingSkeleton />;
    }

    if (!selectedProfile) {
        return (
            <EmptyState
                icon={ShieldCheck}
                title="连接你的 OmniMail"
                body="左侧添加部署后的 Base URL，然后完成管理员授权。"
            />
        );
    }

    if (!message) {
        return (
            <EmptyState
                icon={Mail}
                title="选择一封邮件"
                body="邮件正文会显示在这里，支持快捷键 J/K 切换。"
            />
        );
    }

    const directionLabel = message.direction === 'outbound' ? '已发送' : '已接收';
    const peerLabel = message.direction === 'outbound' ? '收件人' : '发件人';
    const peerAddress = message.email || '未知地址';
    const authorName = message.author || message.email || '未知发件人';
    const unread = isUnreadMessage(message);
    const starred = isStarredMessage(message);

    return (
        <article className="reading-view">
            <section className="message-block">
                <header className="message-meta">
                    <div className="sender-avatar">
                        {(message.author || message.email || 'M').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                        <h3>{message.subject || '无主题'}</h3>
                        <p>
                            <strong>{authorName}</strong>
                            <span>{message.direction === 'outbound' ? '发往' : '来自'} {peerAddress}</span>
                            <time>{formatMessageTime(message.time)}</time>
                            <span>{directionLabel}</span>
                            {message.direction !== 'outbound' ? <span>{unread ? '未读' : '已读'}</span> : null}
                            {starred ? <span>已星标</span> : null}
                        </p>
                    </div>
                    <div className="message-inline-actions">
                        <button className="metadata-toggle" type="button" onClick={() => setDetailsExpanded((value) => !value)}>
                            {detailsExpanded ? '隐藏详情' : '查看详情'}
                        </button>
                        {message.direction !== 'outbound' ? (
                            <IconButton
                                icon={unread ? MailOpen : Mail}
                                label={unread ? '标记已读' : '标记未读'}
                                onClick={() => onSetStatus(message, {read: unread})}
                                disabled={busy === 'message-action'}
                            />
                        ) : null}
                        <IconButton
                            active={starred}
                            icon={Star}
                            label={starred ? '取消星标' : '添加星标'}
                            onClick={() => onSetStatus(message, {starred: !starred})}
                            disabled={busy === 'message-action'}
                        />
                        <IconButton icon={message.archivedAt ? ArchiveRestore : Archive} label={message.archivedAt ? '取消归档' : '归档'} onClick={() => onArchive(message)} />
                        <IconButton icon={Trash2} label="删除" onClick={() => onDelete(message)} tone="danger" />
                    </div>
                </header>

                {detailsExpanded ? (
                    <dl className="message-detail-grid">
                        <div>
                            <dt>{peerLabel}</dt>
                            <dd>{authorName} &lt;{peerAddress}&gt;</dd>
                        </div>
                        <div>
                            <dt>时间</dt>
                            <dd>{formatMessageTime(message.time)}</dd>
                        </div>
                        <div>
                            <dt>方向</dt>
                            <dd>{directionLabel}</dd>
                        </div>
                        <div>
                            <dt>状态</dt>
                            <dd>
                                {message.deletedAt ? '已删除' : message.archivedAt ? `已归档：${message.archivedAt}` : unread ? '未读' : '已读'}
                            </dd>
                        </div>
                        <div>
                            <dt>星标</dt>
                            <dd>{message.starredAt ? `已星标：${message.starredAt}` : '未星标'}</dd>
                        </div>
                        <div>
                            <dt>已读时间</dt>
                            <dd>{message.readAt || '未读'}</dd>
                        </div>
                        <div>
                            <dt>账号</dt>
                            <dd>{message.accountId || '未知账号'}</dd>
                        </div>
                    </dl>
                ) : null}

                <div className="message-body">
                    {(message.body || message.preview || '无正文内容').split('\n').map((line, index) => (
                        <p key={`${message.id}-${index}`}>{line || '\u00A0'}</p>
                    ))}
                </div>

                {message.attachments?.length ? (
                    <div className="attachment-grid" aria-label="附件">
                        {message.attachments.map((attachment) => {
                            const kind = attachmentKind(attachment);
                            const filename = attachment.filename || '未命名附件';
                            const previewable = attachment.downloadable && isPreviewableAttachment(attachment);

                            return (
                                <article className="attachment-card" key={attachment.id}>
                                    <span className="attachment-kind" aria-label={kind.label}>
                                        <FileText size={16} />
                                        <em>{kind.short}</em>
                                    </span>
                                    <span className="attachment-copy">
                                        <strong>{filename}</strong>
                                        <small>
                                            {kind.label} · {formatFileSize(attachment.size)}
                                            {attachment.mimeType ? ` · ${attachment.mimeType}` : ''}
                                        </small>
                                    </span>
                                    <span className="attachment-actions">
                                        <button
                                            type="button"
                                            onClick={() => openAttachmentPreview(attachment)}
                                            disabled={!previewable || busy === 'preview'}
                                            title={previewable ? '预览附件' : '该附件类型暂不支持预览'}
                                            aria-label={previewable ? `预览附件 ${filename}` : `${filename} 不可预览`}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDownload(attachment)}
                                            disabled={!attachment.downloadable || busy === 'download'}
                                            title={attachment.downloadable ? '保存附件' : '附件内容未存储'}
                                            aria-label={attachment.downloadable ? `保存附件 ${filename}` : `${filename} 不可下载`}
                                        >
                                            <Download size={16} />
                                        </button>
                                    </span>
                                </article>
                            );
                        })}
                    </div>
                ) : null}
            </section>
            <AttachmentPreviewDialog preview={attachmentPreview} onClose={closeAttachmentPreview} />
        </article>
    );
}

function AttachmentPreviewDialog({onClose, preview}) {
    if (!preview || preview.status === 'idle') {
        return null;
    }

    const attachment = preview.attachment || {};
    const result = preview.result || {};
    const filename = result.filename || attachment.filename || '附件预览';
    const previewType = result.previewType || '';
    const mimeType = result.mimeType || attachment.mimeType || '';

    return (
        <div className="attachment-preview-backdrop" role="presentation" onMouseDown={onClose}>
            <section
                className="attachment-preview-card"
                role="dialog"
                aria-modal="true"
                aria-label={`预览附件 ${filename}`}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header>
                    <div>
                        <p>附件预览</p>
                        <h2>{filename}</h2>
                        <small>{mimeType || '未知类型'} · {formatFileSize(result.size || attachment.size)}</small>
                    </div>
                    <IconButton icon={X} label="关闭附件预览" onClick={onClose} />
                </header>

                <div className={`attachment-preview-body ${previewType}`}>
                    {preview.status === 'loading' ? (
                        <div className="attachment-preview-state">
                            <RefreshCw className="spin-inline" size={20} />
                            <span>正在读取附件</span>
                        </div>
                    ) : null}

                    {preview.status === 'error' ? (
                        <div className="attachment-preview-state error">
                            <CircleAlert size={22} />
                            <span>{preview.error || '附件预览失败'}</span>
                        </div>
                    ) : null}

                    {preview.status === 'ready' && previewType === 'image' ? (
                        <img src={result.dataUrl} alt={filename} />
                    ) : null}

                    {preview.status === 'ready' && previewType === 'pdf' ? (
                        <iframe src={result.dataUrl} title={filename} />
                    ) : null}

                    {preview.status === 'ready' && previewType === 'text' ? (
                        <pre>{result.text || '空文本附件'}</pre>
                    ) : null}
                </div>
            </section>
        </div>
    );
}

function Composer({
    account,
    busy,
    form,
    hasSavedDraft,
    onChange,
    onClearDraft,
    onClose,
    onSubmit,
    onToggleOptions,
    optionsOpen
}) {
    const sending = busy === 'send';
    const disabled = !account || sending;
    const recipients = splitRecipients(form.to);
    const ccRecipients = splitRecipients(form.cc);
    const bccRecipients = splitRecipients(form.bcc);
    const invalid = [
        ...invalidRecipients(form.to),
        ...invalidRecipients(form.cc),
        ...invalidRecipients(form.bcc)
    ];
    const recipientCount = recipients.length + ccRecipients.length + bccRecipients.length;
    const hasDraft = hasSavedDraft || composeHasContent(form);
    const canSend = Boolean(account && recipients.length && form.subject.trim() && !invalid.length && !sending);

    return (
        <section className="composer-card" aria-label="写邮件">
            <form onSubmit={onSubmit}>
                <header>
                    <div>
                        <p>新邮件</p>
                        <h3>{account?.address || '未选择发件身份'}</h3>
                    </div>
                    <div className="composer-header-actions">
                        <button className="composer-secondary-action" type="button" onClick={onToggleOptions} disabled={disabled}>
                            {optionsOpen ? '隐藏抄送/密送' : '抄送/密送'}
                        </button>
                        <IconButton icon={X} label="关闭写信窗口" onClick={onClose} />
                    </div>
                </header>

                <label>
                    <span>收件人</span>
                    <input
                        value={form.to}
                        onChange={(event) => onChange({...form, to: event.target.value})}
                        placeholder="name@example.com，多个收件人用逗号分隔"
                        type="text"
                        disabled={disabled}
                        autoFocus
                    />
                </label>
                {optionsOpen ? (
                    <div className="composer-field-grid">
                        <label>
                            <span>抄送</span>
                            <input
                                value={form.cc}
                                onChange={(event) => onChange({...form, cc: event.target.value})}
                                placeholder="cc@example.com"
                                type="text"
                                disabled={disabled}
                            />
                        </label>
                        <label>
                            <span>密送</span>
                            <input
                                value={form.bcc}
                                onChange={(event) => onChange({...form, bcc: event.target.value})}
                                placeholder="bcc@example.com"
                                type="text"
                                disabled={disabled}
                            />
                        </label>
                    </div>
                ) : null}
                <label>
                    <span>主题</span>
                    <input
                        value={form.subject}
                        onChange={(event) => onChange({...form, subject: event.target.value})}
                        placeholder="写一个清晰的主题"
                        disabled={disabled}
                    />
                </label>
                <label>
                    <span>正文</span>
                    <textarea
                        value={form.text}
                        onChange={(event) => onChange({...form, text: event.target.value})}
                        rows={5}
                        placeholder="输入邮件正文"
                        disabled={disabled}
                    />
                </label>
                <footer>
                    <span className={invalid.length ? 'composer-meta-line error' : 'composer-meta-line'} aria-live="polite">
                        {invalid.length
                            ? `${invalid.length} 个邮箱格式需要检查`
                            : hasDraft
                                ? `本机草稿已按当前接入点保存${recipientCount ? ` · ${recipientCount} 位收件人` : ''}`
                                : '草稿会自动保存在本机当前接入点下'}
                    </span>
                    <div className="composer-footer-actions">
                        <button type="button" onClick={onClearDraft} disabled={disabled || !hasDraft}>
                            清空草稿
                        </button>
                        <button className="primary-action" type="submit" disabled={!canSend}>
                            {sending ? <RefreshCw className="spin-inline" size={16} /> : <Send size={16} />}
                            {sending ? '发送中' : '发送'}
                        </button>
                    </div>
                </footer>
            </form>
        </section>
    );
}

function ProfileEditorPage({busy, form, onBack, onChange, onSubmit}) {
    return (
        <main id="reader" className="workspace-page profile-editor-page" aria-label={form.id ? '编辑接入点' : '添加接入点'}>
            <header className="profile-editor-page-header">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回
                </button>
                <div>
                    <p>{form.id ? '编辑接入点' : '添加接入点'}</p>
                    <h1>{form.id ? '编辑邮箱服务接入点' : '添加邮箱服务接入点'}</h1>
                    <small>接入点是一个独立部署的 OmniMail Worker Base URL，授权和邮箱数据会按接入点隔离。</small>
                </div>
            </header>

            <div className="profile-editor-layout">
                <form className="profile-editor-form" onSubmit={onSubmit}>
                    <label>
                        <span>接入点名称</span>
                        <input
                            value={form.name}
                            onChange={(event) => onChange({...form, name: event.target.value})}
                            placeholder="例如：主站邮箱"
                            autoFocus
                        />
                        <small>用于本机识别，不会同步到 Worker。</small>
                    </label>
                    <label>
                        <span>Worker Base URL</span>
                        <input
                            value={form.baseUrl}
                            onChange={(event) => onChange({...form, baseUrl: event.target.value})}
                            placeholder="https://mail.example.com"
                            required
                        />
                        <small>填写部署后的 OmniMail Worker 访问地址，建议使用 HTTPS。</small>
                    </label>
                    <footer>
                        <button type="button" onClick={onBack}>取消</button>
                        <button className="primary-action" type="submit" disabled={busy === 'profile'}>
                            保存接入点
                        </button>
                    </footer>
                </form>

                <aside className="profile-editor-aside" aria-label="接入点说明">
                    <section>
                        <ShieldCheck size={18} />
                        <div>
                            <strong>独立授权</strong>
                            <small>每个接入点单独保存 Device Token，不作为全局登录态使用。</small>
                        </div>
                    </section>
                    <section>
                        <Database size={18} />
                        <div>
                            <strong>数据隔离</strong>
                            <small>域名、邮箱账号和邮件只从当前接入点加载。</small>
                        </div>
                    </section>
                    <section>
                        <Activity size={18} />
                        <div>
                            <strong>保存后测试</strong>
                            <small>保存接入点后会自动测试连接，再根据授权状态进入下一步。</small>
                        </div>
                    </section>
                </aside>
            </div>
        </main>
    );
}

function AccountEditorPage({busy, domain, form, onBack, onChange, onSubmit, profile}) {
    const localPart = form.localPart.trim();
    const previewAddress = localPart && domain ? `${localPart}@${domain}` : domain ? `name@${domain}` : '';

    return (
        <main id="reader" className="workspace-page account-editor-page" aria-label="添加邮箱账号">
            <header className="account-editor-page-header">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回
                </button>
                <div>
                    <p>邮箱账号</p>
                    <h1>添加邮箱账号</h1>
                    <small>在当前接入点和域名下创建一个收信账号。账号会绑定到当前 Worker，不会变成全局登录账号。</small>
                </div>
            </header>

            <div className="account-editor-layout">
                <form className="account-editor-form" onSubmit={onSubmit}>
                    <div className="account-preview-card" aria-live="polite">
                        <span>将创建</span>
                        <strong>{previewAddress || '选择域名后显示完整邮箱地址'}</strong>
                    </div>

                    <label>
                        <span>邮箱名称</span>
                        <div className="account-address-input">
                            <input
                                value={form.localPart}
                                onChange={(event) => onChange({...form, localPart: event.target.value})}
                                placeholder="例如 support"
                                required
                                autoFocus
                                disabled={!domain}
                            />
                            <strong>@{domain || 'domain'}</strong>
                        </div>
                        <small>只填写 @ 前面的部分，例如 support、hello 或 sales。</small>
                    </label>
                    <label>
                        <span>显示名称</span>
                        <input
                            value={form.name}
                            onChange={(event) => onChange({...form, name: event.target.value})}
                            placeholder="例如 Support Desk，可留空"
                            disabled={!domain}
                        />
                        <small>用于本机和 Worker 中识别账号，不影响邮箱地址。</small>
                    </label>
                    <footer>
                        <button type="button" onClick={onBack}>取消</button>
                        <button className="primary-action" type="submit" disabled={busy === 'account' || !domain}>
                            创建邮箱账号
                        </button>
                    </footer>
                </form>

                <aside className="account-editor-aside" aria-label="账号创建说明">
                    <section>
                        <MailPlus size={18} />
                        <div>
                            <strong>当前域名</strong>
                            <small>{domain || '请先在左侧选择一个域名'}</small>
                        </div>
                    </section>
                    <section>
                        <ShieldCheck size={18} />
                        <div>
                            <strong>当前接入点</strong>
                            <small>{profile?.name || '未选择接入点'} · {profile?.baseUrl || '无 Base URL'}</small>
                        </div>
                    </section>
                    <section>
                        <Database size={18} />
                        <div>
                            <strong>独立保存</strong>
                            <small>邮箱账号只创建在当前接入点下，切换接入点后会使用另一套账号数据。</small>
                        </div>
                    </section>
                </aside>
            </div>
        </main>
    );
}

function AccountManagerPage({
    accounts,
    busy,
    domain,
    onAddAccount,
    onBack,
    onCopy,
    onDeleteAccount,
    onSelectAccount,
    onUpdateAccount,
    selectedAccountId
}) {
    const [editingId, setEditingId] = useState('');
    const [draftName, setDraftName] = useState('');
    const enabledCount = accounts.filter(isAccountEnabled).length;
    const unreadCount = accounts.reduce((total, account) => total + Number(account.unread || 0), 0);

    function beginEdit(account) {
        setEditingId(account.id);
        setDraftName(account.name || account.label || '');
    }

    async function saveEdit(account) {
        const updated = await onUpdateAccount(account, {name: draftName});
        if (updated) {
            setEditingId('');
            setDraftName('');
        }
    }

    return (
        <main id="reader" className="workspace-page resource-manager-page account-manager-page" aria-label="邮箱账号管理">
            <header className="resource-manager-page-header">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回
                </button>
                <div>
                    <p>邮箱账号管理</p>
                    <h1>邮箱账号</h1>
                    <small>{domain ? `当前域名：${domain}` : '请先在左侧选择一个域名。'}</small>
                </div>
            </header>

            <div className="resource-manager-body">
                <section className="resource-manager-summary" aria-label="邮箱账号概览">
                    <span>
                        <strong>{accounts.length}</strong>
                        <small>账号</small>
                    </span>
                    <span>
                        <strong>{enabledCount}</strong>
                        <small>已启用</small>
                    </span>
                    <span>
                        <strong>{unreadCount}</strong>
                        <small>未读</small>
                    </span>
                    <button className="primary-action compact" type="button" onClick={onAddAccount} disabled={!domain}>
                        <Plus size={16} />
                        添加邮箱账号
                    </button>
                </section>

                {accounts.length ? (
                    <div className="resource-card-list">
                        {accounts.map((account) => {
                            const enabled = isAccountEnabled(account);
                            const editing = editingId === account.id;

                            return (
                                <article className={`resource-card ${account.id === selectedAccountId ? 'active' : ''}`} key={account.id}>
                                    <header>
                                        <div className="resource-card-title">
                                            <Mail size={17} />
                                            <span>
                                                <strong>{account.address}</strong>
                                                <small>{account.name || account.label || '未设置显示名称'}{account.unread ? ` · ${account.unread} 未读` : ''}</small>
                                            </span>
                                        </div>
                                        <StatusBadge ok={enabled} label={enabled ? '已启用' : '已停用'} />
                                    </header>

                                    {editing ? (
                                        <div className="resource-inline-edit">
                                            <input
                                                value={draftName}
                                                onChange={(event) => setDraftName(event.target.value)}
                                                placeholder="显示名称"
                                                autoFocus
                                            />
                                            <button type="button" onClick={() => saveEdit(account)} disabled={busy === 'account-update'}>
                                                保存
                                            </button>
                                            <button type="button" onClick={() => setEditingId('')}>
                                                取消
                                            </button>
                                        </div>
                                    ) : null}

                                    <div className="resource-row-actions">
                                        <button type="button" onClick={() => onSelectAccount(account.id)} disabled={account.id === selectedAccountId}>
                                            查看邮件
                                        </button>
                                        <button type="button" onClick={() => onCopy(account.address, '邮箱地址')}>
                                            <Copy size={15} />
                                            复制
                                        </button>
                                        <button type="button" onClick={() => beginEdit(account)}>
                                            <Pencil size={15} />
                                            重命名
                                        </button>
                                        <button type="button" onClick={() => onUpdateAccount(account, {enabled: !enabled})} disabled={busy === 'account-update'}>
                                            <Power size={15} />
                                            {enabled ? '停用' : '启用'}
                                        </button>
                                        <button className="danger" type="button" onClick={() => onDeleteAccount(account)} disabled={busy === 'account-delete'}>
                                            <Trash2 size={15} />
                                            删除
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <EmptyState
                        icon={MailPlus}
                        title={domain ? '当前域名还没有邮箱账号' : '未选择域名'}
                        body={domain ? '添加一个邮箱账号后，就可以在桌面端查看收件箱和发送邮件。' : '先选择或添加一个域名，再创建邮箱账号。'}
                        action={domain ? (
                            <button className="primary-action compact" type="button" onClick={onAddAccount}>
                                <Plus size={16} />
                                添加邮箱账号
                            </button>
                        ) : null}
                    />
                )}
            </div>
        </main>
    );
}

function DomainManagerPage({
    busy,
    domains,
    form,
    onBack,
    onChange,
    onCopy,
    onSelectDomain,
    onSubmit,
    selectedDomain,
    selectedProfile
}) {
    return (
        <main id="reader" className="workspace-page resource-manager-page domain-manager-page" aria-label="域名管理">
            <header className="resource-manager-page-header">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回
                </button>
                <div>
                    <p>域名管理</p>
                    <h1>域名</h1>
                    <small>{selectedProfile?.baseUrl || '当前接入点'} 下的域名会影响邮箱账号归属和邮件路由展示。</small>
                </div>
            </header>

            <div className="resource-manager-body">
                <form className="domain-create-form" onSubmit={onSubmit}>
                    <label>
                        <span>添加未使用域名</span>
                        <input
                            value={form.domain}
                            onChange={(event) => onChange({...form, domain: event.target.value})}
                            placeholder="例如 sss.aci.edu.kg"
                            autoFocus
                        />
                        <small>桌面端会调用当前 Worker 的域名接口；Cloudflare Email Routing/DNS 仍需要在对应账号里配置。</small>
                    </label>
                    <button className="primary-action compact" type="submit" disabled={busy === 'domain'}>
                        <Plus size={16} />
                        添加域名
                    </button>
                </form>

                {domains.length ? (
                    <div className="resource-card-list">
                        {domains.map((domain) => (
                            <article className={`resource-card ${domain === selectedDomain ? 'active' : ''}`} key={domain}>
                                <header>
                                    <div className="resource-card-title">
                                        <Globe2 size={17} />
                                        <span>
                                            <strong>{domain}</strong>
                                            <small>{domain === selectedDomain ? '当前选中域名' : '可切换到该域名加载账号'}</small>
                                        </span>
                                    </div>
                                    <StatusBadge ok label={domain === selectedDomain ? '当前' : '可用'} />
                                </header>
                                <div className="resource-row-actions">
                                    <button type="button" onClick={() => onSelectDomain(domain)} disabled={domain === selectedDomain}>
                                        选择域名
                                    </button>
                                    <button type="button" onClick={() => onCopy(domain, '域名')}>
                                        <Copy size={15} />
                                        复制
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={Globe2}
                        title="还没有域名"
                        body="添加一个域名后，再为该域名创建邮箱账号。"
                    />
                )}
            </div>
        </main>
    );
}

function AuthPage({
    authForm,
    busy,
    manualToken,
    onAuthFormChange,
    onBack,
    onManualToken,
    onManualTokenChange,
    onSubmit,
    profile,
    status
}) {
    return (
        <main id="reader" className="workspace-page auth-page" aria-label="授权接入点">
            <header className="auth-page-header">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回
                </button>
                <div>
                    <p>接入点授权</p>
                    <h1>授权当前接入点</h1>
                    <small>授权只保存到当前接入点，多个 Worker Base URL 之间不会共享设备 Token。</small>
                </div>
            </header>

            <div className="auth-page-layout">
                <section className="auth-context-card" aria-label="当前接入点">
                    <ShieldCheck size={18} />
                    <div>
                        <strong>{profile.name || '未命名接入点'}</strong>
                        <small>{profile.baseUrl}</small>
                    </div>
                    <StatusBadge ok={Boolean(profile.hasToken)} label={profile.hasToken ? '已授权' : '待授权'} />
                </section>

                <div className="auth-page-grid">
                    <form className="auth-page-form" onSubmit={onSubmit}>
                        <header>
                            <KeyRound size={18} />
                            <div>
                                <h2>管理员授权</h2>
                                <p>{status?.authStatus?.requiresSetup ? '当前接入点需要初始化管理员。' : '使用管理员账号登录，并注册这个桌面端设备。'}</p>
                            </div>
                        </header>
                        <label className="checkbox-row">
                            <input
                                type="checkbox"
                                checked={authForm.setup}
                                onChange={(event) => onAuthFormChange({...authForm, setup: event.target.checked})}
                            />
                            首次部署，创建管理员账号
                        </label>
                        <label>
                            <span>管理员邮箱</span>
                            <input
                                type="email"
                                value={authForm.email}
                                onChange={(event) => onAuthFormChange({...authForm, email: event.target.value})}
                                required
                                autoFocus
                            />
                        </label>
                        <label>
                            <span>密码</span>
                            <input
                                type="password"
                                value={authForm.password}
                                onChange={(event) => onAuthFormChange({...authForm, password: event.target.value})}
                                required
                            />
                        </label>
                        <label>
                            <span>设备名称</span>
                            <input
                                value={authForm.deviceLabel}
                                onChange={(event) => onAuthFormChange({...authForm, deviceLabel: event.target.value})}
                            />
                        </label>
                        <button className="primary-action" type="submit" disabled={busy === 'auth'}>
                            登录并注册桌面端
                        </button>
                    </form>

                    <form className="auth-page-form" onSubmit={onManualToken}>
                        <header>
                            <ClipboardList size={18} />
                            <div>
                                <h2>手动 Token</h2>
                                <p>如果已经在 Web 端生成 Device Token，可以直接粘贴保存。</p>
                            </div>
                        </header>
                        <label>
                            <span>Device Token</span>
                            <textarea
                                value={manualToken}
                                onChange={(event) => onManualTokenChange(event.target.value)}
                                rows={8}
                                required
                            />
                        </label>
                        <button type="submit" disabled={busy === 'token'}>保存 Token</button>
                    </form>
                </div>
            </div>
        </main>
    );
}

function EndpointManagerPage({
    busy,
    onAddProfile,
    onAuth,
    onBack,
    onDeleteProfile,
    onEditProfile,
    onProfileSelect,
    onTestProfile,
    profiles,
    selectedProfileId,
    status
}) {
    const authorizedCount = profiles.filter((profile) => profile.hasToken).length;

    return (
        <main id="reader" className="workspace-page endpoint-manager-page" aria-label="接入点管理">
            <header className="endpoint-manager-page-header">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回
                </button>
                <div>
                    <p>接入点管理</p>
                    <h1>接入点</h1>
                    <small>集中管理 Worker Base URL、授权状态、设备 Token 和连接测试。</small>
                </div>
            </header>
            <div className="endpoint-manager">
                <div className="endpoint-manager-summary">
                    <div className="endpoint-manager-counts">
                        <span>
                            <strong>{profiles.length}</strong>
                            <small>接入点</small>
                        </span>
                        <span>
                            <strong>{authorizedCount}</strong>
                            <small>已授权</small>
                        </span>
                        <span>
                            <strong>{profiles.length - authorizedCount}</strong>
                            <small>待授权</small>
                        </span>
                    </div>
                    <button className="primary-action compact" type="button" onClick={onAddProfile}>
                        <Plus size={16} />
                        添加接入点
                    </button>
                </div>

                {profiles.length ? (
                    <div className="endpoint-manager-list">
                        {profiles.map((profile) => {
                            const isSelected = profile.id === selectedProfileId;
                            const rowStatus = status?.baseUrl === profile.baseUrl ? status : null;

                            return (
                                <article className={`endpoint-manager-card ${isSelected ? 'active' : ''}`} key={profile.id}>
                                    <header>
                                        <div className="endpoint-manager-title">
                                            <strong>{profile.name || '未命名接入点'}</strong>
                                            <small>{profile.baseUrl}</small>
                                        </div>
                                        <div className="endpoint-manager-badges">
                                            {isSelected ? <StatusBadge ok label="当前使用" /> : null}
                                            <StatusBadge ok={profile.hasToken} label={profile.hasToken ? '已授权' : '未授权'} />
                                        </div>
                                    </header>

                                    <div className="endpoint-meta-grid">
                                        <span>
                                            <small>Token</small>
                                            <strong>{profile.hasToken ? profile.tokenPreview : '未保存'}</strong>
                                        </span>
                                        <span>
                                            <small>设备名称</small>
                                            <strong>{profile.deviceLabel || 'Windows 桌面端'}</strong>
                                        </span>
                                        <span>
                                            <small>最后使用</small>
                                            <strong>{formatProfileDate(profile.lastUsedAt)}</strong>
                                        </span>
                                        <span>
                                            <small>更新时间</small>
                                            <strong>{formatProfileDate(profile.updatedAt)}</strong>
                                        </span>
                                    </div>

                                    {rowStatus ? (
                                        <p className={`endpoint-test-result ${rowStatus.ok ? 'ok' : 'error'}`}>
                                            {rowStatus.ok ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
                                            {rowStatus.message || (rowStatus.ok ? '连接正常' : '连接失败')}
                                        </p>
                                    ) : null}

                                    <footer className="endpoint-manager-actions">
                                        <button type="button" onClick={() => onProfileSelect(profile)} disabled={isSelected || busy === 'mailbox'}>
                                            {isSelected ? '当前使用' : '设为当前'}
                                        </button>
                                        <button type="button" onClick={() => onTestProfile(profile)} disabled={busy === 'test'}>
                                            测试连接
                                        </button>
                                        <button type="button" onClick={() => onAuth(profile)} disabled={busy === 'auth'}>
                                            {profile.hasToken ? '重新授权' : '授权'}
                                        </button>
                                        <button type="button" onClick={() => onEditProfile(profile)} disabled={busy === 'profile'}>
                                            编辑
                                        </button>
                                        <button className="danger" type="button" onClick={() => onDeleteProfile(profile)} disabled={busy === 'delete'}>
                                            删除
                                        </button>
                                    </footer>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <EmptyState
                        icon={ShieldCheck}
                        title="还没有接入点"
                        body="添加部署后的 OmniMail Worker Base URL，即可开始接入邮箱。"
                    />
                )}
            </div>
        </main>
    );
}

function SettingsPage({
    auditLogs,
    busy,
    canClearCurrentDraft,
    diagnostics,
    insightsProfileId,
    onBack,
    onClearCurrentDraft,
    onLoadInsights,
    onNotify,
    onOpenProfiles,
    onProfileUpdate,
    onReloadMailbox,
    onResetLayout,
    selectedAccount,
    selectedProfile,
    status,
    storagePath,
    theme,
    toggleTheme,
    workspace
}) {
    const [activeTab, setActiveTab] = useState('general');
    const insightsLoaded = Boolean(selectedProfile && insightsProfileId === selectedProfile.id && diagnostics);
    const setup = insightsLoaded ? diagnostics.setup : null;
    const auditCount = insightsLoaded ? diagnostics.counts?.auditLogs || auditLogs.length : 0;
    const canLoadInsights = Boolean(selectedProfile?.hasToken);
    const visibleTabs = selectedProfile?.hasToken
        ? settingsTabs
        : settingsTabs.filter((tab) => tab.id === 'general');

    useEffect(() => {
        if (!visibleTabs.some((tab) => tab.id === activeTab)) {
            setActiveTab('general');
        }
    }, [activeTab, visibleTabs]);

    return (
        <main id="reader" className="workspace-page settings-page" aria-label="设置">
            <header className="settings-page-header">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回邮箱
                </button>
                <div>
                    <p>设置</p>
                    <h1>工作台设置</h1>
                    <small>{selectedProfile ? selectedProfile.baseUrl : '尚未选择接入点'}</small>
                </div>
            </header>

            <div className="settings-page-body">
                <nav className="settings-tabbar" aria-label="设置分组">
                    {visibleTabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                className={activeTab === tab.id ? 'active' : ''}
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>

                {activeTab === 'general' ? (
                    <>
                        <div className="settings-grid">
                            <SettingRow
                                icon={theme === 'dark' ? Moon : Sun}
                                title="外观"
                                body={theme === 'dark' ? '当前为深色模式' : '当前为浅色模式'}
                                action={<button type="button" onClick={toggleTheme}>切换主题</button>}
                            />
                            <SettingRow
                                icon={ShieldCheck}
                                title="接入点状态"
                                body={selectedProfile ? selectedProfile.baseUrl : '尚未选择接入点'}
                                action={<StatusBadge ok={Boolean(status?.ok)} label={status?.ok ? '正常' : '未验证'} />}
                            />
                            <SettingRow
                                icon={ShieldCheck}
                                title="接入点管理"
                                body="集中管理 Base URL、授权状态、Token 和连接测试。"
                                action={<button type="button" onClick={onOpenProfiles}>打开管理</button>}
                            />
                            <SettingRow
                                icon={Activity}
                                title="系统诊断"
                                body={insightsLoaded
                                    ? `必需项 ${setup?.completedRequired || 0}/${setup?.totalRequired || 0}，总进度 ${setup?.completed || 0}/${setup?.total || 0}`
                                    : canLoadInsights
                                        ? '读取当前接入点的 Worker 绑定、数据量和部署进度。'
                                        : '当前接入点尚未授权，无法读取诊断。'}
                                action={(
                                    <button type="button" onClick={() => onLoadInsights(selectedProfile)} disabled={!canLoadInsights || busy === 'insights'}>
                                        {busy === 'insights' ? '读取中' : insightsLoaded ? '刷新' : '读取'}
                                    </button>
                                )}
                            />
                            <SettingRow
                                icon={ClipboardList}
                                title="审计日志"
                                body={insightsLoaded
                                    ? `已加载最近 ${auditLogs.length} 条，接入点累计 ${formatCount(auditCount)} 条。`
                                    : '读取当前接入点最近的授权、邮件和配置变更记录。'}
                                action={<StatusBadge ok={insightsLoaded} label={insightsLoaded ? '已加载' : '未读取'} />}
                            />
                            <SettingRow
                                icon={Mail}
                                title="本机草稿"
                                body="写信草稿按当前接入点和发件账号分别保存在本机。"
                                action={<button type="button" onClick={onClearCurrentDraft} disabled={!canClearCurrentDraft}>清除当前草稿</button>}
                            />
                            <SettingRow
                                icon={PanelLeftOpen}
                                title="布局偏好"
                                body="恢复侧栏、邮件列表宽度和侧栏收起状态。"
                                action={<button type="button" onClick={onResetLayout}>恢复默认</button>}
                            />
                            <SettingRow
                                icon={KeyRound}
                                title="快捷键"
                                body="Ctrl K 搜索，J/K 切换邮件，R 刷新，N 写邮件。"
                                action={<StatusBadge ok label="已启用" />}
                            />
                            <SettingRow
                                icon={ShieldCheck}
                                title="本地存储"
                                body={storagePath || '正在读取本地配置路径'}
                                action={<StatusBadge ok label="本机" />}
                            />
                            <SettingRow
                                icon={KeyRound}
                                title="Token 存储"
                                body={selectedProfile?.hasAdminSession
                                    ? `Device Token 和管理员会话都按当前接入点隔离保存。管理员：${selectedProfile.adminEmail || selectedProfile.adminTokenPreview}`
                                    : 'Windows 下使用 DPAPI 按接入点分别保护本地 Device Token。'}
                                action={<StatusBadge ok={Boolean(selectedProfile?.hasAdminSession)} label={selectedProfile?.hasAdminSession ? '管理员已授权' : '仅设备 Token'} />}
                            />
                        </div>
                        {!selectedProfile?.hasToken ? (
                            <section className="insight-panel">
                                <header>
                                    <div>
                                        <p>接入点运维</p>
                                        <h3>授权后显示高级管理工具</h3>
                                        <small>邮箱设置、DNS 健康、设备 Token 和维护工具都按接入点隔离，不使用全局用户态。</small>
                                    </div>
                                    <StatusBadge ok={false} label="未授权" />
                                </header>
                            </section>
                        ) : null}
                        {insightsLoaded ? (
                            <>
                                <DiagnosticsPanel diagnostics={diagnostics} />
                                <AuditLogPanel logs={auditLogs} />
                            </>
                        ) : null}
                    </>
                ) : null}

                {selectedProfile?.hasToken ? (
                    <>
                        {activeTab === 'mailbox' ? (
                        <MailboxSettingsPanel
                            onNotify={onNotify}
                            onReloadMailbox={onReloadMailbox}
                            selectedAccount={selectedAccount}
                            selectedProfile={selectedProfile}
                        />
                        ) : null}
                        {activeTab === 'dns' ? (
                        <DNSHealthPanel
                            domain={workspace?.selectedDomain || ''}
                            onNotify={onNotify}
                            selectedProfile={selectedProfile}
                        />
                        ) : null}
                        {activeTab === 'devices' ? (
                        <DeviceManagerPanel
                            onNotify={onNotify}
                            selectedProfile={selectedProfile}
                        />
                        ) : null}
                        {activeTab === 'maintenance' ? (
                        <MaintenancePanel
                            onNotify={onNotify}
                            selectedProfile={selectedProfile}
                        />
                        ) : null}
                        {activeTab === 'security' ? (
                        <SecurityPanel
                            onNotify={onNotify}
                            onProfileUpdate={onProfileUpdate}
                            selectedProfile={selectedProfile}
                        />
                        ) : null}
                    </>
                ) : null}
            </div>
        </main>
    );
}

function SettingsPanelHeader({action, body, icon: Icon, kicker, title}) {
    return (
        <header>
            <div className="settings-panel-title">
                <Icon size={17} />
                <span>
                    <p>{kicker}</p>
                    <h3>{title}</h3>
                    {body ? <small>{body}</small> : null}
                </span>
            </div>
            {action}
        </header>
    );
}

function MailboxSettingsPanel({onNotify, onReloadMailbox, selectedAccount, selectedProfile}) {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!selectedProfile?.id || !selectedAccount?.id) {
            setSettings(null);
            setError('');
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setError('');

        GetAccountSettings({
            profileId: selectedProfile.id,
            accountId: selectedAccount.id
        }).then((result) => {
            if (!cancelled) {
                setSettings(normalizeMailboxSettings(result));
            }
        }).catch((loadError) => {
            if (!cancelled) {
                setError(loadError.message || '无法读取邮箱设置。');
            }
        }).finally(() => {
            if (!cancelled) {
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [selectedProfile?.id, selectedAccount?.id]);

    function updateField(field, value) {
        setSettings((current) => normalizeMailboxSettings({
            ...(current || defaultMailboxSettings),
            [field]: value
        }));
    }

    async function handleSave(event) {
        event.preventDefault();
        if (!selectedProfile?.id || !selectedAccount?.id || !settings) {
            return;
        }

        const payload = normalizeMailboxSettings(settings);
        if (payload.forwardingEnabled && invalidRecipients(payload.forwardTo).length) {
            setError('转发邮箱格式不正确。');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const saved = await SaveAccountSettings({
                profileId: selectedProfile.id,
                accountId: selectedAccount.id,
                settings: {
                    ...payload,
                    forwardTo: payload.forwardingEnabled ? payload.forwardTo : ''
                }
            });
            setSettings(normalizeMailboxSettings(saved));
            await onReloadMailbox?.();
            onNotify?.('success', '邮箱设置已保存', selectedAccount.address);
        } catch (saveError) {
            const message = saveError.message || '请检查当前接入点权限。';
            setError(message);
            onNotify?.('error', '保存邮箱设置失败', message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="settings-panel">
            <SettingsPanelHeader
                action={<StatusBadge ok={Boolean(selectedAccount)} label={selectedAccount ? '当前邮箱' : '未选择'} />}
                body={selectedAccount ? selectedAccount.address : '进入接入点后选择邮箱账号，才能编辑转发、保留副本和签名。'}
                icon={Mail}
                kicker="邮箱账号"
                title="收发与显示设置"
            />

            {!selectedAccount ? (
                <p className="insight-empty">当前没有选中的邮箱账号。</p>
            ) : loading ? (
                <div className="settings-panel-loading">
                    <RefreshCw className="spin-inline" size={16} />
                    正在读取邮箱设置
                </div>
            ) : (
                <form className="settings-form" onSubmit={handleSave}>
                    {error ? <p className="settings-error">{error}</p> : null}
                    <div className="settings-form-grid">
                        <label className="checkbox-row">
                            <input
                                checked={settings?.enabled !== false}
                                type="checkbox"
                                onChange={(event) => updateField('enabled', event.target.checked)}
                            />
                            启用这个邮箱账号
                        </label>
                        <label className="checkbox-row">
                            <input
                                checked={Boolean(settings?.forwardingEnabled)}
                                type="checkbox"
                                onChange={(event) => updateField('forwardingEnabled', event.target.checked)}
                            />
                            启用转发
                        </label>
                        <label>
                            <span>转发到</span>
                            <input
                                disabled={!settings?.forwardingEnabled}
                                placeholder="name@example.com"
                                value={settings?.forwardTo || ''}
                                onChange={(event) => updateField('forwardTo', event.target.value)}
                            />
                        </label>
                        <label>
                            <span>保留策略</span>
                            <select
                                value={settings?.retention || 'forever'}
                                onChange={(event) => updateField('retention', event.target.value)}
                            >
                                <option value="forever">永久保留</option>
                                <option value="365d">保留 365 天</option>
                                <option value="90d">保留 90 天</option>
                                <option value="30d">保留 30 天</option>
                            </select>
                        </label>
                        <label>
                            <span>默认视图</span>
                            <select
                                value={settings?.defaultView || 'inbox'}
                                onChange={(event) => updateField('defaultView', event.target.value)}
                            >
                                <option value="inbox">收件箱</option>
                                <option value="starred">星标邮件</option>
                                <option value="sent">已发送</option>
                            </select>
                        </label>
                    </div>

                    <div className="settings-check-grid">
                        <label className="checkbox-row">
                            <input
                                checked={settings?.keepLocalCopy !== false}
                                type="checkbox"
                                onChange={(event) => updateField('keepLocalCopy', event.target.checked)}
                            />
                            转发后保留本地副本
                        </label>
                        <label className="checkbox-row">
                            <input
                                checked={settings?.saveAttachments !== false}
                                type="checkbox"
                                onChange={(event) => updateField('saveAttachments', event.target.checked)}
                            />
                            保存附件
                        </label>
                        <label className="checkbox-row">
                            <input
                                checked={settings?.showPreview !== false}
                                type="checkbox"
                                onChange={(event) => updateField('showPreview', event.target.checked)}
                            />
                            显示邮件预览
                        </label>
                    </div>

                    <label>
                        <span>签名</span>
                        <textarea
                            value={settings?.signature || ''}
                            onChange={(event) => updateField('signature', event.target.value)}
                        />
                    </label>

                    <div className="settings-mini-metrics">
                        <span>
                            <strong>{formatCount(settings?.rules?.length)}</strong>
                            <small>规则</small>
                        </span>
                        <span>
                            <strong>{formatCount(settings?.apiTokens?.length)}</strong>
                            <small>API Token</small>
                        </span>
                        <span>
                            <strong>{formatDateTime(settings?.lastActivity)}</strong>
                            <small>最后活动</small>
                        </span>
                    </div>

                    <footer>
                        <small>保存后会同步更新 Worker 里的账号状态。</small>
                        <button className="primary-action compact" type="submit" disabled={saving || !settings}>
                            <CircleCheck size={16} />
                            {saving ? '保存中' : '保存设置'}
                        </button>
                    </footer>
                </form>
            )}
        </section>
    );
}

function DNSHealthPanel({domain, onNotify, selectedProfile}) {
    const [domainInput, setDomainInput] = useState(domain || '');
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setDomainInput(domain || '');
        setHealth(null);
        setError('');
    }, [domain]);

    async function handleCheck(event) {
        event.preventDefault();
        const targetDomain = normalizeDomainInput(domainInput);
        if (!selectedProfile?.id || !targetDomain) {
            setError('请先选择或输入一个域名。');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await GetDomainDNSHealth({
                profileId: selectedProfile.id,
                domain: targetDomain
            });
            setHealth(result);
            onNotify?.(result?.ready ? 'success' : 'error', result?.ready ? 'DNS 已就绪' : 'DNS 仍需处理', targetDomain);
        } catch (checkError) {
            const message = checkError.message || '无法检查 DNS。';
            setError(message);
            onNotify?.('error', 'DNS 检查失败', message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="settings-panel">
            <SettingsPanelHeader
                action={health ? <StatusBadge ok={health.ready} label={health.ready ? '就绪' : '待处理'} /> : null}
                body="按当前接入点检查 MX、TXT、路由等域名记录是否满足收发要求。"
                icon={Globe2}
                kicker="域名"
                title="DNS 健康检查"
            />
            <form className="settings-inline-form" onSubmit={handleCheck}>
                <label>
                    <span>域名</span>
                    <input
                        placeholder="mail.example.com"
                        value={domainInput}
                        onChange={(event) => setDomainInput(event.target.value)}
                    />
                </label>
                <button type="submit" disabled={loading || !domainInput.trim()}>
                    <RefreshCw className={loading ? 'spin-inline' : ''} size={16} />
                    {loading ? '检查中' : '检查 DNS'}
                </button>
            </form>
            {error ? <p className="settings-error">{error}</p> : null}
            {health ? (
                <div className="dns-check-list">
                    {(health.checks || []).map((check) => (
                        <article className={check.ok ? 'ok' : ''} key={check.id || check.label}>
                            {check.ok ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
                            <div>
                                <strong>{check.label || check.id}</strong>
                                <small>{check.status || (check.ok ? '已通过' : check.hint || '需要检查')}</small>
                                {check.records?.length ? (
                                    <code>{check.records.join(' / ')}</code>
                                ) : null}
                            </div>
                        </article>
                    ))}
                </div>
            ) : null}
        </section>
    );
}

function DeviceManagerPanel({onNotify, selectedProfile}) {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [workingDevice, setWorkingDevice] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!selectedProfile?.id) {
            setDevices([]);
            return;
        }

        loadDevices({silent: true});
    }, [selectedProfile?.id]);

    async function loadDevices(options = {}) {
        if (!selectedProfile?.id) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await ListDevices({profileId: selectedProfile.id});
            setDevices(result || []);
            if (!options.silent) {
                onNotify?.('success', '设备 Token 已刷新', `${(result || []).length} 个设备`);
            }
        } catch (loadError) {
            const message = loadError.message || '无法读取设备列表。';
            setError(message);
            if (!options.silent) {
                onNotify?.('error', '读取设备失败', message);
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleToggleDevice(device) {
        if (!selectedProfile?.id || !device?.id) {
            return;
        }

        const enabled = device.enabled !== false && !device.revokedAt;
        setWorkingDevice(device.id);
        setError('');

        try {
            const updated = await UpdateDevice({
                profileId: selectedProfile.id,
                deviceId: device.id,
                clientType: device.clientType || 'desktop',
                label: device.label || 'API Client',
                scope: device.scope || 'read_write',
                enabled: !enabled
            });
            setDevices((current) => current.map((item) => item.id === updated.id ? updated : item));
            onNotify?.('success', !enabled ? '设备已启用' : '设备已停用', updated.label || updated.tokenPreview);
        } catch (updateError) {
            const message = updateError.message || '无法更新设备。';
            setError(message);
            onNotify?.('error', '更新设备失败', message);
        } finally {
            setWorkingDevice('');
        }
    }

    async function handleRevokeDevice(device) {
        if (!selectedProfile?.id || !device?.id || !window.confirm(`撤销设备「${device.label || device.tokenPreview || device.id}」？`)) {
            return;
        }

        setWorkingDevice(device.id);
        setError('');

        try {
            const revoked = await RevokeDevice({
                profileId: selectedProfile.id,
                deviceId: device.id
            });
            setDevices((current) => current.map((item) => item.id === revoked.id ? revoked : item));
            onNotify?.('success', '设备 Token 已撤销', revoked.label || revoked.id);
        } catch (revokeError) {
            const message = revokeError.message || '无法撤销设备。';
            setError(message);
            onNotify?.('error', '撤销设备失败', message);
        } finally {
            setWorkingDevice('');
        }
    }

    return (
        <section className="settings-panel">
            <SettingsPanelHeader
                action={(
                    <button type="button" onClick={() => loadDevices()} disabled={loading}>
                        <RefreshCw className={loading ? 'spin-inline' : ''} size={16} />
                        刷新
                    </button>
                )}
                body="每个接入点独立维护设备 Token，桌面端不会共享到其他 Base URL。"
                icon={ShieldCheck}
                kicker="设备"
                title="Device Token 管理"
            />
            {error ? <p className="settings-error">{error}</p> : null}
            {devices.length ? (
                <div className="settings-card-list">
                    {devices.map((device) => {
                        const enabled = device.enabled !== false && !device.revokedAt;

                        return (
                            <article className="settings-item-card" key={device.id}>
                                <div>
                                    <strong>{device.label || '未命名设备'}</strong>
                                    <small>{device.clientType || 'unknown'} · {device.scope || 'read_write'} · {device.tokenPreview || device.id}</small>
                                    <small>创建：{formatDateTime(device.createdAt)} · 最近使用：{formatDateTime(device.lastSeenAt)}</small>
                                </div>
                                <div className="settings-item-actions">
                                    <StatusBadge ok={enabled} label={enabled ? '启用' : '已停用'} />
                                    <button type="button" onClick={() => handleToggleDevice(device)} disabled={workingDevice === device.id}>
                                        {enabled ? '停用' : '启用'}
                                    </button>
                                    <button className="danger" type="button" onClick={() => handleRevokeDevice(device)} disabled={workingDevice === device.id || !enabled}>
                                        <Trash2 size={15} />
                                        撤销
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <p className="insight-empty">{loading ? '正在读取设备 Token。' : '当前接入点还没有可展示的设备 Token。'}</p>
            )}
        </section>
    );
}

function MaintenancePanel({onNotify, selectedProfile}) {
    const [retentionDays, setRetentionDays] = useState(90);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState('');
    const [error, setError] = useState('');
    const hasAdminSession = Boolean(selectedProfile?.hasAdminSession);

    async function handleCleanup(dryRun) {
        if (!selectedProfile?.id) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先到“安全”分组授权当前接入点管理员会话。');
            return;
        }

        const days = Math.min(Math.max(Number(retentionDays) || 90, 1), 3650);
        if (!dryRun && !window.confirm(`确认清理 ${days} 天前已删除的数据？`)) {
            return;
        }

        setLoading(dryRun ? 'preview' : 'cleanup');
        setError('');

        try {
            const cleanup = await RunSystemCleanup({
                profileId: selectedProfile.id,
                retentionDays: days,
                dryRun
            });
            setResult(cleanup);
            onNotify?.('success', dryRun ? '清理预览完成' : '系统清理完成', `邮件 ${formatCount(cleanup.messages)}，附件 ${formatCount(cleanup.attachments)}`);
        } catch (cleanupError) {
            const message = cleanupError.message || '当前接入点管理员会话可能已失效。';
            setError(message);
            onNotify?.('error', '系统清理失败', message);
        } finally {
            setLoading('');
        }
    }

    return (
        <section className="settings-panel">
            <SettingsPanelHeader
                action={<StatusBadge ok={hasAdminSession} label={hasAdminSession ? '管理员已授权' : '需要授权'} />}
                body="清理接口要求当前接入点管理员会话；设备 Token 只负责邮箱接入。"
                icon={Database}
                kicker="维护"
                title="系统清理"
            />
            <div className="settings-inline-form">
                <label>
                    <span>保留天数</span>
                    <input
                        disabled={!hasAdminSession}
                        max="3650"
                        min="1"
                        type="number"
                        value={retentionDays}
                        onChange={(event) => setRetentionDays(event.target.value)}
                    />
                </label>
                <button type="button" onClick={() => handleCleanup(true)} disabled={!hasAdminSession || Boolean(loading)}>
                    <Eye size={16} />
                    {loading === 'preview' ? '预览中' : '预览'}
                </button>
                <button className="danger" type="button" onClick={() => handleCleanup(false)} disabled={!hasAdminSession || Boolean(loading)}>
                    <Trash2 size={16} />
                    {loading === 'cleanup' ? '清理中' : '执行清理'}
                </button>
            </div>
            {error ? <p className="settings-error">{error}</p> : null}
            {result ? (
                <div className="settings-mini-metrics">
                    <span>
                        <strong>{formatCount(result.messages)}</strong>
                        <small>邮件</small>
                    </span>
                    <span>
                        <strong>{formatCount(result.attachments)}</strong>
                        <small>附件</small>
                    </span>
                    <span>
                        <strong>{formatCount(result.accounts)}</strong>
                        <small>账号</small>
                    </span>
                    <span>
                        <strong>{formatDateTime(result.cutoff)}</strong>
                        <small>清理边界</small>
                    </span>
                </div>
            ) : null}
        </section>
    );
}

function SecurityPanel({onNotify, onProfileUpdate, selectedProfile}) {
    const [adminForm, setAdminForm] = useState(emptyAdminSessionForm);
    const [users, setUsers] = useState([]);
    const [userForm, setUserForm] = useState(emptyUserForm);
    const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
    const [loading, setLoading] = useState('');
    const [error, setError] = useState('');
    const hasAdminSession = Boolean(selectedProfile?.hasAdminSession);

    async function handleAdminLogin(event) {
        event.preventDefault();
        if (!selectedProfile?.id) {
            return;
        }

        if (!adminForm.email.includes('@') || !adminForm.password) {
            setError('请输入当前接入点的管理员邮箱和密码。');
            return;
        }

        setLoading('admin-login');
        setError('');

        try {
            const profile = await AuthorizeAdminSession({
                profileId: selectedProfile.id,
                email: adminForm.email,
                password: adminForm.password,
                setup: adminForm.setup
            });
            onProfileUpdate?.(profile);
            setAdminForm(emptyAdminSessionForm);
            onNotify?.('success', '当前接入点管理员已授权', profile.adminEmail || profile.baseUrl);
        } catch (loginError) {
            const message = loginError.message || '请检查当前接入点管理员账号密码。';
            setError(message);
            onNotify?.('error', '管理员授权失败', message);
        } finally {
            setLoading('');
        }
    }

    async function handleClearAdmin() {
        if (!selectedProfile?.id || !window.confirm('退出当前接入点的管理员会话？')) {
            return;
        }

        setLoading('admin-clear');
        setError('');

        try {
            const profile = await ClearAdminSession({profileId: selectedProfile.id});
            onProfileUpdate?.(profile);
            setUsers([]);
            onNotify?.('success', '管理员会话已退出', profile.baseUrl);
        } catch (clearError) {
            const message = clearError.message || '无法清除当前接入点管理员会话。';
            setError(message);
            onNotify?.('error', '退出管理员会话失败', message);
        } finally {
            setLoading('');
        }
    }

    async function loadUsers() {
        if (!selectedProfile?.id) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先授权当前接入点管理员会话。');
            return;
        }

        setLoading('users');
        setError('');

        try {
            const result = await ListUsers({profileId: selectedProfile.id});
            setUsers(result || []);
            onNotify?.('success', '管理员用户已刷新', `${(result || []).length} 个用户`);
        } catch (usersError) {
            const message = usersError.message || '当前接入点管理员会话无法读取用户。';
            setError(message);
            onNotify?.('error', '读取管理员用户失败', message);
        } finally {
            setLoading('');
        }
    }

    async function handleCreateUser(event) {
        event.preventDefault();
        if (!selectedProfile?.id) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先授权当前接入点管理员会话。');
            return;
        }

        if (!userForm.email.includes('@') || userForm.password.length < 8) {
            setError('请输入有效邮箱，密码至少 8 位。');
            return;
        }

        setLoading('create-user');
        setError('');

        try {
            const created = await CreateUser({
                profileId: selectedProfile.id,
                email: userForm.email,
                password: userForm.password,
                displayName: userForm.displayName,
                avatarColor: userForm.avatarColor
            });
            setUsers((current) => [...current, created]);
            setUserForm(emptyUserForm);
            onNotify?.('success', '管理员用户已创建', created.email);
        } catch (createError) {
            const message = createError.message || '当前接入点管理员会话没有创建用户权限。';
            setError(message);
            onNotify?.('error', '创建用户失败', message);
        } finally {
            setLoading('');
        }
    }

    async function handleToggleUser(user) {
        if (!selectedProfile?.id || !user?.id) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先授权当前接入点管理员会话。');
            return;
        }

        setLoading(`user-${user.id}`);
        setError('');

        try {
            const updated = await UpdateUser({
                profileId: selectedProfile.id,
                userId: user.id,
                displayName: user.displayName || '',
                avatarColor: user.avatarColor || '#dbe7ff',
                enabled: !user.enabled
            });
            setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
            onNotify?.('success', updated.enabled ? '用户已启用' : '用户已停用', updated.email);
        } catch (updateError) {
            const message = updateError.message || '无法更新用户。';
            setError(message);
            onNotify?.('error', '更新用户失败', message);
        } finally {
            setLoading('');
        }
    }

    async function handleChangePassword(event) {
        event.preventDefault();
        if (!selectedProfile?.id) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先授权当前接入点管理员会话。');
            return;
        }

        setLoading('password');
        setError('');

        try {
            await ChangePassword({
                profileId: selectedProfile.id,
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            setPasswordForm(emptyPasswordForm);
            onNotify?.('success', '密码已修改');
        } catch (passwordError) {
            const message = passwordError.message || '当前接入点管理员会话无法修改密码。';
            setError(message);
            onNotify?.('error', '修改密码失败', message);
        } finally {
            setLoading('');
        }
    }

    async function handleRevokeSessions() {
        if (!selectedProfile?.id || !window.confirm('撤销当前管理员用户的其他会话？')) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先授权当前接入点管理员会话。');
            return;
        }

        setLoading('sessions');
        setError('');

        try {
            await RevokeSessions({profileId: selectedProfile.id});
            onNotify?.('success', '其他会话已撤销');
        } catch (sessionsError) {
            const message = sessionsError.message || '当前接入点管理员会话无法撤销会话。';
            setError(message);
            onNotify?.('error', '撤销会话失败', message);
        } finally {
            setLoading('');
        }
    }

    return (
        <section className="settings-panel settings-panel-wide">
            <SettingsPanelHeader
                action={(
                    <button type="button" onClick={loadUsers} disabled={!hasAdminSession || loading === 'users'}>
                        <RefreshCw className={loading === 'users' ? 'spin-inline' : ''} size={16} />
                        读取用户
                    </button>
                )}
                body="管理员会话只保存到当前接入点，不作为桌面端全局登录，也不会共享到其他 Base URL。"
                icon={KeyRound}
                kicker="安全"
                title="管理员用户与会话"
            />
            {error ? <p className="settings-error">{error}</p> : null}
            <form className="admin-session-card" onSubmit={handleAdminLogin}>
                <div>
                    <strong>当前接入点管理员会话</strong>
                    <small>
                        {hasAdminSession
                            ? `${selectedProfile.adminEmail || selectedProfile.adminTokenPreview || '已授权'} · 仅用于 ${selectedProfile.baseUrl}`
                            : '授权后可执行系统清理、用户管理、改密和撤销会话。'}
                    </small>
                </div>
                <StatusBadge ok={hasAdminSession} label={hasAdminSession ? '已授权' : '未授权'} />
                <label>
                    <span>管理员邮箱</span>
                    <input
                        disabled={loading === 'admin-login'}
                        placeholder="admin@example.com"
                        value={adminForm.email}
                        onChange={(event) => setAdminForm((current) => ({...current, email: event.target.value}))}
                    />
                </label>
                <label>
                    <span>管理员密码</span>
                    <input
                        disabled={loading === 'admin-login'}
                        type="password"
                        value={adminForm.password}
                        onChange={(event) => setAdminForm((current) => ({...current, password: event.target.value}))}
                    />
                </label>
                <label className="checkbox-row">
                    <input
                        checked={adminForm.setup}
                        type="checkbox"
                        onChange={(event) => setAdminForm((current) => ({...current, setup: event.target.checked}))}
                    />
                    初始化管理员
                </label>
                <div className="settings-inline-actions">
                    <button className="primary-action compact" type="submit" disabled={loading === 'admin-login'}>
                        <KeyRound size={16} />
                        {loading === 'admin-login' ? '授权中' : hasAdminSession ? '重新授权' : '授权当前接入点'}
                    </button>
                    <button type="button" onClick={handleClearAdmin} disabled={!hasAdminSession || loading === 'admin-clear'}>
                        <Power size={16} />
                        退出会话
                    </button>
                </div>
            </form>
            <div className="security-grid">
                <form className="settings-form" onSubmit={handleCreateUser}>
                    <h4>创建管理员</h4>
                    <label>
                        <span>邮箱</span>
                        <input
                            placeholder="admin@example.com"
                            disabled={!hasAdminSession}
                            value={userForm.email}
                            onChange={(event) => setUserForm((current) => ({...current, email: event.target.value}))}
                        />
                    </label>
                    <label>
                        <span>密码</span>
                        <input
                            disabled={!hasAdminSession}
                            minLength={8}
                            type="password"
                            value={userForm.password}
                            onChange={(event) => setUserForm((current) => ({...current, password: event.target.value}))}
                        />
                    </label>
                    <label>
                        <span>显示名称</span>
                        <input
                            disabled={!hasAdminSession}
                            value={userForm.displayName}
                            onChange={(event) => setUserForm((current) => ({...current, displayName: event.target.value}))}
                        />
                    </label>
                    <button type="submit" disabled={!hasAdminSession || loading === 'create-user'}>
                        <Plus size={16} />
                        {loading === 'create-user' ? '创建中' : '创建用户'}
                    </button>
                </form>

                <form className="settings-form" onSubmit={handleChangePassword}>
                    <h4>密码与会话</h4>
                    <label>
                        <span>当前密码</span>
                        <input
                            disabled={!hasAdminSession}
                            type="password"
                            value={passwordForm.currentPassword}
                            onChange={(event) => setPasswordForm((current) => ({...current, currentPassword: event.target.value}))}
                        />
                    </label>
                    <label>
                        <span>新密码</span>
                        <input
                            disabled={!hasAdminSession}
                            minLength={8}
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(event) => setPasswordForm((current) => ({...current, newPassword: event.target.value}))}
                        />
                    </label>
                    <div className="settings-inline-actions">
                        <button type="submit" disabled={!hasAdminSession || loading === 'password'}>
                            <KeyRound size={16} />
                            修改密码
                        </button>
                        <button type="button" onClick={handleRevokeSessions} disabled={!hasAdminSession || loading === 'sessions'}>
                            <Power size={16} />
                            撤销会话
                        </button>
                    </div>
                </form>
            </div>

            {users.length ? (
                <div className="settings-card-list">
                    {users.map((user) => (
                        <article className="settings-item-card" key={user.id}>
                            <div>
                                <strong>{user.displayName || user.email}</strong>
                                <small>{user.email} · {user.role || 'admin'} · 登录：{formatDateTime(user.lastLoginAt)}</small>
                            </div>
                            <div className="settings-item-actions">
                                <StatusBadge ok={user.enabled !== false} label={user.enabled !== false ? '启用' : '停用'} />
                                <button type="button" onClick={() => handleToggleUser(user)} disabled={!hasAdminSession || loading === `user-${user.id}`}>
                                    {user.enabled !== false ? '停用' : '启用'}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <p className="insight-empty">{hasAdminSession ? '点击“读取用户”后显示当前接入点的管理员用户。' : '先授权当前接入点管理员会话，再管理用户、密码和会话。'}</p>
            )}
        </section>
    );
}

function DiagnosticsPanel({diagnostics}) {
    const bindings = diagnostics.bindings || {};
    const counts = diagnostics.counts || {};
    const setup = diagnostics.setup || {};
    const latest = diagnostics.latest || {};
    const domains = diagnostics.configuredDomains || [];
    const stats = [
        {label: '域名', value: counts.domains},
        {label: '邮箱账号', value: counts.accounts},
        {label: '邮件', value: counts.messages},
        {label: '未读', value: counts.unreadMessages},
        {label: '附件', value: counts.attachments},
        {label: '设备 Token', value: counts.devices}
    ];
    const bindingItems = [
        {label: 'D1 数据库', ok: bindings.d1},
        {label: 'R2 附件桶', ok: bindings.r2},
        {label: '静态资源', ok: bindings.assets},
        {label: 'JWT_SECRET', ok: bindings.jwtSecret}
    ];

    return (
        <section className="insight-panel" aria-label="系统诊断详情">
            <header>
                <div>
                    <p>当前接入点诊断</p>
                    <h3>{diagnostics.service || 'omnimail'} · {diagnostics.storage || 'unknown'}</h3>
                    <small>生成时间：{formatDateTime(diagnostics.generatedAt)}</small>
                </div>
                <StatusBadge ok={Boolean(setup.ready)} label={setup.ready ? '必需项就绪' : '需要配置'} />
            </header>

            <div className="insight-metrics">
                {stats.map((item) => (
                    <span key={item.label}>
                        <strong>{formatCount(item.value)}</strong>
                        <small>{item.label}</small>
                    </span>
                ))}
            </div>

            <div className="insight-columns">
                <section>
                    <div className="insight-section-title">
                        <Database size={16} />
                        <h4>绑定状态</h4>
                    </div>
                    <div className="diagnostic-list">
                        {bindingItems.map((item) => (
                            <span className={item.ok ? 'ok' : ''} key={item.label}>
                                {item.ok ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
                                {item.label}
                            </span>
                        ))}
                    </div>
                    <p className="insight-muted">
                        {domains.length ? `配置域名：${domains.join('，')}` : '尚未读取到配置域名。'}
                    </p>
                </section>

                <section>
                    <div className="insight-section-title">
                        <ListChecks size={16} />
                        <h4>部署进度</h4>
                    </div>
                    <div className="diagnostic-step-list">
                        {(setup.steps || []).map((step) => (
                            <article className={`diagnostic-step ${step.complete ? 'complete' : ''}`} key={step.id}>
                                {step.complete ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
                                <span>
                                    <strong>{step.label}{step.required ? '' : ' · 可选'}</strong>
                                    <small>{step.complete ? '已完成' : step.hint}</small>
                                </span>
                            </article>
                        ))}
                    </div>
                </section>
            </div>

            <div className="diagnostic-latest">
                <p>
                    <strong>最新来信</strong>
                    <span>
                        {latest.inbound
                            ? `${latest.inbound.subject || '无主题'} · ${latest.inbound.fromEmail || latest.inbound.accountAddress || '未知发件人'} · ${formatDateTime(latest.inbound.receivedAt)}`
                            : '暂无来信记录'}
                    </span>
                </p>
                <p>
                    <strong>最新审计</strong>
                    <span>
                        {latest.audit
                            ? `${formatAuditAction(latest.audit.action)} · ${formatDateTime(latest.audit.createdAt)}`
                            : '暂无审计记录'}
                    </span>
                </p>
            </div>
        </section>
    );
}

function AuditLogPanel({logs}) {
    return (
        <section className="insight-panel" aria-label="最近审计日志">
            <header>
                <div>
                    <p>最近审计日志</p>
                    <h3>当前接入点活动记录</h3>
                </div>
                <StatusBadge ok={logs.length > 0} label={logs.length ? `${logs.length} 条` : '暂无'} />
            </header>

            {logs.length ? (
                <div className="audit-log-list">
                    {logs.map((log) => {
                        const actor = log.actorEmail || log.actorId || '系统';
                        const resource = [log.resourceType, log.resourceId].filter(Boolean).join(' · ');
                        const metadata = metadataSummary(log.metadata);

                        return (
                            <article className="audit-log-item" key={log.id}>
                                <div>
                                    <strong>{formatAuditAction(log.action)}</strong>
                                    <small>{log.summary || resource || '无摘要'}</small>
                                </div>
                                <dl>
                                    <div>
                                        <dt>操作者</dt>
                                        <dd>{actor}</dd>
                                    </div>
                                    <div>
                                        <dt>时间</dt>
                                        <dd>{formatDateTime(log.createdAt)}</dd>
                                    </div>
                                    {resource ? (
                                        <div>
                                            <dt>资源</dt>
                                            <dd>{resource}</dd>
                                        </div>
                                    ) : null}
                                    {metadata ? (
                                        <div>
                                            <dt>元数据</dt>
                                            <dd>{metadata}</dd>
                                        </div>
                                    ) : null}
                                </dl>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <p className="insight-empty">当前接入点还没有可展示的审计日志。</p>
            )}
        </section>
    );
}

function SettingRow({action, body, icon: Icon, title}) {
    return (
        <section className="setting-row">
            <Icon size={18} />
            <span>
                <strong>{title}</strong>
                <small>{body}</small>
            </span>
            {action}
        </section>
    );
}

function ContextMenu({contextMenu, onArchive, onClose, onDelete, onSetStatus}) {
    const message = contextMenu.message;
    const unread = isUnreadMessage(message);
    const starred = isStarredMessage(message);

    return (
        <div
            className="context-menu"
            style={{left: contextMenu.x, top: contextMenu.y}}
            role="menu"
            onClick={(event) => event.stopPropagation()}
        >
            {message.direction !== 'outbound' ? (
                <button type="button" onClick={() => { onSetStatus(message, {read: unread}); onClose(); }}>
                    {unread ? <MailOpen size={15} /> : <Mail size={15} />}
                    {unread ? '标记已读' : '标记未读'}
                </button>
            ) : null}
            <button type="button" onClick={() => { onSetStatus(message, {starred: !starred}); onClose(); }}>
                <Star size={15} fill={starred ? 'currentColor' : 'none'} />
                {starred ? '取消星标' : '添加星标'}
            </button>
            <button type="button" onClick={() => { onArchive(message); onClose(); }}>
                {message.archivedAt ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                {message.archivedAt ? '取消归档' : '归档'}
            </button>
            <button className="danger" type="button" onClick={() => { onDelete(message); onClose(); }}>
                <Trash2 size={15} />
                删除
            </button>
        </div>
    );
}

function Toast({onClose, toast}) {
    if (!toast) {
        return null;
    }

    const Icon = toast.type === 'error' ? CircleAlert : CircleCheck;

    return (
        <div className={`toast ${toast.type}`} role="status">
            <Icon size={18} />
            <span>
                <strong>{toast.title}</strong>
                {toast.message ? <small>{toast.message}</small> : null}
            </span>
            <IconButton icon={X} label="关闭通知" onClick={onClose} />
        </div>
    );
}

function EmptyState({action, body, icon: Icon, title}) {
    return (
        <section className="empty-state">
            <Icon size={26} />
            <h3>{title}</h3>
            <p>{body}</p>
            {action ? <div className="empty-state-action">{action}</div> : null}
        </section>
    );
}

function LoadingList() {
    return (
        <div className="loading-list" aria-label="加载中">
            {Array.from({length: 7}).map((_, index) => (
                <div className="skeleton-row" key={index}>
                    <span />
                    <strong />
                    <em />
                </div>
            ))}
        </div>
    );
}

function ReadingSkeleton() {
    return (
        <div className="reading-view">
            <div className="reading-skeleton">
                <span />
                <strong />
                <p />
                <p />
                <p />
            </div>
        </div>
    );
}

function NavItem({active, count, icon: Icon, label, onClick}) {
    return (
        <button className={`nav-item ${active ? 'active' : ''}`} type="button" onClick={onClick}>
            <Icon size={17} />
            <span>{label}</span>
            <small>{count}</small>
        </button>
    );
}

function SectionLabel({children}) {
    return <p className="section-label">{children}</p>;
}

function SidebarNotice({actionLabel, detail, onAction, title}) {
    return (
        <div className="sidebar-notice">
            <strong>{title}</strong>
            <small>{detail}</small>
            {actionLabel && onAction ? (
                <button type="button" onClick={onAction}>
                    {actionLabel}
                </button>
            ) : null}
        </div>
    );
}

function MutedLine({children}) {
    return <p className="muted-line">{children}</p>;
}

function StatusBadge({label, ok}) {
    return <span className={`status-badge ${ok ? 'ok' : ''}`}>{label}</span>;
}

function IconButton({active = false, disabled, icon: Icon, label, onClick, spinning, tone = 'default'}) {
    return (
        <button
            className={`icon-button ${tone} ${active ? 'active' : ''} ${spinning ? 'spinning' : ''}`}
            type="button"
            aria-label={label}
            aria-pressed={active || undefined}
            title={label}
            onClick={onClick}
            disabled={disabled}
        >
            <Icon size={17} fill={active ? 'currentColor' : 'none'} />
        </button>
    );
}

export default App;
