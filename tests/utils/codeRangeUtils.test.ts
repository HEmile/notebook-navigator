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
import { describe, expect, it } from 'vitest';
import { findFencedCodeBlockRanges, findInlineCodeRanges, isIndexInRanges } from '../../src/utils/codeRangeUtils';

describe('codeRangeUtils', () => {
    it('finds fenced code blocks and returns exact slices', () => {
        const content = ['Intro', '```js', 'const value = 1;', '```', 'Outro'].join('\n');
        const ranges = findFencedCodeBlockRanges(content);

        expect(ranges).toHaveLength(1);
        const [range] = ranges;
        expect(content.slice(range.start, range.end)).toBe(['```js', 'const value = 1;', '```', ''].join('\n'));
    });

    it('treats unterminated fences as running to the end of the document', () => {
        const content = ['Intro', '```', 'open block'].join('\n');
        const ranges = findFencedCodeBlockRanges(content);

        expect(ranges).toHaveLength(1);
        expect(ranges[0]).toEqual({ start: 'Intro\n'.length, end: content.length });
    });

    it('recognizes CRLF fenced code blocks', () => {
        const content = ['Intro', '```js', 'const value = 1;', '```', 'Outro'].join('\r\n');
        const ranges = findFencedCodeBlockRanges(content);

        expect(ranges).toHaveLength(1);
        const [range] = ranges;
        expect(content.slice(range.start, range.end)).toBe(['```js', 'const value = 1;', '```', ''].join('\r\n'));
    });

    it('ignores inline backticks inside fenced blocks', () => {
        const content = ['Alpha `code` segment', '```js', 'const value = `inline`;', '```', 'Omega'].join('\n');
        const fenced = findFencedCodeBlockRanges(content);
        const inline = findInlineCodeRanges(content, fenced);

        expect(inline).toHaveLength(1);
        expect(content.slice(inline[0].start, inline[0].end)).toBe('`code`');
    });

    it('detects multi-backtick inline spans', () => {
        const content = 'Example ``callout`` test';
        const inline = findInlineCodeRanges(content);

        expect(inline).toHaveLength(1);
        expect(content.slice(inline[0].start, inline[0].end)).toBe('``callout``');
    });

    it('detects index membership within ranges', () => {
        const ranges = [
            { start: 2, end: 5 },
            { start: 10, end: 12 }
        ];

        expect(isIndexInRanges(3, ranges)).toBe(true);
        expect(isIndexInRanges(5, ranges)).toBe(false);
        expect(isIndexInRanges(11, ranges)).toBe(true);
    });
});
