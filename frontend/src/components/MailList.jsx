import {useEffect, useMemo, useRef, useState} from 'react';
import {Archive, ArchiveRestore, Inbox, Mail, MailOpen, MailPlus, RefreshCw, Search, Settings, Star, Trash2} from 'lucide-react';
import {folders, formatMessageTime, isStarredMessage, isUnreadMessage} from '../app/utils';
import {EmptyState, IconButton, LoadingList} from './Common';

const virtualRowHeight = 98;
const virtualOverscan = 6;
const virtualThreshold = 80;

export function EmailListPanel({
    activeFolder,
    busy,
    messages,
    onCompose,
    onContextMenu,
    onLoadMore,
    onMessageSelect,
    onReload,
    searchInputRef,
    searchQuery,
    selectedMessageId,
    selectedProfile,
    setSearchQuery,
    workspace
}) {
    const listRef = useRef(null);
    const [viewport, setViewport] = useState({height: 0, scrollTop: 0});
    const folder = folders.find((item) => item.id === activeFolder);
    const mailboxBusy = busy === 'mailbox' || busy === 'mailbox-more';
    const virtualMessages = useMemo(() => {
        if (messages.length <= virtualThreshold || viewport.height <= 0) {
            return {
                items: messages,
                padBottom: 0,
                padTop: 0,
                startIndex: 0
            };
        }

        const startIndex = Math.max(0, Math.floor(viewport.scrollTop / virtualRowHeight) - virtualOverscan);
        const visibleCount = Math.ceil(viewport.height / virtualRowHeight) + virtualOverscan * 2;
        const endIndex = Math.min(messages.length, startIndex + visibleCount);

        return {
            items: messages.slice(startIndex, endIndex),
            padBottom: Math.max(0, (messages.length - endIndex) * virtualRowHeight),
            padTop: startIndex * virtualRowHeight,
            startIndex
        };
    }, [messages, viewport.height, viewport.scrollTop]);

    useEffect(() => {
        const list = listRef.current;
        if (!list) {
            return undefined;
        }

        const updateViewport = () => {
            setViewport({
                height: list.clientHeight,
                scrollTop: list.scrollTop
            });
        };

        updateViewport();
        list.addEventListener('scroll', updateViewport, {passive: true});
        const observer = window.ResizeObserver ? new window.ResizeObserver(updateViewport) : null;
        observer?.observe(list);

        return () => {
            list.removeEventListener('scroll', updateViewport);
            observer?.disconnect();
        };
    }, []);

    useEffect(() => {
        listRef.current?.scrollTo({top: 0});
    }, [activeFolder, searchQuery, workspace?.selectedAccountId]);

    useEffect(() => {
        const list = listRef.current;
        if (!list || messages.length <= virtualThreshold || !selectedMessageId) {
            return;
        }

        const selectedIndex = messages.findIndex((message) => message.id === selectedMessageId);
        if (selectedIndex < 0) {
            return;
        }

        const selectedTop = selectedIndex * virtualRowHeight;
        const selectedBottom = selectedTop + virtualRowHeight;
        if (selectedTop < list.scrollTop) {
            list.scrollTop = selectedTop;
        } else if (selectedBottom > list.scrollTop + list.clientHeight) {
            list.scrollTop = selectedBottom - list.clientHeight;
        }
    }, [messages, selectedMessageId]);

    return (
        <section className="list-panel" aria-label="邮件列表">
            <header className="list-header">
                <div>
                    <p>当前视图</p>
                    <h1>{folder?.label || '邮件'}</h1>
                </div>
                <div className="list-actions">
                    <IconButton icon={RefreshCw} label="刷新" onClick={onReload} disabled={!selectedProfile || mailboxBusy} spinning={busy === 'mailbox'} />
                    <IconButton icon={MailPlus} label="写邮件" onClick={onCompose} disabled={!workspace?.selectedAccountId} />
                </div>
            </header>

            <div className="search-box">
                <Search size={16} />
                <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索发件人、主题或正文"
                    aria-label="搜索邮件"
                />
                <kbd>Ctrl K</kbd>
            </div>

            <div className="message-list" ref={listRef} role="listbox" aria-label="邮件">
                {busy === 'initial' || busy === 'mailbox' ? (
                    <LoadingList />
                ) : messages.length > 0 ? (
                    <>
                        <div className="message-list-virtual">
                            {virtualMessages.padTop ? <span style={{height: virtualMessages.padTop}} aria-hidden="true" /> : null}
                            {virtualMessages.items.map((message, index) => (
                                <EmailListItem
                                    key={message.id}
                                    message={message}
                                    onContextMenu={(event) => onContextMenu(event, message)}
                                    onSelect={() => onMessageSelect(message.id)}
                                    position={virtualMessages.startIndex + index + 1}
                                    selected={message.id === selectedMessageId}
                                    total={messages.length}
                                />
                            ))}
                            {virtualMessages.padBottom ? <span style={{height: virtualMessages.padBottom}} aria-hidden="true" /> : null}
                        </div>
                        {workspace?.hasMoreMessages ? (
                            <button
                                className="load-more-messages"
                                type="button"
                                onClick={onLoadMore}
                                disabled={busy === 'mailbox-more'}
                            >
                                {busy === 'mailbox-more' ? '加载中' : `加载更多${workspace.totalMessages ? `（${messages.length}/${workspace.totalMessages}）` : ''}`}
                            </button>
                        ) : null}
                    </>
                ) : (
                    <EmptyState
                        icon={Inbox}
                        title={selectedProfile ? (workspace?.selectedAccountId ? '这里还没有邮件' : '先选择邮箱账号') : '先添加一个接入点'}
                        body={selectedProfile ? (workspace?.selectedAccountId ? '切换文件夹、搜索词或等待新的邮件进入。' : '选择邮箱账号后会加载对应邮件。') : '添加 OmniMail Worker Base URL 后即可加载邮箱。'}
                        action={selectedProfile && workspace?.selectedAccountId ? (
                            <button className="primary-action compact" type="button" onClick={onCompose}>
                                <MailPlus size={16} />
                                写邮件
                            </button>
                        ) : null}
                    />
                )}
            </div>
        </section>
    );
}

