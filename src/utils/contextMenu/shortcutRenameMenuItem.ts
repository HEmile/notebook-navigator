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

import type { App, Menu, MenuItem } from 'obsidian';
import type { ShortcutEntry } from '../../types/shortcuts';
import { isFolderShortcut, isNoteShortcut, isPropertyShortcut, isTagShortcut } from '../../types/shortcuts';
import { setAsyncOnClick } from './menuAsyncHelpers';

interface AddShortcutRenameMenuItemParams {
    app: App;
    menu: Menu;
    shortcutKey: string;
    defaultLabel: string;
    existingShortcut: ShortcutEntry | undefined;
    title: string;
    placeholder: string;
    renameShortcut: (key: string, alias: string, defaultLabel?: string) => Promise<boolean>;
}

function resolveInitialValue(existingShortcut: ShortcutEntry | undefined, defaultLabel: string): string {
    if (!existingShortcut) {
        return defaultLabel;
    }

    if (
        isFolderShortcut(existingShortcut) ||
        isNoteShortcut(existingShortcut) ||
        isTagShortcut(existingShortcut) ||
        isPropertyShortcut(existingShortcut)
    ) {
        const alias = existingShortcut.alias;
        if (alias && alias.length > 0) {
            return alias;
        }
    }

    return defaultLabel;
}

export function addShortcutRenameMenuItem(params: AddShortcutRenameMenuItemParams): void {
    const { app, menu, shortcutKey, defaultLabel, existingShortcut, title, placeholder, renameShortcut } = params;

    menu.addItem((item: MenuItem) => {
        setAsyncOnClick(item.setTitle(title).setIcon('lucide-pencil'), async () => {
            const initialValue = resolveInitialValue(existingShortcut, defaultLabel);

            const { InputModal } = await import('../../modals/InputModal');
            const modal = new InputModal(
                app,
                title,
                placeholder,
                async value => {
                    await renameShortcut(shortcutKey, value, defaultLabel);
                },
                initialValue
            );
            modal.open();
        });
    });
}
