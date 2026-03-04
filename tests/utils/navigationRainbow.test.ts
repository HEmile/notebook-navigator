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
import { TFolder } from 'obsidian';
import { NavigationPaneItemType } from '../../src/types';
import type { CombinedNavigationItem } from '../../src/types/virtualization';
import type { PropertyTreeNode, TagTreeNode } from '../../src/types/storage';
import { buildRainbowPalette, parseCssColor } from '../../src/utils/colorUtils';
import {
    applyRainbowOverlay,
    buildFolderRainbowColors,
    buildPropertyRainbowColors,
    buildTagRainbowColors
} from '../../src/utils/navigationRainbow';

function createTestTFolder(path: string): TFolder {
    const folder = new TFolder();
    folder.path = path;
    folder.name = path === '/' ? '/' : (path.split('/').pop() ?? path);
    return folder;
}

function createTagNode(path: string): TagTreeNode {
    const name = path.split('/').pop() ?? path;
    return {
        name,
        path,
        displayPath: path,
        children: new Map(),
        notesWithTag: new Set()
    };
}

function createTagItem(path: string, level: number): CombinedNavigationItem {
    return {
        type: NavigationPaneItemType.TAG,
        data: createTagNode(path),
        level,
        key: path
    };
}

function createPropertyNode(params: {
    id: `key:${string}` | `key:${string}=${string}`;
    kind: 'key' | 'value';
    key: string;
    valuePath: string | null;
    name: string;
}): PropertyTreeNode {
    return {
        id: params.id,
        kind: params.kind,
        key: params.key,
        valuePath: params.valuePath,
        name: params.name,
        displayPath: params.name,
        children: new Map(),
        notesWithValue: new Set()
    };
}

function createPropertyKeyItem(id: `key:${string}`, key: string, level: number): CombinedNavigationItem {
    return {
        type: NavigationPaneItemType.PROPERTY_KEY,
        data: createPropertyNode({
            id,
            kind: 'key',
            key,
            valuePath: null,
            name: key
        }),
        level,
        key: id
    };
}

function createPropertyValueItem(id: `key:${string}=${string}`, key: string, valuePath: string, level: number): CombinedNavigationItem {
    return {
        type: NavigationPaneItemType.PROPERTY_VALUE,
        data: createPropertyNode({
            id,
            kind: 'value',
            key,
            valuePath,
            name: valuePath
        }),
        level,
        key: id
    };
}

describe('navigationRainbow', () => {
    it('colors the root folder when folder scope is all', () => {
        const start = parseCssColor('#000000') ?? { r: 0, g: 0, b: 0, a: 1 };
        const end = parseCssColor('#ffffff') ?? { r: 255, g: 255, b: 255, a: 1 };
        const palette = buildRainbowPalette({ steps: 1024, start, end, style: 'rgb' });

        const items: CombinedNavigationItem[] = [
            {
                type: NavigationPaneItemType.FOLDER,
                data: createTestTFolder('/'),
                level: 0,
                path: '/',
                key: '/',
                isExcluded: false
            },
            {
                type: NavigationPaneItemType.FOLDER,
                data: createTestTFolder('A'),
                level: 1,
                path: 'A',
                key: 'A',
                isExcluded: false
            },
            {
                type: NavigationPaneItemType.FOLDER,
                data: createTestTFolder('B'),
                level: 1,
                path: 'B',
                key: 'B',
                isExcluded: false
            }
        ];

        const folderRainbow = buildFolderRainbowColors({
            items,
            palette,
            scope: 'all',
            showRootFolder: true,
            rootLevel: 1,
            inheritColors: false
        });

        expect(folderRainbow.rootColor).toBe(palette[0]);
        expect(folderRainbow.colorsByPath.get('A')).toBe(palette[0]);
        expect(folderRainbow.colorsByPath.get('B')).toBe(palette[palette.length - 1]);

        const applied = applyRainbowOverlay({
            mode: 'foreground',
            rainbowColor: folderRainbow.rootColor,
            color: undefined,
            backgroundColor: undefined
        });

        expect(applied.color).toBe(palette[0]);
    });

    it('does not overwrite existing colors', () => {
        const applied = applyRainbowOverlay({
            mode: 'foreground',
            rainbowColor: 'rgba(1, 2, 3, 1)',
            color: 'rgb(10, 10, 10)',
            backgroundColor: undefined
        });

        expect(applied.color).toBe('rgb(10, 10, 10)');
        expect(applied.backgroundColor).toBeUndefined();
    });

    it('keeps tag root colors aligned between root and all scopes when virtual root is shown', () => {
        const start = parseCssColor('#000000') ?? { r: 0, g: 0, b: 0, a: 1 };
        const end = parseCssColor('#ffffff') ?? { r: 255, g: 255, b: 255, a: 1 };
        const palette = buildRainbowPalette({ steps: 1024, start, end, style: 'rgb' });

        const items: CombinedNavigationItem[] = [createTagItem('alpha', 1), createTagItem('beta', 1), createTagItem('alpha/child', 2)];

        const rootScope = buildTagRainbowColors({
            items,
            palette,
            scope: 'root',
            rootLevel: 1,
            showAllTagsFolder: true,
            inheritColors: false
        });
        const allScope = buildTagRainbowColors({
            items,
            palette,
            scope: 'all',
            rootLevel: 1,
            showAllTagsFolder: true,
            inheritColors: false
        });

        expect(rootScope.rootColor).toBe(palette[0]);
        expect(allScope.rootColor).toBe(palette[0]);
        expect(rootScope.colorsByPath.get('alpha')).toBe(allScope.colorsByPath.get('alpha'));
        expect(rootScope.colorsByPath.get('beta')).toBe(allScope.colorsByPath.get('beta'));
    });

    it('keeps property root colors aligned between root and all scopes when virtual root is shown', () => {
        const start = parseCssColor('#000000') ?? { r: 0, g: 0, b: 0, a: 1 };
        const end = parseCssColor('#ffffff') ?? { r: 255, g: 255, b: 255, a: 1 };
        const palette = buildRainbowPalette({ steps: 1024, start, end, style: 'rgb' });

        const items: CombinedNavigationItem[] = [
            createPropertyKeyItem('key:status', 'status', 1),
            createPropertyKeyItem('key:type', 'type', 1),
            createPropertyValueItem('key:status=todo', 'status', 'todo', 2)
        ];

        const rootScope = buildPropertyRainbowColors({
            items,
            palette,
            scope: 'root',
            showAllPropertiesFolder: true
        });
        const allScope = buildPropertyRainbowColors({
            items,
            palette,
            scope: 'all',
            showAllPropertiesFolder: true
        });

        expect(rootScope.rootColor).toBe(palette[0]);
        expect(allScope.rootColor).toBe(palette[0]);
        expect(rootScope.colorsByNodeId.get('key:status')).toBe(allScope.colorsByNodeId.get('key:status'));
        expect(rootScope.colorsByNodeId.get('key:type')).toBe(allScope.colorsByNodeId.get('key:type'));
    });
});
