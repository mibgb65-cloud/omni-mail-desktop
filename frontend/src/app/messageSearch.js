import {isStarredMessage, isUnreadMessage} from './utils.js';

function messageAttachmentText(message = {}) {
    return (Array.isArray(message.attachments) ? message.attachments : [])
        .map((attachment) => [attachment.filename, attachment.mimeType].filter(Boolean).join(' '))
        .filter(Boolean)
        .join(' ');
}

export function messageSearchText(message = {}) {
    return [
        message.subject,
        message.author,
        message.email,
        message.preview,
        message.body,
        messageAttachmentText(message)
    ].filter(Boolean).join(' ').toLowerCase();
}

export function messageSearchMatch(message = {}, query = '') {
    const normalizedQuery = String(query || '').trim().toLowerCase();

    if (!normalizedQuery) {
        return {
            matched: true,
            score: 0,
            snippet: message.preview || message.body || ''
        };
    }

    const fields = [
        {name: 'subject', weight: 8, value: message.subject},
        {name: 'author', weight: 5, value: message.author},
        {name: 'email', weight: 5, value: message.email},
        {name: 'attachments', weight: 4, value: messageAttachmentText(message)},
        {name: 'preview', weight: 3, value: message.preview},
        {name: 'body', weight: 1, value: message.body}
    ];
    let score = 0;
    let snippet = '';

    for (const field of fields) {
        const value = String(field.value || '');
        const index = value.toLowerCase().indexOf(normalizedQuery);
        if (index === -1) {
            continue;
        }

        score += field.weight;
        if (!snippet) {
            const start = Math.max(0, index - 28);
            const end = Math.min(value.length, index + normalizedQuery.length + 64);
            snippet = `${start > 0 ? '...' : ''}${value.slice(start, end)}${end < value.length ? '...' : ''}`;
        }
    }

    return {
        matched: score > 0,
        score,
        snippet: snippet || message.preview || message.body || ''
    };
}

export function searchMessages(messages = [], {filter = 'all', query = '', sort = 'relevance'} = {}) {
    const items = (Array.isArray(messages) ? messages : []).filter((message) => {
        if (filter === 'unread' && !isUnreadMessage(message)) {
            return false;
        }
        if (filter === 'starred' && !isStarredMessage(message)) {
            return false;
        }
        if (filter === 'attachments' && !(message.attachments || []).length) {
            return false;
        }
        if (filter === 'sent' && message.direction !== 'outbound') {
            return false;
        }
        if (filter === 'archive' && !message.archivedAt) {
            return false;
        }
        return true;
    }).map((message) => ({
        ...messageSearchMatch(message, query),
        message
    })).filter((item) => item.matched);

    return items.sort((first, second) => {
        const firstTime = Date.parse(first.message.time || '') || 0;
        const secondTime = Date.parse(second.message.time || '') || 0;

        if (sort === 'newest') {
            return secondTime - firstTime;
        }
        if (sort === 'oldest') {
            return firstTime - secondTime;
        }
        return second.score - first.score || secondTime - firstTime;
    });
}

export function searchMessageStats(messages = []) {
    const items = Array.isArray(messages) ? messages : [];

    return {
        total: items.length,
        unread: items.filter(isUnreadMessage).length,
        starred: items.filter(isStarredMessage).length,
        attachments: items.filter((message) => (message.attachments || []).length).length
    };
}
