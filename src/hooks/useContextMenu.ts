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

// src/hooks/useContextMenu.ts
import { useEffect, useCallback, useState } from 'react';
import { Menu } from 'obsidian';
import { useExpansionState, useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionState, useSelectionDispatch } from '../context/SelectionContext';
import { useServices, useFileSystemOps, useMetadataService, useTagOperations, useCommandQueue } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUIDispatch } from '../context/UIStateContext';
import { useShortcuts } from '../context/ShortcutsContext';
import { ItemType } from '../types';
import {
    MenuConfig,
    MenuServices,
    MenuState,
    MenuDispatchers,
    buildFolderMenu,
    buildTagMenu,
    buildTopicMenu,
    buildFileMenu,
    buildEmptyListMenu,
    EMPTY_LIST_MENU_TYPE
} from '../utils/contextMenu';
import { TFolder } from 'obsidian';

/**
 * Custom hook that attaches a context menu to an element.
 * Provides right-click context menu functionality for files, folders, and tags.
 *
 * @param elementRef - React ref to the element to attach the context menu to
 * @param config - Configuration object containing menu type and item, or null to disable
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useContextMenu(ref, { type: 'file', item: file });
 *
 * return <div ref={ref}>Right-click me</div>;
 * ```
 */
export function useContextMenu(elementRef: React.RefObject<HTMLElement | null>, config: MenuConfig | null) {
    const { app, plugin, isMobile, tagTreeService, topicService } = useServices();
    const settings = useSettingsState();
    const fileSystemOps = useFileSystemOps();
    const metadataService = useMetadataService();
    const tagOperations = useTagOperations();
    const commandQueue = useCommandQueue();
    const shortcuts = useShortcuts();
    const selectionState = useSelectionState();
    const { expandedFolders, expandedTags } = useExpansionState();
    const selectionDispatch = useSelectionDispatch();
    const expansionDispatch = useExpansionDispatch();
    const uiDispatch = useUIDispatch();
    const [attachedElement, setAttachedElement] = useState<HTMLElement | null>(null);

    /**
     * Handles the context menu event.
     * Shows appropriate menu items based on whether the target is a file, folder, or tag.
     *
     * @param e - The mouse event from right-click
     */
    const handleContextMenu = useCallback(
        (e: MouseEvent) => {
            if (!config || !elementRef.current) return;

            // Check if the click is on this element or its children
            if (!elementRef.current.contains(e.target as Node)) return;

            // Get the target element if it's an HTML element
            const targetElement = e.target instanceof HTMLElement ? e.target : null;

            // Menu builder function that will be selected based on item type
            type Builder = (menu: Menu) => void;
            let buildMenu: Builder | null = null;

            if (config.type === EMPTY_LIST_MENU_TYPE) {
                // Handle context menu for empty areas in the list pane
                const folder = config.item;
                if (!(folder instanceof TFolder)) {
                    return;
                }
                if (!targetElement) {
                    return;
                }

                // Skip menu if clicking on file items or date headers
                const isFileTarget = targetElement.closest('.nn-file') !== null;
                const isHeaderTarget = targetElement.closest('.nn-date-group-header') !== null;
                if (isFileTarget || isHeaderTarget) {
                    return;
                }

                buildMenu = menuInstance => {
                    buildEmptyListMenu({
                        folder,
                        menu: menuInstance,
                        services,
                        settings,
                        state,
                        dispatchers
                    });
                };
            } else if (config.type === ItemType.FOLDER) {
                buildMenu = menuInstance => {
                    buildFolderMenu({
                        folder: config.item,
                        menu: menuInstance,
                        services,
                        settings,
                        state,
                        dispatchers
                    });
                };
            } else if (config.type === ItemType.TAG) {
                buildMenu = menuInstance => {
                    buildTagMenu({
                        tagPath: config.item,
                        menu: menuInstance,
                        services,
                        settings,
                        state,
                        dispatchers
                    });
                };
            } else if (config.type === ItemType.TOPIC) {
                buildMenu = menuInstance => {
                    buildTopicMenu({
                        topicName: config.item,
                        menu: menuInstance,
                        services,
                        settings
                    });
                };
            } else if (config.type === ItemType.FILE) {
                buildMenu = menuInstance => {
                    buildFileMenu({
                        file: config.item,
                        menu: menuInstance,
                        services,
                        settings,
                        state,
                        dispatchers
                    });
                };
            }

            if (!buildMenu) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const menu = new Menu();

            // Add context menu active class to show outline immediately
            elementRef.current.classList.add('nn-context-menu-active');

            // Handle separator hiding for file items in list pane
            if (config.type === ItemType.FILE) {
                // Find the virtual item wrapper that contains this file item
                const virtualItem = elementRef.current.closest('.nn-virtual-file-item');
                if (virtualItem instanceof HTMLElement) {
                    // Hide separator below this item
                    virtualItem.classList.add('nn-hide-separator-context-menu');

                    // Find and hide separator of previous item (shows above this item)
                    const prevVirtualItem = virtualItem.previousElementSibling;
                    if (prevVirtualItem instanceof HTMLElement && prevVirtualItem.classList.contains('nn-virtual-file-item')) {
                        prevVirtualItem.classList.add('nn-hide-separator-context-menu');
                    }
                }
            }

            // Prepare common parameters for all builders
            const services: MenuServices = {
                app,
                plugin,
                isMobile,
                fileSystemOps,
                metadataService,
                tagOperations,
                tagTreeService,
                topicService,
                commandQueue,
                shortcuts
            };

            const state: MenuState = {
                selectionState,
                expandedFolders,
                expandedTags
            };

            const dispatchers: MenuDispatchers = {
                selectionDispatch,
                expansionDispatch,
                uiDispatch
            };

            // Call the appropriate builder based on item type
            buildMenu(menu);

            // Show menu at mouse event first, then attach hide handler.
            // This avoids a race where switching from an existing menu could
            // trigger a premature hide on the newly created menu and remove
            // the outline before the menu is actually shown.
            menu.showAtMouseEvent(e);

            // Remove the class when THIS menu is hidden
            menu.onHide(() => {
                if (elementRef.current) {
                    elementRef.current.classList.remove('nn-context-menu-active');

                    // Remove separator hiding for file items
                    if (config.type === ItemType.FILE) {
                        const virtualItem = elementRef.current.closest('.nn-virtual-file-item');
                        if (virtualItem instanceof HTMLElement) {
                            // Remove separator hiding from this item
                            virtualItem.classList.remove('nn-hide-separator-context-menu');

                            // Remove separator hiding from previous item
                            const prevVirtualItem = virtualItem.previousElementSibling;
                            if (prevVirtualItem instanceof HTMLElement && prevVirtualItem.classList.contains('nn-virtual-file-item')) {
                                prevVirtualItem.classList.remove('nn-hide-separator-context-menu');
                            }
                        }
                    }
                }
            });
        },
        [
            config,
            elementRef,
            app,
            plugin,
            settings,
            fileSystemOps,
            metadataService,
            tagOperations,
            selectionState,
            expandedFolders,
            expandedTags,
            selectionDispatch,
            expansionDispatch,
            uiDispatch,
            isMobile,
            tagTreeService,
            commandQueue,
            shortcuts
        ]
    );

    useEffect(() => {
        if (!config) {
            if (attachedElement !== null) {
                setAttachedElement(null);
            }
            return;
        }

        const node = elementRef.current;
        if (node !== attachedElement) {
            setAttachedElement(node);
        }
    }, [attachedElement, config, elementRef]);

    useEffect(() => {
        if (!config || !attachedElement) return;

        attachedElement.addEventListener('contextmenu', handleContextMenu);

        return () => {
            // Remove listener on cleanup, but do not forcibly remove the
            // outline class here. Cleanup can run on re-render, which would
            // otherwise clear the outline before the menu appears when
            // switching targets. The class is reliably cleared via menu.onHide
            // when the context menu actually closes.
            attachedElement.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [attachedElement, handleContextMenu, config]);
}
