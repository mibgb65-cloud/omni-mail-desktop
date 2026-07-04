import {ArchiveMessage, CreateAccount, CreateDomain, DeleteAccount, DeleteMessage, DownloadAttachment, LoadMailbox, PreviewAttachment, SendMessage, SetMessageStatus, UnarchiveMessage, UpdateAccount} from '../../wailsjs/go/main/App';
import {emptyAccountForm, emptyComposeForm, emptyDomainForm, invalidRecipients, mailboxPageSize, normalizeDomainInput, splitRecipients, upsertProfile} from './utils';

export function createMailboxActions({selectedProfile, selectedProfileId, workspace, accountForm, domainForm, composeForm, composeDraftKey, mailboxRequestSeq, manualUnreadMessageRef, showToast, setBusy, setAccountForm, setDomainForm, setContentPage, setWorkspace, setProfiles, setComposeForm, setComposeOptionsOpen, setHasSavedDraft, setComposerOpen, setContextMenu}) {
    async function handleAccountSubmit(event) {
        event.preventDefault();
        if (!selectedProfile || !workspace?.selectedDomain) {
            return;
        }

        const localPart = accountForm.localPart.trim();
        if (!localPart) {
            showToast('error', '缺少邮箱名称', '请输入 @ 前面的邮箱前缀。');
            return;
        }
        if (localPart.includes('@')) {
            showToast('error', '邮箱名称不需要包含域名', `这里只填写 @${workspace.selectedDomain} 前面的部分。`);
            return;
        }

        setBusy('account');

        try {
            const account = await CreateAccount({
                profileId: selectedProfile.id,
                domain: workspace.selectedDomain,
                localPart,
                name: accountForm.name.trim()
            });
            setAccountForm(emptyAccountForm);
            setContentPage('mail');
            await loadMailbox({
                profileId: selectedProfile.id,
                domain: account.domain || workspace.selectedDomain,
                accountId: account.id
            });
            showToast('success', '邮箱账号已添加', account.address || `${localPart}@${workspace.selectedDomain}`);
        } catch (accountError) {
            showToast('error', '添加邮箱账号失败', accountError.message || '请检查邮箱名称和域名。');
        } finally {
            setBusy('');
        }
    }

    async function handleDomainSubmit(event) {
        event.preventDefault();
        if (!selectedProfile) {
            return;
        }

        const domain = normalizeDomainInput(domainForm.domain);
        if (!domain || !domain.includes('.') || domain.includes('@')) {
            showToast('error', '域名格式不正确', '请输入类似 mail.example.com 的域名。');
            return;
        }

        setBusy('domain');

        try {
            const result = await CreateDomain({
                profileId: selectedProfile.id,
                domain
            });
            const nextDomain = result.domain || domain;
            setDomainForm(emptyDomainForm);
            await loadMailbox({
                profileId: selectedProfile.id,
                domain: nextDomain,
                accountId: ''
            });
            setContentPage('domains');
            showToast('success', '域名已添加', nextDomain);
        } catch (domainError) {
            showToast('error', '添加域名失败', domainError.message || '请检查 Worker 域名配置。');
        } finally {
            setBusy('');
        }
    }

    async function handleUpdateAccount(account, patch) {
        if (!selectedProfile || !account?.id) {
            return null;
        }

        const nextName = typeof patch.name === 'string' ? patch.name.trim() : account.name || account.label || account.address;
        if (!nextName && typeof patch.enabled !== 'boolean') {
            showToast('error', '没有可保存的账号变更');
            return null;
        }

        setBusy('account-update');

        try {
            const updated = await UpdateAccount({
                profileId: selectedProfile.id,
                accountId: account.id,
                name: nextName,
                enabled: typeof patch.enabled === 'boolean' ? patch.enabled : undefined
            });
            await loadMailbox({
                profileId: selectedProfile.id,
                domain: workspace?.selectedDomain || updated.domain || account.domain,
                accountId: workspace?.selectedAccountId || account.id
            });
            showToast('success', '邮箱账号已更新', updated.address || account.address);
            return updated;
        } catch (updateError) {
            showToast('error', '更新邮箱账号失败', updateError.message || '请稍后重试。');
            return null;
        } finally {
            setBusy('');
        }
    }

    async function handleDeleteAccount(account) {
        if (!selectedProfile || !account?.id) {
            return;
        }

        if (!window.confirm(`删除邮箱账号「${account.address}」？`)) {
            return;
        }

        setBusy('account-delete');

        try {
            await DeleteAccount({
                profileId: selectedProfile.id,
                accountId: account.id
            });
            await loadMailbox({
                profileId: selectedProfile.id,
                domain: workspace?.selectedDomain || account.domain,
                accountId: workspace?.selectedAccountId === account.id ? '' : workspace?.selectedAccountId || ''
            });
            showToast('success', '邮箱账号已删除', account.address);
        } catch (deleteError) {
            showToast('error', '删除邮箱账号失败', deleteError.message || '请稍后重试。');
        } finally {
            setBusy('');
        }
    }

    async function handleCopyText(value, label = '内容') {
        if (!value) {
            return;
        }

        try {
            await navigator.clipboard.writeText(value);
            showToast('success', `${label}已复制`, value);
        } catch (copyError) {
            showToast('error', '复制失败', copyError.message || '当前系统不允许访问剪贴板。');
        }
    }

    async function loadMailbox(request, options = {}) {
        const profileId = request.profileId || selectedProfileId;
        if (!profileId) {
            return null;
        }

        const append = Boolean(options.append);
        const requestId = mailboxRequestSeq.current + 1;
        mailboxRequestSeq.current = requestId;
        setBusy(append ? 'mailbox-more' : 'mailbox');

        try {
            const data = await LoadMailbox({
                ...request,
                profileId,
                messageLimit: request.messageLimit || mailboxPageSize,
                messageOffset: request.messageOffset ?? (append ? (workspace?.messages || []).length : 0)
            });
            if (requestId !== mailboxRequestSeq.current) {
                return null;
            }

            if (append) {
                setWorkspace((current) => {
                    if (
                        !current
                        || current.selectedAccountId !== data.selectedAccountId
                        || current.selectedDomain !== data.selectedDomain
                    ) {
                        return data;
                    }

                    return {
                        ...data,
                        messages: [
                            ...(current.messages || []),
                            ...(data.messages || [])
                        ]
                    };
                });
            } else {
                setWorkspace(data);
            }
            setProfiles((current) => upsertProfile(current, data.profile));
            return data;
        } catch (mailError) {
            if (requestId !== mailboxRequestSeq.current) {
                return null;
            }

            if (!append) {
                setWorkspace(null);
            }
            showToast('error', '加载邮箱失败', mailError.message || '请检查接入点和 Token。');
            return null;
        } finally {
            if (requestId === mailboxRequestSeq.current) {
                setBusy('');
            }
        }
    }

    async function reloadCurrentMailbox() {
        if (!selectedProfile) {
            return;
        }

        await loadMailbox({
            profileId: selectedProfile.id,
            domain: workspace?.selectedDomain || '',
            accountId: workspace?.selectedAccountId || ''
        });
    }

    async function loadMoreMessages() {
        if (!selectedProfile || !workspace?.selectedAccountId || !workspace?.hasMoreMessages) {
            return;
        }

        await loadMailbox({
            profileId: selectedProfile.id,
            domain: workspace.selectedDomain || '',
            accountId: workspace.selectedAccountId,
            messageOffset: (workspace.messages || []).length
        }, {append: true});
    }

    async function handleSendMessage(event) {
        event.preventDefault();
        if (!selectedProfile || !workspace?.selectedAccountId) {
            return;
        }

        const to = splitRecipients(composeForm.to);
        const cc = splitRecipients(composeForm.cc);
        const bcc = splitRecipients(composeForm.bcc);
        const invalid = [
            ...invalidRecipients(composeForm.to),
            ...invalidRecipients(composeForm.cc),
            ...invalidRecipients(composeForm.bcc)
        ];

        if (!to.length) {
            showToast('error', '缺少收件人', '请至少填写一个收件人邮箱。');
            return;
        }

        if (invalid.length) {
            showToast('error', '邮箱格式不正确', invalid.slice(0, 3).join('，'));
            return;
        }

        if (!composeForm.subject.trim()) {
            showToast('error', '缺少主题', '请填写一个清晰的邮件主题。');
            return;
        }

        setBusy('send');

        try {
            const result = await SendMessage({
                profileId: selectedProfile.id,
                accountId: workspace.selectedAccountId,
                to: to.join(', '),
                cc: cc.join(', '),
                bcc: bcc.join(', '),
                subject: composeForm.subject.trim(),
                text: composeForm.text
            });
            if (composeDraftKey) {
                localStorage.removeItem(composeDraftKey);
            }
            setComposeForm(emptyComposeForm);
            setComposeOptionsOpen(false);
            setHasSavedDraft(false);
            setComposerOpen(false);
            showToast('success', '邮件已提交', result.provider ? `处理方式：${result.provider}` : '已提交到 OmniMail。');
            await reloadCurrentMailbox();
        } catch (sendError) {
            showToast('error', '发送失败', sendError.message || '请检查收件人与主题。');
        } finally {
            setBusy('');
        }
    }

    async function handleArchiveMessage(message, options = {}) {
        if (!selectedProfile || !message) {
            return;
        }

        setBusy('message-action');

        try {
            const payload = {profileId: selectedProfile.id, messageId: message.id};
            if (message.archivedAt) {
                await UnarchiveMessage(payload);
                if (!options.silent) {
                    showToast('success', '已移回收件箱');
                }
            } else {
                await ArchiveMessage(payload);
                if (!options.silent) {
                    showToast('success', '已归档');
                }
            }
            await reloadCurrentMailbox();
        } catch (actionError) {
            if (!options.silent) {
                showToast('error', '更新邮件失败', actionError.message || '请稍后重试。');
            }
            if (options.throwOnError) {
                throw actionError;
            }
        } finally {
            setBusy('');
        }
    }

    async function handleDeleteMessage(message) {
        if (!selectedProfile || !message || !window.confirm('删除这封邮件？')) {
            return;
        }

        setBusy('message-action');

        try {
            await DeleteMessage({profileId: selectedProfile.id, messageId: message.id});
            showToast('success', '邮件已删除');
            await reloadCurrentMailbox();
        } catch (deleteError) {
            showToast('error', '删除失败', deleteError.message || '请稍后重试。');
        } finally {
            setBusy('');
        }
    }

    async function handleSetMessageStatus(message, payload, options = {}) {
        if (!selectedProfile || !message) {
            return;
        }

        setBusy('message-action');

        try {
            const updated = await SetMessageStatus({
                profileId: selectedProfile.id,
                messageId: message.id,
                ...payload
            });
            const affectsUnread = typeof payload.read === 'boolean'
                && message.direction !== 'outbound'
                && !message.archivedAt
                && !message.deletedAt;
            const unreadDelta = affectsUnread
                ? payload.read
                    ? message.readAt ? 0 : -1
                    : message.readAt ? 1 : 0
                : 0;
            if (!options.silent && typeof payload.read === 'boolean') {
                manualUnreadMessageRef.current = payload.read ? '' : message.id;
            }

            setWorkspace((current) => {
                if (!current) {
                    return current;
                }

                const accountId = message.accountId || current.selectedAccountId;
                return {
                    ...current,
                    accounts: unreadDelta === 0
                        ? current.accounts
                        : (current.accounts || []).map((account) => (
                            account.id === accountId
                                ? {...account, unread: Math.max(0, Number(account.unread || 0) + unreadDelta)}
                                : account
                        )),
                    messages: (current.messages || []).map((item) => (
                        item.id === message.id ? {...item, ...updated} : item
                    ))
                };
            });

            if (!options.silent) {
                const title = typeof payload.starred === 'boolean'
                    ? payload.starred ? '已添加星标' : '已取消星标'
                    : payload.read ? '已标记为已读' : '已标记为未读';
                showToast('success', title);
            }
        } catch (statusError) {
            if (!options.silent) {
                showToast('error', '更新邮件状态失败', statusError.message || '请稍后重试。');
            }
            if (options.throwOnError) {
                throw statusError;
            }
        } finally {
            setBusy('');
        }
    }

    async function handleDownloadAttachment(attachment) {
        if (!selectedProfile || !attachment) {
            return;
        }

        setBusy('download');

        try {
            const result = await DownloadAttachment({
                profileId: selectedProfile.id,
                attachmentId: attachment.id,
                filename: attachment.filename
            });
            showToast('success', '附件已保存', result.path);
        } catch (downloadError) {
            if (downloadError.message !== 'download canceled') {
                showToast('error', '下载失败', downloadError.message || '附件无法下载。');
            }
        } finally {
            setBusy('');
        }
    }

    async function handlePreviewAttachment(attachment) {
        if (!selectedProfile || !attachment) {
            return null;
        }

        setBusy('preview');

        try {
            return await PreviewAttachment({
                profileId: selectedProfile.id,
                attachmentId: attachment.id,
                filename: attachment.filename
            });
        } finally {
            setBusy('');
        }
    }

    function openContextMenu(event, message) {
        event.preventDefault();
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            message
        });
    }

    return {handleAccountSubmit, handleDomainSubmit, handleUpdateAccount, handleDeleteAccount, handleCopyText, loadMailbox, reloadCurrentMailbox, loadMoreMessages, handleSendMessage, handleArchiveMessage, handleDeleteMessage, handleSetMessageStatus, handleDownloadAttachment, handlePreviewAttachment, openContextMenu};
}
