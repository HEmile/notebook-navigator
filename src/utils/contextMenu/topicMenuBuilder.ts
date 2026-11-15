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
import { setAsyncOnClick } from './menuAsyncHelpers';
import type { Menu } from 'obsidian';
import { addShortcutRenameMenuItem } from './shortcutRenameMenuItem';
import { resolveUXIcon, resolveUXIconForMenu } from '../../utils/uxIcons';
import { addStyleMenu } from './styleMenuBuilder';

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

    // Appearance: one dialog for icon, color and background, opened on the tab of the chosen item
    const openAppearanceModal = async (initialTab: 'icon' | 'color' | 'background'): Promise<void> => {
        const { AppearanceModal } = await import('../../modals/AppearanceModal');
        const modal = new AppearanceModal(app, {
            title: topicName,
            metadataService,
            initialTab,
            defaultIcon: settings.showTopicIcons ? resolveUXIcon(settings.interfaceIcons, 'nav-tag') : null,
            icon: settings.showTopicIcons
                ? {
                      initial: metadataService.getTopicIcon(topicName) ?? null,
                      apply: async iconId => {
                          if (iconId === null) {
                              await metadataService.removeTopicIcon(topicName);
                              return;
                          }
                          await metadataService.setTopicIcon(topicName, iconId);
                      }
                  }
                : undefined,
            color: {
                initial: metadataService.getTopicColor(topicName) ?? null,
                apply: async color => {
                    if (color === null) {
                        await metadataService.removeTopicColor(topicName);
                        return;
                    }
                    await metadataService.setTopicColor(topicName, color);
                }
            },
            background: {
                initial: metadataService.getTopicBackgroundColor(topicName) ?? null,
                apply: async color => {
                    if (color === null) {
                        await metadataService.removeTopicBackgroundColor(topicName);
                        return;
                    }
                    await metadataService.setTopicBackgroundColor(topicName, color);
                }
            }
        });
        modal.open();
    };

    if (settings.showTopicIcons) {
        menu.addItem((item: MenuItem) => {
            setAsyncOnClick(item.setTitle(strings.contextMenu.topic.changeIcon).setIcon('lucide-image'), () => openAppearanceModal('icon'));
        });
    }

    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.topic.changeColor).setIcon('lucide-palette'), () => openAppearanceModal('color'));
    });

    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(strings.contextMenu.topic.changeBackground).setIcon('lucide-paint-bucket'), () =>
            openAppearanceModal('background')
        );
    });

    // Copy, paste and remove style, as for tags. Only the topic's own style counts, not inherited colors.
    const topicIcon = metadataService.getTopicIcon(topicName);
    const topicColor = metadataService.getTopicColor(topicName);
    const topicBackground = metadataService.getTopicBackgroundColor(topicName);
    addStyleMenu({
        menu,
        styleData: { icon: topicIcon, color: topicColor, background: topicBackground },
        hasIcon: settings.showTopicIcons,
        hasColor: true,
        hasBackground: true,
        applyStyle: async clipboard => {
            const actions: Promise<void>[] = [];
            if (clipboard.icon) {
                actions.push(metadataService.setTopicIcon(topicName, clipboard.icon));
            }
            if (clipboard.color) {
                actions.push(metadataService.setTopicColor(topicName, clipboard.color));
            }
            if (clipboard.background) {
                actions.push(metadataService.setTopicBackgroundColor(topicName, clipboard.background));
            }
            await Promise.all(actions);
        },
        removeIcon: topicIcon ? async () => metadataService.removeTopicIcon(topicName) : undefined,
        removeColor: topicColor ? async () => metadataService.removeTopicColor(topicName) : undefined,
        removeBackground: topicBackground ? async () => metadataService.removeTopicBackgroundColor(topicName) : undefined
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

    // Separator line above every row of this topic
    const separatorTarget = { type: 'topic', name: topicName } as const;
    const hasSeparator = metadataService.hasNavigationSeparator(separatorTarget);
    menu.addItem((item: MenuItem) => {
        const title = hasSeparator ? strings.contextMenu.navigation.removeSeparator : strings.contextMenu.navigation.addSeparator;
        setAsyncOnClick(item.setTitle(title).setIcon('lucide-separator-horizontal'), async () => {
            if (hasSeparator) {
                await metadataService.removeNavigationSeparator(separatorTarget);
                return;
            }
            await metadataService.addNavigationSeparator(separatorTarget);
        });
    });

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
