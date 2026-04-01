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

import { App, ButtonComponent, Modal, Setting } from 'obsidian';
import type NotebookNavigatorPlugin from '../main';
import { strings } from '../i18n';
import { SETTINGS_TRANSFER_FILENAME } from '../settings/transfer';
import { runAsyncAction } from '../utils/async';
import { getErrorMessage } from '../utils/errorUtils';
import { showNotice } from '../utils/noticeUtils';

const SETTINGS_TRANSFER_FILE_ACCEPT = '.json,application/json,text/json';

function createEditorLabel(containerEl: HTMLElement, name: string, desc: string): void {
    const setting = new Setting(containerEl);
    setting.settingEl.addClass('nn-settings-transfer-editor-setting');
    setting.setName(name).setDesc(desc);
}

function createEditor(containerEl: HTMLElement, value: string, placeholder: string): HTMLTextAreaElement {
    const editorEl = containerEl.createEl('textarea', {
        cls: 'nn-input nn-settings-transfer-editor',
        placeholder
    });
    editorEl.value = value;
    editorEl.spellcheck = false;
    return editorEl;
}

function downloadTransferFile(content: string): void {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const linkEl = document.createElement('a');
    linkEl.href = objectUrl;
    linkEl.download = SETTINGS_TRANSFER_FILENAME;
    linkEl.addClass('nn-visually-hidden');
    document.body.appendChild(linkEl);
    linkEl.click();
    linkEl.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export class SettingsImportModal extends Modal {
    private readonly plugin: NotebookNavigatorPlugin;

    constructor(app: App, plugin: NotebookNavigatorPlugin) {
        super(app);
        this.plugin = plugin;
        this.modalEl.addClass('nn-settings-transfer-modal');
        this.titleEl.setText(strings.settings.items.settingsTransfer.import.modalTitle);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        const fileInputEl = contentEl.createEl('input', { type: 'file' });
        fileInputEl.accept = SETTINGS_TRANSFER_FILE_ACCEPT;
        fileInputEl.addClass('nn-visually-hidden');

        let isBusy = false;
        let fileButton: ButtonComponent | null = null;
        let importButton: ButtonComponent | null = null;

        const setBusyState = (nextBusy: boolean) => {
            isBusy = nextBusy;
            fileButton?.setDisabled(nextBusy);
            importButton?.setDisabled(nextBusy);
        };

        new Setting(contentEl)
            .setName(strings.settings.items.settingsTransfer.import.fileButtonName)
            .setDesc(strings.settings.items.settingsTransfer.import.fileButtonDesc)
            .addButton(button => {
                fileButton = button;
                button.setButtonText(strings.settings.items.settingsTransfer.import.fileButtonText).onClick(() => {
                    if (isBusy) {
                        return;
                    }

                    fileInputEl.click();
                });
            });

        createEditorLabel(
            contentEl,
            strings.settings.items.settingsTransfer.import.editorName,
            strings.settings.items.settingsTransfer.import.editorDesc
        );

        const editorEl = createEditor(contentEl, '', strings.settings.items.settingsTransfer.import.placeholder);

        fileInputEl.addEventListener('change', () => {
            const file = fileInputEl.files?.[0];
            if (!file || isBusy) {
                return;
            }

            runAsyncAction(async () => {
                setBusyState(true);
                try {
                    editorEl.value = await file.text();
                    editorEl.focus();
                } catch (error) {
                    console.error('Failed to read settings import file', error);
                    const message = getErrorMessage(error);
                    showNotice(strings.settings.items.settingsTransfer.import.fileReadError.replace('{message}', message), {
                        variant: 'warning'
                    });
                } finally {
                    fileInputEl.value = '';
                    setBusyState(false);
                }
            });
        });

        const buttonContainer = contentEl.createDiv('nn-button-container');
        importButton = new ButtonComponent(buttonContainer);
        importButton.setButtonText(strings.settings.items.settingsTransfer.import.confirmButtonText);
        importButton.setCta();
        importButton.onClick(() => {
            if (isBusy) {
                return;
            }

            runAsyncAction(async () => {
                setBusyState(true);
                try {
                    const transferData: unknown = JSON.parse(editorEl.value);
                    await this.plugin.importSettingsTransfer(transferData);
                    showNotice(strings.settings.items.settingsTransfer.import.successNotice);
                    this.close();
                } catch (error) {
                    console.error('Failed to import settings transfer', error);
                    const message = getErrorMessage(error);
                    showNotice(strings.settings.items.settingsTransfer.import.errorNotice.replace('{message}', message), {
                        variant: 'warning'
                    });
                } finally {
                    setBusyState(false);
                }
            });
        });

        editorEl.focus();
    }

    onClose(): void {
        this.modalEl.removeClass('nn-settings-transfer-modal');
        this.contentEl.empty();
    }
}

export class SettingsExportModal extends Modal {
    private readonly plugin: NotebookNavigatorPlugin;

    constructor(app: App, plugin: NotebookNavigatorPlugin) {
        super(app);
        this.plugin = plugin;
        this.modalEl.addClass('nn-settings-transfer-modal');
        this.titleEl.setText(strings.settings.items.settingsTransfer.export.modalTitle);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        createEditorLabel(
            contentEl,
            strings.settings.items.settingsTransfer.export.editorName,
            strings.settings.items.settingsTransfer.export.editorDesc
        );

        const editorEl = createEditor(
            contentEl,
            this.plugin.createSettingsTransferJson(),
            strings.settings.items.settingsTransfer.export.placeholder
        );

        const buttonContainer = contentEl.createDiv('nn-button-container');

        const copyButton = new ButtonComponent(buttonContainer);
        copyButton.setButtonText(strings.settings.items.settingsTransfer.export.copyButtonText);
        copyButton.onClick(() => {
            runAsyncAction(async () => {
                try {
                    await navigator.clipboard.writeText(editorEl.value);
                    showNotice(strings.settings.items.settingsTransfer.export.copyNotice);
                } catch (error) {
                    console.error('Failed to copy settings transfer', error);
                    showNotice(strings.common.clipboardWriteError, { variant: 'warning' });
                }
            });
        });

        const downloadButton = new ButtonComponent(buttonContainer);
        downloadButton.setButtonText(strings.settings.items.settingsTransfer.export.downloadButtonText);
        downloadButton.setCta();
        downloadButton.onClick(() => {
            try {
                downloadTransferFile(editorEl.value);
                showNotice(strings.settings.items.settingsTransfer.export.downloadNotice);
            } catch (error) {
                console.error('Failed to download settings transfer', error);
                const message = getErrorMessage(error);
                showNotice(strings.settings.items.settingsTransfer.export.downloadError.replace('{message}', message), {
                    variant: 'warning'
                });
            }
        });

        editorEl.focus();
        editorEl.select();
    }

    onClose(): void {
        this.modalEl.removeClass('nn-settings-transfer-modal');
        this.contentEl.empty();
    }
}
