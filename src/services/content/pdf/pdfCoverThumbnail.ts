/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025-2026 Johan Sanneblad
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { App, loadPdfJs, Platform, TFile } from 'obsidian';
import { LIMITS } from '../../../constants/limits';
import { isPromiseLike } from '../../../utils/async';
import { isRecord } from '../../../utils/typeGuards';
import { createOnceLogger, createRenderLimiter } from '../thumbnail/thumbnailRuntimeUtils';
import { clearPdfProcessingInProgress, markPdfProcessingInProgress } from './pdfCrashDiagnostics';
import { preflightPdfCoverThumbnailStageA, preflightPdfCoverThumbnailStageB, type PdfByteScanMetrics } from './pdfPreflight';

// Options for rendering a PDF cover page thumbnail
export interface PdfCoverThumbnailOptions {
    maxWidth: number;
    maxHeight: number;
    mimeType: string;
    quality?: number;
}

// Minimal type for pdf.js worker instance
type PdfWorker = Record<string, unknown>;

// Viewport dimensions returned by pdf.js
type PdfViewport = { width: number; height: number };

// Document loading task returned by pdf.js `getDocument()`
type PdfDocumentLoadingTask = { promise: Promise<unknown> };

// Minimal interface for a pdf.js library object
type PdfJsLibrary = {
    getDocument: (params: Record<string, unknown>) => PdfDocumentLoadingTask;
};

// Minimal interface for a pdf.js document object
type PdfDocument = {
    getPage: (pageNumber: number) => Promise<unknown>;
    destroy?: () => void | Promise<void>;
};

// Render task returned by pdf.js page.render()
type PdfRenderTask = { promise: Promise<void> };

// Minimal interface for a pdf.js page object
type PdfPage = {
    getViewport: (params: { scale: number }) => PdfViewport;
    render: (params: { canvasContext: CanvasRenderingContext2D; canvas: HTMLCanvasElement; viewport: PdfViewport }) => PdfRenderTask;
    cleanup?: () => void;
};

// Time before the shared worker is destroyed after the last render completes
const DEFAULT_WORKER_IDLE_TIMEOUT_MS = LIMITS.thumbnails.pdf.workerIdleTimeoutMs;
// Maximum concurrent PDF page renders to limit memory usage
const MAX_PARALLEL_PDF_RENDERS = LIMITS.thumbnails.pdf.maxParallelRenders;
const MOBILE_MAX_PARALLEL_PDF_RENDERS = LIMITS.thumbnails.pdf.maxParallelRendersMobile;

// Shared pdf.js worker instance reused across renders
let sharedWorker: PdfWorker | null = null;
let sharedWorkerVerbosityLevel: number | null = null;
// Timer ID for destroying the worker after idle timeout
let workerIdleTimerId: number | null = null;

const renderLimiter = createRenderLimiter(Platform.isMobile ? MOBILE_MAX_PARALLEL_PDF_RENDERS : MAX_PARALLEL_PDF_RENDERS);
const logOnce = createOnceLogger();

const MOBILE_PDF_PREFLIGHT_BUDGET_BYTES = LIMITS.thumbnails.pdf.preflight.mobileBudgetBytes;
const MOBILE_PDF_OPERATOR_LIST_TIMEOUT_MS = LIMITS.thumbnails.pdf.preflight.operatorListTimeoutMs;
const MOBILE_PDF_PREFLIGHT_MULTIPLIERS = LIMITS.thumbnails.pdf.preflight.multipliers;
const MOBILE_PDF_MAX_DECODED_IMAGE_PIXELS = LIMITS.thumbnails.featureImage.maxFallbackPixels.mobile;

function logPdfPreflightSkip(path: string, params: { scan: PdfByteScanMetrics; reason: string; metrics?: Record<string, unknown> }): void {
    const { scan, reason, metrics } = params;
    logOnce(`pdf-preflight-skip:${path}:${reason}`, '[PDF preflight] pdf.preflightSkip', {
        path,
        reason,
        sumImagePixels: scan.sumImagePixels,
        maxImagePixels: scan.maxImagePixels,
        hasSoftMask: scan.hasSoftMask,
        hasTransparencyGroup: scan.hasTransparencyGroup,
        ...(metrics ?? {})
    });
}

function clearWorkerIdleTimer(): void {
    if (workerIdleTimerId === null) {
        return;
    }
    window.clearTimeout(workerIdleTimerId);
    workerIdleTimerId = null;
}

// Type guard for checking if a value is a pdf.js page object
function isPdfPage(value: unknown): value is PdfPage {
    if (!isRecord(value)) {
        return false;
    }

    const getViewport = value['getViewport'];
    const render = value['render'];
    return typeof getViewport === 'function' && typeof render === 'function';
}

