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
import { hasMetadataNameChanged } from '../../src/storage/indexeddb/fileData';

describe('hasMetadataNameChanged', () => {
    it('treats trimmed-equivalent names as unchanged', () => {
        expect(hasMetadataNameChanged({ name: 'Folder' }, { name: '  Folder  ' })).toBe(false);
    });

    it('treats blank and missing names as unchanged', () => {
        expect(hasMetadataNameChanged({ name: '   ' }, {})).toBe(false);
        expect(hasMetadataNameChanged({ name: '' }, null)).toBe(false);
    });

    it('detects meaningful metadata name changes', () => {
        expect(hasMetadataNameChanged({ name: 'Alpha' }, { name: 'Beta' })).toBe(true);
        expect(hasMetadataNameChanged(null, { name: 'Alpha' })).toBe(true);
    });
});
