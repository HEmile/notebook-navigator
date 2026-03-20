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

import { PROPERTIES_ROOT_VIRTUAL_FOLDER_ID } from '../types';
import { normalizeOptionalVaultFolderPath } from '../utils/pathUtils';
import { normalizePropertyNodeId } from '../utils/propertyTree';
import { casefold } from '../utils/recordUtils';
import { normalizeTagPath } from '../utils/tagUtils';
import type { SearchProvider } from './search';

/**
 * Enum-like object defining all supported shortcut types
 */
export const ShortcutType = {
    FOLDER: 'folder',
    NOTE: 'note',
    SEARCH: 'search',
    TAG: 'tag',
    PROPERTY: 'property'
} as const;

export type ShortcutType = (typeof ShortcutType)[keyof typeof ShortcutType];

/**
 * MIME type for drag-and-drop operations with shortcuts
 */
export const SHORTCUT_DRAG_MIME = 'application/x-notebook-shortcut';

/**
 * Shortcut pointing to a folder in the vault
 */
interface ShortcutAlias {
    /**
     * Optional custom label shown in the shortcuts section.
     * Does not affect the underlying file, folder, or tag path.
     */
    alias?: string;
}

export interface FolderShortcut extends ShortcutAlias {
    type: typeof ShortcutType.FOLDER;
    path: string;
}

/**
 * Shortcut pointing to a note (file) in the vault
 */
export interface NoteShortcut extends ShortcutAlias {
    type: typeof ShortcutType.NOTE;
    path: string;
}

export const ShortcutStartType = {
    FOLDER: 'folder',
    TAG: 'tag',
    PROPERTY: 'property'
} as const;

export type ShortcutStartType = (typeof ShortcutStartType)[keyof typeof ShortcutStartType];

export interface ShortcutStartFolder {
    type: typeof ShortcutStartType.FOLDER;
    path: string;
}

export interface ShortcutStartTag {
    type: typeof ShortcutStartType.TAG;
    tagPath: string;
}

export interface ShortcutStartProperty {
    type: typeof ShortcutStartType.PROPERTY;
    nodeId: string;
}

export type ShortcutStartTarget = ShortcutStartFolder | ShortcutStartTag | ShortcutStartProperty;

/**
 * Shortcut for a saved search query
 */
export interface SearchShortcut {
    type: typeof ShortcutType.SEARCH;
    name: string;
    query: string;
    provider: SearchProvider;
    startTarget?: ShortcutStartTarget;
}

/**
 * Shortcut pointing to a tag
 */
export interface TagShortcut extends ShortcutAlias {
    type: typeof ShortcutType.TAG;
    tagPath: string;
}

/**
 * Shortcut pointing to a property key/value node
 */
export interface PropertyShortcut extends ShortcutAlias {
    type: typeof ShortcutType.PROPERTY;
    nodeId: string;
}

/**
 * Union type of all possible shortcut types
 */
export type ShortcutEntry = FolderShortcut | NoteShortcut | SearchShortcut | TagShortcut | PropertyShortcut;

/**
 * Type guard to check if a shortcut is a folder shortcut
 */
export function isFolderShortcut(shortcut: ShortcutEntry): shortcut is FolderShortcut {
    return shortcut.type === ShortcutType.FOLDER;
}

/**
 * Type guard to check if a shortcut is a note shortcut
 */
export function isNoteShortcut(shortcut: ShortcutEntry): shortcut is NoteShortcut {
    return shortcut.type === ShortcutType.NOTE;
}

/**
 * Type guard to check if a shortcut is a search shortcut
 */
export function isSearchShortcut(shortcut: ShortcutEntry): shortcut is SearchShortcut {
    return shortcut.type === ShortcutType.SEARCH;
}

interface ShortcutStartRecord {
    type?: unknown;
    path?: unknown;
    tagPath?: unknown;
    nodeId?: unknown;
}

function isShortcutStartRecord(value: unknown): value is ShortcutStartRecord {
    return typeof value === 'object' && value !== null;
}

export function isShortcutStartFolder(target: unknown): target is ShortcutStartFolder {
    return isShortcutStartRecord(target) && target.type === ShortcutStartType.FOLDER && typeof target.path === 'string';
}

