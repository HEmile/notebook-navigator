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

interface LatexSegmentRange {
    start: number;
    end: number;
}

const CODEPOINT_BACKSLASH = 92;
const CODEPOINT_DOLLAR = 36;
const CODEPOINT_SPACE = 32;
const CODEPOINT_TAB = 9;
const CODEPOINT_NEWLINE = 10;
const CODEPOINT_ZERO = 48;
const CODEPOINT_NINE = 57;

function isEscapedDelimiter(text: string, index: number): boolean {
    let backslashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
        backslashCount += 1;
    }
    return backslashCount % 2 === 1;
}

function addSeparatorIfNeeded(result: string, followingChar: string): string {
    if (result.length === 0) {
        return result;
    }

    const previousChar = result[result.length - 1] ?? '';
    if (previousChar === '' || /\s/u.test(previousChar) || followingChar === '' || /\s/u.test(followingChar)) {
        return result;
    }

    return `${result} `;
}

function getLineStartIndex(text: string, index: number): number {
    const previousNewlineIndex = text.lastIndexOf('\n', index - 1);
    return previousNewlineIndex === -1 ? 0 : previousNewlineIndex + 1;
}

function getLineEndIndex(text: string, lineStart: number): number {
    const newlineIndex = text.indexOf('\n', lineStart);
    return newlineIndex === -1 ? text.length : newlineIndex;
}

function isSpaceOrTabCodePoint(codePoint: number): boolean {
    return codePoint === CODEPOINT_SPACE || codePoint === CODEPOINT_TAB;
}

function isDigitCodePoint(codePoint: number): boolean {
    return codePoint >= CODEPOINT_ZERO && codePoint <= CODEPOINT_NINE;
}

/**
 * Parses Obsidian's inline math token (`$...$` and `$$...$$`) from a start index.
 *
 * This mirrors the parser behavior in Obsidian's bundled markdown extension:
 * - escaped opening `\$` is not math
 * - single-dollar opening requires next character to be non-space/non-tab
 * - single-dollar closing requires previous character to be non-space/non-tab
 * - single-dollar closing is rejected when the following character is a digit
 * - double-dollar closing requires `$$`
 * - double-dollar closing may consume trailing whitespace up to and including a newline
 */
function findObsidianInlineLatexSegment(text: string, start: number): LatexSegmentRange | null {
    if (start < 0 || start >= text.length) {
        return null;
    }

    if (text.charCodeAt(start) !== CODEPOINT_DOLLAR) {
        return null;
    }

    if (isEscapedDelimiter(text, start)) {
        return null;
    }

    let cursor = start + 1;
    let doubleDollar = false;

    if (text.charCodeAt(cursor) === CODEPOINT_DOLLAR) {
        doubleDollar = true;
        cursor += 1;
    }

    const openingFollower = text.charCodeAt(cursor);
    if (!doubleDollar && isSpaceOrTabCodePoint(openingFollower)) {
        return null;
    }

    for (let index = cursor; index < text.length; index += 1) {
        const currentCode = text.charCodeAt(index);
        if (currentCode === CODEPOINT_BACKSLASH) {
            index += 1;
            continue;
        }

        if (currentCode !== CODEPOINT_DOLLAR) {
            continue;
        }

        const nextCode = text.charCodeAt(index + 1);
        const previousCode = text.charCodeAt(index - 1);
        const closesSingleDollar =
            !doubleDollar && !isSpaceOrTabCodePoint(previousCode) && (Number.isNaN(nextCode) || !isDigitCodePoint(nextCode));
        const closesDoubleDollar = doubleDollar && nextCode === CODEPOINT_DOLLAR;

        if (!closesSingleDollar && !closesDoubleDollar) {
            continue;
        }

        let end = index + 1;
        if (doubleDollar) {
            end += 1;

            for (let trailing = end; trailing < text.length; trailing += 1) {
                const character = text[trailing];
                if (character === '\n') {
                    end = trailing + 1;
                    break;
                }
                if (!character || !/\s/u.test(character)) {
                    break;
                }
            }
        }

        return { start, end };
    }

    return null;
}

