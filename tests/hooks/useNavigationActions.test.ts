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
import { buildCollapsedExpansionState, getCollapseBehaviorScope } from '../../src/hooks/useNavigationActions';
import { PROPERTIES_ROOT_VIRTUAL_FOLDER_ID, SHORTCUTS_VIRTUAL_FOLDER_ID, TAGS_ROOT_VIRTUAL_FOLDER_ID } from '../../src/types';

describe('useNavigationActions helpers', () => {
    it('supports a properties-only collapse scope', () => {
        expect(getCollapseBehaviorScope('properties-only')).toEqual({
            affectFolders: false,
            affectTags: false,
            affectProperties: true
        });
    });

    it('collapses visible root containers to the root rows only', () => {
        const collapsedState = buildCollapsedExpansionState({
            behavior: 'all',
            currentExpandedVirtualFolders: new Set([SHORTCUTS_VIRTUAL_FOLDER_ID])
        });

        expect(collapsedState.folders).toEqual(new Set());
        expect(collapsedState.tags).toEqual(new Set());
        expect(collapsedState.properties).toEqual(new Set());
        expect(collapsedState.virtualFolders).toEqual(new Set([SHORTCUTS_VIRTUAL_FOLDER_ID]));
    });

    it('preserves unrelated virtual folders when collapsing properties only', () => {
        const collapsedState = buildCollapsedExpansionState({
            behavior: 'properties-only',
            currentExpandedVirtualFolders: new Set([SHORTCUTS_VIRTUAL_FOLDER_ID, TAGS_ROOT_VIRTUAL_FOLDER_ID]),
            selectedPropertyKeyNodeId: 'property:key:priority'
        });

        expect(collapsedState.folders).toEqual(new Set());
        expect(collapsedState.tags).toEqual(new Set());
        expect(collapsedState.properties).toEqual(new Set(['property:key:priority']));
        expect(collapsedState.virtualFolders).toEqual(new Set([SHORTCUTS_VIRTUAL_FOLDER_ID, TAGS_ROOT_VIRTUAL_FOLDER_ID]));
    });

    it('reopens visible roots during smart collapse when a selected descendant needs them', () => {
        const collapsedState = buildCollapsedExpansionState({
            behavior: 'all',
            currentExpandedVirtualFolders: new Set([SHORTCUTS_VIRTUAL_FOLDER_ID]),
            selectedFolderParentPaths: ['/'],
            selectedTagParentPaths: ['work'],
            selectedPropertyKeyNodeId: 'property:key:status',
            revealTagsRoot: true,
            revealPropertiesRoot: true
        });

        expect(collapsedState.folders).toEqual(new Set(['/']));
        expect(collapsedState.tags).toEqual(new Set(['work']));
        expect(collapsedState.properties).toEqual(new Set(['property:key:status']));
        expect(collapsedState.virtualFolders).toEqual(
            new Set([SHORTCUTS_VIRTUAL_FOLDER_ID, TAGS_ROOT_VIRTUAL_FOLDER_ID, PROPERTIES_ROOT_VIRTUAL_FOLDER_ID])
        );
    });
});
