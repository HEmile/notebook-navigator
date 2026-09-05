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

import { mergeRanges, type NumericRange } from './arrayUtils';

const RAW_TEXT_HTML_TAG_NAMES = new Set(['script', 'style']);

interface HtmlToken {
    start: number;
    end: number;
    tagName: string | null;
    closing: boolean;
    tag: boolean;
}

function isHtmlNameStart(char: string | undefined): boolean {
    return char !== undefined && /[A-Za-z]/.test(char);
}

function isHtmlNameChar(char: string | undefined): boolean {
    return char !== undefined && /[A-Za-z0-9:-]/.test(char);
}

function findHtmlTagEnd(text: string, start: number): number {
    let quote: '"' | "'" | null = null;

    for (let index = start + 1; index < text.length; index += 1) {
        const char = text[index];

        if (quote) {
            if (char === quote) {
                quote = null;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }

        if (char === '>') {
            return index + 1;
        }
    }

    return text.length;
}

function readHtmlTokenAt(text: string, start: number): HtmlToken | null {
    if (text[start] !== '<' || start + 1 >= text.length) {
        return null;
    }

    if (text.startsWith('<!--', start)) {
        const commentEnd = text.indexOf('-->', start + 4);
        return {
            start,
            end: commentEnd === -1 ? text.length : commentEnd + 3,
            tagName: null,
            closing: false,
            tag: false
        };
    }

    if (text[start + 1] === '!') {
        return {
            start,
            end: findHtmlTagEnd(text, start),
            tagName: null,
            closing: false,
            tag: false
        };
    }

    let cursor = start + 1;
    let closing = false;
    if (text[cursor] === '/') {
        closing = true;
        cursor += 1;
    }

    if (!isHtmlNameStart(text[cursor])) {
        return null;
    }

    const nameStart = cursor;
    cursor += 1;
    while (isHtmlNameChar(text[cursor])) {
        cursor += 1;
    }

    return {
        start,
        end: findHtmlTagEnd(text, start),
        tagName: text.slice(nameStart, cursor).toLowerCase(),
        closing,
        tag: true
    };
}

function readRawTextClosingTagAt(text: string, start: number, tagName: string): HtmlToken | null {
    const token = readHtmlTokenAt(text, start);
    if (!token?.tag || !token.closing || token.tagName !== tagName) {
        return null;
    }

    return token;
}

function findRawTextClosingTag(text: string, start: number, tagName: string): HtmlToken | null {
    let cursor = start;

    while (cursor < text.length) {
        const nextStart = text.indexOf('<', cursor);
        if (nextStart === -1) {
            return null;
        }

        const closingToken = readRawTextClosingTagAt(text, nextStart, tagName);
        if (closingToken) {
            return closingToken;
        }

        cursor = nextStart + 1;
    }

    return null;
}

function replaceRangesWithSpaces(text: string, ranges: readonly NumericRange[]): string {
    const mergedRanges = mergeRanges(ranges);
    if (mergedRanges.length === 0) {
        return text;
    }

    let cursor = 0;
    let result = '';

    for (const range of mergedRanges) {
        if (range.start > cursor) {
            result += text.slice(cursor, range.start);
        }

        result += ' ';
        cursor = range.end;
    }

    if (cursor < text.length) {
        result += text.slice(cursor);
    }

    return result;
}

export function findHtmlTagRanges(text: string): NumericRange[] {
    if (!text.includes('<')) {
        return [];
    }

    const ranges: NumericRange[] = [];

    for (let cursor = 0; cursor < text.length;) {
        const start = text.indexOf('<', cursor);
        if (start === -1) {
            break;
        }

        const token = readHtmlTokenAt(text, start);
        if (!token) {
            cursor = start + 1;
            continue;
        }

        if (token.tag) {
            ranges.push({ start: token.start, end: token.end });

            if (!token.closing && token.tagName && RAW_TEXT_HTML_TAG_NAMES.has(token.tagName)) {
                const closingToken = findRawTextClosingTag(text, token.end, token.tagName);
                if (closingToken) {
                    ranges.push({ start: closingToken.start, end: closingToken.end });
                    cursor = closingToken.end;
                    continue;
                }
            }
        }

        cursor = token.end;
    }

    return mergeRanges(ranges);
}

export function stripHtmlForPreview(text: string): string {
    if (!text.includes('<')) {
        return text;
    }

    const ranges: NumericRange[] = [];

    for (let cursor = 0; cursor < text.length;) {
        const start = text.indexOf('<', cursor);
        if (start === -1) {
            break;
        }

        const token = readHtmlTokenAt(text, start);
        if (!token) {
            cursor = start + 1;
            continue;
        }

        if (token.tag && !token.closing && token.tagName && RAW_TEXT_HTML_TAG_NAMES.has(token.tagName)) {
            const closingToken = findRawTextClosingTag(text, token.end, token.tagName);
            const end = closingToken?.end ?? text.length;
            ranges.push({ start: token.start, end });
            cursor = end;
            continue;
        }

        ranges.push({ start: token.start, end: token.end });
        cursor = token.end;
    }

    return replaceRangesWithSpaces(text, ranges);
}
