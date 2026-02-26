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

import { FrontMatterCache } from 'obsidian';
import { hasExcalidrawFrontmatterFlag, isExcalidrawFileName } from './fileNameUtils';
import { NotebookNavigatorSettings } from '../settings';
import { getRecordValue } from './typeGuards';
import {
    collectVisibleTextSkippingFencedCodeBlocks,
    findFencedCodeBlockRanges,
    findInlineCodeRanges,
    findRangeContainingIndex
} from './codeRangeUtils';
import { NumericRange } from './arrayUtils';

/**
 * Preview text extraction utilities.
 *
 * `extractPreviewText()` produces a single-line preview (max `MAX_PREVIEW_TEXT_LENGTH` chars) from:
 * - the first non-empty frontmatter field in `settings.previewProperties` (if provided), otherwise
 * - the note body with YAML frontmatter removed.
 *
 * The pipeline is designed to be bounded:
 * - the source text is clipped to `PREVIEW_EXTENSION_LIMIT`
 * - the final preview is truncated to `MAX_PREVIEW_TEXT_LENGTH`
 *
 * Content handling:
 * - Inline code spans keep their content (backticks removed).
 * - Fenced code blocks are either removed entirely or included as plain text (fence markers removed).
 * - HTML tags/entities can be stripped/decoded while preserving code spans.
 * - LaTeX inline and block math can be stripped while preserving code spans.
 * - Blockquote `>` markers are removed so quoted headings/lists/tables/links are handled like normal text.
 */

// Maximum number of characters for preview text
const MAX_PREVIEW_TEXT_LENGTH = 500;
// Extra buffer when clipping source content to allow room for code block extraction
const PREVIEW_SOURCE_SLACK = 400;
// Allow limited overrun when extending clips to finish code spans
const PREVIEW_EXTENSION_LIMIT = MAX_PREVIEW_TEXT_LENGTH + PREVIEW_SOURCE_SLACK * 2;
// Maximum number of characters scanned when skipping fenced blocks while collecting visible text
const PREVIEW_CODE_BLOCK_SCAN_LIMIT = PREVIEW_EXTENSION_LIMIT * 50;

// Incremented each call to ensure placeholder strings are globally unique
let placeholderSeed = 0;

/** Generates a placeholder base that is unique across calls in the current process. */
function createPlaceholderBase(label: string): string {
    placeholderSeed += 1;
    return `@@NN_${label}_${Date.now().toString(36)}_${placeholderSeed}@@`;
}

/** Builds a placeholder string by appending the segment index to the base */
function buildPlaceholder(base: string, index: number): string {
    return `${base}_${index}@@`;
}

