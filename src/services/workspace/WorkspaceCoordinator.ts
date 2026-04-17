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

import { TFile, WorkspaceLeaf } from 'obsidian';
import type NotebookNavigatorPlugin from '../../main';
import { NOTEBOOK_NAVIGATOR_CALENDAR_VIEW, NOTEBOOK_NAVIGATOR_VIEW } from '../../types';
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

    public detachCalendarViewLeaves(): void {
        const leaves = this.plugin.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_CALENDAR_VIEW);
        for (const leaf of leaves) {
            leaf.detach();
        }
    }

    async ensureCalendarViewInRightSidebar(options?: {
        reveal?: boolean;
        activate?: boolean;
        shouldContinue?: () => boolean;
    }): Promise<WorkspaceLeaf | null> {
        const reveal = options?.reveal ?? false;
        const activate = options?.activate ?? reveal;
        const shouldContinue = options?.shouldContinue ?? (() => true);
        const { workspace } = this.plugin.app;

        if (!shouldContinue()) {
            return null;
        }

        const existingLeaf = workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_CALENDAR_VIEW)[0] ?? null;
        if (existingLeaf) {
            if (reveal) {
                await workspace.revealLeaf(existingLeaf);
            } else if (activate) {
                workspace.setActiveLeaf(existingLeaf, { focus: true });
            }

            return shouldContinue() ? existingLeaf : null;
        }

        const leaf = workspace.getRightLeaf(false);
        if (!leaf) {
            return null;
        }

        await leaf.setViewState({
            type: NOTEBOOK_NAVIGATOR_CALENDAR_VIEW,
            active: activate
        });
        if (!shouldContinue()) {
            leaf.detach();
            return null;
        }

        if (reveal) {
            await workspace.revealLeaf(leaf);
        }

        return leaf;
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
            await workspace.revealLeaf(leaf);
        } else {
            // Create navigator in left sidebar
            leaf = workspace.getLeftLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: NOTEBOOK_NAVIGATOR_VIEW, active: true });
                await workspace.revealLeaf(leaf);
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
     * This is a "manual" reveal that targets the file's true location.
     * Hidden files remain not revealable while hidden items are off; views may
     * keep the current context and select the file as fallback.
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
}
