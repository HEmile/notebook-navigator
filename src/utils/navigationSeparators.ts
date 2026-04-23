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

import { NavigationSectionId } from '../types';
import { normalizeTagPath } from './tagUtils';
import { normalizePropertyNodeId } from './propertyTree';

/** Canonical mapping of section ids to persisted key suffixes */
const SECTION_KEY_BY_ID: Record<NavigationSectionId, string> = {
    [NavigationSectionId.SHORTCUTS]: 'shortcuts',
    [NavigationSectionId.RECENT]: 'recent',
    [NavigationSectionId.FOLDERS]: 'folders',
    [NavigationSectionId.TAGS]: 'tags',
    [NavigationSectionId.TOPICS]: 'topics',
    [NavigationSectionId.PROPERTIES]: 'properties'
};

/** Accepts canonical keys and documented aliases when parsing section entries */
const SECTION_ID_BY_KEY: Record<string, NavigationSectionId> = {
    shortcuts: NavigationSectionId.SHORTCUTS,
    recent: NavigationSectionId.RECENT,
    recents: NavigationSectionId.RECENT,
    folders: NavigationSectionId.FOLDERS,
    tags: NavigationSectionId.TAGS,
    topics: NavigationSectionId.TOPICS,
    properties: NavigationSectionId.PROPERTIES
};

export type SectionSeparatorTarget = {
    type: 'section';
    id: NavigationSectionId;
};

export type FolderSeparatorTarget = {
    type: 'folder';
    path: string;
};

export type TagSeparatorTarget = {
    type: 'tag';
    path: string;
};

export type PropertySeparatorTarget = {
    type: 'property';
    nodeId: string;
};

export type NavigationSeparatorTarget = SectionSeparatorTarget | FolderSeparatorTarget | TagSeparatorTarget | PropertySeparatorTarget;

const SECTION_PREFIX = 'section:';
const FOLDER_PREFIX = 'folder:';
const TAG_PREFIX = 'tag:';
const PROPERTY_PREFIX = 'property:';

/** Builds the persisted key for a section separator entry */
export function buildSectionSeparatorKey(id: NavigationSectionId): string {
    const suffix = SECTION_KEY_BY_ID[id] ?? id;
    return `${SECTION_PREFIX}${suffix}`;
}

/** Builds the persisted key for a folder separator entry */
export function buildFolderSeparatorKey(path: string): string {
    return `${FOLDER_PREFIX}${path}`;
}

/** Builds the persisted key for a tag separator entry */
export function buildTagSeparatorKey(path: string): string {
    return `${TAG_PREFIX}${path}`;
}

/** Builds the persisted key for a property separator entry */
export function buildPropertySeparatorKey(nodeId: string): string {
    return `${PROPERTY_PREFIX}${nodeId}`;
}

/** Parses a section key suffix (e.g. "shortcuts", "recents") into a NavigationSectionId */
function parseSectionKey(value: string): NavigationSectionId | null {
    const normalized = value.trim().toLowerCase();
    return SECTION_ID_BY_KEY[normalized] ?? null;
}

/** Converts a persisted separator key back into its structured representation */
export function parseNavigationSeparatorKey(key: string): NavigationSeparatorTarget | null {
    if (key.startsWith(SECTION_PREFIX)) {
        const sectionId = parseSectionKey(key.slice(SECTION_PREFIX.length));
        if (!sectionId) {
            return null;
        }
        return { type: 'section', id: sectionId };
    }

    if (key.startsWith(FOLDER_PREFIX)) {
        const path = key.slice(FOLDER_PREFIX.length);
        return {
            type: 'folder',
            path: path.length > 0 ? path : '/'
        };
    }

    if (key.startsWith(TAG_PREFIX)) {
        const path = key.slice(TAG_PREFIX.length);
        if (!path) {
            return null;
        }
        return {
            type: 'tag',
            path
        };
    }

    if (key.startsWith(PROPERTY_PREFIX)) {
        const nodeId = key.slice(PROPERTY_PREFIX.length);
        if (!nodeId) {
            return null;
        }
        return {
            type: 'property',
            nodeId
        };
    }

    return null;
}

/** Rebuilds a persisted separator key into canonical form */
export function normalizeNavigationSeparatorKey(key: string): string | null {
    const descriptor = parseNavigationSeparatorKey(key);
    if (!descriptor) {
        return null;
    }

    if (descriptor.type === 'section') {
        return buildSectionSeparatorKey(descriptor.id);
    }

    if (descriptor.type === 'folder') {
        return buildFolderSeparatorKey(descriptor.path);
    }

    if (descriptor.type === 'tag') {
        const normalizedTagPath = normalizeTagPath(descriptor.path);
        if (!normalizedTagPath) {
            return null;
        }
        return buildTagSeparatorKey(normalizedTagPath);
    }

    const normalizedNodeId = normalizePropertyNodeId(descriptor.nodeId);
    if (!normalizedNodeId) {
        return null;
    }

    return buildPropertySeparatorKey(normalizedNodeId);
}
