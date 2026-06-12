import {useEffect, useMemo, useRef, useState} from 'react';
import {
    Archive,
    ArchiveRestore,
    CircleAlert,
    CircleCheck,
    Download,
    FileText,
    Inbox,
    KeyRound,
    Mail,
    MailPlus,
    Maximize2,
    Minus,
    Moon,
    MoreHorizontal,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    RefreshCw,
    Search,
    Send,
    Settings,
    ShieldCheck,
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
    AuthorizeProfile,
    DeleteMessage,
    DeleteProfile,
    DownloadAttachment,
    GetInitialState,
    LoadMailbox,
    SaveProfile,
    SaveProfileToken,
    SelectProfile,
    SendMessage,
    TestBaseURL,
    UnarchiveMessage
} from '../wailsjs/go/main/App';

const emptyProfileForm = {id: '', name: '', baseUrl: ''};
const emptyAuthForm = {email: '', password: '', deviceLabel: 'Windows 桌面端', setup: false};
const emptyComposeForm = {to: '', cc: '', bcc: '', subject: '', text: ''};
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

function composeHasContent(form) {
    return Object.values(form || {}).some((value) => String(value || '').trim());
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

function App() {
    const [profiles, setProfiles] = useState([]);
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [profileForm, setProfileForm] = useState(emptyProfileForm);
    const [authForm, setAuthForm] = useState(emptyAuthForm);
    const [composeForm, setComposeForm] = useState(emptyComposeForm);
    const [composeOptionsOpen, setComposeOptionsOpen] = useState(false);
    const [hasSavedDraft, setHasSavedDraft] = useState(false);
    const [manualToken, setManualToken] = useState('');
    const [status, setStatus] = useState(null);
    const [storagePath, setStoragePath] = useState('');
    const [workspace, setWorkspace] = useState(null);
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
    const [modal, setModal] = useState(null);
    const [composerOpen, setComposerOpen] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const searchInputRef = useRef(null);

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

            const nextSelected = state.selectedProfileId || nextProfiles[0]?.id || '';
            setSelectedProfileId(nextSelected);

            const profile = nextProfiles.find((item) => item.id === nextSelected);
            if (profile?.hasToken) {
                await loadMailbox({profileId: profile.id});
            }
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
            setProfileForm(emptyProfileForm);
            setWorkspace(null);
            setModal(null);
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
        setStatus(null);
        setWorkspace(null);
        setContextMenu(null);
        await SelectProfile(profile.id).catch(() => null);

        if (profile.hasToken) {
            await loadMailbox({profileId: profile.id});
        } else {
            await testConnection(profile.baseUrl, '');
            setModal('auth');
        }
    }

    function handleAddProfile() {
        setProfileForm(emptyProfileForm);
        setProfileMenuOpen(false);
        setModal('profile');
    }

    function handleOpenProfileManager() {
        setProfileMenuOpen(false);
        setModal('profiles');
    }

    async function handleOpenAuth(profile = selectedProfile) {
        if (!profile) {
            return;
        }

        setSelectedProfileId(profile.id);
        setWorkspace(null);
        setStatus(null);
        setContextMenu(null);
        setProfileMenuOpen(false);
        await SelectProfile(profile.id).catch(() => null);
        setModal('auth');
    }

    async function handleTestProfile(profile) {
        if (!profile) {
            return;
        }

        await testConnection(profile.baseUrl, '');
    }

    function handleEditProfile(profile) {
        setProfileForm({id: profile.id, name: profile.name, baseUrl: profile.baseUrl});
        setProfileMenuOpen(false);
        setModal('profile');
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
            setModal(null);
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
            setModal(null);
            await loadMailbox({profileId: profile.id});
            showToast('success', 'Token 已保存', '该 Token 仅用于当前接入点。');
        } catch (tokenError) {
            showToast('error', '保存 Token 失败', tokenError.message || 'Token 不能为空。');
        } finally {
            setBusy('');
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

    function openContextMenu(event, message) {
        event.preventDefault();
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            message
        });
    }

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
                    onAddProfile={handleAddProfile}
                    onAuth={() => handleOpenAuth(selectedProfile)}
                    onDeleteProfile={handleDeleteProfile}
                    onDomainChange={(domain) => loadMailbox({profileId: selectedProfile?.id, domain})}
                    onEditProfile={handleEditProfile}
                    onFolderChange={setActiveFolder}
                    onManageProfiles={handleOpenProfileManager}
                    onCompose={() => setComposerOpen(true)}
                    onProfileSelect={handleSelectProfile}
                    onToggle={() => setSidebarCollapsed((value) => !value)}
                    profiles={profiles}
                    profileMenuOpen={profileMenuOpen}
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
                                onOpenSettings={() => setModal('settings')}
                                onReload={reloadCurrentMailbox}
                                selectedMessage={selectedMessage}
                                selectedProfile={selectedProfile}
                            />

                            <ReadingView
                                busy={busy}
                                message={selectedMessage}
                                onArchive={handleArchiveMessage}
                                onDelete={handleDeleteMessage}
                                onDownload={handleDownloadAttachment}
                                selectedProfile={selectedProfile}
                            />
                        </>
                    )}
                </main>

                {modal === 'profile' ? (
                    <ProfileModal
                        busy={busy}
                        form={profileForm}
                        onChange={setProfileForm}
                        onClose={() => setModal(null)}
                        onSubmit={handleProfileSubmit}
                    />
                ) : null}

                {modal === 'auth' && selectedProfile ? (
                    <AuthModal
                        authForm={authForm}
                        busy={busy}
                        manualToken={manualToken}
                        onAuthFormChange={setAuthForm}
                        onClose={() => setModal(null)}
                        onManualToken={handleManualToken}
                        onManualTokenChange={setManualToken}
                        onSubmit={handleAuthorize}
                        profile={selectedProfile}
                    />
                ) : null}

                {modal === 'settings' ? (
                    <SettingsModal
                        canClearCurrentDraft={canClearCurrentDraft}
                        onClose={() => setModal(null)}
                        onClearCurrentDraft={clearCurrentDraft}
                        selectedProfile={selectedProfile}
                        status={status}
                        storagePath={storagePath}
                        theme={theme}
                        onOpenProfiles={handleOpenProfileManager}
                        onResetLayout={resetLayoutPreferences}
                        toggleTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
                    />
                ) : null}

                {modal === 'profiles' ? (
                    <EndpointManagerModal
                        busy={busy}
                        onAddProfile={handleAddProfile}
                        onAuth={handleOpenAuth}
                        onClose={() => setModal(null)}
                        onDeleteProfile={handleDeleteProfile}
                        onEditProfile={handleEditProfile}
                        onProfileSelect={handleSelectProfile}
                        onTestProfile={handleTestProfile}
                        profiles={profiles}
                        selectedProfileId={selectedProfileId}
                        status={status}
                    />
                ) : null}

                {contextMenu ? (
                    <ContextMenu
                        contextMenu={contextMenu}
                        onArchive={handleArchiveMessage}
                        onClose={() => setContextMenu(null)}
                        onDelete={handleDeleteMessage}
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
    onAddProfile,
    onAuth,
    onCompose,
    onDeleteProfile,
    onDomainChange,
    onEditProfile,
    onFolderChange,
    onManageProfiles,
    onProfileSelect,
    onToggle,
    profiles,
    profileMenuOpen,
    selectedProfile,
    selectedProfileId,
    setProfileMenuOpen,
    status,
    theme,
    toggleTheme,
    workspace
}) {
    return (
        <aside className="sidebar" aria-label="邮箱导航">
            <div className="sidebar-top">
                <div className="workspace-heading" title="OmniMail Desktop">
                    <strong>OmniMail</strong>
                    <small>AI-native 邮箱工作台</small>
                </div>
                <IconButton
                    icon={collapsed ? PanelLeftOpen : PanelLeftClose}
                    label={collapsed ? '展开侧栏' : '收起侧栏'}
                    onClick={onToggle}
                />
            </div>

            <button className="compose-primary" type="button" onClick={onCompose}>
                <MailPlus size={17} />
                <span>写邮件</span>
            </button>

            <nav className="nav-section" aria-label="文件夹">
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

            <div className="nav-section">
                <SectionLabel>域名</SectionLabel>
                {(workspace?.domains || []).map((domain) => (
                    <button
                        className={`domain-item ${domain === workspace?.selectedDomain ? 'active' : ''}`}
                        key={domain}
                        type="button"
                        onClick={() => onDomainChange(domain)}
                    >
                        <span>{domain}</span>
                    </button>
                ))}
                {!workspace?.domains?.length ? <MutedLine>暂无域名</MutedLine> : null}
            </div>

            <div className="nav-section accounts-section">
                <SectionLabel>邮箱账号</SectionLabel>
                {(workspace?.accounts || []).map((account) => (
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
                {!workspace?.accounts?.length ? <MutedLine>暂无邮箱账号</MutedLine> : null}
            </div>

            <div className="nav-section endpoint-section">
                <div className="section-row">
                    <SectionLabel>接入点</SectionLabel>
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
                        title={selectedProfile ? '这里还没有邮件' : '先添加一个接入点'}
                        body={selectedProfile ? '切换文件夹、搜索词或等待新的邮件进入。' : '添加 OmniMail Worker Base URL 后即可加载邮箱。'}
                    />
                )}
            </div>
        </section>
    );
}

function EmailListItem({message, onContextMenu, onSelect, selected}) {
    const unread = Boolean(message.unread);

    return (
        <button
            className={`mail-row ${selected ? 'selected' : ''}`}
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
                    <time>{formatMessageTime(message.time)}</time>
                </span>
                <span className="mail-row-subject">{message.subject || '无主题'}</span>
                <span className="mail-row-preview">{message.preview || message.body || '无预览内容'}</span>
            </span>
        </button>
    );
}

function ReaderToolbar({busy, onArchive, onDelete, onOpenSettings, onReload, selectedMessage, selectedProfile}) {
    return (
        <header className="reader-toolbar">
            <div>
                <p>{selectedProfile?.baseUrl || '未选择接入点'}</p>
                <h2>{selectedMessage?.subject || '阅读区'}</h2>
            </div>
            <div className="toolbar-actions">
                <IconButton icon={RefreshCw} label="刷新" onClick={onReload} disabled={!selectedProfile || busy === 'mailbox'} spinning={busy === 'mailbox'} />
                <IconButton icon={selectedMessage?.archivedAt ? ArchiveRestore : Archive} label={selectedMessage?.archivedAt ? '取消归档' : '归档'} onClick={onArchive} disabled={!selectedMessage || busy === 'message-action'} />
                <IconButton icon={Trash2} label="删除" onClick={onDelete} disabled={!selectedMessage || busy === 'message-action'} tone="danger" />
                <IconButton icon={Settings} label="设置" onClick={onOpenSettings} />
            </div>
        </header>
    );
}

function ReadingView({busy, message, onArchive, onDelete, onDownload, selectedProfile}) {
    const [detailsExpanded, setDetailsExpanded] = useState(false);

    useEffect(() => {
        setDetailsExpanded(false);
    }, [message?.id]);

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
                        </p>
                    </div>
                    <div className="message-inline-actions">
                        <button className="metadata-toggle" type="button" onClick={() => setDetailsExpanded((value) => !value)}>
                            {detailsExpanded ? '隐藏详情' : '查看详情'}
                        </button>
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
                                {message.deletedAt ? '已删除' : message.archivedAt ? `已归档：${message.archivedAt}` : '收件箱'}
                            </dd>
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
                                    <button
                                        type="button"
                                        onClick={() => onDownload(attachment)}
                                        disabled={!attachment.downloadable || busy === 'download'}
                                        title={attachment.downloadable ? '保存附件' : '附件内容未存储'}
                                        aria-label={attachment.downloadable ? `保存附件 ${filename}` : `${filename} 不可下载`}
                                    >
                                        <Download size={16} />
                                    </button>
                                </article>
                            );
                        })}
                    </div>
                ) : null}
            </section>
        </article>
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

