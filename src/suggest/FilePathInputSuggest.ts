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

import { AbstractInputSuggest, App, TFile } from 'obsidian';
import { buildPathSuggestionItems, renderPathSuggestion, type PathSuggestionItem } from './pathInputSuggestUtils';
import { normalizeOptionalVaultFilePath } from '../utils/pathUtils';

type FileSuggestionItem = PathSuggestionItem<TFile>;

interface FilePathInputSuggestOptions {
    getBaseFolder?: () => string;
    includeFile?: (file: TFile) => boolean;
    limit?: number;
}

const DEFAULT_FILE_SUGGEST_LIMIT = 200;

/**
 * File path suggestion popover for settings text inputs.
 * Uses Obsidian's built-in suggest popover so the UI matches the rest of the app.
 */
export class FilePathInputSuggest extends AbstractInputSuggest<FileSuggestionItem> {
    private readonly inputEl: HTMLInputElement;
    private readonly getBaseFolder: () => string;
    private readonly includeFile: (file: TFile) => boolean;

    constructor(app: App, inputEl: HTMLInputElement, options?: FilePathInputSuggestOptions) {
        super(app, inputEl);
        this.inputEl = inputEl;
        this.getBaseFolder = options?.getBaseFolder ?? (() => '');
        this.includeFile = options?.includeFile ?? (() => true);
        this.limit = options?.limit ?? DEFAULT_FILE_SUGGEST_LIMIT;
    }

    getSuggestions(query: string): FileSuggestionItem[] {
        const baseFolder = this.getNormalizedBaseFolder(this.getBaseFolder);
        const folderPrefix = baseFolder ? `${baseFolder}/` : '';
        const files = this.app.vault
            .getFiles()
            .filter(file => this.includeFile(file) && (folderPrefix === '' || file.path.startsWith(folderPrefix)));
        return buildPathSuggestionItems({
            items: files,
            query,
            limit: this.limit,
            getPath: file => file.path
        });
    }

    renderSuggestion(value: FileSuggestionItem, el: HTMLElement): void {
        renderPathSuggestion(value, el);
    }

    selectSuggestion(value: FileSuggestionItem): void {
        this.inputEl.value = value.path;
        this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        this.close();
    }

    private getNormalizedBaseFolder(getValue: () => string): string {
        return normalizeOptionalVaultFilePath(getValue()) ?? '';
    }
}
