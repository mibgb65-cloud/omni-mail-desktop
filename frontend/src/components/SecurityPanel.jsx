import {useState} from 'react';
import {KeyRound, Plus, RefreshCw} from 'lucide-react';
import {AuthorizeAdminSession, ChangePassword, ClearAdminSession, CreateUser, ListUsers, RevokeSessions, UpdateUser, ValidateAdminSession} from '../../wailsjs/go/main/App';
import {emptyAdminSessionForm, emptyPasswordForm, emptyUserForm, formatDateTime} from '../app/utils';
import {StatusBadge} from './Common';
import {SettingsPanelHeader} from './SettingsCommon';

export function SecurityPanel({onNotify, onProfileUpdate, selectedProfile}) {
    const [adminForm, setAdminForm] = useState(emptyAdminSessionForm);
    const [users, setUsers] = useState([]);
    const [userForm, setUserForm] = useState(emptyUserForm);
    const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
    const [loading, setLoading] = useState('');
    const [error, setError] = useState('');
    const hasAdminSession = Boolean(selectedProfile?.hasAdminSession);

    async function handleAdminLogin(event) {
        event.preventDefault();
        if (!selectedProfile?.id) {
            return;
        }

        if (!adminForm.email.includes('@') || !adminForm.password) {
            setError('请输入当前接入点的管理员邮箱和密码。');
            return;
        }

        setLoading('admin-login');
        setError('');

        try {
            const profile = await AuthorizeAdminSession({
                profileId: selectedProfile.id,
                email: adminForm.email,
                password: adminForm.password,
                setup: adminForm.setup
            });
            onProfileUpdate?.(profile);
            setAdminForm(emptyAdminSessionForm);
            onNotify?.('success', '当前接入点管理员已授权', profile.adminEmail || profile.baseUrl);
        } catch (loginError) {
            const message = loginError.message || '请检查当前接入点管理员账号密码。';
            setError(message);
            onNotify?.('error', '管理员授权失败', message);
        } finally {
            setLoading('');
        }
    }

    async function handleClearAdmin() {
        if (!selectedProfile?.id || !window.confirm('退出当前接入点的管理员会话？')) {
            return;
        }

        setLoading('admin-clear');
        setError('');

        try {
            const profile = await ClearAdminSession({profileId: selectedProfile.id});
            onProfileUpdate?.(profile);
            setUsers([]);
            onNotify?.('success', '管理员会话已退出', profile.baseUrl);
        } catch (clearError) {
            const message = clearError.message || '无法清除当前接入点管理员会话。';
            setError(message);
            onNotify?.('error', '退出管理员会话失败', message);
        } finally {
            setLoading('');
        }
    }

    async function handleValidateAdmin() {
        if (!selectedProfile?.id) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先授权当前接入点管理员会话。');
            return;
        }

        setLoading('admin-validate');
        setError('');

        try {
            const status = await ValidateAdminSession({profileId: selectedProfile.id});
            if (!status?.authenticated) {
                throw new Error('管理员会话未通过服务端验证。');
            }
            const userLabel = status.user?.email || selectedProfile.adminEmail || selectedProfile.baseUrl;
            onNotify?.('success', '管理员会话有效', userLabel);
        } catch (validateError) {
            const message = validateError.message || '管理员会话可能已过期，请重新授权。';
            setError(message);
            onNotify?.('error', '管理员会话无效', message);
            try {
                const profile = await ClearAdminSession({profileId: selectedProfile.id});
                onProfileUpdate?.(profile);
                setUsers([]);
            } catch {
                // Keep the visible validation error; a failed local cleanup should not hide it.
            }
        } finally {
            setLoading('');
        }
    }

    async function loadUsers() {
        if (!selectedProfile?.id) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先授权当前接入点管理员会话。');
            return;
        }

        setLoading('users');
        setError('');

        try {
            const result = await ListUsers({profileId: selectedProfile.id});
            setUsers(result || []);
            onNotify?.('success', '管理员用户已刷新', `${(result || []).length} 个用户`);
        } catch (usersError) {
            const message = usersError.message || '当前接入点管理员会话无法读取用户。';
            setError(message);
            onNotify?.('error', '读取管理员用户失败', message);
        } finally {
            setLoading('');
        }
    }

    async function handleCreateUser(event) {
        event.preventDefault();
        if (!selectedProfile?.id) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先授权当前接入点管理员会话。');
            return;
        }

        if (!userForm.email.includes('@') || userForm.password.length < 8) {
            setError('请输入有效邮箱，密码至少 8 位。');
            return;
        }

        setLoading('create-user');
        setError('');

        try {
            const created = await CreateUser({
                profileId: selectedProfile.id,
                email: userForm.email,
                password: userForm.password,
                displayName: userForm.displayName,
                avatarColor: userForm.avatarColor
            });
            setUsers((current) => [...current, created]);
            setUserForm(emptyUserForm);
            onNotify?.('success', '管理员用户已创建', created.email);
        } catch (createError) {
            const message = createError.message || '当前接入点管理员会话没有创建用户权限。';
            setError(message);
            onNotify?.('error', '创建用户失败', message);
        } finally {
            setLoading('');
        }
    }

    async function handleToggleUser(user) {
        if (!selectedProfile?.id || !user?.id) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先授权当前接入点管理员会话。');
            return;
        }

        setLoading(`user-${user.id}`);
        setError('');

        try {
            const updated = await UpdateUser({
                profileId: selectedProfile.id,
                userId: user.id,
                displayName: user.displayName || '',
                avatarColor: user.avatarColor || '#dbe7ff',
                enabled: !user.enabled
            });
            setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
            onNotify?.('success', updated.enabled ? '用户已启用' : '用户已停用', updated.email);
        } catch (updateError) {
            const message = updateError.message || '无法更新用户。';
            setError(message);
            onNotify?.('error', '更新用户失败', message);
        } finally {
            setLoading('');
        }
    }

    async function handleChangePassword(event) {
        event.preventDefault();
        if (!selectedProfile?.id) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先授权当前接入点管理员会话。');
            return;
        }

        setLoading('password');
        setError('');

        try {
            await ChangePassword({
                profileId: selectedProfile.id,
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            setPasswordForm(emptyPasswordForm);
            onNotify?.('success', '密码已修改');
        } catch (passwordError) {
            const message = passwordError.message || '当前接入点管理员会话无法修改密码。';
            setError(message);
            onNotify?.('error', '修改密码失败', message);
        } finally {
            setLoading('');
        }
    }

    async function handleRevokeSessions() {
        if (!selectedProfile?.id || !window.confirm('撤销当前管理员用户的其他会话？')) {
            return;
        }
        if (!hasAdminSession) {
            setError('请先授权当前接入点管理员会话。');
            return;
        }

        setLoading('sessions');
        setError('');

        try {
            await RevokeSessions({profileId: selectedProfile.id});
            onNotify?.('success', '其他会话已撤销');
        } catch (sessionsError) {
            const message = sessionsError.message || '当前接入点管理员会话无法撤销会话。';
            setError(message);
            onNotify?.('error', '撤销会话失败', message);
        } finally {
            setLoading('');
        }
    }

    return (
        <section className="settings-panel settings-panel-wide">
            <SettingsPanelHeader
                action={(
                    <button type="button" onClick={loadUsers} disabled={!hasAdminSession || loading === 'users'}>
                        <RefreshCw className={loading === 'users' ? 'spin-inline' : ''} size={16} />
                        读取用户
                    </button>
                )}
                body="管理员会话只保存到当前接入点，不作为桌面端全局登录，也不会共享到其他 Base URL。"
                icon={KeyRound}
                kicker="安全"
                title="管理员用户与会话"
            />
            {error ? <p className="settings-error">{error}</p> : null}
            <form className="admin-session-card" onSubmit={handleAdminLogin}>
                <div>
                    <strong>当前接入点管理员会话</strong>
                    <small>
                        {hasAdminSession
                            ? `${selectedProfile.adminEmail || selectedProfile.adminTokenPreview || '已授权'} · 仅用于 ${selectedProfile.baseUrl}`
                            : '授权后可执行系统清理、用户管理、改密和撤销会话。'}
                    </small>
                </div>
                <StatusBadge ok={hasAdminSession} label={hasAdminSession ? '已授权' : '未授权'} />
                <label>
                    <span>管理员邮箱</span>
                    <input
                        disabled={loading === 'admin-login'}
                        placeholder="admin@example.com"
                        value={adminForm.email}
                        onChange={(event) => setAdminForm((current) => ({...current, email: event.target.value}))}
                    />
                </label>
                <label>
                    <span>管理员密码</span>
                    <input
                        disabled={loading === 'admin-login'}
                        type="password"
                        value={adminForm.password}
                        onChange={(event) => setAdminForm((current) => ({...current, password: event.target.value}))}
                    />
                </label>
                <label className="checkbox-row">
                    <input
                        checked={adminForm.setup}
                        type="checkbox"
                        onChange={(event) => setAdminForm((current) => ({...current, setup: event.target.checked}))}
                    />
                    初始化管理员
                </label>
                <div className="settings-inline-actions">
                    <button className="primary-action compact" type="submit" disabled={loading === 'admin-login'}>
                        <KeyRound size={16} />
                        {loading === 'admin-login' ? '授权中' : hasAdminSession ? '重新授权' : '授权当前接入点'}
                    </button>
                    <button type="button" onClick={handleValidateAdmin} disabled={!hasAdminSession || loading === 'admin-validate'}>
                        <CircleCheck size={16} />
                        {loading === 'admin-validate' ? '验证中' : '验证会话'}
                    </button>
                    <button type="button" onClick={handleClearAdmin} disabled={!hasAdminSession || loading === 'admin-clear'}>
                        <Power size={16} />
                        退出会话
                    </button>
                </div>
            </form>
            <div className="security-grid">
                <form className="settings-form" onSubmit={handleCreateUser}>
                    <h4>创建管理员</h4>
                    <label>
                        <span>邮箱</span>
                        <input
                            placeholder="admin@example.com"
                            disabled={!hasAdminSession}
                            value={userForm.email}
                            onChange={(event) => setUserForm((current) => ({...current, email: event.target.value}))}
                        />
                    </label>
                    <label>
                        <span>密码</span>
                        <input
                            disabled={!hasAdminSession}
                            minLength={8}
                            type="password"
                            value={userForm.password}
                            onChange={(event) => setUserForm((current) => ({...current, password: event.target.value}))}
                        />
                    </label>
                    <label>
                        <span>显示名称</span>
                        <input
                            disabled={!hasAdminSession}
                            value={userForm.displayName}
                            onChange={(event) => setUserForm((current) => ({...current, displayName: event.target.value}))}
                        />
                    </label>
                    <button type="submit" disabled={!hasAdminSession || loading === 'create-user'}>
                        <Plus size={16} />
                        {loading === 'create-user' ? '创建中' : '创建用户'}
                    </button>
                </form>

                <form className="settings-form" onSubmit={handleChangePassword}>
                    <h4>密码与会话</h4>
                    <label>
                        <span>当前密码</span>
                        <input
                            disabled={!hasAdminSession}
                            type="password"
                            value={passwordForm.currentPassword}
                            onChange={(event) => setPasswordForm((current) => ({...current, currentPassword: event.target.value}))}
                        />
                    </label>
                    <label>
                        <span>新密码</span>
                        <input
                            disabled={!hasAdminSession}
                            minLength={8}
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(event) => setPasswordForm((current) => ({...current, newPassword: event.target.value}))}
                        />
                    </label>
                    <div className="settings-inline-actions">
                        <button type="submit" disabled={!hasAdminSession || loading === 'password'}>
                            <KeyRound size={16} />
                            修改密码
                        </button>
                        <button type="button" onClick={handleRevokeSessions} disabled={!hasAdminSession || loading === 'sessions'}>
                            <Power size={16} />
                            撤销会话
                        </button>
                    </div>
                </form>
            </div>

            {users.length ? (
                <div className="settings-card-list">
                    {users.map((user) => (
                        <article className="settings-item-card" key={user.id}>
                            <div>
                                <strong>{user.displayName || user.email}</strong>
                                <small>{user.email} · {user.role || 'admin'} · 登录：{formatDateTime(user.lastLoginAt)}</small>
                            </div>
                            <div className="settings-item-actions">
                                <StatusBadge ok={user.enabled !== false} label={user.enabled !== false ? '启用' : '停用'} />
                                <button type="button" onClick={() => handleToggleUser(user)} disabled={!hasAdminSession || loading === `user-${user.id}`}>
                                    {user.enabled !== false ? '停用' : '启用'}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <p className="insight-empty">{hasAdminSession ? '点击“读取用户”后显示当前接入点的管理员用户。' : '先授权当前接入点管理员会话，再管理用户、密码和会话。'}</p>
            )}
        </section>
    );
}

