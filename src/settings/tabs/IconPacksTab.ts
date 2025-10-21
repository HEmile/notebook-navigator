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

import { Notice, Setting } from 'obsidian';
import { strings } from '../../i18n';
import { EXTERNAL_ICON_PROVIDERS, type ExternalIconProviderId } from '../../services/icons/external/providerRegistry';
import type { SettingsTabContext } from './SettingsTabContext';

/** Renders the icon packs settings tab */
export function renderIconPacksTab(context: SettingsTabContext): void {
    const { containerEl, plugin } = context;
    containerEl.empty();

    const providerLinks: Record<ExternalIconProviderId, string> = {
        'bootstrap-icons': strings.settings.items.externalIcons.providers.bootstrapIconsDesc,
        'fontawesome-solid': strings.settings.items.externalIcons.providers.fontAwesomeDesc,
        'material-icons': strings.settings.items.externalIcons.providers.materialIconsDesc,
        phosphor: strings.settings.items.externalIcons.providers.phosphorDesc,
        'rpg-awesome': strings.settings.items.externalIcons.providers.rpgAwesomeDesc,
        'simple-icons': strings.settings.items.externalIcons.providers.simpleIconsDesc
    };

    const infoContainer = containerEl.createDiv('nn-setting-info-container');
    const infoContent = infoContainer.createEl('div', { cls: 'setting-item-description' });
    infoContent.createDiv({ text: strings.settings.items.externalIcons.infoNote });

    Object.values(EXTERNAL_ICON_PROVIDERS).forEach(config => {
        const isInstalled = plugin.isExternalIconProviderInstalled(config.id);
        const isDownloading = plugin.isExternalIconProviderDownloading(config.id);
        const version = plugin.getExternalIconProviderVersion(config.id);

        const statusText = isInstalled
            ? strings.settings.items.externalIcons.statusInstalled.replace(
                  '{version}',
                  version || strings.settings.items.externalIcons.versionUnknown
              )
            : strings.settings.items.externalIcons.statusNotInstalled;

        const setting = new Setting(containerEl).setName(config.name).setDesc('');

        const descriptionEl = setting.descEl;
        descriptionEl.empty();

        const linkRow = descriptionEl.createDiv();
        const linkEl = linkRow.createEl('a', {
            text: providerLinks[config.id],
            href: providerLinks[config.id]
        });
        linkEl.setAttr('rel', 'noopener noreferrer');
        linkEl.setAttr('target', '_blank');

        descriptionEl.createEl('div', { text: statusText });

        if (isInstalled) {
            setting.addButton(button => {
                button.setButtonText(strings.settings.items.externalIcons.removeButton);
                button.setDisabled(isDownloading);
                button.onClick(async () => {
                    button.setDisabled(true);
                    try {
                        await plugin.removeExternalIconProvider(config.id);
                        renderIconPacksTab(context);
                    } catch (error) {
                        console.error('Failed to remove icon provider', error);
                        new Notice(strings.settings.items.externalIcons.removeFailed.replace('{name}', config.name));
                        button.setDisabled(false);
                    }
                });
            });
        } else {
            setting.addButton(button => {
                button.setButtonText(
                    isDownloading
                        ? strings.settings.items.externalIcons.downloadingLabel
                        : strings.settings.items.externalIcons.downloadButton
                );
                button.setDisabled(isDownloading);
                button.onClick(async () => {
                    button.setDisabled(true);
                    try {
                        await plugin.downloadExternalIconProvider(config.id);
                        renderIconPacksTab(context);
                    } catch (error) {
                        console.error('Failed to download icon provider', error);
                        new Notice(strings.settings.items.externalIcons.downloadFailed.replace('{name}', config.name));
                        button.setDisabled(false);
                    }
                });
            });
        }
    });
}
