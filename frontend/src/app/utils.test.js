import assert from 'node:assert/strict';
import test from 'node:test';

import {
    attachmentKind,
    buildDiagnosticReport,
    formatFileSize,
    invalidRecipients,
    isPreviewableAttachment,
    normalizeDomainInput,
    normalizeMailboxSettings,
    readStoredWidth,
    splitRecipients,
    upsertProfile
} from './utils.js';

test('splitRecipients normalizes display names and separators', () => {
    assert.deepEqual(
        splitRecipients('Alice <alice@example.com>, bob@example.com；carol@example.com'),
        ['alice@example.com', 'bob@example.com', 'carol@example.com']
    );
});

test('invalidRecipients returns only malformed addresses', () => {
    assert.deepEqual(
        invalidRecipients('ok@example.com, bad-address, second@example.org'),
        ['bad-address']
    );
});

test('normalizeDomainInput strips scheme, path, and casing', () => {
    assert.equal(normalizeDomainInput(' HTTPS://Mail.Example.COM/path?q=1 '), 'mail.example.com');
});

test('normalizeMailboxSettings preserves supported defaults', () => {
    const settings = normalizeMailboxSettings({
        enabled: false,
        forwardingEnabled: true,
        forwardTo: 'ops@example.com',
        rules: 'invalid'
    });

    assert.equal(settings.enabled, false);
    assert.equal(settings.forwardingEnabled, true);
    assert.equal(settings.forwardTo, 'ops@example.com');
    assert.deepEqual(settings.rules, []);
    assert.equal(settings.keepLocalCopy, true);
});

test('attachment helpers classify previewable files', () => {
    assert.deepEqual(
        attachmentKind({filename: 'report.pdf', mimeType: 'application/pdf'}),
        {label: 'PDF', short: 'PDF'}
    );
    assert.equal(isPreviewableAttachment({filename: 'image.PNG', mimeType: ''}), true);
    assert.equal(isPreviewableAttachment({filename: 'archive.zip', mimeType: 'application/zip'}), false);
});

test('formatFileSize keeps compact labels', () => {
    assert.equal(formatFileSize(0), '未知大小');
    assert.equal(formatFileSize(1024), '1 KB');
    assert.equal(formatFileSize(1536), '1.5 KB');
});

test('readStoredWidth clamps stored values', () => {
    globalThis.localStorage = {
        getItem: () => '999'
    };

    try {
        assert.equal(readStoredWidth('sidebar', 292, {min: 240, max: 420}), 420);
    } finally {
        delete globalThis.localStorage;
    }
});

test('upsertProfile replaces by id and prepends new entries', () => {
    const current = [{id: 'one', name: 'One'}];

    assert.deepEqual(upsertProfile(current, {id: 'one', name: 'Updated'}), [{id: 'one', name: 'Updated'}]);
    assert.deepEqual(upsertProfile(current, {id: 'two', name: 'Two'}), [
        {id: 'two', name: 'Two'},
        {id: 'one', name: 'One'}
    ]);
});

test('buildDiagnosticReport keeps only safe profile fields', () => {
    const report = buildDiagnosticReport({
        generatedAt: '2026-07-04T00:00:00Z',
        profile: {
            id: 'profile-1',
            name: 'Main',
            baseUrl: 'https://mail.example.com',
            hasToken: true,
            token: 'secret-token',
            tokenPreview: 'tok...',
            adminToken: 'admin-secret',
            adminTokenPreview: 'adm...'
        },
        auditLogs: Array.from({length: 32}, (_, index) => ({id: String(index)}))
    });

    assert.equal(report.generatedAt, '2026-07-04T00:00:00Z');
    assert.equal(report.profile.tokenPreview, 'tok...');
    assert.equal(report.profile.token, undefined);
    assert.equal(report.profile.adminToken, undefined);
    assert.equal(report.auditLogs.length, 30);
});
