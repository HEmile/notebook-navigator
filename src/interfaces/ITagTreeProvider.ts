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
 * Interface for providing access to tag tree paths
 * This abstraction allows services to access tag information without depending on the concrete plugin class
 */
export interface ITagTreeProvider {
    /**
     * Gets all tag paths from the tag tree
     * @returns Array of all tag paths
     */
    getAllTagPaths(): string[];
}

export interface ITopicGraphProvider {
    /**
     * Gets all topic names from the topic graph
     * @returns Array of all topic names
     */
    getAllTopicNames(): string[];
}
