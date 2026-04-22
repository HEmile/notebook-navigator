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

import { isPromiseLike } from '../../../utils/async';
import { sanitizeRecord } from '../../../utils/recordUtils';
import { isRecord } from '../../../utils/typeGuards';

// Stage A / Stage B preflight helpers for PDF cover thumbnails.
// Stage A scans raw PDF bytes and extracts conservative image metrics.
// Stage B inspects page operators and estimates worst-case paint work.
export type PdfPreflightMultipliers = {
    transparencyGroup: number;
    softMask: number;
};

export type PdfByteScanMetrics = {
    sumImagePixels: number;
    maxImagePixels: number;
    imageDictHits: number;
    parsedDimsHits: number;
    hasSoftMask: boolean;
    hasTransparencyGroup: boolean;
    uncertain: boolean;
};

export type PdfOperatorListMetrics = {
    paintOps: number;
    xObjectPaintOps: number;
    inlinePaintOps: number;
    maskPaintOps: number;
    transparencyGroupOps: number;
    uniqueXObjectIds: number | null;
    maxInlineImagePixels: number;
    operatorListLength: number;
    timedOut: boolean;
    opBreakdown: Record<string, number>;
    uncertain: boolean;
};

export type PdfPreflightDecision = {
    decision: 'skip' | 'render';
    reason: string;
    metrics: {
        budgetBytes: number;
        maxDecodedImagePixels?: number;
        scan: PdfByteScanMetrics;
        stageAEstimatedBytes?: number;
        operators?: PdfOperatorListMetrics;
        pagePixels?: number;
        estimatedBytes?: number;
    };
};

// PDF name tokens used by the raw byte scanner.
const PDF_TOKEN_SUBTYPE = '/Subtype';
const PDF_TOKEN_IMAGE = '/Image';
const PDF_TOKEN_WIDTH = '/Width';
const PDF_TOKEN_HEIGHT = '/Height';
const PDF_TOKEN_SOFT_MASK = '/SMask';
const PDF_TOKEN_S = '/S';
const PDF_TOKEN_TRANSPARENCY = '/Transparency';

// Bounds used when searching for the image dictionary around `/Subtype /Image`.
const MAX_DICT_LOOKBACK_BYTES = 4_096;
const MAX_DICT_LOOKAHEAD_BYTES = 16_384;

// Returns true when `token` bytes match exactly at `index`.
function matchesAscii(bytes: Uint8Array, index: number, token: string): boolean {
    if (index < 0 || index + token.length > bytes.length) {
        return false;
    }

    for (let i = 0; i < token.length; i++) {
        if (bytes[index + i] !== token.charCodeAt(i)) {
            return false;
        }
    }

    return true;
}

// PDF whitespace characters used for token and value parsing.
function isWhitespace(byte: number): boolean {
    return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x0c;
}

// Delimiters that terminate PDF name/value tokens.
function isDelimiter(byte: number): boolean {
    return (
        isWhitespace(byte) ||
        byte === 0x2f || // /
        byte === 0x3c || // <
        byte === 0x3e || // >
        byte === 0x5b || // [
        byte === 0x5d || // ]
        byte === 0x28 || // (
        byte === 0x29 || // )
        byte === 0x7b || // {
        byte === 0x7d // }
    );
}

// Advances `index` until a non-whitespace byte or `end`.
function skipWhitespace(bytes: Uint8Array, index: number, end: number): number {
    let i = index;
    while (i < end && isWhitespace(bytes[i] ?? 0)) {
        i++;
    }
    return i;
}

function isDigit(byte: number): boolean {
    return byte >= 0x30 && byte <= 0x39;
}

function isUnknownArray(value: unknown): value is unknown[] {
    return Array.isArray(value);
}

