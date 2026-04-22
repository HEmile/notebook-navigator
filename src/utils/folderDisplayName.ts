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
import type { MetadataService } from '../services/MetadataService';
import type { NotebookNavigatorSettings } from '../settings';

interface ResolveFolderDisplayNameParams {
    app: App;
    metadataService: MetadataService;
    settings: Pick<NotebookNavigatorSettings, 'customVaultName'>;
    folderPath: string;
    fallbackName: string;
}

/**
 * Resolves the label used in UI for a folder path.
 */
export function resolveFolderDisplayName(params: ResolveFolderDisplayNameParams): string {
    const { app, metadataService, settings, folderPath, fallbackName } = params;

    if (folderPath === '/') {
        return settings.customVaultName || app.vault.getName();
    }

    const metadataDisplayName = metadataService.getFolderDisplayData(folderPath, {
        includeDisplayName: true,
        includeColor: false,
        includeBackgroundColor: false,
        includeIcon: false
    }).displayName;
    if (metadataDisplayName && metadataDisplayName.length > 0) {
        return metadataDisplayName;
    }

    return fallbackName;
}
