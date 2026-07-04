import {AuthorizeProfile, DeleteProfile, GetEndpointDiagnostics, GetInitialState, ListAuditLogs, SaveProfile, SaveProfileToken, SelectProfile, TestBaseURL} from '../../wailsjs/go/main/App';
import {emptyAccountForm, emptyAuthForm, emptyProfileForm, upsertProfile} from './utils';

export function createProfileActions({selectedProfile, selectedProfileId, profileForm, contentPage, profileReturnPage, authReturnPage, authForm, manualToken, workspace, loadMailbox, showToast, setBusy, setProfiles, setStoragePath, setSelectedProfileId, setSidebarPage, setContentPage, setWorkspace, setProfileForm, setStatus, setContextMenu, setAuthReturnPage, setProfileMenuOpen, setManualToken, setEndpointDiagnostics, setAuditLogs, setInsightsProfileId, setAccountForm, setAuthForm}) {
    async function loadInitialState() {
        setBusy('initial');

        try {
            const state = await GetInitialState();
            const nextProfiles = state.profiles || [];
            setProfiles(nextProfiles);
            setStoragePath(state.storagePath || '');
            setSelectedProfileId('');
            setSidebarPage('profiles');
            setContentPage('start');
            setWorkspace(null);
        } catch (loadError) {
            showToast('error', '加载本地配置失败', loadError.message || '请检查本地配置文件权限。');
        } finally {
            setBusy('');
        }
    }

    async function handleProfileSubmit(event) {
        event.preventDefault();
        setBusy('profile');

        try {
            const profile = await SaveProfile(profileForm);
            setProfiles((current) => upsertProfile(current, profile));
            setSelectedProfileId(profile.id);
            setSidebarPage('mailbox');
            setContentPage('mail');
            setProfileForm(emptyProfileForm);
            setWorkspace(null);
            await testConnection(profile.baseUrl, '');
            showToast('success', '接入点已保存', profile.baseUrl);
        } catch (saveError) {
            showToast('error', '保存接入点失败', saveError.message || 'Base URL 无效。');
        } finally {
            setBusy('');
        }
    }

    async function handleSelectProfile(profile) {
        setSelectedProfileId(profile.id);
        setSidebarPage('mailbox');
        setStatus(null);
        setWorkspace(null);
        setContextMenu(null);
        await SelectProfile(profile.id).catch(() => null);

        if (profile.hasToken) {
            setContentPage('mail');
            await loadMailbox({profileId: profile.id});
        } else {
            await testConnection(profile.baseUrl, '');
            setAuthReturnPage('start');
            setContentPage('auth');
        }
    }

    function handleAddProfile() {
        setProfileForm(emptyProfileForm);
        setProfileReturnPage(contentPage === 'profile' ? 'start' : contentPage);
        setProfileMenuOpen(false);
        setContentPage('profile');
    }

    function handleCloseProfileEditor() {
        setProfileForm(emptyProfileForm);
        setContentPage(profileReturnPage || (selectedProfile ? 'mail' : 'start'));
    }

    function handleBackToProfiles() {
        setSidebarPage('profiles');
        setContentPage('start');
        setProfileMenuOpen(false);
        setContextMenu(null);
    }

    function handleAddAccount() {
        if (!selectedProfile?.hasToken) {
            showToast('error', '接入点尚未授权', '请先保存当前接入点的 Device Token。');
            return;
        }

        if (!workspace?.selectedDomain) {
            showToast('error', '缺少域名', '请先选择或加载一个域名。');
            return;
        }

        setAccountForm(emptyAccountForm);
        setProfileMenuOpen(false);
        setContextMenu(null);
        setContentPage('account');
    }

    function handleCloseAccountEditor() {
        setAccountForm(emptyAccountForm);
        setContentPage('mail');
    }

    async function handleOpenAccountManager() {
        if (!selectedProfile?.hasToken) {
            showToast('error', '接入点尚未授权', '授权后才能管理邮箱账号。');
            return;
        }

        setProfileMenuOpen(false);
        setContextMenu(null);
        setContentPage('accounts');
        if (!workspace) {
            await loadMailbox({profileId: selectedProfile.id});
        }
    }

    async function handleOpenDomainManager() {
        if (!selectedProfile?.hasToken) {
            showToast('error', '接入点尚未授权', '授权后才能管理域名。');
            return;
        }

        setProfileMenuOpen(false);
        setContextMenu(null);
        setContentPage('domains');
        if (!workspace) {
            await loadMailbox({profileId: selectedProfile.id});
        }
    }

    function handleOpenProfileManager() {
        setProfileMenuOpen(false);
        setContentPage('endpoints');
    }

    async function handleOpenAuth(profile = selectedProfile) {
        if (!profile) {
            return;
        }

        if (selectedProfileId !== profile.id) {
            setWorkspace(null);
        }
        setSelectedProfileId(profile.id);
        setStatus(null);
        setContextMenu(null);
        setProfileMenuOpen(false);
        setAuthReturnPage(contentPage === 'auth' ? 'start' : contentPage);
        setContentPage('auth');
        await SelectProfile(profile.id).catch(() => null);
        await testConnection(profile.baseUrl, '').catch(() => null);
    }

    function handleCloseAuthPage() {
        setAuthForm(emptyAuthForm);
        setManualToken('');
        setContentPage(authReturnPage || (selectedProfile?.hasToken ? 'mail' : 'start'));
    }

    async function handleTestProfile(profile) {
        if (!profile) {
            return;
        }

        await testConnection(profile.baseUrl, '');
    }

    function handleEditProfile(profile) {
        setProfileForm({id: profile.id, name: profile.name, baseUrl: profile.baseUrl});
        setProfileReturnPage(contentPage === 'profile' ? 'endpoints' : contentPage);
        setProfileMenuOpen(false);
        setContentPage('profile');
    }

    async function handleDeleteProfile(profile) {
        if (!window.confirm(`删除接入点「${profile.name}」？`)) {
            return;
        }

        setBusy('delete');

        try {
            await DeleteProfile(profile.id);
            setProfiles((current) => current.filter((item) => item.id !== profile.id));
            if (selectedProfileId === profile.id) {
                setSelectedProfileId('');
                setWorkspace(null);
                setStatus(null);
                setSidebarPage('profiles');
                setContentPage('start');
            }
            showToast('success', '接入点已删除');
        } catch (deleteError) {
            showToast('error', '删除失败', deleteError.message || '请稍后重试。');
        } finally {
            setBusy('');
        }
    }

    async function testConnection(baseUrl = selectedProfile?.baseUrl, token = '') {
        if (!baseUrl) {
            return;
        }

        setBusy('test');

        try {
            const result = await TestBaseURL(baseUrl, token);
            setStatus(result);
            if (result?.authStatus?.requiresSetup) {
                setAuthForm((current) => ({...current, setup: true}));
            }
            showToast(result.ok ? 'success' : 'error', result.ok ? '连接成功' : '连接失败', result.message);
        } catch (testError) {
            showToast('error', '连接测试失败', testError.message || '无法访问该接入点。');
        } finally {
            setBusy('');
        }
    }

    async function loadEndpointInsights(profile = selectedProfile) {
        if (!profile) {
            return;
        }

        if (!profile.hasToken) {
            showToast('error', '接入点尚未授权', '保存 Device Token 后才能读取诊断和审计日志。');
            return;
        }

        setBusy('insights');

        try {
            const [diagnostics, logs] = await Promise.all([
                GetEndpointDiagnostics(profile.id),
                ListAuditLogs({profileId: profile.id, limit: 30})
            ]);
            setEndpointDiagnostics(diagnostics || null);
            setAuditLogs(logs || []);
            setInsightsProfileId(profile.id);
            showToast('success', '接入点诊断已更新', profile.baseUrl);
        } catch (insightError) {
            showToast('error', '加载接入点诊断失败', insightError.message || '请检查当前接入点 Token 权限。');
        } finally {
            setBusy('');
        }
    }

    async function handleAuthorize(event) {
        event.preventDefault();
        if (!selectedProfile) {
            return;
        }

        setBusy('auth');

        try {
            const profile = await AuthorizeProfile({...authForm, profileId: selectedProfile.id});
            setProfiles((current) => upsertProfile(current, profile));
            setAuthForm(emptyAuthForm);
            setSidebarPage('mailbox');
            setContentPage('mail');
            await loadMailbox({profileId: profile.id});
            showToast('success', '当前接入点已授权', '设备 Token 只保存到这个接入点，不影响其他接入点。');
        } catch (authError) {
            showToast('error', '授权失败', authError.message || '请检查管理员账号密码。');
        } finally {
            setBusy('');
        }
    }

    async function handleManualToken(event) {
        event.preventDefault();
        if (!selectedProfile) {
            return;
        }

        setBusy('token');

        try {
            const profile = await SaveProfileToken({
                profileId: selectedProfile.id,
                deviceToken: manualToken,
                deviceLabel: authForm.deviceLabel || 'Windows 桌面端'
            });
            setProfiles((current) => upsertProfile(current, profile));
            setManualToken('');
            setSidebarPage('mailbox');
            setContentPage('mail');
            await loadMailbox({profileId: profile.id});
            showToast('success', 'Token 已保存', '该 Token 仅用于当前接入点。');
        } catch (tokenError) {
            showToast('error', '保存 Token 失败', tokenError.message || 'Token 不能为空。');
        } finally {
            setBusy('');
        }
    }
    return {loadInitialState, handleProfileSubmit, handleSelectProfile, handleAddProfile, handleCloseProfileEditor, handleBackToProfiles, handleAddAccount, handleCloseAccountEditor, handleOpenAccountManager, handleOpenDomainManager, handleOpenProfileManager, handleOpenAuth, handleCloseAuthPage, handleTestProfile, handleEditProfile, handleDeleteProfile, testConnection, loadEndpointInsights, handleAuthorize, handleManualToken};
}
