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
import { EXTERNAL_ICON_PROVIDERS } from '../../services/icons/external/providerRegistry';
import type { SettingsTabContext } from './SettingsTabContext';
import { runAsyncAction } from '../../utils/async';
import { showNotice } from '../../utils/noticeUtils';
import { createSettingGroupFactory } from '../settingGroups';

/** Renders the icon packs settings tab */
export function renderIconPacksTab(context: SettingsTabContext): void {
    const { containerEl, plugin, addInfoSetting } = context;
    containerEl.empty();

    const createGroup = createSettingGroupFactory(containerEl);
    const iconPacksGroup = createGroup(undefined);

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

        const setting = iconPacksGroup.addSetting(setting => {
            setting.setName(config.name).setDesc('');
        });

        const descriptionEl = setting.descEl;
        descriptionEl.empty();

        const linkRow = descriptionEl.createDiv();
        const catalogUrl = config.catalogUrl;
        const linkEl = linkRow.createEl('a', {
            text: catalogUrl,
            href: catalogUrl
        });
        linkEl.setAttr('rel', 'noopener noreferrer');
        linkEl.setAttr('target', '_blank');

        descriptionEl.createEl('div', { text: statusText });

        if (isInstalled) {
            setting.addButton(button => {
                button.setButtonText(strings.settings.items.externalIcons.removeButton);
                button.setDisabled(isDownloading);
                // Remove icon pack without blocking the UI
                button.onClick(() => {
                    runAsyncAction(async () => {
                        button.setDisabled(true);
                        try {
                            await plugin.removeExternalIconProvider(config.id);
                            renderIconPacksTab(context);
                        } catch (error) {
                            console.error('Failed to remove icon provider', error);
                            showNotice(strings.settings.items.externalIcons.removeFailed.replace('{name}', config.name), {
                                variant: 'warning'
                            });
                            button.setDisabled(false);
                        }
                    });
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
                // Download icon pack without blocking the UI
                button.onClick(() => {
                    runAsyncAction(async () => {
                        button.setDisabled(true);
                        try {
                            await plugin.downloadExternalIconProvider(config.id);
                            renderIconPacksTab(context);
                        } catch (error) {
                            console.error('Failed to download icon provider', error);
                            showNotice(strings.settings.items.externalIcons.downloadFailed.replace('{name}', config.name), {
                                variant: 'warning'
                            });
                            button.setDisabled(false);
                        }
                    });
                });
            });
        }
    });

    addInfoSetting(iconPacksGroup.addSetting, 'nn-setting-info-container', descEl => {
        descEl.createDiv({ text: strings.settings.items.externalIcons.infoNote });
    });
}