function isObsidianFencedLatexClosingLine(
    text: string,
    lineStart: number,
    lineEnd: number,
    openingIndent: number,
    openingMarkerLength: number
): boolean {
    let cursor = lineStart;
    while (cursor < lineEnd && text.charCodeAt(cursor) === CODEPOINT_SPACE) {
        cursor += 1;
    }

    const closingIndent = cursor - lineStart;
    if (closingIndent > openingIndent) {
        return false;
    }

    let markerRunLength = 0;
    while (cursor < lineEnd && text.charCodeAt(cursor) === CODEPOINT_DOLLAR) {
        markerRunLength += 1;
        cursor += 1;
    }

    if (markerRunLength < openingMarkerLength) {
        return false;
    }

    while (cursor < lineEnd && text.charCodeAt(cursor) === CODEPOINT_SPACE) {
        cursor += 1;
    }

    return cursor === lineEnd;
}

/**
 * Parses Obsidian's fenced-dollar math block from a candidate dollar index.
 *
 * This mirrors the `fencedCode`-style math tokenizer:
 * - opening line: optional spaces + 2+ dollar markers + optional spaces + newline
 * - closing line: optional indentation (up to opening indent), dollar marker run of equal or greater length,
 *   and optional trailing spaces
 * - if no closing line exists, the token extends to the end of input
 */
function findObsidianFencedLatexSegment(text: string, markerIndex: number): LatexSegmentRange | null {
    if (text.charCodeAt(markerIndex) !== CODEPOINT_DOLLAR) {
        return null;
    }

    const lineStart = getLineStartIndex(text, markerIndex);
    const openingIndent = markerIndex - lineStart;
    for (let index = lineStart; index < markerIndex; index += 1) {
        if (text.charCodeAt(index) !== CODEPOINT_SPACE) {
            return null;
        }
    }

    let cursor = markerIndex;
    while (cursor < text.length && text.charCodeAt(cursor) === CODEPOINT_DOLLAR) {
        cursor += 1;
    }

    const markerLength = cursor - markerIndex;
    if (markerLength < 2) {
        return null;
    }

    while (cursor < text.length && text.charCodeAt(cursor) === CODEPOINT_SPACE) {
        cursor += 1;
    }

    if (cursor >= text.length || text.charCodeAt(cursor) !== CODEPOINT_NEWLINE) {
        return null;
    }

    let lineCursor = cursor + 1;
    while (lineCursor < text.length) {
        const lineEnd = getLineEndIndex(text, lineCursor);
        if (isObsidianFencedLatexClosingLine(text, lineCursor, lineEnd, openingIndent, markerLength)) {
            return { start: lineStart, end: lineEnd };
        }

        if (lineEnd >= text.length) {
            return { start: lineStart, end: lineEnd };
        }

        lineCursor = lineEnd + 1;
    }

    return { start: lineStart, end: text.length };
}

function findNextObsidianLatexSegment(text: string, start: number): LatexSegmentRange | null {
    let candidate = text.indexOf('$', start);
    while (candidate !== -1) {
        if (text.charCodeAt(candidate + 1) === CODEPOINT_DOLLAR) {
            const fenced = findObsidianFencedLatexSegment(text, candidate);
            if (fenced) {
                return fenced;
            }
        }

        const inline = findObsidianInlineLatexSegment(text, candidate);
        if (inline) {
            return inline;
        }

        candidate = text.indexOf('$', candidate + 1);
    }

    return null;
}

/** Removes LaTeX math expressions using Obsidian-compatible `$` and `$$` delimiter parsing rules. */
export function stripLatexFromChunk(chunk: string): string {
    if (!chunk.includes('$')) {
        return chunk;
    }

    let cursor = 0;
    let stripped = '';

    while (cursor < chunk.length) {
        const match = findNextObsidianLatexSegment(chunk, cursor);
        if (!match) {
            stripped += chunk.slice(cursor);
            break;
        }

        if (match.start < cursor || match.end <= match.start) {
            stripped += chunk.slice(cursor, cursor + 1);
            cursor += 1;
            continue;
        }

        stripped += chunk.slice(cursor, match.start);
        const followingChar = chunk[match.end] ?? '';
        stripped = addSeparatorIfNeeded(stripped, followingChar);
        cursor = match.end;
    }

    return stripped;
}
