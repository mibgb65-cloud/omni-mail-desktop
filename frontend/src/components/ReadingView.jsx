import {lazy, Suspense, useEffect, useState} from 'react';
import {Archive, ArchiveRestore, CircleAlert, Download, Eye, FileText, Mail, MailOpen, RefreshCw, ShieldCheck, Star, Trash2, X} from 'lucide-react';
import {ReleaseAttachmentPreview} from '../../wailsjs/go/main/App';
import {attachmentKind, formatFileSize, formatMessageTime, isPreviewableAttachment, isStarredMessage, isUnreadMessage} from '../app/utils';
import {EmptyState, IconButton, ReadingSkeleton} from './Common';

const PdfAttachmentPreview = lazy(() => import('../PdfAttachmentPreview.jsx'));

export function ReadingView({busy, message, onArchive, onDelete, onDownload, onPreview, onSetStatus, selectedProfile}) {
    const [detailsExpanded, setDetailsExpanded] = useState(false);
    const [attachmentPreview, setAttachmentPreview] = useState({
        status: 'idle',
        attachment: null,
        result: null,
        error: ''
    });

    useEffect(() => {
        setDetailsExpanded(false);
        setAttachmentPreview({
            status: 'idle',
            attachment: null,
            result: null,
            error: ''
        });
    }, [message?.id]);

    async function openAttachmentPreview(attachment) {
        if (!onPreview || !attachment.downloadable || !isPreviewableAttachment(attachment)) {
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

    function closeAttachmentPreview() {
        setAttachmentPreview({
            status: 'idle',
            attachment: null,
            result: null,
            error: ''
        });
    }

    if (busy === 'initial') {
        return <ReadingSkeleton />;
    }

    if (!selectedProfile) {
        return (
            <EmptyState
                icon={ShieldCheck}
                title="连接你的 OmniMail"
                body="左侧添加部署后的 Base URL，然后完成管理员授权。"
            />
        );
    }

    if (!message) {
        return (
            <EmptyState
                icon={Mail}
                title="选择一封邮件"
                body="邮件正文会显示在这里，支持快捷键 J/K 切换。"
            />
        );
    }

    const directionLabel = message.direction === 'outbound' ? '已发送' : '已接收';
    const peerLabel = message.direction === 'outbound' ? '收件人' : '发件人';
    const peerAddress = message.email || '未知地址';
    const authorName = message.author || message.email || '未知发件人';
    const unread = isUnreadMessage(message);
    const starred = isStarredMessage(message);

    return (
        <article className="reading-view">
            <section className="message-block">
                <header className="message-meta">
                    <div className="sender-avatar">
                        {(message.author || message.email || 'M').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                        <h3>{message.subject || '无主题'}</h3>
                        <p>
                            <strong>{authorName}</strong>
                            <span>{message.direction === 'outbound' ? '发往' : '来自'} {peerAddress}</span>
                            <time>{formatMessageTime(message.time)}</time>
                            <span>{directionLabel}</span>
                            {message.direction !== 'outbound' ? <span>{unread ? '未读' : '已读'}</span> : null}
                            {starred ? <span>已星标</span> : null}
                        </p>
                    </div>
                    <div className="message-inline-actions">
                        <button className="metadata-toggle" type="button" onClick={() => setDetailsExpanded((value) => !value)}>
                            {detailsExpanded ? '隐藏详情' : '查看详情'}
                        </button>
                        {message.direction !== 'outbound' ? (
                            <IconButton
                                icon={unread ? MailOpen : Mail}
                                label={unread ? '标记已读' : '标记未读'}
                                onClick={() => onSetStatus(message, {read: unread})}
                                disabled={busy === 'message-action'}
                            />
                        ) : null}
                        <IconButton
                            active={starred}
                            icon={Star}
                            label={starred ? '取消星标' : '添加星标'}
                            onClick={() => onSetStatus(message, {starred: !starred})}
                            disabled={busy === 'message-action'}
                        />
                        <IconButton icon={message.archivedAt ? ArchiveRestore : Archive} label={message.archivedAt ? '取消归档' : '归档'} onClick={() => onArchive(message)} />
                        <IconButton icon={Trash2} label="删除" onClick={() => onDelete(message)} tone="danger" />
                    </div>
                </header>

                {detailsExpanded ? (
                    <dl className="message-detail-grid">
                        <div>
                            <dt>{peerLabel}</dt>
                            <dd>{authorName} &lt;{peerAddress}&gt;</dd>
                        </div>
                        <div>
                            <dt>时间</dt>
                            <dd>{formatMessageTime(message.time)}</dd>
                        </div>
                        <div>
                            <dt>方向</dt>
                            <dd>{directionLabel}</dd>
                        </div>
                        <div>
                            <dt>状态</dt>
                            <dd>
                                {message.deletedAt ? '已删除' : message.archivedAt ? `已归档：${message.archivedAt}` : unread ? '未读' : '已读'}
                            </dd>
                        </div>
                        <div>
                            <dt>星标</dt>
                            <dd>{message.starredAt ? `已星标：${message.starredAt}` : '未星标'}</dd>
                        </div>
                        <div>
                            <dt>已读时间</dt>
                            <dd>{message.readAt || '未读'}</dd>
                        </div>
                        <div>
                            <dt>账号</dt>
                            <dd>{message.accountId || '未知账号'}</dd>
                        </div>
                    </dl>
                ) : null}

                <div className="message-body">
                    {(message.body || message.preview || '无正文内容').split('\n').map((line, index) => (
                        <p key={`${message.id}-${index}`}>{line || '\u00A0'}</p>
                    ))}
                </div>

                {message.attachments?.length ? (
                    <div className="attachment-grid" aria-label="附件">
                        {message.attachments.map((attachment) => {
                            const kind = attachmentKind(attachment);
                            const filename = attachment.filename || '未命名附件';
                            const previewable = attachment.downloadable && isPreviewableAttachment(attachment);

                            return (
                                <article className="attachment-card" key={attachment.id}>
                                    <span className="attachment-kind" aria-label={kind.label}>
                                        <FileText size={16} />
                                        <em>{kind.short}</em>
                                    </span>
                                    <span className="attachment-copy">
                                        <strong>{filename}</strong>
                                        <small>
                                            {kind.label} · {formatFileSize(attachment.size)}
                                            {attachment.mimeType ? ` · ${attachment.mimeType}` : ''}
                                        </small>
                                    </span>
                                    <span className="attachment-actions">
                                        <button
                                            type="button"
                                            onClick={() => openAttachmentPreview(attachment)}
                                            disabled={!previewable || busy === 'preview'}
                                            title={previewable ? '预览附件' : '该附件类型暂不支持预览'}
                                            aria-label={previewable ? `预览附件 ${filename}` : `${filename} 不可预览`}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDownload(attachment)}
                                            disabled={!attachment.downloadable || busy === 'download'}
                                            title={attachment.downloadable ? '保存附件' : '附件内容未存储'}
                                            aria-label={attachment.downloadable ? `保存附件 ${filename}` : `${filename} 不可下载`}
                                        >
                                            <Download size={16} />
                                        </button>
                                    </span>
                                </article>
                            );
                        })}
                    </div>
                ) : null}
            </section>
            <AttachmentPreviewDialog preview={attachmentPreview} onClose={closeAttachmentPreview} onDownload={onDownload} />
        </article>
    );
}

export function AttachmentPreviewDialog({onClose, onDownload, preview}) {
    const attachment = preview?.attachment || {};
    const result = preview?.result || {};
    const filename = result.filename || attachment.filename || '附件预览';
    const previewType = result.previewType || '';
    const mimeType = result.mimeType || attachment.mimeType || '';
    const pdfSrc = result.previewUrl || result.dataUrl || '';
    const imageSrc = result.previewUrl || result.dataUrl || '';

    useEffect(() => {
        const previewId = preview?.status === 'ready' ? result.previewId : '';
        if (!previewId) {
            return undefined;
        }

        return () => {
            ReleaseAttachmentPreview(previewId).catch(() => {});
        };
    }, [preview?.status, result.previewId]);

    if (!preview || preview.status === 'idle') {
        return null;
    }

    return (
        <div className="attachment-preview-backdrop" role="presentation" onMouseDown={onClose}>
            <section
                className="attachment-preview-card"
                role="dialog"
                aria-modal="true"
                aria-label={`预览附件 ${filename}`}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header>
                    <div>
                        <p>附件预览</p>
                        <h2>{filename}</h2>
                        <small>
                            {mimeType || '未知类型'} · {formatFileSize(result.size || attachment.size)}
                            {result.encrypted ? ' · 受密码保护' : ''}
                        </small>
                    </div>
                    <div className="attachment-preview-actions">
                        {attachment.downloadable && onDownload ? (
                            <IconButton icon={Download} label="保存附件" onClick={() => onDownload(attachment)} />
                        ) : null}
                        <IconButton icon={X} label="关闭附件预览" onClick={onClose} />
                    </div>
                </header>

                <div className={`attachment-preview-body ${previewType}`}>
                    {preview.status === 'loading' ? (
                        <div className="attachment-preview-state">
                            <RefreshCw className="spin-inline" size={20} />
                            <span>正在读取附件</span>
                        </div>
                    ) : null}

                    {preview.status === 'error' ? (
                        <div className="attachment-preview-state error">
                            <CircleAlert size={22} />
                            <span>{preview.error || '附件预览失败'}</span>
                        </div>
                    ) : null}

                    {preview.status === 'ready' && previewType === 'image' ? (
                        imageSrc ? (
                            <img src={imageSrc} alt={filename} />
                        ) : (
                            <div className="attachment-preview-state error">
                                <CircleAlert size={22} />
                                <span>图片预览文件无法读取</span>
                            </div>
                        )
                    ) : null}

                    {preview.status === 'ready' && previewType === 'pdf' ? (
                        pdfSrc ? (
                            <Suspense
                                fallback={(
                                    <div className="attachment-preview-state">
                                        <RefreshCw className="spin-inline" size={20} />
                                        <span>正在加载 PDF 预览</span>
                                    </div>
                                )}
                            >
                                <PdfAttachmentPreview fileUrl={pdfSrc} filename={filename} />
                            </Suspense>
                        ) : (
                            <div className="attachment-preview-state error">
                                <CircleAlert size={22} />
                                <span>PDF 预览文件无法读取</span>
                            </div>
                        )
                    ) : null}

                    {preview.status === 'ready' && previewType === 'text' ? (
                        <pre>{result.text || '空文本附件'}{result.textTruncated ? '\n\n[只显示前 512 KB]' : ''}</pre>
                    ) : null}
                </div>
            </section>
        </div>
    );
}

