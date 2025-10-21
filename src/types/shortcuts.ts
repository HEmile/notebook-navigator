/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

import type { SearchProvider } from './search';

/**
 * Enum-like object defining all supported shortcut types
 */
export const ShortcutType = {
    FOLDER: 'folder',
    NOTE: 'note',
    SEARCH: 'search',
    TAG: 'tag',
    TOPIC: 'topic'
} as const;

export type ShortcutType = (typeof ShortcutType)[keyof typeof ShortcutType];

/**
 * Shortcut pointing to a folder in the vault
 */
export interface FolderShortcut {
    type: typeof ShortcutType.FOLDER;
    path: string;
}

/**
 * Shortcut pointing to a note (file) in the vault
 */
export interface NoteShortcut {
    type: typeof ShortcutType.NOTE;
    path: string;
}

/**
 * Shortcut for a saved search query
 */
export interface SearchShortcut {
    type: typeof ShortcutType.SEARCH;
    name: string;
    query: string;
    provider: SearchProvider;
}

/**
 * Shortcut pointing to a tag
 */
export interface TagShortcut {
    type: typeof ShortcutType.TAG;
    tagPath: string;
}

/**
 * Shortcut pointing to a topic
 */
export interface TopicShortcut {
    type: typeof ShortcutType.TOPIC;
    topicName: string;
}

/**
 * Union type of all possible shortcut types
 */
export type ShortcutEntry = FolderShortcut | NoteShortcut | SearchShortcut | TagShortcut | TopicShortcut;

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

/**
 * Type guard to check if a shortcut is a tag shortcut
 */
export function isTagShortcut(shortcut: ShortcutEntry): shortcut is TagShortcut {
    return shortcut.type === ShortcutType.TAG;
}

/**
 * Type guard to check if a shortcut is a topic shortcut
 */
export function isTopicShortcut(shortcut: ShortcutEntry): shortcut is TopicShortcut {
    return shortcut.type === ShortcutType.TOPIC;
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

    if (isTopicShortcut(shortcut)) {
        return `${ShortcutType.TOPIC}:${shortcut.topicName}`;
    }

    if (isSearchShortcut(shortcut)) {
        return `${ShortcutType.SEARCH}:${shortcut.name.toLowerCase()}`;
    }

    // Exhaustive check - ensures compiler warns if new shortcut type is added
    const exhaustiveCheck: never = shortcut;
    throw new Error(`Unsupported shortcut type: ${exhaustiveCheck}`);
}
