import {clamp, emptyComposeForm, layoutDefaults, layoutLimits} from './utils';

export function createLayoutActions({visibleMessages, selectedMessageId, setSelectedMessageId, sidebarCollapsed, sidebarWidth, listWidth, setSidebarWidth, setListWidth, setResizingPanel, setSidebarCollapsed, composeDraftKey, setComposeForm, setComposeOptionsOpen, setHasSavedDraft, showToast}) {
    function selectRelativeMessage(delta) {
        if (visibleMessages.length === 0) {
            return;
        }

        const currentIndex = Math.max(0, visibleMessages.findIndex((message) => message.id === selectedMessageId));
        const nextIndex = Math.min(Math.max(currentIndex + delta, 0), visibleMessages.length - 1);
        setSelectedMessageId(visibleMessages[nextIndex].id);
    }

    function setLayoutWidth(panel, value) {
        if (panel === 'sidebar') {
            setSidebarWidth(clamp(value, layoutLimits.sidebar.min, layoutLimits.sidebar.max));
            return;
        }

        setListWidth(clamp(value, layoutLimits.list.min, layoutLimits.list.max));
    }

    function adjustLayoutWidth(panel, delta) {
        if (panel === 'sidebar') {
            setSidebarWidth((value) => clamp(value + delta, layoutLimits.sidebar.min, layoutLimits.sidebar.max));
            return;
        }

        setListWidth((value) => clamp(value + delta, layoutLimits.list.min, layoutLimits.list.max));
    }

    function resetLayoutWidth(panel) {
        setLayoutWidth(panel, layoutDefaults[panel]);
    }

    function resetLayoutPreferences() {
        localStorage.removeItem('omnimail_sidebar_width');
        localStorage.removeItem('omnimail_list_width');
        localStorage.removeItem('omnimail_sidebar_collapsed');
        setSidebarCollapsed(false);
        setSidebarWidth(layoutDefaults.sidebar);
        setListWidth(layoutDefaults.list);
        showToast('success', '布局已恢复默认');
    }

    function clearCurrentDraft() {
        if (composeDraftKey) {
            localStorage.removeItem(composeDraftKey);
        }
        setComposeForm(emptyComposeForm);
        setComposeOptionsOpen(false);
        setHasSavedDraft(false);
        showToast('success', '当前草稿已清空');
    }

    function startPanelResize(panel, event) {
        if (panel === 'sidebar' && sidebarCollapsed) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = panel === 'sidebar' ? sidebarWidth : listWidth;
        setResizingPanel(panel);
        document.body.classList.add('is-resizing-panels');

        function handlePointerMove(moveEvent) {
            setLayoutWidth(panel, startWidth + moveEvent.clientX - startX);
        }

        function handlePointerUp() {
            setResizingPanel('');
            document.body.classList.remove('is-resizing-panels');
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        }

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);
    }

    function handleResizeKey(panel, event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home') {
            return;
        }

        event.preventDefault();

        if (event.key === 'Home') {
            resetLayoutWidth(panel);
            return;
        }

        const direction = event.key === 'ArrowRight' ? 1 : -1;
        adjustLayoutWidth(panel, direction * (event.shiftKey ? 32 : 12));
    }

    return {selectRelativeMessage, resetLayoutPreferences, clearCurrentDraft, startPanelResize, handleResizeKey, resetLayoutWidth};
}
