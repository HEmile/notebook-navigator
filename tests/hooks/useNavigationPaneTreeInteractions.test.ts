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
import { App } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import { ItemType } from '../../src/types';
import type { IPropertyTreeProvider } from '../../src/interfaces/IPropertyTreeProvider';
import type { PropertyTreeNode } from '../../src/types/storage';
import type { SelectionState } from '../../src/context/SelectionContext';
import {
    useNavigationPaneTreeInteractions,
    type NavigationPaneTreeInteractionsResult
} from '../../src/hooks/navigationPane/useNavigationPaneTreeInteractions';
import { buildPropertyKeyNodeId, buildPropertyValueNodeId } from '../../src/utils/propertyTree';

function createPropertyValueNode(key: string, valuePath: string, name: string, notes: string[]): PropertyTreeNode {
    return {
        id: buildPropertyValueNodeId(key, valuePath),
        kind: 'value',
        key,
        valuePath,
        name,
        displayPath: name,
        children: new Map(),
        notesWithValue: new Set(notes)
    };
}

function createPropertyKeyNode(key: string, name: string, notes: string[], values: PropertyTreeNode[] = []): PropertyTreeNode {
    const node: PropertyTreeNode = {
        id: buildPropertyKeyNodeId(key),
        kind: 'key',
        key,
        valuePath: null,
        name,
        displayPath: name,
        children: new Map(),
        notesWithValue: new Set(notes)
    };

    values.forEach(valueNode => {
        node.children.set(valueNode.id, valueNode);
    });

    return node;
}

function createSelectionState(): SelectionState {
    return {
        selectionType: ItemType.FOLDER,
        selectedFolder: null,
        selectedTag: null,
        selectedProperty: null,
        selectedFiles: new Set(),
        anchorIndex: null,
        lastMovementDirection: null,
        isRevealOperation: false,
        isFolderChangeWithAutoSelect: false,
        isKeyboardNavigation: false,
        isFolderNavigation: false,
        selectedFile: null,
        revealSource: null,
        navigationHistory: [],
        navigationHistoryIndex: -1
    };
}

describe('useNavigationPaneTreeInteractions', () => {
    it('uses the property tree provider cache for global descendant expansion', () => {
        const childNode = createPropertyValueNode('status', 'open', 'Open', ['notes/a.md']);
        const keyNode = createPropertyKeyNode('status', 'Status', ['notes/a.md'], []);
        const propertyTree = new Map<string, PropertyTreeNode>([[keyNode.key, keyNode]]);
        const collectDescendantNodeIds = vi.fn(() => new Set([childNode.id]));

        const propertyTreeProvider: IPropertyTreeProvider = {
            hasNodes: () => true,
            addTreeUpdateListener: () => () => {},
            findNode: nodeId => (nodeId === keyNode.id ? keyNode : null),
            getKeyNode: normalizedKey => (normalizedKey === keyNode.key ? keyNode : null),
            resolveSelectionNodeId: nodeId => nodeId,
            collectDescendantNodeIds,
            collectFilePaths: () => new Set(),
            collectFilesForKeys: () => new Set()
        };

        let captured: NavigationPaneTreeInteractionsResult | null = null;

        function Harness() {
            captured = useNavigationPaneTreeInteractions({
                app: new App(),
                commandQueue: null,
                isMobile: false,
                settings: DEFAULT_SETTINGS,
                uiState: { singlePane: false },
                expansionState: {
                    expandedFolders: new Set(),
                    expandedTags: new Set(),
                    expandedProperties: new Set(),
                    expandedVirtualFolders: new Set()
                },
                expansionDispatch: vi.fn(),
                selectionState: createSelectionState(),
                selectionDispatch: vi.fn(),
                uiDispatch: vi.fn(),
                propertyTreeService: propertyTreeProvider,
                tagTree: new Map(),
                propertyTree,
                tagsVirtualFolderHasChildren: false,
                setShortcutsExpanded: vi.fn(),
                setRecentNotesExpanded: vi.fn(),
                clearActiveShortcut: vi.fn(),
                onModifySearchWithTag: vi.fn(),
                onModifySearchWithProperty: vi.fn()
            });
            return null;
        }

        renderToStaticMarkup(React.createElement(Harness));

        expect(captured).not.toBeNull();
        if (!captured) {
            throw new Error('Expected hook result');
        }
        const result = captured as NavigationPaneTreeInteractionsResult;

        expect(result.getAllDescendantPropertyNodeIds(keyNode)).toEqual([childNode.id]);
        expect(collectDescendantNodeIds).toHaveBeenCalledWith(keyNode.id);
    });
});
