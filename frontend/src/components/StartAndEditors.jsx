import {Activity, ArrowLeft, ClipboardList, Database, KeyRound, Mail, MailPlus, Plus, ShieldCheck} from 'lucide-react';
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

