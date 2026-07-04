import {Archive, ArchiveRestore, CircleAlert, CircleCheck, Mail, MailOpen, Maximize2, Minus, Moon, Star, Sun, Trash2, X} from 'lucide-react';
import {Quit, WindowMinimise, WindowToggleMaximise} from '../../wailsjs/runtime/runtime';
import {isStarredMessage, isUnreadMessage} from '../app/utils';

export function TitleBar({theme, toggleTheme}) {
    return (
        <header className="titlebar" aria-label="窗口标题栏">
            <div className="titlebar-drag-region">
                <div className="titlebar-brand">
                    <span className="titlebar-logo">OM</span>
                    <strong>OmniMail Desktop</strong>
                </div>
            </div>
            <div className="titlebar-actions">
                <button className="titlebar-tool" type="button" onClick={toggleTheme} aria-label="切换亮色暗色模式" title="切换亮色暗色模式">
                    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <button className="window-control" type="button" onClick={WindowMinimise} aria-label="最小化" title="最小化">
                    <Minus size={15} />
                </button>
                <button className="window-control" type="button" onClick={WindowToggleMaximise} aria-label="最大化或还原" title="最大化或还原">
                    <Maximize2 size={14} />
                </button>
                <button className="window-control close" type="button" onClick={Quit} aria-label="关闭" title="关闭">
                    <X size={15} />
                </button>
            </div>
        </header>
    );
}

export function ResizeHandle({active = false, hidden = false, label, max, min, onDoubleClick, onKeyDown, onPointerDown, value}) {
    if (hidden) {
        return <div className="resize-handle hidden" aria-hidden="true" />;
    }

    return (
        <button
            className={`resize-handle ${active ? 'active' : ''}`}
            type="button"
            role="separator"
            aria-label={label}
            aria-orientation="vertical"
            aria-valuemax={max}
            aria-valuemin={min}
            aria-valuenow={value}
            title={`${label}；双击恢复默认宽度`}
            onDoubleClick={onDoubleClick}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
        />
    );
}

export function SettingRow({action, body, icon: Icon, title}) {
    return (
        <section className="setting-row">
            <Icon size={18} />
            <span>
                <strong>{title}</strong>
                <small>{body}</small>
            </span>
            {action}
        </section>
    );
}

export function ContextMenu({contextMenu, onArchive, onClose, onDelete, onSetStatus}) {
    const message = contextMenu.message;
    const unread = isUnreadMessage(message);
    const starred = isStarredMessage(message);

    return (
        <div
            className="context-menu"
            style={{left: contextMenu.x, top: contextMenu.y}}
            role="menu"
            onClick={(event) => event.stopPropagation()}
        >
            {message.direction !== 'outbound' ? (
                <button type="button" onClick={() => { onSetStatus(message, {read: unread}); onClose(); }}>
                    {unread ? <MailOpen size={15} /> : <Mail size={15} />}
                    {unread ? '标记已读' : '标记未读'}
                </button>
            ) : null}
            <button type="button" onClick={() => { onSetStatus(message, {starred: !starred}); onClose(); }}>
                <Star size={15} fill={starred ? 'currentColor' : 'none'} />
                {starred ? '取消星标' : '添加星标'}
            </button>
            <button type="button" onClick={() => { onArchive(message); onClose(); }}>
                {message.archivedAt ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                {message.archivedAt ? '取消归档' : '归档'}
            </button>
            <button className="danger" type="button" onClick={() => { onDelete(message); onClose(); }}>
                <Trash2 size={15} />
                删除
            </button>
        </div>
    );
}

export function Toast({onClose, toast}) {
    if (!toast) {
        return null;
    }

    const Icon = toast.type === 'error' ? CircleAlert : CircleCheck;

    return (
        <div className={`toast ${toast.type}`} role="status">
            <Icon size={18} />
            <span>
                <strong>{toast.title}</strong>
                {toast.message ? <small>{toast.message}</small> : null}
            </span>
            <IconButton icon={X} label="关闭通知" onClick={onClose} />
        </div>
    );
}

export function EmptyState({action, body, icon: Icon, title}) {
    return (
        <section className="empty-state">
            <Icon size={26} />
            <h3>{title}</h3>
            <p>{body}</p>
            {action ? <div className="empty-state-action">{action}</div> : null}
        </section>
    );
}

export function LoadingList() {
    return (
        <div className="loading-list" aria-label="加载中">
            {Array.from({length: 7}).map((_, index) => (
                <div className="skeleton-row" key={index}>
                    <span />
                    <strong />
                    <em />
                </div>
            ))}
        </div>
    );
}

export function ReadingSkeleton() {
    return (
        <div className="reading-view">
            <div className="reading-skeleton">
                <span />
                <strong />
                <p />
                <p />
                <p />
            </div>
        </div>
    );
}

export function NavItem({active, count, icon: Icon, label, onClick}) {
    return (
        <button className={`nav-item ${active ? 'active' : ''}`} type="button" onClick={onClick}>
            <Icon size={17} />
            <span>{label}</span>
            <small>{count}</small>
        </button>
    );
}

export function SectionLabel({children}) {
    return <p className="section-label">{children}</p>;
}

export function SidebarNotice({actionLabel, detail, onAction, title}) {
    return (
        <div className="sidebar-notice">
            <strong>{title}</strong>
            <small>{detail}</small>
            {actionLabel && onAction ? (
                <button type="button" onClick={onAction}>
                    {actionLabel}
                </button>
            ) : null}
        </div>
    );
}

export function MutedLine({children}) {
    return <p className="muted-line">{children}</p>;
}

export function StatusBadge({label, ok}) {
    return <span className={`status-badge ${ok ? 'ok' : ''}`}>{label}</span>;
}

export function IconButton({active = false, disabled, icon: Icon, label, onClick, spinning, tone = 'default'}) {
    return (
        <button
            className={`icon-button ${tone} ${active ? 'active' : ''} ${spinning ? 'spinning' : ''}`}
            type="button"
            aria-label={label}
            aria-pressed={active || undefined}
            title={label}
            onClick={onClick}
            disabled={disabled}
        >
            <Icon size={17} fill={active ? 'currentColor' : 'none'} />
        </button>
    );
}

