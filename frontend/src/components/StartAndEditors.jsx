import {ArrowLeft, Globe2, MailPlus, Plus, ShieldCheck} from 'lucide-react';
import {isAccountEnabled} from '../app/utils';
import {EmptyState, StatusBadge} from './Common';

export function StartPage({onAddProfile, onManageProfiles, profiles}) {
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

export function ProfileEditorPage({busy, form, onBack, onChange, onSubmit}) {
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

export function AccountEditorPage({busy, domain, form, onBack, onChange, onSubmit, profile}) {
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

export function AccountManagerPage({
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

export function DomainManagerPage({
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

export function AuthPage({
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

