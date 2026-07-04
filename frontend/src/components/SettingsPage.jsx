import {useEffect, useState} from 'react';
import {Activity, ArrowLeft, ClipboardList, KeyRound, Mail, Moon, PanelLeftOpen, ShieldCheck, Sun} from 'lucide-react';
import {ClipboardSetText} from '../../wailsjs/runtime/runtime';
import {formatCount, settingsTabs, stringifyDiagnosticReport} from '../app/utils';
import {EmptyState, SettingRow, StatusBadge} from './Common';
import {AuditLogPanel, DiagnosticsPanel} from './InsightsPanels';
import {DNSHealthPanel, DeviceManagerPanel, MaintenancePanel} from './SystemPanels';
import {MailboxSettingsPanel} from './MailboxSettingsPanel';
import {SecurityPanel} from './SecurityPanel';

export function SettingsPage({
    auditLogs,
    busy,
    canClearCurrentDraft,
    diagnostics,
    insightsProfileId,
    onBack,
    onClearCurrentDraft,
    onLoadInsights,
    onNotify,
    onOpenProfiles,
    onProfileUpdate,
    onReloadMailbox,
    onResetLayout,
    selectedAccount,
    selectedProfile,
    status,
    storagePath,
    theme,
    toggleTheme,
    workspace
}) {
    const [activeTab, setActiveTab] = useState('general');
    const insightsLoaded = Boolean(selectedProfile && insightsProfileId === selectedProfile.id && diagnostics);
    const setup = insightsLoaded ? diagnostics.setup : null;
    const auditCount = insightsLoaded ? diagnostics.counts?.auditLogs || auditLogs.length : 0;
    const canLoadInsights = Boolean(selectedProfile?.hasToken);
    const visibleTabs = selectedProfile?.hasToken
        ? settingsTabs
        : settingsTabs.filter((tab) => tab.id === 'general');

    useEffect(() => {
        if (!visibleTabs.some((tab) => tab.id === activeTab)) {
            setActiveTab('general');
        }
    }, [activeTab, visibleTabs]);

    async function handleCopyDiagnostics() {
        if (!selectedProfile) {
            return;
        }

        const report = stringifyDiagnosticReport({
            auditLogs,
            diagnostics,
            profile: selectedProfile,
            status,
            storagePath
        });

        try {
            await ClipboardSetText(report);
            onNotify?.('success', '诊断信息已复制', selectedProfile.baseUrl);
        } catch (copyError) {
            try {
                await navigator.clipboard.writeText(report);
                onNotify?.('success', '诊断信息已复制', selectedProfile.baseUrl);
            } catch {
                onNotify?.('error', '复制诊断信息失败', copyError.message || '当前系统不允许访问剪贴板。');
            }
        }
    }

    return (
        <main id="reader" className="workspace-page settings-page" aria-label="设置">
            <header className="settings-page-header">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回邮箱
                </button>
                <div>
                    <p>设置</p>
                    <h1>工作台设置</h1>
                    <small>{selectedProfile ? selectedProfile.baseUrl : '尚未选择接入点'}</small>
                </div>
            </header>

            <div className="settings-page-body">
                <nav className="settings-tabbar" aria-label="设置分组">
                    {visibleTabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                className={activeTab === tab.id ? 'active' : ''}
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>

                {activeTab === 'general' ? (
                    <>
                        <div className="settings-grid">
                            <SettingRow
                                icon={theme === 'dark' ? Moon : Sun}
                                title="外观"
                                body={theme === 'dark' ? '当前为深色模式' : '当前为浅色模式'}
                                action={<button type="button" onClick={toggleTheme}>切换主题</button>}
                            />
                            <SettingRow
                                icon={ShieldCheck}
                                title="接入点状态"
                                body={selectedProfile ? selectedProfile.baseUrl : '尚未选择接入点'}
                                action={<StatusBadge ok={Boolean(status?.ok)} label={status?.ok ? '正常' : '未验证'} />}
                            />
                            <SettingRow
                                icon={ShieldCheck}
                                title="接入点管理"
                                body="集中管理 Base URL、授权状态、Token 和连接测试。"
                                action={<button type="button" onClick={onOpenProfiles}>打开管理</button>}
                            />
                            <SettingRow
                                icon={Activity}
                                title="系统诊断"
                                body={insightsLoaded
                                    ? `必需项 ${setup?.completedRequired || 0}/${setup?.totalRequired || 0}，总进度 ${setup?.completed || 0}/${setup?.total || 0}`
                                    : canLoadInsights
                                        ? '读取当前接入点的 Worker 绑定、数据量和部署进度。'
                                        : '当前接入点尚未授权，无法读取诊断。'}
                                action={(
                                    <button type="button" onClick={() => onLoadInsights(selectedProfile)} disabled={!canLoadInsights || busy === 'insights'}>
                                        {busy === 'insights' ? '读取中' : insightsLoaded ? '刷新' : '读取'}
                                    </button>
                                )}
                            />
                            <SettingRow
                                icon={ClipboardList}
                                title="审计日志"
                                body={insightsLoaded
                                    ? `已加载最近 ${auditLogs.length} 条，接入点累计 ${formatCount(auditCount)} 条。`
                                    : '读取当前接入点最近的授权、邮件和配置变更记录。'}
                                action={<StatusBadge ok={insightsLoaded} label={insightsLoaded ? '已加载' : '未读取'} />}
                            />
                            <SettingRow
                                icon={ClipboardList}
                                title="诊断导出"
                                body={selectedProfile ? '复制当前接入点的脱敏诊断 JSON。' : '选择接入点后可复制诊断 JSON。'}
                                action={<button type="button" onClick={handleCopyDiagnostics} disabled={!selectedProfile}>复制 JSON</button>}
                            />
                            <SettingRow
                                icon={Mail}
                                title="本机草稿"
                                body="写信草稿按当前接入点和发件账号分别保存在本机。"
                                action={<button type="button" onClick={onClearCurrentDraft} disabled={!canClearCurrentDraft}>清除当前草稿</button>}
                            />
                            <SettingRow
                                icon={PanelLeftOpen}
                                title="布局偏好"
                                body="恢复侧栏、邮件列表宽度和侧栏收起状态。"
                                action={<button type="button" onClick={onResetLayout}>恢复默认</button>}
                            />
                            <SettingRow
                                icon={KeyRound}
                                title="快捷键"
                                body="Ctrl K 搜索，J/K 切换邮件，R 刷新，N 写邮件。"
                                action={<StatusBadge ok label="已启用" />}
                            />
                            <SettingRow
                                icon={ShieldCheck}
                                title="本地存储"
                                body={storagePath || '正在读取本地配置路径'}
                                action={<StatusBadge ok label="本机" />}
                            />
                            <SettingRow
                                icon={KeyRound}
                                title="Token 存储"
                                body={selectedProfile?.hasAdminSession
                                    ? `Device Token 和管理员会话都按当前接入点隔离保存。管理员：${selectedProfile.adminEmail || selectedProfile.adminTokenPreview}`
                                    : 'Windows 下使用 DPAPI 按接入点分别保护本地 Device Token。'}
                                action={<StatusBadge ok={Boolean(selectedProfile?.hasAdminSession)} label={selectedProfile?.hasAdminSession ? '管理员已授权' : '仅设备 Token'} />}
                            />
                        </div>
                        {!selectedProfile?.hasToken ? (
                            <section className="insight-panel">
                                <header>
                                    <div>
                                        <p>接入点运维</p>
                                        <h3>授权后显示高级管理工具</h3>
                                        <small>邮箱设置、DNS 健康、设备 Token 和维护工具都按接入点隔离，不使用全局用户态。</small>
                                    </div>
                                    <StatusBadge ok={false} label="未授权" />
                                </header>
                            </section>
                        ) : null}
                        {insightsLoaded ? (
                            <>
                                <DiagnosticsPanel diagnostics={diagnostics} />
                                <AuditLogPanel logs={auditLogs} />
                            </>
                        ) : null}
                    </>
                ) : null}

                {selectedProfile?.hasToken ? (
                    <>
                        {activeTab === 'mailbox' ? (
                        <MailboxSettingsPanel
                            onNotify={onNotify}
                            onReloadMailbox={onReloadMailbox}
                            selectedAccount={selectedAccount}
                            selectedProfile={selectedProfile}
                        />
                        ) : null}
                        {activeTab === 'dns' ? (
                        <DNSHealthPanel
                            domain={workspace?.selectedDomain || ''}
                            onNotify={onNotify}
                            selectedProfile={selectedProfile}
                        />
                        ) : null}
                        {activeTab === 'devices' ? (
                        <DeviceManagerPanel
                            onNotify={onNotify}
                            selectedProfile={selectedProfile}
                        />
                        ) : null}
                        {activeTab === 'maintenance' ? (
                        <MaintenancePanel
                            onNotify={onNotify}
                            selectedProfile={selectedProfile}
                        />
                        ) : null}
                        {activeTab === 'security' ? (
                        <SecurityPanel
                            onNotify={onNotify}
                            onProfileUpdate={onProfileUpdate}
                            selectedProfile={selectedProfile}
                        />
                        ) : null}
                    </>
                ) : null}
            </div>
        </main>
    );
}

