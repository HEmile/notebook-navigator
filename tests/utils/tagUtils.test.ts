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
import { describe, it, expect } from 'vitest';
import {
    determineTagToReveal,
    extractFileTagsFromRawTags,
    hasValidTagCharacters,
    isInlineTagValueCompatible,
    isValidTagPrecedingChar
} from '../../src/utils/tagUtils';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { TAGGED_TAG_ID } from '../../src/types';
import { createDefaultFileData, type FileData } from '../../src/storage/IndexedDBStorage';
import { createTestTFile } from './createTestTFile';

function createTagRevealStorage(filePath: string, tags: string[] | null): { getFile(path: string): FileData | null } {
    const fileData = createDefaultFileData({ mtime: 0, path: filePath });
    fileData.tags = tags;

    return {
        getFile(path: string): FileData | null {
            if (path === filePath) {
                return fileData;
            }
            return null;
        }
    };
}

describe('tagUtils', () => {
    describe('hasValidTagCharacters', () => {
        it('should return true for valid tags', () => {
            expect(hasValidTagCharacters('valid-tag')).toBe(true);
            expect(hasValidTagCharacters('valid_tag')).toBe(true);
            expect(hasValidTagCharacters('valid/tag')).toBe(true);
            expect(hasValidTagCharacters('123')).toBe(true);
            expect(hasValidTagCharacters('ümlaut')).toBe(true);
            expect(hasValidTagCharacters('tag😀')).toBe(true);
            expect(hasValidTagCharacters('my‼tag')).toBe(true);
            expect(hasValidTagCharacters('my👩‍💻tag')).toBe(true);
            expect(hasValidTagCharacters('🇺🇸tag')).toBe(true);
            expect(hasValidTagCharacters('a\u0301')).toBe(true);
        });

        it('should return false for invalid tags', () => {
            expect(hasValidTagCharacters('invalid tag')).toBe(false);
            expect(hasValidTagCharacters('invalid#tag')).toBe(false);
            expect(hasValidTagCharacters('invalid!')).toBe(false);
            expect(hasValidTagCharacters('my tag')).toBe(false);
            expect(hasValidTagCharacters('/leading')).toBe(false);
            expect(hasValidTagCharacters('trailing/')).toBe(false);
            expect(hasValidTagCharacters('double//slash')).toBe(false);
            expect(hasValidTagCharacters('\u200D')).toBe(false);
            expect(hasValidTagCharacters('\uFE0E')).toBe(false);
            expect(hasValidTagCharacters('\uFE0F')).toBe(false);
            expect(hasValidTagCharacters('\u0301')).toBe(false);
            expect(hasValidTagCharacters('\u200D\u0301')).toBe(false);
            expect(hasValidTagCharacters('')).toBe(false);
            expect(hasValidTagCharacters(null)).toBe(false);
            expect(hasValidTagCharacters(undefined)).toBe(false);
        });
    });

    describe('isInlineTagValueCompatible', () => {
        it('should return true for inline-compatible tags', () => {
            expect(isInlineTagValueCompatible('project')).toBe(true);
            expect(isInlineTagValueCompatible('project/sub')).toBe(true);
            expect(isInlineTagValueCompatible('project😀')).toBe(true);
        });

        it('should return false for values that break inline parsing', () => {
            expect(isInlineTagValueCompatible('my‼tag')).toBe(false);
            expect(isInlineTagValueCompatible('my👩‍💻tag')).toBe(false);
            expect(isInlineTagValueCompatible('my #tag')).toBe(false);
        });
    });

    describe('isValidTagPrecedingChar', () => {
        it('should return true for whitespace', () => {
            expect(isValidTagPrecedingChar(' ')).toBe(true);
            expect(isValidTagPrecedingChar('\t')).toBe(true);
            expect(isValidTagPrecedingChar('\n')).toBe(true);
        });

        it('should return false for punctuation', () => {
            expect(isValidTagPrecedingChar('!')).toBe(false);
            expect(isValidTagPrecedingChar('/')).toBe(false);
        });

        it('should return true for null/undefined (start of string)', () => {
            expect(isValidTagPrecedingChar(null)).toBe(true);
            expect(isValidTagPrecedingChar(undefined)).toBe(true);
        });

        it('should return false for other characters', () => {
            expect(isValidTagPrecedingChar('a')).toBe(false);
            expect(isValidTagPrecedingChar('1')).toBe(false);
            expect(isValidTagPrecedingChar('-')).toBe(false);
            expect(isValidTagPrecedingChar('.')).toBe(false);
        });
    });

    describe('determineTagToReveal', () => {
        it('keeps parent tag in shortest-path mode with descendant notes enabled', () => {
            const file = createTestTFile('projects/work.md');
            const storage = createTagRevealStorage(file.path, ['project/task']);

            const result = determineTagToReveal(file, 'project', DEFAULT_SETTINGS, storage, true, true);
            expect(result).toBe('project');
        });

        it('selects the exact tag when shortest-path mode is disabled', () => {
            const file = createTestTFile('projects/work.md');
            const storage = createTagRevealStorage(file.path, ['project/task']);

            const result = determineTagToReveal(file, 'project', DEFAULT_SETTINGS, storage, true, false);
            expect(result).toBe('project/task');
        });

        it('keeps tagged root in shortest-path mode and selects exact tag when disabled', () => {
            const file = createTestTFile('projects/work.md');
            const storage = createTagRevealStorage(file.path, ['project/task']);

            const shortestPathResult = determineTagToReveal(file, TAGGED_TAG_ID, DEFAULT_SETTINGS, storage, true, true);
            const exactPathResult = determineTagToReveal(file, TAGGED_TAG_ID, DEFAULT_SETTINGS, storage, true, false);

            expect(shortestPathResult).toBe(TAGGED_TAG_ID);
            expect(exactPathResult).toBe('project/task');
        });
    });

    describe('extractFileTagsFromRawTags', () => {
        it('deduplicates NFC and NFD-equivalent tags while keeping the first occurrence', () => {
            const tags = extractFileTagsFromRawTags(['#réunion', '#re\u0301union', '#RÉUNION']);

            expect(tags).toEqual(['réunion']);
        });
    });
});
