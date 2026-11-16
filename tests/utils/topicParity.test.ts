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
import { TFile } from 'obsidian';
import { shouldShowFileItemParentFolderLine } from '../../src/utils/listPaneMeasurements';
import { partitionPinnedFiles } from '../../src/utils/fileFinder';
import { ItemType, NavigationPaneItemType } from '../../src/types';
import { buildNavigationPathIndexMap, getNavigationIndex } from '../../src/utils/navigationIndex';
import { getNavigationExpansionTargetForItem, toggleNavigationExpansionTarget } from '../../src/utils/navigationExpansion';
import type { ExpansionAction } from '../../src/context/ExpansionContext';
import { TFolder } from 'obsidian';
import { selectionReducer } from '../../src/context/selection/state';
import { SelectionAPI } from '../../src/api/modules/SelectionAPI';
import { getTopicAncestorPaths } from '../../src/utils/topicGraph';
import { STORAGE_KEYS } from '../../src/types';
import { buildTopicSeparatorKey, normalizeNavigationSeparatorKey, parseNavigationSeparatorKey } from '../../src/utils/navigationSeparators';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { SelectionState } from '../../src/context/selection/types';
import type { CombinedNavigationItem } from '../../src/types/virtualization';
import type { TopicNode } from '../../src/types/storage';

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

    it('only show notes pinned in topic context in the pinned group', () => {
        const files = ['a.md', 'b.md', 'c.md'].map(path => new TFile(path));
        const pinnedNotes = {
            'a.md': { folder: true, tag: false, property: false, topic: false },
            'b.md': { folder: false, tag: false, property: false, topic: true },
            'c.md': { folder: false, tag: true, property: false, topic: false }
        };

        const { pinnedFiles, unpinnedFiles } = partitionPinnedFiles(files, pinnedNotes, ItemType.TOPIC);

        expect(pinnedFiles.map(file => file.path)).toEqual(['b.md']);
        expect(unpinnedFiles.map(file => file.path)).toEqual(['a.md', 'c.md']);
    });

    it('index topic rows by their path so they can be scrolled into view', () => {
        const node: TopicNode = { name: 'Physics', parents: new Map(), children: new Map(), notesWithTag: new Set() };
        const items = [{ type: NavigationPaneItemType.TOPIC, data: node, level: 2, key: 'Science/Physics' }] as CombinedNavigationItem[];

        const indexMap = buildNavigationPathIndexMap(items);

        expect(getNavigationIndex(indexMap, ItemType.TOPIC, 'Science/Physics')).toBe(0);
        expect(getNavigationIndex(indexMap, ItemType.FOLDER, 'Science/Physics')).toBeUndefined();
    });

    it('expand and collapse topic rows by path, keeping ancestors when other branches collapse', () => {
        const child: TopicNode = { name: 'Optics', parents: new Map(), children: new Map(), notesWithTag: new Set() };
        const node: TopicNode = { name: 'Physics', parents: new Map(), children: new Map([['Optics', child]]), notesWithTag: new Set() };
        const item = { type: NavigationPaneItemType.TOPIC, data: node, level: 2, key: 'Science/Physics' } as CombinedNavigationItem;
        const options = { showHiddenItems: false, showRootFolder: false };

        const target = getNavigationExpansionTargetForItem(item, options);
        expect(target).toEqual({ type: 'topic', id: 'Science/Physics', hasChildren: true, ancestorIds: ['Science'] });
        if (!target) {
            return;
        }

        const collapsedState = {
            expandedFolders: new Set<string>(),
            expandedTags: new Set<string>(),
            expandedProperties: new Set<string>(),
            expandedVirtualFolders: new Set<string>(),
            expandedTopics: new Set<string>(['Science'])
        };
        const actions: ExpansionAction[] = [];
        expect(toggleNavigationExpansionTarget(target, collapsedState, action => actions.push(action), 'expand')).toBe(true);
        expect(actions).toEqual([{ type: 'TOGGLE_TOPIC_EXPANDED', topicName: 'Science/Physics' }]);

        actions.length = 0;
        toggleNavigationExpansionTarget(target, collapsedState, action => actions.push(action), 'expand', { collapseOtherBranches: true });
        expect(actions).toEqual([{ type: 'SET_EXPANDED_TOPICS', topics: new Set(['Science', 'Science/Physics']) }]);

        const expandedState = { ...collapsedState, expandedTopics: new Set(['Science', 'Science/Physics']) };
        actions.length = 0;
        expect(toggleNavigationExpansionTarget(target, expandedState, action => actions.push(action), 'collapse')).toBe(true);
        expect(actions).toEqual([{ type: 'TOGGLE_TOPIC_EXPANDED', topicName: 'Science/Physics' }]);
    });

    it('are recorded in back/forward history and restored by history index', () => {
        const root = new TFolder();
        root.path = '/';
        const initialState: SelectionState = {
            selectionType: 'folder',
            selectedFolder: root,
            selectedTag: null,
            selectedProperty: null,
            selectedTopicPath: null,
            selectedFiles: new Set<string>(),
            anchorIndex: null,
            lastMovementDirection: null,
            isRevealOperation: false,
            isFolderChangeWithAutoSelect: false,
            isKeyboardNavigation: false,
            isFolderNavigation: false,
            selectedFile: null,
            revealSource: null,
            navigationHistory: [{ type: 'folder', value: '/' }],
            navigationHistoryIndex: 0
        };

        const onTopic = selectionReducer(initialState, { type: 'SET_SELECTED_TOPIC', topicPath: 'Science/Physics' });
        expect(onTopic.navigationHistory).toEqual([
            { type: 'folder', value: '/' },
            { type: 'topic', value: 'Science/Physics' }
        ]);
        expect(onTopic.navigationHistoryIndex).toBe(1);

        const onTag = selectionReducer(onTopic, { type: 'SET_SELECTED_TAG', tag: 'idea' });
        const back = selectionReducer(onTag, { type: 'SET_SELECTED_TOPIC', topicPath: 'Science/Physics', historyIndex: 1 });
        expect(back.selectedTopicPath).toBe('Science/Physics');
        expect(back.navigationHistory).toHaveLength(3);
        expect(back.navigationHistoryIndex).toBe(1);
    });

    it('expose the selected topic to commands without changing the public nav item', () => {
        const selectionAPI = new SelectionAPI({
            app: { vault: { getFolderByPath: () => null, getFileByPath: () => null } },
            getPlugin: () => ({ settings: structuredClone(DEFAULT_SETTINGS) }),
            trigger: () => undefined
        } as never);

        selectionAPI.updateNavigationState(null, null, null);
        selectionAPI.updateTopicNavigationState('Science/Physics');

        expect(selectionAPI.getSelectedTopicPath()).toBe('Science/Physics');
        expect(selectionAPI.getNavItem().type).toBe('none');

        selectionAPI.updateTopicNavigationState(null);
        expect(selectionAPI.getSelectedTopicPath()).toBeNull();
    });

    it('have separator keys by lowercase name that survive normalization', () => {
        expect(buildTopicSeparatorKey(' Machine Learning ')).toBe('topic:machine learning');
        expect(parseNavigationSeparatorKey('topic:machine learning')).toEqual({ type: 'topic', name: 'machine learning' });
        expect(normalizeNavigationSeparatorKey('topic:Machine Learning')).toBe('topic:machine learning');
        expect(parseNavigationSeparatorKey('topic:')).toBeNull();
    });

    it('restore through a stored path whose ancestors are expanded', () => {
        expect(STORAGE_KEYS.selectedTopicKey).toBe('notebook-navigator-selected-topic');
        expect(getTopicAncestorPaths('Science/Physics/Optics')).toEqual(['Science', 'Science/Physics']);
        expect(getTopicAncestorPaths('Science')).toEqual([]);
    });
});
