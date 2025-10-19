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

import { Menu, MenuItem } from 'obsidian';
import { strings } from '../../i18n';
import type { NotebookNavigatorSettings } from '../../settings/types';
import type { MenuServices } from './menuTypes';

export interface TopicMenuBuilderParams {
    topicName: string;
    menu: Menu;
    services: MenuServices;
    settings: NotebookNavigatorSettings;
}

/**
 * Builds the context menu for a topic
 */
export function buildTopicMenu(params: TopicMenuBuilderParams): void {
    const { topicName, menu, services, settings } = params;
    const { isMobile } = services;

    // Show topic name on mobile
    if (isMobile) {
        menu.addItem((item: MenuItem) => {
            item.setTitle(topicName).setIsLabel(true);
        });
    }

    if (services.shortcuts) {
        const { topicShortcutKeysByName, addTopicShortcut, removeShortcut } = services.shortcuts;
        const existingShortcutKey = topicShortcutKeysByName.get(topicName);

        menu.addItem((item: MenuItem) => {
            if (existingShortcutKey) {
                item.setTitle(strings.shortcuts.remove)
                    .setIcon('lucide-bookmark-x')
                    .onClick(() => {
                        void removeShortcut(existingShortcutKey);
                    });
            } else {
                item.setTitle(strings.shortcuts.add)
                    .setIcon('lucide-bookmark')
                    .onClick(() => {
                        void addTopicShortcut(topicName);
                    });
            }
        });

        menu.addSeparator();
    }

    // Additional topic-specific menu items can be added here in the future
    // For example: changing icon, color, or other topic properties
}

