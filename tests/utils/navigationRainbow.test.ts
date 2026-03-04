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
import { buildRainbowPalette, parseCssColor } from '../../src/utils/colorUtils';
import { applyRainbowOverlay, buildFolderRainbowColors } from '../../src/utils/navigationRainbow';

function createTestTFolder(path: string): TFolder {
    const folder = new TFolder();
    folder.path = path;
    folder.name = path === '/' ? '/' : (path.split('/').pop() ?? path);
    return folder;
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
});
