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
import {
    createOmnisearchHighlightQueryTokenContext,
    extractOmnisearchQueryTokens,
    sanitizeOmnisearchHighlightTokens
} from '../../src/utils/omnisearchHighlight';
import type { SearchResultMatch } from '../../src/types/search';

describe('extractOmnisearchQueryTokens', () => {
    it('normalizes query tokens and removes path/ext filters', () => {
        const tokens = extractOmnisearchQueryTokens('  Sanneblad   path:"Projects/Alpha"   ext:md  -#Tag  ');
        expect(tokens).toEqual(['sanneblad', '#tag']);
    });

    it('keeps quoted phrases and their words while excluding path/ext filters', () => {
        const tokens = extractOmnisearchQueryTokens('  "Sanneblad Archive" path:"Projects/Alpha" -path:Archive ext:md -ext:pdf notes ');
        expect(tokens).toEqual(['sanneblad archive', 'sanneblad', 'archive', 'notes']);
    });

    it('returns no content tokens for path/ext-only queries', () => {
        const tokens = extractOmnisearchQueryTokens('path:"Projects/Alpha" -path:Archive ext:md -ext:pdf');
        expect(tokens).toEqual([]);
    });

    it('drops tokens without letters or numbers', () => {
        const tokens = extractOmnisearchQueryTokens(' // ... ### ');
        expect(tokens).toEqual([]);
    });
});

describe('sanitizeOmnisearchHighlightTokens', () => {
    const buildMatch = (text: string, offset: number): SearchResultMatch => ({
        text,
        offset,
        length: text.length
    });
    const contextFor = (query: string) => createOmnisearchHighlightQueryTokenContext(query);

    it('filters punctuation-only and unrelated short tokens', () => {
        const matches = [buildMatch('Sanneblad', 10), buildMatch('//', 22), buildMatch('o', 31), buildMatch('oo', 40)];
        const terms = ['sanneblad', '//', 'o', 'oo', 'workspace'];

        const result = sanitizeOmnisearchHighlightTokens(matches, terms, contextFor('sanneblad'));

        expect(result.matches).toEqual([buildMatch('Sanneblad', 10)]);
        expect(result.terms).toEqual([]);
    });

    it('keeps query-related terms when matches do not include them', () => {
        const matches: SearchResultMatch[] = [];
        const terms = ['Sanneblad', 's'];

        const result = sanitizeOmnisearchHighlightTokens(matches, terms, contextFor('sanneblad'));

        expect(result.matches).toEqual([]);
        expect(result.terms).toEqual(['Sanneblad']);
    });

    it('keeps single-character tokens only when query token is exactly that character', () => {
        const matches = [buildMatch('c', 0), buildMatch('/', 1)];
        const terms = ['c', '/'];

        const result = sanitizeOmnisearchHighlightTokens(matches, terms, contextFor('c'));

        expect(result.matches).toEqual([buildMatch('c', 0)]);
        expect(result.terms).toEqual([]);
    });

    it('keeps quoted query matches and drops path-only noise', () => {
        const matches = [buildMatch('Sanneblad', 0), buildMatch('//', 8)];
        const terms = ['Sanneblad', 'Archive', 'x'];

        const result = sanitizeOmnisearchHighlightTokens(matches, terms, contextFor('"Sanneblad Archive" path:"Projects/Alpha"'));

        expect(result.matches).toEqual([buildMatch('Sanneblad', 0)]);
        expect(result.terms).toEqual(['Archive']);
    });

    it('drops all highlight tokens when query only contains path filters', () => {
        const matches = [buildMatch('Sanneblad', 0)];
        const terms = ['Sanneblad'];

        const result = sanitizeOmnisearchHighlightTokens(matches, terms, contextFor('path:"Projects/Alpha"'));

        expect(result.matches).toEqual([]);
        expect(result.terms).toEqual([]);
    });

    it('drops all highlight tokens when query only contains ext filters', () => {
        const matches = [buildMatch('Sanneblad', 0)];
        const terms = ['Sanneblad'];

        const result = sanitizeOmnisearchHighlightTokens(matches, terms, contextFor('ext:md -ext:pdf'));

        expect(result.matches).toEqual([]);
        expect(result.terms).toEqual([]);
    });

    it('keeps diacritic-insensitive matches', () => {
        const matches = [buildMatch('café', 0)];
        const terms = ['cafe', 'café'];

        const result = sanitizeOmnisearchHighlightTokens(matches, terms, contextFor('cafe'));

        expect(result.matches).toEqual([buildMatch('café', 0)]);
        expect(result.terms).toEqual([]);
    });

    it('keeps CJK single-character tokens for multi-character queries', () => {
        const matches = [buildMatch('東', 0), buildMatch('京', 1)];
        const terms = ['東', '京'];

        const result = sanitizeOmnisearchHighlightTokens(matches, terms, contextFor('東京'));

        expect(result.matches).toEqual([buildMatch('東', 0), buildMatch('京', 1)]);
        expect(result.terms).toEqual([]);
    });

    it('drops non-prefix substring matches', () => {
        const matches = [buildMatch('anne', 0), buildMatch('san', 5)];
        const terms = ['anne', 'san'];

        const result = sanitizeOmnisearchHighlightTokens(matches, terms, contextFor('sanneblad'));

        expect(result.matches).toEqual([buildMatch('san', 5)]);
        expect(result.terms).toEqual([]);
    });
});