// Parses a direct positive integer at `index`.
// Returns null for missing/invalid values and for likely indirect references (`10 0 R`).
function parseDirectPositiveInteger(bytes: Uint8Array, index: number, end: number): number | null {
    let i = skipWhitespace(bytes, index, end);

    let value = 0;
    let hasDigits = false;

    while (i < end) {
        const byte = bytes[i] ?? 0;
        if (!isDigit(byte)) {
            break;
        }

        hasDigits = true;
        const digit = byte - 0x30;
        value = value * 10 + digit;

        if (!Number.isSafeInteger(value)) {
            return null;
        }

        i++;
    }

    if (!hasDigits) {
        return null;
    }

    const afterFirst = skipWhitespace(bytes, i, end);
    const nextByte = bytes[afterFirst];

    // A second adjacent number indicates an indirect reference pattern.
    // Stage A only accepts direct dimensions and ignores unresolved values.
    if (nextByte !== undefined && isDigit(nextByte)) {
        // Likely an indirect reference: "<obj> <gen> R"
        let j = afterFirst;
        while (j < end && isDigit(bytes[j] ?? 0)) {
            j++;
        }
        j = skipWhitespace(bytes, j, end);
        if (bytes[j] === 0x52 /* R */) {
            return null;
        }
        return null;
    }

    if (nextByte !== undefined && !isDelimiter(nextByte)) {
        return null;
    }

    if (value <= 0) {
        return null;
    }

    return value;
}

// Finds the last occurrence of a two-byte sequence in a bounded reverse range.
function findLastSequence(bytes: Uint8Array, fromIndex: number, minIndex: number, first: number, second: number): number | null {
    const start = Math.min(fromIndex, bytes.length - 2);
    for (let i = start; i >= minIndex; i--) {
        if (bytes[i] === first && bytes[i + 1] === second) {
            return i;
        }
    }
    return null;
}

// Finds the next occurrence of a two-byte sequence in a bounded forward range.
function findNextSequence(bytes: Uint8Array, fromIndex: number, maxIndex: number, first: number, second: number): number | null {
    const end = Math.min(maxIndex, bytes.length - 2);
    for (let i = Math.max(0, fromIndex); i <= end; i++) {
        if (bytes[i] === first && bytes[i + 1] === second) {
            return i;
        }
    }
    return null;
}

// Finds a token in a bounded byte range.
function findToken(bytes: Uint8Array, start: number, end: number, token: string): number | null {
    const limit = Math.min(end, bytes.length) - token.length;
    for (let i = Math.max(0, start); i <= limit; i++) {
        if (bytes[i] !== token.charCodeAt(0)) {
            continue;
        }

        if (matchesAscii(bytes, i, token)) {
            return i;
        }
    }
    return null;
}

// Normalizes configured budget values to a positive integer.
function normalizeBudgetBytes(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        return 1;
    }
    return Math.floor(value);
}

function normalizeMaxDecodedImagePixels(value: number | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return null;
    }
    const safe = Math.floor(value);
    if (!Number.isSafeInteger(safe) || safe <= 0) {
        return null;
    }
    return safe;
}

