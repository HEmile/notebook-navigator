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
import { resolveDeleteAttachmentsSetting } from '../../src/settings/types';

describe('resolveDeleteAttachmentsSetting', () => {
    it('returns valid setting values unchanged', () => {
        expect(resolveDeleteAttachmentsSetting('ask', 'never')).toBe('ask');
        expect(resolveDeleteAttachmentsSetting('always', 'never')).toBe('always');
        expect(resolveDeleteAttachmentsSetting('never', 'ask')).toBe('never');
    });

    it('returns fallback when value is invalid', () => {
        expect(resolveDeleteAttachmentsSetting('invalid', 'ask')).toBe('ask');
        expect(resolveDeleteAttachmentsSetting(undefined, 'always')).toBe('always');
        expect(resolveDeleteAttachmentsSetting(1, 'never')).toBe('never');
    });
});
