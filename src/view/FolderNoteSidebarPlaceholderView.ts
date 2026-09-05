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

import { ItemView, WorkspaceLeaf } from 'obsidian';
import { NOTEBOOK_NAVIGATOR_ICON_ID } from '../constants/notebookNavigatorIcon';
import { strings } from '../i18n';
import { NOTEBOOK_NAVIGATOR_FOLDER_NOTE_SIDEBAR_VIEW } from '../types';

export class FolderNoteSidebarPlaceholderView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return NOTEBOOK_NAVIGATOR_FOLDER_NOTE_SIDEBAR_VIEW;
    }

    getDisplayText(): string {
        return strings.plugin.folderNoteSidebarViewName;
    }

    getIcon(): string {
        return NOTEBOOK_NAVIGATOR_ICON_ID;
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1];
        if (container.instanceOf(HTMLElement)) {
            container.empty();
        }
    }
}