// Stage A raw-byte scan.
// Collects image dictionary metrics and transparency/mask signals.
// Unresolved image dimensions are ignored; this pass only uses dimensions it can parse directly.
export function scanPdfBytes(bytes: Uint8Array, params?: { budgetBytes?: number }): PdfByteScanMetrics {
    const budgetBytes = typeof params?.budgetBytes === 'number' ? normalizeBudgetBytes(params.budgetBytes) : null;

    let sumImagePixels = 0;
    let maxImagePixels = 0;
    let imageDictHits = 0;
    let parsedDimsHits = 0;
    let hasSoftMask = false;
    let hasTransparencyGroup = false;
    let uncertain = false;

    const subtypeLen = PDF_TOKEN_SUBTYPE.length;
    const softMaskLen = PDF_TOKEN_SOFT_MASK.length;

    const bytesLen = bytes.length;
    for (let i = 0; i < bytesLen; i++) {
        // Track soft mask use anywhere in the file.
        if (!hasSoftMask && i + softMaskLen <= bytesLen && matchesAscii(bytes, i, PDF_TOKEN_SOFT_MASK)) {
            hasSoftMask = true;
        }

        // Track `/S /Transparency` (with optional whitespace between tokens).
        if (!hasTransparencyGroup && matchesAscii(bytes, i, PDF_TOKEN_S)) {
            const next = bytes[i + PDF_TOKEN_S.length];
            if (next === undefined || isDelimiter(next)) {
                const j = skipWhitespace(bytes, i + PDF_TOKEN_S.length, bytesLen);
                if (matchesAscii(bytes, j, PDF_TOKEN_TRANSPARENCY)) {
                    hasTransparencyGroup = true;
                }
            }
        }

        if (i + subtypeLen > bytesLen) {
            continue;
        }

        if (!matchesAscii(bytes, i, PDF_TOKEN_SUBTYPE)) {
            continue;
        }

        // Require `/Subtype /Image` token sequence before scanning dictionary bounds.
        const j = skipWhitespace(bytes, i + subtypeLen, bytesLen);
        if (!matchesAscii(bytes, j, PDF_TOKEN_IMAGE)) {
            continue;
        }
        const imageTokenNext = bytes[j + PDF_TOKEN_IMAGE.length];
        if (imageTokenNext !== undefined && !isDelimiter(imageTokenNext)) {
            continue;
        }

        // Find dictionary start `<<` near the image subtype token.
        const dictStartMin = Math.max(0, i - MAX_DICT_LOOKBACK_BYTES);
        const dictStart = findLastSequence(bytes, i, dictStartMin, 0x3c /* < */, 0x3c /* < */);
        if (dictStart === null) {
            continue;
        }

        imageDictHits++;

        // Find dictionary end `>>` in a bounded forward window.
        // If not found, keep scanning within the bounded lookahead window.
        const dictEndMax = Math.min(bytesLen - 2, i + MAX_DICT_LOOKAHEAD_BYTES);
        const dictEnd = findNextSequence(bytes, i, dictEndMax, 0x3e /* > */, 0x3e /* > */);
        const dictEndExclusive = dictEnd !== null ? dictEnd + 2 : Math.min(bytesLen, i + MAX_DICT_LOOKAHEAD_BYTES);

        // Parse direct `/Width` and `/Height` values inside the dictionary window.
        const widthTokenIndex = findToken(bytes, dictStart, dictEndExclusive, PDF_TOKEN_WIDTH);
        const heightTokenIndex = findToken(bytes, dictStart, dictEndExclusive, PDF_TOKEN_HEIGHT);

        const width =
            widthTokenIndex !== null ? parseDirectPositiveInteger(bytes, widthTokenIndex + PDF_TOKEN_WIDTH.length, dictEndExclusive) : null;
        const height =
            heightTokenIndex !== null
                ? parseDirectPositiveInteger(bytes, heightTokenIndex + PDF_TOKEN_HEIGHT.length, dictEndExclusive)
                : null;

        // Ignore dictionaries with non-direct dimensions (for example `10 0 R` indirect references).
        // Stage B still evaluates render cost using operator metrics and viewport pixels.
        if (width === null || height === null) {
            continue;
        }

        parsedDimsHits++;

        // Pixels per image object.
        const pixels = width * height;
        if (!Number.isSafeInteger(pixels) || pixels <= 0) {
            uncertain = true;
            break;
        }

        sumImagePixels += pixels;
        if (!Number.isSafeInteger(sumImagePixels)) {
            uncertain = true;
            break;
        }

        if (pixels > maxImagePixels) {
            maxImagePixels = pixels;
        }

        // Early exit when a single decoded image already exceeds the configured budget.
        // Stage A decisions are based on max image size, not summed pixels across the file.
        if (budgetBytes !== null && maxImagePixels * 4 > budgetBytes) {
            break;
        }
    }

    return {
        sumImagePixels,
        maxImagePixels,
        imageDictHits,
        parsedDimsHits,
        hasSoftMask,
        hasTransparencyGroup,
        uncertain
    };
}

type PdfImageOpKind = 'xObject' | 'inline' | 'mask';

type PdfImageOpEntry = {
    name: string;
    kind: PdfImageOpKind;
};

function classifyImageOp(name: string): PdfImageOpKind | null {
    if (!name.startsWith('paint')) {
        return null;
    }

    if (name.includes('InlineImage')) {
        return 'inline';
    }

    if (name.includes('Mask')) {
        return 'mask';
    }

    if (name.includes('Image') || name.includes('Jpeg')) {
        return 'xObject';
    }

    return null;
}

function isTransparencyGroupOpName(name: string): boolean {
    return name.toLowerCase().includes('group');
}

