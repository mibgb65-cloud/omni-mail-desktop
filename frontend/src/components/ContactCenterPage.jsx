import {useMemo, useState} from 'react';
import {ArrowLeft, Copy, Inbox, Mail, MailPlus, Paperclip, Search, Star, Users} from 'lucide-react';
import {collectContacts, contactStats, filterContacts, sortContacts} from '../app/contactCenter';
import {formatCount, formatMessageTime} from '../app/utils';
import {EmptyState, StatusBadge} from './Common';

const filterOptions = [
    {id: 'all', label: '全部'},
    {id: 'unread', label: '未读'},
    {id: 'starred', label: '星标'},
    {id: 'attachments', label: '含附件'},
    {id: 'outbound', label: '已联系'}
];

const sortOptions = [
    {id: 'recent', label: '最近往来'},
    {id: 'messages', label: '邮件最多'},
    {id: 'name', label: '名称'}
];

function statItems(stats) {
    return [
        {label: '联系人', value: stats.total, icon: Users},
        {label: '未读往来', value: stats.unread, icon: Inbox},
        {label: '星标往来', value: stats.starred, icon: Star},
        {label: '含附件', value: stats.attachments, icon: Paperclip}
    ];
}

export function ContactCenterPage({
    busy,
    onBack,
    onComposeContact,
    onCopy,
    onLoadMore,
    onOpenMessage,
    selectedProfile,
    workspace
}) {
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [sort, setSort] = useState('recent');
    const messages = workspace?.messages || [];
    const contacts = useMemo(() => collectContacts(messages), [messages]);
    const stats = useMemo(() => contactStats(contacts), [contacts]);
    const visibleContacts = useMemo(() => {
        const filtered = filterContacts(contacts, {filter, query});
        return sortContacts(filtered, sort);
    }, [contacts, filter, query, sort]);
    const loadingMore = busy === 'mailbox-more';

    return (
        <main id="reader" className="workspace-page workspace-contacts-page" aria-label="联系人中心">
            <header className="workspace-page-header workspace-page-header-row">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回邮箱
                </button>
                <div>
                    <p>联系人</p>
                    <h1>联系人中心</h1>
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
                    icon={Users}
                    title="接入点尚未授权"
                    body="授权后可查看当前邮箱已加载邮件中的联系人。"
                />
            ) : !workspace?.selectedAccountId ? (
                <EmptyState
                    icon={Mail}
                    title="先选择邮箱账号"
                    body="选择账号后会显示该邮箱当前已加载邮件中的联系人。"
                />
            ) : (
                <div className="workspace-page-body contact-center-layout">
                    <section className="contact-center-metrics" aria-label="联系人指标">
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

                    <section className="contact-center-controls" aria-label="联系人筛选">
                        <label className="contact-search-box">
                            <Search size={17} />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="搜索联系人、邮箱或最近主题"
                            />
                        </label>
                        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="联系人排序">
                            {sortOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </section>

                    <div className="contact-filter-tabs" role="tablist" aria-label="联系人范围">
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

                    <section className="contact-center-list" aria-label="联系人列表">
                        {visibleContacts.length ? (
                            visibleContacts.map((contact) => (
                                <ContactCard
                                    contact={contact}
                                    key={contact.email}
                                    onComposeContact={onComposeContact}
                                    onCopy={onCopy}
                                    onOpenMessage={onOpenMessage}
                                />
                            ))
                        ) : (
                            <EmptyState
                                icon={Users}
                                title={contacts.length ? '没有匹配的联系人' : '当前邮箱暂无联系人'}
                                body={contacts.length ? '调整关键词或筛选条件后再查看。' : '加载邮件后，这里会按邮箱地址汇总联系人。'}
                            />
                        )}
                    </section>
                </div>
            )}
        </main>
    );
}

function ContactCard({contact, onComposeContact, onCopy, onOpenMessage}) {
    const lastMessage = contact.lastMessage || {};
    const label = contact.inbound && contact.outbound ? '双向往来' : contact.outbound ? '已联系' : '来信联系人';

    return (
        <article className="contact-card">
            <span className="contact-avatar">{(contact.name || contact.email || 'C').slice(0, 1).toUpperCase()}</span>
            <div className="contact-copy">
                <div className="contact-title-row">
                    <span>
                        <strong>{contact.name || contact.email}</strong>
                        <small>{contact.email}</small>
                    </span>
                    <StatusBadge ok={contact.unread > 0} label={label} />
                </div>
                <div className="contact-stat-row">
                    <span>{formatCount(contact.messages)} 封邮件</span>
                    <span>{formatCount(contact.inbound)} 收</span>
                    <span>{formatCount(contact.outbound)} 发</span>
                    {contact.attachments ? <span>{formatCount(contact.attachments)} 个附件</span> : null}
                </div>
                <button className="contact-last-message" type="button" onClick={() => onOpenMessage(lastMessage)} disabled={!lastMessage.id}>
                    <Mail size={14} />
                    <span>{lastMessage.subject || '无主题'}</span>
                    <small>{formatMessageTime(contact.lastTime)}</small>
                </button>
            </div>
            <div className="contact-actions">
                <button type="button" onClick={() => onCopy(contact.email, '邮箱地址')}>
                    <Copy size={16} />
                    复制
                </button>
                <button type="button" onClick={() => onComposeContact(contact)}>
                    <MailPlus size={16} />
                    写邮件
                </button>
            </div>
        </article>
    );
}
