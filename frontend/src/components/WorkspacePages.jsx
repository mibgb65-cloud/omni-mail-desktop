import {Activity, ArrowLeft, BarChart3, Clock3, Globe2, Inbox, Mail, MailPlus, Paperclip, RefreshCw, Search, Settings, ShieldCheck, Star, Users} from 'lucide-react';
import {formatCount, formatMessageTime, isStarredMessage, isUnreadMessage} from '../app/utils';
import {EmptyState, StatusBadge} from './Common';
import {AttachmentCenterPage} from './AttachmentCenterPage';
import {ContactCenterPage} from './ContactCenterPage';
import {AuditLogPanel, DiagnosticsPanel} from './InsightsPanels';
import {SearchCenterPage} from './SearchCenterPage';
import {SettingsPage} from './SettingsPage';

function workspaceMetrics({folderCounts, messages, workspace}) {
    const accounts = workspace?.accounts || [];
    const domains = workspace?.domains || [];
    const attachments = messages.reduce((total, message) => total + (message.attachments?.length || 0), 0);

    return [
        {icon: Inbox, label: '收件箱', value: folderCounts.inbox || 0},
        {icon: Mail, label: '全部邮件', value: workspace?.totalMessages || messages.length},
        {icon: Users, label: '邮箱账号', value: accounts.length},
        {icon: Globe2, label: '域名', value: domains.length},
        {icon: Star, label: '星标', value: messages.filter(isStarredMessage).length},
        {icon: Paperclip, label: '附件', value: attachments}
    ];
}

function messageLabel(message) {
    if (message.direction === 'outbound') {
        return '已发送';
    }
    if (message.archivedAt) {
        return '归档';
    }
    return isUnreadMessage(message) ? '未读' : '已读';
}

function accountLabel(account) {
    return account?.name || account?.label || account?.address || '未选择账号';
}