/** Escapes special regex characters so the string can be used as a literal pattern */
function escapeRegExpLiteral(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface HtmlStripOptions {
    preserveInlineCode?: boolean;
    preserveFencedCode?: boolean;
}

interface CodeRangeContext {
    inlineCodeRanges: NumericRange[];
    fencedCodeRanges: NumericRange[];
}

// Base patterns used in both regex versions
const BASE_PATTERNS = [
    // Group 0: Code blocks - remove entirely
    // Examples: ```javascript\nconst x = 1;\n``` and ~~~\nconst x = 1;\n~~~ → (removed)
    // Known limitation: closing fence must use the same character count as the opening fence.
    // Obsidian's renderer shares this limitation, and lines like "~~~ note" are not parsed as fenced blocks.
    /([`~]{3,})[\s\S]*?\1/.source,
    // Group 1: Obsidian comments - remove entirely (both inline and block)
    // Example: %%comment%% → (removed), %%\nmultiline\n%% → (removed)
    /%%[\s\S]*?%%/.source,
    // Group 2: Inline code - remove backticks but keep text
    // Example: `console.log()` → console.log()
    /`[^`]+`/.source,
    // Group 3: Images and embeds - remove entirely
    // Example: ![alt](image.png) → (removed)
    /!\[.*?\]\([^)]+\)/.source,
    // Group 4: Wiki embeds - remove entirely
    // Example: ![[image.png]] or ![[_resources/Pasted image.png]] → (removed)
    /!\[\[.*?\]\]/.source,
    // Group 5: Tags - remove entirely
    // Example: #tag, #parent/child → (removed)
    // Must be followed by whitespace or end of line to avoid matching things like #1 in issue numbers
    /#[\w\-/]+(?=\s|$)/.source,
    // Group 6: Escape characters
    // Example: \* → *
    /\\([*_~`])/.source,
    // Group 7: Bold italic stars (must come before bold/italic)
    // Example: ***important*** → important
    /\*\*\*((?:(?!\*\*\*).)+)\*\*\*/.source,
    // Group 8: Bold italic underscores (must come before bold/italic)
    // Example: ___important___ → important
    /___((?:(?!___).)+)___/.source,
    // Group 9: Bold italic nested - bold stars with italic underscores
    // Example: **_important_** → important
    /\*\*_((?:(?!_\*\*).)+)_\*\*/.source,
    // Group 10: Bold italic nested - bold underscores with italic stars
    // Example: __*important*__ → important
    /__\*((?:(?!\*__).)+)\*__/.source,
    // Group 11: Bold stars with highlight
    // Example: **==important==** → important
    /\*\*==((?:(?!==\*\*).)+)==\*\*/.source,
    // Group 12: Highlight with bold stars
    // Example: ==**important**== → important
    /==\*\*((?:(?!\*\*==).)+)\*\*==/.source,
    // Group 13: Bold underscores with highlight
    // Example: __==important==__ → important
    /__==((?:(?!==__).)+)==__/.source,
    // Group 14: Highlight with bold underscores
    // Example: ==__important__== → important
    /==__((?:(?!__==).)+)__==/.source,
    // Group 15: Bold stars
    // Example: **bold** → bold
    /\*\*((?:(?!\*\*).)+)\*\*/.source,
    // Group 16: Bold underscores
    // Example: __bold__ → bold
    /__((?:(?!__).)+)__/.source,
    // Group 17: Italic stars (iOS compatible - no lookbehind)
    // Example: *italic* → italic (but not 5*6*7)
    // Captures: [17] = prefix, [18] = content
    /(^|[^*\d])\*([^*\n]+)\*(?![*\d])/.source,
    // Group 18: Italic underscores (iOS compatible - no lookbehind)
    // Example: _italic_ → italic (but not variable_name_here)
    // Captures: [18] = prefix, [19] = content
    /(^|[^_a-zA-Z0-9])_([^_\n]+)_(?![_a-zA-Z0-9])/.source,
    // Group 19: Strikethrough
    // Example: ~~deleted~~ → deleted
    /~~((?:(?!~~).)+)~~/.source,
    // Group 20: Highlight
    // Example: ==highlighted== → highlighted
    /==((?:(?!==).)+)==/.source,
    // Group 21: Links
    // Example: [Google](https://google.com) → Google
    // Note: This only matches complete links that include the closing ')'. If a link is clipped mid-token
    // (e.g. "[Title](very-long-url" at the end of the clipped source), it will not match and the raw
    // characters may remain in the preview. We only special-case a few high-noise tokens in
    // stripTrailingIncompleteEmbeds().
    /\[([^\]]+)\]\([^)]+\)/.source,
    // Group 22: Callout titles (supports [!...] and [!...]+/-)
    // Examples:
    // [!info] Optional title → (removed)
    // [!info]+ Optional title → (removed)
    // [!info]- Optional title → (removed)
    /\[![\w-]+\][+-]?(?:\s+[^\n]*)?/.source,
    // Group 23: List markers - remove marker prefix while keeping text
    // Example: - List item → List item, 1. Item → Item
    /^(?:[-*+]\s+|\d+\.\s+)/.source,
    // Group 24: Heading markers (always strip the # symbols, keep the text)
    // Example: # Title → Title, ## Section → Section
    /^(#+)\s+(.*)$/m.source,
    // Group 25: Markdown tables - matches table rows (lines with pipes)
    // Example: | Header | Another | → (removed)
    // This captures lines that start with optional whitespace, then |, and contain at least one more |
    /^\s*\|.*\|.*$/m.source,
    // Group 26: Inline footnotes
    // Example: text ^[detail] → text
    /\^\[[^\]]*?]/.source,
    // Group 27: Footnote references
    // Example: reference[^1] → reference
    /\[\^[^\]]+]/.source,
    // Group 28: Footnote definitions
    // Example: [^1]: Footnote text → (removed)
    /^\s*\[\^[^\]]+]:.*$/m.source
];

// Regex without heading removal
const REGEX_STRIP_MARKDOWN = new RegExp(BASE_PATTERNS.join('|'), 'gm');

/**
 * Strips blockquote markers at the start of each line.
 *
 * This follows CommonMark's "up to 3 leading spaces" rule and removes multiple nested `>` markers
 * (e.g. `> > text`).
 */
const REGEX_BLOCKQUOTE_MARKERS = /^\s{0,3}(?:>\s*)+/gm;

/**
 * CommonMark "backslash escapes" apply to ASCII punctuation:
 * https://spec.commonmark.org/0.31.2/#backslash-escapes
 *
 * Using explicit ranges avoids brittle escaping rules inside a character class.
 */
const REGEX_MARKDOWN_HARD_ESCAPES = /\\([\u0021-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E])/g;
const REGEX_MARKDOWN_HARD_LINE_BREAK = /\\\r?\n/g;

function protectMarkdownHardEscapes(text: string): { protectedText: string; escapeSegments: string[]; escapeBase: string } {
    if (!text.includes('\\')) {
        return { protectedText: text, escapeSegments: [], escapeBase: '' };
    }

    const escapeBase = createPlaceholderBase('ESC');
    const escapeSegments: string[] = [];

    const protectedText = text.replace(REGEX_MARKDOWN_HARD_ESCAPES, (_match, escapedChar: string) => {
        const placeholder = buildPlaceholder(escapeBase, escapeSegments.length);
        escapeSegments.push(escapedChar);
        return placeholder;
    });

    return { protectedText, escapeSegments, escapeBase };
}

function restoreEscapePlaceholders(text: string, escapeSegments: readonly string[], escapeBase: string): string {
    if (escapeSegments.length === 0) {
        return text;
    }
    const escapePattern = new RegExp(`${escapeRegExpLiteral(escapeBase)}_(\\d+)@@`, 'g');
    return text.replace(escapePattern, (_match, indexString: string) => {
        const index = Number.parseInt(indexString, 10);
        if (Number.isNaN(index) || index < 0 || index >= escapeSegments.length) {
            return '';
        }
        return escapeSegments[index];
    });
}

/** Removes HTML tags from a chunk of text, preserving inner text content */
function stripHtmlFromChunk(chunk: string): string {
    if (!chunk.includes('<')) {
        return chunk;
    }

    let cleaned = chunk;

    // Remove script/style blocks entirely
    cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, ' ');

    // Replace known separators with spaces to avoid word collisions
    cleaned = cleaned.replace(/<br\s*\/?>/gi, ' ');
    cleaned = cleaned.replace(/<hr\s*\/?>/gi, ' ');
    cleaned = cleaned.replace(/<\/(p|div|section|article|header|footer|main|aside|nav|li|ul|ol|blockquote|h[1-6]|tr|td|th|table)>/gi, ' ');

    // Strip remaining tags while keeping text content
    cleaned = cleaned.replace(/<\/?[a-zA-Z][^>]*>/g, ' ');

    return cleaned;
}

/** Returns whether a delimiter at the given index is escaped with an odd number of backslashes */
function isEscapedDelimiter(text: string, index: number): boolean {
    let backslashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
        backslashCount += 1;
    }
    return backslashCount % 2 === 1;
}

/** Inserts a separator when removing a segment between two non-whitespace characters */
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

    let cursor = start;
    cursor += 1;

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

            // Obsidian's inline parser consumes trailing whitespace after `$$` until the first newline.
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

    // Opening fenced-dollar lines only allow optional trailing spaces.
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

/** Finds the next LaTeX segment parsed with Obsidian-compatible delimiter rules. */
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
function stripLatexFromChunk(chunk: string): string {
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

/** Decodes common HTML entities in a text chunk. */
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

/** Normalizes whitespace by splitting on runs and joining with single spaces */
function collapseWhitespace(text: string): string {
    return text.split(/\s+/).filter(Boolean).join(' ').trim();
}

/**
 * Counts how many leading blockquote markers a line starts with.
 *
 * Supports lines like:
 * - `> text` (depth 1)
 * - `> > text` (depth 2)
 * - `>> text` is treated as depth 2
 */
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

/**
 * Removes `depth` leading blockquote markers from a line, preserving the remainder.
 *
 * This only strips the leading prefix and does not attempt to normalize whitespace in the remainder.
 */
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

/**
 * Removes a consistent blockquote prefix from each line of a fenced code block.
 *
 * This is used when a fenced block is inside a blockquote (e.g. `> ```js`).
 * The function only strips when the first line becomes a fence after removing the blockquote prefix.
 */
function stripBlockquotePrefixFromFencedBlock(block: string): string {
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

/**
 * Returns the display text that should appear for a wiki link payload.
 *
 * Input is the raw content inside `[[...]]`. Behavior:
 * - `[[Page]]` → `Page`
 * - `[[Page|Alias]]` → `Alias`
 * - `[[Page|]]` → `Page`
 * - `[[#Heading]]` → `Heading`
 */
function normalizeWikiLinkDisplayText(rawLinkText: string): string {
    const trimmed = rawLinkText.trim();
    if (!trimmed) {
        return '';
    }

    const pipeIndex = trimmed.indexOf('|');
    if (pipeIndex === -1) {
        return trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
    }

    const displayText = trimmed.slice(pipeIndex + 1).trim();
    if (displayText.length > 0) {
        return displayText;
    }

    const fallback = trimmed.slice(0, pipeIndex).trim();
    return fallback.startsWith('#') ? fallback.slice(1) : fallback;
}

/**
 * Removes wiki-embed syntax and replaces wiki-link syntax with display text.
 *
 * This is applied as a post-pass because other markdown patterns can unwrap formatting first and
 * expose `[[...]]` tokens to later steps (e.g. `**[[Page]]**`).
 */
function replaceWikiLinkSyntax(text: string): string {
    if (!text.includes('[[')) {
        return text;
    }

    const withoutEmbeds = text.replace(/!\[\[[^\]\n\r]*?\]\]/g, ' ');
    return withoutEmbeds.replace(/\[\[[^\]\n\r]*?\]\]/g, match => {
        const normalized = normalizeWikiLinkDisplayText(match.slice(2, -2));
        return normalized.length > 0 ? normalized : ' ';
    });
}

/** Strips leading and trailing backticks from an inline code span */
function stripInlineCodeFence(span: string): string {
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

/** Removes YAML frontmatter block from the start of content */
function removeFrontmatter(content: string): string {
    return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/** Removes task checkbox markers and horizontal rule lines while preserving surrounding text. */
function stripTaskCheckboxesAndHorizontalRules(text: string): string {
    const withoutTaskCheckboxes = text.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)?\[(?: |x|X|\/|-)?\]\]?\s*/gm, '');
    return withoutTaskCheckboxes.replace(/^\s*([*_-])(?:\s*\1){2,}\s*$/gm, '');
}

/** Removes Obsidian block identifiers like `^37066f` from preview text while preserving surrounding content. */
function stripObsidianBlockIdentifiers(text: string): string {
    if (!text.includes('^')) {
        return text;
    }

    return text.replace(/(^|[ \t])\^[0-9A-Za-z-]+(?=\s|$)/gm, '$1');
}

/** Replaces inline code spans with their unwrapped content (backticks removed) */
function unwrapInlineCodeSegments(text: string, inlineRanges: readonly NumericRange[]): string {
    if (inlineRanges.length === 0) {
        return text;
    }

    let cursor = 0;
    let result = '';

    inlineRanges.forEach(range => {
        if (range.start > cursor) {
            result += text.slice(cursor, range.start);
        }
        const content = stripInlineCodeFence(text.slice(range.start, range.end));
        result += content;
        cursor = range.end;
    });

    if (cursor < text.length) {
        result += text.slice(cursor);
    }

    return result;
}

/** Merges inline and fenced code ranges into a sorted array with kind annotations */
function combineCodeRanges(context: CodeRangeContext, includeInline: boolean, includeFenced: boolean) {
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

/** Strips HTML tags from text while preserving code segments and remapping their ranges */
function stripHtmlOutsideCode(
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
        transform: stripHtmlFromChunk,
        contextWhenNoRanges: { inlineCodeRanges: [], fencedCodeRanges: [] }
    });
}

/** Strips LaTeX expressions from text while preserving code segments and remapping their ranges */
function stripLatexOutsideCode(
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

/** Clips text and context ranges to the specified length */
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

/**
 * Removes trailing markdown syntax that may be clipped mid-token and leak into previews.
 *
 * This is applied after clipping the source to a max length, so the end of the string may contain
 * incomplete tokens that are no longer removable by the main markdown stripping regex. The primary
 * cases are high-noise constructs that frequently appear at the top of notes:
 * - Wiki embeds: "![[...]]" (clipped as "![[..."), or wiki links: "[[...]]" (clipped as "[[...")
 * - Markdown images: "![alt](url)" (clipped as "![alt](url")
 * - Inline footnotes: "^[...]" and footnote references: "[^...]"
 *
 * Note: This does not handle incomplete markdown links like "[Title](url" because they typically
 * collapse to link text when complete (BASE_PATTERNS group 21). If needed, add a targeted trailing
 * cleanup similar to the embed/link cases above.
 */
function stripTrailingIncompleteEmbeds(result: { text: string; context: CodeRangeContext }): { text: string; context: CodeRangeContext } {
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

/** Clips text to target length, extending to include any code block the boundary falls within */
function clipIncludingCode(
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

/** Decodes HTML entities outside code segments and remaps code ranges. */
function decodeHtmlEntitiesOutsideCode(text: string, context: CodeRangeContext): { text: string; context: CodeRangeContext } {
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

function buildPreviewFromClippedSource(clipped: { text: string; context: CodeRangeContext }, settings: NotebookNavigatorSettings): string {
    if (!clipped.text.trim()) {
        return '';
    }

    const htmlStep = settings.stripHtmlInPreview
        ? stripHtmlOutsideCode(clipped.text, clipped.context, {
              enabled: true,
              preserveFencedCode: true
          })
        : clipped;
    if (!htmlStep.text.trim()) {
        return '';
    }

    const latexStep = settings.stripLatexInPreview ? stripLatexOutsideCode(htmlStep.text, htmlStep.context, { enabled: true }) : htmlStep;
    if (!latexStep.text.trim()) {
        return '';
    }

    const decodedStep = decodeHtmlEntitiesOutsideCode(latexStep.text, latexStep.context);
    if (!decodedStep.text.trim()) {
        return '';
    }

    const cleanedStep = stripTrailingIncompleteEmbeds(decodedStep);
    if (!cleanedStep.text.trim()) {
        return '';
    }

    const stripped = PreviewTextUtils.stripMarkdownSyntax(
        cleanedStep.text,
        settings.skipHeadingsInPreview,
        settings.skipCodeBlocksInPreview,
        cleanedStep.context
    );
    const preview = collapseWhitespace(stripped);
    if (!preview) {
        return '';
    }

    const maxChars = MAX_PREVIEW_TEXT_LENGTH;
    if (preview.length > maxChars) {
        return `${preview.substring(0, maxChars - 1)}…`;
    }
    return preview;
}

/** Replaces code segments with placeholders so markdown stripping does not alter code content */
function buildProtectedText(
    text: string,
    context: CodeRangeContext,
    skipCodeBlocks: boolean
): { protectedText: string; inlineSegments: string[]; fencedSegments: string[]; inlineBase: string; fencedBase: string } {
    const inlineBase = createPlaceholderBase('INLINE');
    const fencedBase = createPlaceholderBase('CODE');
    const inlineSegments: string[] = [];
    const fencedSegments: string[] = [];

    const combined = combineCodeRanges(context, true, true);
    if (combined.length === 0) {
        return { protectedText: text, inlineSegments, fencedSegments, inlineBase, fencedBase };
    }

    let cursor = 0;
    let protectedText = '';

    for (const range of combined) {
        if (range.start > cursor) {
            protectedText += text.slice(cursor, range.start);
        }

        if (range.kind === 'inline') {
            // Inline code placeholders preserve the content while removing the wrapping backticks.
            const content = stripInlineCodeFence(text.slice(range.start, range.end));
            const placeholder = buildPlaceholder(inlineBase, inlineSegments.length);
            inlineSegments.push(content);
            protectedText += placeholder;
        } else {
            if (skipCodeBlocks) {
                // When code blocks are skipped, they are removed entirely from the protected text.
                // Whitespace is adjusted so surrounding words do not merge.
                const hasLeadingSpace = protectedText.length > 0 && !/\s$/.test(protectedText);
                const nextChar = text[range.end] ?? '';
                const needsTrailingSpace = nextChar !== '' && !/\s/.test(nextChar);
                if (hasLeadingSpace && needsTrailingSpace) {
                    protectedText += ' ';
                }
                cursor = range.end;
                continue;
            }
            // When code blocks are included, store the extracted inner content as a placeholder.
            const codeContent = PreviewTextUtils.extractCodeBlockContent(text.slice(range.start, range.end));
            const placeholder = buildPlaceholder(fencedBase, fencedSegments.length);
            fencedSegments.push(codeContent);
            const needsLeadingSpace = protectedText.length > 0 && !/\s$/.test(protectedText);
            if (needsLeadingSpace) {
                protectedText += ' ';
            }
            protectedText += placeholder;
            const nextChar = text[range.end] ?? '';
            if (nextChar !== '' && !/\s/.test(nextChar)) {
                protectedText += ' ';
            }
        }

        cursor = range.end;
    }

    if (cursor < text.length) {
        protectedText += text.slice(cursor);
    }

    return { protectedText, inlineSegments, fencedSegments, inlineBase, fencedBase };
}

/** Replaces placeholder tokens with the original code segment content */
function restorePlaceholders(
    text: string,
    inlineSegments: readonly string[],
    fencedSegments: readonly string[],
    inlineBase: string,
    fencedBase: string
): string {
    let restored = text;

    if (inlineSegments.length > 0) {
        const inlinePattern = new RegExp(`${escapeRegExpLiteral(inlineBase)}_(\\d+)@@`, 'g');
        restored = restored.replace(inlinePattern, (_match, indexString: string) => {
            const index = Number.parseInt(indexString, 10);
            if (Number.isNaN(index) || index < 0 || index >= inlineSegments.length) {
                return '';
            }
            return inlineSegments[index];
        });
    }

    if (fencedSegments.length > 0) {
        const fencedPattern = new RegExp(`${escapeRegExpLiteral(fencedBase)}_(\\d+)@@`, 'g');
        restored = restored.replace(fencedPattern, (_match, indexString: string) => {
            const index = Number.parseInt(indexString, 10);
            if (Number.isNaN(index) || index < 0 || index >= fencedSegments.length) {
                return '';
            }
            return fencedSegments[index];
        });
    }

    return restored;
}

/**
 * Calculates the number of capture groups from regex replacement arguments
 */
function getCaptureLength(args: unknown[]): number {
    if (args.length === 0) {
        return 0;
    }
    const lastArg = args[args.length - 1];
    const hasNamedGroups = typeof lastArg === 'object' && lastArg !== null && !Array.isArray(lastArg);
    const metadataCount = hasNamedGroups ? 3 : 2;
    return Math.max(args.length - metadataCount, 0);
}

/**
 * Extracts a string value from a frontmatter property that could be a string or array
 */
function resolvePreviewPropertyValue(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    if (Array.isArray(value)) {
        for (const entry of value) {
            if (typeof entry !== 'string') {
                continue;
            }
            const trimmed = entry.trim();
            if (trimmed) {
                return trimmed;
            }
        }
    }

    return null;
}

export class PreviewTextUtils {
    /**
     * Checks if a file is an Excalidraw drawing
     * @param fileName The name of the file
     * @param frontmatter Optional frontmatter object to check
     * @returns True if the file is an Excalidraw drawing
     */
    static isExcalidrawFile(fileName: string, frontmatter?: FrontMatterCache): boolean {
        // Check filename pattern
        if (isExcalidrawFileName(fileName)) {
            return true;
        }

        // Check frontmatter for excalidraw-plugin property
        if (hasExcalidrawFrontmatterFlag(frontmatter)) {
            return true;
        }

        return false;
    }

    /**
     * Strips markdown syntax from text to create clean preview text
     * @param text The text to strip markdown from
     * @param skipHeadings Whether to remove headings
     * @param skipCodeBlocks Whether to remove fenced code blocks
     * @returns The text with markdown syntax removed
     */
    static stripMarkdownSyntax(
        text: string,
        skipHeadings: boolean = false,
        skipCodeBlocks: boolean = true,
        codeRangeContext?: CodeRangeContext
    ): string {
        // Code ranges are used to protect code content from the markdown stripping regex.
        // When `skipCodeBlocks` is true, fenced blocks are removed from the protected text.
        const regex = REGEX_STRIP_MARKDOWN;
        const fencedCodeBlocks =
            codeRangeContext && codeRangeContext.fencedCodeRanges.length > 0
                ? codeRangeContext.fencedCodeRanges
                : findFencedCodeBlockRanges(text);
        const inlineCodeRanges =
            codeRangeContext && codeRangeContext.inlineCodeRanges.length > 0
                ? codeRangeContext.inlineCodeRanges
                : findInlineCodeRanges(text, fencedCodeBlocks);
        const context: CodeRangeContext = {
            inlineCodeRanges,
            fencedCodeRanges: fencedCodeBlocks
        };
        const { protectedText, inlineSegments, fencedSegments, inlineBase, fencedBase } = buildProtectedText(text, context, skipCodeBlocks);
        const protectedEscapes = protectMarkdownHardEscapes(protectedText);

        // CommonMark: a backslash followed by a newline is a hard line break escape.
        // Apply after hard-escape protection so escaped backslashes (`\\`) are not treated as hard breaks.
        const withoutHardLineBreakEscapes =
            protectedEscapes.protectedText.includes('\\') && protectedEscapes.protectedText.includes('\n')
                ? protectedEscapes.protectedText.replace(REGEX_MARKDOWN_HARD_LINE_BREAK, '\n')
                : protectedEscapes.protectedText;

        // Remove blockquote markers so quoted markdown is treated the same as unquoted markdown.
        const withoutBlockquoteMarkers = withoutHardLineBreakEscapes.includes('>')
            ? withoutHardLineBreakEscapes.replace(REGEX_BLOCKQUOTE_MARKERS, '')
            : withoutHardLineBreakEscapes;

        const stripped = withoutBlockquoteMarkers.replace(regex, (match, ...rawArgs) => {
            const args: unknown[] = rawArgs;
            const captureLength = getCaptureLength(args);
            const fenceMatch = match.match(/^([`~]{3,})/u);
            if (fenceMatch && match.endsWith(fenceMatch[1])) {
                // Fenced code blocks can reach this point if they were not protected by ranges.
                // Handle them before inline-code handling since fences are also backticks.
                if (skipCodeBlocks) {
                    return '';
                }
                return PreviewTextUtils.extractCodeBlockContent(match);
            }
            // Obsidian comments
            if (match.startsWith('%%') && match.endsWith('%%')) {
                return '';
            }

            // Callout titles
            if (match.match(/\[![\w-]+\]/)) {
                return '';
            }

            // Inline code
            if (match.startsWith('`') && match.endsWith('`')) {
                return match.slice(1, -1);
            }

            // Images and embeds
            if (match.startsWith('!')) {
                return '';
            }

            // Tags
            if (match.match(/#[\w\-/]+(?=\s|$)/)) {
                return '';
            }

            // Footnote inline syntax and references
            const trimmedFootnoteMatch = match.trimStart();
            if (trimmedFootnoteMatch.startsWith('^[') || trimmedFootnoteMatch.startsWith('[^')) {
                return '';
            }

            // Italic with stars - preserve prefix and content
            const italicStarMatch = match.match(/(^|[^*\d])\*([^*\n]+)\*(?![*\d])/);
            if (italicStarMatch) {
                const italicStarContent = italicStarMatch[2];
                if (typeof italicStarContent !== 'string' || !italicStarContent.trim()) {
                    return match;
                }
                const italicStarPrefix = italicStarMatch[1] ?? '';
                return `${italicStarPrefix}${italicStarContent}`;
            }

            // Italic with underscores - preserve prefix and content
            const italicUnderscoreMatch = match.match(/(^|[^_a-zA-Z0-9])_([^_\n]+)_(?![_a-zA-Z0-9])/);
            if (italicUnderscoreMatch) {
                const italicUnderscoreContent = italicUnderscoreMatch[2];
                if (typeof italicUnderscoreContent !== 'string' || !italicUnderscoreContent.trim()) {
                    return match;
                }
                const italicUnderscorePrefix = italicUnderscoreMatch[1] ?? '';
                return `${italicUnderscorePrefix}${italicUnderscoreContent}`;
            }

            // Headings - always strip # symbols
            if (match.match(/^#+\s+/)) {
                // If skipHeadings is true, remove entire heading
                if (skipHeadings) {
                    return '';
                }
                // Otherwise, return just the heading text without # symbols
                const headingText = match.replace(/^#+\s+/, '').trim();
                return headingText;
            }

            // List markers
            if (match.match(/^[-+\d]/) || match.match(/^\*\s+/)) {
                return '';
            }

            // Markdown tables
            if (match.match(/^\s*\|.*\|/)) {
                return '';
            }

            // Find first defined capture group - that's our content to keep
            for (let i = 0; i < captureLength; i++) {
                const capture = args[i];
                if (typeof capture === 'string') {
                    return capture;
                }
            }

            return match;
        });

        // Wiki links can survive the initial pass when other markdown patterns unwrap formatting
        // and return the wrapped content.
        // Example: "**[[Page]]**" matches the bold pattern first, returning "[[Page]]".
        // This post-pass converts any remaining wiki-link tokens before restoring protected code segments.
        const withoutWikiLinkSyntax = replaceWikiLinkSyntax(stripped);

        // Apply post-cleanups before restoring code placeholders so code content is not altered.
        const withoutTasksAndRules = stripTaskCheckboxesAndHorizontalRules(withoutWikiLinkSyntax);

        const withoutBlockIdentifiers = stripObsidianBlockIdentifiers(withoutTasksAndRules);

        const withEscapesRestored = restoreEscapePlaceholders(
            withoutBlockIdentifiers,
            protectedEscapes.escapeSegments,
            protectedEscapes.escapeBase
        );

        return restorePlaceholders(withEscapesRestored, inlineSegments, fencedSegments, inlineBase, fencedBase);
    }

    /**
     * Removes HTML tags outside code blocks (inline and fenced).
     * Preserves tags that are part of code snippets so code samples remain intact unless preservation is disabled.
     */
    static stripHtmlTagsPreservingCode(text: string, options?: HtmlStripOptions): string {
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

    /**
     * Decodes HTML entities outside code blocks (inline and fenced).
     */
    static decodeHtmlEntitiesPreservingCode(text: string, options?: HtmlStripOptions): string {
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

    /**
     * Normalizes excerpts by stripping HTML and collapsing whitespace.
     * Returns undefined when no usable content remains.
     */
    static normalizeExcerpt(excerpt: string, options?: { stripHtml?: boolean }): string | undefined {
        const shouldStripHtml = options?.stripHtml !== false;
        const containsHtml = shouldStripHtml && excerpt.includes('<');
        if (!containsHtml) {
            const inlineOnlyRanges = findInlineCodeRanges(excerpt);
            const decodedInlineResult = decodeHtmlEntitiesOutsideCode(excerpt, {
                inlineCodeRanges: inlineOnlyRanges,
                fencedCodeRanges: []
            });
            const unwrappedInline = unwrapInlineCodeSegments(decodedInlineResult.text, decodedInlineResult.context.inlineCodeRanges);
            const normalizedInline = collapseWhitespace(unwrappedInline);
            return normalizedInline.length > 0 ? normalizedInline : undefined;
        }
        const fenced = findFencedCodeBlockRanges(excerpt);
        const baseContext: CodeRangeContext = {
            inlineCodeRanges: findInlineCodeRanges(excerpt, fenced),
            fencedCodeRanges: fenced
        };
        // Excerpts always get inline-code fences removed and whitespace collapsed; HTML tags are kept only when stripping is disabled.
        const sanitizedResult = shouldStripHtml
            ? stripHtmlOutsideCode(excerpt, baseContext, { enabled: true })
            : { text: excerpt, context: baseContext };
        const decodedResult = decodeHtmlEntitiesOutsideCode(sanitizedResult.text, sanitizedResult.context);
        const unwrapped = unwrapInlineCodeSegments(decodedResult.text, decodedResult.context.inlineCodeRanges);
        const normalized = collapseWhitespace(unwrapped);
        return normalized.length > 0 ? normalized : undefined;
    }

    static extractCodeBlockContent(block: string): string {
        // Code blocks can appear in blockquotes with a leading `>` prefix on each line.
        // Normalize those blocks so fence detection and removal works on the raw fence text.
        const normalizedBlock = stripBlockquotePrefixFromFencedBlock(block);
        // Match opening fence (``` or ~~~) with optional language identifier
        const openingFenceMatch = normalizedBlock.match(/^\s*([`~]{3,})[^\n\r]*\r?\n?/);
        if (!openingFenceMatch) {
            return normalizedBlock;
        }

        // Extract fence character and length for matching closing fence
        const fenceSequence = openingFenceMatch[1];
        const fenceChar = fenceSequence[0] ?? '`';
        const fenceLength = fenceSequence.length;
        // Remove opening fence from block
        const withoutOpeningFence = normalizedBlock.slice(openingFenceMatch[0].length);
        // Build pattern for closing fence (must match character type and be at least same length)
        const closingFencePattern = new RegExp(`\\r?\\n?\\s*${fenceChar}{${fenceLength},}(?:\\s*)$`);
        const withoutClosingFence = withoutOpeningFence.replace(closingFencePattern, '');
        return withoutClosingFence;
    }

    /**
     * Extracts preview text from markdown content
     * Simple one-pass implementation with fixed character limit
     * @param content The full markdown content
     * @param settings The plugin settings
     * @param frontmatter Optional frontmatter object to check for preview properties
     * @returns The preview text (max characters defined by MAX_PREVIEW_TEXT_LENGTH) or empty string
     */
    static extractPreviewText(content: string, settings: NotebookNavigatorSettings, frontmatter?: FrontMatterCache): string {
        const targetLength = MAX_PREVIEW_TEXT_LENGTH + PREVIEW_SOURCE_SLACK;
        const maxExtension = PREVIEW_EXTENSION_LIMIT;

        // Check preview properties first if frontmatter is provided
        if (frontmatter && settings.previewProperties && settings.previewProperties.length > 0) {
            for (const property of settings.previewProperties) {
                const value = getRecordValue(frontmatter, property);
                const propertyValue = resolvePreviewPropertyValue(value);
                if (!propertyValue) {
                    continue;
                }

                const limitedPropertySource = propertyValue.length > maxExtension ? propertyValue.slice(0, maxExtension) : propertyValue;
                const fencedRanges = findFencedCodeBlockRanges(limitedPropertySource);
                const inlineRanges = findInlineCodeRanges(limitedPropertySource, fencedRanges);
                const clippedProperty = clipIncludingCode(
                    limitedPropertySource,
                    { inlineCodeRanges: inlineRanges, fencedCodeRanges: fencedRanges },
                    targetLength,
                    maxExtension
                );
                const preview = buildPreviewFromClippedSource(clippedProperty, settings);
                if (!preview) {
                    continue;
                }
                return preview;
            }
        }

        // Fallback to extracting from content
        if (!content) return '';

        // Remove frontmatter in one shot
        const contentWithoutFrontmatter = removeFrontmatter(content);
        if (!contentWithoutFrontmatter.trim()) return '';

        const clipped = settings.skipCodeBlocksInPreview
            ? (() => {
                  const visibleText = collectVisibleTextSkippingFencedCodeBlocks(
                      contentWithoutFrontmatter,
                      maxExtension,
                      PREVIEW_CODE_BLOCK_SCAN_LIMIT
                  );
                  if (!visibleText) {
                      return { text: '', context: { inlineCodeRanges: [], fencedCodeRanges: [] } };
                  }
                  const inlineRanges = findInlineCodeRanges(visibleText);
                  return clipIncludingCode(
                      visibleText,
                      { inlineCodeRanges: inlineRanges, fencedCodeRanges: [] },
                      targetLength,
                      maxExtension
                  );
              })()
            : (() => {
                  const limitedSource =
                      contentWithoutFrontmatter.length > maxExtension
                          ? contentWithoutFrontmatter.slice(0, maxExtension)
                          : contentWithoutFrontmatter;
                  const fencedRanges = findFencedCodeBlockRanges(limitedSource);
                  const inlineRanges = findInlineCodeRanges(limitedSource, fencedRanges);
                  return clipIncludingCode(
                      limitedSource,
                      { inlineCodeRanges: inlineRanges, fencedCodeRanges: fencedRanges },
                      targetLength,
                      maxExtension
                  );
              })();
        return buildPreviewFromClippedSource(clipped, settings);
    }
}
