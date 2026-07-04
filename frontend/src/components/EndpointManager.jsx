import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, CircleAlert, CircleCheck, Plus, RefreshCw, ShieldCheck} from 'lucide-react';
import {CheckEndpointHealth} from '../../wailsjs/go/main/App';
import {formatCount, formatDateTime, formatProfileDate} from '../app/utils';
import {EmptyState, StatusBadge} from './Common';

export function EndpointManagerPage({
    busy,
    onAddProfile,
    onAuth,
    onBack,
    onDeleteProfile,
    onEditProfile,
    onNotify,
    onProfileSelect,
    onTestProfile,
    profiles,
    selectedProfileId,
    status
}) {
    const [endpointHealth, setEndpointHealth] = useState({});
    const [healthLoading, setHealthLoading] = useState(false);
    const healthRequestSeq = useRef(0);
    const authorizedCount = profiles.filter((profile) => profile.hasToken).length;
    const profileSignature = profiles.map((profile) => `${profile.id}:${profile.updatedAt}:${profile.hasToken}`).join('|');

    useEffect(() => {
        if (!profiles.length) {
            setEndpointHealth({});
            return undefined;
        }

        refreshEndpointHealth({silent: true});
        return undefined;
    }, [profileSignature]);

    async function refreshEndpointHealth(options = {}) {
        if (!profiles.length) {
            return;
        }

        const requestId = healthRequestSeq.current + 1;
        healthRequestSeq.current = requestId;
        setHealthLoading(true);

        try {
            const results = await Promise.all(profiles.map(async (profile) => {
                try {
                    return [profile.id, await CheckEndpointHealth(profile.id)];
                } catch (healthError) {
                    return [profile.id, {
                        profileId: profile.id,
                        checkedAt: new Date().toISOString(),
                        connection: {
                            baseUrl: profile.baseUrl,
                            ok: false,
                            message: healthError.message || '检查失败'
                        },
                        error: healthError.message || '检查失败'
                    }];
                }
            }));
            if (requestId !== healthRequestSeq.current) {
                return;
            }
            setEndpointHealth(Object.fromEntries(results));
            if (!options.silent) {
                onNotify?.('success', '接入点健康状态已刷新', `${results.length} 个接入点`);
            }
        } finally {
            if (requestId === healthRequestSeq.current) {
                setHealthLoading(false);
            }
        }
    }

    return (
        <main id="reader" className="workspace-page endpoint-manager-page" aria-label="接入点管理">
            <header className="endpoint-manager-page-header">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回
                </button>
                <div>
                    <p>接入点管理</p>
                    <h1>接入点</h1>
                    <small>集中管理 Worker Base URL、授权状态、设备 Token 和连接测试。</small>
                </div>
            </header>
            <div className="endpoint-manager">
                <div className="endpoint-manager-summary">
                    <div className="endpoint-manager-counts">
                        <span>
                            <strong>{profiles.length}</strong>
                            <small>接入点</small>
                        </span>
                        <span>
                            <strong>{authorizedCount}</strong>
                            <small>已授权</small>
                        </span>
                        <span>
                            <strong>{profiles.length - authorizedCount}</strong>
                            <small>待授权</small>
                        </span>
                    </div>
                    <button className="primary-action compact" type="button" onClick={onAddProfile}>
                        <Plus size={16} />
                        添加接入点
                    </button>
                </div>

                {profiles.length ? (
                    <>
                        <EndpointHealthOverview
                            healthLoading={healthLoading}
                            healthMap={endpointHealth}
                            onRefresh={() => refreshEndpointHealth()}
                            profiles={profiles}
                        />
                        <div className="endpoint-manager-list">
                            {profiles.map((profile) => {
                                const isSelected = profile.id === selectedProfileId;
                                const health = endpointHealth[profile.id];
                                const rowStatus = status?.baseUrl === profile.baseUrl ? status : health?.connection || null;
                                const diagnostics = health?.diagnostics || null;
                                const setupReady = Boolean(diagnostics?.setup?.ready);
                                const counts = diagnostics?.counts || {};
                                const latestInbound = diagnostics?.latest?.inbound;

                                return (
                                    <article className={`endpoint-manager-card ${isSelected ? 'active' : ''}`} key={profile.id}>
                                        <header>
                                            <div className="endpoint-manager-title">
                                                <strong>{profile.name || '未命名接入点'}</strong>
                                                <small>{profile.baseUrl}</small>
                                            </div>
                                            <div className="endpoint-manager-badges">
                                                {isSelected ? <StatusBadge ok label="当前使用" /> : null}
                                                <StatusBadge ok={Boolean(rowStatus?.ok)} label={rowStatus?.ok ? '连接正常' : health ? '连接异常' : '未检查'} />
                                                <StatusBadge ok={profile.hasToken && !profile.secretError} label={profile.secretError ? '需重新授权' : profile.hasToken ? '已授权' : '未授权'} />
                                                {profile.hasToken ? <StatusBadge ok={setupReady} label={setupReady ? '部署就绪' : diagnostics ? '待配置' : '未诊断'} /> : null}
                                            </div>
                                        </header>

                                        <div className="endpoint-meta-grid endpoint-meta-grid-expanded">
                                            <span>
                                                <small>Token</small>
                                                <strong>{profile.hasToken ? profile.tokenPreview : '未保存'}</strong>
                                            </span>
                                            <span>
                                                <small>设备名称</small>
                                                <strong>{profile.deviceLabel || 'Windows 桌面端'}</strong>
                                            </span>
                                            <span>
                                                <small>域名 / 邮箱</small>
                                                <strong>{diagnostics ? `${formatCount(counts.domains)} / ${formatCount(counts.accounts)}` : '未读取'}</strong>
                                            </span>
                                            <span>
                                                <small>邮件 / 未读</small>
                                                <strong>{diagnostics ? `${formatCount(counts.messages)} / ${formatCount(counts.unreadMessages)}` : '未读取'}</strong>
                                            </span>
                                            <span>
                                                <small>最后来信</small>
                                                <strong>{latestInbound ? formatDateTime(latestInbound.receivedAt) : '暂无'}</strong>
                                            </span>
                                            <span>
                                                <small>最后使用</small>
                                                <strong>{formatProfileDate(profile.lastUsedAt)}</strong>
                                            </span>
                                        </div>

                                        {rowStatus || health?.error ? (
                                            <p className={`endpoint-test-result ${rowStatus?.ok && !health?.error ? 'ok' : 'error'}`}>
                                                {rowStatus?.ok && !health?.error ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
                                                {health?.error || rowStatus?.message || (rowStatus?.ok ? '连接正常' : '连接失败')}
                                            </p>
                                        ) : null}
                                        {profile.secretError ? (
                                            <p className="endpoint-test-result error">
                                                <CircleAlert size={15} />
                                                {profile.secretError}
                                            </p>
                                        ) : null}

                                        <footer className="endpoint-manager-actions">
                                            <button type="button" onClick={() => onProfileSelect(profile)} disabled={isSelected || busy === 'mailbox' || busy === 'mailbox-more'}>
                                                {isSelected ? '当前使用' : '设为当前'}
                                            </button>
                                            <button type="button" onClick={() => onTestProfile(profile)} disabled={busy === 'test'}>
                                                测试连接
                                            </button>
                                            <button type="button" onClick={() => onAuth(profile)} disabled={busy === 'auth'}>
                                                {profile.hasToken ? '重新授权' : '授权'}
                                            </button>
                                            <button type="button" onClick={() => onEditProfile(profile)} disabled={busy === 'profile'}>
                                                编辑
                                            </button>
                                            <button className="danger" type="button" onClick={() => onDeleteProfile(profile)} disabled={busy === 'delete'}>
                                                删除
                                            </button>
                                        </footer>
                                    </article>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <EmptyState
                        icon={ShieldCheck}
                        title="还没有接入点"
                        body="添加部署后的 OmniMail Worker Base URL，即可开始接入邮箱。"
                    />
                )}
            </div>
        </main>
    );
}

export function EndpointHealthOverview({healthLoading, healthMap, onRefresh, profiles}) {
    const loadedItems = profiles.map((profile) => healthMap[profile.id]).filter(Boolean);
    const connectedCount = loadedItems.filter((item) => item.connection?.ok).length;
    const readyCount = loadedItems.filter((item) => item.diagnostics?.setup?.ready).length;
    const issueCount = loadedItems.filter((item) => item.error || item.connection?.ok === false || (item.diagnostics && !item.diagnostics.setup?.ready)).length;

    return (
        <section className="endpoint-health-panel" aria-label="接入点健康总览">
            <header>
                <div>
                    <p>健康总览</p>
                    <h2>全部接入点状态</h2>
                    <small>连接检查不会切换当前接入点；已授权接入点会额外读取诊断数据。</small>
                </div>
                <button type="button" onClick={onRefresh} disabled={healthLoading}>
                    <RefreshCw className={healthLoading ? 'spin-inline' : ''} size={16} />
                    {healthLoading ? '刷新中' : '刷新全部'}
                </button>
            </header>

            <div className="endpoint-health-metrics">
                <span>
                    <strong>{formatCount(profiles.length)}</strong>
                    <small>接入点</small>
                </span>
                <span>
                    <strong>{formatCount(connectedCount)}</strong>
                    <small>连接正常</small>
                </span>
                <span>
                    <strong>{formatCount(readyCount)}</strong>
                    <small>部署就绪</small>
                </span>
                <span>
                    <strong>{formatCount(issueCount)}</strong>
                    <small>需要处理</small>
                </span>
            </div>

            <div className="endpoint-health-list">
                {profiles.map((profile) => {
                    const health = healthMap[profile.id];
                    const diagnostics = health?.diagnostics;
                    const connectionOK = Boolean(health?.connection?.ok);
                    const setupReady = Boolean(diagnostics?.setup?.ready);
                    const counts = diagnostics?.counts || {};
                    const latestInbound = diagnostics?.latest?.inbound;
                    const statusLabel = health
                        ? health.error
                            ? '异常'
                            : connectionOK
                                ? profile.hasToken
                                    ? setupReady ? '就绪' : diagnostics ? '待配置' : '未诊断'
                                    : '可连接'
                                : '离线'
                        : '未检查';

                    return (
                        <article className="endpoint-health-row" key={profile.id}>
                            <div>
                                <strong>{profile.name || '未命名接入点'}</strong>
                                <small>{profile.baseUrl}</small>
                            </div>
                            <StatusBadge ok={connectionOK && !health?.error} label={statusLabel} />
                            <span>
                                <small>账号</small>
                                <strong>{diagnostics ? formatCount(counts.accounts) : '-'}</strong>
                            </span>
                            <span>
                                <small>邮件</small>
                                <strong>{diagnostics ? formatCount(counts.messages) : '-'}</strong>
                            </span>
                            <span>
                                <small>最近来信</small>
                                <strong>{latestInbound ? formatDateTime(latestInbound.receivedAt) : '-'}</strong>
                            </span>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

