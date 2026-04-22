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

import type { TFile } from 'obsidian';
import { TagFileMutations } from './TagFileMutations';

/**
 * Handles batch tag operations on multiple files
 */
export class TagBatchOperations {
    constructor(private readonly fileMutations: TagFileMutations) {}

    /**
     * Adds a tag to multiple files
     * Skips non-markdown files and files that already have the tag or its ancestor
     */
    async addTagToFiles(tag: string, files: TFile[]): Promise<{ added: number; skipped: number }> {
        let added = 0;
        let skipped = 0;

        for (const file of files) {
            if (!this.fileMutations.isMarkdownFile(file)) {
                skipped++;
                continue;
            }

            if (await this.fileMutations.fileHasTagOrAncestor(file, tag)) {
                skipped++;
                continue;
            }

            await this.fileMutations.addTagToFile(file, tag);
            added++;
        }

        return { added, skipped };
    }

    /**
     * Removes a specific tag from multiple files
     * Returns count of files where the tag was actually removed
     */
    async removeTagFromFiles(tag: string, files: TFile[]): Promise<number> {
        let removed = 0;

        for (const file of files) {
            if (!this.fileMutations.isMarkdownFile(file)) {
                continue;
            }

            try {
                if (await this.fileMutations.removeTagFromFile(file, tag)) {
                    removed++;
                }
            } catch (error: unknown) {
                console.error(`[Notebook Navigator] Failed to remove tag ${tag} from ${file.path}`, error);
            }
        }

        return removed;
    }

    /**
     * Removes all tags from multiple files
     * Returns count of files where tags were actually removed
     */
    async clearAllTagsFromFiles(files: TFile[]): Promise<number> {
        let cleared = 0;

        for (const file of files) {
            if (!this.fileMutations.isMarkdownFile(file)) {
                continue;
            }

            if (await this.fileMutations.clearAllTagsFromFile(file)) {
                cleared++;
            }
        }

        return cleared;
    }

    /**
     * Collects all unique tags from multiple files
     * Returns sorted array of tag strings without # prefix
     */
    getTagsFromFiles(files: TFile[]): string[] {
        return this.fileMutations.getTagsFromFiles(files);
    }
}
