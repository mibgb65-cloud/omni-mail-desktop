import {useEffect, useMemo, useState} from 'react';
import './App.css';
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
const emptyAuthForm = {email: '', password: '', deviceLabel: 'Windows Desktop', setup: false};
const emptyComposeForm = {to: '', subject: '', text: ''};

function upsertProfile(profiles, profile) {
    const exists = profiles.some((item) => item.id === profile.id);
    if (!exists) {
        return [profile, ...profiles];
    }

    return profiles.map((item) => item.id === profile.id ? profile : item);
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
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const selectedProfile = useMemo(
        () => profiles.find((profile) => profile.id === selectedProfileId) || null,
        [profiles, selectedProfileId]
    );

    const selectedMessage = useMemo(() => {
        const messages = workspace?.messages || [];
        return messages.find((message) => message.id === selectedMessageId) || messages[0] || null;
    }, [selectedMessageId, workspace]);

    useEffect(() => {
        loadInitialState();
    }, []);

    useEffect(() => {
        const firstMessage = workspace?.messages?.[0]?.id || '';
        setSelectedMessageId(firstMessage);
    }, [workspace?.selectedAccountId, workspace?.messages]);

    async function loadInitialState() {
        setBusy('initial');
        setError('');
        setNotice('');

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
            setError(loadError.message || 'Failed to load local profiles.');
        } finally {
            setBusy('');
        }
    }

    async function handleProfileSubmit(event) {
        event.preventDefault();
        setBusy('profile');
        setError('');
        setNotice('');

        try {
            const profile = await SaveProfile(profileForm);
            setProfiles((current) => upsertProfile(current, profile));
            setSelectedProfileId(profile.id);
            setProfileForm(emptyProfileForm);
            setWorkspace(null);
            await testConnection(profile.baseUrl, '');
        } catch (saveError) {
            setError(saveError.message || 'Profile save failed.');
        } finally {
            setBusy('');
        }
    }

    async function handleSelectProfile(profile) {
        setSelectedProfileId(profile.id);
        setStatus(null);
        setWorkspace(null);
        setError('');
        setNotice('');
        await SelectProfile(profile.id).catch(() => null);

        if (profile.hasToken) {
            await loadMailbox({profileId: profile.id});
        } else {
            await testConnection(profile.baseUrl, '');
        }
    }

    async function handleEditProfile(profile) {
        setProfileForm({id: profile.id, name: profile.name, baseUrl: profile.baseUrl});
    }

    async function handleDeleteProfile(profile) {
        if (!window.confirm(`Delete ${profile.name}?`)) {
            return;
        }

        setBusy('delete');
        setError('');
        setNotice('');

        try {
            await DeleteProfile(profile.id);
            setProfiles((current) => current.filter((item) => item.id !== profile.id));
            if (selectedProfileId === profile.id) {
                setSelectedProfileId('');
                setWorkspace(null);
                setStatus(null);
            }
        } catch (deleteError) {
            setError(deleteError.message || 'Profile delete failed.');
        } finally {
            setBusy('');
        }
    }

    async function testConnection(baseUrl = selectedProfile?.baseUrl, token = '') {
        if (!baseUrl) {
            return;
        }

        setBusy('test');
        setError('');
        setNotice('');

        try {
            const result = await TestBaseURL(baseUrl, token);
            setStatus(result);
            if (result?.authStatus?.requiresSetup) {
                setAuthForm((current) => ({...current, setup: true}));
            }
        } catch (testError) {
            setError(testError.message || 'Connection test failed.');
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
        setError('');
        setNotice('');

        try {
            const profile = await AuthorizeProfile({...authForm, profileId: selectedProfile.id});
            setProfiles((current) => upsertProfile(current, profile));
            setAuthForm(emptyAuthForm);
            await loadMailbox({profileId: profile.id});
        } catch (authError) {
            setError(authError.message || 'Authorization failed.');
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
        setError('');
        setNotice('');

        try {
            const profile = await SaveProfileToken({
                profileId: selectedProfile.id,
                deviceToken: manualToken,
                deviceLabel: authForm.deviceLabel || 'Windows Desktop'
            });
            setProfiles((current) => upsertProfile(current, profile));
            setManualToken('');
            await loadMailbox({profileId: profile.id});
        } catch (tokenError) {
            setError(tokenError.message || 'Token save failed.');
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
        setError('');

        try {
            const data = await LoadMailbox({...request, profileId});
            setWorkspace(data);
            setProfiles((current) => upsertProfile(current, data.profile));
        } catch (mailError) {
            setWorkspace(null);
            setError(mailError.message || 'Mailbox load failed.');
        } finally {
            setBusy('');
        }
    }

    async function handleSendMessage(event) {
        event.preventDefault();
        if (!selectedProfile || !workspace?.selectedAccountId) {
            return;
        }

        setBusy('send');
        setError('');
        setNotice('');

        try {
            const result = await SendMessage({
                profileId: selectedProfile.id,
                accountId: workspace.selectedAccountId,
                ...composeForm
            });
            setComposeForm(emptyComposeForm);
            setNotice(`Message queued by ${result.provider || 'OmniMail'}.`);
            await loadMailbox({
                profileId: selectedProfile.id,
                domain: workspace.selectedDomain,
                accountId: workspace.selectedAccountId
            });
        } catch (sendError) {
            setError(sendError.message || 'Send failed.');
        } finally {
            setBusy('');
        }
    }

    async function handleArchiveMessage(message) {
        if (!selectedProfile || !message) {
            return;
        }

        setBusy('message-action');
        setError('');
        setNotice('');

        try {
            const payload = {profileId: selectedProfile.id, messageId: message.id};
            if (message.archivedAt) {
                await UnarchiveMessage(payload);
                setNotice('Message restored to inbox.');
            } else {
                await ArchiveMessage(payload);
                setNotice('Message archived.');
            }
            await loadMailbox({
                profileId: selectedProfile.id,
                domain: workspace?.selectedDomain || '',
                accountId: workspace?.selectedAccountId || ''
            });
        } catch (actionError) {
            setError(actionError.message || 'Message update failed.');
        } finally {
            setBusy('');
        }
    }

    async function handleDeleteMessage(message) {
        if (!selectedProfile || !message || !window.confirm('Delete this message?')) {
            return;
        }

        setBusy('message-action');
        setError('');
        setNotice('');

        try {
            await DeleteMessage({profileId: selectedProfile.id, messageId: message.id});
            setNotice('Message deleted.');
            await loadMailbox({
                profileId: selectedProfile.id,
                domain: workspace?.selectedDomain || '',
                accountId: workspace?.selectedAccountId || ''
            });
        } catch (deleteError) {
            setError(deleteError.message || 'Delete failed.');
        } finally {
            setBusy('');
        }
    }

    async function handleDownloadAttachment(attachment) {
        if (!selectedProfile || !attachment) {
            return;
        }

        setBusy('download');
        setError('');
        setNotice('');

        try {
            const result = await DownloadAttachment({
                profileId: selectedProfile.id,
                attachmentId: attachment.id,
                filename: attachment.filename
            });
            setNotice(`Attachment saved to ${result.path}.`);
        } catch (downloadError) {
            if (downloadError.message !== 'download canceled') {
                setError(downloadError.message || 'Download failed.');
            }
        } finally {
            setBusy('');
        }
    }

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand-mark">OM</div>
                    <div>
                        <h1>OmniMail Desktop</h1>
                        <p>Windows API client</p>
                    </div>
                </div>

                <form className="profile-form" onSubmit={handleProfileSubmit}>
                    <label>
                        <span>Name</span>
                        <input
                            value={profileForm.name}
                            onChange={(event) => setProfileForm({...profileForm, name: event.target.value})}
                            placeholder="Client A"
                        />
                    </label>
                    <label>
                        <span>Base URL</span>
                        <input
                            value={profileForm.baseUrl}
                            onChange={(event) => setProfileForm({...profileForm, baseUrl: event.target.value})}
                            placeholder="https://mail.example.com"
                            required
                        />
                    </label>
                    <button type="submit" disabled={busy === 'profile'}>
                        {profileForm.id ? 'Update connection' : 'Add connection'}
                    </button>
                </form>

                <div className="profile-list">
                    {profiles.map((profile) => (
                        <button
                            type="button"
                            key={profile.id}
                            className={`profile-item ${profile.id === selectedProfileId ? 'selected' : ''}`}
                            onClick={() => handleSelectProfile(profile)}
                        >
                            <span className="profile-name">{profile.name}</span>
                            <span className="profile-url">{profile.baseUrl}</span>
                            <span className={`profile-token ${profile.hasToken ? 'ready' : ''}`}>
                                {profile.hasToken ? profile.tokenPreview : 'No token'}
                            </span>
                        </button>
                    ))}
                    {profiles.length === 0 ? (
                        <div className="empty-rail">No connections</div>
                    ) : null}
                </div>
            </aside>

            <main className="workspace">
                <header className="topbar">
                    <div>
                        <p className="eyebrow">Active endpoint</p>
                        <h2>{selectedProfile ? selectedProfile.name : 'No connection selected'}</h2>
                    </div>
                    {selectedProfile ? (
                        <div className="topbar-actions">
                            <button type="button" onClick={() => testConnection(selectedProfile.baseUrl, '')}>
                                Test
                            </button>
                            <button type="button" onClick={() => handleEditProfile(selectedProfile)}>
                                Edit
                            </button>
                            <button type="button" className="danger" onClick={() => handleDeleteProfile(selectedProfile)}>
                                Delete
                            </button>
                        </div>
                    ) : null}
                </header>

                {error ? <div className="error-banner">{error}</div> : null}
                {notice ? <div className="notice-banner">{notice}</div> : null}

                {!selectedProfile ? (
                    <EmptyState title="Add an OmniMail endpoint" body="Create a connection with a deployed Worker base URL."/>
                ) : (
                    <>
                        <ConnectionPanel profile={selectedProfile} status={status} busy={busy}/>

                        {!selectedProfile.hasToken ? (
                            <AuthPanel
                                authForm={authForm}
                                manualToken={manualToken}
                                busy={busy}
                                onAuthFormChange={setAuthForm}
                                onManualTokenChange={setManualToken}
                                onAuthorize={handleAuthorize}
                                onManualToken={handleManualToken}
                            />
                        ) : (
                            <MailboxPanel
                                busy={busy}
                                workspace={workspace}
                                selectedMessage={selectedMessage}
                                selectedMessageId={selectedMessageId}
                                onReload={() => loadMailbox({profileId: selectedProfile.id})}
                                onDomainChange={(domain) => loadMailbox({profileId: selectedProfile.id, domain})}
                                onAccountChange={(accountId) => loadMailbox({
                                    profileId: selectedProfile.id,
                                    domain: workspace?.selectedDomain || '',
                                    accountId
                                })}
                                onMessageChange={setSelectedMessageId}
                                composeForm={composeForm}
                                onComposeChange={setComposeForm}
                                onSendMessage={handleSendMessage}
                                onArchiveMessage={handleArchiveMessage}
                                onDeleteMessage={handleDeleteMessage}
                                onDownloadAttachment={handleDownloadAttachment}
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

function ConnectionPanel({profile, status, busy}) {
    const health = status?.health;
    const auth = status?.authStatus;

    return (
        <section className="connection-panel">
            <div>
                <p className="eyebrow">Base URL</p>
                <h3>{profile.baseUrl}</h3>
            </div>
            <div className="status-grid">
                <StatusPill label="Connection" value={status ? status.message : 'Not tested'} tone={status?.ok ? 'good' : 'neutral'}/>
                <StatusPill label="Storage" value={health?.storage || '-'} tone={health?.storage === 'd1' ? 'good' : 'neutral'}/>
                <StatusPill label="Auth" value={auth ? (auth.authenticated ? 'Authenticated' : 'Required') : '-'} tone={auth?.authenticated ? 'good' : 'warn'}/>
                <StatusPill label="Runtime" value={health?.runtime || (busy === 'test' ? 'Testing' : '-')} tone="neutral"/>
            </div>
        </section>
    );
}

function AuthPanel({authForm, manualToken, busy, onAuthFormChange, onManualTokenChange, onAuthorize, onManualToken}) {
    return (
        <section className="auth-grid">
            <form className="panel" onSubmit={onAuthorize}>
                <div className="panel-heading">
                    <h3>{authForm.setup ? 'Setup admin' : 'Register desktop device'}</h3>
                    <label className="switch-row">
                        <input
                            type="checkbox"
                            checked={authForm.setup}
                            onChange={(event) => onAuthFormChange({...authForm, setup: event.target.checked})}
                        />
                        <span>First setup</span>
                    </label>
                </div>
                <label>
                    <span>Email</span>
                    <input
                        type="email"
                        value={authForm.email}
                        onChange={(event) => onAuthFormChange({...authForm, email: event.target.value})}
                        required
                    />
                </label>
                <label>
                    <span>Password</span>
                    <input
                        type="password"
                        value={authForm.password}
                        onChange={(event) => onAuthFormChange({...authForm, password: event.target.value})}
                        required
                    />
                </label>
                <label>
                    <span>Device label</span>
                    <input
                        value={authForm.deviceLabel}
                        onChange={(event) => onAuthFormChange({...authForm, deviceLabel: event.target.value})}
                    />
                </label>
                <button type="submit" disabled={busy === 'auth'}>
                    {authForm.setup ? 'Setup and register' : 'Login and register'}
                </button>
            </form>

            <form className="panel" onSubmit={onManualToken}>
                <div className="panel-heading">
                    <h3>Use existing token</h3>
                </div>
                <label>
                    <span>Device token</span>
                    <textarea
                        value={manualToken}
                        onChange={(event) => onManualTokenChange(event.target.value)}
                        rows={6}
                        required
                    />
                </label>
                <button type="submit" disabled={busy === 'token'}>Save token</button>
            </form>
        </section>
    );
}

function MailboxPanel({
    busy,
    workspace,
    selectedMessage,
    selectedMessageId,
    onReload,
    onDomainChange,
    onAccountChange,
    onMessageChange,
    composeForm,
    onComposeChange,
    onSendMessage,
    onArchiveMessage,
    onDeleteMessage,
    onDownloadAttachment
}) {
    if (!workspace) {
        return (
            <section className="mail-empty">
                <button type="button" onClick={onReload} disabled={busy === 'mailbox'}>Load mailbox</button>
            </section>
        );
    }

    return (
        <section className="mailbox-shell">
            <div className="domain-strip">
                <div className="domain-tabs">
                    {workspace.domains.map((domain) => (
                        <button
                            type="button"
                            key={domain}
                            className={domain === workspace.selectedDomain ? 'active' : ''}
                            onClick={() => onDomainChange(domain)}
                        >
                            {domain}
                        </button>
                    ))}
                </div>
                <button type="button" onClick={onReload} disabled={busy === 'mailbox'}>Refresh</button>
            </div>

            <div className="mail-grid">
                <aside className="account-list">
                    <div className="section-title">Mailboxes</div>
                    {workspace.accounts.map((account) => (
                        <button
                            type="button"
                            key={account.id}
                            className={account.id === workspace.selectedAccountId ? 'active' : ''}
                            onClick={() => onAccountChange(account.id)}
                        >
                            <span>{account.address}</span>
                            <small>{account.subject || account.latestSubject || 'No messages'}</small>
                        </button>
                    ))}
                    {workspace.accounts.length === 0 ? (
                        <div className="empty-list">No mailboxes</div>
                    ) : null}
                </aside>

                <aside className="message-list">
                    <div className="section-title">Messages</div>
                    {workspace.messages.map((message) => (
                        <button
                            type="button"
                            key={message.id}
                            className={message.id === selectedMessageId ? 'active' : ''}
                            onClick={() => onMessageChange(message.id)}
                        >
                            <span>{message.subject || 'No subject'}</span>
                            <small>{message.author || message.email} · {message.time}</small>
                        </button>
                    ))}
                    {workspace.messages.length === 0 ? (
                        <div className="empty-list">No messages</div>
                    ) : null}
                </aside>

                <article className="message-reader">
                    <ComposeBox
                        busy={busy}
                        composeForm={composeForm}
                        account={workspace.accounts.find((account) => account.id === workspace.selectedAccountId)}
                        onChange={onComposeChange}
                        onSubmit={onSendMessage}
                    />

                    {selectedMessage ? (
                        <div className="reader-card">
                            <header>
                                <div>
                                    <p>{selectedMessage.direction || 'message'}</p>
                                    <h3>{selectedMessage.subject || 'No subject'}</h3>
                                    <span>{selectedMessage.author || selectedMessage.email}</span>
                                </div>
                                <div className="message-actions">
                                    <button type="button" onClick={() => onArchiveMessage(selectedMessage)} disabled={busy === 'message-action'}>
                                        {selectedMessage.archivedAt ? 'Unarchive' : 'Archive'}
                                    </button>
                                    <button type="button" className="danger" onClick={() => onDeleteMessage(selectedMessage)} disabled={busy === 'message-action'}>
                                        Delete
                                    </button>
                                </div>
                            </header>
                            <pre>{selectedMessage.body || selectedMessage.preview || ''}</pre>
                            {selectedMessage.attachments?.length ? (
                                <div className="attachment-list">
                                    {selectedMessage.attachments.map((attachment) => (
                                        <button
                                            type="button"
                                            key={attachment.id}
                                            onClick={() => onDownloadAttachment(attachment)}
                                            disabled={!attachment.downloadable || busy === 'download'}
                                            title={attachment.downloadable ? 'Save attachment' : 'Attachment content is not stored'}
                                        >
                                            {attachment.filename}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <EmptyState title="No message selected" body="Select a mailbox message."/>
                    )}
                </article>
            </div>
        </section>
    );
}

function ComposeBox({busy, composeForm, account, onChange, onSubmit}) {
    const disabled = !account || busy === 'send';

    return (
        <form className="compose-box" onSubmit={onSubmit}>
            <div className="compose-heading">
                <div>
                    <p className="eyebrow">Send from</p>
                    <strong>{account?.address || 'No mailbox selected'}</strong>
                </div>
                <button type="submit" disabled={disabled || !composeForm.to || !composeForm.subject}>
                    Send
                </button>
            </div>
            <div className="compose-grid">
                <input
                    value={composeForm.to}
                    onChange={(event) => onChange({...composeForm, to: event.target.value})}
                    placeholder="recipient@example.com"
                    type="email"
                    disabled={disabled}
                    required
                />
                <input
                    value={composeForm.subject}
                    onChange={(event) => onChange({...composeForm, subject: event.target.value})}
                    placeholder="Subject"
                    disabled={disabled}
                    required
                />
            </div>
            <textarea
                value={composeForm.text}
                onChange={(event) => onChange({...composeForm, text: event.target.value})}
                rows={4}
                placeholder="Message text"
                disabled={disabled}
            />
        </form>
    );
}

function StatusPill({label, value, tone}) {
    return (
        <div className={`status-pill ${tone}`}>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function EmptyState({title, body}) {
    return (
        <section className="empty-state">
            <h3>{title}</h3>
            <p>{body}</p>
        </section>
    );
}

export default App;
