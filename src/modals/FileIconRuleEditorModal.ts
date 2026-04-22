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

import { App, Modal, setIcon } from 'obsidian';
import { strings } from '../i18n';
import { getIconService } from '../services/icons';
import type { IconId } from '../services/icons/types';
import { MetadataService } from '../services/MetadataService';
import { ItemType } from '../types';
import { runAsyncAction } from '../utils/async';
import { addAsyncEventListener } from '../utils/domEventListeners';
import {
    deserializeIconFromFrontmatter,
    normalizeIconMapEntry,
    normalizeIconMapRecord,
    normalizeCanonicalIconId
} from '../utils/iconizeFormat';
import { sanitizeRecord } from '../utils/recordUtils';

/** Editing mode for file icon rules: either by file name or file type/extension */
type FileIconRuleEditorMode = 'fileName' | 'fileType';

/** Configuration options for the file icon rule editor modal */
interface FileIconRuleEditorModalOptions {
    title: string;
    mode: FileIconRuleEditorMode;
    initialMap: Record<string, string>;
    fallbackIconId?: IconId;
    metadataService: MetadataService;
    onSave: (nextMap: Record<string, string>) => Promise<void> | void;
    normalizeKey: (input: string) => string;
}

/** Internal representation of a single icon mapping rule */
interface RuleRow {
    id: string;
    keyInput: string;
    iconId: IconId;
}

/** DOM element references for a rendered rule row */
interface RowControls {
    rowEl: HTMLDivElement;
    inputEl: HTMLInputElement;
    iconSpan: HTMLSpanElement;
}

/**
 * Modal for visually editing file icon mapping rules.
 * Displays a list of key-icon pairs with inline editing and icon picker integration.
 */
export class FileIconRuleEditorModal extends Modal {
    private iconService = getIconService();
    private rows: RuleRow[];
    private listEl: HTMLDivElement | null = null;
    private rowDisposers: (() => void)[] = [];
    private footerDisposers: (() => void)[] = [];
    private rowControls = new Map<string, RowControls>();
    private applyButton: HTMLButtonElement | null = null;
    private rowIdCounter = 0;

    constructor(
        app: App,
        private options: FileIconRuleEditorModalOptions
    ) {
        super(app);
        this.rows = this.deserializeRows(options.initialMap);
    }

    onOpen(): void {
        this.modalEl.addClass('nn-file-icon-rule-editor-modal');
        this.titleEl.setText(this.options.title);
        this.contentEl.empty();

        // Scroll container allows the list to scroll independently of the fixed footer
        const scrollContainer = this.contentEl.createDiv({ cls: 'nn-file-icon-rule-editor-scroll' });
        this.listEl = scrollContainer.createDiv({ cls: 'nn-file-icon-rule-editor-list' });
        this.renderRows();
        this.renderFooter();
        this.updateApplyButtonState();
    }

    onClose(): void {
        this.disposeRowDisposers();
        this.disposeFooterDisposers();
        this.rowControls.clear();
        this.listEl = null;
        this.applyButton = null;
        this.modalEl.removeClass('nn-file-icon-rule-editor-modal');
        this.contentEl.empty();
    }

    /** Converts an icon map record into internal row representation */
    private deserializeRows(map: Record<string, string>): RuleRow[] {
        const entries = Object.entries(map)
            .filter(([key, iconId]) => Boolean(key) && Boolean(iconId))
            .sort(([a], [b]) => a.localeCompare(b));

        const fallbackIconId = this.options.fallbackIconId ?? 'file';
        return entries.map(([key, iconValue]) => {
            const canonicalIconId = deserializeIconFromFrontmatter(iconValue) ?? fallbackIconId;
            return {
                id: this.nextRowId(),
                keyInput: key,
                iconId: normalizeCanonicalIconId(canonicalIconId)
            };
        });
    }

    /** Generates a unique identifier for a new row */
    private nextRowId(): string {
        this.rowIdCounter += 1;
        return `row-${this.rowIdCounter}`;
    }

