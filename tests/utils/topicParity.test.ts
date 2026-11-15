/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2026 Emile van Krieken
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
/*
 * Small checks that topics behave like tags in shared folder/tag/property code paths
 */

import { describe, expect, it } from 'vitest';
import { shouldShowFileItemParentFolderLine } from '../../src/utils/listPaneMeasurements';

describe('topic lists', () => {
    it('show the parent folder line like tag lists', () => {
        const base = {
            showParentFolder: true,
            isPinned: false,
            includeDescendantNotes: false,
            parentFolder: null,
            fileParentPath: 'Projects/Lenses'
        };
        expect(shouldShowFileItemParentFolderLine({ ...base, selectionType: 'topic' })).toBe(true);
        expect(shouldShowFileItemParentFolderLine({ ...base, selectionType: 'tag' })).toBe(true);
        expect(shouldShowFileItemParentFolderLine({ ...base, selectionType: 'topic', isPinned: true })).toBe(false);
        expect(shouldShowFileItemParentFolderLine({ ...base, selectionType: 'topic', fileParentPath: '/' })).toBe(false);
    });
});
