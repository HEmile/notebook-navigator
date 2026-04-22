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
import type { NotebookNavigatorSettings } from '../../src/settings';
import { ItemType } from '../../src/types';
import { buildPropertyKeyNodeId } from '../../src/utils/propertyTree';
import { resolveListGrouping } from '../../src/utils/listGrouping';

type GroupingSettings = Pick<NotebookNavigatorSettings, 'noteGrouping' | 'folderAppearances' | 'tagAppearances' | 'propertyAppearances'>;

function createGroupingSettings(noteGrouping: GroupingSettings['noteGrouping']): GroupingSettings {
    return {
        noteGrouping,
        folderAppearances: {},
        tagAppearances: {},
        propertyAppearances: {}
    };
}

describe('resolveListGrouping property selections', () => {
    it('uses custom property grouping overrides when present', () => {
        const propertyNodeId = buildPropertyKeyNodeId('status');
        const settings = createGroupingSettings('none');
        settings.propertyAppearances = {
            [propertyNodeId]: { groupBy: 'date' }
        };

        const result = resolveListGrouping({
            settings,
            selectionType: ItemType.PROPERTY,
            propertyNodeId
        });

        expect(result.defaultGrouping).toBe('none');
        expect(result.effectiveGrouping).toBe('date');
        expect(result.normalizedOverride).toBe('date');
        expect(result.hasCustomOverride).toBe(true);
    });

    it('normalizes invalid folder grouping overrides for properties', () => {
        const propertyNodeId = buildPropertyKeyNodeId('status');
        const settings = createGroupingSettings('folder');
        settings.propertyAppearances = {
            [propertyNodeId]: { groupBy: 'folder' }
        };

        const result = resolveListGrouping({
            settings,
            selectionType: ItemType.PROPERTY,
            propertyNodeId
        });

        expect(result.defaultGrouping).toBe('date');
        expect(result.effectiveGrouping).toBe('date');
        expect(result.normalizedOverride).toBeUndefined();
        expect(result.hasCustomOverride).toBe(false);
    });

    it('falls back to normalized default grouping when no property override exists', () => {
        const settings = createGroupingSettings('folder');

        const result = resolveListGrouping({
            settings,
            selectionType: ItemType.PROPERTY,
            propertyNodeId: buildPropertyKeyNodeId('status')
        });

        expect(result.defaultGrouping).toBe('date');
        expect(result.effectiveGrouping).toBe('date');
        expect(result.normalizedOverride).toBeUndefined();
        expect(result.hasCustomOverride).toBe(false);
    });
});
