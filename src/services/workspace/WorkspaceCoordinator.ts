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

import { TFile, WorkspaceLeaf } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { NOTEBOOK_NAVIGATOR_VIEW } from '../../types';
import { NotebookNavigatorView } from '../../view/NotebookNavigatorView';
import type { RevealFileOptions } from '../../hooks/useNavigatorReveal';

/**
 * Coordinates interactions with Obsidian's workspace that relate to the Notebook Navigator view.
 * Handles creation/focusing of the view and delegates reveal operations to the React layer.
 */
export default class WorkspaceCoordinator {
    private readonly plugin: NotebookNavigatorPlugin;

    constructor(plugin: NotebookNavigatorPlugin) {
        this.plugin = plugin;
    }

    /**
     * Ensures the navigator view exists in the workspace and returns the active leaf for it.
     */
    async activateNavigatorView(): Promise<WorkspaceLeaf | null> {
        const { workspace } = this.plugin.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);

        if (leaves.length > 0) {
            // Navigator exists, reveal the first instance
            leaf = leaves[0];
            workspace.revealLeaf(leaf);
        } else {
            // Create navigator in left sidebar
            leaf = workspace.getLeftLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: NOTEBOOK_NAVIGATOR_VIEW, active: true });
                workspace.revealLeaf(leaf);
            }
        }

        return leaf;
    }

    /**
     * Retrieves all workspace leaves hosting the navigator view.
     */
    public getNavigatorLeaves(): WorkspaceLeaf[] {
        return this.plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
    }

    /**
     * Reveals a file in its actual parent folder across all navigator views.
     * This is a "manual" reveal that always navigates to the file's true location.
     */
    revealFileInActualFolder(file: TFile, options?: RevealFileOptions): void {
        this.getNavigatorLeaves().forEach(leaf => {
            const { view } = leaf;
            if (view instanceof NotebookNavigatorView) {
                view.navigateToFile(file, options);
            }
        });
    }

    /**
     * Reveals a file while attempting to preserve the current navigation context.
     * This is an "auto" reveal used during file opens and homepage loading.
     */
    revealFileInNearestFolder(file: TFile, options?: RevealFileOptions): void {
        this.getNavigatorLeaves().forEach(leaf => {
            const { view } = leaf;
            if (view instanceof NotebookNavigatorView) {
                view.revealFileInNearestFolder(file, options);
            }
        });
    }

    /**
     * Reveals a topic in the navigation pane
     * Expands parent topics and scrolls to make the topic visible
     */
    revealTopic(topicName: string): void {
        this.getNavigatorLeaves().forEach(leaf => {
            const { view } = leaf;
            if (view instanceof NotebookNavigatorView) {
                view.revealTopic(topicName);
            }
        });
    }

    /**
     * Reveals a topic by expanding all paths to root nodes
     * This is useful when a topic appears in multiple places in the hierarchy
     */
    revealTopicAllPaths(topicName: string): void {
        this.getNavigatorLeaves().forEach(leaf => {
            const { view } = leaf;
            if (view instanceof NotebookNavigatorView) {
                view.revealTopicAllPaths(topicName);
            }
        });
    }
}