// Creates a lookup map from pdf.js operator id -> image paint operator metadata.
function buildImageOpById(ops: Record<string, unknown>): Map<number, PdfImageOpEntry> {
    const imageOps = new Map<number, PdfImageOpEntry>();

    for (const [name, id] of Object.entries(ops)) {
        if (typeof id !== 'number' || !Number.isFinite(id)) {
            continue;
        }

        const kind = classifyImageOp(name);
        if (!kind) {
            continue;
        }

        if (!imageOps.has(id)) {
            imageOps.set(id, { name, kind });
        }
    }

    return imageOps;
}

function buildTransparencyGroupOpIds(ops: Record<string, unknown>): Set<number> {
    const opIds = new Set<number>();

    for (const [name, id] of Object.entries(ops)) {
        if (typeof id !== 'number' || !Number.isFinite(id)) {
            continue;
        }

        if (!isTransparencyGroupOpName(name)) {
            continue;
        }

        opIds.add(id);
    }

    return opIds;
}

// Runtime guard for pdf.js operator list shape.
function isOperatorList(value: unknown): value is { fnArray: unknown[]; argsArray?: unknown[] } {
    if (!isRecord(value)) {
        return false;
    }

    const fnArray = value['fnArray'];
    const argsArray = value['argsArray'];
    return Array.isArray(fnArray) && (argsArray === undefined || Array.isArray(argsArray));
}

function toPositiveInteger(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return null;
    }

    const rounded = Math.ceil(value);
    if (!Number.isSafeInteger(rounded) || rounded <= 0) {
        return null;
    }

    return rounded;
}

function getInlineImagePixels(args: unknown): number | null {
    const candidate = isUnknownArray(args) ? args[0] : args;
    if (!isRecord(candidate)) {
        return null;
    }

    const width = toPositiveInteger(candidate['width'] ?? candidate['w']);
    const height = toPositiveInteger(candidate['height'] ?? candidate['h']);
    if (width === null || height === null) {
        return null;
    }

    const pixels = width * height;
    if (!Number.isSafeInteger(pixels) || pixels <= 0) {
        return null;
    }

    return pixels;
}

function extractXObjectId(args: unknown): string | null {
    if (isUnknownArray(args) && typeof args[0] === 'string' && args[0].length > 0) {
        return args[0];
    }

    if (typeof args === 'string' && args.length > 0) {
        return args;
    }

    return null;
}

function requestPageCleanup(page: unknown): void {
    if (!isRecord(page) || typeof page['cleanup'] !== 'function') {
        return;
    }

    try {
        Reflect.apply(page['cleanup'], page, []);
    } catch {
        // ignore
    }
}

// Wraps a promise and returns timeout metadata.
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<{ value: T | null; timedOut: boolean; rejected: boolean }> {
    const timeoutMsSafe = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.floor(timeoutMs) : 1;

    return await new Promise(resolve => {
        let settled = false;
        const timeoutId = globalThis.setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            resolve({ value: null, timedOut: true, rejected: false });
        }, timeoutMsSafe);

        void promise.then(
            value => {
                if (settled) {
                    return;
                }
                settled = true;
                globalThis.clearTimeout(timeoutId);
                resolve({ value, timedOut: false, rejected: false });
            },
            () => {
                if (settled) {
                    return;
                }
                settled = true;
                globalThis.clearTimeout(timeoutId);
                resolve({ value: null, timedOut: false, rejected: true });
            }
        );
    });
}

