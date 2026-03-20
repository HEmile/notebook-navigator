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
    buildFileNameIconNeedles,
    resolveFileIconId,
    resolveFileNameMatchIconId,
    resolveFileNameMatchIconIdFromNeedles,
    resolveFileTypeIconId,
    resolveFileTypeIconKey
} from '../../src/utils/fileIconUtils';
import { createTestTFile } from './createTestTFile';

describe('resolveFileNameMatchIconId', () => {
    it('returns null for empty basenames', () => {
        const needles = buildFileNameIconNeedles({ meeting: 'LiCalendar' });
        expect(resolveFileNameMatchIconIdFromNeedles('', needles)).toBe(null);
    });

    it('matches case-insensitively and prefers longer needles', () => {
        const iconMap = {
            meet: 'LiCheckCircle',
            meeting: 'LiCalendar',
            invoice: 'LiReceipt'
        };

        const needles = buildFileNameIconNeedles(iconMap);
        expect(resolveFileNameMatchIconIdFromNeedles('Meeting notes', needles)).toBe('calendar');
        expect(resolveFileNameMatchIconIdFromNeedles('Invoice 2025', needles)).toBe('receipt');
        expect(resolveFileNameMatchIconId('Invoice 2025', iconMap)).toBe('receipt');
    });

    it('breaks ties by needle sort order', () => {
        const iconMap = {
            ab: 'custom-pack:icon-ab',
            aa: 'custom-pack:icon-aa'
        };

        const needles = buildFileNameIconNeedles(iconMap);
        expect(resolveFileNameMatchIconIdFromNeedles('aab', needles)).toBe('custom-pack:icon-aa');
    });

    it('ignores empty needles and empty icon IDs', () => {
        const iconMap = {
            meeting: 'LiCalendar',
            '': 'invalid',
            invoice: ''
        };

        const needles = buildFileNameIconNeedles(iconMap);
        expect(resolveFileNameMatchIconIdFromNeedles('Invoice meeting', needles)).toBe('calendar');
    });

    it('supports resolving icons from display names', () => {
        const file = createTestTFile('Plain name.md');
        const settings = {
            showFilenameMatchIcons: true,
            fileNameIconMap: { meeting: 'LiCalendar' },
            showCategoryIcons: false,
            fileTypeIconMap: {}
        };

        expect(resolveFileIconId(file, settings)).toBe(null);
        expect(resolveFileIconId(file, settings, { fileNameForMatch: 'Meeting notes' })).toBe('calendar');
    });

    it('supports needles with trailing spaces', () => {
        const needles = buildFileNameIconNeedles({ 'ai ': 'LiBrain' });
        expect(resolveFileNameMatchIconIdFromNeedles('AI notes', needles)).toBe('brain');
        expect(resolveFileNameMatchIconIdFromNeedles('AInotes', needles)).toBe(null);
    });

    it('matches NFC rule keys against NFD basenames', () => {
        const needles = buildFileNameIconNeedles({ réunion: 'LiCalendar' });
        expect(resolveFileNameMatchIconIdFromNeedles('re\u0301union notes', needles)).toBe('calendar');
    });

    it('matches NFD rule keys against NFC basenames', () => {
        const needles = buildFileNameIconNeedles({ 're\u0301union': 'LiCalendar' });
        expect(resolveFileNameMatchIconIdFromNeedles('réunion notes', needles)).toBe('calendar');
    });
});

describe('resolveFileTypeIconKey', () => {
    it('normalizes file extensions to lowercase', () => {
        const file = createTestTFile('Photo.PNG');
        expect(resolveFileTypeIconKey(file)).toBe('png');
    });

    describe('resolveFileTypeIconId', () => {
        it('returns null for empty keys', () => {
            expect(resolveFileTypeIconId('', { md: 'LiFileText' })).toBe(null);
        });

        it('uses explicit overrides before built-in mappings', () => {
            expect(resolveFileTypeIconId('md', { md: 'LiBookOpen' })).toBe('book-open');
        });

        it('falls back to built-in mappings when no override exists', () => {
            expect(resolveFileTypeIconId('md', {})).toBe('file-text');
            expect(resolveFileTypeIconId('png', {})).toBe('image');
        });

        it('returns null for unknown types without overrides', () => {
            expect(resolveFileTypeIconId('cpp', {})).toBe(null);
        });
    });

    it('returns excalidraw.md for .excalidraw.md filenames', () => {
        const file = createTestTFile('Drawing.excalidraw.md');
        expect(resolveFileTypeIconKey(file)).toBe('excalidraw.md');
    });

    it('returns excalidraw.md when excalidraw frontmatter flag is set', () => {
        const file = createTestTFile('Drawing.md');
        const metadataCacheStub = {
            getFileCache: () => ({ frontmatter: { 'excalidraw-plugin': true } })
        };

        expect(resolveFileTypeIconKey(file, metadataCacheStub)).toBe('excalidraw.md');
    });

    it('ignores false-like excalidraw frontmatter flags', () => {
        const file = createTestTFile('Drawing.md');
        const metadataCacheStub = {
            getFileCache: () => ({ frontmatter: { 'excalidraw-plugin': 'false' } })
        };

        expect(resolveFileTypeIconKey(file, metadataCacheStub)).toBe('md');
    });
});
