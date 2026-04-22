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

import { NavigationPaneItemType } from '../../types';
import { NavigationPaneShortcutRow } from './NavigationPaneShortcutRow';
import { NavigationPaneTreeRow } from './NavigationPaneTreeRow';
import type { NavigationPaneRowProps } from './NavigationPaneItemRenderer.types';

export function NavigationPaneItemRenderer({ item, context }: NavigationPaneRowProps) {
    switch (item.type) {
        case NavigationPaneItemType.SHORTCUT_FOLDER:
        case NavigationPaneItemType.SHORTCUT_NOTE:
        case NavigationPaneItemType.SHORTCUT_SEARCH:
        case NavigationPaneItemType.SHORTCUT_TAG:
        case NavigationPaneItemType.SHORTCUT_PROPERTY:
        case NavigationPaneItemType.RECENT_NOTE:
            return <NavigationPaneShortcutRow item={item} context={context} />;

        default:
            return <NavigationPaneTreeRow item={item} context={context} />;
    }
}
