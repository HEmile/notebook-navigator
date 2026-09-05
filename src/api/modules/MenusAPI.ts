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

import { Menu, MenuItem, TFile, TFolder } from 'obsidian';
import type {
    FileMenuExtensionContext,
    FolderMenuExtensionContext,
    TagMenuExtensionContext,
    PropertyMenuExtensionContext,
    FileMenuSelectionMode
} from '../types';

export type MenuExtensionDispose = () => void;

function isPromiseLike(value: unknown): value is Promise<unknown> {
    return value instanceof Promise;
}

export type {
    FileMenuExtensionContext,
    FolderMenuExtensionContext,
    TagMenuExtensionContext,
    PropertyMenuExtensionContext,
    FileMenuSelectionMode
};

export type FileMenuExtension = (context: FileMenuExtensionContext) => void;
export type FolderMenuExtension = (context: FolderMenuExtensionContext) => void;
export type TagMenuExtension = (context: TagMenuExtensionContext) => void;
export type PropertyMenuExtension = (context: PropertyMenuExtensionContext) => void;

type FileMenuExtensionApplyContext = {
    menu: Menu;
    file: TFile;
    selection: {
        mode: FileMenuSelectionMode;
        files: readonly TFile[];
    };
};

type FolderMenuExtensionApplyContext = {
    menu: Menu;
    folder: TFolder;
};

type TagMenuExtensionApplyContext = {
    menu: Menu;
    tag: string;
};

type PropertyMenuExtensionApplyContext = {
    menu: Menu;
    nodeId: string;
};

type MenuExtensionContextBase = {
    addItem: (cb: (item: MenuItem) => void) => void;
};

/**
 * Menu extension API - Allow other plugins to add items to Notebook Navigator context menus.
 */
export class MenusAPI {
    private fileMenuExtensions = new Set<FileMenuExtension>();
    private folderMenuExtensions = new Set<FolderMenuExtension>();
    private tagMenuExtensions = new Set<TagMenuExtension>();
    private propertyMenuExtensions = new Set<PropertyMenuExtension>();

    registerFileMenu(callback: FileMenuExtension): MenuExtensionDispose {
        return this.registerExtension(this.fileMenuExtensions, callback);
    }

    registerFolderMenu(callback: FolderMenuExtension): MenuExtensionDispose {
        return this.registerExtension(this.folderMenuExtensions, callback);
    }

    registerTagMenu(callback: TagMenuExtension): MenuExtensionDispose {
        return this.registerExtension(this.tagMenuExtensions, callback);
    }

    registerPropertyMenu(callback: PropertyMenuExtension): MenuExtensionDispose {
        return this.registerExtension(this.propertyMenuExtensions, callback);
    }

    private registerExtension<T>(extensions: Set<T>, callback: T): MenuExtensionDispose {
        extensions.add(callback);
        return () => {
            extensions.delete(callback);
        };
    }

    private applyExtensions<TContext extends MenuExtensionContextBase>(
        extensions: ReadonlySet<(context: TContext) => void>,
        menu: Menu,
        errorPrefix: string,
        buildContext: (addItem: (cb: (item: MenuItem) => void) => void) => TContext
    ): number {
        if (extensions.size === 0) {
            return 0;
        }

        let addedItems = 0;
        let isBuildingMenu = true;

        const addItem = (cb: (item: MenuItem) => void) => {
            if (!isBuildingMenu) {
                console.error(
                    `Notebook Navigator ${errorPrefix} menu extension attempted to add menu items asynchronously. Add menu items synchronously and do async work in onClick handlers.`
                );
                return;
            }
            try {
                menu.addItem(item => {
                    try {
                        cb(item);
                    } catch (error) {
                        console.error(`Notebook Navigator ${errorPrefix} menu extension item failed`, error);
                    }
                });
                addedItems += 1;
            } catch (error) {
                console.error(`Notebook Navigator ${errorPrefix} menu extension addItem failed`, error);
            }
        };

        const extensionContext = buildContext(addItem);
        for (const extension of Array.from(extensions)) {
            try {
                const result: unknown = extension(extensionContext);
                if (isPromiseLike(result)) {
                    console.error(
                        `Notebook Navigator ${errorPrefix} menu extension returned a Promise. Add menu items synchronously and do async work in onClick handlers.`
                    );
                    void result.catch(error => {
                        console.error(`Notebook Navigator ${errorPrefix} menu extension failed`, error);
                    });
                }
            } catch (error) {
                console.error(`Notebook Navigator ${errorPrefix} menu extension failed`, error);
            }
        }

        isBuildingMenu = false;
        return addedItems;
    }

    /**
     * Calls registered file menu extensions and returns number of items added.
     * @internal
     */
    applyFileMenuExtensions(context: FileMenuExtensionApplyContext): number {
        const { menu, file, selection } = context;
        const frozenSelection = Object.freeze({
            mode: selection.mode,
            files: Object.freeze([...selection.files])
        });

        return this.applyExtensions<FileMenuExtensionContext>(this.fileMenuExtensions, menu, 'file', addItem => ({
            addItem,
            file,
            selection: frozenSelection
        }));
    }

    /**
     * Calls registered folder menu extensions and returns number of items added.
     * @internal
     */
    applyFolderMenuExtensions(context: FolderMenuExtensionApplyContext): number {
        const { menu, folder } = context;
        return this.applyExtensions<FolderMenuExtensionContext>(this.folderMenuExtensions, menu, 'folder', addItem => ({
            addItem,
            folder
        }));
    }

    /**
     * Calls registered tag menu extensions and returns number of items added.
     * @internal
     */
    applyTagMenuExtensions(context: TagMenuExtensionApplyContext): number {
        const { menu, tag } = context;
        return this.applyExtensions<TagMenuExtensionContext>(this.tagMenuExtensions, menu, 'tag', addItem => ({
            addItem,
            tag
        }));
    }

    /**
     * Calls registered property menu extensions and returns number of items added.
     * @internal
     */
    applyPropertyMenuExtensions(context: PropertyMenuExtensionApplyContext): number {
        const { menu, nodeId } = context;
        return this.applyExtensions<PropertyMenuExtensionContext>(this.propertyMenuExtensions, menu, 'property', addItem => ({
            addItem,
            nodeId
        }));
    }
}
