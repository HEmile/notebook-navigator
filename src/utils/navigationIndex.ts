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

import { ItemType, NavigationPaneItemType } from '../types';
import type { CombinedNavigationItem } from '../types/virtualization';
import { normalizeTagPath } from './tagUtils';

export type NavigationIndexKey = string;

/**
 * Normalizes a navigation path for index lookups.
 * Tags use lowercase paths. Folders pass through unchanged.
 */
export function normalizeNavigationPath(itemType: ItemType, path: string): string {
    if (itemType === ItemType.TAG) {
        const normalized = normalizeTagPath(path);
        return normalized ?? path.toLowerCase();
    }
    return path;
}

/**
 * Creates the composite key used for navigation index lookups.
 */
function createNavigationIndexKey(itemType: ItemType, path: string): NavigationIndexKey {
    const normalizedPath = normalizeNavigationPath(itemType, path);
    return `${itemType}:${normalizedPath}`;
}

/**
 * Looks up the index for a navigation item using its type-aware key.
 */
export function getNavigationIndex(indexMap: Map<NavigationIndexKey, number>, itemType: ItemType, path: string): number | undefined {
    return indexMap.get(createNavigationIndexKey(itemType, path));
}

/**
 * Stores the index for a navigation item using its type-aware key.
 */
function setNavigationIndex(indexMap: Map<NavigationIndexKey, number>, itemType: ItemType, path: string, index: number): void {
    indexMap.set(createNavigationIndexKey(itemType, path), index);
}

export function buildNavigationPathIndexMap(items: readonly CombinedNavigationItem[]): Map<NavigationIndexKey, number> {
    const indexMap = new Map<NavigationIndexKey, number>();

    items.forEach((item, index) => {
        if (item.type === NavigationPaneItemType.FOLDER) {
            setNavigationIndex(indexMap, ItemType.FOLDER, item.data.path, index);
        } else if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
            setNavigationIndex(indexMap, ItemType.TAG, item.data.path, index);
        } else if (item.type === NavigationPaneItemType.VIRTUAL_FOLDER && item.tagCollectionId) {
            setNavigationIndex(indexMap, ItemType.TAG, item.tagCollectionId, index);
        } else if (item.type === NavigationPaneItemType.VIRTUAL_FOLDER && item.propertyCollectionId) {
            setNavigationIndex(indexMap, ItemType.PROPERTY, item.key, index);
        } else if (item.type === NavigationPaneItemType.PROPERTY_KEY || item.type === NavigationPaneItemType.PROPERTY_VALUE) {
            setNavigationIndex(indexMap, ItemType.PROPERTY, item.data.id, index);
        }
    });

    return indexMap;
}

export interface IndentGuideItem {
    key: string;
    type: NavigationPaneItemType;
    level?: number;
}

function isIndentGuideTreeItem(item: IndentGuideItem): item is IndentGuideItem & { level: number } {
    if (typeof item.level !== 'number') {
        return false;
    }

    return (
        item.type === NavigationPaneItemType.FOLDER ||
        item.type === NavigationPaneItemType.TAG ||
        item.type === NavigationPaneItemType.UNTAGGED ||
        item.type === NavigationPaneItemType.PROPERTY_KEY ||
        item.type === NavigationPaneItemType.PROPERTY_VALUE ||
        item.type === NavigationPaneItemType.VIRTUAL_FOLDER
    );
}

export function buildIndentGuideLevelsMap(sourceItems: readonly IndentGuideItem[]): Map<string, number[]> {
    const connectorMap = new Map<string, number[]>();
    const outlineItems = sourceItems.filter(isIndentGuideTreeItem);
    const activeAncestorLevels: number[] = [];
    const activeConnectorKeys: string[] = [];
    const connectorLevelsCache = new Map<string, number[]>();

    outlineItems.forEach((item, index) => {
        while (activeAncestorLevels.length > 0 && activeAncestorLevels[activeAncestorLevels.length - 1] >= item.level) {
            activeAncestorLevels.pop();
            activeConnectorKeys.pop();
        }

        if (activeAncestorLevels.length > 0) {
            const chainKey = activeConnectorKeys[activeConnectorKeys.length - 1];
            const cachedLevels = connectorLevelsCache.get(chainKey);
            if (cachedLevels) {
                connectorMap.set(item.key, cachedLevels);
            } else {
                const levels = [...activeAncestorLevels];
                connectorLevelsCache.set(chainKey, levels);
                connectorMap.set(item.key, levels);
            }
        }

        const nextLevel = outlineItems[index + 1]?.level;
        if (typeof nextLevel === 'number' && nextLevel > item.level) {
            activeAncestorLevels.push(item.level);
            const previousChainKey = activeConnectorKeys[activeConnectorKeys.length - 1];
            activeConnectorKeys.push(previousChainKey ? `${previousChainKey}/${item.level}` : `${item.level}`);
        }
    });

    return connectorMap;
}
