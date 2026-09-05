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

import { TFolder } from 'obsidian';
import { describe, expect, it } from 'vitest';
import {
    buildNavigationInlineRenameTarget,
    matchNavigationInlineRenameTarget
} from '../../src/components/navigationPane/navigationRenameTarget';
import { NavigationPaneItemType, TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../../src/types';
import type { PropertyTreeNode, TagTreeNode } from '../../src/types/storage';
import type {
    CombinedNavigationItem,
    FolderTreeItem,
    PropertyKeyTreeItem,
    PropertyValueTreeItem,
    TagTreeItem,
    UntaggedItem
} from '../../src/types/virtualization';
import { buildPropertyKeyNodeId, buildPropertyValueNodeId } from '../../src/utils/propertyTree';

const getFolderRenameInitialValue = (folder: TFolder): string => `display:${folder.path}`;

function createFolderItem(path: string): FolderTreeItem {
    return {
        type: NavigationPaneItemType.FOLDER,
        data: new TFolder(path),
        level: 0,
        path,
        key: path
    };
}

function createTagNode(path: string, displayPath: string): TagTreeNode {
    return {
        name: displayPath.split('/').pop() ?? displayPath,
        path,
        displayPath,
        children: new Map(),
        notesWithTag: new Set(['note.md'])
    };
}

function createTagItem(path: string, displayPath: string): TagTreeItem {
    return {
        type: NavigationPaneItemType.TAG,
        data: createTagNode(path, displayPath),
        level: 0,
        path,
        key: path
    };
}

function createUntaggedItem(): UntaggedItem {
    return {
        type: NavigationPaneItemType.UNTAGGED,
        data: createTagNode(UNTAGGED_TAG_ID, UNTAGGED_TAG_ID),
        level: 0,
        key: UNTAGGED_TAG_ID
    };
}

function createPropertyKeyNode(key: string, notes: string[]): PropertyTreeNode {
    return {
        id: buildPropertyKeyNodeId(key),
        kind: 'key',
        key,
        valuePath: null,
        name: key,
        displayPath: key,
        children: new Map(),
        notesWithValue: new Set(notes)
    };
}

function createPropertyValueNode(key: string, valuePath: string): PropertyTreeNode {
    return {
        id: buildPropertyValueNodeId(key, valuePath),
        kind: 'value',
        key,
        valuePath,
        name: valuePath,
        displayPath: `${key}/${valuePath}`,
        children: new Map(),
        notesWithValue: new Set(['note.md'])
    };
}

function createPropertyKeyItem(node: PropertyTreeNode): PropertyKeyTreeItem {
    return {
        type: NavigationPaneItemType.PROPERTY_KEY,
        data: node,
        level: 0,
        key: node.id
    };
}

function createPropertyValueItem(node: PropertyTreeNode): PropertyValueTreeItem {
    return {
        type: NavigationPaneItemType.PROPERTY_VALUE,
        data: node,
        level: 1,
        key: node.id
    };
}

function buildTarget(item: CombinedNavigationItem) {
    return buildNavigationInlineRenameTarget(item, getFolderRenameInitialValue);
}

describe('buildNavigationInlineRenameTarget', () => {
    it('builds a folder target keyed by folder path', () => {
        const item = createFolderItem('projects/alpha');
        expect(buildTarget(item)).toEqual({
            type: 'folder',
            id: 'projects/alpha',
            initialValue: 'display:projects/alpha'
        });
    });

    it('builds a tag target keyed by canonical path with the display leaf as initial value', () => {
        const item = createTagItem('inbox/processing', 'Inbox/Processing');
        expect(buildTarget(item)).toEqual({
            type: 'tag',
            id: 'inbox/processing',
            displayPath: 'Inbox/Processing',
            initialValue: 'Processing'
        });
    });

    it('returns null for the tagged and untagged pseudo tags', () => {
        expect(buildTarget(createTagItem(TAGGED_TAG_ID, TAGGED_TAG_ID))).toBeNull();
        expect(buildTarget(createTagItem(UNTAGGED_TAG_ID, UNTAGGED_TAG_ID))).toBeNull();
    });

    it('builds a property target keyed by node id', () => {
        const node = createPropertyKeyNode('status', ['note.md']);
        expect(buildTarget(createPropertyKeyItem(node))).toEqual({
            type: 'property',
            id: node.id,
            normalizedKey: 'status',
            initialValue: 'status'
        });
    });

    it('returns null for property keys without notes and for value nodes', () => {
        expect(buildTarget(createPropertyKeyItem(createPropertyKeyNode('status', [])))).toBeNull();
        expect(buildTarget(createPropertyKeyItem(createPropertyValueNode('status', 'done')))).toBeNull();
    });
});

describe('matchNavigationInlineRenameTarget', () => {
    it('matches each built target back to the item it was built from and no other', () => {
        const propertyKeyNode = createPropertyKeyNode('status', ['note.md']);
        const buildableItems: CombinedNavigationItem[] = [
            createFolderItem('projects/alpha'),
            createTagItem('inbox/processing', 'Inbox/Processing'),
            createPropertyKeyItem(propertyKeyNode)
        ];
        const otherItems: CombinedNavigationItem[] = [
            createFolderItem('projects/beta'),
            createTagItem('inbox/done', 'Inbox/Done'),
            createPropertyKeyItem(createPropertyKeyNode('priority', ['note.md'])),
            createUntaggedItem()
        ];

        for (const item of buildableItems) {
            const target = buildTarget(item);
            expect(target).not.toBeNull();
            if (!target) {
                continue;
            }
            expect(matchNavigationInlineRenameTarget(item, target)).toBe(target);
            for (const other of [...buildableItems, ...otherItems]) {
                if (other !== item) {
                    expect(matchNavigationInlineRenameTarget(other, target)).toBeNull();
                }
            }
        }
    });

    it('matches a property target on the value item with the same node id', () => {
        const valueNode = createPropertyValueNode('status', 'done');
        const target = { type: 'property' as const, id: valueNode.id, normalizedKey: 'status', initialValue: 'done' };
        expect(matchNavigationInlineRenameTarget(createPropertyValueItem(valueNode), target)).toBe(target);
        expect(matchNavigationInlineRenameTarget(createPropertyValueItem(createPropertyValueNode('status', 'open')), target)).toBeNull();
    });

    it('does not match targets of a different type sharing the same id string', () => {
        const folderItem = createFolderItem('inbox/processing');
        const tagTarget = { type: 'tag' as const, id: 'inbox/processing', displayPath: 'Inbox/Processing', initialValue: 'Processing' };
        expect(matchNavigationInlineRenameTarget(folderItem, tagTarget)).toBeNull();

        const tagItem = createTagItem('inbox/processing', 'Inbox/Processing');
        const folderTarget = { type: 'folder' as const, id: 'inbox/processing', initialValue: 'processing' };
        expect(matchNavigationInlineRenameTarget(tagItem, folderTarget)).toBeNull();
    });
});
