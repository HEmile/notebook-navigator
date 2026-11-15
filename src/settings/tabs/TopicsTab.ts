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
import type { SettingDefinitionItem } from 'obsidian';
import { strings } from '../../i18n';
import { isTagSortOrder } from '../types';
import type { SettingsTabContext } from './SettingsTabContext';
import { createGroupDefinition, createRenderDefinition } from '../nativeSettingControls';

/** Builds native setting definitions for the topics settings page */
export function createTopicsSettingDefinitions(context: SettingsTabContext): SettingDefinitionItem[] {
    const { plugin } = context;

    return [
        createGroupDefinition(undefined, [
            createRenderDefinition({
                name: strings.settings.items.showTopics.name,
                desc: strings.settings.items.showTopics.desc,
                render: setting => renderShowTopicsSetting(setting, context)
            }),
            createRenderDefinition({
                name: strings.settings.items.topicSortOrder.name,
                desc: strings.settings.items.topicSortOrder.desc,
                aliases: Object.values(strings.settings.items.topicSortOrder.options),
                visible: () => plugin.settings.showTopics,
                render: setting => renderTopicSortOrderSetting(setting, context)
            })
        ])
    ];
}

function renderShowTopicsSetting(setting: Setting, context: SettingsTabContext): void {
    const { plugin } = context;

    setting.setName(strings.settings.items.showTopics.name).setDesc(strings.settings.items.showTopics.desc);
    setting.addToggle(toggle =>
        toggle.setValue(plugin.settings.showTopics).onChange(async value => {
            plugin.settings.showTopics = value;
            await plugin.saveSettingsAndUpdate();
        })
    );
}

function renderTopicSortOrderSetting(setting: Setting, context: SettingsTabContext): void {
    const { plugin } = context;
    const options = strings.settings.items.topicSortOrder.options;

    setting.setName(strings.settings.items.topicSortOrder.name).setDesc(strings.settings.items.topicSortOrder.desc);
    setting.addDropdown(dropdown => {
        dropdown
            .addOption('alpha-asc', options.alphaAsc)
            .addOption('alpha-desc', options.alphaDesc)
            .addOption('frequency-asc', `${options.frequency} (${options.lowToHigh})`)
            .addOption('frequency-desc', `${options.frequency} (${options.highToLow})`)
            .setValue(plugin.getTopicSortOrder())
            .onChange(value => {
                if (!isTagSortOrder(value)) {
                    return;
                }
                plugin.setTopicSortOrder(value);
            });
    });
}
