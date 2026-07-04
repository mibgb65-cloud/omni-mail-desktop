import {isStarredMessage, isUnreadMessage} from './utils.js';

const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function normalizeContactEmail(value = '') {
    const match = String(value || '').match(/<([^<>]+)>/);
    return String(match?.[1] || value || '').trim().toLowerCase();
}

function displayName(message = {}, email = '') {
    const author = String(message.author || '').trim();
    if (author && normalizeContactEmail(author) !== email) {
        return author.replace(/^"|"$/g, '');
    }
    return email;
}

export function collectContacts(messages = []) {
    const contacts = new Map();

    for (const message of Array.isArray(messages) ? messages : []) {
        const email = normalizeContactEmail(message.email || message.author);
        if (!emailPattern.test(email)) {
            continue;
        }

        const current = contacts.get(email) || {
            email,
            name: displayName(message, email),
            messages: 0,
            unread: 0,
            starred: 0,
            attachments: 0,
            inbound: 0,
            outbound: 0,
            lastMessage: null,
            lastTime: ''
        };
        const messageTime = Date.parse(message.time || '') || 0;
        const lastTime = Date.parse(current.lastTime || '') || 0;

        current.messages += 1;
        current.unread += isUnreadMessage(message) ? 1 : 0;
        current.starred += isStarredMessage(message) ? 1 : 0;
        current.attachments += (message.attachments || []).length;
        current.outbound += message.direction === 'outbound' ? 1 : 0;
        current.inbound += message.direction === 'outbound' ? 0 : 1;

        if (!current.lastMessage || messageTime >= lastTime) {
            current.lastMessage = message;
            current.lastTime = message.time || '';
            current.name = displayName(message, email);
        }

        contacts.set(email, current);
    }

    return Array.from(contacts.values()).sort((first, second) => {
        const firstTime = Date.parse(first.lastTime || '') || 0;
        const secondTime = Date.parse(second.lastTime || '') || 0;
        return secondTime - firstTime || first.email.localeCompare(second.email);
    });
}

export function filterContacts(contacts = [], {filter = 'all', query = ''} = {}) {
    const normalizedQuery = String(query || '').trim().toLowerCase();

    return (Array.isArray(contacts) ? contacts : []).filter((contact) => {
        if (filter === 'unread' && !contact.unread) {
            return false;
        }
        if (filter === 'starred' && !contact.starred) {
            return false;
        }
        if (filter === 'attachments' && !contact.attachments) {
            return false;
        }
        if (filter === 'outbound' && !contact.outbound) {
            return false;
        }
        if (!normalizedQuery) {
            return true;
        }

        return [contact.name, contact.email, contact.lastMessage?.subject]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
}

export function sortContacts(contacts = [], sort = 'recent') {
    const items = [...(Array.isArray(contacts) ? contacts : [])];

    if (sort === 'name') {
        return items.sort((first, second) => (first.name || first.email).localeCompare(second.name || second.email, 'zh-CN'));
    }
    if (sort === 'messages') {
        return items.sort((first, second) => second.messages - first.messages || first.email.localeCompare(second.email));
    }
    return items.sort((first, second) => {
        const firstTime = Date.parse(first.lastTime || '') || 0;
        const secondTime = Date.parse(second.lastTime || '') || 0;
        return secondTime - firstTime || first.email.localeCompare(second.email);
    });
}

export function contactStats(contacts = []) {
    const items = Array.isArray(contacts) ? contacts : [];

    return {
        total: items.length,
        unread: items.filter((contact) => contact.unread).length,
        starred: items.filter((contact) => contact.starred).length,
        attachments: items.filter((contact) => contact.attachments).length
    };
}
