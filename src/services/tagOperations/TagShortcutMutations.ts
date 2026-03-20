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

import { normalizeTagPath } from '../../utils/tagUtils';
import type { ShortcutEntry } from '../../types/shortcuts';
import { isTagShortcut } from '../../types/shortcuts';
import { mutateVaultProfileShortcuts } from '../../utils/vaultProfiles';
import type { MetadataService } from '../MetadataService';

/**
 * Handles updates to tag shortcuts when tags are renamed or deleted
 */
export class TagShortcutMutations {
    constructor(private readonly getMetadataService: () => MetadataService | null) {}

    /**
     * Updates all tag shortcuts after a tag is renamed
     * Handles both direct matches and descendant tags
     */
    async updateTagShortcutsAfterRename(oldTagPath: string, newTagPath: string): Promise<void> {
        const normalizedOld = normalizeTagPath(oldTagPath);
        const normalizedNew = normalizeTagPath(newTagPath);
        if (!normalizedOld || !normalizedNew || normalizedOld === normalizedNew) {
            return;
        }

        await this.mutateTagShortcuts(shortcuts => {
            const prefix = `${normalizedOld}/`;
            const preservedPaths = new Set<string>();
            for (const shortcut of shortcuts) {
                if (isTagShortcut(shortcut)) {
                    const tagPath = normalizeTagPath(shortcut.tagPath) ?? shortcut.tagPath;
                    if (tagPath !== normalizedOld && !tagPath.startsWith(prefix)) {
                        preservedPaths.add(tagPath);
                    }
                }
            }

            const occupiedPaths = new Set<string>();
            let changed = false;
            const updated: ShortcutEntry[] = [];

            for (const shortcut of shortcuts) {
                if (!isTagShortcut(shortcut)) {
                    updated.push(shortcut);
                    continue;
                }

                const currentPath = normalizeTagPath(shortcut.tagPath) ?? shortcut.tagPath;
                const isDirectMatch = currentPath === normalizedOld;
                const isDescendantMatch = currentPath.startsWith(prefix);
                let targetPath = currentPath;

                if (isDirectMatch || isDescendantMatch) {
                    const suffix = isDescendantMatch ? currentPath.slice(prefix.length) : '';
                    targetPath = suffix.length > 0 ? `${normalizedNew}/${suffix}` : normalizedNew;
                    if (targetPath !== currentPath) {
                        changed = true;
                    }
                }

                if ((isDirectMatch || isDescendantMatch) && preservedPaths.has(targetPath)) {
                    changed = true;
                    continue;
                }

                if (occupiedPaths.has(targetPath)) {
                    if (targetPath !== currentPath) {
                        changed = true;
                    }
                    continue;
                }

                const nextShortcut = targetPath === shortcut.tagPath ? shortcut : { ...shortcut, tagPath: targetPath };
                updated.push(nextShortcut);
                occupiedPaths.add(targetPath);
                preservedPaths.add(targetPath);
            }

            return { changed, next: updated };
        }, 'Failed to update tag shortcuts after rename');
    }

    /**
     * Removes tag shortcuts after a tag is deleted
     * Also removes shortcuts for all descendant tags
     */
    async removeTagShortcutsAfterDelete(tagPath: string): Promise<void> {
        const normalizedPath = normalizeTagPath(tagPath);
        if (!normalizedPath) {
            return;
        }

        await this.mutateTagShortcuts(shortcuts => {
            const prefix = `${normalizedPath}/`;
            let changed = false;
            const filtered: ShortcutEntry[] = [];

            for (const shortcut of shortcuts) {
                if (!isTagShortcut(shortcut)) {
                    filtered.push(shortcut);
                    continue;
                }

                const currentPath = normalizeTagPath(shortcut.tagPath) ?? shortcut.tagPath;
                if (currentPath === normalizedPath || currentPath.startsWith(prefix)) {
                    changed = true;
                    continue;
                }

                filtered.push(shortcut);
            }

            return { changed, next: filtered };
        }, 'Failed to remove tag shortcuts after delete');
    }

    /**
     * Helper method to mutate tag shortcuts with atomic save
     * Applies changes and persists them to settings
     */
    private async mutateTagShortcuts(
        apply: (shortcuts: ShortcutEntry[]) => { changed: boolean; next: ShortcutEntry[] },
        failureContext: string
    ): Promise<void> {
        const metadataService = this.getMetadataService();
        const settingsProvider = metadataService?.getSettingsProvider();
        if (!settingsProvider) {
            return;
        }

        // Applies shortcut transformation to all vault profiles
        const didChange = mutateVaultProfileShortcuts(settingsProvider.settings.vaultProfiles, shortcuts => {
            const { changed, next } = apply(shortcuts);
            return changed ? next : null;
        });

        if (!didChange) {
            return;
        }

        try {
            await settingsProvider.saveSettingsAndUpdate();
        } catch (error) {
            console.error(`[Notebook Navigator] ${failureContext}`, error);
        }
    }
}