// Stage B operator metrics.
// Reads page operator list and counts image-related paint operations.
export async function getOperatorListMetrics(
    pdfjs: unknown,
    page: unknown,
    params: { timeoutMs: number }
): Promise<PdfOperatorListMetrics> {
    const opBreakdown = sanitizeRecord<number>(undefined);
    const createUncertainMetrics = (overrides?: Partial<PdfOperatorListMetrics>): PdfOperatorListMetrics => ({
        paintOps: 0,
        xObjectPaintOps: 0,
        inlinePaintOps: 0,
        maskPaintOps: 0,
        transparencyGroupOps: 0,
        uniqueXObjectIds: null,
        maxInlineImagePixels: 0,
        operatorListLength: 0,
        timedOut: false,
        opBreakdown,
        uncertain: true,
        ...(overrides ?? {})
    });

    // Missing OPS table means stage cannot map fn ids to image paint operations.
    if (!isRecord(pdfjs) || !isRecord(pdfjs['OPS'])) {
        return createUncertainMetrics();
    }

    const imageOpById = buildImageOpById(pdfjs['OPS']);
    if (imageOpById.size === 0) {
        return createUncertainMetrics();
    }

    const transparencyGroupOpIds = buildTransparencyGroupOpIds(pdfjs['OPS']);

    if (!isRecord(page) || typeof page['getOperatorList'] !== 'function') {
        return createUncertainMetrics();
    }

    // `getOperatorList()` can throw synchronously depending on runtime/state.
    let operatorListPromise: unknown;
    try {
        operatorListPromise = Reflect.apply(page['getOperatorList'], page, []);
    } catch {
        return createUncertainMetrics();
    }

    if (!isPromiseLike(operatorListPromise)) {
        return createUncertainMetrics();
    }

    // Timeout does not cancel pdf.js parsing work, so cleanup is requested when we stop waiting.
    const operatorListTask = Promise.resolve(operatorListPromise);
    void operatorListTask.catch(() => undefined);

    const timeoutResult = await withTimeout(operatorListTask, params.timeoutMs);
    if (timeoutResult.timedOut) {
        requestPageCleanup(page);
        return createUncertainMetrics({ timedOut: true });
    }

    if (timeoutResult.rejected || timeoutResult.value === null || !isOperatorList(timeoutResult.value)) {
        return createUncertainMetrics();
    }

    const opList = timeoutResult.value;
    const fnArray = opList.fnArray;
    const argsArray = Array.isArray(opList.argsArray) ? opList.argsArray : null;
    const operatorListLength = argsArray ? Math.min(fnArray.length, argsArray.length) : fnArray.length;

    let paintOps = 0;
    let xObjectPaintOps = 0;
    let inlinePaintOps = 0;
    let maskPaintOps = 0;
    let transparencyGroupOps = 0;
    let maxInlineImagePixels = 0;
    const uniqueXObjectIds = new Set<string>();

    for (let index = 0; index < operatorListLength; index++) {
        const fn = fnArray[index];
        if (typeof fn !== 'number' || !Number.isFinite(fn)) {
            return createUncertainMetrics({
                paintOps,
                xObjectPaintOps,
                inlinePaintOps,
                maskPaintOps,
                transparencyGroupOps,
                uniqueXObjectIds: uniqueXObjectIds.size > 0 ? uniqueXObjectIds.size : null,
                maxInlineImagePixels,
                operatorListLength: index
            });
        }

        if (transparencyGroupOpIds.has(fn)) {
            transparencyGroupOps++;
        }

        // Only count operators mapped to image paint operations.
        const imageOp = imageOpById.get(fn);
        if (!imageOp) {
            continue;
        }

        paintOps++;
        opBreakdown[imageOp.name] = (opBreakdown[imageOp.name] ?? 0) + 1;

        const args = argsArray ? argsArray[index] : undefined;

        if (imageOp.kind === 'inline') {
            inlinePaintOps++;

            const inlineImagePixels = getInlineImagePixels(args);
            if (inlineImagePixels !== null && inlineImagePixels > maxInlineImagePixels) {
                maxInlineImagePixels = inlineImagePixels;
            }
            continue;
        }

        if (imageOp.kind === 'mask') {
            maskPaintOps++;
        } else {
            xObjectPaintOps++;
        }

        const xObjectId = extractXObjectId(args);
        if (xObjectId) {
            uniqueXObjectIds.add(xObjectId);
        }
    }

    return {
        paintOps,
        xObjectPaintOps,
        inlinePaintOps,
        maskPaintOps,
        transparencyGroupOps,
        uniqueXObjectIds: uniqueXObjectIds.size > 0 ? uniqueXObjectIds.size : null,
        maxInlineImagePixels,
        operatorListLength,
        timedOut: false,
        opBreakdown,
        uncertain: false
    };
}