// Resets the idle timer that destroys the shared worker after inactivity
function touchWorkerIdleTimer(): void {
    clearWorkerIdleTimer();

    if (sharedWorker === null) {
        return;
    }

    if (renderLimiter.getActiveCount() > 0) {
        return;
    }

    workerIdleTimerId = window.setTimeout(() => {
        if (renderLimiter.getActiveCount() > 0) {
            touchWorkerIdleTimer();
            return;
        }
        // Timer callbacks cannot await, so worker teardown runs in the background.
        void destroySharedWorker();
    }, DEFAULT_WORKER_IDLE_TIMEOUT_MS);
}

// Cleans up and destroys the shared pdf.js worker instance
async function destroySharedWorker(): Promise<void> {
    clearWorkerIdleTimer();

    const worker = sharedWorker;
    sharedWorker = null;
    sharedWorkerVerbosityLevel = null;

    if (worker === null) {
        return;
    }

    if (hasFunctionProperty(worker, 'destroy')) {
        try {
            // pdf.js destroy can be sync or async depending on version/build.
            const result = worker.destroy();
            if (isPromiseLike(result)) {
                await result;
            }
        } catch {
            // ignore
        }
    }
}

function isPdfDocumentLoadingTask(value: unknown): value is PdfDocumentLoadingTask {
    if (!isRecord(value)) {
        return false;
    }
    return isPromiseLike(value['promise']);
}

function isPdfJsLibrary(value: unknown): value is PdfJsLibrary {
    if (!isRecord(value)) {
        return false;
    }

    const getDocument = value['getDocument'];
    return typeof getDocument === 'function';
}

function isPdfDocument(value: unknown): value is PdfDocument {
    if (!isRecord(value)) {
        return false;
    }

    const getPage = value['getPage'];
    return typeof getPage === 'function';
}

function getPdfJsErrorsVerbosityLevel(pdfjs: unknown): number | null {
    if (!isRecord(pdfjs)) {
        return null;
    }

    const verbosityLevel = pdfjs['VerbosityLevel'];
    if (isRecord(verbosityLevel)) {
        const errors = verbosityLevel['ERRORS'];
        if (typeof errors === 'number') {
            return errors;
        }
    }

    // pdf.js uses 0 for "errors only" verbosity level.
    return 0;
}

type PdfWorkerConstructor = new (params?: Record<string, unknown>) => unknown;

function isIndexable(value: unknown): value is Record<string, unknown> {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function hasFunctionProperty<K extends string>(
    value: unknown,
    key: K
): value is Record<string, unknown> & Record<K, (...args: unknown[]) => unknown> {
    if (!isIndexable(value)) {
        return false;
    }
    return typeof value[key] === 'function';
}

function isPdfWorkerConstructor(value: unknown): value is PdfWorkerConstructor {
    return typeof value === 'function';
}

// Attempts to create a pdf.js worker using the PDFWorker API
function tryCreateWorker(pdfjs: unknown, verbosityLevel: number | null): PdfWorker | null {
    if (!isRecord(pdfjs)) {
        return null;
    }

    const pdfWorker = pdfjs['PDFWorker'];
    const workerParams: Record<string, unknown> = typeof verbosityLevel === 'number' ? { verbosity: verbosityLevel } : {};

    if (hasFunctionProperty(pdfWorker, 'create')) {
        try {
            const worker = pdfWorker.create(workerParams);
            return isRecord(worker) ? worker : null;
        } catch {
            return null;
        }
    }

    if (isPdfWorkerConstructor(pdfWorker)) {
        try {
            const worker = new pdfWorker(workerParams);
            return isRecord(worker) ? worker : null;
        } catch {
            return null;
        }
    }

    return null;
}

// Returns the shared worker instance, creating it if necessary
async function getSharedWorkerInstance(pdfjs: unknown, verbosityLevel: number | null): Promise<PdfWorker | null> {
    if (sharedWorker) {
        if (sharedWorkerVerbosityLevel === verbosityLevel) {
            touchWorkerIdleTimer();
            return sharedWorker;
        }

        // Wait for the old worker shutdown before creating a new worker instance.
        await destroySharedWorker();
    }

    const worker = tryCreateWorker(pdfjs, verbosityLevel);
    if (!worker) {
        return null;
    }

    sharedWorker = worker;
    sharedWorkerVerbosityLevel = verbosityLevel;
    touchWorkerIdleTimer();
    return worker;
}

// Calculates the scale factor to fit dimensions within max bounds
function calculateScale(params: { baseWidth: number; baseHeight: number; maxWidth: number; maxHeight: number }): number {
    const { baseWidth, baseHeight, maxWidth, maxHeight } = params;
    if (baseWidth <= 0 || baseHeight <= 0 || maxWidth <= 0 || maxHeight <= 0) {
        return 1;
    }

    const widthScale = maxWidth / baseWidth;
    const heightScale = maxHeight / baseHeight;
    const scale = Math.min(widthScale, heightScale);
    return Math.min(1, scale);
}

// Converts a canvas to a Blob with the specified MIME type and quality
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob | null> {
    return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob ?? null), mimeType, typeof quality === 'number' ? quality : undefined);
    });
}

