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

import { App, EventRef, Events } from 'obsidian';
import type NotebookNavigatorPlugin from '../main';
import type { NotebookNavigatorEventType, NotebookNavigatorEvents } from './types';

// Import sub-APIs
import { NavigationAPI } from './modules/NavigationAPI';
import { MetadataAPI } from './modules/MetadataAPI';
import { SelectionAPI } from './modules/SelectionAPI';
import { MenusAPI } from './modules/MenusAPI';
import { PropertyNodesAPI } from './modules/PropertyNodesAPI';
import { getVirtualTagCollection, isVirtualTagCollectionId, VIRTUAL_TAG_COLLECTION_IDS } from '../utils/virtualTagCollections';

// Import versioning
import { API_VERSION } from './version';
import type { TagCollectionId } from './types';

export const INTERNAL_NOTEBOOK_NAVIGATOR_API = Symbol('NotebookNavigatorInternalAPI');

export interface NotebookNavigatorInternalAPI {
    readonly metadata: Pick<MetadataAPI, 'updateFromSettings' | 'emitFolderChangedForPath'>;
    readonly selection: Pick<SelectionAPI, 'updateNavigationState' | 'updateFileState'>;
    readonly menus: Pick<
        MenusAPI,
        'applyFileMenuExtensions' | 'applyFolderMenuExtensions' | 'applyTagMenuExtensions' | 'applyPropertyMenuExtensions'
    >;
    setStorageReady: (ready: boolean) => void;
}

type NotebookNavigatorEventTrigger = <T extends NotebookNavigatorEventType>(
    event: T,
    ...args: NotebookNavigatorEvents[T] extends void ? [] : [data: NotebookNavigatorEvents[T]]
) => void;

/**
 * Public API for the Notebook Navigator plugin
 * Allows other plugins to interact with notebook navigation features
 */
export class NotebookNavigatorAPI {
    private readonly plugin: NotebookNavigatorPlugin;
    private readonly app: App;
    private readonly events: Events;
    private storageReady = false;
    private readonly navigationController: NavigationAPI;
    private readonly metadataController: MetadataAPI;
    private readonly selectionController: SelectionAPI;
    private readonly menusController: MenusAPI;
    private readonly propertyNodesController: PropertyNodesAPI;

    // Sub-APIs
    public readonly navigation: Pick<NavigationAPI, 'reveal' | 'navigateToFolder' | 'navigateToTag' | 'navigateToProperty'>;
    public readonly metadata: Pick<
        MetadataAPI,
        | 'getFolderMeta'
        | 'setFolderMeta'
        | 'getTagMeta'
        | 'setTagMeta'
        | 'getPropertyMeta'
        | 'setPropertyMeta'
        | 'getPinned'
        | 'isPinned'
        | 'pin'
        | 'unpin'
    >;
    public readonly selection: Pick<SelectionAPI, 'getNavItem' | 'getCurrent'>;
    public readonly menus: Pick<MenusAPI, 'registerFileMenu' | 'registerFolderMenu' | 'registerTagMenu' | 'registerPropertyMenu'>;
    public readonly tagCollections: {
        readonly taggedId: TagCollectionId;
        readonly untaggedId: TagCollectionId;
        isCollection: (tag: string | null | undefined) => tag is TagCollectionId;
        getLabel: (tag: TagCollectionId) => string;
    };
    public readonly propertyNodes: Pick<PropertyNodesAPI, 'rootId' | 'buildKey' | 'buildValue' | 'parse' | 'normalize'>;
    readonly [INTERNAL_NOTEBOOK_NAVIGATOR_API]: NotebookNavigatorInternalAPI;