// Returns viewport pixel count at the requested scale.
// Any invalid viewport data is treated as uncertain.
function getViewportPixels(page: unknown, params: { scale: number }): { pagePixels: number; uncertain: boolean } {
    if (!isRecord(page) || typeof page['getViewport'] !== 'function') {
        return { pagePixels: 0, uncertain: true };
    }

    const scale = params.scale;
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) {
        return { pagePixels: 0, uncertain: true };
    }

    let viewport: unknown;
    try {
        viewport = Reflect.apply(page['getViewport'], page, [{ scale }]);
    } catch {
        return { pagePixels: 0, uncertain: true };
    }

    if (!isRecord(viewport)) {
        return { pagePixels: 0, uncertain: true };
    }

    const width = viewport['width'];
    const height = viewport['height'];

    if (
        typeof width !== 'number' ||
        typeof height !== 'number' ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
    ) {
        return { pagePixels: 0, uncertain: true };
    }

    const pagePixels = Math.ceil(width) * Math.ceil(height);
    if (!Number.isSafeInteger(pagePixels) || pagePixels <= 0) {
        return { pagePixels: 0, uncertain: true };
    }

    return { pagePixels, uncertain: false };
}

// Worst-case composite estimate for render work.
// `perOpPixels` is bounded by max(pagePixels, maxImagePixels, maxInlineImagePixels), then multiplied by paint ops.
function estimateWorstCaseBytes(params: {
    pagePixels: number;
    paintOps: number;
    maxImagePixels: number;
    maxInlineImagePixels: number;
    hasSoftMask: boolean;
    hasTransparencyGroup: boolean;
    maxDecodedImagePixels: number | null;
    multipliers: PdfPreflightMultipliers;
}): number {
    const pagePixelsSafe = Number.isFinite(params.pagePixels) && params.pagePixels > 0 ? Math.floor(params.pagePixels) : 0;
    const maxImagePixelsSafe = Number.isFinite(params.maxImagePixels) && params.maxImagePixels > 0 ? Math.floor(params.maxImagePixels) : 0;
    const maxInlineImagePixelsSafe =
        Number.isFinite(params.maxInlineImagePixels) && params.maxInlineImagePixels > 0 ? Math.floor(params.maxInlineImagePixels) : 0;
    const paintOpsSafe = Number.isFinite(params.paintOps) && params.paintOps > 0 ? Math.floor(params.paintOps) : 0;

    // Use whichever is larger: full page composite area, largest XObject image, or largest inline image.
    let perOpPixels = Math.max(pagePixelsSafe, maxImagePixelsSafe, maxInlineImagePixelsSafe);
    if (typeof params.maxDecodedImagePixels === 'number' && params.maxDecodedImagePixels > 0) {
        perOpPixels = Math.min(perOpPixels, params.maxDecodedImagePixels);
    }
    let estimated = paintOpsSafe * perOpPixels * 4;

    if (params.hasTransparencyGroup) {
        estimated *= params.multipliers.transparencyGroup;
    }

    if (params.hasSoftMask) {
        estimated *= params.multipliers.softMask;
    }

    return estimated;
}

// Stage A decision from raw-byte scan metrics.
export function preflightPdfCoverThumbnailStageA(params: {
    bytes: Uint8Array;
    budgetBytes: number;
    maxDecodedImagePixels?: number;
}): PdfPreflightDecision {
    const budgetBytes = normalizeBudgetBytes(params.budgetBytes);
    const maxDecodedImagePixels = normalizeMaxDecodedImagePixels(params.maxDecodedImagePixels);
    const scan = scanPdfBytes(params.bytes, { budgetBytes });

    // Stage A skips only when scanner state is invalid (for example numeric overflow).
    if (scan.uncertain) {
        return { decision: 'skip', reason: 'stageA.uncertain', metrics: { budgetBytes, scan } };
    }

    // Stage A is a coarse guardrail. It skips only when a single decoded image is already over budget.
    // Summed image pixels across the whole PDF are not used for decisions.
    const effectiveMaxImagePixels =
        typeof maxDecodedImagePixels === 'number' ? Math.min(scan.maxImagePixels, maxDecodedImagePixels) : scan.maxImagePixels;
    const estimatedMaxImageBytes = effectiveMaxImagePixels * 4;
    const combined = estimatedMaxImageBytes;

    if (!Number.isFinite(combined) || combined > budgetBytes) {
        return {
            decision: 'skip',
            reason: 'stageA.maxImageOverBudget',
            metrics: { budgetBytes, maxDecodedImagePixels: maxDecodedImagePixels ?? undefined, scan, stageAEstimatedBytes: combined }
        };
    }

    return {
        decision: 'render',
        reason: 'stageA.allow',
        metrics: { budgetBytes, maxDecodedImagePixels: maxDecodedImagePixels ?? undefined, scan, stageAEstimatedBytes: combined }
    };
}

