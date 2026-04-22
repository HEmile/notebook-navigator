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

import { strings } from '../i18n';
import { TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../types';

// Constants for virtual tag collection identifiers
export const VIRTUAL_TAG_COLLECTION_IDS = {
    TAGGED: TAGGED_TAG_ID,
    UNTAGGED: UNTAGGED_TAG_ID
} as const;

// Union type of all virtual tag collection IDs
export type VirtualTagCollectionId = (typeof VIRTUAL_TAG_COLLECTION_IDS)[keyof typeof VIRTUAL_TAG_COLLECTION_IDS];

// Definition structure for a virtual tag collection
export interface VirtualTagCollectionDefinition {
    id: VirtualTagCollectionId;
    getLabel: () => string;
}

// Registry of all available virtual tag collections with their localized labels
const virtualTagCollections: Record<VirtualTagCollectionId, VirtualTagCollectionDefinition> = {
    [VIRTUAL_TAG_COLLECTION_IDS.TAGGED]: {
        id: VIRTUAL_TAG_COLLECTION_IDS.TAGGED,
        getLabel: () => strings.tagList.tags
    },
    [VIRTUAL_TAG_COLLECTION_IDS.UNTAGGED]: {
        id: VIRTUAL_TAG_COLLECTION_IDS.UNTAGGED,
        getLabel: () => strings.tagList.untaggedLabel
    }
};

// Type guard to check if a value is a valid virtual tag collection ID
export function isVirtualTagCollectionId(value: string | null | undefined): value is VirtualTagCollectionId {
    if (!value) {
        return false;
    }
    return value === VIRTUAL_TAG_COLLECTION_IDS.TAGGED || value === VIRTUAL_TAG_COLLECTION_IDS.UNTAGGED;
}

// Retrieves the definition for a virtual tag collection
export function getVirtualTagCollection(value: VirtualTagCollectionId): VirtualTagCollectionDefinition {
    return virtualTagCollections[value];
}
