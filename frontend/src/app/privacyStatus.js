export function buildPrivacyStatus({appInfo = null, cacheInfo = null, logs = []} = {}) {
    const cacheSize = Number(cacheInfo?.size || appInfo?.updateCacheSize || 0);
    const activePreviews = Number(appInfo?.activeAttachmentPreviews || 0);
    const logCount = Array.isArray(logs) ? logs.length : 0;

    return [
        {
            id: 'token-storage',
            ok: true,
            title: 'Token 隔离',
            detail: 'Device Token 和管理员会话按接入点保存，本机不会跨 Base URL 共享。'
        },
        {
            id: 'preview-cache',
            ok: activePreviews === 0,
            title: '附件预览',
            detail: activePreviews
                ? `${activePreviews} 个附件预览仍处于活动状态，关闭预览或清理缓存后会释放。`
                : '当前没有活动附件预览。'
        },
        {
            id: 'update-cache',
            ok: cacheSize === 0,
            title: '更新缓存',
            detail: cacheSize
                ? '本机保留了已下载的更新安装包，可在这里清理。'
                : '当前没有更新安装包缓存。'
        },
        {
            id: 'local-logs',
            ok: logCount <= 120,
            title: '本机日志',
            detail: logCount
                ? `最近读取 ${logCount} 条本机应用日志，诊断导出会包含这些日志。`
                : '当前没有可展示的本机应用日志。'
        }
    ];
}
