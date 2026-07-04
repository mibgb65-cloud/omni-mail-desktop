import {useEffect, useRef, useState} from 'react';
import {CancelUpdateDownload, CheckForUpdates, DownloadUpdateInstaller, LaunchUpdateInstaller} from '../../wailsjs/go/main/App';
import {EventsOn} from '../../wailsjs/runtime/runtime';

const updateProgressEvent = 'omnimail:update-download-progress';

export function useUpdateManager(showToast) {
    const notifyRef = useRef(showToast);
    const [info, setInfo] = useState(null);
    const [checking, setChecking] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(null);

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

    async function check({announceAvailable = false, notifyCurrent = true, notifyError = notifyCurrent} = {}) {
        setChecking(true);
        setError('');
        try {
            const nextInfo = await CheckForUpdates();
            setInfo(nextInfo);
            if (nextInfo?.updateAvailable && announceAvailable) {
                notifyRef.current?.('success', '发现新版本', `最新版本 ${nextInfo.latestVersion}`);
            } else if (notifyCurrent) {
                notifyRef.current?.('success', nextInfo?.updateAvailable ? '发现新版本' : '当前已是最新版本', nextInfo?.latestVersion || nextInfo?.currentVersion || '');
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

    async function cancel() {
        try {
            await CancelUpdateDownload();
        } catch {
            // The cancel path is best effort; the download promise will report final state.
        }
    }

    return {cancel, check, checking, error, info, install, installing, progress};
}
