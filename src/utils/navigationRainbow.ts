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

import { NavigationPaneItemType } from '../types';
import type { CombinedNavigationItem } from '../types/virtualization';
import { DEFAULT_SETTINGS } from '../settings/defaultSettings';
import type { NavRainbowColorMode, NavRainbowScope, NavRainbowSettings } from '../settings/types';
import {
    assignRainbowColorsFromPalette,
    buildRainbowColorMapFromPalette,
    buildRainbowPalette,
    parseCssColor,
    type RGBA
} from './colorUtils';
import { getParentFolderPath } from './pathUtils';

const navRainbowDefaultStart = parseCssColor(DEFAULT_SETTINGS.navRainbow.folders.firstColor);
const navRainbowDefaultEnd = parseCssColor(DEFAULT_SETTINGS.navRainbow.folders.lastColor);

if (!navRainbowDefaultStart || !navRainbowDefaultEnd) {
    throw new Error('[Notebook Navigator] Invalid nav rainbow default colors.');
}

export const NAV_RAINBOW_DEFAULT_START: RGBA = navRainbowDefaultStart;
export const NAV_RAINBOW_DEFAULT_END: RGBA = navRainbowDefaultEnd;

const FOLDER_VIRTUAL_ROOT_RAINBOW_KEY = '__nn-folder-virtual-root__';
const SHORTCUT_VIRTUAL_ROOT_RAINBOW_KEY = '__nn-shortcuts-virtual-root__';

const NAV_RAINBOW_PALETTE_SIZE = 1024;

export interface NavigationRainbowPalettes {
    folder: readonly string[] | null;
    tag: readonly string[] | null;
    property: readonly string[] | null;
    shortcut: readonly string[] | null;
}

interface NavRainbowPaletteSource {
    enabled: boolean;
    firstColor: string;
    lastColor: string;
    transitionStyle: 'hue' | 'rgb';
}

function resolveRainbowColorEndpoints(firstColor: string, lastColor: string): { start: RGBA; end: RGBA } {
    return {
        start: parseCssColor(firstColor) ?? NAV_RAINBOW_DEFAULT_START,
        end: parseCssColor(lastColor) ?? NAV_RAINBOW_DEFAULT_END
    };
}

function buildSectionPalette(mode: NavRainbowColorMode, section: NavRainbowPaletteSource): string[] | null {
    if (mode === 'none' || !section.enabled) {
        return null;
    }

    const { start, end } = resolveRainbowColorEndpoints(section.firstColor, section.lastColor);
    return buildRainbowPalette({
        steps: NAV_RAINBOW_PALETTE_SIZE,
        start,
        end,
        style: section.transitionStyle
    });
}

export function buildNavigationRainbowPalettes(navRainbow: NavRainbowSettings): NavigationRainbowPalettes {
    const mode = navRainbow.mode;
    return {
        folder: buildSectionPalette(mode, navRainbow.folders),
        tag: buildSectionPalette(mode, navRainbow.tags),
        property: buildSectionPalette(mode, navRainbow.properties),
        shortcut: buildSectionPalette(mode, navRainbow.shortcuts)
    };
}

