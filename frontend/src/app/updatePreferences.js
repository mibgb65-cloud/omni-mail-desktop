export const updatePreferenceKeys = {
    autoCheck: 'omnimail_update_auto_check',
    remindLaterHours: 'omnimail_update_remind_later_hours',
    remindLaterUntil: 'omnimail_update_remind_later_until',
    skippedVersion: 'omnimail_update_skipped_version'
};

export const reminderHourOptions = [24, 72, 168];
export const defaultReminderHours = 24;

export function readUpdatePreferences(storage = localStorage) {
    return {
        autoCheck: storage.getItem(updatePreferenceKeys.autoCheck) !== 'false',
        remindLaterHours: normalizeReminderHours(storage.getItem(updatePreferenceKeys.remindLaterHours)),
        remindLaterUntil: Number(storage.getItem(updatePreferenceKeys.remindLaterUntil)) || 0,
        skippedVersion: storage.getItem(updatePreferenceKeys.skippedVersion) || ''
    };
}

export function writeAutoCheck(value, storage = localStorage) {
    storage.setItem(updatePreferenceKeys.autoCheck, String(Boolean(value)));
}

export function writeReminderHours(value, storage = localStorage) {
    const hours = normalizeReminderHours(value);
    storage.setItem(updatePreferenceKeys.remindLaterHours, String(hours));
    return hours;
}

export function nextReminderUntil(hours, now = Date.now()) {
    return now + normalizeReminderHours(hours) * 60 * 60 * 1000;
}

export function isUpdateDeferred(info, skippedVersion, remindLaterUntil, now = Date.now()) {
    if (!info?.updateAvailable || info?.mandatory) {
        return false;
    }

    if (skippedVersion && skippedVersion === info.latestVersion) {
        return true;
    }
    return Number(remindLaterUntil) > now;
}

export function normalizeReminderHours(value) {
    const hours = Number(value);
    return reminderHourOptions.includes(hours) ? hours : defaultReminderHours;
}
