import {Archive, Database, Globe2, Inbox, KeyRound, Mail, Send, Settings, ShieldCheck} from 'lucide-react';

export const emptyProfileForm = {id: '', name: '', baseUrl: ''};
export const emptyAccountForm = {localPart: '', name: ''};
export const emptyDomainForm = {domain: ''};
export const emptyAuthForm = {email: '', password: '', deviceLabel: 'Windows 桌面端', setup: false};
export const emptyComposeForm = {to: '', cc: '', bcc: '', subject: '', text: ''};
export const emptyAdminSessionForm = {email: '', password: '', setup: false};
export const emptyUserForm = {email: '', password: '', displayName: '', avatarColor: '#dbe7ff'};
export const emptyPasswordForm = {currentPassword: '', newPassword: ''};
export const defaultMailboxSettings = {
    enabled: true,
    createdAt: '',
    lastActivity: '',
    forwardingEnabled: false,
    forwardTo: '',
    keepLocalCopy: true,
    retention: 'forever',
    saveAttachments: true,
    defaultView: 'inbox',
    showPreview: true,
    signature: '',
    rules: [],
    apiTokens: []
};
export const layoutDefaults = {
    sidebar: 292,
    list: 388
};
export const layoutLimits = {
    sidebar: {min: 240, max: 420},
    list: {min: 300, max: 560}
};
export const mailboxPageSize = 50;

export const folders = [
    {id: 'inbox', label: '收件箱', icon: Inbox},
    {id: 'sent', label: '已发送', icon: Send},
    {id: 'archive', label: '归档', icon: Archive},
    {id: 'all', label: '全部邮件', icon: Mail}
];

export const settingsTabs = [
    {id: 'general', label: '常规', icon: Settings},
    {id: 'mailbox', label: '邮箱设置', icon: Mail},
    {id: 'dns', label: 'DNS', icon: Globe2},
    {id: 'devices', label: '设备 Token', icon: ShieldCheck},
    {id: 'maintenance', label: '维护', icon: Database},
    {id: 'security', label: '安全', icon: KeyRound}
];

export function upsertProfile(profiles, profile) {
    const exists = profiles.some((item) => item.id === profile.id);
    return exists
        ? profiles.map((item) => item.id === profile.id ? profile : item)
        : [profile, ...profiles];
}

export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function readStoredWidth(key, fallback, limits) {
    const raw = localStorage.getItem(key);
    if (raw === null) {
        return fallback;
    }

    const stored = Number(raw);
    if (!Number.isFinite(stored)) {
        return fallback;
    }

    return clamp(stored, limits.min, limits.max);
}

export function recipientAddress(value) {
    const match = String(value || '').match(/<([^<>]+)>/);
    return (match?.[1] || value || '').trim();
}

export function splitRecipients(value) {
    return String(value || '')
        .split(/[,\n;，；]+/)
        .map(recipientAddress)
        .filter(Boolean);
}

export function invalidRecipients(value) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return splitRecipients(value).filter((recipient) => !emailPattern.test(recipient));
}

export function normalizeDomainInput(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');
}

export function composeHasContent(form) {
    return Object.values(form || {}).some((value) => String(value || '').trim());
}

export function isUnreadMessage(message) {
    return Boolean(
        message
        && message.direction !== 'outbound'
        && !message.readAt
        && !message.archivedAt
        && !message.deletedAt
    );
}

export function isAccountEnabled(account) {
    return Boolean(account && account.enabled !== false && !account.deletedAt);
}

export function isStarredMessage(message) {
    return Boolean(message?.starredAt);
}

export function isTypingTarget(event) {
    const tagName = event.target?.tagName?.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || event.target?.isContentEditable;
}

export function formatMessageTime(value) {
    return value || '刚刚';
}

