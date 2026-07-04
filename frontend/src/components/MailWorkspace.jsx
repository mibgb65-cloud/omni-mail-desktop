import {layoutLimits} from '../app/utils';
import {ResizeHandle} from './Common';
import {Composer} from './Composer';
import {EmailListPanel, ReaderToolbar} from './MailList';
import {ReadingView} from './ReadingView';

export function MailWorkspace({
    activeFolder,
    busy,
    composerOpen,
    composeForm,
    composeOptionsOpen,
    hasSavedDraft,
    listWidth,
    onArchiveMessage,
    onClearCurrentDraft,
    onCloseComposer,
    onCompose,
    onContextMenu,
    onDeleteMessage,
    onDownloadAttachment,
    onLoadMoreMessages,
    onPreviewAttachment,
    onReloadMailbox,
    onResizeKey,
    onResizePointerDown,
    onResetListWidth,
    onSelectMessage,
    onSendMessage,
    onSetComposeForm,
    onSetMessageStatus,
    onToggleComposeOptions,
    onOpenSettings,
    resizingPanel,
    searchInputRef,
    searchQuery,
    selectedAccount,
    selectedMessage,
    selectedProfile,
    setSearchQuery,
    visibleMessages,
    workspace
}) {
    return (
        <>
            <EmailListPanel
                activeFolder={activeFolder}
                busy={busy}
                messages={visibleMessages}
                onCompose={onCompose}
                onContextMenu={onContextMenu}
                onMessageSelect={onSelectMessage}
                onLoadMore={onLoadMoreMessages}
                onReload={onReloadMailbox}
                searchInputRef={searchInputRef}
                searchQuery={searchQuery}
                selectedMessageId={selectedMessage?.id || ''}
                selectedProfile={selectedProfile}
                setSearchQuery={setSearchQuery}
                workspace={workspace}
            />

            <ResizeHandle
                active={resizingPanel === 'list'}
                label="调整邮件列表宽度"
                max={layoutLimits.list.max}
                min={layoutLimits.list.min}
                onDoubleClick={onResetListWidth}
                onKeyDown={(event) => onResizeKey('list', event)}
                onPointerDown={(event) => onResizePointerDown('list', event)}
                value={listWidth}
            />

            <main id="reader" className={`reader-panel ${composerOpen ? 'composing' : ''}`}>
                {composerOpen ? (
                    <Composer
                        account={selectedAccount}
                        busy={busy}
                        form={composeForm}
                        hasSavedDraft={hasSavedDraft}
                        optionsOpen={composeOptionsOpen}
                        onChange={onSetComposeForm}
                        onClearDraft={onClearCurrentDraft}
                        onClose={onCloseComposer}
                        onSubmit={onSendMessage}
                        onToggleOptions={onToggleComposeOptions}
                    />
                ) : (
                    <>
                        <ReaderToolbar
                            busy={busy}
                            onArchive={() => onArchiveMessage(selectedMessage)}
                            onDelete={() => onDeleteMessage(selectedMessage)}
                            onOpenSettings={onOpenSettings}
                            onReload={onReloadMailbox}
                            onSetStatus={onSetMessageStatus}
                            selectedMessage={selectedMessage}
                            selectedProfile={selectedProfile}
                        />

                        <ReadingView
                            busy={busy}
                            message={selectedMessage}
                            onArchive={onArchiveMessage}
                            onDelete={onDeleteMessage}
                            onDownload={onDownloadAttachment}
                            onPreview={onPreviewAttachment}
                            onSetStatus={onSetMessageStatus}
                            selectedProfile={selectedProfile}
                        />
                    </>
                )}
            </main>
        </>
    );
}
