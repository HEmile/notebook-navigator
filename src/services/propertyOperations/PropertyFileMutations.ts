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

import type { App, TFile } from 'obsidian';
import { casefold } from '../../utils/recordUtils';

export class PropertyFileMutations {
    constructor(private readonly app: App) {}

    isMarkdownFile(file: TFile): boolean {
        return file.extension === 'md';
    }

    /**
     * Deletes YAML frontmatter keys that case-insensitively match the provided key.
     */
    async deletePropertyKeyFromFile(file: TFile, normalizedKey: string): Promise<boolean> {
        if (!this.isMarkdownFile(file)) {
            return false;
        }

        const targetKey = casefold(normalizedKey);
        if (!targetKey) {
            return false;
        }

        let changed = false;
        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
                const keys = Object.keys(frontmatter);
                for (const key of keys) {
                    if (casefold(key) !== targetKey) {
                        continue;
                    }
                    delete frontmatter[key];
                    changed = true;
                }
            });
        } catch (error: unknown) {
            console.error(`[Notebook Navigator] Failed to delete property key "${normalizedKey}" from ${file.path}`, error);
            throw error;
        }

        return changed;
    }

    /**
     * Renames a YAML frontmatter key in a markdown file.
     *
     * Matching is case-insensitive. If the destination key already exists, its value is replaced by the source value.
     * The resulting frontmatter contains a single key using the exact `newKeyDisplay` casing.
     */
    async renamePropertyKeyInFile(file: TFile, params: { oldKey: string; newKeyDisplay: string }): Promise<boolean> {
        if (!this.isMarkdownFile(file)) {
            return false;
        }

        const oldKey = casefold(params.oldKey);
        const newKeyDisplay = params.newKeyDisplay.trim();
        const newKey = casefold(newKeyDisplay);
        if (!oldKey || !newKey || newKeyDisplay.length === 0) {
            return false;
        }

        let changed = false;
        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
                const keys = Object.keys(frontmatter);
                const sourceKeys = keys.filter(key => casefold(key) === oldKey);
                if (sourceKeys.length === 0) {
                    return;
                }

                const destinationKeys = keys.filter(key => casefold(key) === newKey);
                const keysToDelete = new Set<string>([...sourceKeys, ...destinationKeys]);
                keysToDelete.delete(newKeyDisplay);

                const pickSourceKey = (): string => {
                    const exactMatch = sourceKeys.find(key => key === params.oldKey);
                    if (exactMatch) {
                        return exactMatch;
                    }
                    const sorted = sourceKeys.slice().sort((a, b) => a.localeCompare(b));
                    return sorted[0] ?? sourceKeys[0] ?? params.oldKey;
                };

                const sourceKey = pickSourceKey();
                const value = frontmatter[sourceKey];
                frontmatter[newKeyDisplay] = value;
                keysToDelete.forEach(key => {
                    delete frontmatter[key];
                });
                changed = true;
            });
        } catch (error: unknown) {
            console.error(
                `[Notebook Navigator] Failed to rename property key "${params.oldKey}" → "${params.newKeyDisplay}" in ${file.path}`,
                error
            );
            throw error;
        }

        return changed;
    }
}
