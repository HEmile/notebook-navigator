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

import { MenuItem } from 'obsidian';
import { strings } from '../../i18n';
import type { NotebookNavigatorSettings } from '../../settings/types';
import type { MenuServices } from './menuTypes';
import { ItemType } from '../../types';
import { setAsyncOnClick } from './menuAsyncHelpers';
import type { Menu } from 'obsidian';
import { addShortcutRenameMenuItem } from './shortcutRenameMenuItem';
import { resolveUXIconForMenu } from '../../utils/uxIcons';

export interface TopicMenuBuilderParams {
    topicName: string;
    menu: Menu;
    services: MenuServices;
    settings: NotebookNavigatorSettings;
}

export function buildTopicMenu(params: TopicMenuBuilderParams): void {
    const { topicName, menu, services, settings } = params;
    const { app, isMobile, metadataService, plugin } = services;

    if (isMobile) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(topicName).setIsLabel(true);
        });
        menu.addSeparator();
    }

    // Change icon
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.topic.changeIcon).setIcon('lucide-image'), async () => {
            const { IconPickerModal } = await import('../../modals/IconPickerModal');
            const modal = new IconPickerModal(app, metadataService, topicName, ItemType.TAG);
            modal.open();
        });
    });

    // Change color
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.topic.changeColor).setIcon('lucide-palette'), async () => {
            const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
            const modal = new ColorPickerModal(app, {
                title: topicName,
                initialColor: metadataService.getTagColor(topicName) ?? null,
                settingsProvider: metadataService.getSettingsProvider(),
                onChooseColor: async color => {
                    if (color === null) {
                        await metadataService.removeTagColor(topicName);
                        return;
                    }
                    await metadataService.setTagColor(topicName, color);
                }
            });
            modal.open();
        });
    });

    // Change background color
    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.topic.changeBackground).setIcon('lucide-paint-bucket'), async () => {
            const { ColorPickerModal } = await import('../../modals/ColorPickerModal');
            const modal = new ColorPickerModal(app, {
                title: topicName,
                initialColor: metadataService.getTagBackgroundColor(topicName) ?? null,
                settingsProvider: metadataService.getSettingsProvider(),
                onChooseColor: async color => {
                    if (color === null) {
                        await metadataService.removeTagBackgroundColor(topicName);
                        return;
                    }
                    await metadataService.setTagBackgroundColor(topicName, color);
                }
            });
            modal.open();
        });
    });

    // Add to shortcuts / Remove from shortcuts
    if (services.shortcuts) {
        const { topicShortcutKeysByName, addTopicShortcut, removeShortcut, renameShortcut, shortcutMap } = services.shortcuts;
        const existingShortcutKey = topicShortcutKeysByName.get(topicName);

        menu.addSeparator();

        if (existingShortcutKey) {
            const existingShortcut = shortcutMap.get(existingShortcutKey);
            addShortcutRenameMenuItem({
                app,
                menu,
                shortcutKey: existingShortcutKey,
                defaultLabel: topicName,
                existingShortcut,
                title: strings.shortcuts.rename,
                placeholder: strings.searchInput.shortcutNamePlaceholder,
                renameShortcut
            });
        }

        menu.addItem((item: MenuItem) => {
            if (existingShortcutKey) {
                setAsyncOnClick(
                    item
                        .setTitle(strings.shortcuts.remove)
                        .setIcon(resolveUXIconForMenu(settings.interfaceIcons, 'nav-shortcuts', 'lucide-star-off')),
                    async () => {
                        await removeShortcut(existingShortcutKey);
                    }
                );
            } else {
                setAsyncOnClick(
                    item
                        .setTitle(strings.shortcuts.add)
                        .setIcon(resolveUXIconForMenu(settings.interfaceIcons, 'nav-shortcuts', 'lucide-star')),
                    async () => {
                        await addTopicShortcut(topicName);
                    }
                );
            }
        });
    }

    menu.addSeparator();

    const isHidden = settings.hiddenTopics.includes(topicName);

    if (!isHidden) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.topic.hideTopic)
                .setIcon('lucide-eye-off')
                .onClick(async () => {
                    plugin.settings.hiddenTopics = [...settings.hiddenTopics, topicName];
                    await plugin.saveSettingsAndUpdate();
                });
        });
    } else {
        menu.addItem((item: MenuItem) => {
            item.setTitle(strings.contextMenu.topic.showTopic)
                .setIcon('lucide-eye')
                .onClick(async () => {
                    plugin.settings.hiddenTopics = settings.hiddenTopics.filter(t => t !== topicName);
                    await plugin.saveSettingsAndUpdate();
                });
        });
    }
}
