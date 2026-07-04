import {upsertProfile} from '../app/utils';
import {EndpointManagerPage} from './EndpointManager';
import {MailWorkspace} from './MailWorkspace';
import {
    AccountEditorPage,
    AccountManagerPage,
    AuthPage,
    DomainManagerPage,
    ProfileEditorPage,
    StartPage
} from './StartAndEditors';
import {WorkspacePageRouter} from './WorkspacePages';

const workspacePages = ['dashboard', 'activity', 'attachments', 'contacts', 'queue', 'search', 'settings'];

export function AppMainContent({
    accountForm,
    activeFolder,
    auditLogs,
    authForm,
    busy,
    canClearCurrentDraft,
    clearCurrentDraft,
    composerOpen,
    composeForm,
    composeOptionsOpen,
    domainForm,
    endpointDiagnostics,
    folderCounts,
    handleAccountSubmit,
    handleAddAccount,
    handleAddProfile,
    handleAuthorize,
    handleCloseAccountEditor,
    handleCloseAuthPage,
    handleCloseProfileEditor,
    handleCopyText,
    handleDeleteAccount,
    handleDeleteProfile,
    handleDomainSubmit,
    handleEditProfile,
    handleManualToken,
    handleOpenAccountManager,
    handleOpenAuth,
    handleOpenDomainManager,
    handleOpenProfileManager,
    handleProfileSubmit,
    handleSelectProfile,
    handleTestProfile,
    handleUpdateAccount,
    handleArchiveMessage,
    handleDeleteMessage,
    handleDownloadAttachment,
    handlePreviewAttachment,
    handleResizeKey,
    handleSendMessage,
    handleSetMessageStatus,
    insightsProfileId,
    hasSavedDraft,
    listWidth,
    loadEndpointInsights,
    loadMailbox,
    loadMoreMessages,
    manualToken,
    openComposer,
    openComposerForContact,
    openContextMenu,
    openMessageFromWorkspace,
    openSettingsPage,
    openWorkspacePage,
    onRunMessageAction,
    profileForm,
    profiles,
    reloadCurrentMailbox,
    resetLayoutPreferences,
    resetLayoutWidth,
    resizingPanel,
    searchInputRef,
    searchQuery,
    selectedAccount,
    selectedMessage,
    selectedProfile,
    selectedProfileId,
    setAccountForm,
    setAuthForm,
    setComposeForm,
    setComposeOptionsOpen,
    setContentPage,
    setComposerOpen,
    setDomainForm,
    setManualToken,
    setProfileForm,
    setProfiles,
    setSearchQuery,
    setSelectedMessageId,
    startPanelResize,
    status,
    storagePath,
    theme,
    toggleTheme,
    updateManager,
    visibleMessages,
    workspace,
    contentPage,
    onNotify
}) {
    const showEndpointPage = contentPage === 'endpoints';
    const showProfilePage = contentPage === 'profile';
    const showAuthPage = contentPage === 'auth';
    const showAccountPage = contentPage === 'account';
    const showAccountManagerPage = contentPage === 'accounts';
    const showDomainManagerPage = contentPage === 'domains';
    const showWorkspacePage = workspacePages.includes(contentPage);
    const showStartPage = contentPage === 'start' || (!selectedProfile && !showEndpointPage && !showProfilePage && !showWorkspacePage);

    if (showProfilePage) {
        return (
            <ProfileEditorPage
                busy={busy}
                form={profileForm}
                onBack={handleCloseProfileEditor}
                onChange={setProfileForm}
                onSubmit={handleProfileSubmit}
            />
        );
    }

    if (showEndpointPage) {
        return (
            <EndpointManagerPage
                busy={busy}
                onAddProfile={handleAddProfile}
                onAuth={handleOpenAuth}
                onBack={() => setContentPage(selectedProfile ? 'mail' : 'start')}
                onDeleteProfile={handleDeleteProfile}
                onEditProfile={handleEditProfile}
                onNotify={onNotify}
                onProfileSelect={handleSelectProfile}
                onTestProfile={handleTestProfile}
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                status={status}
            />
        );
    }

    if (showAuthPage && selectedProfile) {
        return (
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
        );
    }

    if (showStartPage) {
        return (
            <StartPage
                busy={busy}
                onAddProfile={handleAddProfile}
                onManageProfiles={handleOpenProfileManager}
                profiles={profiles}
            />
        );
    }

    if (showAccountPage && selectedProfile) {
        return (
            <AccountEditorPage
                busy={busy}
                domain={workspace?.selectedDomain || ''}
                form={accountForm}
                onBack={handleCloseAccountEditor}
                onChange={setAccountForm}
                onSubmit={handleAccountSubmit}
                profile={selectedProfile}
            />
        );
    }

    if (showAccountManagerPage && selectedProfile) {
        return (
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
        );
    }

    if (showDomainManagerPage && selectedProfile) {
        return (
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
        );
    }

    if (showWorkspacePage) {
        return (
            <WorkspacePageRouter
                auditLogs={auditLogs}
                busy={busy}
                canClearCurrentDraft={canClearCurrentDraft}
                diagnostics={endpointDiagnostics}
                folderCounts={folderCounts}
                insightsProfileId={insightsProfileId}
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
                onNotify={onNotify}
                onOpenProfiles={handleOpenProfileManager}
                onOpenQueue={() => openWorkspacePage('queue')}
                onOpenSearch={() => openWorkspacePage('search')}
                onOpenSettings={openSettingsPage}
                onPreviewAttachment={handlePreviewAttachment}
                onProfileUpdate={(profile) => setProfiles((current) => upsertProfile(current, profile))}
                onReloadMailbox={reloadCurrentMailbox}
                onResetLayout={resetLayoutPreferences}
                onRunMessageAction={onRunMessageAction}
                page={contentPage}
                profiles={profiles}
                selectedAccount={selectedAccount}
                selectedProfile={selectedProfile}
                status={status}
                storagePath={storagePath}
                theme={theme}
                toggleTheme={toggleTheme}
                updateManager={updateManager}
                workspace={workspace}
            />
        );
    }

    return (
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
    );
}