function isNonEmptyCssColor(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

export function applyRainbowOverlay(params: {
    mode: NavRainbowColorMode;
    rainbowColor: string | undefined;
    color: string | null | undefined;
    backgroundColor: string | null | undefined;
}): { color?: string; backgroundColor?: string } {
    const baseColor = params.color ?? undefined;
    const baseBackgroundColor = params.backgroundColor ?? undefined;
    const rainbowColor = params.rainbowColor;

    if (params.mode === 'none' || !isNonEmptyCssColor(rainbowColor)) {
        return { color: baseColor, backgroundColor: baseBackgroundColor };
    }

    if (params.mode === 'foreground') {
        if (!isNonEmptyCssColor(baseColor)) {
            return { color: rainbowColor, backgroundColor: baseBackgroundColor };
        }
        return { color: baseColor, backgroundColor: baseBackgroundColor };
    }

    if (!isNonEmptyCssColor(baseBackgroundColor)) {
        return { color: baseColor, backgroundColor: rainbowColor };
    }

    return { color: baseColor, backgroundColor: baseBackgroundColor };
}

export interface FolderRainbowColors {
    colorsByPath: Map<string, string>;
    rootColor: string | undefined;
    getInheritedColor: (folderPath: string) => string | undefined;
}

export function buildFolderRainbowColors(params: {
    items: readonly CombinedNavigationItem[];
    palette: readonly string[];
    scope: NavRainbowScope;
    showRootFolder: boolean;
    rootLevel: number;
    inheritColors: boolean;
}): FolderRainbowColors {
    const { items, palette, scope, showRootFolder, rootLevel, inheritColors } = params;
    const paletteStart = palette[0];
    const colorsByPath = new Map<string, string>();
    let rootColor: string | undefined;

    if (scope === 'root') {
        const keys: string[] = [];
        const seen = new Set<string>();

        for (const item of items) {
            if (item.type !== NavigationPaneItemType.FOLDER) {
                continue;
            }
            if (item.isExcluded) {
                continue;
            }
            if (item.level !== rootLevel) {
                continue;
            }
            const path = item.data.path;
            if (!path || path === '/' || seen.has(path)) {
                continue;
            }
            seen.add(path);
            keys.push(path);
        }

        rootColor = paletteStart;

        if (showRootFolder) {
            const rootScopedColors = buildRainbowColorMapFromPalette({
                keys: [FOLDER_VIRTUAL_ROOT_RAINBOW_KEY, ...keys],
                palette
            });

            for (const key of keys) {
                const color = rootScopedColors.get(key);
                if (color) {
                    colorsByPath.set(key, color);
                }
            }
        } else {
            assignRainbowColorsFromPalette({ keys, palette, target: colorsByPath });
        }
    } else {
        const childPathsByParent = new Map<string, string[]>();
        const seenChildrenByParent = new Map<string, Set<string>>();

        for (const item of items) {
            if (item.type !== NavigationPaneItemType.FOLDER) {
                continue;
            }
            if (item.isExcluded) {
                continue;
            }
            if (scope === 'child' && item.level <= rootLevel) {
                continue;
            }

            const path = item.data.path;
            if (!path || path === '/') {
                continue;
            }

            const parentPath = getParentFolderPath(path);
            let seen = seenChildrenByParent.get(parentPath);
            if (!seen) {
                seen = new Set<string>();
                seenChildrenByParent.set(parentPath, seen);
            }
            if (seen.has(path)) {
                continue;
            }
            seen.add(path);

            const siblings = childPathsByParent.get(parentPath);
            if (siblings) {
                siblings.push(path);
            } else {
                childPathsByParent.set(parentPath, [path]);
            }
        }

        if (showRootFolder && scope === 'all') {
            rootColor = paletteStart;
        }

        for (const keys of childPathsByParent.values()) {
            assignRainbowColorsFromPalette({ keys, palette, target: colorsByPath });
        }
    }

    const inheritedCache = new Map<string, string | null>();
    const getInheritedColor = (folderPath: string): string | undefined => {
        if (scope !== 'root' || !inheritColors) {
            return undefined;
        }

        if (inheritedCache.has(folderPath)) {
            return inheritedCache.get(folderPath) ?? undefined;
        }

        let ancestorPath = getParentFolderPath(folderPath);
        while (ancestorPath && ancestorPath !== '/') {
            const ancestorRainbowColor = colorsByPath.get(ancestorPath);
            if (ancestorRainbowColor) {
                inheritedCache.set(folderPath, ancestorRainbowColor);
                return ancestorRainbowColor;
            }
            ancestorPath = getParentFolderPath(ancestorPath);
        }

        inheritedCache.set(folderPath, null);
        return undefined;
    };

    return { colorsByPath, rootColor, getInheritedColor };
}

export interface TagRainbowColors {
    colorsByPath: Map<string, string>;
    rootColor: string | undefined;
    getInheritedColor: (tagPath: string) => string | undefined;
}

function getParentTagPath(path: string): string {
    const separatorIndex = path.lastIndexOf('/');
    if (separatorIndex === -1) {
        return '';
    }
    return path.slice(0, separatorIndex);
}

export function buildTagRainbowColors(params: {
    items: readonly CombinedNavigationItem[];
    palette: readonly string[];
    scope: NavRainbowScope;
    rootLevel: number;
    showAllTagsFolder: boolean;
    inheritColors: boolean;
}): TagRainbowColors {
    const { items, palette, scope, rootLevel, showAllTagsFolder, inheritColors } = params;

    const colorsByPath = new Map<string, string>();
    let rootColor: string | undefined;

    if (scope === 'root') {
        const keys: string[] = [];
        const seen = new Set<string>();

        for (const item of items) {
            if (item.type !== NavigationPaneItemType.TAG && item.type !== NavigationPaneItemType.UNTAGGED) {
                continue;
            }
            if (item.level !== rootLevel) {
                continue;
            }

            const path = item.data.path;
            if (!path || seen.has(path)) {
                continue;
            }
            seen.add(path);
            keys.push(path);
        }

        rootColor = palette[0];
        assignRainbowColorsFromPalette({ keys, palette, target: colorsByPath });
    } else {
        const childPathsByParent = new Map<string, string[]>();
        const seenChildrenByParent = new Map<string, Set<string>>();

        for (const item of items) {
            if (item.type !== NavigationPaneItemType.TAG && item.type !== NavigationPaneItemType.UNTAGGED) {
                continue;
            }
            if (scope === 'child' && item.level <= rootLevel) {
                continue;
            }

            const path = item.data.path;
            if (!path) {
                continue;
            }

            const parentPath = getParentTagPath(path);
            let seen = seenChildrenByParent.get(parentPath);
            if (!seen) {
                seen = new Set<string>();
                seenChildrenByParent.set(parentPath, seen);
            }
            if (seen.has(path)) {
                continue;
            }
            seen.add(path);

            const siblings = childPathsByParent.get(parentPath);
            if (siblings) {
                siblings.push(path);
            } else {
                childPathsByParent.set(parentPath, [path]);
            }
        }

        for (const keys of childPathsByParent.values()) {
            assignRainbowColorsFromPalette({ keys, palette, target: colorsByPath });
        }

        if (showAllTagsFolder && scope === 'all') {
            rootColor = palette[0];
        }
    }

    const inheritedCache = new Map<string, string | null>();
    const getInheritedColor = (tagPath: string): string | undefined => {
        if (scope !== 'root' || !inheritColors) {
            return undefined;
        }

        if (inheritedCache.has(tagPath)) {
            return inheritedCache.get(tagPath) ?? undefined;
        }

        let ancestorPath = getParentTagPath(tagPath);
        while (ancestorPath) {
            const ancestorRainbowColor = colorsByPath.get(ancestorPath);
            if (ancestorRainbowColor) {
                inheritedCache.set(tagPath, ancestorRainbowColor);
                return ancestorRainbowColor;
            }
            ancestorPath = getParentTagPath(ancestorPath);
        }

        inheritedCache.set(tagPath, null);
        return undefined;
    };

    return { colorsByPath, rootColor, getInheritedColor };
}

export interface PropertyRainbowColors {
    colorsByNodeId: Map<string, string>;
    rootColor: string | undefined;
    rootColorsByKey: Map<string, string>;
}

export function buildPropertyRainbowColors(params: {
    items: readonly CombinedNavigationItem[];
    palette: readonly string[];
    scope: NavRainbowScope;
    showAllPropertiesFolder: boolean;
}): PropertyRainbowColors {
    const { items, palette, scope, showAllPropertiesFolder } = params;

    const colorsByNodeId = new Map<string, string>();
    const rootColorsByKey = new Map<string, string>();
    let rootColor: string | undefined;

    if (scope === 'root') {
        const keys: string[] = [];
        const seen = new Set<string>();

        for (const item of items) {
            if (item.type !== NavigationPaneItemType.PROPERTY_KEY) {
                continue;
            }
            const nodeId = item.data.id;
            if (seen.has(nodeId)) {
                continue;
            }
            seen.add(nodeId);
            keys.push(nodeId);
        }

        rootColor = palette[0];
        assignRainbowColorsFromPalette({ keys, palette, target: colorsByNodeId });

        for (const item of items) {
            if (item.type !== NavigationPaneItemType.PROPERTY_KEY) {
                continue;
            }
            const color = colorsByNodeId.get(item.data.id);
            if (!color) {
                continue;
            }
            rootColorsByKey.set(item.data.key, color);
        }
    } else {
        const childIdsByParent = new Map<string, string[]>();
        const seenChildrenByParent = new Map<string, Set<string>>();

        for (const item of items) {
            if (item.type !== NavigationPaneItemType.PROPERTY_KEY && item.type !== NavigationPaneItemType.PROPERTY_VALUE) {
                continue;
            }
            if (scope === 'child' && item.type === NavigationPaneItemType.PROPERTY_KEY) {
                continue;
            }

            const nodeId = item.data.id;
            const parentId = item.type === NavigationPaneItemType.PROPERTY_KEY ? '__root__' : `key:${item.data.key}`;

            let seen = seenChildrenByParent.get(parentId);
            if (!seen) {
                seen = new Set<string>();
                seenChildrenByParent.set(parentId, seen);
            }
            if (seen.has(nodeId)) {
                continue;
            }
            seen.add(nodeId);

            const siblings = childIdsByParent.get(parentId);
            if (siblings) {
                siblings.push(nodeId);
            } else {
                childIdsByParent.set(parentId, [nodeId]);
            }
        }

        for (const keys of childIdsByParent.values()) {
            assignRainbowColorsFromPalette({ keys, palette, target: colorsByNodeId });
        }

        if (showAllPropertiesFolder && scope === 'all') {
            rootColor = palette[0];
        }
    }

    return { colorsByNodeId, rootColor, rootColorsByKey };
}

export interface ShortcutRainbowColors {
    colorsByKey: Map<string, string>;
    rootColor: string | undefined;
}

export function buildShortcutRainbowColors(params: {
    items: readonly CombinedNavigationItem[];
    palette: readonly string[];
}): ShortcutRainbowColors {
    const { items, palette } = params;

    const keys: string[] = [];
    const seen = new Set<string>();

    for (const item of items) {
        if (
            item.type !== NavigationPaneItemType.SHORTCUT_FOLDER &&
            item.type !== NavigationPaneItemType.SHORTCUT_NOTE &&
            item.type !== NavigationPaneItemType.SHORTCUT_SEARCH &&
            item.type !== NavigationPaneItemType.SHORTCUT_TAG &&
            item.type !== NavigationPaneItemType.SHORTCUT_PROPERTY
        ) {
            continue;
        }

        const key = item.key;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        keys.push(key);
    }

    const rootScopedColors = buildRainbowColorMapFromPalette({
        keys: [SHORTCUT_VIRTUAL_ROOT_RAINBOW_KEY, ...keys],
        palette
    });

    const rootColor = rootScopedColors.get(SHORTCUT_VIRTUAL_ROOT_RAINBOW_KEY) ?? palette[0];
    const colorsByKey = new Map<string, string>();
    for (const key of keys) {
        const color = rootScopedColors.get(key);
        if (color) {
            colorsByKey.set(key, color);
        }
    }

    return { colorsByKey, rootColor };
}
