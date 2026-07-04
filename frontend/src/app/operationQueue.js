import {isStarredMessage, isUnreadMessage} from './utils.js';

export const queueActionOptions = [
    {id: 'read', label: '标记已读'},
    {id: 'unread', label: '标记未读'},
    {id: 'star', label: '添加星标'},
    {id: 'unstar', label: '取消星标'},
    {id: 'archive', label: '归档'},
    {id: 'unarchive', label: '取消归档'}
];

export function queueActionLabel(action) {
    return queueActionOptions.find((option) => option.id === action)?.label || action || '未知操作';
}

export function filterQueueCandidates(messages = [], filter = 'all') {
    const items = Array.isArray(messages) ? messages : [];

    return items.filter((message) => {
        if (filter === 'unread') {
            return isUnreadMessage(message);
        }
        if (filter === 'starred') {
            return isStarredMessage(message);
        }
        if (filter === 'attachments') {
            return (message.attachments || []).length > 0;
        }
        if (filter === 'archive') {
            return Boolean(message.archivedAt);
        }
        if (filter === 'inbox') {
            return message.direction !== 'outbound' && !message.archivedAt;
        }
        return true;
    });
}

export function createQueueItems(messages = [], selectedIds = [], action = 'read', offset = 0) {
    const selected = new Set(selectedIds);

    return (Array.isArray(messages) ? messages : [])
        .filter((message) => selected.has(message.id))
        .map((message, index) => ({
            id: `${Date.now()}-${offset + index}-${message.id}-${action}`,
            action,
            message,
            status: 'pending',
            error: ''
        }));
}

export function operationQueueStorageKey(profileId, domain, accountId) {
    if (!profileId || !accountId) {
        return '';
    }
    return `omnimail_operation_queue:${profileId}:${domain || 'default'}:${accountId}`;
}

export function compactQueueMessage(message = {}) {
    return {
        id: message.id || '',
        accountId: message.accountId || '',
        archivedAt: message.archivedAt || '',
        attachments: (message.attachments || []).map((attachment) => ({
            id: attachment.id || '',
            filename: attachment.filename || ''
        })).filter((attachment) => attachment.id || attachment.filename),
        author: message.author || '',
        deletedAt: message.deletedAt || '',
        direction: message.direction || '',
        email: message.email || '',
        readAt: message.readAt || '',
        starredAt: message.starredAt || '',
        subject: message.subject || '',
        time: message.time || ''
    };
}

export function serializeOperationQueue(items = []) {
    return (Array.isArray(items) ? items : [])
        .filter((item) => item?.id && item?.action && item?.message?.id)
        .map((item) => ({
            id: item.id,
            action: item.action,
            status: item.status === 'running' ? 'pending' : item.status || 'pending',
            error: item.error || '',
            message: compactQueueMessage(item.message)
        }));
}

export function readOperationQueue(storage, key) {
    if (!storage || !key) {
        return [];
    }

    try {
        return serializeOperationQueue(JSON.parse(storage.getItem(key) || '[]'));
    } catch {
        return [];
    }
}

export function writeOperationQueue(storage, key, items = []) {
    if (!storage || !key) {
        return false;
    }

    try {
        storage.setItem(key, JSON.stringify(serializeOperationQueue(items)));
        return true;
    } catch {
        return false;
    }
}

export function operationQueueStats(items = []) {
    const queue = Array.isArray(items) ? items : [];

    return {
        total: queue.length,
        pending: queue.filter((item) => item.status === 'pending').length,
        running: queue.filter((item) => item.status === 'running').length,
        success: queue.filter((item) => item.status === 'success').length,
        error: queue.filter((item) => item.status === 'error').length
    };
}
