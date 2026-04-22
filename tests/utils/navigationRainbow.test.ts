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
    buildFolderRainbowColorsFromSiblingPaths,
    buildNavigationRainbowPalettes,
    buildFolderRainbowColors,
    buildPropertyRainbowColors,
    buildTagRainbowColors,
    resolveFolderRainbowColor,
    resolveFolderRainbowDecorationColors
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

function createFolderItem(path: string, level: number): CombinedNavigationItem {
    return {
        type: NavigationPaneItemType.FOLDER,
        data: createTestTFolder(path),
        level,
        path,
        key: path,
        isExcluded: false
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

    it('inherits folder rainbow color from nearest root-scoped ancestor', () => {
        const start = parseCssColor('#000000') ?? { r: 0, g: 0, b: 0, a: 1 };
        const end = parseCssColor('#ffffff') ?? { r: 255, g: 255, b: 255, a: 1 };
        const palette = buildRainbowPalette({ steps: 1024, start, end, style: 'rgb' });

        const items: CombinedNavigationItem[] = [
            createFolderItem('/', 0),
            createFolderItem('A', 1),
            createFolderItem('B', 1),
            createFolderItem('A/child', 2),
            createFolderItem('A/child/grandchild', 3)
        ];

        const folderRainbow = buildFolderRainbowColors({
            items,
            palette,
            scope: 'root',
            showRootFolder: true,
            rootLevel: 1,
            inheritColors: true
        });

        const parentColor = folderRainbow.colorsByPath.get('A');
        expect(parentColor).toBeDefined();
        expect(folderRainbow.getInheritedColor('A/child')).toBe(parentColor);
        expect(folderRainbow.getInheritedColor('A/child/grandchild')).toBe(parentColor);
    });

    it('builds precomputed folder rainbow colors from sibling paths', () => {
        const start = parseCssColor('#000000') ?? { r: 0, g: 0, b: 0, a: 1 };
        const end = parseCssColor('#ffffff') ?? { r: 255, g: 255, b: 255, a: 1 };
        const palette = buildRainbowPalette({ steps: 1024, start, end, style: 'rgb' });

        const folderRainbow = buildFolderRainbowColorsFromSiblingPaths({
            siblingPathsByParent: new Map<string, readonly string[]>([
                ['/', ['A', 'B']],
                ['A', ['A/child']]
            ]),
            palette,
            scope: 'root',
            showRootFolder: true,
            inheritColors: true
        });

        expect(resolveFolderRainbowColor({ folderPath: 'A', scope: 'root', showRootFolder: true, colors: folderRainbow })).toBeDefined();
        expect(resolveFolderRainbowColor({ folderPath: 'A/child', scope: 'root', showRootFolder: true, colors: folderRainbow })).toBe(
            resolveFolderRainbowColor({ folderPath: 'A', scope: 'root', showRootFolder: true, colors: folderRainbow })
        );
    });

    it('keeps direct folder colors when rainbow foreground mode is active', () => {
        const start = parseCssColor('#000000') ?? { r: 0, g: 0, b: 0, a: 1 };
        const end = parseCssColor('#ffffff') ?? { r: 255, g: 255, b: 255, a: 1 };
        const palette = buildRainbowPalette({ steps: 1024, start, end, style: 'rgb' });
        const folderRainbow = buildFolderRainbowColorsFromSiblingPaths({
            siblingPathsByParent: new Map<string, readonly string[]>([['/', ['A', 'B']]]),
            palette,
            scope: 'root',
            showRootFolder: true,
            inheritColors: false
        });

        const resolved = resolveFolderRainbowDecorationColors({
            mode: 'foreground',
            folderPath: 'A',
            color: 'rgb(12, 34, 56)',
            backgroundColor: undefined,
            scope: 'root',
            showRootFolder: true,
            colors: folderRainbow
        });

        expect(resolved.color).toBe('rgb(12, 34, 56)');
    });

    it('applies folder rainbow background when background mode is active', () => {
        const start = parseCssColor('#000000') ?? { r: 0, g: 0, b: 0, a: 1 };
        const end = parseCssColor('#ffffff') ?? { r: 255, g: 255, b: 255, a: 1 };
        const palette = buildRainbowPalette({ steps: 1024, start, end, style: 'rgb' });

        const folderRainbow = buildFolderRainbowColorsFromSiblingPaths({
            siblingPathsByParent: new Map<string, readonly string[]>([['/', ['A', 'B']]]),
            palette,
            scope: 'root',
            showRootFolder: true,
            inheritColors: false
        });

        const resolved = resolveFolderRainbowDecorationColors({
            mode: 'background',
            folderPath: 'A',
            color: undefined,
            backgroundColor: undefined,
            scope: 'root',
            showRootFolder: true,
            colors: folderRainbow
        });

        expect(resolved.color).toBeUndefined();
        expect(resolved.backgroundColor).toBeDefined();
    });

    it('inherits tag rainbow color from nearest root-scoped ancestor', () => {
        const start = parseCssColor('#000000') ?? { r: 0, g: 0, b: 0, a: 1 };
        const end = parseCssColor('#ffffff') ?? { r: 255, g: 255, b: 255, a: 1 };
        const palette = buildRainbowPalette({ steps: 1024, start, end, style: 'rgb' });

        const items: CombinedNavigationItem[] = [
            createTagItem('alpha', 1),
            createTagItem('beta', 1),
            createTagItem('alpha/child', 2),
            createTagItem('alpha/child/grandchild', 3)
        ];

        const tagRainbow = buildTagRainbowColors({
            items,
            palette,
            scope: 'root',
            rootLevel: 1,
            showAllTagsFolder: true,
            inheritColors: true
        });

        const parentColor = tagRainbow.colorsByPath.get('alpha');
        expect(parentColor).toBeDefined();
        expect(tagRainbow.getInheritedColor('alpha/child')).toBe(parentColor);
        expect(tagRainbow.getInheritedColor('alpha/child/grandchild')).toBe(parentColor);
    });

    it('does not assign key colors when property scope is child', () => {
        const start = parseCssColor('#000000') ?? { r: 0, g: 0, b: 0, a: 1 };
        const end = parseCssColor('#ffffff') ?? { r: 255, g: 255, b: 255, a: 1 };
        const palette = buildRainbowPalette({ steps: 1024, start, end, style: 'rgb' });

        const items: CombinedNavigationItem[] = [
            createPropertyKeyItem('key:status', 'status', 1),
            createPropertyValueItem('key:status=todo', 'status', 'todo', 2),
            createPropertyValueItem('key:status=done', 'status', 'done', 2)
        ];

        const propertyRainbow = buildPropertyRainbowColors({
            items,
            palette,
            scope: 'child',
            showAllPropertiesFolder: true
        });

        expect(propertyRainbow.colorsByNodeId.has('key:status')).toBe(false);
        expect(propertyRainbow.colorsByNodeId.has('key:status=todo')).toBe(true);
        expect(propertyRainbow.colorsByNodeId.has('key:status=done')).toBe(true);
    });

    it('reuses light rainbow colors in dark mode when separate theme colors are disabled', () => {
        const navRainbow = {
            mode: 'foreground' as const,
            balanceHueLuminance: true,
            separateThemeColors: false,
            shortcuts: {
                enabled: true,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#aaaaaa',
                darkLastColor: '#bbbbbb',
                transitionStyle: 'rgb' as const
            },
            recent: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#aaaaaa',
                darkLastColor: '#bbbbbb',
                transitionStyle: 'rgb' as const
            },
            folders: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#aaaaaa',
                darkLastColor: '#bbbbbb',
                transitionStyle: 'rgb' as const,
                scope: 'root' as const
            },
            tags: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#aaaaaa',
                darkLastColor: '#bbbbbb',
                transitionStyle: 'rgb' as const,
                scope: 'root' as const
            },
            properties: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#aaaaaa',
                darkLastColor: '#bbbbbb',
                transitionStyle: 'rgb' as const,
                scope: 'root' as const
            }
        };

        const darkPalettes = buildNavigationRainbowPalettes(navRainbow, true);
        const lightPalettes = buildNavigationRainbowPalettes(navRainbow, false);

        expect(darkPalettes.shortcut?.[0]).toBe(lightPalettes.shortcut?.[0]);
    });

    it('uses dark rainbow colors in dark mode when separate theme colors are enabled', () => {
        const navRainbow = {
            mode: 'foreground' as const,
            balanceHueLuminance: true,
            separateThemeColors: true,
            shortcuts: {
                enabled: true,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#aaaaaa',
                darkLastColor: '#bbbbbb',
                transitionStyle: 'rgb' as const
            },
            recent: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#aaaaaa',
                darkLastColor: '#bbbbbb',
                transitionStyle: 'rgb' as const
            },
            folders: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#aaaaaa',
                darkLastColor: '#bbbbbb',
                transitionStyle: 'rgb' as const,
                scope: 'root' as const
            },
            tags: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#aaaaaa',
                darkLastColor: '#bbbbbb',
                transitionStyle: 'rgb' as const,
                scope: 'root' as const
            },
            properties: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#aaaaaa',
                darkLastColor: '#bbbbbb',
                transitionStyle: 'rgb' as const,
                scope: 'root' as const
            }
        };

        const darkPalettes = buildNavigationRainbowPalettes(navRainbow, true);
        const lightPalettes = buildNavigationRainbowPalettes(navRainbow, false);

        expect(darkPalettes.shortcut?.[0]).not.toBe(lightPalettes.shortcut?.[0]);
    });

    it('changes hue palettes when luminance balancing is disabled', () => {
        const baseNavRainbow = {
            mode: 'foreground' as const,
            separateThemeColors: false,
            shortcuts: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#111111',
                darkLastColor: '#222222',
                transitionStyle: 'rgb' as const
            },
            recent: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#111111',
                darkLastColor: '#222222',
                transitionStyle: 'rgb' as const
            },
            folders: {
                enabled: true,
                firstColor: '#ff0000',
                lastColor: '#0000ff',
                darkFirstColor: '#ff0000',
                darkLastColor: '#0000ff',
                transitionStyle: 'hue' as const,
                scope: 'root' as const
            },
            tags: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#111111',
                darkLastColor: '#222222',
                transitionStyle: 'rgb' as const,
                scope: 'root' as const
            },
            properties: {
                enabled: false,
                firstColor: '#111111',
                lastColor: '#222222',
                darkFirstColor: '#111111',
                darkLastColor: '#222222',
                transitionStyle: 'rgb' as const,
                scope: 'root' as const
            }
        };

        const balancedPalettes = buildNavigationRainbowPalettes({ ...baseNavRainbow, balanceHueLuminance: true }, false);
        const simplePalettes = buildNavigationRainbowPalettes({ ...baseNavRainbow, balanceHueLuminance: false }, false);

        expect(balancedPalettes.folder?.[512]).not.toBe(simplePalettes.folder?.[512]);
    });
});
