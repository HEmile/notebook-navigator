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

import type { ISettingsProvider } from '../../interfaces/ISettingsProvider';
import { cleanupExclusionPatterns, isPathInExcludedFolder } from '../../utils/fileFilters';
import { ensureRecord, isStringRecordValue } from '../../utils/recordUtils';
import {
    ensureVaultProfiles,
    normalizeHiddenFolderPath,
    removeHiddenFolderExactMatches,
    updateHiddenFolderExactMatches
} from '../../utils/vaultProfiles';

export class FolderPathSettingsSync {
    constructor(private readonly settingsProvider: ISettingsProvider) {}

    public async syncHiddenFolderPathChange(previousPath: string, nextPath: string): Promise<void> {
        const updated = updateHiddenFolderExactMatches(this.settingsProvider.settings, previousPath, nextPath);
        if (!updated) {
            return;
        }

        try {
            await this.settingsProvider.saveSettingsAndUpdate();
        } catch (error) {
            console.error('Failed to persist hidden folder path updates', error);
        }
    }

    public async removeHiddenFolderPathMatch(targetPath: string): Promise<void> {
        const removed = removeHiddenFolderExactMatches(this.settingsProvider.settings, targetPath);
        if (!removed) {
            return;
        }

        try {
            await this.settingsProvider.saveSettingsAndUpdate();
        } catch (error) {
            console.error('Failed to persist hidden folder removal updates', error);
        }
    }

    public async hideFolderInOtherVaultProfiles(folderPath: string): Promise<void> {
        const normalizedPath = normalizeHiddenFolderPath(folderPath);
        if (!normalizedPath) {
            return;
        }

        const settings = this.settingsProvider.settings;
        ensureVaultProfiles(settings);
        const activeProfileId = settings.vaultProfile;
        let didUpdate = false;

        settings.vaultProfiles.forEach(profile => {
            if (profile.id === activeProfileId) {
                return;
            }

            if (!Array.isArray(profile.hiddenFolders)) {
                profile.hiddenFolders = [];
            }

            if (this.isFolderHiddenInProfile(normalizedPath, profile.hiddenFolders)) {
                return;
            }

            profile.hiddenFolders = cleanupExclusionPatterns(profile.hiddenFolders, normalizedPath);
            didUpdate = true;
        });

        if (!didUpdate) {
            return;
        }

        try {
            await this.settingsProvider.saveSettingsAndUpdate();
        } catch (error) {
            console.error('Failed to persist hidden folder preference for other vault profiles', error);
        }
    }

    public async copyFolderDisplayMetadata(sourcePath: string, targetPath: string): Promise<void> {
        if (!sourcePath || !targetPath || sourcePath === targetPath || sourcePath === '/') {
            return;
        }

        const sourcePrefix = `${sourcePath}/`;
        let changed = false;

        const processRecord = (record: Record<string, string> | undefined, updateRecord: (sanitized: Record<string, string>) => void) => {
            if (!record) {
                return;
            }

            const keys = Object.keys(record);
            let sanitized = record;
            let sanitizedApplied = false;

            for (const key of keys) {
                if (key !== sourcePath && !key.startsWith(sourcePrefix)) {
                    continue;
                }

                const value = record[key];
                if (typeof value !== 'string') {
                    continue;
                }

                if (!sanitizedApplied) {
                    sanitized = ensureRecord(record, isStringRecordValue);
                    updateRecord(sanitized);
                    sanitizedApplied = true;
                }

                const suffix = key === sourcePath ? '' : key.substring(sourcePrefix.length);
                const destinationPath = suffix ? `${targetPath}/${suffix}` : targetPath;

                if (Object.prototype.hasOwnProperty.call(sanitized, destinationPath)) {
                    continue;
                }

                sanitized[destinationPath] = value;
                changed = true;
            }
        };

        const settings = this.settingsProvider.settings;
        processRecord(settings.folderIcons, sanitized => {
            settings.folderIcons = sanitized;
        });
        processRecord(settings.folderColors, sanitized => {
            settings.folderColors = sanitized;
        });
        processRecord(settings.folderBackgroundColors, sanitized => {
            settings.folderBackgroundColors = sanitized;
        });

        if (!changed) {
            return;
        }

        try {
            await this.settingsProvider.saveSettingsAndUpdate();
        } catch (error) {
            console.error('Failed to persist folder display metadata after duplication', error);
        }
    }

    private isFolderHiddenInProfile(normalizedPath: string, patterns: string[]): boolean {
        if (!normalizedPath || !Array.isArray(patterns) || patterns.length === 0) {
            return false;
        }

        const trimmedPath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
        if (!trimmedPath) {
            return false;
        }

        const placeholderPath = `${trimmedPath}/__nn_new_folder__`;
        return isPathInExcludedFolder(placeholderPath, patterns);
    }
}
