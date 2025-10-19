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

/**
 * Storage system type definitions
 */

/**
 * Represents a node in the hierarchical tag tree.
 * Each node contains information about a tag and its nested children.
 */

export interface NNNode {
    name: string;

    children: Map<string, NNNode>;

    notesWithTag: Set<string>;
}

export interface TagTreeNode extends NNNode {
    /** The name of this part of the tag (e.g., "processing" for "inbox/processing") */
    name: string;
    /** The full path of the tag without # prefix - ALWAYS LOWERCASE for logic (e.g., "inbox/processing") */
    path: string;
    /** The canonical display path with original casing for UI (e.g., "Inbox/Processing") */
    displayPath: string;
    /** Map of child tag nodes, keyed by their lowercase name */
    children: Map<string, TagTreeNode>;
    /** Set of file paths that have this exact tag */
    notesWithTag: Set<string>;
}

export interface TopicNode extends NNNode {
    /** The name of this part of the topic (e.g., "artificial intelligence"). Does not include the extension. Currently no support for directory structures  */
    name: string;
    /** Map of parent topic nodes */
    parents: Map<string, TopicNode>;
    /** Map of child topic nodes */
    children: Map<string, TopicNode>;
    /** Set of file paths that have this exact topic */
    notesWithTag: Set<string>;
}
