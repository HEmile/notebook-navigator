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
import { NavigationPaneItemType, TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../../types';
import type { CombinedNavigationItem } from '../../types/virtualization';
import type { NavigationInlineRenameTarget } from './NavigationPaneItemRenderer.types';

function getPathLeaf(path: string): string {
    const slashIndex = path.lastIndexOf('/');
    return slashIndex >= 0 ? path.slice(slashIndex + 1) : path;
}

export function replacePathLeaf(path: string, nextLeaf: string): string {
    const trimmedLeaf = nextLeaf.trim();
    const slashIndex = path.lastIndexOf('/');
    return slashIndex >= 0 ? `${path.slice(0, slashIndex)}/${trimmedLeaf}` : trimmedLeaf;
}

/**
 * Builds the inline rename target for a navigation item, or null when the item
 * cannot be renamed. Target ids use the item's identity: folder path for
 * folders, canonical tag path for tags, property node id for property keys.
 * matchNavigationInlineRenameTarget compares against the same ids; the two
 * functions must stay in sync for the rename input to appear on the row.
 */
export function buildNavigationInlineRenameTarget(
    item: CombinedNavigationItem,
    getFolderRenameInitialValue: (folder: TFolder) => string
): NavigationInlineRenameTarget | null {
    if (item.type === NavigationPaneItemType.FOLDER) {
        if (!(item.data instanceof TFolder)) {
            return null;
        }
        const folder = item.data;
        return {
            type: 'folder',
            id: folder.path,
            initialValue: getFolderRenameInitialValue(folder)
        };
    }

    if (item.type === NavigationPaneItemType.TAG) {
        const tagNode = item.data;
        if (tagNode.path === TAGGED_TAG_ID || tagNode.path === UNTAGGED_TAG_ID) {
            return null;
        }
        return {
            type: 'tag',
            id: tagNode.path,
            displayPath: tagNode.displayPath,
            initialValue: getPathLeaf(tagNode.displayPath)
        };
    }

    if (item.type === NavigationPaneItemType.PROPERTY_KEY) {
        const propertyNode = item.data;
        if (propertyNode.kind !== 'key' || propertyNode.notesWithValue.size === 0) {
            return null;
        }
        return {
            type: 'property',
            id: propertyNode.id,
            normalizedKey: propertyNode.key,
            initialValue: propertyNode.name
        };
    }

    return null;
}

/**
 * Returns the rename target when it addresses the given navigation item,
 * otherwise null. Uses the same id scheme as buildNavigationInlineRenameTarget.
 */
export function matchNavigationInlineRenameTarget(
    item: CombinedNavigationItem,
    target: NavigationInlineRenameTarget
): NavigationInlineRenameTarget | null {
    if (item.type === NavigationPaneItemType.FOLDER) {
        return target.type === 'folder' && target.id === item.data.path ? target : null;
    }
    if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
        return target.type === 'tag' && target.id === item.data.path ? target : null;
    }
    if (item.type === NavigationPaneItemType.PROPERTY_KEY || item.type === NavigationPaneItemType.PROPERTY_VALUE) {
        return target.type === 'property' && target.id === item.data.id ? target : null;
    }
    return null;
}
