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

import { AbstractInputSuggest, App, TFolder } from 'obsidian';
import { buildPathSuggestionItems, renderPathSuggestion, type PathSuggestionItem } from './pathInputSuggestUtils';

type FolderSuggestionItem = PathSuggestionItem<TFolder>;

const DEFAULT_FOLDER_SUGGEST_LIMIT = 200;

/**
 * Folder path suggestion popover for settings text inputs.
 * Uses Obsidian's built-in suggest popover so the UI matches the rest of the app.
 */
export class FolderPathInputSuggest extends AbstractInputSuggest<FolderSuggestionItem> {
    private readonly inputEl: HTMLInputElement;

    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.inputEl = inputEl;
        this.limit = DEFAULT_FOLDER_SUGGEST_LIMIT;
    }

    getSuggestions(query: string): FolderSuggestionItem[] {
        const folders = this.app.vault.getAllLoadedFiles().filter((file): file is TFolder => file instanceof TFolder);
        return buildPathSuggestionItems({
            items: folders,
            query,
            limit: this.limit,
            getPath: folder => folder.path,
            getDisplayPath: (_folder, path) => (path === '/' ? '' : path)
        });
    }

    renderSuggestion(value: FolderSuggestionItem, el: HTMLElement): void {
        renderPathSuggestion(value, el);
    }

    selectSuggestion(value: FolderSuggestionItem): void {
        this.inputEl.value = value.displayPath;
        this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        this.close();
    }
}
