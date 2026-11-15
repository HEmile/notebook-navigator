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
import { describe, expect, it, vi } from 'vitest';
import { App } from 'obsidian';
import { ItemType, ListPaneItemType } from '../../src/types';
import type { ListPaneItem } from '../../src/types/virtualization';
import { getListPaneMeasurements } from '../../src/utils/listPaneMeasurements';
import { createHiddenTagVisibility } from '../../src/utils/tagPrefixMatcher';
import type { IndexedDBStorage } from '../../src/storage/IndexedDBStorage';
import { resolveListFileRowHeightInputs, type ListFileRowSizingConfig } from '../../src/hooks/useListPaneScroll';
import { getSelectedTopicPillToHide, getVisibleTopicPills } from '../../src/utils/topicPills';
import { TopicService } from '../../src/services/TopicGraphService';
import type { TopicNode } from '../../src/types/storage';
import { createTestTFile } from '../utils/createTestTFile';

function createConfig(overrides: Partial<ListFileRowSizingConfig> = {}): ListFileRowSizingConfig {
    return {
        heights: getListPaneMeasurements(false),
        titleRows: 1,
        previewRows: 3,
        showDate: true,
        showPreview: false,
        showImage: false,
        compactPaddingTotal: 18,
        isCompactMode: false,
        tagsBaseEnabled: false,
        frontmatterPropertyRowsPossible: false,
        propertyRowsPossible: false,
        showTextCountProperty: false,
        showWordCountProperty: false,
        showCharacterCountProperty: false,
        showFileProperties: false,
        showPropertiesOnSeparateRows: false,
        showFilePropertiesInCompactMode: false,
        characterCountSpaces: 'include',
        showParentFolder: false,
        showTaskProgress: false,
        hideTaskProgressWhenComplete: false,
        selectionType: ItemType.FOLDER,
        includeDescendantNotes: false,
        selectedTagToHide: null,
        selectedPropertyValueNodeIdToHide: null,
        hiddenTagVisibility: createHiddenTagVisibility([], false),
        visiblePropertyKeys: new Set(),
        themeMode: 'light',
        ...overrides
    };
}

function rowInputs(config: ListFileRowSizingConfig) {
    const file = createTestTFile('Notes/Lens.md');
    const item: ListPaneItem = { type: ListPaneItemType.FILE, data: file, key: file.path, hasTags: false };
    return resolveListFileRowHeightInputs({
        app: new App(),
        db: { getFile: vi.fn(() => null) } as unknown as IndexedDBStorage,
        hasPreview: () => false,
        item,
        file,
        config
    });
}

describe('topic pills', () => {
    it('add a tag row to the height estimate only when enabled and the note has visible topics', () => {
        const getFileTopicNames = (path: string) => (path === 'Notes/Lens.md' ? ['Optics'] : []);
        expect(rowInputs(createConfig()).visiblePillRowCount).toBe(0);
        expect(rowInputs(createConfig({ topicPillsEnabled: true, getFileTopicNames })).visiblePillRowCount).toBe(1);
        expect(rowInputs(createConfig({ topicPillsEnabled: false, getFileTopicNames })).visiblePillRowCount).toBe(0);
        expect(
            rowInputs(createConfig({ topicPillsEnabled: true, getFileTopicNames, selectedTopicNameToHide: 'Optics' })).visiblePillRowCount
        ).toBe(0);
    });

    it('hide the selected topic unless selected pills are shown', () => {
        expect(getSelectedTopicPillToHide('topic', 'Science/Optics', false)).toBe('Optics');
        expect(getSelectedTopicPillToHide('topic', 'Science/Optics', true)).toBeNull();
        expect(getSelectedTopicPillToHide('tag', 'Science/Optics', false)).toBeNull();
        expect(getVisibleTopicPills(['Optics', 'Physics'], 'Optics')).toEqual(['Physics']);
    });

    it('come from the topics that list a note directly', () => {
        const node = (name: string, paths: string[], children: TopicNode[] = []): TopicNode => ({
            name,
            parents: new Map(),
            children: new Map(children.map(child => [child.name, child])),
            notesWithTag: new Set(paths)
        });
        const optics = node('Optics', ['Notes/Lens.md']);
        const physics = node('Physics', ['Notes/Lens.md', 'Notes/Force.md'], [optics]);
        const service = new TopicService();
        service.updateTopicGraph(new Map([['Physics', physics]]));

        expect(service.getTopicNamesForFile('Notes/Lens.md')).toEqual(['Optics', 'Physics']);
        expect(service.getTopicNamesForFile('Notes/Force.md')).toEqual(['Physics']);
        expect(service.getTopicNamesForFile('Notes/Other.md')).toEqual([]);
    });
});
