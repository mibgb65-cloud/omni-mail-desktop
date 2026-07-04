import {useEffect, useRef, useState} from 'react';
import {CancelUpdateDownload, CheckForUpdates, DownloadUpdateInstaller, LaunchUpdateInstaller} from '../../wailsjs/go/main/App';
import {EventsOn} from '../../wailsjs/runtime/runtime';

const updateProgressEvent = 'omnimail:update-download-progress';
const skippedVersionKey = 'omnimail_update_skipped_version';
const remindLaterUntilKey = 'omnimail_update_remind_later_until';
const remindLaterMs = 24 * 60 * 60 * 1000;

export function useUpdateManager(showToast) {
    const notifyRef = useRef(showToast);
    const [info, setInfo] = useState(null);
    const [checking, setChecking] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(null);
    const [skippedVersion, setSkippedVersion] = useState(() => localStorage.getItem(skippedVersionKey) || '');
    const [remindLaterUntil, setRemindLaterUntil] = useState(() => Number(localStorage.getItem(remindLaterUntilKey)) || 0);

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
        check({announceAvailable: true, notifyCurrent: false, notifyError: false});
    }, []);

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
        const nextUntil = Date.now() + remindLaterMs;
        localStorage.setItem(remindLaterUntilKey, String(nextUntil));
        localStorage.removeItem(skippedVersionKey);
        setRemindLaterUntil(nextUntil);
        setSkippedVersion('');
        notifyRef.current?.('success', '稍后提醒', '24 小时内不会自动提示这个更新。');
    }

    function skipVersion() {
        if (!info?.latestVersion) {
            return;
        }

        localStorage.setItem(skippedVersionKey, info.latestVersion);
        localStorage.removeItem(remindLaterUntilKey);
        setSkippedVersion(info.latestVersion);
        setRemindLaterUntil(0);
        notifyRef.current?.('success', '已跳过此版本', `版本 ${info.latestVersion}`);
    }

    function clearUpdatePreference() {
        localStorage.removeItem(skippedVersionKey);
        localStorage.removeItem(remindLaterUntilKey);
        setSkippedVersion('');
        setRemindLaterUntil(0);
        notifyRef.current?.('success', '更新提醒已恢复', info?.latestVersion || '');
    }

    async function cancel() {
        try {
            await CancelUpdateDownload();
        } catch {
            // The cancel path is best effort; the download promise will report final state.
        }
    }

    return {
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
        remindLaterUntil,
        skipVersion,
        skippedVersion,
        updateDeferred,
        visibleUpdateAvailable
    };
}

function isUpdateDeferred(info, skippedVersion, remindLaterUntil) {
    if (!info?.updateAvailable || info?.mandatory) {
        return false;
    }

    if (skippedVersion && skippedVersion === info.latestVersion) {
        return true;
    }
    return Number(remindLaterUntil) > Date.now();
}
