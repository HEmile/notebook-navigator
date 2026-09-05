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

import { findFencedCodeBlockRanges, findInlineCodeRanges, findRangeContainingIndex } from '../codeRangeUtils';
import type { NumericRange } from '../arrayUtils';
import { stripHtmlForPreview } from '../htmlParsingUtils';
import { stripLatexFromChunk } from './latexParsing';

export interface HtmlStripOptions {
    preserveInlineCode?: boolean;
    preserveFencedCode?: boolean;
}

export interface CodeRangeContext {
    inlineCodeRanges: NumericRange[];
    fencedCodeRanges: NumericRange[];
}

const HTML_ENTITY_MAP: Record<string, string> = Object.freeze({
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
    hellip: '…',
    copy: '©',
    reg: '®',
    trade: '™'
});

let placeholderSeed = 0;

export function createPlaceholderBase(label: string): string {
    placeholderSeed += 1;
    return `@@NN_${label}_${Date.now().toString(36)}_${placeholderSeed}@@`;
}

export function buildPlaceholder(base: string, index: number): string {
    return `${base}_${index}@@`;
}

export function escapeRegExpLiteral(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlEntitiesFromChunk(chunk: string): string {
    if (!chunk.includes('&')) {
        return chunk;
    }

    return chunk.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
        if (body.startsWith('#')) {
            const numeric = body.slice(1);
            const isHex = numeric.startsWith('x') || numeric.startsWith('X');
            const digits = isHex ? numeric.slice(1) : numeric;
            const codePoint = Number.parseInt(digits, isHex ? 16 : 10);
            if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
                return match;
            }
            try {
                return String.fromCodePoint(codePoint);
            } catch {
                return match;
            }
        }

        const mapped = HTML_ENTITY_MAP[body.toLowerCase()];
        return mapped ?? match;
    });
}

export function collapseWhitespace(text: string): string {
    return text.split(/\s+/).filter(Boolean).join(' ').trim();
}

function countLeadingBlockquoteMarkers(line: string): number {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('>')) {
        return 0;
    }

    let index = 0;
    let depth = 0;

    while (index < trimmed.length) {
        if (trimmed[index] !== '>') {
            break;
        }

        depth += 1;
        index += 1;

        while (index < trimmed.length && (trimmed[index] === ' ' || trimmed[index] === '\t')) {
            index += 1;
        }

        if (index >= trimmed.length || trimmed[index] !== '>') {
            break;
        }
    }

    return depth;
}

function stripLeadingBlockquoteMarkers(line: string, depth: number): string {
    if (depth <= 0) {
        return line;
    }

    let index = 0;
    while (index < line.length && (line[index] === ' ' || line[index] === '\t')) {
        index += 1;
    }

    let remaining = depth;
    while (remaining > 0 && index < line.length) {
        if (line[index] !== '>') {
            break;
        }

        index += 1;
        while (index < line.length && (line[index] === ' ' || line[index] === '\t')) {
            index += 1;
        }

        remaining -= 1;
    }

    return line.slice(index);
}

