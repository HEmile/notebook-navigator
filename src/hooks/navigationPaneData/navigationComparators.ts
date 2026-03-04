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

import type { TagSortOrder } from '../../settings/types';
import type { PropertyTreeNode, TagTreeNode } from '../../types/storage';
import { naturalCompare } from '../../utils/sortUtils';
import { getTotalNoteCount } from '../../utils/tagTree';

export type TagComparator = (a: TagTreeNode, b: TagTreeNode) => number;
export type PropertyNodeComparator = (a: PropertyTreeNode, b: PropertyTreeNode) => number;
type NavigationComparator<T> = (a: T, b: T) => number;

function reverseComparator<T>(comparator: NavigationComparator<T>): NavigationComparator<T> {
    return (a, b) => -comparator(a, b);
}

function createFrequencyComparator<T>(params: {
    order: TagSortOrder;
    compareAlphabetically: NavigationComparator<T>;
    getFrequency: (node: T) => number;
}): NavigationComparator<T> | undefined {
    const { order, compareAlphabetically, getFrequency } = params;

    if (order === 'alpha-asc') {
        return undefined;
    }

    if (order === 'alpha-desc') {
        return reverseComparator(compareAlphabetically);
    }

    const compareByFrequency: NavigationComparator<T> = (a, b) => {
        const diff = getFrequency(a) - getFrequency(b);
        if (diff !== 0) {
            return diff;
        }
        return compareAlphabetically(a, b);
    };

    if (order === 'frequency-asc') {
        return compareByFrequency;
    }

    return reverseComparator(compareByFrequency);
}

/** Compares tags alphabetically by name with fallback to path */
export const compareTagAlphabetically: TagComparator = (a, b) => {
    const nameCompare = naturalCompare(a.name, b.name);
    if (nameCompare !== 0) {
        return nameCompare;
    }
    return a.path.localeCompare(b.path);
};

export function createTagComparator(order: TagSortOrder, includeDescendantNotes: boolean): TagComparator | undefined {
    const getCount = includeDescendantNotes
        ? (node: TagTreeNode) => getTotalNoteCount(node)
        : (node: TagTreeNode) => node.notesWithTag.size;

    return createFrequencyComparator<TagTreeNode>({
        order,
        compareAlphabetically: compareTagAlphabetically,
        getFrequency: getCount
    });
}

/** Compares property key nodes alphabetically by display name with key fallback */
export const comparePropertyKeyNodesAlphabetically: PropertyNodeComparator = (a, b) => {
    const nameCompare = naturalCompare(a.name, b.name);
    if (nameCompare !== 0) {
        return nameCompare;
    }
    return a.key.localeCompare(b.key);
};

/** Compares property value nodes alphabetically by display name with value-path fallback */
export const comparePropertyValueNodesAlphabetically: PropertyNodeComparator = (a, b) => {
    const nameCompare = naturalCompare(a.name, b.name);
    if (nameCompare !== 0) {
        return nameCompare;
    }
    return (a.valuePath ?? '').localeCompare(b.valuePath ?? '');
};

export function createPropertyComparator(params: {
    order: TagSortOrder;
    compareAlphabetically: PropertyNodeComparator;
    getFrequency: (node: PropertyTreeNode) => number;
}): PropertyNodeComparator {
    const { order, compareAlphabetically, getFrequency } = params;
    const comparator = createFrequencyComparator<PropertyTreeNode>({
        order,
        compareAlphabetically,
        getFrequency
    });
    return comparator ?? compareAlphabetically;
}
