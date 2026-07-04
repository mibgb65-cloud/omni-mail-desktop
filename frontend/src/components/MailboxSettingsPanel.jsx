import {useEffect, useState} from 'react';
import {CircleCheck, Mail, RefreshCw} from 'lucide-react';
import {GetAccountSettings, SaveAccountSettings} from '../../wailsjs/go/main/App';
import {defaultMailboxSettings, formatCount, formatDateTime, invalidRecipients, normalizeMailboxSettings} from '../app/utils';
import {StatusBadge} from './Common';
import {SettingsPanelHeader} from './SettingsCommon';

export function MailboxSettingsPanel({onNotify, onReloadMailbox, selectedAccount, selectedProfile}) {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!selectedProfile?.id || !selectedAccount?.id) {
            setSettings(null);
            setError('');
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setError('');

        GetAccountSettings({
            profileId: selectedProfile.id,
            accountId: selectedAccount.id
        }).then((result) => {
            if (!cancelled) {
                setSettings(normalizeMailboxSettings(result));
            }
        }).catch((loadError) => {
            if (!cancelled) {
                setError(loadError.message || '无法读取邮箱设置。');
            }
        }).finally(() => {
            if (!cancelled) {
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [selectedProfile?.id, selectedAccount?.id]);

    function updateField(field, value) {
        setSettings((current) => normalizeMailboxSettings({
            ...(current || defaultMailboxSettings),
            [field]: value
        }));
    }

    async function handleSave(event) {
        event.preventDefault();
        if (!selectedProfile?.id || !selectedAccount?.id || !settings) {
            return;
        }

        const payload = normalizeMailboxSettings(settings);
        if (payload.forwardingEnabled && invalidRecipients(payload.forwardTo).length) {
            setError('转发邮箱格式不正确。');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const saved = await SaveAccountSettings({
                profileId: selectedProfile.id,
                accountId: selectedAccount.id,
                settings: {
                    ...payload,
                    forwardTo: payload.forwardingEnabled ? payload.forwardTo : ''
                }
            });
            setSettings(normalizeMailboxSettings(saved));
            await onReloadMailbox?.();
            onNotify?.('success', '邮箱设置已保存', selectedAccount.address);
        } catch (saveError) {
            const message = saveError.message || '请检查当前接入点权限。';
            setError(message);
            onNotify?.('error', '保存邮箱设置失败', message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="settings-panel">
            <SettingsPanelHeader
                action={<StatusBadge ok={Boolean(selectedAccount)} label={selectedAccount ? '当前邮箱' : '未选择'} />}
                body={selectedAccount ? selectedAccount.address : '进入接入点后选择邮箱账号，才能编辑转发、保留副本和签名。'}
                icon={Mail}
                kicker="邮箱账号"
                title="收发与显示设置"
            />

            {!selectedAccount ? (
                <p className="insight-empty">当前没有选中的邮箱账号。</p>
            ) : loading ? (
                <div className="settings-panel-loading">
                    <RefreshCw className="spin-inline" size={16} />
                    正在读取邮箱设置
                </div>
            ) : (
                <form className="settings-form" onSubmit={handleSave}>
                    {error ? <p className="settings-error">{error}</p> : null}
                    <div className="settings-form-grid">
                        <label className="checkbox-row">
                            <input
                                checked={settings?.enabled !== false}
                                type="checkbox"
                                onChange={(event) => updateField('enabled', event.target.checked)}
                            />
                            启用这个邮箱账号
                        </label>
                        <label className="checkbox-row">
                            <input
                                checked={Boolean(settings?.forwardingEnabled)}
                                type="checkbox"
                                onChange={(event) => updateField('forwardingEnabled', event.target.checked)}
                            />
                            启用转发
                        </label>
                        <label>
                            <span>转发到</span>
                            <input
                                disabled={!settings?.forwardingEnabled}
                                placeholder="name@example.com"
                                value={settings?.forwardTo || ''}
                                onChange={(event) => updateField('forwardTo', event.target.value)}
                            />
                        </label>
                        <label>
                            <span>保留策略</span>
                            <select
                                value={settings?.retention || 'forever'}
                                onChange={(event) => updateField('retention', event.target.value)}
                            >
                                <option value="forever">永久保留</option>
                                <option value="365d">保留 365 天</option>
                                <option value="90d">保留 90 天</option>
                                <option value="30d">保留 30 天</option>
                            </select>
                        </label>
                        <label>
                            <span>默认视图</span>
                            <select
                                value={settings?.defaultView || 'inbox'}
                                onChange={(event) => updateField('defaultView', event.target.value)}
                            >
                                <option value="inbox">收件箱</option>
                                <option value="starred">星标邮件</option>
                                <option value="sent">已发送</option>
                            </select>
                        </label>
                    </div>

                    <div className="settings-check-grid">
                        <label className="checkbox-row">
                            <input
                                checked={settings?.keepLocalCopy !== false}
                                type="checkbox"
                                onChange={(event) => updateField('keepLocalCopy', event.target.checked)}
                            />
                            转发后保留本地副本
                        </label>
                        <label className="checkbox-row">
                            <input
                                checked={settings?.saveAttachments !== false}
                                type="checkbox"
                                onChange={(event) => updateField('saveAttachments', event.target.checked)}
                            />
                            保存附件
                        </label>
                        <label className="checkbox-row">
                            <input
                                checked={settings?.showPreview !== false}
                                type="checkbox"
                                onChange={(event) => updateField('showPreview', event.target.checked)}
                            />
                            显示邮件预览
                        </label>
                    </div>

                    <label>
                        <span>签名</span>
                        <textarea
                            value={settings?.signature || ''}
                            onChange={(event) => updateField('signature', event.target.value)}
                        />
                    </label>

                    <div className="settings-mini-metrics">
                        <span>
                            <strong>{formatCount(settings?.rules?.length)}</strong>
                            <small>规则</small>
                        </span>
                        <span>
                            <strong>{formatCount(settings?.apiTokens?.length)}</strong>
                            <small>API Token</small>
                        </span>
                        <span>
                            <strong>{formatDateTime(settings?.lastActivity)}</strong>
                            <small>最后活动</small>
                        </span>
                    </div>

                    <footer>
                        <small>保存后会同步更新 Worker 里的账号状态。</small>
                        <button className="primary-action compact" type="submit" disabled={saving || !settings}>
                            <CircleCheck size={16} />
                            {saving ? '保存中' : '保存设置'}
                        </button>
                    </footer>
                </form>
            )}
        </section>
    );
}

