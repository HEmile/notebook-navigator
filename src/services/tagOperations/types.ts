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

import type { App } from 'obsidian';
import type { TagDescriptor } from '../tagRename/TagRenameEngine';

export interface TagRenameEventPayload {
    /** Original tag path without # prefix (preserves casing) */
    oldPath: string;
    /** New tag path without # prefix (preserves casing) */
    newPath: string;
    /** Original canonical lowercase tag path */
    oldCanonicalPath: string;
    /** New canonical lowercase tag path */
    newCanonicalPath: string;
    /** Indicates if rename merged into an existing tag */
    mergedIntoExisting: boolean;
}

export interface TagDeleteEventPayload {
    /** Deleted tag path without # prefix (preserves casing) */
    path: string;
    /** Deleted canonical lowercase tag path */
    canonicalPath: string;
}

export interface TagUsageSummary {
    total: number;
    sample: string[];
}

export interface TagPreviewCollector {
    collectPreviewPaths(app: App, tag: TagDescriptor): string[];
}