export function EmailListItem({message, onContextMenu, onSelect, position, selected, total}) {
    const unread = isUnreadMessage(message);
    const starred = isStarredMessage(message);

    return (
        <button
            className={`mail-row ${selected ? 'selected' : ''} ${unread ? 'unread' : ''} ${starred ? 'starred' : ''}`}
            type="button"
            role="option"
            aria-label={`${message.author || message.email || '未知发件人'}，${message.subject || '无主题'}`}
            aria-posinset={position}
            aria-selected={selected}
            aria-setsize={total}
            onClick={onSelect}
            onContextMenu={onContextMenu}
        >
            <span className={`unread-dot ${unread ? 'visible' : ''}`} />
            <span className="mail-row-main">
                <span className="mail-row-top">
                    <strong>{message.author || message.email || '未知发件人'}</strong>
                    <span className="mail-row-time">
                        {starred ? <Star size={12} fill="currentColor" /> : null}
                        <time>{formatMessageTime(message.time)}</time>
                    </span>
                </span>
                <span className="mail-row-subject">{message.subject || '无主题'}</span>
                <span className="mail-row-preview">{message.preview || message.body || '无预览内容'}</span>
            </span>
        </button>
    );
}

export function ReaderToolbar({busy, onArchive, onDelete, onOpenSettings, onReload, onSetStatus, selectedMessage, selectedProfile}) {
    const unread = isUnreadMessage(selectedMessage);
    const starred = isStarredMessage(selectedMessage);
    const mailboxBusy = busy === 'mailbox' || busy === 'mailbox-more';

    return (
        <header className="reader-toolbar">
            <div>
                <p>{selectedProfile?.baseUrl || '未选择接入点'}</p>
                <h2>{selectedMessage?.subject || '阅读区'}</h2>
            </div>
            <div className="toolbar-actions">
                <IconButton icon={RefreshCw} label="刷新" onClick={onReload} disabled={!selectedProfile || mailboxBusy} spinning={busy === 'mailbox'} />
                <IconButton
                    icon={unread ? MailOpen : Mail}
                    label={unread ? '标记已读' : '标记未读'}
                    onClick={() => onSetStatus(selectedMessage, {read: unread})}
                    disabled={!selectedMessage || selectedMessage.direction === 'outbound' || busy === 'message-action'}
                />
                <IconButton
                    active={starred}
                    icon={Star}
                    label={starred ? '取消星标' : '添加星标'}
                    onClick={() => onSetStatus(selectedMessage, {starred: !starred})}
                    disabled={!selectedMessage || busy === 'message-action'}
                />
                <IconButton icon={selectedMessage?.archivedAt ? ArchiveRestore : Archive} label={selectedMessage?.archivedAt ? '取消归档' : '归档'} onClick={onArchive} disabled={!selectedMessage || busy === 'message-action'} />
                <IconButton icon={Trash2} label="删除" onClick={onDelete} disabled={!selectedMessage || busy === 'message-action'} tone="danger" />
                <IconButton icon={Settings} label="设置" onClick={onOpenSettings} />
            </div>
        </header>
    );
}