    constructor(plugin: NotebookNavigatorPlugin, app: App) {
        this.plugin = plugin;
        this.app = app;
        this.events = new Events();

        const trigger: NotebookNavigatorEventTrigger = (event, ...args) => {
            this.trigger(event, ...args);
        };

        // Initialize sub-APIs
        this.navigationController = new NavigationAPI({
            app: this.app,
            getPlugin: () => this.plugin
        });
        this.metadataController = new MetadataAPI({
            getApp: () => this.app,
            getPlugin: () => this.plugin,
            trigger
        });
        this.selectionController = new SelectionAPI({
            app: this.app,
            getPlugin: () => this.plugin,
            trigger
        });
        this.menusController = new MenusAPI();
        this.propertyNodesController = new PropertyNodesAPI();

        this.navigation = Object.freeze({
            reveal: file => this.navigationController.reveal(file),
            navigateToFolder: folder => this.navigationController.navigateToFolder(folder),
            navigateToTag: tag => this.navigationController.navigateToTag(tag),
            navigateToProperty: nodeId => this.navigationController.navigateToProperty(nodeId)
        });
        this.metadata = Object.freeze({
            getFolderMeta: folder => this.metadataController.getFolderMeta(folder),
            setFolderMeta: (folder, meta) => this.metadataController.setFolderMeta(folder, meta),
            getTagMeta: tag => this.metadataController.getTagMeta(tag),
            setTagMeta: (tag, meta) => this.metadataController.setTagMeta(tag, meta),
            getPropertyMeta: nodeId => this.metadataController.getPropertyMeta(nodeId),
            setPropertyMeta: (nodeId, meta) => this.metadataController.setPropertyMeta(nodeId, meta),
            getPinned: () => this.metadataController.getPinned(),
            isPinned: (file, context) => this.metadataController.isPinned(file, context),
            pin: (file, context) => this.metadataController.pin(file, context),
            unpin: (file, context) => this.metadataController.unpin(file, context)
        });
        this.selection = Object.freeze({
            getNavItem: () => this.selectionController.getNavItem(),
            getCurrent: () => this.selectionController.getCurrent()
        });
        this.menus = Object.freeze({
            registerFileMenu: callback => this.menusController.registerFileMenu(callback),
            registerFolderMenu: callback => this.menusController.registerFolderMenu(callback),
            registerTagMenu: callback => this.menusController.registerTagMenu(callback),
            registerPropertyMenu: callback => this.menusController.registerPropertyMenu(callback)
        });
        const getTagCollectionLabel = (tag: unknown): string => {
            if (typeof tag === 'string' && isVirtualTagCollectionId(tag)) {
                return getVirtualTagCollection(tag).getLabel();
            }

            return typeof tag === 'string' ? tag : '';
        };
        this.tagCollections = Object.freeze({
            taggedId: VIRTUAL_TAG_COLLECTION_IDS.TAGGED,
            untaggedId: VIRTUAL_TAG_COLLECTION_IDS.UNTAGGED,
            isCollection: (tag: string | null | undefined): tag is TagCollectionId => isVirtualTagCollectionId(tag),
            getLabel: (tag: TagCollectionId) => getTagCollectionLabel(tag)
        });
        this.propertyNodes = Object.freeze({
            rootId: this.propertyNodesController.rootId,
            buildKey: key => this.propertyNodesController.buildKey(key),
            buildValue: (key, valuePath) => this.propertyNodesController.buildValue(key, valuePath),
            parse: nodeId => this.propertyNodesController.parse(nodeId),
            normalize: nodeId => this.propertyNodesController.normalize(nodeId)
        });
        this[INTERNAL_NOTEBOOK_NAVIGATOR_API] = Object.freeze({
            metadata: this.metadataController,
            selection: this.selectionController,
            menus: this.menusController,
            setStorageReady: (ready: boolean) => {
                this.setStorageReady(ready);
            }
        });
    }

    /**
     * Get the current API version
     */
    getVersion(): string {
        return API_VERSION.toString();
    }

    /**
     * Check if the initial storage bootstrap has completed
     * @returns true if initial storage-backed API reads are available
     */
    isStorageReady(): boolean {
        return this.storageReady;
    }

    /**
     * Resolve when the initial storage bootstrap completes
     */
    whenReady(): Promise<void> {
        if (this.storageReady) {
            return Promise.resolve();
        }

        return new Promise(resolve => {
            this.once('storage-ready', () => resolve());
        });
    }

    /**
     * Mark storage as ready (internal use only)
     * @internal
     */
    private setStorageReady(ready: boolean): void {
        if (!ready) {
            return;
        }

        if (this.storageReady) {
            return;
        }

        this.storageReady = true;
        if (ready) {
            this.trigger('storage-ready');
        }
    }

    /**
     * Subscribe to Notebook Navigator events with type safety
     */
    on<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void): EventRef {
        return this.events.on(event, data => {
            callback(data as NotebookNavigatorEvents[T]);
        });
    }

    /**
     * Subscribe to an event only once - automatically unsubscribes after first trigger
     */
    once<T extends NotebookNavigatorEventType>(event: T, callback: (data: NotebookNavigatorEvents[T]) => void): EventRef {
        const ref = this.events.on(event, data => {
            this.events.offref(ref);
            callback(data as NotebookNavigatorEvents[T]);
        });
        return ref;
    }

    /**
     * Unsubscribe from events
     */
    off(ref: EventRef): void {
        this.events.offref(ref);
    }

    /**
     * Trigger an event (internal use)
     */
    private trigger<T extends NotebookNavigatorEventType>(
        event: T,
        ...args: NotebookNavigatorEvents[T] extends void ? [] : [data: NotebookNavigatorEvents[T]]
    ): void {
        this.events.trigger(event, ...args);
    }
}
