import {useMemo, useState} from 'react';
import {ArrowLeft, CheckSquare, Inbox, ListChecks, Mail, Play, RefreshCw, Trash2} from 'lucide-react';
import {
    createQueueItems,
    filterQueueCandidates,
    operationQueueStats,
    queueActionLabel,
    queueActionOptions
} from '../app/operationQueue';
import {formatCount, formatMessageTime} from '../app/utils';
import {EmptyState, StatusBadge} from './Common';

const filterOptions = [
    {id: 'all', label: '全部'},
    {id: 'inbox', label: '收件箱'},
    {id: 'unread', label: '未读'},
    {id: 'starred', label: '星标'},
    {id: 'attachments', label: '含附件'},
    {id: 'archive', label: '归档'}
];

function statusLabel(status) {
    if (status === 'running') {
        return '执行中';
    }
    if (status === 'success') {
        return '完成';
    }
    if (status === 'error') {
        return '失败';
    }
    return '待执行';
}

export function OperationQueuePage({
    busy,
    onBack,
    onLoadMore,
    onOpenMessage,
    onRunMessageAction,
    selectedProfile,
    workspace
}) {
    const [filter, setFilter] = useState('all');
    const [selectedIds, setSelectedIds] = useState([]);
    const [queueAction, setQueueAction] = useState('read');
    const [queue, setQueue] = useState([]);
    const [running, setRunning] = useState(false);
    const messages = workspace?.messages || [];
    const candidates = useMemo(() => filterQueueCandidates(messages, filter), [filter, messages]);
    const stats = useMemo(() => operationQueueStats(queue), [queue]);
    const loadingMore = busy === 'mailbox-more';
    const allVisibleSelected = candidates.length > 0 && candidates.every((message) => selectedIds.includes(message.id));

    function toggleMessage(messageId) {
        setSelectedIds((current) => (
            current.includes(messageId)
                ? current.filter((id) => id !== messageId)
                : [...current, messageId]
        ));
    }

    function toggleVisible() {
        setSelectedIds((current) => {
            const visibleIds = candidates.map((message) => message.id);
            if (visibleIds.every((id) => current.includes(id))) {
                return current.filter((id) => !visibleIds.includes(id));
            }
            return Array.from(new Set([...current, ...visibleIds]));
        });
    }

    function enqueueSelected() {
        const items = createQueueItems(messages, selectedIds, queueAction, queue.length);
        if (!items.length) {
            return;
        }
        setQueue((current) => [...current, ...items]);
        setSelectedIds([]);
    }

    async function runQueue() {
        if (running || !queue.some((item) => item.status === 'pending' || item.status === 'error')) {
            return;
        }

        setRunning(true);

        for (const item of queue) {
            if (item.status !== 'pending' && item.status !== 'error') {
                continue;
            }

            setQueue((current) => current.map((entry) => (
                entry.id === item.id ? {...entry, status: 'running', error: ''} : entry
            )));

            try {
                await onRunMessageAction(item.message, item.action);
                setQueue((current) => current.map((entry) => (
                    entry.id === item.id ? {...entry, status: 'success', error: ''} : entry
                )));
            } catch (queueError) {
                setQueue((current) => current.map((entry) => (
                    entry.id === item.id
                        ? {...entry, status: 'error', error: queueError.message || '执行失败'}
                        : entry
                )));
            }
        }

        setRunning(false);
    }

    return (
        <main id="reader" className="workspace-page workspace-queue-page" aria-label="操作队列">
            <header className="workspace-page-header workspace-page-header-row">
                <button className="page-back-button" type="button" onClick={onBack}>
                    <ArrowLeft size={16} />
                    返回邮箱
                </button>
                <div>
                    <p>队列</p>
                    <h1>操作队列</h1>
                    <small>{selectedProfile?.baseUrl || '尚未选择接入点'}</small>
                </div>
                {workspace?.hasMoreMessages ? (
                    <button className="workspace-header-action" type="button" onClick={onLoadMore} disabled={loadingMore}>
                        <Inbox size={16} />
                        {loadingMore ? '加载中' : '加载更多'}
                    </button>
                ) : null}
            </header>

            {!selectedProfile?.hasToken ? (
                <EmptyState
                    icon={ListChecks}
                    title="接入点尚未授权"
                    body="授权后可为当前邮箱已加载邮件创建批量操作队列。"
                />
            ) : !workspace?.selectedAccountId ? (
                <EmptyState
                    icon={Mail}
                    title="先选择邮箱账号"
                    body="选择账号后可批量标记、星标和归档当前邮箱中的邮件。"
                />
            ) : (
                <div className="workspace-page-body queue-layout">
                    <section className="queue-metrics" aria-label="队列指标">
                        <Metric label="待执行" value={stats.pending} />
                        <Metric label="执行中" value={stats.running} />
                        <Metric label="完成" value={stats.success} />
                        <Metric label="失败" value={stats.error} />
                    </section>

                    <section className="queue-builder" aria-label="创建操作队列">
                        <div className="queue-control-row">
                            <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="候选邮件筛选">
                                {filterOptions.map((option) => (
                                    <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                            </select>
                            <select value={queueAction} onChange={(event) => setQueueAction(event.target.value)} aria-label="队列操作">
                                {queueActionOptions.map((option) => (
                                    <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                            </select>
                            <button type="button" onClick={toggleVisible} disabled={!candidates.length}>
                                <CheckSquare size={16} />
                                {allVisibleSelected ? '取消全选' : '选择可见'}
                            </button>
                            <button type="button" onClick={enqueueSelected} disabled={!selectedIds.length}>
                                <ListChecks size={16} />
                                加入队列
                            </button>
                        </div>

                        <div className="queue-candidate-list" aria-label="候选邮件">
                            {candidates.length ? (
                                candidates.map((message) => (
                                    <article key={message.id} className="queue-candidate-item">
                                        <input
                                            type="checkbox"
                                            aria-label={`选择 ${message.subject || '无主题'}`}
                                            checked={selectedIds.includes(message.id)}
                                            onChange={() => toggleMessage(message.id)}
                                        />
                                        <span>
                                            <strong>{message.subject || '无主题'}</strong>
                                            <small>{message.author || message.email || '未知联系人'} · {formatMessageTime(message.time)}</small>
                                        </span>
                                        <button type="button" onClick={() => onOpenMessage(message)}>
                                            打开
                                        </button>
                                    </article>
                                ))
                            ) : (
                                <p className="queue-empty">当前筛选下没有可加入队列的邮件。</p>
                            )}
                        </div>
                    </section>

                    <section className="queue-runner" aria-label="操作队列">
                        <header>
                            <div>
                                <p>当前队列</p>
                                <h3>{formatCount(queue.length)} 个任务</h3>
                            </div>
                            <div className="queue-runner-actions">
                                <button type="button" onClick={runQueue} disabled={running || !queue.length}>
                                    {running ? <RefreshCw className="spin-inline" size={16} /> : <Play size={16} />}
                                    {running ? '执行中' : '执行队列'}
                                </button>
                                <button type="button" onClick={() => setQueue([])} disabled={running || !queue.length}>
                                    <Trash2 size={16} />
                                    清空
                                </button>
                            </div>
                        </header>

                        <div className="queue-task-list">
                            {queue.length ? (
                                queue.map((item) => (
                                    <article key={item.id} className={`queue-task-item ${item.status}`}>
                                        <span>
                                            <strong>{queueActionLabel(item.action)}</strong>
                                            <small>{item.message.subject || '无主题'}</small>
                                        </span>
                                        <StatusBadge ok={item.status === 'success'} label={statusLabel(item.status)} />
                                        {item.error ? <em>{item.error}</em> : null}
                                    </article>
                                ))
                            ) : (
                                <p className="queue-empty">选择邮件并加入队列后，可按顺序执行批量操作。</p>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}

function Metric({label, value}) {
    return (
        <article>
            <strong>{formatCount(value)}</strong>
            <small>{label}</small>
        </article>
    );
}
