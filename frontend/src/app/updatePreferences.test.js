import test from 'node:test';
import assert from 'node:assert/strict';
import {isUpdateDeferred, nextReminderUntil, normalizeReminderHours, readUpdatePreferences, updatePreferenceKeys, writeAutoCheck, writeReminderHours} from './updatePreferences.js';

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key) => values.has(key) ? values.get(key) : null,
        removeItem: (key) => values.delete(key),
        setItem: (key, value) => values.set(key, String(value))
    };
}

test('update preferences read defaults and persisted values', () => {
    const storage = memoryStorage({
        [updatePreferenceKeys.autoCheck]: 'false',
        [updatePreferenceKeys.remindLaterHours]: '72',
        [updatePreferenceKeys.remindLaterUntil]: '1234',
        [updatePreferenceKeys.skippedVersion]: '1.2.3'
    });

    assert.deepEqual(readUpdatePreferences(storage), {
        autoCheck: false,
        remindLaterHours: 72,
        remindLaterUntil: 1234,
        skippedVersion: '1.2.3'
    });
});

test('update reminder hours are normalized before writing', () => {
    const storage = memoryStorage();

    assert.equal(writeReminderHours(168, storage), 168);
    assert.equal(storage.getItem(updatePreferenceKeys.remindLaterHours), '168');
    assert.equal(writeReminderHours(5, storage), 24);
    assert.equal(normalizeReminderHours('bad'), 24);
});

test('update auto check preference writes boolean strings', () => {
    const storage = memoryStorage();

    writeAutoCheck(false, storage);
    assert.equal(storage.getItem(updatePreferenceKeys.autoCheck), 'false');
    writeAutoCheck(true, storage);
    assert.equal(storage.getItem(updatePreferenceKeys.autoCheck), 'true');
});

test('deferred update respects mandatory policy', () => {
    const optionalInfo = {latestVersion: '1.0.2', updateAvailable: true};
    const mandatoryInfo = {...optionalInfo, mandatory: true};

    assert.equal(isUpdateDeferred(optionalInfo, '1.0.2', 0, 1000), true);
    assert.equal(isUpdateDeferred(optionalInfo, '', 2000, 1000), true);
    assert.equal(isUpdateDeferred(mandatoryInfo, '1.0.2', 2000, 1000), false);
    assert.equal(isUpdateDeferred({updateAvailable: false}, '1.0.2', 2000, 1000), false);
});

test('next reminder timestamp uses normalized hours', () => {
    assert.equal(nextReminderUntil(72, 1000), 1000 + 72 * 60 * 60 * 1000);
    assert.equal(nextReminderUntil(6, 1000), 1000 + 24 * 60 * 60 * 1000);
});
