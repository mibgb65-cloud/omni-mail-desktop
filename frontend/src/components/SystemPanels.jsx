import {useEffect, useMemo, useState} from 'react';
import {Database, Globe2, RefreshCw, ShieldCheck} from 'lucide-react';
import {GetDomainDNSHealth, ListDevices, RevokeDevice, RunSystemCleanup, UpdateDevice} from '../../wailsjs/go/main/App';
import {formatDateTime} from '../app/utils';
import {StatusBadge} from './Common';
import {SettingsPanelHeader} from './SettingsCommon';

export function DNSHealthPanel({domain, onNotify, selectedProfile}) {
    const [domainInput, setDomainInput] = useState(domain || '');
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setDomainInput(domain || '');
        setHealth(null);
        setError('');
    }, [domain]);

    async function handleCheck(event) {
        event.preventDefault();
        const targetDomain = normalizeDomainInput(domainInput);
        if (!selectedProfile?.id || !targetDomain) {
            setError('请先选择或输入一个域名。');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await GetDomainDNSHealth({
                profileId: selectedProfile.id,
                domain: targetDomain
            });
            setHealth(result);
            onNotify?.(result?.ready ? 'success' : 'error', result?.ready ? 'DNS 已就绪' : 'DNS 仍需处理', targetDomain);
        } catch (checkError) {
            const message = checkError.message || '无法检查 DNS。';
            setError(message);
            onNotify?.('error', 'DNS 检查失败', message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="settings-panel">
            <SettingsPanelHeader
                action={health ? <StatusBadge ok={health.ready} label={health.ready ? '就绪' : '待处理'} /> : null}
                body="按当前接入点检查 MX、TXT、路由等域名记录是否满足收发要求。"
                icon={Globe2}
                kicker="域名"
                title="DNS 健康检查"
            />
            <form className="settings-inline-form" onSubmit={handleCheck}>
                <label>
                    <span>域名</span>
                    <input
                        placeholder="mail.example.com"
                        value={domainInput}
                        onChange={(event) => setDomainInput(event.target.value)}
                    />
                </label>
                <button type="submit" disabled={loading || !domainInput.trim()}>
                    <RefreshCw className={loading ? 'spin-inline' : ''} size={16} />
                    {loading ? '检查中' : '检查 DNS'}
                </button>
            </form>
            {error ? <p className="settings-error">{error}</p> : null}
            {health ? (
                <div className="dns-check-list">
                    {(health.checks || []).map((check) => (
                        <article className={check.ok ? 'ok' : ''} key={check.id || check.label}>
                            {check.ok ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
                            <div>
                                <strong>{check.label || check.id}</strong>
                                <small>{check.status || (check.ok ? '已通过' : check.hint || '需要检查')}</small>
                                {check.records?.length ? (
                                    <code>{check.records.join(' / ')}</code>
                                ) : null}
                            </div>
                        </article>
                    ))}
                </div>
            ) : null}
        </section>
    );
}

export function DeviceManagerPanel({onNotify, selectedProfile}) {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [workingDevice, setWorkingDevice] = useState('');
    const [error, setError] = useState('');
    const visibleDevices = useMemo(() => [...devices].sort((a, b) => {
        const aCurrent = isCurrentDevice(a) ? 1 : 0;
        const bCurrent = isCurrentDevice(b) ? 1 : 0;
        return bCurrent - aCurrent;
    }), [devices, selectedProfile?.deviceId, selectedProfile?.tokenPreview]);

    useEffect(() => {
        if (!selectedProfile?.id) {
            setDevices([]);
            return;
        }

        loadDevices({silent: true});
    }, [selectedProfile?.id]);

    function isCurrentDevice(device) {
        return Boolean(
            device
            && (
                (selectedProfile?.deviceId && device.id === selectedProfile.deviceId)
                || (!selectedProfile?.deviceId && selectedProfile?.tokenPreview && device.tokenPreview === selectedProfile.tokenPreview)
            )
        );
    }

    async function loadDevices(options = {}) {
        if (!selectedProfile?.id) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await ListDevices({profileId: selectedProfile.id});
            setDevices(result || []);
            if (!options.silent) {
                onNotify?.('success', '设备 Token 已刷新', `${(result || []).length} 个设备`);
            }
        } catch (loadError) {
            const message = loadError.message || '无法读取设备列表。';
            setError(message);
            if (!options.silent) {
                onNotify?.('error', '读取设备失败', message);
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleToggleDevice(device) {
        if (!selectedProfile?.id || !device?.id) {
            return;
        }
        if (isCurrentDevice(device)) {
            setError('当前桌面端正在使用这个 Token，不能在本机停用。');
            return;
        }

        const enabled = device.enabled !== false && !device.revokedAt;
        setWorkingDevice(device.id);
        setError('');

        try {
            const updated = await UpdateDevice({
                profileId: selectedProfile.id,
                deviceId: device.id,
                clientType: device.clientType || 'desktop',
                label: device.label || 'API Client',
                scope: device.scope || 'read_write',
                enabled: !enabled
            });
            setDevices((current) => current.map((item) => item.id === updated.id ? updated : item));
            onNotify?.('success', !enabled ? '设备已启用' : '设备已停用', updated.label || updated.tokenPreview);
        } catch (updateError) {
            const message = updateError.message || '无法更新设备。';
            setError(message);
            onNotify?.('error', '更新设备失败', message);
        } finally {
            setWorkingDevice('');
        }
    }

    async function handleRevokeDevice(device) {
        if (isCurrentDevice(device)) {
            setError('当前桌面端正在使用这个 Token，不能在本机撤销。');
            return;
        }
        if (!selectedProfile?.id || !device?.id || !window.confirm(`撤销设备「${device.label || device.tokenPreview || device.id}」？`)) {
            return;
        }

        setWorkingDevice(device.id);
        setError('');

        try {
            const revoked = await RevokeDevice({
                profileId: selectedProfile.id,
                deviceId: device.id
            });
            setDevices((current) => current.map((item) => item.id === revoked.id ? revoked : item));
            onNotify?.('success', '设备 Token 已撤销', revoked.label || revoked.id);
        } catch (revokeError) {
            const message = revokeError.message || '无法撤销设备。';
            setError(message);
            onNotify?.('error', '撤销设备失败', message);
        } finally {
            setWorkingDevice('');
        }
    }

    return (
        <section className="settings-panel">
            <SettingsPanelHeader
                action={(
                    <button type="button" onClick={() => loadDevices()} disabled={loading}>
                        <RefreshCw className={loading ? 'spin-inline' : ''} size={16} />
                        刷新
                    </button>
                )}
                body="每个接入点独立维护设备 Token，桌面端不会共享到其他 Base URL。"
                icon={ShieldCheck}
                kicker="设备"
                title="Device Token 管理"
            />
            {error ? <p className="settings-error">{error}</p> : null}
            {devices.length ? (
                <div className="settings-card-list">
                    {visibleDevices.map((device) => {
                        const enabled = device.enabled !== false && !device.revokedAt;
                        const current = isCurrentDevice(device);

                        return (
                            <article className={`settings-item-card ${current ? 'current' : ''}`} key={device.id}>
                                <div>
                                    <strong>{device.label || '未命名设备'}</strong>
                                    <small>{device.clientType || 'unknown'} · {device.scope || 'read_write'} · {device.tokenPreview || device.id}</small>
                                    <small>创建：{formatDateTime(device.createdAt)} · 最近使用：{formatDateTime(device.lastSeenAt)}</small>
                                </div>
                                <div className="settings-item-actions">
                                    {current ? <StatusBadge ok label="当前桌面端" /> : null}
                                    <StatusBadge ok={enabled} label={enabled ? '启用' : '已停用'} />
                                    <button type="button" onClick={() => handleToggleDevice(device)} disabled={current || workingDevice === device.id}>
                                        {enabled ? '停用' : '启用'}
                                    </button>
                                    <button className="danger" type="button" onClick={() => handleRevokeDevice(device)} disabled={current || workingDevice === device.id || !enabled}>
                                        <Trash2 size={15} />
                                        撤销
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <p className="insight-empty">{loading ? '正在读取设备 Token。' : '当前接入点还没有可展示的设备 Token。'}</p>
            )}
        </section>
    );
}

export function MaintenancePanel({onNotify, selectedProfile}) {
    const [retentionDays, setRetentionDays] = useState(90);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState('');
    const [error, setError] = useState('');
    const hasAdminSession = Boolean(selectedProfile?.hasAdminSession);

    async function handleCleanup(dryRun) {
        if (!selectedProfile?.id) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先到“安全”分组授权当前接入点管理员会话。');
            return;
        }

        const days = Math.min(Math.max(Number(retentionDays) || 90, 1), 3650);
        if (!dryRun && !window.confirm(`确认清理 ${days} 天前已删除的数据？`)) {
            return;
        }

        setLoading(dryRun ? 'preview' : 'cleanup');
        setError('');

        try {
            const cleanup = await RunSystemCleanup({
                profileId: selectedProfile.id,
                retentionDays: days,
                dryRun
            });
            setResult(cleanup);
            onNotify?.('success', dryRun ? '清理预览完成' : '系统清理完成', `邮件 ${formatCount(cleanup.messages)}，附件 ${formatCount(cleanup.attachments)}`);
        } catch (cleanupError) {
            const message = cleanupError.message || '当前接入点管理员会话可能已失效。';
            setError(message);
            onNotify?.('error', '系统清理失败', message);
        } finally {
            setLoading('');
        }
    }

    return (
        <section className="settings-panel">
            <SettingsPanelHeader
                action={<StatusBadge ok={hasAdminSession} label={hasAdminSession ? '管理员已授权' : '需要授权'} />}
                body="清理接口要求当前接入点管理员会话；设备 Token 只负责邮箱接入。"
                icon={Database}
                kicker="维护"
                title="系统清理"
            />
            <div className="settings-inline-form">
                <label>
                    <span>保留天数</span>
                    <input
                        disabled={!hasAdminSession}
                        max="3650"
                        min="1"
                        type="number"
                        value={retentionDays}
                        onChange={(event) => setRetentionDays(event.target.value)}
                    />
                </label>
                <button type="button" onClick={() => handleCleanup(true)} disabled={!hasAdminSession || Boolean(loading)}>
                    <Eye size={16} />
                    {loading === 'preview' ? '预览中' : '预览'}
                </button>
                <button className="danger" type="button" onClick={() => handleCleanup(false)} disabled={!hasAdminSession || Boolean(loading)}>
                    <Trash2 size={16} />
                    {loading === 'cleanup' ? '清理中' : '执行清理'}
                </button>
            </div>
            {error ? <p className="settings-error">{error}</p> : null}
            {result ? (
                <div className="settings-mini-metrics">
                    <span>
                        <strong>{formatCount(result.messages)}</strong>
                        <small>邮件</small>
                    </span>
                    <span>
                        <strong>{formatCount(result.attachments)}</strong>
                        <small>附件</small>
                    </span>
                    <span>
                        <strong>{formatCount(result.accounts)}</strong>
                        <small>账号</small>
                    </span>
                    <span>
                        <strong>{formatDateTime(result.cutoff)}</strong>
                        <small>清理边界</small>
                    </span>
                </div>
            ) : null}
        </section>
    );
}

