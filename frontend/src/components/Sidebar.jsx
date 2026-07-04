import {Activity, ArrowLeft, Globe2, KeyRound, LayoutDashboard, Mail, MailPlus, Moon, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Paperclip, Plus, Search, Settings, ShieldCheck, Sun, Trash2} from 'lucide-react';
import {folders} from '../app/utils';
import {IconButton, MutedLine, NavItem, SectionLabel, SidebarNotice} from './Common';

export function Sidebar({
    activeFolder,
    busy,
    collapsed,
    folderCounts,
    activeWorkspacePage,
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
    onOpenActivity,
    onOpenAttachments,
    onOpenDashboard,
    onOpenSearch,
    onOpenSettings,
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
    updateInfo,
    workspace
}) {
    const domains = workspace?.domains || [];
    const accounts = workspace?.accounts || [];
    const mailboxLoading = Boolean(selectedProfile?.hasToken) && busy === 'mailbox' && !workspace;
    const isProfilePage = sidebarPage === 'profiles';
    const updateAvailable = Boolean(updateInfo?.updateAvailable);
    const attachmentCount = (workspace?.messages || []).reduce((total, message) => total + (message.attachments?.length || 0), 0);

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
                            aria-current={profile.id === selectedProfileId ? 'page' : undefined}
                            title={`${profile.name}\n${profile.baseUrl}`}
                            onClick={() => onProfileSelect(profile)}
                        >
                            <span>{profile.name}</span>
                            <small>{profile.baseUrl}</small>
                            <em>{profile.secretError ? '需重新授权' : profile.hasToken ? profile.tokenPreview : '未授权'}</em>
                        </button>
                    ))}
                    {!profiles.length ? <MutedLine>添加第一个 Worker Base URL</MutedLine> : null}
                </div>

                <div className="profile-picker-actions">
                    <button type="button" onClick={toggleTheme}>
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
                    </button>
                    <button className={updateAvailable ? 'has-update' : ''} type="button" onClick={onOpenSettings}>
                        <Settings size={16} />
                        <span>工作台设置</span>
                        {updateAvailable ? <small>更新</small> : null}
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

            <nav className="nav-section workspace-actions-section" aria-label="工作台">
                <NavItem
                    active={activeWorkspacePage === 'dashboard'}
                    icon={LayoutDashboard}
                    label="总览"
                    onClick={onOpenDashboard}
                />
                <NavItem
                    active={activeWorkspacePage === 'activity'}
                    icon={Activity}
                    label="活动"
                    onClick={onOpenActivity}
                />
                <NavItem
                    active={activeWorkspacePage === 'attachments'}
                    count={attachmentCount}
                    icon={Paperclip}
                    label="附件"
                    onClick={onOpenAttachments}
                />
                <NavItem
                    active={activeWorkspacePage === 'search'}
                    icon={Search}
                    label="搜索"
                    onClick={onOpenSearch}
                />
                <NavItem
                    active={activeWorkspacePage === 'settings'}
                    count={updateAvailable ? '更新' : undefined}
                    icon={Settings}
                    label="工作台设置"
                    onClick={onOpenSettings}
                />
            </nav>

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
                        <div className="resource-list domain-list">
                            {domains.map((domain) => (
                                <button
                                    className={`domain-item ${domain === workspace?.selectedDomain ? 'active' : ''}`}
                                    key={domain}
                                    type="button"
                                    aria-current={domain === workspace?.selectedDomain ? 'true' : undefined}
                                    title={domain}
                                    onClick={() => onDomainChange(domain)}
                                >
                                    <span>{domain}</span>
                                </button>
                            ))}
                            {mailboxLoading ? <MutedLine>正在加载域名</MutedLine> : null}
                            {!mailboxLoading && !domains.length ? <MutedLine>暂无域名</MutedLine> : null}
                        </div>
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
                        <div className="resource-list account-list">
                            {accounts.map((account) => (
                                <button
                                    className={`account-chip ${account.id === workspace?.selectedAccountId ? 'active' : ''}`}
                                    key={account.id}
                                    type="button"
                                    aria-current={account.id === workspace?.selectedAccountId ? 'true' : undefined}
                                    onClick={() => onAccountChange(account.id)}
                                    title={account.address}
                                >
                                    <span>{account.address}</span>
                                    {account.unread ? <small aria-label={`${account.unread} 封未读`}>{account.unread}</small> : null}
                                </button>
                            ))}
                            {mailboxLoading ? <MutedLine>正在加载邮箱账号</MutedLine> : null}
                            {!mailboxLoading && !accounts.length ? <MutedLine>暂无邮箱账号</MutedLine> : null}
                        </div>
                    </div>
                </div>
            )}

            <div className="sidebar-footer">
                <button
                    className="endpoint-button"
                    type="button"
                    aria-expanded={profileMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                >
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
                    <div className="endpoint-menu" role="menu">
                        <button type="button" role="menuitem" onClick={toggleTheme}>
                            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                            {theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
                        </button>
                        <button type="button" role="menuitem" onClick={onAuth} disabled={!selectedProfile}>
                            <KeyRound size={16} />
                            授权当前接入点
                        </button>
                        <button type="button" role="menuitem" onClick={onManageProfiles}>
                            <ShieldCheck size={16} />
                            管理接入点
                        </button>
                        <button type="button" role="menuitem" onClick={onOpenSettings}>
                            <Settings size={16} />
                            工作台设置
                        </button>
                        <button type="button" role="menuitem" onClick={onManageDomains} disabled={!selectedProfile?.hasToken}>
                            <Globe2 size={16} />
                            管理域名
                        </button>
                        <button type="button" role="menuitem" onClick={onManageAccounts} disabled={!selectedProfile?.hasToken}>
                            <Mail size={16} />
                            管理邮箱账号
                        </button>
                        <button type="button" role="menuitem" onClick={() => selectedProfile && onEditProfile(selectedProfile)} disabled={!selectedProfile}>
                            <Settings size={16} />
                            编辑接入点
                        </button>
                        <button className="danger" type="button" role="menuitem" onClick={() => selectedProfile && onDeleteProfile(selectedProfile)} disabled={!selectedProfile || busy === 'delete'}>
                            <Trash2 size={16} />
                            删除接入点
                        </button>
                    </div>
                ) : null}
            </div>
        </aside>
    );
}

