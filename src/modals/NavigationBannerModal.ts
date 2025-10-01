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

import { App, TFile } from 'obsidian';
import { BaseSuggestModal } from './BaseSuggestModal';
import { strings } from '../i18n';
import { naturalCompare } from '../utils/sortUtils';
import { isImageFile } from '../utils/fileTypeUtils';

/**
 * Modal for selecting the navigation banner image.
 * Filters vault files to only show supported image formats.
 */
export class NavigationBannerModal extends BaseSuggestModal<TFile> {
    constructor(app: App, onChoose: (file: TFile) => void) {
        super(app, onChoose, strings.modals.navigationBanner.placeholder, {
            navigate: strings.modals.navigationBanner.instructions.navigate,
            action: strings.modals.navigationBanner.instructions.select,
            dismiss: strings.modals.navigationBanner.instructions.dismiss
        });
    }

    /**
     * Get all image files available in the vault, sorted by path.
     */
    getItems(): TFile[] {
        const files = this.app.vault.getFiles().filter(file => isImageFile(file));
        files.sort((first, second) => naturalCompare(first.path, second.path));
        return files;
    }

    /**
     * Display file path for each suggestion row.
     */
    getItemText(file: TFile): string {
        return file.path;
    }

    /**
     * Display path is identical to item text for consistency.
     */
    protected getDisplayPath(file: TFile): string {
        return file.path;
    }
}