export function formatProfileDate(value) {
    if (!value) {
        return '从未';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatDateTime(value) {
    if (!value) {
        return '暂无';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export const auditActionLabels = {
    'account.delete': '删除邮箱账号',
    'account.settings_update': '更新邮箱设置',
    'account.update': '更新邮箱账号',
    'auth.change_password': '修改密码',
    'auth.login': '管理员登录',
    'auth.logout': '退出登录',
    'auth.revoke_sessions': '撤销会话',
    'auth.setup': '初始化管理员',
    'auth.update_profile': '更新资料',
    'device.create': '创建设备 Token',
    'device.revoke': '撤销设备 Token',
    'device.update': '更新设备 Token',
    'domain.create': '添加域名',
    'mail.received': '收到邮件',
    'mail.rules_applied': '应用收信规则',
    'message.delete': '删除邮件',
    'message.send': '发送邮件',
    'message.status_update': '更新邮件状态',
    'user.create': '创建用户',
    'user.update': '更新用户'
};

export function formatAuditAction(action) {
    return auditActionLabels[action] || action || '未知操作';
}

export function formatCount(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '0';
}

export function metadataSummary(metadata) {
    const entries = Object.entries(metadata || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');
    if (!entries.length) {
        return '';
    }

    return entries.slice(0, 3).map(([key, value]) => {
        const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `${key}: ${text}`;
    }).join(' · ');
}

export function formatFileSize(value) {
    if (!value || value <= 0) {
        return '未知大小';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    const displaySize = size >= 10 || unitIndex === 0
        ? String(Math.round(size))
        : String(Number(size.toFixed(1)));
    return `${displaySize} ${units[unitIndex]}`;
}

export function buildDiagnosticReport({
    auditLogs = [],
    diagnostics = null,
    generatedAt = new Date().toISOString(),
    profile = null,
    status = null,
    storagePath = ''
} = {}) {
    const safeProfile = profile ? {
        id: profile.id || '',
        name: profile.name || '',
        baseUrl: profile.baseUrl || '',
        hasToken: Boolean(profile.hasToken),
        tokenPreview: profile.tokenPreview || '',
        hasAdminSession: Boolean(profile.hasAdminSession),
        adminEmail: profile.adminEmail || '',
        adminTokenPreview: profile.adminTokenPreview || '',
        deviceId: profile.deviceId || '',
        secretError: profile.secretError || '',
        lastUsedAt: profile.lastUsedAt || ''
    } : null;

    return {
        generatedAt,
        storagePath: storagePath || '',
        profile: safeProfile,
        status: status || null,
        diagnostics: diagnostics || null,
        auditLogs: Array.isArray(auditLogs) ? auditLogs.slice(0, 30) : []
    };
}

export function stringifyDiagnosticReport(input) {
    return JSON.stringify(buildDiagnosticReport(input), null, 2);
}

export function normalizeMailboxSettings(settings = {}) {
    return {
        ...defaultMailboxSettings,
        ...settings,
        enabled: settings.enabled !== false,
        forwardingEnabled: Boolean(settings.forwardingEnabled),
        forwardTo: settings.forwardTo || '',
        keepLocalCopy: settings.keepLocalCopy !== false,
        retention: settings.retention || defaultMailboxSettings.retention,
        saveAttachments: settings.saveAttachments !== false,
        defaultView: settings.defaultView || defaultMailboxSettings.defaultView,
        showPreview: settings.showPreview !== false,
        signature: settings.signature || '',
        rules: Array.isArray(settings.rules) ? settings.rules : [],
        apiTokens: Array.isArray(settings.apiTokens) ? settings.apiTokens : []
    };
}

export function attachmentKind(attachment) {
    const mimeType = attachment.mimeType || '';
    const filename = attachment.filename || '';
    const extension = filename.includes('.') ? filename.split('.').pop().toUpperCase() : '文件';

    if (mimeType.startsWith('image/')) {
        return {label: '图片', short: 'IMG'};
    }

    if (mimeType === 'application/pdf') {
        return {label: 'PDF', short: 'PDF'};
    }

    if (mimeType.includes('zip') || mimeType.includes('archive') || ['ZIP', 'RAR', '7Z'].includes(extension)) {
        return {label: '压缩包', short: 'ZIP'};
    }

    if (mimeType.includes('spreadsheet') || ['XLS', 'XLSX', 'CSV'].includes(extension)) {
        return {label: '表格', short: 'XLS'};
    }

    if (mimeType.includes('word') || ['DOC', 'DOCX'].includes(extension)) {
        return {label: '文档', short: 'DOC'};
    }

    if (mimeType.startsWith('text/') || ['TXT', 'MD', 'LOG'].includes(extension)) {
        return {label: '文本', short: 'TXT'};
    }

    return {label: extension, short: extension.slice(0, 3)};
}

export function attachmentMime(attachment = {}) {
    return String(attachment.mimeType || '').toLowerCase();
}

export function isTextPreviewMime(mimeType = '') {
    return mimeType.startsWith('text/')
        || mimeType.includes('json')
        || mimeType.includes('xml')
        || mimeType.includes('csv');
}

export function isPreviewableAttachment(attachment = {}) {
    const mimeType = attachmentMime(attachment);
    const filename = String(attachment.filename || '').toLowerCase();

    return mimeType.startsWith('image/')
        || mimeType === 'application/pdf'
        || isTextPreviewMime(mimeType)
        || /\.(png|jpe?g|gif|webp|svg|pdf|txt|log|md|json|csv|xml)$/.test(filename);
}