export function WorkspacePageRouter({
    auditLogs,
    busy,
    canClearCurrentDraft,
    diagnostics,
    folderCounts,
    insightsProfileId,
    onBack,
    onClearCurrentDraft,
    onCompose,
    onComposeContact,
    onCopyText,
    onDownloadAttachment,
    onLoadInsights,
    onLoadMoreMessages,
    onManageAccounts,
    onManageDomains,
    onNotify,
    onOpenActivity,
    onOpenAttachments,
    onOpenContacts,
    onOpenMessage,
    onOpenProfiles,
    onOpenSearch,
    onOpenSettings,
    onPreviewAttachment,
    onProfileUpdate,
    onReloadMailbox,
    onResetLayout,
    page,
    profiles,
    selectedAccount,
    selectedProfile,
    status,
    storagePath,
    theme,
    toggleTheme,
    updateManager,
    workspace
}) {
    if (page === 'dashboard') {
        return (
            <DashboardPage
                busy={busy}
                folderCounts={folderCounts}
                onBack={onBack}
                onCompose={onCompose}
                onManageAccounts={onManageAccounts}
                onManageDomains={onManageDomains}
                onOpenActivity={onOpenActivity}
                onOpenAttachments={onOpenAttachments}
                onOpenContacts={onOpenContacts}
                onOpenMessage={onOpenMessage}
                onOpenSearch={onOpenSearch}
                onOpenSettings={onOpenSettings}
                onReloadMailbox={onReloadMailbox}
                profiles={profiles}
                selectedAccount={selectedAccount}
                selectedProfile={selectedProfile}
                workspace={workspace}
            />
        );
    }

    if (page === 'attachments') {
        return (
            <AttachmentCenterPage
                busy={busy}
                onBack={onBack}
                onDownload={onDownloadAttachment}
                onLoadMore={onLoadMoreMessages}
                onOpenMessage={onOpenMessage}
                onPreview={onPreviewAttachment}
                selectedProfile={selectedProfile}
                workspace={workspace}
            />
        );
    }

    if (page === 'search') {
        return (
            <SearchCenterPage
                busy={busy}
                onBack={onBack}
                onLoadMore={onLoadMoreMessages}
                onOpenMessage={onOpenMessage}
                selectedProfile={selectedProfile}
                workspace={workspace}
            />
        );
    }

    if (page === 'contacts') {
        return (
            <ContactCenterPage
                busy={busy}
                onBack={onBack}
                onComposeContact={onComposeContact}
                onCopy={onCopyText}
                onLoadMore={onLoadMoreMessages}
                onOpenMessage={onOpenMessage}
                selectedProfile={selectedProfile}
                workspace={workspace}
            />
        );
    }

    if (page === 'activity') {
        return (
            <ActivityPage
                auditLogs={auditLogs}
                busy={busy}
                diagnostics={diagnostics}
                insightsProfileId={insightsProfileId}
                onBack={onBack}
                onLoadInsights={onLoadInsights}
                selectedProfile={selectedProfile}
                workspace={workspace}
            />
        );
    }

    return (
        <SettingsPage
            auditLogs={auditLogs}
            busy={busy}
            canClearCurrentDraft={canClearCurrentDraft}
            diagnostics={diagnostics}
            insightsProfileId={insightsProfileId}
            onBack={onBack}
            onClearCurrentDraft={onClearCurrentDraft}
            onLoadInsights={onLoadInsights}
            onNotify={onNotify}
            onOpenProfiles={onOpenProfiles}
            onProfileUpdate={onProfileUpdate}
            onReloadMailbox={onReloadMailbox}
            onResetLayout={onResetLayout}
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

export function DashboardPage({
    busy,
    folderCounts,
    onBack,
    onCompose,
    onManageAccounts,
    onManageDomains,
    onOpenActivity,
    onOpenAttachments,
    onOpenContacts,
    onOpenMessage,
    onOpenSearch,
    onOpenSettings,
    onReloadMailbox,
    profiles,
    selectedAccount,
    selectedProfile,
    workspace
}) {
    const messages = workspace?.messages || [];
    const metrics = workspaceMetrics({folderCounts, messages, workspace});
    const attentionMessages = messages
        .filter((message) => isUnreadMessage(message) || isStarredMessage(message))
        .slice(0, 5);
    const recentMessages = messages.slice(0, 6);
    const mailboxBusy = busy === 'mailbox' || busy === 'mailbox-more';

    return (
        <main id="reader" className="workspace-page workspace-dashboard-page" aria-label="工作台总览">
            <header className="workspace-page-header">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回邮箱
                </button>
                <div>
                    <p>总览</p>
                    <h1>工作台总览</h1>
                    <small>{selectedProfile?.baseUrl || '尚未选择接入点'}</small>
                </div>
            </header>

            {!selectedProfile ? (
                <EmptyState
                    icon={ShieldCheck}
                    title="先选择接入点"
                    body="选择接入点后会显示邮箱、域名、账号和最近活动。"
                />
            ) : (
                <div className="workspace-page-body dashboard-layout">
                    <section className="dashboard-hero">
                        <div>
                            <p>当前接入点</p>
                            <h2>{selectedProfile.name || 'OmniMail'}</h2>
                            <small>{accountLabel(selectedAccount)} · {workspace?.selectedDomain || '未选择域名'}</small>
                        </div>
                        <StatusBadge ok={Boolean(selectedProfile.hasToken)} label={selectedProfile.hasToken ? '已授权' : '未授权'} />
                    </section>

                    <section className="dashboard-metrics" aria-label="工作台指标">
                        {metrics.map((item) => {
                            const Icon = item.icon;
                            return (
                                <article key={item.label}>
                                    <Icon size={18} />
                                    <strong>{formatCount(item.value)}</strong>
                                    <small>{item.label}</small>
                                </article>
                            );
                        })}
                    </section>

                    <section className="dashboard-actions" aria-label="常用操作">
                        <button type="button" onClick={onCompose} disabled={!workspace?.selectedAccountId}>
                            <MailPlus size={16} />
                            写邮件
                        </button>
                        <button type="button" onClick={onReloadMailbox} disabled={!selectedProfile?.hasToken || mailboxBusy}>
                            <RefreshCw size={16} />
                            {mailboxBusy ? '刷新中' : '刷新邮箱'}
                        </button>
                        <button type="button" onClick={onManageAccounts} disabled={!selectedProfile?.hasToken}>
                            <Users size={16} />
                            管理账号
                        </button>
                        <button type="button" onClick={onManageDomains} disabled={!selectedProfile?.hasToken}>
                            <Globe2 size={16} />
                            管理域名
                        </button>
                        <button type="button" onClick={onOpenActivity} disabled={!selectedProfile?.hasToken}>
                            <Activity size={16} />
                            活动中心
                        </button>
                        <button type="button" onClick={onOpenAttachments} disabled={!selectedProfile?.hasToken || !workspace?.selectedAccountId}>
                            <Paperclip size={16} />
                            附件中心
                        </button>
                        <button type="button" onClick={onOpenSearch} disabled={!selectedProfile?.hasToken || !workspace?.selectedAccountId}>
                            <Search size={16} />
                            搜索中心
                        </button>
                        <button type="button" onClick={onOpenContacts} disabled={!selectedProfile?.hasToken || !workspace?.selectedAccountId}>
                            <Users size={16} />
                            联系人中心
                        </button>
                        <button type="button" onClick={onOpenSettings}>
                            <Settings size={16} />
                            设置
                        </button>
                    </section>

                    <div className="dashboard-columns">
                        <MessageSummaryCard
                            emptyText="暂无需要关注的邮件。"
                            icon={Star}
                            messages={attentionMessages}
                            onOpenMessage={onOpenMessage}
                            title="优先处理"
                        />
                        <MessageSummaryCard
                            emptyText="当前邮箱列表为空。"
                            icon={Clock3}
                            messages={recentMessages}
                            onOpenMessage={onOpenMessage}
                            title="最近邮件"
                        />
                    </div>

                    <section className="dashboard-profile-grid">
                        <article>
                            <span>
                                <ShieldCheck size={16} />
                                接入点
                            </span>
                            <strong>{formatCount(profiles.length)}</strong>
                            <small>本机已保存接入点</small>
                        </article>
                        <article>
                            <span>
                                <Inbox size={16} />
                                未读
                            </span>
                            <strong>{formatCount(folderCounts.inbox || 0)}</strong>
                            <small>当前邮箱收件箱</small>
                        </article>
                        <article>
                            <span>
                                <BarChart3 size={16} />
                                已加载
                            </span>
                            <strong>{formatCount(messages.length)}</strong>
                            <small>{workspace?.hasMoreMessages ? '还有更多邮件' : '当前列表完整'}</small>
                        </article>
                    </section>
                </div>
            )}
        </main>
    );
}

export function ActivityPage({
    auditLogs,
    busy,
    diagnostics,
    insightsProfileId,
    onBack,
    onLoadInsights,
    selectedProfile,
    workspace
}) {
    const messages = workspace?.messages || [];
    const insightsLoaded = Boolean(selectedProfile && insightsProfileId === selectedProfile.id && diagnostics);
    const counts = insightsLoaded ? diagnostics.counts || {} : {};
    const recentMessages = messages.slice(0, 5);

    return (
        <main id="reader" className="workspace-page workspace-activity-page" aria-label="活动中心">
            <header className="workspace-page-header workspace-page-header-row">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回邮箱
                </button>
                <div>
                    <p>活动</p>
                    <h1>活动中心</h1>
                    <small>{selectedProfile?.baseUrl || '尚未选择接入点'}</small>
                </div>
                <button
                    className="workspace-header-action"
                    type="button"
                    onClick={() => onLoadInsights(selectedProfile)}
                    disabled={!selectedProfile?.hasToken || busy === 'insights'}
                >
                    <RefreshCw size={16} />
                    {busy === 'insights' ? '刷新中' : insightsLoaded ? '刷新诊断' : '读取诊断'}
                </button>
            </header>

            {!selectedProfile?.hasToken ? (
                <EmptyState
                    icon={Activity}
                    title="接入点尚未授权"
                    body="授权后可读取诊断、审计日志和最近活动。"
                />
            ) : (
                <div className="workspace-page-body activity-layout">
                    <section className="activity-metrics" aria-label="活动指标">
                        <MetricTile label="邮件" value={insightsLoaded ? counts.messages : messages.length} />
                        <MetricTile label="未读" value={insightsLoaded ? counts.unreadMessages : messages.filter(isUnreadMessage).length} />
                        <MetricTile label="账号" value={insightsLoaded ? counts.accounts : workspace?.accounts?.length || 0} />
                        <MetricTile label="审计" value={insightsLoaded ? counts.auditLogs : auditLogs.length} />
                    </section>

                    <section className="insight-panel activity-feed" aria-label="最近邮箱活动">
                        <header>
                            <div>
                                <p>邮箱活动</p>
                                <h3>最近邮件</h3>
                            </div>
                            <StatusBadge ok={recentMessages.length > 0} label={recentMessages.length ? `${recentMessages.length} 条` : '暂无'} />
                        </header>
                        {recentMessages.length ? (
                            <div className="activity-feed-list">
                                {recentMessages.map((message) => (
                                    <article key={message.id}>
                                        <span>{messageLabel(message)}</span>
                                        <strong>{message.subject || '无主题'}</strong>
                                        <small>{message.author || message.email || '未知发件人'} · {formatMessageTime(message.time)}</small>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <p className="insight-empty">当前账号还没有可展示的邮件活动。</p>
                        )}
                    </section>

                    {insightsLoaded ? (
                        <>
                            <DiagnosticsPanel diagnostics={diagnostics} />
                            <AuditLogPanel logs={auditLogs} />
                        </>
                    ) : (
                        <section className="insight-panel">
                            <header>
                                <div>
                                    <p>接入点诊断</p>
                                    <h3>尚未读取诊断数据</h3>
                                    <small>诊断数据包含 Worker 绑定、部署进度、数据量和最近审计。</small>
                                </div>
                                <StatusBadge ok={false} label="未读取" />
                            </header>
                        </section>
                    )}
                </div>
            )}
        </main>
    );
}

function MetricTile({label, value}) {
    return (
        <article>
            <strong>{formatCount(value)}</strong>
            <small>{label}</small>
        </article>
    );
}

function MessageSummaryCard({emptyText, icon: Icon, messages, onOpenMessage, title}) {
    return (
        <section className="dashboard-message-card">
            <header>
                <span>
                    <Icon size={16} />
                    {title}
                </span>
                <StatusBadge ok={messages.length > 0} label={messages.length ? `${messages.length} 条` : '暂无'} />
            </header>
            {messages.length ? (
                <div className="dashboard-message-list">
                    {messages.map((message) => (
                        <button type="button" key={message.id} onClick={() => onOpenMessage(message)}>
                            <span>{messageLabel(message)}</span>
                            <strong>{message.subject || '无主题'}</strong>
                            <small>{message.author || message.email || '未知发件人'} · {formatMessageTime(message.time)}</small>
                        </button>
                    ))}
                </div>
            ) : (
                <p>{emptyText}</p>
            )}
        </section>
    );
}