    /** Cleans up event listeners attached to row elements */
    private disposeRowDisposers(): void {
        const disposers = this.rowDisposers;
        this.rowDisposers = [];
        disposers.forEach(disposer => {
            try {
                disposer();
            } catch (error) {
                console.error('[FileIconRuleEditorModal] Failed to dispose row handler', error);
            }
        });
    }

    /** Cleans up event listeners attached to footer buttons */
    private disposeFooterDisposers(): void {
        const disposers = this.footerDisposers;
        this.footerDisposers = [];
        disposers.forEach(disposer => {
            try {
                disposer();
            } catch (error) {
                console.error('[FileIconRuleEditorModal] Failed to dispose footer handler', error);
            }
        });
    }

    /** Rebuilds the rule list UI from the current rows state */
    private renderRows(): void {
        if (!this.listEl) {
            return;
        }

        this.disposeRowDisposers();
        this.rowControls.clear();
        this.listEl.empty();

        this.rows.forEach(row => {
            const rowEl = this.listEl?.createDiv({ cls: 'nn-file-icon-rule-row' });
            if (!rowEl) {
                return;
            }

            const iconButtonEl = rowEl.createEl('button', {
                cls: 'nn-action-btn',
                attr: { type: 'button', 'aria-label': strings.contextMenu.file.changeIcon }
            });
            const iconSpan = iconButtonEl.createSpan();
            this.iconService.renderIcon(iconSpan, row.iconId, 16);
            this.rowDisposers.push(
                addAsyncEventListener(iconButtonEl, 'click', () => {
                    this.openIconPicker(row.id);
                })
            );

            const inputEl = rowEl.createEl('input', {
                cls: 'nn-input nn-file-icon-rule-key',
                attr: {
                    type: 'text',
                    placeholder: this.options.mode === 'fileType' ? '.pdf' : 'meeting'
                }
            });
            inputEl.value = row.keyInput;
            this.rowDisposers.push(
                addAsyncEventListener(inputEl, 'input', () => {
                    this.handleRowKeyInput(row.id, inputEl.value);
                })
            );

            const deleteBtn = rowEl.createEl('button', {
                cls: 'nn-action-btn mod-warning',
                attr: { type: 'button', 'aria-label': strings.common.delete }
            });
            setIcon(deleteBtn, 'lucide-trash-2');
            this.rowDisposers.push(
                addAsyncEventListener(deleteBtn, 'click', () => {
                    this.deleteRow(row.id);
                })
            );

            this.rowControls.set(row.id, { rowEl, inputEl, iconSpan });
        });

        this.updateApplyButtonState();
    }

    /** Creates the modal footer with add, cancel, and apply buttons */
    private renderFooter(): void {
        this.disposeFooterDisposers();

        const footer = this.contentEl.createDiv({ cls: 'nn-file-icon-rule-editor-footer nn-button-container' });

        const addButton = footer.createEl('button', {
            attr: { type: 'button', 'aria-label': strings.modals.fileIconRuleEditor.addRuleAria }
        });
        setIcon(addButton, 'lucide-plus');
        this.footerDisposers.push(
            addAsyncEventListener(addButton, 'click', () => {
                this.addRow();
            })
        );

        const cancelButton = footer.createEl('button', { text: strings.common.cancel, attr: { type: 'button' } });
        this.footerDisposers.push(
            addAsyncEventListener(cancelButton, 'click', () => {
                this.close();
            })
        );

        this.applyButton = footer.createEl('button', {
            cls: 'mod-cta',
            text: strings.modals.colorPicker.apply,
            attr: { type: 'button' }
        });
        this.footerDisposers.push(
            addAsyncEventListener(this.applyButton, 'click', () => {
                this.applyChanges();
            })
        );
    }

    /** Appends a new empty rule row and focuses its input */
    private addRow(): void {
        const fallbackIconId = this.options.fallbackIconId ?? 'file';
        this.rows.push({ id: this.nextRowId(), keyInput: '', iconId: fallbackIconId });
        this.renderRows();
        const newRow = this.rows[this.rows.length - 1];
        const controls = this.rowControls.get(newRow.id);
        controls?.inputEl.focus();
        // Ensure the new row is visible when the list is scrollable
        controls?.rowEl.scrollIntoView({ block: 'nearest' });
    }

