import {useState} from 'react';
import {ArrowLeft, Copy, Globe2, Mail, MailPlus, Pencil, Plus, Power, ShieldCheck, Trash2} from 'lucide-react';
import {isAccountEnabled} from '../app/utils';
import {EmptyState, StatusBadge} from './Common';

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