function ProfileModal({busy, form, onChange, onClose, onSubmit}) {
    return (
        <Modal title={form.id ? '编辑接入点' : '添加接入点'} onClose={onClose}>
            <form className="modal-form" onSubmit={onSubmit}>
                <label>
                    <span>名称</span>
                    <input
                        value={form.name}
                        onChange={(event) => onChange({...form, name: event.target.value})}
                        placeholder="例如：主站邮箱"
                    />
                </label>
                <label>
                    <span>Base URL</span>
                    <input
                        value={form.baseUrl}
                        onChange={(event) => onChange({...form, baseUrl: event.target.value})}
                        placeholder="https://mail.example.com"
                        required
                    />
                </label>
                <footer>
                    <button type="button" onClick={onClose}>取消</button>
                    <button className="primary-action" type="submit" disabled={busy === 'profile'}>
                        保存接入点
                    </button>
                </footer>
            </form>
        </Modal>
    );
}

function AuthModal({
    authForm,
    busy,
    manualToken,
    onAuthFormChange,
    onClose,
    onManualToken,
    onManualTokenChange,
    onSubmit,
    profile
}) {
    return (
        <Modal title="授权桌面端" onClose={onClose}>
            <div className="auth-modal-grid">
                <form className="modal-form" onSubmit={onSubmit}>
                    <p className="modal-note">接入点：{profile.baseUrl}</p>
                    <p className="modal-note">授权只绑定当前接入点，不会作为全局账号使用。</p>
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

                <form className="modal-form" onSubmit={onManualToken}>
                    <p className="modal-note">也可以粘贴 Web 端生成的 device token。</p>
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
        </Modal>
    );
}