export function stripBlockquotePrefixFromFencedBlock(block: string): string {
    const firstNewline = block.indexOf('\n');
    const firstLine = firstNewline === -1 ? block : block.slice(0, firstNewline);
    const depth = countLeadingBlockquoteMarkers(firstLine);
    if (depth === 0) {
        return block;
    }

    const strippedFenceLine = stripLeadingBlockquoteMarkers(firstLine, depth).trimStart();
    if (!/^[`~]{3,}/u.test(strippedFenceLine)) {
        return block;
    }

    const lines = block.split(/\r?\n/);
    const strippedLines = lines.map(line => stripLeadingBlockquoteMarkers(line, depth));
    return strippedLines.join('\n');
}

export function stripInlineCodeFence(span: string): string {
    let contentStart = 0;
    while (contentStart < span.length && span[contentStart] === '`') {
        contentStart += 1;
    }

    let contentEnd = span.length;
    while (contentEnd > contentStart && span[contentEnd - 1] === '`') {
        contentEnd -= 1;
    }

    return span.slice(contentStart, contentEnd);
}

export function unwrapInlineCodeSegments(text: string, inlineRanges: readonly NumericRange[]): string {
    if (inlineRanges.length === 0) {
        return text;
    }

    let cursor = 0;
    let result = '';

    inlineRanges.forEach(range => {
        if (range.start > cursor) {
            result += text.slice(cursor, range.start);
        }
        result += stripInlineCodeFence(text.slice(range.start, range.end));
        cursor = range.end;
    });

    if (cursor < text.length) {
        result += text.slice(cursor);
    }

    return result;
}

export function combineCodeRanges(context: CodeRangeContext, includeInline: boolean, includeFenced: boolean) {
    const combined: (NumericRange & { kind: 'inline' | 'fenced' })[] = [];
    if (includeInline) {
        combined.push(...context.inlineCodeRanges.map(range => ({ ...range, kind: 'inline' as const })));
    }
    if (includeFenced) {
        combined.push(...context.fencedCodeRanges.map(range => ({ ...range, kind: 'fenced' as const })));
    }
    combined.sort((first, second) => first.start - second.start || first.end - second.end);
    return combined;
}

function transformOutsideCodeSegments(
    text: string,
    context: CodeRangeContext,
    options: {
        includeInline: boolean;
        includeFenced: boolean;
        transform: (chunk: string) => string;
        contextWhenNoRanges: CodeRangeContext;
    }
): { text: string; context: CodeRangeContext } {
    const combined = combineCodeRanges(context, options.includeInline, options.includeFenced);
    if (combined.length === 0) {
        return {
            text: options.transform(text),
            context: options.contextWhenNoRanges
        };
    }

    let cursor = 0;
    let result = '';
    const mappedInline: NumericRange[] = [];
    const mappedFenced: NumericRange[] = [];

    for (const range of combined) {
        if (range.start > cursor) {
            result += options.transform(text.slice(cursor, range.start));
        }

        const segmentStart = result.length;
        const segment = text.slice(range.start, range.end);
        result += segment;
        const segmentEnd = result.length;

        if (range.kind === 'inline') {
            mappedInline.push({ start: segmentStart, end: segmentEnd });
        } else {
            mappedFenced.push({ start: segmentStart, end: segmentEnd });
        }

        cursor = range.end;
    }

    if (cursor < text.length) {
        result += options.transform(text.slice(cursor));
    }

    return {
        text: result,
        context: {
            inlineCodeRanges: mappedInline,
            fencedCodeRanges: mappedFenced
        }
    };
}

export function stripHtmlOutsideCode(
    text: string,
    context: CodeRangeContext,
    options?: HtmlStripOptions & { enabled?: boolean }
): { text: string; context: CodeRangeContext } {
    const enabled = options?.enabled ?? true;
    const preserveInlineCode = options?.preserveInlineCode ?? true;
    const preserveFencedCode = options?.preserveFencedCode ?? true;

    if (!enabled || !text.includes('<')) {
        return { text, context };
    }

    return transformOutsideCodeSegments(text, context, {
        includeInline: preserveInlineCode,
        includeFenced: preserveFencedCode,
        transform: stripHtmlForPreview,
        contextWhenNoRanges: { inlineCodeRanges: [], fencedCodeRanges: [] }
    });
}

export function stripLatexOutsideCode(
    text: string,
    context: CodeRangeContext,
    options?: HtmlStripOptions & { enabled?: boolean }
): { text: string; context: CodeRangeContext } {
    const enabled = options?.enabled ?? true;
    const preserveInlineCode = options?.preserveInlineCode ?? true;
    const preserveFencedCode = options?.preserveFencedCode ?? true;

    if (!enabled || !text.includes('$')) {
        return { text, context };
    }

    return transformOutsideCodeSegments(text, context, {
        includeInline: preserveInlineCode,
        includeFenced: preserveFencedCode,
        transform: stripLatexFromChunk,
        contextWhenNoRanges: { inlineCodeRanges: [], fencedCodeRanges: [] }
    });
}

function clipTextAndContext(text: string, context: CodeRangeContext, sliceEnd: number): { text: string; context: CodeRangeContext } {
    const clippedEnd = Math.min(text.length, sliceEnd);
    const clippedText = text.slice(0, clippedEnd);
    const clippedInline = context.inlineCodeRanges.filter(range => range.end <= clippedEnd).map(range => ({ ...range }));
    const clippedFenced = context.fencedCodeRanges.filter(range => range.end <= clippedEnd).map(range => ({ ...range }));

    return {
        text: clippedText,
        context: {
            inlineCodeRanges: clippedInline,
            fencedCodeRanges: clippedFenced
        }
    };
}

export function stripTrailingIncompleteEmbeds(result: { text: string; context: CodeRangeContext }): {
    text: string;
    context: CodeRangeContext;
} {
    const { text, context } = result;
    if (!text.includes('![') && !text.includes('[[') && !text.includes('^[') && !text.includes('[^')) {
        return result;
    }

    const isStartInCode = (startIndex: number) =>
        findRangeContainingIndex(startIndex, context.inlineCodeRanges) !== null ||
        findRangeContainingIndex(startIndex, context.fencedCodeRanges) !== null;

    let sliceEnd = text.length;

    const wikiEmbedStart = text.lastIndexOf('![[', sliceEnd);
    if (wikiEmbedStart !== -1 && !isStartInCode(wikiEmbedStart)) {
        const wikiEmbedClose = text.indexOf(']]', wikiEmbedStart + 3);
        if (wikiEmbedClose === -1) {
            sliceEnd = wikiEmbedStart;
        }
    }

    const candidate = text.slice(0, sliceEnd);
    const wikiLinkStart = candidate.lastIndexOf('[[');
    if (wikiLinkStart !== -1 && (wikiLinkStart === 0 || candidate[wikiLinkStart - 1] !== '!') && !isStartInCode(wikiLinkStart)) {
        const wikiLinkClose = candidate.indexOf(']]', wikiLinkStart + 2);
        if (wikiLinkClose === -1) {
            sliceEnd = Math.min(sliceEnd, wikiLinkStart);
        }
    }

    const markdownImageStart = candidate.lastIndexOf('![');
    if (markdownImageStart !== -1 && !candidate.startsWith('![[', markdownImageStart) && !isStartInCode(markdownImageStart)) {
        const markdownImageClose = candidate.indexOf(')', markdownImageStart + 2);
        if (markdownImageClose === -1) {
            sliceEnd = Math.min(sliceEnd, markdownImageStart);
        }
    }

    const inlineFootnoteStart = candidate.lastIndexOf('^[');
    if (inlineFootnoteStart !== -1 && !isStartInCode(inlineFootnoteStart)) {
        const inlineFootnoteClose = candidate.indexOf(']', inlineFootnoteStart + 2);
        if (inlineFootnoteClose === -1) {
            sliceEnd = Math.min(sliceEnd, inlineFootnoteStart);
        }
    }

    const referenceFootnoteStart = candidate.lastIndexOf('[^');
    if (referenceFootnoteStart !== -1 && !isStartInCode(referenceFootnoteStart)) {
        const referenceFootnoteClose = candidate.indexOf(']', referenceFootnoteStart + 2);
        if (referenceFootnoteClose === -1) {
            sliceEnd = Math.min(sliceEnd, referenceFootnoteStart);
        }
    }

    if (sliceEnd === text.length) {
        return result;
    }

    return clipTextAndContext(text, context, sliceEnd);
}

export function clipIncludingCode(
    text: string,
    context: CodeRangeContext,
    targetLength: number,
    maxExtension: number
): { text: string; context: CodeRangeContext } {
    const softLimit = Math.min(text.length, targetLength);
    const hardLimit = Math.min(text.length, maxExtension);
    if (text.length <= softLimit) {
        return { text, context };
    }

    let sliceEnd = softLimit;

    const containingInline = findRangeContainingIndex(sliceEnd, context.inlineCodeRanges);
    if (containingInline && containingInline.end > sliceEnd) {
        sliceEnd = Math.min(hardLimit, containingInline.end);
    }

    const containingFenced = findRangeContainingIndex(sliceEnd, context.fencedCodeRanges);
    if (containingFenced && containingFenced.end > sliceEnd) {
        sliceEnd = Math.min(hardLimit, containingFenced.end);
    }

    return clipTextAndContext(text, context, sliceEnd);
}

export function decodeHtmlEntitiesOutsideCode(
    text: string,
    context: CodeRangeContext
): {
    text: string;
    context: CodeRangeContext;
} {
    if (!text.includes('&')) {
        return { text, context };
    }

    return transformOutsideCodeSegments(text, context, {
        includeInline: true,
        includeFenced: true,
        transform: decodeHtmlEntitiesFromChunk,
        contextWhenNoRanges: context
    });
}

export function stripHtmlTagsPreservingCode(text: string, options?: HtmlStripOptions): string {
    if (!text.includes('<')) {
        return text;
    }

    const fenced = findFencedCodeBlockRanges(text);
    const inline = findInlineCodeRanges(text, fenced);
    const context: CodeRangeContext = {
        inlineCodeRanges: inline,
        fencedCodeRanges: fenced
    };

    return stripHtmlOutsideCode(text, context, { ...options, enabled: true }).text;
}

export function decodeHtmlEntitiesPreservingCode(text: string, options?: HtmlStripOptions): string {
    if (!text.includes('&')) {
        return text;
    }

    const preserveInlineCode = options?.preserveInlineCode ?? true;
    const preserveFencedCode = options?.preserveFencedCode ?? true;
    if (!preserveInlineCode && !preserveFencedCode) {
        return decodeHtmlEntitiesFromChunk(text);
    }

    const fenced = preserveFencedCode ? findFencedCodeBlockRanges(text) : [];
    const inline = preserveInlineCode ? findInlineCodeRanges(text, fenced) : [];
    const context: CodeRangeContext = {
        inlineCodeRanges: inline,
        fencedCodeRanges: fenced
    };

    return decodeHtmlEntitiesOutsideCode(text, context).text;
}
