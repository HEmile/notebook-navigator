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

import { App, Modal } from 'obsidian';
import { strings } from '../i18n';

export type MoveFileConflictResolution = 'rename' | 'overwrite';
const MOVE_CONFLICT_PREVIEW_LIMIT = 8;

export interface MoveFileConflictItem {
    sourceFileName: string;
    suggestedFileName: string;
    canOverwrite: boolean;
}

interface MoveFileConflictModalOptions {
    targetFolderName: string;
    conflicts: MoveFileConflictItem[];
    onResolve: (value: MoveFileConflictResolution | null) => void;
}

/**
 * Modal dialog shown when one or more file moves hit destination conflicts.
 * Provides rename, overwrite, and cancel actions. Closing the modal cancels the move.
 */
export class MoveFileConflictModal extends Modal {
    private readonly targetFolderName: string;
    private readonly conflicts: MoveFileConflictItem[];
    private readonly onResolve: (value: MoveFileConflictResolution | null) => void;

    private hasResolved = false;

    constructor(app: App, options: MoveFileConflictModalOptions) {
        super(app);
        this.targetFolderName = options.targetFolderName;
        this.conflicts = options.conflicts;
        this.onResolve = options.onResolve;
    }

    onOpen(): void {
        const hasOverwriteConflicts = this.conflicts.some(conflict => conflict.canOverwrite);
        const descriptionTemplate =
            this.conflicts.length === 1
                ? strings.modals.fileSystem.moveFileConflictDescriptionSingle
                : strings.modals.fileSystem.moveFileConflictDescriptionMultiple;

        this.titleEl.setText(strings.modals.fileSystem.moveFileConflictTitle);

        this.contentEl.createEl('p', {
            text: descriptionTemplate.replace('{count}', this.conflicts.length.toString()).replace('{folder}', this.targetFolderName)
        });

        const previewContainer = this.contentEl.createDiv('nn-tag-rename-file-preview');
        previewContainer.createEl('h4', { text: strings.modals.fileSystem.moveFileConflictAffectedFiles });
        const listEl = previewContainer.createEl('ul');
        const previewConflicts = this.conflicts.slice(0, MOVE_CONFLICT_PREVIEW_LIMIT);
        previewConflicts.forEach(conflict => {
            const renameOnlySuffix = conflict.canOverwrite ? '' : ` ${strings.modals.fileSystem.moveFileConflictRenameOnly}`;
            listEl.createEl('li', {
                text: strings.modals.fileSystem.moveFileConflictItem
                    .replace('{name}', conflict.sourceFileName)
                    .replace('{suggested}', conflict.suggestedFileName)
                    .replace('{renameOnly}', renameOnlySuffix)
            });
        });
        const remainingConflicts = this.conflicts.length - previewConflicts.length;
        if (remainingConflicts > 0) {
            previewContainer.createEl('p', {
                text: strings.modals.tagOperation.andMore.replace('{count}', remainingConflicts.toString())
            });
        }

        const buttonContainer = this.contentEl.createDiv('nn-button-container');
        const cancelBtn = buttonContainer.createEl('button', { text: strings.common.cancel });
        cancelBtn.addEventListener('click', () => this.resolveAndClose(null));

        if (hasOverwriteConflicts) {
            const overwriteBtn = buttonContainer.createEl('button', {
                text: strings.modals.fileSystem.moveFileConflictOverwrite,
                cls: 'mod-warning'
            });
            overwriteBtn.addEventListener('click', () => this.resolveAndClose('overwrite'));
        }

        const renameBtn = buttonContainer.createEl('button', { text: strings.modals.fileSystem.moveFileConflictRename, cls: 'mod-cta' });
        renameBtn.addEventListener('click', () => this.resolveAndClose('rename'));

        this.scope.register([], 'Enter', event => {
            event.preventDefault();
            this.resolveAndClose('rename');
        });

        this.scope.register([], 'Escape', event => {
            event.preventDefault();
            this.resolveAndClose(null);
        });

        renameBtn.focus();
    }

    onClose(): void {
        this.contentEl.empty();
        if (!this.hasResolved) {
            this.hasResolved = true;
            this.onResolve(null);
        }
    }

    private resolveAndClose(value: MoveFileConflictResolution | null): void {
        if (this.hasResolved) {
            return;
        }

        this.hasResolved = true;
        this.onResolve(value);
        this.close();
    }
}
