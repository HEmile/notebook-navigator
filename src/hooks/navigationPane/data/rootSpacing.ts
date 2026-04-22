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

import { NavigationPaneItemType, PROPERTIES_ROOT_VIRTUAL_FOLDER_ID, TAGS_ROOT_VIRTUAL_FOLDER_ID } from '../../../types';
import type { CombinedNavigationItem } from '../../../types/virtualization';
import { parseNavigationSeparatorKey } from '../../../utils/navigationSeparators';

/** Options controlling which navigation items are eligible for root spacing */
export interface RootSpacingOptions {
    showRootFolder: boolean;
    tagRootLevel: number;
    propertyRootLevel: number;
}

export const SPACER_ITEM_TYPES = new Set<NavigationPaneItemType>([
    NavigationPaneItemType.TOP_SPACER,
    NavigationPaneItemType.LIST_SPACER,
    NavigationPaneItemType.BOTTOM_SPACER,
    NavigationPaneItemType.ROOT_SPACER
]);

const isCustomSeparatorKey = (key: string): boolean => {
    const parsed = parseNavigationSeparatorKey(key);
    return parsed?.type === 'folder' || parsed?.type === 'tag' || parsed?.type === 'property';
};

/** Determines if the navigation item is a top-level folder, tag, or property eligible for root spacing */
const isRootSpacingCandidate = (item: CombinedNavigationItem, options: RootSpacingOptions): boolean => {
    if (item.type === NavigationPaneItemType.FOLDER) {
        if (options.showRootFolder && item.data.path === '/') {
            return true;
        }
        const desiredLevel = options.showRootFolder ? 1 : 0;
        return item.level === desiredLevel;
    }
    if (item.type === NavigationPaneItemType.TAG || item.type === NavigationPaneItemType.UNTAGGED) {
        return item.level === options.tagRootLevel;
    }
    if (item.type === NavigationPaneItemType.PROPERTY_KEY) {
        return item.level === options.propertyRootLevel;
    }
    return false;
};

export function insertRootSpacing(items: CombinedNavigationItem[], spacing: number, options: RootSpacingOptions): CombinedNavigationItem[] {
    if (spacing <= 0) {
        return items;
    }

    const result: CombinedNavigationItem[] = [];
    let rootCountInSection = 0;
    let spacerId = 0;

    const isVirtualRootSpacingAnchor = (item: CombinedNavigationItem): boolean => {
        if (item.type !== NavigationPaneItemType.VIRTUAL_FOLDER) {
            return false;
        }
        if (item.data.id === TAGS_ROOT_VIRTUAL_FOLDER_ID) {
            return options.tagRootLevel > 0;
        }
        if (item.data.id === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
            return options.propertyRootLevel > 0;
        }
        return false;
    };

    const shouldResetSection = (item: CombinedNavigationItem): boolean => {
        if (
            item.type === NavigationPaneItemType.TOP_SPACER ||
            item.type === NavigationPaneItemType.BOTTOM_SPACER ||
            item.type === NavigationPaneItemType.VIRTUAL_FOLDER
        ) {
            return true;
        }

        if (item.type === NavigationPaneItemType.LIST_SPACER) {
            return !isCustomSeparatorKey(item.key);
        }

        return false;
    };

    for (const item of items) {
        if (shouldResetSection(item)) {
            rootCountInSection = isVirtualRootSpacingAnchor(item) ? 1 : 0;
            result.push(item);
            continue;
        }

        if (isRootSpacingCandidate(item, options)) {
            if (rootCountInSection > 0) {
                result.push({
                    type: NavigationPaneItemType.ROOT_SPACER,
                    key: `root-spacer-${spacerId++}`,
                    spacing
                });
            }
            rootCountInSection += 1;
            result.push(item);
            continue;
        }

        result.push(item);
    }

    return result;
}
