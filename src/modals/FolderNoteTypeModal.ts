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

import { App, Modal, TFolder } from 'obsidian';
import { strings } from '../i18n';
import { FolderNoteType } from '../types/folderNote';

interface ButtonBinding {
    button: HTMLButtonElement;
    handler: () => void;
}

/**
 * Modal for choosing folder note type when creating a new folder note
 */
class FolderNoteTypeModal extends Modal {
    private readonly buttonBindings: ButtonBinding[] = [];
    private hasResolved = false;

    constructor(
        app: App,
        private folder: TFolder,
        private onSelect: (value: FolderNoteType | null) => void,
        private readonly folderDisplayName?: string
    ) {
        super(app);
    }

    onOpen(): void {
        this.modalEl.addClass('nn-folder-note-type-modal');
        this.titleEl.setText(strings.modals.folderNoteType.title);

        const infoEl = this.contentEl.createDiv('nn-folder-note-type-info');
        const displayName = this.folderDisplayName && this.folderDisplayName.length > 0 ? this.folderDisplayName : this.folder.name;
        infoEl.setText(strings.modals.folderNoteType.folderLabel.replace('{name}', displayName));

        const buttonContainer = this.contentEl.createDiv('nn-folder-note-type-buttons');

        const markdownButton = this.createTypeButton(buttonContainer, strings.settings.items.folderNoteType.options.markdown, 'markdown');

        this.createTypeButton(buttonContainer, strings.settings.items.folderNoteType.options.canvas, 'canvas');
        this.createTypeButton(buttonContainer, strings.settings.items.folderNoteType.options.base, 'base');

        const cancelButton = buttonContainer.createEl('button', {
            text: strings.common.cancel,
            cls: 'mod-warning'
        });
        this.bindButton(cancelButton, () => this.resolveAndClose(null));

        markdownButton.focus();

        this.scope.register([], 'Escape', evt => {
            evt.preventDefault();
            this.resolveAndClose(null);
        });
    }

    onClose(): void {
        for (const { button, handler } of this.buttonBindings) {
            button.removeEventListener('click', handler);
        }

        if (!this.hasResolved) {
            this.onSelect(null);
            this.hasResolved = true;
        }
    }

    private createTypeButton(container: HTMLElement, label: string, type: FolderNoteType): HTMLButtonElement {
        const button = container.createEl('button', { text: label });
        this.bindButton(button, () => this.resolveAndClose(type));
        return button;
    }

    private bindButton(button: HTMLButtonElement, handler: () => void): void {
        button.addEventListener('click', handler);
        this.buttonBindings.push({ button, handler });
    }

    private resolveAndClose(value: FolderNoteType | null): void {
        if (this.hasResolved) {
            return;
        }
        this.hasResolved = true;
        this.onSelect(value);
        this.close();
    }
}

/**
 * Opens folder note type modal and returns chosen type
 * @param app - Obsidian application instance
 * @param folder - Folder receiving new folder note
 * @param folderDisplayName - UI label for the folder
 * @returns Chosen folder note type or null if cancelled
 */
export function promptForFolderNoteType(app: App, folder: TFolder, folderDisplayName?: string): Promise<FolderNoteType | null> {
    return new Promise(resolve => {
        const modal = new FolderNoteTypeModal(app, folder, resolve, folderDisplayName);
        modal.open();
    });
}
