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

import { Setting } from 'obsidian';
import { strings } from '../../i18n';
import { isFolderNoteCreationPreference } from '../../types/folderNote';
import { isAlphaSortOrder } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';
import { createSettingGroupFactory } from '../settingGroups';
import { addSettingSyncModeToggle } from '../syncModeToggle';
import { wireToggleSettingWithSubSettings } from '../subSettings';
import { FilePathInputSuggest } from '../../suggest/FilePathInputSuggest';
import { FOLDER_NOTE_NAME_PATTERN_PLACEHOLDER } from '../../utils/folderNoteName';
import { normalizeOptionalVaultFilePath } from '../../utils/pathUtils';

/** Renders the folders settings tab */
export function renderFoldersTab(context: SettingsTabContext): void {
    const { containerEl, plugin, addToggleSetting } = context;
    const createGroup = createSettingGroupFactory(containerEl);

    const foldersGroup = createGroup(undefined);

    addToggleSetting(
        foldersGroup.addSetting,
        strings.settings.items.showFolderIcons.name,
        strings.settings.items.showFolderIcons.desc,
        () => plugin.settings.showFolderIcons,
        value => {
            plugin.settings.showFolderIcons = value;
        }
    );

    addToggleSetting(
        foldersGroup.addSetting,
        strings.settings.items.showRootFolder.name,
        strings.settings.items.showRootFolder.desc,
        () => plugin.settings.showRootFolder,
        value => {
            plugin.settings.showRootFolder = value;
        }
    );

    addToggleSetting(
        foldersGroup.addSetting,
        strings.settings.items.inheritFolderColors.name,
        strings.settings.items.inheritFolderColors.desc,
        () => plugin.settings.inheritFolderColors,
        value => {
            plugin.settings.inheritFolderColors = value;
        }
    );

    const folderSortOrderSetting = foldersGroup.addSetting(setting => {
        setting.setName(strings.settings.items.folderSortOrder.name).setDesc(strings.settings.items.folderSortOrder.desc);
        setting.addDropdown(dropdown => {
            dropdown
                .addOption('alpha-asc', strings.settings.items.folderSortOrder.options.alphaAsc)
                .addOption('alpha-desc', strings.settings.items.folderSortOrder.options.alphaDesc)
                .setValue(plugin.getFolderSortOrder())
                .onChange(value => {
                    if (!isAlphaSortOrder(value)) {
                        return;
                    }
                    plugin.setFolderSortOrder(value);
                });
        });
    });

    addSettingSyncModeToggle({ setting: folderSortOrderSetting, plugin, settingId: 'folderSortOrder' });

    const folderNotesGroup = createGroup(strings.settings.sections.folderNotes);

    const enableFolderNotesSetting = folderNotesGroup.addSetting(setting => {
        setting.setName(strings.settings.items.enableFolderNotes.name).setDesc(strings.settings.items.enableFolderNotes.desc);
    });
    const folderNotesSettingsEl = wireToggleSettingWithSubSettings(
        enableFolderNotesSetting,
        () => plugin.settings.enableFolderNotes,
        async value => {
            plugin.settings.enableFolderNotes = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

    new Setting(folderNotesSettingsEl)
        .setName(strings.settings.items.folderNoteType.name)
        .setDesc(strings.settings.items.folderNoteType.desc)
        .addDropdown(dropdown => {
            dropdown
                .addOption('ask', strings.settings.items.folderNoteType.options.ask)
                .addOption('markdown', strings.settings.items.folderNoteType.options.markdown)
                .addOption('canvas', strings.settings.items.folderNoteType.options.canvas)
                .addOption('base', strings.settings.items.folderNoteType.options.base)
                .setValue(plugin.settings.folderNoteType)
                .onChange(async value => {
                    if (!isFolderNoteCreationPreference(value)) {
                        return;
                    }
                    plugin.settings.folderNoteType = value;
                    await plugin.saveSettingsAndUpdate();
                });
        });

    // Use context directly to satisfy eslint exhaustive-deps requirements
    context.createDebouncedTextSetting(
        folderNotesSettingsEl,
        strings.settings.items.folderNoteName.name,
        strings.settings.items.folderNoteName.desc,
        strings.settings.items.folderNoteName.placeholder,
        () => plugin.settings.folderNoteName,
        value => {
            plugin.settings.folderNoteName = value;
        }
    );

    context.createDebouncedTextSetting(
        folderNotesSettingsEl,
        strings.settings.items.folderNoteNamePattern.name,
        strings.settings.items.folderNoteNamePattern.desc,
        FOLDER_NOTE_NAME_PATTERN_PLACEHOLDER,
        () => plugin.settings.folderNoteNamePattern,
        value => {
            plugin.settings.folderNoteNamePattern = value;
        }
    );

    const folderNoteTemplateSetting = context.createDebouncedTextSetting(
        folderNotesSettingsEl,
        strings.settings.items.folderNoteTemplate.name,
        strings.settings.items.folderNoteTemplate.desc,
        '',
        () => plugin.settings.folderNoteTemplate ?? '',
        value => {
            plugin.settings.folderNoteTemplate = normalizeOptionalVaultFilePath(value);
        }
    );
    folderNoteTemplateSetting.controlEl.addClass('nn-setting-wide-input');
    const folderNoteTemplateInputEl = folderNoteTemplateSetting.controlEl.querySelector<HTMLInputElement>('input');
    if (folderNoteTemplateInputEl) {
        const templateSuggest = new FilePathInputSuggest(context.app, folderNoteTemplateInputEl, {
            getBaseFolder: () => plugin.settings.calendarTemplateFolder,
            includeFile: file => file.extension === 'md'
        });
        folderNoteTemplateInputEl.addEventListener('click', () => templateSuggest.open());
    }

    new Setting(folderNotesSettingsEl)
        .setName(strings.settings.items.enableFolderNoteLinks.name)
        .setDesc(strings.settings.items.enableFolderNoteLinks.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.enableFolderNoteLinks).onChange(async value => {
                plugin.settings.enableFolderNoteLinks = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(folderNotesSettingsEl)
        .setName(strings.settings.items.hideFolderNoteInList.name)
        .setDesc(strings.settings.items.hideFolderNoteInList.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.hideFolderNoteInList).onChange(async value => {
                plugin.settings.hideFolderNoteInList = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(folderNotesSettingsEl)
        .setName(strings.settings.items.pinCreatedFolderNote.name)
        .setDesc(strings.settings.items.pinCreatedFolderNote.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.pinCreatedFolderNote).onChange(async value => {
                plugin.settings.pinCreatedFolderNote = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(folderNotesSettingsEl)
        .setName(strings.settings.items.openFolderNotesInNewTab.name)
        .setDesc(strings.settings.items.openFolderNotesInNewTab.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.openFolderNotesInNewTab).onChange(async value => {
                plugin.settings.openFolderNotesInNewTab = value;
                await plugin.saveSettingsAndUpdate();
            })
        );
}
