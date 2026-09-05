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
import { appendResourcePathVersion } from '../../src/utils/resourcePath';

describe('resource path helpers', () => {
    it('adds an mtime query parameter to local resource paths', () => {
        expect(appendResourcePathVersion('app://local/Images/Drawing.png', 1234)).toBe('app://local/Images/Drawing.png?nn-mtime=1234');
    });

    it('preserves existing query parameters and fragments', () => {
        expect(appendResourcePathVersion('app://local/Images/Drawing.png?existing=1#preview', 5678)).toBe(
            'app://local/Images/Drawing.png?existing=1&nn-mtime=5678#preview'
        );
    });
});
