import {Send, X} from 'lucide-react';
import {composeHasContent, invalidRecipients, splitRecipients} from '../app/utils';
import {IconButton} from './Common';

export function Composer({
    account,
    busy,
    form,
    hasSavedDraft,
    onChange,
    onClearDraft,
    onClose,
    onSubmit,
    onToggleOptions,
    optionsOpen
}) {
    const sending = busy === 'send';
    const disabled = !account || sending;
    const recipients = splitRecipients(form.to);
    const ccRecipients = splitRecipients(form.cc);
    const bccRecipients = splitRecipients(form.bcc);
    const invalid = [
        ...invalidRecipients(form.to),
        ...invalidRecipients(form.cc),
        ...invalidRecipients(form.bcc)
    ];
    const recipientCount = recipients.length + ccRecipients.length + bccRecipients.length;
    const hasDraft = hasSavedDraft || composeHasContent(form);
    const canSend = Boolean(account && recipients.length && form.subject.trim() && !invalid.length && !sending);

    return (
        <section className="composer-card" aria-label="写邮件">
            <form onSubmit={onSubmit}>
                <header>
                    <div>
                        <p>新邮件</p>
                        <h3>{account?.address || '未选择发件身份'}</h3>
                    </div>
                    <div className="composer-header-actions">
                        <button className="composer-secondary-action" type="button" onClick={onToggleOptions} disabled={disabled}>
                            {optionsOpen ? '隐藏抄送/密送' : '抄送/密送'}
                        </button>
                        <IconButton icon={X} label="关闭写信窗口" onClick={onClose} />
                    </div>
                </header>

                <label>
                    <span>收件人</span>
                    <input
                        value={form.to}
                        onChange={(event) => onChange({...form, to: event.target.value})}
                        placeholder="name@example.com，多个收件人用逗号分隔"
                        type="text"
                        disabled={disabled}
                        autoFocus
                    />
                </label>
                {optionsOpen ? (
                    <div className="composer-field-grid">
                        <label>
                            <span>抄送</span>
                            <input
                                value={form.cc}
                                onChange={(event) => onChange({...form, cc: event.target.value})}
                                placeholder="cc@example.com"
                                type="text"
                                disabled={disabled}
                            />
                        </label>
                        <label>
                            <span>密送</span>
                            <input
                                value={form.bcc}
                                onChange={(event) => onChange({...form, bcc: event.target.value})}
                                placeholder="bcc@example.com"
                                type="text"
                                disabled={disabled}
                            />
                        </label>
                    </div>
                ) : null}
                <label>
                    <span>主题</span>
                    <input
                        value={form.subject}
                        onChange={(event) => onChange({...form, subject: event.target.value})}
                        placeholder="写一个清晰的主题"
                        disabled={disabled}
                    />
                </label>
                <label>
                    <span>正文</span>
                    <textarea
                        value={form.text}
                        onChange={(event) => onChange({...form, text: event.target.value})}
                        rows={5}
                        placeholder="输入邮件正文"
                        disabled={disabled}
                    />
                </label>
                <footer>
                    <span className={invalid.length ? 'composer-meta-line error' : 'composer-meta-line'} aria-live="polite">
                        {invalid.length
                            ? `${invalid.length} 个邮箱格式需要检查`
                            : hasDraft
                                ? `本机草稿已按当前接入点保存${recipientCount ? ` · ${recipientCount} 位收件人` : ''}`
                                : '草稿会自动保存在本机当前接入点下'}
                    </span>
                    <div className="composer-footer-actions">
                        <button type="button" onClick={onClearDraft} disabled={disabled || !hasDraft}>
                            清空草稿
                        </button>
                        <button className="primary-action" type="submit" disabled={!canSend}>
                            {sending ? <RefreshCw className="spin-inline" size={16} /> : <Send size={16} />}
                            {sending ? '发送中' : '发送'}
                        </button>
                    </div>
                </footer>
            </form>
        </section>
    );
}

