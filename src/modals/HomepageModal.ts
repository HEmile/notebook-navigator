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

import { App, TFile } from 'obsidian';
import { BaseSuggestModal } from './BaseSuggestModal';
import { strings } from '../i18n';
import { naturalCompare } from '../utils/sortUtils';
import { isSupportedHomepageExtension } from '../utils/homepageUtils';

/**
 * Modal for selecting the homepage file.
 * Allows users to select a Markdown, Canvas, or Excalidraw file as their homepage.
 */
export class HomepageModal extends BaseSuggestModal<TFile> {
    constructor(app: App, onChoose: (file: TFile) => void) {
        super(app, onChoose, strings.modals.homepage.placeholder, {
            navigate: strings.modals.homepage.instructions.navigate,
            action: strings.modals.homepage.instructions.select,
            dismiss: strings.modals.homepage.instructions.dismiss
        });
    }

    /**
     * Get all files that can be used as a homepage
     * Filters for supported file extensions and sorts them alphabetically
     */
    getItems(): TFile[] {
        const files = this.app.vault.getFiles().filter(file => isSupportedHomepageExtension(file.extension));
        files.sort((a, b) => naturalCompare(a.path, b.path));
        return files;
    }

    /**
     * Get the text to display for a file in the suggestion list
     */
    getItemText(file: TFile): string {
        return file.path;
    }

    /**
     * Get the display path for a file (used for rendering)
     */
    protected getDisplayPath(file: TFile): string {
        return file.path;
    }
}