    /** Removes a rule row by its identifier */
    private deleteRow(rowId: string): void {
        this.rows = this.rows.filter(row => row.id !== rowId);
        this.renderRows();
    }

    /** Updates a row's key value when the input changes */
    private handleRowKeyInput(rowId: string, value: string): void {
        const row = this.rows.find(candidate => candidate.id === rowId);
        if (!row) {
            return;
        }
        row.keyInput = value;
        this.updateApplyButtonState();
    }

    /** Opens the icon picker modal for a specific rule row */
    private openIconPicker(rowId: string): void {
        const row = this.rows.find(candidate => candidate.id === rowId);
        if (!row) {
            return;
        }

        runAsyncAction(async () => {
            const { IconPickerModal } = await import('./IconPickerModal');
            const keyLabel = this.options.normalizeKey(row.keyInput);
            const titleOverride = keyLabel ? `${this.options.title}: ${keyLabel}` : this.options.title;

            const picker = new IconPickerModal(this.app, this.options.metadataService, '', ItemType.FILE, {
                titleOverride,
                currentIconId: row.iconId,
                showRemoveButton: false,
                disableMetadataUpdates: true
            });

            picker.onChooseIcon = async iconId => {
                if (!iconId) {
                    return { handled: true };
                }
                this.setRowIcon(rowId, iconId);
                return { handled: true };
            };

            picker.open();
        });
    }

    /** Updates the icon for a specific rule row and refreshes its preview */
    private setRowIcon(rowId: string, iconId: IconId): void {
        const row = this.rows.find(candidate => candidate.id === rowId);
        if (!row) {
            return;
        }

        row.iconId = normalizeCanonicalIconId(iconId);
        const controls = this.rowControls.get(rowId);
        if (controls) {
            this.iconService.renderIcon(controls.iconSpan, row.iconId, 16);
        }
        this.updateApplyButtonState();
    }

    /** Enables or disables the apply button and highlights invalid rows */
    private updateApplyButtonState(): void {
        const state = this.computeValidationState();
        if (this.applyButton) {
            this.applyButton.disabled = !state.isValid;
        }
        state.invalidRowIds.forEach(id => {
            const controls = this.rowControls.get(id);
            controls?.rowEl.addClass('nn-file-icon-rule-row-invalid');
        });
        this.rowControls.forEach((controls, id) => {
            if (!state.invalidRowIds.has(id)) {
                controls.rowEl.removeClass('nn-file-icon-rule-row-invalid');
            }
        });
    }

    /** Validates all rows, detecting empty keys, invalid icons, and duplicate keys */
    private computeValidationState(): { isValid: boolean; invalidRowIds: Set<string> } {
        const invalidRowIds = new Set<string>();
        const normalizedKeyToRowIds = new Map<string, string[]>();

        this.rows.forEach(row => {
            const normalizedKey = this.options.normalizeKey(row.keyInput);
            const entry = normalizeIconMapEntry(normalizedKey, row.iconId, this.options.normalizeKey);
            if (!entry) {
                invalidRowIds.add(row.id);
                return;
            }

            const list = normalizedKeyToRowIds.get(entry.key) ?? [];
            list.push(row.id);
            normalizedKeyToRowIds.set(entry.key, list);
        });

        // Mark rows with duplicate normalized keys as invalid
        normalizedKeyToRowIds.forEach(rowIds => {
            if (rowIds.length > 1) {
                rowIds.forEach(rowId => invalidRowIds.add(rowId));
            }
        });

        return { isValid: invalidRowIds.size === 0, invalidRowIds };
    }

    /** Normalizes and persists the current rules, then closes the modal */
    private applyChanges(): void {
        const state = this.computeValidationState();
        if (!state.isValid) {
            return;
        }

        const draft = sanitizeRecord<string>(undefined);
        this.rows.forEach(row => {
            draft[row.keyInput] = row.iconId;
        });

        const normalized: Record<string, string> = normalizeIconMapRecord(draft, this.options.normalizeKey);
        runAsyncAction(async () => {
            await this.options.onSave(normalized);
            this.close();
        });
    }
}
