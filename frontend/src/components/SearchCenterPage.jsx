import {useMemo, useState} from 'react';
import {ArrowLeft, Inbox, Mail, Paperclip, Search, Star} from 'lucide-react';
import {LoadMailbox} from '../../wailsjs/go/main/App';
import {
    formatCount,
    formatMessageTime,
    isStarredMessage,
    isUnreadMessage
} from '../app/utils';
import {searchMessages, searchMessageStats} from '../app/messageSearch';
import {EmptyState, StatusBadge} from './Common';

const filterOptions = [
    {id: 'all', label: '全部'},
    {id: 'unread', label: '未读'},
    {id: 'starred', label: '星标'},
    {id: 'attachments', label: '含附件'},
    {id: 'sent', label: '已发送'},
    {id: 'archive', label: '归档'}
];

const sortOptions = [
    {id: 'relevance', label: '相关度'},
    {id: 'newest', label: '最新'},
    {id: 'oldest', label: '最早'}
];

function messageStateLabel(message) {
    if (message.direction === 'outbound') {
        return '已发送';
    }
    if (message.archivedAt) {
        return '归档';
    }
    return isUnreadMessage(message) ? '未读' : '已读';
}

function statItems(stats) {
    return [
        {label: '已加载', value: stats.total, icon: Mail},
        {label: '未读', value: stats.unread, icon: Inbox},
        {label: '星标', value: stats.starred, icon: Star},
        {label: '含附件', value: stats.attachments, icon: Paperclip}
    ];
}

