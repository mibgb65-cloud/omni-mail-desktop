import {useEffect, useRef, useState} from 'react';
import {CancelUpdateDownload, CheckForUpdates, DownloadUpdateInstaller, LaunchUpdateInstaller} from '../../wailsjs/go/main/App';
import {EventsOn} from '../../wailsjs/runtime/runtime';
import {isUpdateDeferred, nextReminderUntil, readUpdatePreferences, updatePreferenceKeys, writeAutoCheck, writeReminderHours} from './updatePreferences';

const updateProgressEvent = 'omnimail:update-download-progress';

export function useUpdateManager(showToast) {
    const notifyRef = useRef(showToast);
    const initialPreferences = readUpdatePreferences();
    const [info, setInfo] = useState(null);
    const [checking, setChecking] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(null);
    const [autoCheck, setAutoCheckState] = useState(initialPreferences.autoCheck);
    const [reminderHours, setReminderHoursState] = useState(initialPreferences.remindLaterHours);
    const [skippedVersion, setSkippedVersion] = useState(initialPreferences.skippedVersion);
    const [remindLaterUntil, setRemindLaterUntil] = useState(initialPreferences.remindLaterUntil);

    useEffect(() => {
        notifyRef.current = showToast;
    }, [showToast]);

    useEffect(() => EventsOn(updateProgressEvent, (nextProgress) => {
        setProgress(nextProgress || null);
        if (nextProgress?.status === 'error') {
            setError(nextProgress.error || '更新下载失败。');
        }
    }), []);

    useEffect(() => {
        if (autoCheck) {
            check({announceAvailable: true, notifyCurrent: false, notifyError: false});
        }
    }, [autoCheck]);

    const updateDeferred = isUpdateDeferred(info, skippedVersion, remindLaterUntil);
    const visibleUpdateAvailable = Boolean(info?.updateAvailable && !updateDeferred);

    async function check({announceAvailable = false, notifyCurrent = true, notifyError = notifyCurrent} = {}) {
        setChecking(true);
        setError('');
        try {
            const nextInfo = await CheckForUpdates();
            setInfo(nextInfo);
            const nextDeferred = isUpdateDeferred(nextInfo, skippedVersion, remindLaterUntil);
            if (nextInfo?.updateAvailable && announceAvailable && !nextDeferred) {
                notifyRef.current?.('success', '发现新版本', `最新版本 ${nextInfo.latestVersion}`);
            } else if (notifyCurrent) {
                const title = nextInfo?.updateAvailable
                    ? nextDeferred ? '新版本已暂不提醒' : '发现新版本'
                    : '当前已是最新版本';
                notifyRef.current?.('success', title, nextInfo?.latestVersion || nextInfo?.currentVersion || '');
            }
            return nextInfo;
        } catch (checkError) {
            const message = checkError.message || '无法读取 GitHub Release。';
            setError(message);
            if (notifyError) {
                notifyRef.current?.('error', '检查更新失败', message);
            }
            return null;
        } finally {
            setChecking(false);
        }
    }

    async function install() {
        setInstalling(true);
        setError('');
        try {
            const result = await DownloadUpdateInstaller();
            notifyRef.current?.('success', '更新安装包已校验', `版本 ${result?.version || info?.latestVersion || ''}`);
            const confirmed = window.confirm('安装包已校验。现在将启动安装器并退出 OmniMail Desktop，继续吗？');
            if (!confirmed) {
                return result;
            }
            await LaunchUpdateInstaller(result.path);
            return result;
        } catch (installError) {
            const message = installError.message || '无法下载或启动更新安装包。';
            const canceled = message.toLowerCase().includes('canceled');
            setError(canceled ? '' : message);
            if (!canceled) {
                notifyRef.current?.('error', '更新安装失败', message);
            }
            return null;
        } finally {
            setInstalling(false);
        }
    }

    function remindLater() {
        const nextUntil = nextReminderUntil(reminderHours);
        localStorage.setItem(updatePreferenceKeys.remindLaterUntil, String(nextUntil));
        localStorage.removeItem(updatePreferenceKeys.skippedVersion);
        setRemindLaterUntil(nextUntil);
        setSkippedVersion('');
        notifyRef.current?.('success', '稍后提醒', `${reminderHours} 小时内不会自动提示这个更新。`);
    }

    function skipVersion() {
        if (!info?.latestVersion) {
            return;
        }

        localStorage.setItem(updatePreferenceKeys.skippedVersion, info.latestVersion);
        localStorage.removeItem(updatePreferenceKeys.remindLaterUntil);
        setSkippedVersion(info.latestVersion);
        setRemindLaterUntil(0);
        notifyRef.current?.('success', '已跳过此版本', `版本 ${info.latestVersion}`);
    }

    function clearUpdatePreference() {
        localStorage.removeItem(updatePreferenceKeys.skippedVersion);
        localStorage.removeItem(updatePreferenceKeys.remindLaterUntil);
        setSkippedVersion('');
        setRemindLaterUntil(0);
        notifyRef.current?.('success', '更新提醒已恢复', info?.latestVersion || '');
    }

    function setAutoCheck(value) {
        writeAutoCheck(value);
        setAutoCheckState(Boolean(value));
        notifyRef.current?.('success', value ? '已开启自动检查' : '已关闭自动检查', '');
    }

    function setReminderHours(value) {
        const hours = writeReminderHours(value);
        setReminderHoursState(hours);
    }

    async function cancel() {
        try {
            await CancelUpdateDownload();
        } catch {
            // The cancel path is best effort; the download promise will report final state.
        }
    }

    return {
        autoCheck,
        cancel,
        check,
        checking,
        clearUpdatePreference,
        error,
        info,
        install,
        installing,
        progress,
        remindLater,
        reminderHours,
        remindLaterUntil,
        setAutoCheck,
        setReminderHours,
        skipVersion,
        skippedVersion,
        updateDeferred,
        visibleUpdateAvailable
    };
}
