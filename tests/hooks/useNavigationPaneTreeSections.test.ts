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

import React from 'react';
import { App, TFolder, type TAbstractFile } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { NotebookNavigatorSettings } from '../../src/settings/types';
import { ItemType, NavigationPaneItemType } from '../../src/types';
import type { TagTreeNode, PropertyTreeNode } from '../../src/types/storage';
import { createHiddenTagVisibility } from '../../src/utils/tagPrefixMatcher';
import type { NavigationPaneSourceState } from '../../src/hooks/navigationPane/data/useNavigationPaneSourceState';
import {
    useNavigationPaneTreeSections,
    type NavigationPaneTreeSectionsResult
} from '../../src/hooks/navigationPane/data/useNavigationPaneTreeSections';
import { createTestTFile } from '../utils/createTestTFile';

const dbFileDataByPath = new Map<string, { tags: string[] | null }>();

vi.mock('../../src/storage/fileOperations', () => ({
    getDBInstanceOrNull: () => ({
        getFile: (path: string) => {
            const entry = dbFileDataByPath.get(path);
            if (!entry) {
                return null;
            }
            return {
                mtime: 0,
                markdownPipelineMtime: 0,
                tagsMtime: 0,
                metadataMtime: 0,
                fileThumbnailsMtime: 0,
                tags: entry.tags,
                wordCount: null,
                taskTotal: 0,
                taskUnfinished: 0,
                properties: null,
                previewStatus: 'unprocessed',
                featureImage: null,
                featureImageStatus: 'unprocessed',
                featureImageKey: null,
                metadata: null
            };
        },
        forEachFile: () => {
            throw new Error('full database scan should not run for scoped tag rendering');
        }
    })
}));

function createFolder(path: string, children: TAbstractFile[] = []): TFolder {
    const folder = new TFolder();
    Reflect.set(folder, 'path', path);
    Reflect.set(folder, 'name', path.split('/').pop() ?? path);
    Reflect.set(folder, 'children', children);
    return folder;
}

function createTagNode(path: string, displayPath: string): TagTreeNode {
    return {
        name: displayPath.split('/').pop() ?? displayPath,
        path,
        displayPath,
        children: new Map(),
        notesWithTag: new Set()
    };
}

function createSettings(): NotebookNavigatorSettings {
    return {
        ...DEFAULT_SETTINGS,
        showTags: true,
        showAllTagsFolder: false,
        showUntagged: false,
        showProperties: false,
        scopeTagsToCurrentContext: true
    };
}

function createSourceState(visibleTagTree: Map<string, TagTreeNode>): NavigationPaneSourceState {
    const hiddenTagVisibility = createHiddenTagVisibility([], false);

    return {
        effectiveFrontmatterExclusions: [],
        hiddenFolders: [],
        hiddenTags: [],
        hiddenFileProperties: [],
        hiddenFileNames: [],
        hiddenFileTags: [],
        fileVisibility: DEFAULT_SETTINGS.vaultProfiles[0].fileVisibility,
        navigationBannerPath: null,
        folderCountFileNameMatcher: null,
        hiddenFilePropertyMatcher: { hasCriteria: false, matches: () => false },
        rootFolders: [],
        rootLevelFolders: [],
        rootFolderOrderMap: new Map(),
        missingRootFolderPaths: [],
        tagTree: visibleTagTree,
        propertyTree: new Map<string, PropertyTreeNode>(),
        untaggedCount: 0,
        visibleTaggedCount: 2,
        hiddenTagMatcher: hiddenTagVisibility.matcher,
        hiddenMatcherHasRules: false,
        visibleTagTree,
        hasRootPropertyShortcut: false,
        tagComparator: undefined,
        hiddenRootTagNodes: new Map(),
        tagTreeForOrdering: visibleTagTree,
        rootTagOrderMap: new Map(),
        missingRootTagPaths: [],
        propertyKeyComparator: (a, b) => a.name.localeCompare(b.name),
        rootPropertyOrderMap: new Map(),
        missingRootPropertyKeys: [],
        visiblePropertyNavigationKeySet: new Set(),
        metadataDecorationVersion: 0,
        getFolderSortName: folder => folder.name,
        folderExclusionByFolderNote: undefined,
        recentNotesHiddenFileMatcher: () => false,
        fileChangeVersion: 0,
        bumpVaultChangeVersion: () => {}
    };
}

describe('useNavigationPaneTreeSections', () => {
    it('keeps global root tag ordering available while scoped rendering shows only current-context tags', () => {
        dbFileDataByPath.clear();

        const alphaFile = createTestTFile('notes/project/alpha.md');
        dbFileDataByPath.set(alphaFile.path, { tags: ['#alpha'] });

        const folder = createFolder('notes/project', [alphaFile]);
        Reflect.set(alphaFile, 'parent', folder);

        const alphaNode = createTagNode('alpha', 'Alpha');
        const betaNode = createTagNode('beta', 'Beta');
        const visibleTagTree = new Map<string, TagTreeNode>([
            [alphaNode.path, alphaNode],
            [betaNode.path, betaNode]
        ]);

        const app = new App();
        let captured: NavigationPaneTreeSectionsResult | null = null;

        function Harness() {
            captured = useNavigationPaneTreeSections({
                app,
                settings: createSettings(),
                expansionState: {
                    expandedFolders: new Set(),
                    expandedTags: new Set(),
                    expandedProperties: new Set(),
                    expandedVirtualFolders: new Set()
                },
                showHiddenItems: false,
                includeDescendantNotes: true,
                sourceState: createSourceState(visibleTagTree),
                selectionScope: {
                    selectionType: ItemType.FOLDER,
                    selectedFolder: folder
                },
                tagTreeService: null,
                propertyTreeService: null
            });
            return null;
        }

        renderToStaticMarkup(React.createElement(Harness));

        expect(captured).not.toBeNull();
        if (!captured) {
            throw new Error('Expected hook result');
        }
        const result = captured as NavigationPaneTreeSectionsResult;

        const renderTagTreeKeys = Array.from(result.renderTagTree.keys());
        const rootOrderingTagTreeKeys = Array.from(result.rootOrderingTagTree.keys());
        const renderedItemTypes = result.tagItems.map(item => item.type);
        const renderedItemKeys = result.tagItems.map(item => item.key);

        expect(renderTagTreeKeys).toEqual(['alpha']);
        expect(rootOrderingTagTreeKeys).toEqual(['alpha', 'beta']);
        expect(result.resolvedRootTagKeys).toEqual(['alpha', 'beta']);
        expect(renderedItemTypes).toEqual([NavigationPaneItemType.TAG]);
        expect(renderedItemKeys).toEqual(['alpha']);
        expect(result.tagItems[0]?.noteCount).toBeUndefined();
    });
});