export function SearchCenterPage({busy, onBack, onLoadMore, onOpenMessage, selectedProfile, workspace}) {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [sort, setSort] = useState('relevance');
    const [scopeMessages, setScopeMessages] = useState([]);
    const [scopeLabel, setScopeLabel] = useState('');
    const [scopeLoading, setScopeLoading] = useState(false);
    const [scopeError, setScopeError] = useState('');
    const messages = scopeMessages.length ? scopeMessages : workspace?.messages || [];
    const stats = useMemo(() => searchMessageStats(messages), [messages]);
    const results = useMemo(() => searchMessages(messages, {filter, query, sort}), [filter, messages, query, sort]);
    const loadingMore = busy === 'mailbox-more';
    const scopedSearch = scopeMessages.length > 0;

    async function loadProfileSearchScope() {
        if (!selectedProfile?.id) {
            return;
        }

        const domains = (workspace?.domains || []).length
            ? workspace.domains
            : [workspace?.selectedDomain].filter(Boolean);
        if (!domains.length) {
            return;
        }

        setScopeLoading(true);
        setScopeError('');

        try {
            const loaded = [];
            let accountCount = 0;

            for (const domain of domains) {
                const domainPayload = await LoadMailbox({
                    profileId: selectedProfile.id,
                    domain,
                    messageLimit: 1,
                    messageOffset: 0
                });
                const accounts = domainPayload?.accounts || [];
                accountCount += accounts.length;

                for (const account of accounts) {
                    const accountPayload = await LoadMailbox({
                        profileId: selectedProfile.id,
                        domain,
                        accountId: account.id,
                        messageLimit: 100,
                        messageOffset: 0
                    });
                    loaded.push(...(accountPayload?.messages || []).map((message) => ({
                        ...message,
                        accountId: message.accountId || account.id,
                        accountAddress: account.address || account.label || account.id,
                        searchScopeDomain: domain
                    })));
                }
            }

            const unique = Array.from(new Map(loaded.map((message) => [`${message.accountId || ''}:${message.id}`, message])).values());
            setScopeMessages(unique);
            setScopeLabel(`${domains.length} 个域名 · ${accountCount} 个账号 · ${unique.length} 封已加载邮件`);
        } catch (scopeLoadError) {
            setScopeError(scopeLoadError.message || '无法扩展搜索范围。');
        } finally {
            setScopeLoading(false);
        }
    }

    return (
        <main id="reader" className="workspace-page workspace-search-page" aria-label="搜索中心">
            <header className="workspace-page-header workspace-page-header-row">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回邮箱
                </button>
                <div>
                    <p>搜索</p>
                    <h1>搜索中心</h1>
                    <small>{selectedProfile?.baseUrl || '尚未选择接入点'}</small>
                </div>
                {workspace?.hasMoreMessages ? (
                    <button className="workspace-header-action" type="button" onClick={onLoadMore} disabled={loadingMore}>
                        <Inbox size={16} />
                        {loadingMore ? '加载中' : '加载更多'}
                    </button>
                ) : null}
            </header>

            {!selectedProfile?.hasToken ? (
                <EmptyState
                    icon={Search}
                    title="接入点尚未授权"
                    body="授权后可搜索当前邮箱已加载的邮件。"
                />
            ) : !workspace?.selectedAccountId ? (
                <EmptyState
                    icon={Mail}
                    title="先选择邮箱账号"
                    body="选择账号后会显示当前邮箱的搜索结果。"
                />
            ) : (
                <div className="workspace-page-body search-center-layout">
                    <section className="search-center-metrics" aria-label="搜索指标">
                        {statItems(stats).map((item) => {
                            const Icon = item.icon;
                            return (
                                <article key={item.label}>
                                    <Icon size={17} />
                                    <strong>{formatCount(item.value)}</strong>
                                    <small>{item.label}</small>
                                </article>
                            );
                        })}
                    </section>

                    <section className="search-center-controls" aria-label="搜索条件">
                        <label className="search-center-box">
                            <Search size={17} />
                            <input
                                autoFocus
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="搜索主题、联系人、正文或附件"
                            />
                        </label>
                        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="搜索排序">
                            {sortOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </section>

                    <section className="search-scope-panel" aria-label="搜索范围">
                        <span>
                            <strong>{scopedSearch ? '接入点范围' : '当前邮箱范围'}</strong>
                            <small>{scopedSearch ? scopeLabel : '默认搜索当前已加载邮箱；可手动扩展到当前接入点的域名和账号。'}</small>
                            {scopeError ? <em>{scopeError}</em> : null}
                        </span>
                        <div>
                            <button type="button" onClick={loadProfileSearchScope} disabled={scopeLoading}>
                                {scopeLoading ? '扩展中' : scopedSearch ? '刷新范围' : '扩展到接入点'}
                            </button>
                            {scopedSearch ? <button type="button" onClick={() => { setScopeMessages([]); setScopeLabel(''); }}>恢复当前邮箱</button> : null}
                        </div>
                    </section>

                    <div className="search-filter-tabs" role="tablist" aria-label="搜索范围">
                        {filterOptions.map((option) => (
                            <button
                                key={option.id}
                                className={filter === option.id ? 'active' : ''}
                                type="button"
                                role="tab"
                                aria-selected={filter === option.id}
                                onClick={() => setFilter(option.id)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <section className="search-result-list" aria-label="搜索结果">
                        {results.length ? (
                            results.map((result) => (
                                <SearchResultItem
                                    key={`${result.message.accountId || result.message.accountAddress || ''}:${result.message.id}`}
                                    result={result}
                                    onOpenMessage={onOpenMessage}
                                />
                            ))
                        ) : (
                            <EmptyState
                                icon={Search}
                                title={messages.length ? '没有匹配结果' : '当前邮箱暂无邮件'}
                                body={messages.length ? '调整关键词或筛选条件后再查看。' : '加载邮件后，这里会汇总当前邮箱的搜索结果。'}
                            />
                        )}
                    </section>
                </div>
            )}
        </main>
    );
}

function SearchResultItem({onOpenMessage, result}) {
    const message = result.message;
    const attachments = message.attachments || [];

    return (
        <button className="search-result-item" type="button" onClick={() => onOpenMessage(message)}>
            <span className="search-result-avatar">
                {(message.author || message.email || 'M').slice(0, 1).toUpperCase()}
            </span>
            <span className="search-result-copy">
                <span className="search-result-title">
                    <strong>{message.subject || '无主题'}</strong>
                    <StatusBadge ok={isUnreadMessage(message)} label={messageStateLabel(message)} />
                </span>
                    <small>
                        {message.author || message.email || '未知联系人'} · {message.accountAddress || message.searchScopeDomain || '当前账号'} · {formatMessageTime(message.time)}
                    </small>
                <em>{result.snippet || message.preview || '无预览内容'}</em>
                <span className="search-result-meta">
                    {isStarredMessage(message) ? <span><Star size={13} /> 星标</span> : null}
                    {attachments.length ? <span><Paperclip size={13} /> {attachments.length} 个附件</span> : null}
                    {result.score > 0 ? <span>相关度 {result.score}</span> : null}
                </span>
            </span>
        </button>
    );
}
