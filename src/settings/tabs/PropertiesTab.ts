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
import { addSettingSyncModeToggle } from '../syncModeToggle';
import { wireToggleSettingWithSubSettings } from '../subSettings';
import { createInlineActionLinkText } from './externalLink';

/** Renders the properties settings tab */
export function renderPropertiesTab(context: SettingsTabContext): void {
    const { containerEl, plugin } = context;
    const createGroup = createSettingGroupFactory(containerEl);

    const propertiesGroup = createGroup(undefined);

    const showPropertiesSetting = propertiesGroup.addSetting(setting => {
        setting.setName(strings.settings.items.showProperties.name).setDesc(strings.settings.items.showProperties.desc);
    });

    const propertiesSubSettingsEl = wireToggleSettingWithSubSettings(
        showPropertiesSetting,
        () => plugin.settings.showProperties,
        async value => {
            plugin.settings.showProperties = value;
            await plugin.saveSettingsAndUpdate();
        }
    );

    new Setting(propertiesSubSettingsEl)
        .setName(strings.settings.items.showPropertyIcons.name)
        .setDesc(strings.settings.items.showPropertyIcons.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showPropertyIcons).onChange(async value => {
                plugin.settings.showPropertyIcons = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(propertiesSubSettingsEl)
        .setName(strings.settings.items.inheritPropertyColors.name)
        .setDesc(strings.settings.items.inheritPropertyColors.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.inheritPropertyColors).onChange(async value => {
                plugin.settings.inheritPropertyColors = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    const propertySortOrderSetting = new Setting(propertiesSubSettingsEl)
        .setName(strings.settings.items.propertySortOrder.name)
        .setDesc(strings.settings.items.propertySortOrder.desc)
        .addDropdown(dropdown => {
            const frequencyAscLabel = `${strings.settings.items.propertySortOrder.options.frequency} (${strings.settings.items.propertySortOrder.options.lowToHigh})`;
            const frequencyDescLabel = `${strings.settings.items.propertySortOrder.options.frequency} (${strings.settings.items.propertySortOrder.options.highToLow})`;

            dropdown
                .addOption('alpha-asc', strings.settings.items.propertySortOrder.options.alphaAsc)
                .addOption('alpha-desc', strings.settings.items.propertySortOrder.options.alphaDesc)
                .addOption('frequency-asc', frequencyAscLabel)
                .addOption('frequency-desc', frequencyDescLabel)
                .setValue(plugin.getPropertySortOrder())
                .onChange(value => {
                    if (!isTagSortOrder(value)) {
                        return;
                    }
                    plugin.setPropertySortOrder(value);
                });
        });

    addSettingSyncModeToggle({ setting: propertySortOrderSetting, plugin, settingId: 'propertySortOrder' });

    new Setting(propertiesSubSettingsEl)
        .setName(strings.settings.items.showAllPropertiesFolder.name)
        .setDesc(strings.settings.items.showAllPropertiesFolder.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.showAllPropertiesFolder).onChange(async value => {
                plugin.settings.showAllPropertiesFolder = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    new Setting(propertiesSubSettingsEl)
        .setName(strings.settings.items.scopePropertiesToCurrentContext.name)
        .setDesc(strings.settings.items.scopePropertiesToCurrentContext.desc)
        .addToggle(toggle =>
            toggle.setValue(plugin.settings.scopePropertiesToCurrentContext).onChange(async value => {
                plugin.settings.scopePropertiesToCurrentContext = value;
                await plugin.saveSettingsAndUpdate();
            })
        );

    const propertyKeysInfoSetting = new Setting(propertiesSubSettingsEl).setName('').setDesc('');
    propertyKeysInfoSetting.settingEl.addClass('nn-setting-info-container');
    propertyKeysInfoSetting.settingEl.addClass('nn-setting-info-centered');
    propertyKeysInfoSetting.settingEl.addClass('nn-setting-property-keys-info');
    propertyKeysInfoSetting.descEl.empty();
    propertyKeysInfoSetting.descEl.append(
        createInlineActionLinkText({
            prefix: strings.settings.items.showProperties.propertyKeysInfoPrefix,
            linkText: strings.settings.items.showProperties.propertyKeysInfoLinkText,
            suffix: strings.settings.items.showProperties.propertyKeysInfoSuffix,
            onClick: () => {
                context.openSettingsTab('general');
            }
        })
    );
}
