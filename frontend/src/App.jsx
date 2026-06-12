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
const emptyComposeForm = {to: '', subject: '', text: ''};

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

function App() {
    const [profiles, setProfiles] = useState([]);
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [profileForm, setProfileForm] = useState(emptyProfileForm);
    const [authForm, setAuthForm] = useState(emptyAuthForm);
    const [composeForm, setComposeForm] = useState(emptyComposeForm);
    const [manualToken, setManualToken] = useState('');
    const [status, setStatus] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [selectedMessageId, setSelectedMessageId] = useState('');
    const [activeFolder, setActiveFolder] = useState('inbox');
    const [searchQuery, setSearchQuery] = useState('');
    const [busy, setBusy] = useState('');
    const [toast, setToast] = useState(null);
    const [theme, setTheme] = useState(() => localStorage.getItem('omnimail_desktop_theme') || 'light');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('omnimail_sidebar_collapsed') === 'true');
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

    async function loadInitialState() {
        setBusy('initial');

        try {
            const state = await GetInitialState();
            const nextProfiles = state.profiles || [];
            setProfiles(nextProfiles);

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

        setBusy('send');

        try {
            const result = await SendMessage({
                profileId: selectedProfile.id,
                accountId: workspace.selectedAccountId,
                ...composeForm
            });
            setComposeForm(emptyComposeForm);
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
            <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} onClick={() => setContextMenu(null)}>
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

                <main id="reader" className={`reader-panel ${composerOpen ? 'composing' : ''}`}>
                    {composerOpen ? (
                        <Composer
                            account={selectedAccount}
                            busy={busy}
                            form={composeForm}
                            onChange={setComposeForm}
                            onClose={() => setComposerOpen(false)}
                            onSubmit={handleSendMessage}
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
                        onClose={() => setModal(null)}
                        selectedProfile={selectedProfile}
                        status={status}
                        theme={theme}
                        onOpenProfiles={handleOpenProfileManager}
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
    const unread = message.direction !== 'outbound' && !message.archivedAt;

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
                            <strong>{message.author || message.email || '未知发件人'}</strong>
                            <span>{message.direction === 'outbound' ? '发往' : '来自'} {message.email || '未知地址'}</span>
                            <time>{formatMessageTime(message.time)}</time>
                        </p>
                    </div>
                    <div className="message-inline-actions">
                        <IconButton icon={message.archivedAt ? ArchiveRestore : Archive} label={message.archivedAt ? '取消归档' : '归档'} onClick={() => onArchive(message)} />
                        <IconButton icon={Trash2} label="删除" onClick={() => onDelete(message)} tone="danger" />
                    </div>
                </header>

                <div className="message-body">
                    {(message.body || message.preview || '无正文内容').split('\n').map((line, index) => (
                        <p key={`${message.id}-${index}`}>{line || '\u00A0'}</p>
                    ))}
                </div>

                {message.attachments?.length ? (
                    <div className="attachment-grid" aria-label="附件">
                        {message.attachments.map((attachment) => (
                            <button
                                className="attachment-card"
                                type="button"
                                key={attachment.id}
                                onClick={() => onDownload(attachment)}
                                disabled={!attachment.downloadable || busy === 'download'}
                            >
                                <FileText size={18} />
                                <span>
                                    <strong>{attachment.filename}</strong>
                                    <small>{attachment.downloadable ? '点击保存到本地' : '附件内容未存储'}</small>
                                </span>
                                <Download size={16} />
                            </button>
                        ))}
                    </div>
                ) : null}
            </section>
        </article>
    );
}

function Composer({account, busy, form, onChange, onClose, onSubmit}) {
    const disabled = !account || busy === 'send';

    return (
        <section className="composer-card" aria-label="写邮件">
            <form onSubmit={onSubmit}>
                <header>
                    <div>
                        <p>新邮件</p>
                        <h3>{account?.address || '未选择发件身份'}</h3>
                    </div>
                    <IconButton icon={X} label="关闭写信窗口" onClick={onClose} />
                </header>

                <label>
                    <span>收件人</span>
                    <input
                        value={form.to}
                        onChange={(event) => onChange({...form, to: event.target.value})}
                        placeholder="name@example.com"
                        type="email"
                        disabled={disabled}
                        autoFocus
                        required
                    />
                </label>
                <label>
                    <span>主题</span>
                    <input
                        value={form.subject}
                        onChange={(event) => onChange({...form, subject: event.target.value})}
                        placeholder="写一个清晰的主题"
                        disabled={disabled}
                        required
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
                    <span>当前后端发送接口仍取决于 OmniMail Worker 的实现。</span>
                    <button className="primary-action" type="submit" disabled={disabled || !form.to || !form.subject}>
                        <Send size={16} />
                        发送
                    </button>
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

function SettingsModal({onClose, onOpenProfiles, selectedProfile, status, theme, toggleTheme}) {
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