// Stage B decision from operator metrics + viewport + Stage A scan metrics.
export async function preflightPdfCoverThumbnailStageB(params: {
    pdfjs: unknown;
    page: unknown;
    scan: PdfByteScanMetrics;
    budgetBytes: number;
    timeoutMs: number;
    viewportScale: number;
    maxDecodedImagePixels?: number;
    multipliers: PdfPreflightMultipliers;
}): Promise<PdfPreflightDecision> {
    const budgetBytes = normalizeBudgetBytes(params.budgetBytes);
    const maxDecodedImagePixels = normalizeMaxDecodedImagePixels(params.maxDecodedImagePixels);
    const scan = params.scan;

    // Stage B inherits Stage A uncertainty as a skip.
    if (scan.uncertain) {
        return { decision: 'skip', reason: 'stageB.scanUncertain', metrics: { budgetBytes, scan } };
    }

    const operators = await getOperatorListMetrics(params.pdfjs, params.page, { timeoutMs: params.timeoutMs });
    if (operators.uncertain) {
        return {
            decision: 'skip',
            reason: operators.timedOut ? 'stageB.operatorListTimeout' : 'stageB.operatorListUncertain',
            metrics: { budgetBytes, scan, operators }
        };
    }

    // Use the thumbnail render scale for page pixels so Stage B matches the actual canvas target.
    const { pagePixels, uncertain: viewportUncertain } = getViewportPixels(params.page, { scale: params.viewportScale });
    if (viewportUncertain) {
        return { decision: 'skip', reason: 'stageB.viewportUncertain', metrics: { budgetBytes, scan, operators } };
    }

    // Stage A only records image dimensions it can parse directly from `/Width` and `/Height`.
    // When PDF image dictionaries use indirect references, `scan.maxImagePixels` can be 0 and this estimate relies on
    // operator metrics plus the thumbnail-scale viewport pixels.

    // XObject images can be painted repeatedly (same id across many ops). When available, use unique xObject ids for
    // non-inline paint ops so repeated paints do not multiply the estimate. If ids cannot be extracted, fall back to
    // counting xObject + mask ops.
    const nonInlinePaintOps =
        operators.uniqueXObjectIds !== null ? operators.uniqueXObjectIds : operators.xObjectPaintOps + operators.maskPaintOps;
    const effectivePaintOps = nonInlinePaintOps + operators.inlinePaintOps;

    // Composite estimate combines paint op count, per-op pixel bound, and transparency multipliers.
    const hasSoftMask = scan.hasSoftMask || operators.maskPaintOps > 0;
    const hasTransparencyGroup = scan.hasTransparencyGroup || operators.transparencyGroupOps > 0;
    const estimatedBytes = estimateWorstCaseBytes({
        pagePixels,
        paintOps: effectivePaintOps,
        maxImagePixels: scan.maxImagePixels,
        maxInlineImagePixels: operators.maxInlineImagePixels,
        hasSoftMask,
        hasTransparencyGroup,
        maxDecodedImagePixels,
        multipliers: params.multipliers
    });

    if (!Number.isFinite(estimatedBytes)) {
        return {
            decision: 'skip',
            reason: 'stageB.estimateInvalid',
            metrics: { budgetBytes, maxDecodedImagePixels: maxDecodedImagePixels ?? undefined, scan, operators, pagePixels, estimatedBytes }
        };
    }

    if (estimatedBytes > budgetBytes) {
        return {
            decision: 'skip',
            reason: 'stageB.compositeOverBudget',
            metrics: { budgetBytes, maxDecodedImagePixels: maxDecodedImagePixels ?? undefined, scan, operators, pagePixels, estimatedBytes }
        };
    }

    return {
        decision: 'render',
        reason: 'stageB.allow',
        metrics: { budgetBytes, maxDecodedImagePixels: maxDecodedImagePixels ?? undefined, scan, operators, pagePixels, estimatedBytes }
    };
}
