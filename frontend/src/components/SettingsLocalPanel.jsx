import {useEffect, useState} from 'react';
import {Database, FileText, HardDrive, RefreshCw, ShieldCheck, Trash2} from 'lucide-react';
import {ClearAttachmentPreviewCache, ClearUpdateCache, GetAppInfo, GetRecentApplicationLogs, GetUpdateCacheInfo} from '../../wailsjs/go/main/App';
import {buildPrivacyStatus} from '../app/privacyStatus';
import {formatDateTime, formatFileSize} from '../app/utils';
import {StatusBadge} from './Common';
import {SettingsPanelHeader} from './SettingsCommon';

export function SettingsLocalPanel({onNotify}) {
    const [appInfo, setAppInfo] = useState(null);
    const [cacheInfo, setCacheInfo] = useState(null);
    const [logs, setLogs] = useState([]);
    const [busy, setBusy] = useState('');
    const privacyStatus = buildPrivacyStatus({appInfo, cacheInfo, logs});

    useEffect(() => {
        loadLocalStatus();
    }, []);

    async function loadLocalStatus() {
        setBusy('load');
        try {
            const [nextAppInfo, nextCacheInfo, logResult] = await Promise.all([
                GetAppInfo(),
                GetUpdateCacheInfo(),
                GetRecentApplicationLogs(120)
            ]);
            setAppInfo(nextAppInfo);
            setCacheInfo(nextCacheInfo);
            setLogs(logResult?.entries || []);
        } catch (error) {
            onNotify?.('error', '读取本机状态失败', error.message || '无法读取应用信息。');
        } finally {
            setBusy('');
        }
    }

    async function clearUpdateCache() {
        setBusy('update-cache');
        try {
            const result = await ClearUpdateCache();
            onNotify?.('success', '更新缓存已清理', formatCacheSize(result?.removedSize || 0));
            await loadLocalStatus();
        } catch (error) {
            onNotify?.('error', '清理更新缓存失败', error.message || '无法删除缓存文件。');
            setBusy('');
        }
    }

    async function clearPreviewCache() {
        setBusy('preview-cache');
        try {
            const result = await ClearAttachmentPreviewCache();
            onNotify?.('success', '预览缓存已清理', `${result?.removedFiles || 0} 个临时文件`);
            await loadLocalStatus();
        } catch (error) {
            onNotify?.('error', '清理预览缓存失败', error.message || '无法删除预览文件。');
            setBusy('');
        }
    }

    return (
        <>
            <section className="settings-panel settings-panel-wide">
                <SettingsPanelHeader
                    action={<button type="button" onClick={loadLocalStatus} disabled={busy === 'load'}><RefreshCw size={15} />刷新</button>}
                    body="查看当前版本、本地路径、更新缓存和附件预览缓存。"
                    icon={HardDrive}
                    kicker="本机"
                    title="应用信息与缓存"
                />
                <div className="settings-mini-metrics">
                    <span>
                        <strong>{appInfo?.version || '未知'}</strong>
                        <small>当前版本</small>
                    </span>
                    <span>
                        <strong>{formatCacheSize(cacheInfo?.size || 0)}</strong>
                        <small>更新缓存</small>
                    </span>
                    <span>
                        <strong>{appInfo?.activeAttachmentPreviews || 0}</strong>
                        <small>活动预览</small>
                    </span>
                </div>
                <div className="settings-card-list">
                    <LocalPathCard label="配置文件" value={appInfo?.storagePath} />
                    <LocalPathCard label="应用日志" value={appInfo?.logPath} />
                    <LocalPathCard label="更新缓存" value={cacheInfo?.path || appInfo?.updateCachePath} />
                </div>
                <footer className="settings-inline-actions">
                    <button type="button" onClick={clearUpdateCache} disabled={busy === 'update-cache'}>
                        <Trash2 size={15} />
                        清理更新缓存
                    </button>
                    <button type="button" onClick={clearPreviewCache} disabled={busy === 'preview-cache'}>
                        <Trash2 size={15} />
                        清理预览缓存
                    </button>
                    <StatusBadge ok={!busy} label={busy ? '处理中' : '就绪'} />
                </footer>
            </section>

            <section className="settings-panel settings-panel-wide">
                <SettingsPanelHeader
                    action={<StatusBadge ok={privacyStatus.every((item) => item.ok)} label={privacyStatus.every((item) => item.ok) ? '低风险' : '需关注'} />}
                    body="汇总本机缓存、日志和活动预览状态，帮助判断是否需要清理本机数据。"
                    icon={ShieldCheck}
                    kicker="隐私"
                    title="本机隐私状态"
                />
                <div className="settings-card-list">
                    {privacyStatus.map((item) => (
                        <article className="settings-item-card" key={item.id}>
                            <span>
                                <strong>{item.title}</strong>
                                <small>{item.detail}</small>
                            </span>
                            <StatusBadge ok={item.ok} label={item.ok ? '正常' : '需处理'} />
                        </article>
                    ))}
                </div>
            </section>

            <section className="settings-panel settings-panel-wide">
                <SettingsPanelHeader
                    action={<button type="button" onClick={loadLocalStatus} disabled={busy === 'load'}><RefreshCw size={15} />刷新</button>}
                    body="显示最近应用日志，诊断包导出也会附带这些日志。"
                    icon={FileText}
                    kicker="日志"
                    title="最近应用日志"
                />
                <div className="local-log-list">
                    {logs.length ? logs.slice(-8).reverse().map((entry, index) => (
                        <article key={`${entry.at || 'raw'}-${index}`}>
                            <span>
                                <strong>{entry.message || entry.raw || '日志记录'}</strong>
                                <small>{formatDateTime(entry.at)} · {entry.level || 'raw'}</small>
                            </span>
                            {entry.fields ? <code>{JSON.stringify(entry.fields)}</code> : null}
                        </article>
                    )) : (
                        <p className="settings-panel-loading"><Database size={15} />暂无应用日志</p>
                    )}
                </div>
            </section>
        </>
    );
}

function LocalPathCard({label, value}) {
    return (
        <article className="settings-item-card">
            <span>
                <strong>{label}</strong>
                <small>{value || '暂无路径'}</small>
            </span>
        </article>
    );
}

function formatCacheSize(value) {
    return value > 0 ? formatFileSize(value) : '0 B';
}