// Renders the first page of a PDF file as a thumbnail image blob
export async function renderPdfCoverThumbnail(app: App, pdfFile: TFile, options: PdfCoverThumbnailOptions): Promise<Blob | null> {
    if (pdfFile.extension.toLowerCase() !== 'pdf') {
        return null;
    }

    clearWorkerIdleTimer();
    const release = await renderLimiter.acquire();
    const pdfProcessingDiagnosticHandle = markPdfProcessingInProgress(pdfFile.path);

    let doc: PdfDocument | null = null;
    let page: PdfPage | null = null;
    let preflightScan: PdfByteScanMetrics | null = null;

    try {
        if (Platform.isMobile) {
            let buffer: ArrayBuffer;
            try {
                buffer = await app.vault.adapter.readBinary(pdfFile.path);
            } catch (error) {
                const scan: PdfByteScanMetrics = {
                    sumImagePixels: 0,
                    maxImagePixels: 0,
                    imageDictHits: 0,
                    parsedDimsHits: 0,
                    hasSoftMask: false,
                    hasTransparencyGroup: false,
                    uncertain: true
                };
                logPdfPreflightSkip(pdfFile.path, {
                    scan,
                    reason: 'stageA.readBinaryFailed',
                    metrics: { budgetBytes: MOBILE_PDF_PREFLIGHT_BUDGET_BYTES }
                });
                logOnce(`pdf-preflight-read-failed:${pdfFile.path}`, `[PDF preflight] Failed to read PDF bytes: ${pdfFile.path}`, error);
                return null;
            }

            const stageA = preflightPdfCoverThumbnailStageA({
                bytes: new Uint8Array(buffer),
                budgetBytes: MOBILE_PDF_PREFLIGHT_BUDGET_BYTES,
                maxDecodedImagePixels: MOBILE_PDF_MAX_DECODED_IMAGE_PIXELS
            });

            preflightScan = stageA.metrics.scan;

            if (stageA.decision === 'skip') {
                logPdfPreflightSkip(pdfFile.path, {
                    scan: stageA.metrics.scan,
                    reason: stageA.reason,
                    metrics: {
                        budgetBytes: stageA.metrics.budgetBytes,
                        estimatedBytes: stageA.metrics.stageAEstimatedBytes ?? null
                    }
                });
                return null;
            }
        }

        const pdfjs: unknown = await loadPdfJs();
        const errorsVerbosityLevel = getPdfJsErrorsVerbosityLevel(pdfjs);
        const worker = await getSharedWorkerInstance(pdfjs, errorsVerbosityLevel);

        if (!isPdfJsLibrary(pdfjs)) {
            return null;
        }

        const url = app.vault.getResourcePath(pdfFile);
        // This code path renders page 1 only. Disable streaming and auto-fetch so pdf.js does not load work that is not requested.
        const documentParams: Record<string, unknown> = {
            disableAutoFetch: true,
            disableStream: true,
            maxImageSize: Platform.isMobile
                ? LIMITS.thumbnails.featureImage.maxFallbackPixels.mobile
                : LIMITS.thumbnails.featureImage.maxFallbackPixels.desktop,
            ...(typeof errorsVerbosityLevel === 'number' ? { verbosity: errorsVerbosityLevel } : {}),
            ...(worker ? { worker } : {})
        };

        try {
            const task = pdfjs.getDocument({
                url,
                ...documentParams
            });
            if (!isPdfDocumentLoadingTask(task)) {
                return null;
            }

            const loadedDoc = await task.promise;
            if (!isPdfDocument(loadedDoc)) {
                return null;
            }
            doc = loadedDoc;
        } catch {
            return null;
        }

        const firstPage = await doc.getPage(1);
        if (!isPdfPage(firstPage)) {
            return null;
        }
        page = firstPage;

        const baseViewport = firstPage.getViewport({ scale: 1 });
        const scale = calculateScale({
            baseWidth: baseViewport.width,
            baseHeight: baseViewport.height,
            maxWidth: options.maxWidth,
            maxHeight: options.maxHeight
        });

        if (Platform.isMobile && preflightScan) {
            const stageB = await preflightPdfCoverThumbnailStageB({
                pdfjs,
                page: firstPage,
                scan: preflightScan,
                budgetBytes: MOBILE_PDF_PREFLIGHT_BUDGET_BYTES,
                timeoutMs: MOBILE_PDF_OPERATOR_LIST_TIMEOUT_MS,
                viewportScale: scale,
                maxDecodedImagePixels: MOBILE_PDF_MAX_DECODED_IMAGE_PIXELS,
                multipliers: MOBILE_PDF_PREFLIGHT_MULTIPLIERS
            });

            if (stageB.decision === 'skip') {
                logPdfPreflightSkip(pdfFile.path, {
                    scan: stageB.metrics.scan,
                    reason: stageB.reason,
                    metrics: {
                        budgetBytes: stageB.metrics.budgetBytes,
                        paintOps: stageB.metrics.operators?.paintOps ?? null,
                        xObjectPaintOps: stageB.metrics.operators?.xObjectPaintOps ?? null,
                        inlinePaintOps: stageB.metrics.operators?.inlinePaintOps ?? null,
                        maskPaintOps: stageB.metrics.operators?.maskPaintOps ?? null,
                        transparencyGroupOps: stageB.metrics.operators?.transparencyGroupOps ?? null,
                        uniqueXObjectIds: stageB.metrics.operators?.uniqueXObjectIds ?? null,
                        maxInlineImagePixels: stageB.metrics.operators?.maxInlineImagePixels ?? null,
                        operatorListLength: stageB.metrics.operators?.operatorListLength ?? null,
                        operatorListTimedOut: stageB.metrics.operators?.timedOut ?? null,
                        pagePixels: stageB.metrics.pagePixels ?? null,
                        estimatedBytes: stageB.metrics.estimatedBytes ?? null
                    }
                });
                return null;
            }

            const estimatedBytes = stageB.metrics.estimatedBytes ?? 0;
            const budgetBytes = stageB.metrics.budgetBytes;
            if (budgetBytes > 0 && estimatedBytes >= budgetBytes * 0.8) {
                logOnce(`pdf-preflight-allow:${pdfFile.path}`, '[PDF preflight] pdf.preflightAllow', {
                    path: pdfFile.path,
                    estimatedBytes,
                    budgetBytes,
                    paintOps: stageB.metrics.operators?.paintOps ?? null,
                    xObjectPaintOps: stageB.metrics.operators?.xObjectPaintOps ?? null,
                    inlinePaintOps: stageB.metrics.operators?.inlinePaintOps ?? null,
                    maskPaintOps: stageB.metrics.operators?.maskPaintOps ?? null,
                    transparencyGroupOps: stageB.metrics.operators?.transparencyGroupOps ?? null,
                    uniqueXObjectIds: stageB.metrics.operators?.uniqueXObjectIds ?? null,
                    maxInlineImagePixels: stageB.metrics.operators?.maxInlineImagePixels ?? null,
                    operatorListLength: stageB.metrics.operators?.operatorListLength ?? null,
                    operatorListTimedOut: stageB.metrics.operators?.timedOut ?? null,
                    pagePixels: stageB.metrics.pagePixels ?? null,
                    maxImagePixels: stageB.metrics.scan.maxImagePixels,
                    sumImagePixels: stageB.metrics.scan.sumImagePixels,
                    hasSoftMask: stageB.metrics.scan.hasSoftMask,
                    hasTransparencyGroup: stageB.metrics.scan.hasTransparencyGroup,
                    reason: stageB.reason
                });
            }
        }

        const viewport = firstPage.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

        const renderTask = firstPage.render({ canvasContext: ctx, canvas, viewport });

        await renderTask.promise;

        const blob = await canvasToBlob(canvas, options.mimeType, options.quality);
        if (blob) {
            return blob;
        }

        return await canvasToBlob(canvas, 'image/png');
    } catch {
        return null;
    } finally {
        // PDF_CRASH_DIAGNOSTICS: normal exits clear the active PDF marker.
        clearPdfProcessingInProgress(pdfProcessingDiagnosticHandle);

        try {
            page?.cleanup?.();
        } catch {
            // ignore
        }

        try {
            // Document teardown can return a Promise in newer pdf.js builds.
            const destroyResult = doc?.destroy?.();
            if (isPromiseLike(destroyResult)) {
                await destroyResult;
            }
        } catch {
            // ignore
        }

        if (Platform.isMobile) {
            // Keep the render slot until worker teardown completes to avoid overlap on mobile.
            await destroySharedWorker();
            release();
        } else {
            release();
            touchWorkerIdleTimer();
        }
    }
}
