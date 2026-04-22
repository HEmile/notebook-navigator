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
import { PreviewTextCache } from '../../src/storage/PreviewTextCache';

describe('PreviewTextCache', () => {
    it('evicts least recently used entries by count', () => {
        const cache = new PreviewTextCache(2);

        cache.set('a', 'preview-a');
        cache.set('b', 'preview-b');

        // Touch a so b is least recent.
        expect(cache.get('a')).toBe('preview-a');

        cache.set('c', 'preview-c');

        expect(cache.get('b')).toBeNull();
        expect(cache.get('a')).toBe('preview-a');
        expect(cache.get('c')).toBe('preview-c');
    });

    it('drops entries for empty preview text', () => {
        const cache = new PreviewTextCache(10);

        cache.set('path', 'preview');
        cache.set('path', '');

        expect(cache.get('path')).toBeNull();
        expect(cache.getEntryCount()).toBe(0);
    });
});
