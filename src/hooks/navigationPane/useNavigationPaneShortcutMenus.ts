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

import React, { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Menu, TFile } from 'obsidian';
import type { NotebookNavigatorSettings } from '../../settings/types';
import type { ExpansionAction } from '../../context/ExpansionContext';
import type { SelectionAction, SelectionState } from '../../context/SelectionContext';
import type { UIAction } from '../../context/UIStateContext';
import { strings } from '../../i18n';
import { runAsyncAction } from '../../utils/async';
import { resolveUXIconForMenu } from '../../utils/uxIcons';
import {
    buildFileMenu,
    buildFolderMenu,
    buildPropertyMenu,
    buildTagMenu,
    type MenuDispatchers,
    type MenuServices,
    type MenuState
} from '../../utils/contextMenu';
import type { ShortcutContextMenuTarget } from './navigationPaneShortcutTypes';

interface ExpansionStateLike {
    expandedFolders: Set<string>;
    expandedTags: Set<string>;
    expandedProperties: Set<string>;
}

interface UseNavigationPaneShortcutMenusProps {
    settings: NotebookNavigatorSettings;
    menuServices: MenuServices;
    selectionState: SelectionState;
    expansionState: ExpansionStateLike;
    selectionDispatch: Dispatch<SelectionAction>;
    expansionDispatch: Dispatch<ExpansionAction>;
    uiDispatch: Dispatch<UIAction>;
    removeShortcut: (key: string) => Promise<boolean>;
    setIsShortcutContextMenuOpen: Dispatch<SetStateAction<boolean>>;
}

export function useNavigationPaneShortcutMenus({
    settings,
    menuServices,
    selectionState,
    expansionState,
    selectionDispatch,
    expansionDispatch,
    uiDispatch,
    removeShortcut,
    setIsShortcutContextMenuOpen
}: UseNavigationPaneShortcutMenusProps) {
    const handleShortcutContextMenu = useCallback(
        (event: React.MouseEvent<HTMLDivElement>, target: ShortcutContextMenuTarget) => {
            if (!settings.showShortcuts) {
                return;
            }

            const targetElement = event.target;
            if (targetElement instanceof HTMLElement && targetElement.closest('.nn-drag-handle')) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const menu = new Menu();
            menu.onHide(() => {
                setIsShortcutContextMenuOpen(false);
            });
            setIsShortcutContextMenuOpen(true);

            if (target.type === 'missing' || target.type === 'search') {
                menu.addItem(item => {
                    item.setTitle(strings.shortcuts.remove)
                        .setIcon(resolveUXIconForMenu(settings.interfaceIcons, 'nav-shortcuts', 'lucide-star-off'))
                        .onClick(() => {
                            runAsyncAction(() => removeShortcut(target.key));
                        });
                });
                menu.showAtMouseEvent(event.nativeEvent);
                return;
            }

            const state: MenuState = {
                selectionState,
                expandedFolders: expansionState.expandedFolders,
                expandedTags: expansionState.expandedTags,
                expandedProperties: expansionState.expandedProperties
            };
            const dispatchers: MenuDispatchers = {
                selectionDispatch,
                expansionDispatch,
                uiDispatch
            };

            if (target.type === 'folder') {
                buildFolderMenu({
                    folder: target.folder,
                    menu,
                    services: menuServices,
                    settings,
                    state,
                    dispatchers,
                    options: { disableNavigationSeparatorActions: true }
                });
            } else if (target.type === 'note') {
                buildFileMenu({
                    file: target.file,
                    menu,
                    services: menuServices,
                    settings,
                    state,
                    dispatchers
                });

                if (target.file.extension !== 'md') {
                    menu.addSeparator();
                    menu.addItem(item => {
                        item.setTitle(strings.shortcuts.remove)
                            .setIcon(resolveUXIconForMenu(settings.interfaceIcons, 'nav-shortcuts', 'lucide-star-off'))
                            .onClick(() => {
                                runAsyncAction(() => removeShortcut(target.key));
                            });
                    });
                }
            } else if (target.type === 'tag') {
                buildTagMenu({
                    tagPath: target.tagPath,
                    menu,
                    services: menuServices,
                    settings,
                    state,
                    dispatchers,
                    options: { disableNavigationSeparatorActions: true }
                });
            } else if (target.type === 'property') {
                buildPropertyMenu({
                    propertyNodeId: target.propertyNodeId,
                    menu,
                    services: menuServices,
                    settings,
                    state,
                    dispatchers,
                    options: { disableNavigationSeparatorActions: true }
                });
            }

            menu.showAtMouseEvent(event.nativeEvent);
        },
        [
            expansionDispatch,
            expansionState.expandedFolders,
            expansionState.expandedProperties,
            expansionState.expandedTags,
            menuServices,
            removeShortcut,
            selectionDispatch,
            selectionState,
            setIsShortcutContextMenuOpen,
            settings,
            uiDispatch
        ]
    );

    const handleRecentFileContextMenu = useCallback(
        (event: React.MouseEvent<HTMLDivElement>, file: TFile) => {
            event.preventDefault();
            event.stopPropagation();

            const menu = new Menu();
            const state: MenuState = {
                selectionState,
                expandedFolders: expansionState.expandedFolders,
                expandedTags: expansionState.expandedTags,
                expandedProperties: expansionState.expandedProperties
            };
            const dispatchers: MenuDispatchers = {
                selectionDispatch,
                expansionDispatch,
                uiDispatch
            };

            buildFileMenu({
                file,
                menu,
                services: menuServices,
                settings,
                state,
                dispatchers
            });

            menu.showAtMouseEvent(event.nativeEvent);
        },
        [
            expansionDispatch,
            expansionState.expandedFolders,
            expansionState.expandedProperties,
            expansionState.expandedTags,
            menuServices,
            selectionDispatch,
            selectionState,
            settings,
            uiDispatch
        ]
    );

    return {
        handleShortcutContextMenu,
        handleRecentFileContextMenu
    };
}
