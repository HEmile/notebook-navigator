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

import { strings } from '../../i18n';
import { createSettingGroupFactory } from '../settingGroups';
import { isDeleteAttachmentsSetting, isMoveFileConflictsSetting } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';

/** Renders the files settings tab */
export function renderFilesTab(context: SettingsTabContext): void {
    const { containerEl, plugin } = context;

    const createGroup = createSettingGroupFactory(containerEl);
    const filesGroup = createGroup(undefined);

    filesGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.confirmBeforeDelete.name)
            .setDesc(strings.settings.items.confirmBeforeDelete.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.confirmBeforeDelete).onChange(async value => {
                    plugin.settings.confirmBeforeDelete = value;
                    await plugin.saveSettingsAndUpdate();
                })
            );
    });

    filesGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.deleteAttachments.name)
            .setDesc(strings.settings.items.deleteAttachments.desc)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('ask', strings.settings.items.deleteAttachments.options.ask)
                    .addOption('always', strings.settings.items.deleteAttachments.options.always)
                    .addOption('never', strings.settings.items.deleteAttachments.options.never)
                    .setValue(plugin.settings.deleteAttachments)
                    .onChange(async value => {
                        if (!isDeleteAttachmentsSetting(value)) {
                            return;
                        }
                        plugin.settings.deleteAttachments = value;
                        await plugin.saveSettingsAndUpdate();
                    });
            });
    });

    filesGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.moveFileConflicts.name)
            .setDesc(strings.settings.items.moveFileConflicts.desc)
            .addDropdown(dropdown => {
                dropdown
                    .addOption('ask', strings.settings.items.moveFileConflicts.options.ask)
                    .addOption('rename', strings.settings.items.moveFileConflicts.options.rename)
                    .setValue(plugin.settings.moveFileConflicts)
                    .onChange(async value => {
                        if (!isMoveFileConflictsSetting(value)) {
                            return;
                        }
                        plugin.settings.moveFileConflicts = value;
                        await plugin.saveSettingsAndUpdate();
                    });
            });
    });
}
