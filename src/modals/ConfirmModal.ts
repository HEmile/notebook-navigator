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

import { App, Modal } from 'obsidian';
import { strings } from '../i18n';

/**
 * Modal dialog for confirming destructive actions
 * Used primarily for delete confirmations with a warning-styled confirm button
 * Provides Cancel and Delete buttons with appropriate styling
 */
export class ConfirmModal extends Modal {
    private cancelBtn: HTMLButtonElement;
    private cancelHandler: () => void;
    private confirmBtn: HTMLButtonElement;
    private confirmHandler: () => void;

    /**
     * Creates a confirmation modal with title, message, and callback
     * @param app - The Obsidian app instance
     * @param title - Modal title (e.g., "Delete 'filename'?")
     * @param message - Confirmation message to display
     * @param onConfirm - Callback to execute when user confirms the action
     * @param confirmButtonText - Optional custom text for the confirm button (defaults to "Delete")
     */
    constructor(
        app: App,
        title: string,
        message: string,
        private onConfirm: () => void,
        confirmButtonText?: string
    ) {
        super(app);
        this.titleEl.setText(title);
        this.contentEl.createEl('p', { text: message });

        const buttonContainer = this.contentEl.createDiv('nn-button-container');

        // Store references for cleanup
        this.cancelHandler = () => this.close();
        this.confirmHandler = () => {
            this.close();
            this.onConfirm();
        };

        this.cancelBtn = buttonContainer.createEl('button', { text: strings.common.cancel });
        this.cancelBtn.addEventListener('click', this.cancelHandler);

        this.confirmBtn = buttonContainer.createEl('button', {
            text: confirmButtonText || strings.common.delete,
            cls: 'mod-warning'
        });
        this.confirmBtn.addEventListener('click', this.confirmHandler);

        // Keyboard shortcuts
        this.scope.register([], 'Enter', evt => {
            evt.preventDefault();
            this.close();
            this.onConfirm();
        });
        this.scope.register([], 'Escape', evt => {
            evt.preventDefault();
            this.close();
        });
    }

    /**
     * Cleanup event listeners when modal is closed
     * Prevents memory leaks by removing all event listeners
     */
    onClose() {
        if (this.cancelBtn && this.cancelHandler) {
            this.cancelBtn.removeEventListener('click', this.cancelHandler);
        }
        if (this.confirmBtn && this.confirmHandler) {
            this.confirmBtn.removeEventListener('click', this.confirmHandler);
        }
    }
}