export function isShortcutStartTag(target: unknown): target is ShortcutStartTag {
    return isShortcutStartRecord(target) && target.type === ShortcutStartType.TAG && typeof target.tagPath === 'string';
}

export function isShortcutStartProperty(target: unknown): target is ShortcutStartProperty {
    return isShortcutStartRecord(target) && target.type === ShortcutStartType.PROPERTY && typeof target.nodeId === 'string';
}

export function normalizePropertyShortcutNodeId(nodeId: unknown): string | null {
    if (nodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
        return PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;
    }

    if (typeof nodeId !== 'string') {
        return null;
    }

    return normalizePropertyNodeId(nodeId);
}

export function normalizeSearchShortcutName(name: string): string {
    return casefold(name);
}

export function normalizeShortcutStartTarget(startTarget: unknown): ShortcutStartTarget | undefined {
    if (isShortcutStartFolder(startTarget)) {
        const normalizedPath = normalizeOptionalVaultFolderPath(startTarget.path);
        if (!normalizedPath) {
            return undefined;
        }
        return {
            type: ShortcutStartType.FOLDER,
            path: normalizedPath
        };
    }

    if (isShortcutStartTag(startTarget)) {
        const normalizedTagPath = normalizeTagPath(startTarget.tagPath);
        if (!normalizedTagPath) {
            return undefined;
        }
        return {
            type: ShortcutStartType.TAG,
            tagPath: normalizedTagPath
        };
    }

    if (!isShortcutStartProperty(startTarget)) {
        return undefined;
    }

    const normalizedNodeId = normalizePropertyShortcutNodeId(startTarget.nodeId);
    if (!normalizedNodeId) {
        return undefined;
    }

    return {
        type: ShortcutStartType.PROPERTY,
        nodeId: normalizedNodeId
    };
}

export function getShortcutStartTargetFingerprint(startTarget: unknown): string {
    const normalized = normalizeShortcutStartTarget(startTarget);
    if (!normalized) {
        return '';
    }

    if (normalized.type === ShortcutStartType.FOLDER) {
        return `${ShortcutStartType.FOLDER}:${normalized.path}`;
    }

    if (normalized.type === ShortcutStartType.TAG) {
        return `${ShortcutStartType.TAG}:${normalized.tagPath}`;
    }

    return `${ShortcutStartType.PROPERTY}:${normalized.nodeId}`;
}

/**
 * Type guard to check if a shortcut is a tag shortcut
 */
export function isTagShortcut(shortcut: ShortcutEntry): shortcut is TagShortcut {
    return shortcut.type === ShortcutType.TAG;
}

export function isPropertyShortcut(shortcut: ShortcutEntry): shortcut is PropertyShortcut {
    return shortcut.type === ShortcutType.PROPERTY;
}

/**
 * Returns a deterministic key for the provided shortcut.
 * Keys are used to identify shortcuts without storing separate IDs.
 */
export function getShortcutKey(shortcut: ShortcutEntry): string {
    if (isFolderShortcut(shortcut)) {
        return `${ShortcutType.FOLDER}:${shortcut.path}`;
    }

    if (isNoteShortcut(shortcut)) {
        return `${ShortcutType.NOTE}:${shortcut.path}`;
    }

    if (isTagShortcut(shortcut)) {
        return `${ShortcutType.TAG}:${shortcut.tagPath}`;
    }

    if (isPropertyShortcut(shortcut)) {
        return `${ShortcutType.PROPERTY}:${shortcut.nodeId}`;
    }

    if (isSearchShortcut(shortcut)) {
        return `${ShortcutType.SEARCH}:${normalizeSearchShortcutName(shortcut.name)}`;
    }

    // Exhaustive check - ensures compiler warns if new shortcut type is added
    return assertNever(shortcut);
}

// Safely converts a value to string for error messages, handling JSON serialization failures
function describeShortcut(value: never): string {
    if (typeof value === 'object' && value !== null) {
        try {
            return JSON.stringify(value);
        } catch {
            return '[object Object]';
        }
    }
    return String(value);
}

// Exhaustive type check helper that throws with descriptive error message
function assertNever(value: never): never {
    throw new Error(`Unsupported shortcut type: ${describeShortcut(value)}`);
}
