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

import { TFile, TFolder } from 'obsidian';
import { NOTEBOOK_NAVIGATOR_VIEW } from '../../types';

type NavigatorView = {
    navigateToFile: (file: TFile) => boolean;
    navigateToFolder: (folder: TFolder | string, options?: { preserveNavigationFocus?: boolean }) => boolean;
    navigateToTag: (tag: string) => string | null;
    navigateToProperty: (propertyNodeId: string) => string | null;
    whenReady?: () => Promise<boolean>;
};

type LeafWithView = { view: object | null };

type NavigationAPIHost = {
    app: {
        vault: { getFileByPath: (path: string) => TFile | null; getFolderByPath: (path: string) => TFolder | null };
        workspace: { getLeavesOfType: (viewType: string) => LeafWithView[] };
    };
    getPlugin: () => { activateView: () => Promise<object | null> };
};

/**
 * Navigation API - Navigate to files in the navigator
 */
export class NavigationAPI {
    constructor(private api: NavigationAPIHost) {}

    /**
     * Navigate to a specific file and select it
     * @param file - File to navigate to
     */
    async reveal(file: TFile | string): Promise<boolean> {
        const resolvedFile = this.resolveFile(file);
        if (!resolvedFile) {
            return false;
        }

        const view = await this.ensureViewOpen();
        if (!view) {
            return false;
        }

        return view.navigateToFile(resolvedFile);
    }

    /**
     * Select a folder in the navigator navigation pane
     * @param folder - Folder to select
     */
    async navigateToFolder(folder: TFolder | string): Promise<boolean> {
        const resolvedFolder = this.resolveFolder(folder);
        if (!resolvedFolder) {
            return false;
        }

        const view = await this.ensureViewOpen();
        if (!view) {
            return false;
        }

        return view.navigateToFolder(resolvedFolder, { preserveNavigationFocus: true });
    }

    /**
     * Select a tag in the navigator navigation pane
     * @param tag - Tag to select (e.g. '#work' or 'work')
     */
    async navigateToTag(tag: string): Promise<boolean> {
        const view = await this.ensureViewOpen();
        if (!view) {
            return false;
        }

        return view.navigateToTag(tag) !== null;
    }

    /**
     * Select a property node in the navigator navigation pane
     * @param nodeId - Property node id (e.g. 'key:status' or 'key:status=done')
     */
    async navigateToProperty(nodeId: string): Promise<boolean> {
        const view = await this.ensureViewOpen();
        if (!view) {
            return false;
        }

        return view.navigateToProperty(nodeId) !== null;
    }

    private resolveFile(file: TFile | string): TFile | null {
        if (typeof file === 'string') {
            return this.api.app.vault.getFileByPath(file);
        }

        return this.api.app.vault.getFileByPath(file.path);
    }

    private resolveFolder(folder: TFolder | string): TFolder | null {
        if (typeof folder === 'string') {
            return this.api.app.vault.getFolderByPath(folder);
        }

        return this.api.app.vault.getFolderByPath(folder.path);
    }

    /**
     * Ensure the navigator view is open
     */
    private async ensureViewOpen(): Promise<NavigatorView | null> {
        const plugin = this.api.getPlugin();
        const leaves = this.api.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);

        const existingView = this.extractNavigatorView(leaves);
        if (existingView) {
            return (await this.waitForNavigatorView(existingView)) ? existingView : null;
        }

        await plugin.activateView();
        const newLeaves = this.api.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
        const newView = this.extractNavigatorView(newLeaves);
        if (!newView) {
            return null;
        }

        return (await this.waitForNavigatorView(newView)) ? newView : null;
    }

    private async waitForNavigatorView(view: NavigatorView): Promise<boolean> {
        if (!view.whenReady) {
            return true;
        }

        return view.whenReady();
    }

    private extractNavigatorView(leaves: LeafWithView[]): NavigatorView | null {
        for (const leaf of leaves) {
            const view = leaf.view;
            if (view && this.isNavigatorView(view)) {
                return view;
            }
        }
        return null;
    }

    private isNavigatorView(view: object): view is NavigatorView {
        if (!('navigateToFile' in view) || typeof view.navigateToFile !== 'function') {
            return false;
        }
        if (!('navigateToFolder' in view) || typeof view.navigateToFolder !== 'function') {
            return false;
        }
        if (!('navigateToTag' in view) || typeof view.navigateToTag !== 'function') {
            return false;
        }
        if (!('navigateToProperty' in view) || typeof view.navigateToProperty !== 'function') {
            return false;
        }

        return true;
    }
}
