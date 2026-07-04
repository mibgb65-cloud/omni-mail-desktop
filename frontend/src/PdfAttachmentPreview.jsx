import {useEffect, useRef, useState} from 'react';
import {
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    FileText,
    LockKeyhole,
    RefreshCw,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const minZoom = 0.75;
const maxZoom = 2;
const zoomStep = 0.25;

function clampZoom(value) {
    return Math.min(maxZoom, Math.max(minZoom, value));
}

function passwordMessage(reason) {
    if (reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD) {
        return '密码不正确，请重试。';
    }

    return '这个 PDF 已加密，请输入密码后预览。';
}

function renderErrorMessage(error) {
    if (error?.name === 'PasswordException') {
        return passwordMessage(error.code);
    }

    return error?.message || 'PDF 预览失败';
}

export default function PdfAttachmentPreview({fileUrl, filename = 'PDF preview'}) {
    const [status, setStatus] = useState('loading');
    const [pageCount, setPageCount] = useState(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [error, setError] = useState('');
    const [renderError, setRenderError] = useState('');
    const [zoom, setZoom] = useState(1);
    const [reloadKey, setReloadKey] = useState(0);
    const canvasRef = useRef(null);
    const pdfRef = useRef(null);
    const loadingTaskRef = useRef(null);
    const passwordCallbackRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        async function loadDocument() {
            setStatus('loading');
            setPageCount(0);
            setPageNumber(1);
            setError('');
            setRenderError('');
            setPasswordError('');
            passwordCallbackRef.current = null;

            if (pdfRef.current) {
                await pdfRef.current.destroy().catch(() => null);
                pdfRef.current = null;
            }

            if (!fileUrl) {
                setStatus('error');
                setError('PDF 预览文件无法读取');
                return;
            }

            try {
                const response = await fetch(fileUrl);
                if (!response.ok) {
                    throw new Error(`PDF 读取失败：${response.status}`);
                }

                const buffer = await response.arrayBuffer();
                if (cancelled) {
                    return;
                }

                const loadingTask = pdfjsLib.getDocument({
                    data: new Uint8Array(buffer)
                });

                loadingTaskRef.current = loadingTask;
                loadingTask.onPassword = (updatePassword, reason) => {
                    if (cancelled) {
                        return;
                    }

                    passwordCallbackRef.current = updatePassword;
                    setStatus('password');
                    setPassword('');
                    setPasswordError(passwordMessage(reason));
                };

                const pdf = await loadingTask.promise;
                if (cancelled) {
                    await pdf.destroy().catch(() => null);
                    return;
                }

                pdfRef.current = pdf;
                passwordCallbackRef.current = null;
                setPassword('');
                setPasswordError('');
                setPageCount(pdf.numPages);
                setPageNumber(1);
                setStatus('ready');
            } catch (loadError) {
                if (cancelled) {
                    return;
                }

                if (loadError?.name === 'PasswordException') {
                    setStatus('password');
                    setPasswordError(passwordMessage(loadError.code));
                    return;
                }

                setStatus('error');
                setError(renderErrorMessage(loadError));
            }
        }

        loadDocument();

        return () => {
            cancelled = true;
            passwordCallbackRef.current = null;

            if (loadingTaskRef.current) {
                loadingTaskRef.current.destroy().catch(() => null);
                loadingTaskRef.current = null;
            }

            if (pdfRef.current) {
                pdfRef.current.destroy().catch(() => null);
                pdfRef.current = null;
            }
        };
    }, [fileUrl, reloadKey]);

    useEffect(() => {
        if (status !== 'ready' || !pdfRef.current || !canvasRef.current) {
            return undefined;
        }

        let cancelled = false;
        let renderTask = null;

        async function renderPage() {
            setRenderError('');

            try {
                const page = await pdfRef.current.getPage(pageNumber);
                if (cancelled) {
                    return;
                }

                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                const viewport = page.getViewport({scale: zoom});
                const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

                canvas.width = Math.floor(viewport.width * pixelRatio);
                canvas.height = Math.floor(viewport.height * pixelRatio);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;
                context.clearRect(0, 0, canvas.width, canvas.height);

                renderTask = page.render({
                    canvasContext: context,
                    viewport,
                    transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0]
                });

                await renderTask.promise;
                page.cleanup();
            } catch (pageError) {
                if (!cancelled && pageError?.name !== 'RenderingCancelledException') {
                    setRenderError(pageError?.message || 'PDF 页面渲染失败');
                }
            }
        }

        renderPage();

        return () => {
            cancelled = true;
            if (renderTask) {
                renderTask.cancel();
            }
        };
    }, [pageNumber, pageCount, status, zoom]);

    function submitPassword(event) {
        event.preventDefault();

        const nextPassword = password;
        if (!nextPassword) {
            setPasswordError('请输入 PDF 密码。');
            return;
        }

        const updatePassword = passwordCallbackRef.current;
        if (!updatePassword) {
            setStatus('error');
            setError('PDF 密码输入已失效，请重新打开预览。');
            return;
        }

        setStatus('loading');
        setPassword('');
        setPasswordError('');
        passwordCallbackRef.current = null;
        updatePassword(nextPassword);
    }

    function retry() {
        setStatus('loading');
        setError('');
        setRenderError('');
        setReloadKey((value) => value + 1);
    }

    if (status === 'loading') {
        return (
            <div className="attachment-preview-state">
                <RefreshCw className="spin-inline" size={20} />
                <span>正在打开 PDF</span>
            </div>
        );
    }

    if (status === 'password') {
        return (
            <form className="pdf-password-form" onSubmit={submitPassword}>
                <div className="pdf-password-icon">
                    <LockKeyhole size={22} />
                </div>
                <strong>{filename}</strong>
                <span>{passwordError || '这个 PDF 已加密，请输入密码后预览。'}</span>
                <label htmlFor="pdf-password">PDF 密码</label>
                <input
                    id="pdf-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="off"
                    autoFocus
                    placeholder="PDF 密码"
                />
                <button type="submit">打开 PDF</button>
            </form>
        );
    }

    if (status === 'error') {
        return (
            <div className="attachment-preview-state error">
                <CircleAlert size={22} />
                <span>{error || 'PDF 预览失败'}</span>
                <button type="button" className="pdf-preview-secondary" onClick={retry}>
                    重试
                </button>
            </div>
        );
    }

    return (
        <div className="pdf-preview">
            <div className="pdf-preview-toolbar">
                <div className="pdf-preview-page-controls">
                    <button
                        type="button"
                        onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
                        disabled={pageNumber <= 1}
                        aria-label="上一页"
                        title="上一页"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span>{pageNumber} / {pageCount || 1}</span>
                    <button
                        type="button"
                        onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))}
                        disabled={pageNumber >= pageCount}
                        aria-label="下一页"
                        title="下一页"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>

                <div className="pdf-preview-page-controls">
                    <button
                        type="button"
                        onClick={() => setZoom((value) => clampZoom(value - zoomStep))}
                        disabled={zoom <= minZoom}
                        aria-label="缩小 PDF"
                        title="缩小 PDF"
                    >
                        <ZoomOut size={16} />
                    </button>
                    <span>{Math.round(zoom * 100)}%</span>
                    <button
                        type="button"
                        onClick={() => setZoom((value) => clampZoom(value + zoomStep))}
                        disabled={zoom >= maxZoom}
                        aria-label="放大 PDF"
                        title="放大 PDF"
                    >
                        <ZoomIn size={16} />
                    </button>
                </div>
            </div>

            {renderError ? (
                <div className="pdf-preview-render-error">
                    <FileText size={16} />
                    <span>{renderError}</span>
                </div>
            ) : null}

            <div className="pdf-preview-canvas-region">
                <div className="pdf-preview-canvas-frame">
                    <canvas ref={canvasRef} aria-label={`PDF 第 ${pageNumber} 页`} />
                </div>
            </div>
        </div>
    );
}
