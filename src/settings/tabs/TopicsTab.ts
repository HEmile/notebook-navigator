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
import { isTagSortOrder } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';
import { createSettingGroupFactory } from '../settingGroups';

/** Renders the topics settings tab */
export function renderTopicsTab(context: SettingsTabContext): void {
    const { containerEl, plugin } = context;
    const createGroup = createSettingGroupFactory(containerEl);

    const topicsGroup = createGroup(undefined);

    topicsGroup.addSetting(setting => {
        setting
            .setName(strings.settings.items.showTopics.name)
            .setDesc(strings.settings.items.showTopics.desc)
            .addToggle(toggle =>
                toggle.setValue(plugin.settings.showTopics).onChange(async value => {
                    plugin.settings.showTopics = value;
                    await plugin.saveSettingsAndUpdate();
                })
            );
    });

    new Setting(containerEl)
        .setName(strings.settings.items.topicSortOrder.name)
        .setDesc(strings.settings.items.topicSortOrder.desc)
        .addDropdown(dropdown => {
            const frequencyAscLabel = `${strings.settings.items.topicSortOrder.options.frequency} (${strings.settings.items.topicSortOrder.options.lowToHigh})`;
            const frequencyDescLabel = `${strings.settings.items.topicSortOrder.options.frequency} (${strings.settings.items.topicSortOrder.options.highToLow})`;

            dropdown
                .addOption('alpha-asc', strings.settings.items.topicSortOrder.options.alphaAsc)
                .addOption('alpha-desc', strings.settings.items.topicSortOrder.options.alphaDesc)
                .addOption('frequency-asc', frequencyAscLabel)
                .addOption('frequency-desc', frequencyDescLabel)
                .setValue(plugin.getTopicSortOrder())
                .onChange(value => {
                    if (!isTagSortOrder(value)) {
                        return;
                    }
                    plugin.setTopicSortOrder(value);
                });
        });
}
