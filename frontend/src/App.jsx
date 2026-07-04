import {useEffect, useMemo, useRef, useState} from 'react';
import './App.css';
import {WindowSetDarkTheme, WindowSetLightTheme} from '../wailsjs/runtime/runtime';

import {emptyAccountForm, emptyAuthForm, emptyComposeForm, emptyDomainForm, emptyProfileForm, composeHasContent, clamp, invalidRecipients, isTypingTarget, isUnreadMessage, layoutDefaults, layoutLimits, mailboxPageSize, normalizeDomainInput, readStoredWidth, splitRecipients, upsertProfile} from './app/utils';
import {useUpdateManager} from './app/updateManager';
import {ContextMenu, ResizeHandle, TitleBar, Toast} from './components/Common';
import {Sidebar} from './components/Sidebar';
import {AccountEditorPage, AccountManagerPage, AuthPage, DomainManagerPage, ProfileEditorPage, StartPage} from './components/StartAndEditors';
import {EndpointManagerPage} from './components/EndpointManager';
import {WorkspacePageRouter} from './components/WorkspacePages';
import {MailWorkspace} from './components/MailWorkspace';

import {createLayoutActions} from './app/layoutActions';
import {createProfileActions} from './app/profileActions';
import {createMailboxActions} from './app/mailboxActions';

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
    const mailboxRequestSeq = useRef(0);

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
                openComposer();
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedMessageId, visibleMessages, selectedProfile, workspace]);

    function showToast(type, title, message = '') {
        setToast({type, title, message});
    }

    const updateManager = useUpdateManager(showToast);

    const mailboxActions = createMailboxActions({selectedProfile, selectedProfileId, workspace, accountForm, domainForm, composeForm, composeDraftKey, mailboxRequestSeq, manualUnreadMessageRef, showToast, setBusy, setAccountForm, setDomainForm, setContentPage, setWorkspace, setProfiles, setComposeForm, setComposeOptionsOpen, setHasSavedDraft, setComposerOpen, setContextMenu});
    const {handleAccountSubmit, handleDomainSubmit, handleUpdateAccount, handleDeleteAccount, handleCopyText, loadMailbox, reloadCurrentMailbox, loadMoreMessages, handleSendMessage, handleArchiveMessage, handleDeleteMessage, handleSetMessageStatus, handleDownloadAttachment, handlePreviewAttachment, openContextMenu} = mailboxActions;

    const layoutActions = createLayoutActions({visibleMessages, selectedMessageId, setSelectedMessageId, sidebarCollapsed, sidebarWidth, listWidth, setSidebarWidth, setListWidth, setResizingPanel, setSidebarCollapsed, composeDraftKey, setComposeForm, setComposeOptionsOpen, setHasSavedDraft, showToast});
    const {selectRelativeMessage, resetLayoutPreferences, clearCurrentDraft, startPanelResize, handleResizeKey, resetLayoutWidth} = layoutActions;

    const profileActions = createProfileActions({selectedProfile, selectedProfileId, profileForm, contentPage, profileReturnPage, authReturnPage, authForm, manualToken, workspace, loadMailbox, showToast, setBusy, setProfiles, setStoragePath, setSelectedProfileId, setSidebarPage, setContentPage, setWorkspace, setProfileForm, setStatus, setContextMenu, setProfileReturnPage, setAuthReturnPage, setProfileMenuOpen, setManualToken, setEndpointDiagnostics, setAuditLogs, setInsightsProfileId, setAccountForm, setAuthForm});
    const {loadInitialState, handleProfileSubmit, handleSelectProfile, handleAddProfile, handleCloseProfileEditor, handleBackToProfiles, handleAddAccount, handleCloseAccountEditor, handleOpenAccountManager, handleOpenDomainManager, handleOpenProfileManager, handleOpenAuth, handleCloseAuthPage, handleTestProfile, handleEditProfile, handleDeleteProfile, loadEndpointInsights, handleAuthorize, handleManualToken} = profileActions;
    const showEndpointPage = contentPage === 'endpoints';
    const showProfilePage = contentPage === 'profile';
    const showAuthPage = contentPage === 'auth';
    const showAccountPage = contentPage === 'account';
    const showAccountManagerPage = contentPage === 'accounts';
    const showDomainManagerPage = contentPage === 'domains';
    const showWorkspacePage = ['dashboard', 'activity', 'attachments', 'contacts', 'search', 'settings'].includes(contentPage);
    const showStartPage = contentPage === 'start' || (!selectedProfile && !showEndpointPage && !showProfilePage && !showWorkspacePage);
    const openWorkspacePage = (page) => {
        setContentPage(page);
        setProfileMenuOpen(false);
        setContextMenu(null);
    };
    const openSettingsPage = () => openWorkspacePage('settings');
    const openComposer = (prefill = null) => {
        setContentPage('mail');
        setProfileMenuOpen(false);
        setContextMenu(null);
        if (prefill) {
            if (composeDraftKey) {
                localStorage.removeItem(composeDraftKey);
            }
            setComposeForm({...emptyComposeForm, ...prefill});
            setComposeOptionsOpen(Boolean(prefill.cc || prefill.bcc));
            setHasSavedDraft(false);
        }
        setComposerOpen(true);
    };
    const openComposerForContact = (contact) => openComposer({to: contact?.email || ''});
    const openMessageFromWorkspace = (message) => {
        setActiveFolder(message.archivedAt ? 'archive' : message.direction === 'outbound' ? 'sent' : 'inbox');
        setSelectedMessageId(message.id);
        setContentPage('mail');
    };

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
                    onOpenActivity={() => openWorkspacePage('activity')}
                    onOpenAttachments={() => openWorkspacePage('attachments')}
                    onOpenContacts={() => openWorkspacePage('contacts')}
                    onOpenDashboard={() => openWorkspacePage('dashboard')}
                    onOpenSearch={() => openWorkspacePage('search')}
                    onOpenSettings={openSettingsPage}
                    onCompose={() => openComposer()}
                    onProfileSelect={handleSelectProfile}
                    onToggle={() => setSidebarCollapsed((value) => !value)}
                    profiles={profiles}
                    profileMenuOpen={profileMenuOpen}
                    sidebarPage={sidebarPage}
                    selectedProfile={selectedProfile}
                    selectedProfileId={selectedProfileId}
                    setProfileMenuOpen={setProfileMenuOpen}
                    activeWorkspacePage={showWorkspacePage ? contentPage : ''}
                    status={status}
                    theme={theme}
                    toggleTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
                    updateInfo={updateManager.visibleUpdateAvailable ? updateManager.info : null}
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
                        onNotify={showToast}
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
                ) : showWorkspacePage ? (
                    <WorkspacePageRouter
                        {...{auditLogs, busy, canClearCurrentDraft, folderCounts, insightsProfileId, profiles, selectedAccount, selectedProfile, status, storagePath, theme, workspace}}
                        diagnostics={endpointDiagnostics}
                        onBack={() => setContentPage('mail')}
                        onCompose={() => openComposer()}
                        onComposeContact={openComposerForContact}
                        onCopyText={handleCopyText}
                        onClearCurrentDraft={clearCurrentDraft}
                        onDownloadAttachment={handleDownloadAttachment}
                        onLoadInsights={loadEndpointInsights}
                        onLoadMoreMessages={loadMoreMessages}
                        onManageAccounts={handleOpenAccountManager}
                        onManageDomains={handleOpenDomainManager}
                        onOpenActivity={() => openWorkspacePage('activity')}
                        onOpenAttachments={() => openWorkspacePage('attachments')}
                        onOpenContacts={() => openWorkspacePage('contacts')}
                        onOpenMessage={openMessageFromWorkspace}
                        onNotify={showToast}
                        onOpenProfiles={handleOpenProfileManager}
                        onOpenSearch={() => openWorkspacePage('search')}
                        onOpenSettings={openSettingsPage}
                        onPreviewAttachment={handlePreviewAttachment}
                        onProfileUpdate={(profile) => setProfiles((current) => upsertProfile(current, profile))}
                        onReloadMailbox={reloadCurrentMailbox}
                        onResetLayout={resetLayoutPreferences}
                        page={contentPage}
                        toggleTheme={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}
                        updateManager={updateManager}
                    />
                ) : (
                    <MailWorkspace
                        activeFolder={activeFolder}
                        busy={busy}
                        composerOpen={composerOpen}
                        composeForm={composeForm}
                        composeOptionsOpen={composeOptionsOpen}
                        hasSavedDraft={hasSavedDraft}
                        listWidth={listWidth}
                        onArchiveMessage={handleArchiveMessage}
                        onClearCurrentDraft={clearCurrentDraft}
                        onCloseComposer={() => setComposerOpen(false)}
                        onCompose={() => openComposer()}
                        onContextMenu={openContextMenu}
                        onDeleteMessage={handleDeleteMessage}
                        onDownloadAttachment={handleDownloadAttachment}
                        onLoadMoreMessages={loadMoreMessages}
                        onOpenSettings={openSettingsPage}
                        onPreviewAttachment={handlePreviewAttachment}
                        onReloadMailbox={reloadCurrentMailbox}
                        onResizeKey={handleResizeKey}
                        onResizePointerDown={startPanelResize}
                        onResetListWidth={() => resetLayoutWidth('list')}
                        onSelectMessage={setSelectedMessageId}
                        onSendMessage={handleSendMessage}
                        onSetComposeForm={setComposeForm}
                        onSetMessageStatus={handleSetMessageStatus}
                        onToggleComposeOptions={() => setComposeOptionsOpen((value) => !value)}
                        resizingPanel={resizingPanel}
                        searchInputRef={searchInputRef}
                        searchQuery={searchQuery}
                        selectedAccount={selectedAccount}
                        selectedMessage={selectedMessage}
                        selectedProfile={selectedProfile}
                        setSearchQuery={setSearchQuery}
                        visibleMessages={visibleMessages}
                        workspace={workspace}
                    />
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

export default App;
