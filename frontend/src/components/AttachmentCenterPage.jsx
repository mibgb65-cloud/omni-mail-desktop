import {useMemo, useState} from 'react';
import {ArrowLeft, Download, Eye, FileText, Inbox, Mail, Paperclip, Search} from 'lucide-react';
import {
    attachmentCenterStats,
    collectMessageAttachments,
    filterMessageAttachments,
    formatCount,
    formatFileSize,
    formatMessageTime,
    sortMessageAttachments
} from '../app/utils';
import {EmptyState, StatusBadge} from './Common';
import {AttachmentPreviewDialog} from './ReadingView';

const groupOptions = [
    {id: 'all', label: '全部'},
    {id: 'previewable', label: '可预览'},
    {id: 'images', label: '图片'},
    {id: 'documents', label: '文档'},
    {id: 'archives', label: '压缩包'},
    {id: 'other', label: '其他'}
];

const sortOptions = [
    {id: 'newest', label: '最新邮件'},
    {id: 'largest', label: '文件最大'},
    {id: 'name', label: '文件名'}
];

function metricItems(stats) {
    return [
        {label: '附件', value: formatCount(stats.total)},
        {label: '总大小', value: formatFileSize(stats.totalSize)},
        {label: '可预览', value: formatCount(stats.previewable)},
        {label: '可下载', value: formatCount(stats.downloadable)}
    ];
}

export function AttachmentCenterPage({
    busy,
    onBack,
    onDownload,
    onLoadMore,
    onOpenMessage,
    onPreview,
    selectedProfile,
    workspace
}) {
    const [query, setQuery] = useState('');
    const [activeGroup, setActiveGroup] = useState('all');
    const [sortKey, setSortKey] = useState('newest');
    const [attachmentPreview, setAttachmentPreview] = useState({
        status: 'idle',
        attachment: null,
        result: null,
        error: ''
    });

    const attachments = useMemo(() => collectMessageAttachments(workspace?.messages || []), [workspace?.messages]);
    const stats = useMemo(() => attachmentCenterStats(attachments), [attachments]);
    const visibleAttachments = useMemo(() => {
        const filtered = filterMessageAttachments(attachments, {group: activeGroup, query});
        return sortMessageAttachments(filtered, sortKey);
    }, [activeGroup, attachments, query, sortKey]);
    const loadingMore = busy === 'mailbox-more';

    async function openPreview(attachment) {
        if (!onPreview || !attachment.downloadable || !attachment.previewable) {
            return;
        }

        setAttachmentPreview({
            status: 'loading',
            attachment,
            result: null,
            error: ''
        });

        try {
            const result = await onPreview(attachment);
            setAttachmentPreview({
                status: 'ready',
                attachment,
                result,
                error: ''
            });
        } catch (previewError) {
            setAttachmentPreview({
                status: 'error',
                attachment,
                result: null,
                error: previewError.message || '附件预览失败'
            });
        }
    }

    function closePreview() {
        setAttachmentPreview({
            status: 'idle',
            attachment: null,
            result: null,
            error: ''
        });
    }

    return (
        <main id="reader" className="workspace-page workspace-attachments-page" aria-label="附件中心">
            <header className="workspace-page-header workspace-page-header-row">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回邮箱
                </button>
                <div>
                    <p>附件</p>
                    <h1>附件中心</h1>
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
                    icon={Paperclip}
                    title="接入点尚未授权"
                    body="授权后可查看当前邮箱已加载邮件中的附件。"
                />
            ) : !workspace?.selectedAccountId ? (
                <EmptyState
                    icon={Mail}
                    title="先选择邮箱账号"
                    body="选择账号后会显示该邮箱当前已加载邮件中的附件。"
                />
            ) : (
                <div className="workspace-page-body attachment-center-layout">
                    <section className="attachment-center-metrics" aria-label="附件指标">
                        {metricItems(stats).map((item) => (
                            <article key={item.label}>
                                <strong>{item.value}</strong>
                                <small>{item.label}</small>
                            </article>
                        ))}
                    </section>

                    <section className="attachment-center-controls" aria-label="附件筛选">
                        <label className="attachment-search-box">
                            <Search size={16} />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="搜索附件、主题或联系人"
                            />
                        </label>
                        <select value={sortKey} onChange={(event) => setSortKey(event.target.value)} aria-label="附件排序">
                            {sortOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </section>

                    <div className="attachment-filter-tabs" role="tablist" aria-label="附件类型">
                        {groupOptions.map((option) => (
                            <button
                                key={option.id}
                                className={activeGroup === option.id ? 'active' : ''}
                                type="button"
                                role="tab"
                                aria-selected={activeGroup === option.id}
                                onClick={() => setActiveGroup(option.id)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <section className="attachment-center-list" aria-label="附件列表">
                        {visibleAttachments.length ? (
                            visibleAttachments.map((attachment) => (
                                <AttachmentCenterItem
                                    attachment={attachment}
                                    busy={busy}
                                    key={attachment.attachmentKey}
                                    onDownload={onDownload}
                                    onOpenMessage={onOpenMessage}
                                    onPreview={openPreview}
                                />
                            ))
                        ) : (
                            <EmptyState
                                icon={FileText}
                                title={attachments.length ? '没有匹配的附件' : '当前邮箱暂无附件'}
                                body={attachments.length ? '调整搜索词或类型筛选后再查看。' : '加载包含附件的邮件后，这里会按文件汇总显示。'}
                            />
                        )}
                    </section>
                </div>
            )}

            <AttachmentPreviewDialog preview={attachmentPreview} onClose={closePreview} onDownload={onDownload} />
        </main>
    );
}

function AttachmentCenterItem({attachment, busy, onDownload, onOpenMessage, onPreview}) {
    const previewable = attachment.downloadable && attachment.previewable;
    const downloading = busy === 'download';
    const previewing = busy === 'preview';

    return (
        <article className="attachment-center-item">
            <span className="attachment-center-kind" aria-label={attachment.kindLabel}>
                <FileText size={17} />
                <em>{attachment.kindShort}</em>
            </span>
            <div className="attachment-center-copy">
                <strong>{attachment.filename}</strong>
                <small>
                    {attachment.kindLabel} · {formatFileSize(attachment.size)}
                    {attachment.mimeType ? ` · ${attachment.mimeType}` : ''}
                </small>
                <button type="button" onClick={() => onOpenMessage(attachment.message)}>
                    <Mail size={14} />
                    <span>{attachment.messageSubject}</span>
                    <small>{attachment.messageAuthor} · {formatMessageTime(attachment.messageTime)}</small>
                </button>
            </div>
            <div className="attachment-center-actions">
                <StatusBadge ok={previewable} label={previewable ? '可预览' : '不可预览'} />
                <button
                    type="button"
                    onClick={() => onPreview(attachment)}
                    disabled={!previewable || previewing}
                    title={previewable ? '预览附件' : '该附件类型暂不支持预览'}
                    aria-label={`预览附件 ${attachment.filename}`}
                >
                    <Eye size={16} />
                    预览
                </button>
                <button
                    type="button"
                    onClick={() => onDownload(attachment)}
                    disabled={!attachment.downloadable || downloading}
                    title={attachment.downloadable ? '保存附件' : '附件内容未存储'}
                    aria-label={`保存附件 ${attachment.filename}`}
                >
                    <Download size={16} />
                    保存
                </button>
            </div>
        </article>
    );
}
