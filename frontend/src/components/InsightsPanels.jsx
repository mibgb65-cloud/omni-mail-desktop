import {ClipboardList} from 'lucide-react';
import {formatAuditAction, formatCount, formatDateTime, metadataSummary} from '../app/utils';
import {StatusBadge} from './Common';

export function DiagnosticsPanel({diagnostics}) {
    const bindings = diagnostics.bindings || {};
    const counts = diagnostics.counts || {};
    const setup = diagnostics.setup || {};
    const latest = diagnostics.latest || {};
    const domains = diagnostics.configuredDomains || [];
    const stats = [
        {label: '域名', value: counts.domains},
        {label: '邮箱账号', value: counts.accounts},
        {label: '邮件', value: counts.messages},
        {label: '未读', value: counts.unreadMessages},
        {label: '附件', value: counts.attachments},
        {label: '设备 Token', value: counts.devices}
    ];
    const bindingItems = [
        {label: 'D1 数据库', ok: bindings.d1},
        {label: 'R2 附件桶', ok: bindings.r2},
        {label: '静态资源', ok: bindings.assets},
        {label: 'JWT_SECRET', ok: bindings.jwtSecret}
    ];

    return (
        <section className="insight-panel" aria-label="系统诊断详情">
            <header>
                <div>
                    <p>当前接入点诊断</p>
                    <h3>{diagnostics.service || 'omnimail'} · {diagnostics.storage || 'unknown'}</h3>
                    <small>生成时间：{formatDateTime(diagnostics.generatedAt)}</small>
                </div>
                <StatusBadge ok={Boolean(setup.ready)} label={setup.ready ? '必需项就绪' : '需要配置'} />
            </header>

            <div className="insight-metrics">
                {stats.map((item) => (
                    <span key={item.label}>
                        <strong>{formatCount(item.value)}</strong>
                        <small>{item.label}</small>
                    </span>
                ))}
            </div>

            <div className="insight-columns">
                <section>
                    <div className="insight-section-title">
                        <Database size={16} />
                        <h4>绑定状态</h4>
                    </div>
                    <div className="diagnostic-list">
                        {bindingItems.map((item) => (
                            <span className={item.ok ? 'ok' : ''} key={item.label}>
                                {item.ok ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
                                {item.label}
                            </span>
                        ))}
                    </div>
                    <p className="insight-muted">
                        {domains.length ? `配置域名：${domains.join('，')}` : '尚未读取到配置域名。'}
                    </p>
                </section>

                <section>
                    <div className="insight-section-title">
                        <ListChecks size={16} />
                        <h4>部署进度</h4>
                    </div>
                    <div className="diagnostic-step-list">
                        {(setup.steps || []).map((step) => (
                            <article className={`diagnostic-step ${step.complete ? 'complete' : ''}`} key={step.id}>
                                {step.complete ? <CircleCheck size={15} /> : <CircleAlert size={15} />}
                                <span>
                                    <strong>{step.label}{step.required ? '' : ' · 可选'}</strong>
                                    <small>{step.complete ? '已完成' : step.hint}</small>
                                </span>
                            </article>
                        ))}
                    </div>
                </section>
            </div>

            <div className="diagnostic-latest">
                <p>
                    <strong>最新来信</strong>
                    <span>
                        {latest.inbound
                            ? `${latest.inbound.subject || '无主题'} · ${latest.inbound.fromEmail || latest.inbound.accountAddress || '未知发件人'} · ${formatDateTime(latest.inbound.receivedAt)}`
                            : '暂无来信记录'}
                    </span>
                </p>
                <p>
                    <strong>最新审计</strong>
                    <span>
                        {latest.audit
                            ? `${formatAuditAction(latest.audit.action)} · ${formatDateTime(latest.audit.createdAt)}`
                            : '暂无审计记录'}
                    </span>
                </p>
            </div>
        </section>
    );
}

export function AuditLogPanel({logs}) {
    return (
        <section className="insight-panel" aria-label="最近审计日志">
            <header>
                <div>
                    <p>最近审计日志</p>
                    <h3>当前接入点活动记录</h3>
                </div>
                <StatusBadge ok={logs.length > 0} label={logs.length ? `${logs.length} 条` : '暂无'} />
            </header>

            {logs.length ? (
                <div className="audit-log-list">
                    {logs.map((log) => {
                        const actor = log.actorEmail || log.actorId || '系统';
                        const resource = [log.resourceType, log.resourceId].filter(Boolean).join(' · ');
                        const metadata = metadataSummary(log.metadata);

                        return (
                            <article className="audit-log-item" key={log.id}>
                                <div>
                                    <strong>{formatAuditAction(log.action)}</strong>
                                    <small>{log.summary || resource || '无摘要'}</small>
                                </div>
                                <dl>
                                    <div>
                                        <dt>操作者</dt>
                                        <dd>{actor}</dd>
                                    </div>
                                    <div>
                                        <dt>时间</dt>
                                        <dd>{formatDateTime(log.createdAt)}</dd>
                                    </div>
                                    {resource ? (
                                        <div>
                                            <dt>资源</dt>
                                            <dd>{resource}</dd>
                                        </div>
                                    ) : null}
                                    {metadata ? (
                                        <div>
                                            <dt>元数据</dt>
                                            <dd>{metadata}</dd>
                                        </div>
                                    ) : null}
                                </dl>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <p className="insight-empty">当前接入点还没有可展示的审计日志。</p>
            )}
        </section>
    );
}