function EndpointManagerModal({
    busy,
    onAddProfile,
    onAuth,
    onClose,
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
        <Modal title="接入点管理" onClose={onClose} wide>
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
        </Modal>
    );
}

function SettingsModal({
    canClearCurrentDraft,
    onClearCurrentDraft,
    onClose,
    onOpenProfiles,
    onResetLayout,
    selectedProfile,
    status,
    storagePath,
    theme,
    toggleTheme
}) {
    return (
        <Modal title="设置" onClose={onClose}>
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
                    body="Windows 下使用 DPAPI 按接入点分别保护本地设备 Token。"
                    action={<StatusBadge ok label="已启用" />}
                />
            </div>
        </Modal>
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

function ContextMenu({contextMenu, onArchive, onClose, onDelete}) {
    const message = contextMenu.message;
    return (
        <div
            className="context-menu"
            style={{left: contextMenu.x, top: contextMenu.y}}
            role="menu"
            onClick={(event) => event.stopPropagation()}
        >
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

function Modal({children, onClose, title, wide = false}) {
    return (
        <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
            <section className={`modal-card ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
                <header>
                    <h2>{title}</h2>
                    <IconButton icon={X} label="关闭" onClick={onClose} />
                </header>
                {children}
            </section>
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

function EmptyState({body, icon: Icon, title}) {
    return (
        <section className="empty-state">
            <Icon size={26} />
            <h3>{title}</h3>
            <p>{body}</p>
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

function MutedLine({children}) {
    return <p className="muted-line">{children}</p>;
}

function StatusBadge({label, ok}) {
    return <span className={`status-badge ${ok ? 'ok' : ''}`}>{label}</span>;
}

function IconButton({disabled, icon: Icon, label, onClick, spinning, tone = 'default'}) {
    return (
        <button
            className={`icon-button ${tone} ${spinning ? 'spinning' : ''}`}
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            disabled={disabled}
        >
            <Icon size={17} />
        </button>
    );
}

export default App;
