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

import { describe, expect, it, vi } from 'vitest';
import { TFolder } from 'obsidian';
import { SelectionAPI } from '../../src/api/modules/SelectionAPI';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';

function createSelectionAPI(): SelectionAPI {
    return new SelectionAPI({
        app: {
            vault: {
                getFolderByPath: () => null,
                getFileByPath: () => null
            }
        },
        getPlugin: () => ({
            settings: structuredClone(DEFAULT_SETTINGS)
        }),
        trigger: vi.fn()
    } as never);
}

describe('SelectionAPI', () => {
    it('adds a type discriminator to NavItem results', () => {
        const selectionAPI = createSelectionAPI();
        const folder = new TFolder();
        folder.path = 'Folder';

        expect(selectionAPI.getNavItem()).toEqual({
            type: 'none',
            folder: null,
            tag: null,
            property: null
        });

        selectionAPI.updateNavigationState(folder, null, null);
        expect(selectionAPI.getNavItem()).toEqual({
            type: 'folder',
            folder,
            tag: null,
            property: null
        });

        selectionAPI.updateNavigationState(null, 'work', null);
        expect(selectionAPI.getNavItem()).toEqual({
            type: 'tag',
            folder: null,
            tag: 'work',
            property: null
        });

        selectionAPI.updateNavigationState(null, null, 'key:status');
        expect(selectionAPI.getNavItem()).toEqual({
            type: 'property',
            folder: null,
            tag: null,
            property: 'key:status'
        });
    });
});
