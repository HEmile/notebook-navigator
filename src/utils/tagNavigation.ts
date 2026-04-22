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

import type { ExpansionAction } from '../context/ExpansionContext';
import type { SelectionAction, SelectionRevealSource } from '../context/SelectionContext';
import type { UIAction } from '../context/UIStateContext';
import type { TagTreeNode } from '../types/storage';
import { ItemType, TAGS_ROOT_VIRTUAL_FOLDER_ID } from '../types';
import { resolveCanonicalTagPath } from './tagUtils';
import { isVirtualTagCollectionId } from './virtualTagCollections';

type Dispatch<T> = (action: T) => void;

interface FocusPaneOptions {
    updateSinglePaneView?: boolean;
}

export interface NavigateToTagOptions {
    skipScroll?: boolean;
    source?: SelectionRevealSource;
    preserveNavigationFocus?: boolean;
    requireTagInTree?: boolean;
    skipFocus?: boolean;
    historyIndex?: number;
}

export interface TagNavigationEnvironment {
    showTags: boolean;
    showAllTagsFolder: boolean;
    expandedTags: Set<string>;
    expandedVirtualFolders: Set<string>;
    expansionDispatch: Dispatch<ExpansionAction>;
    selectionDispatch: Dispatch<SelectionAction>;
    uiState: {
        singlePane: boolean;
        currentSinglePaneView: 'navigation' | 'files';
        focusedPane: 'navigation' | 'files' | 'search';
    };
    uiDispatch: Dispatch<UIAction>;
    findTagInTree: (tagPath: string) => TagTreeNode | null;
    focusNavigationPane?: (options?: FocusPaneOptions) => void;
    focusFilesPane?: (options?: FocusPaneOptions) => void;
    requestScroll?: (path: string, options: { align: 'auto'; itemType: typeof ItemType.TAG }) => void;
}

function focusPane(env: TagNavigationEnvironment, pane: 'navigation' | 'files', options?: { updateSinglePaneView?: boolean }): void {
    if (pane === 'navigation') {
        if (env.focusNavigationPane) {
            env.focusNavigationPane(options);
            return;
        }
    } else {
        if (env.focusFilesPane) {
            env.focusFilesPane(options);
            return;
        }
    }

    if (env.uiState.singlePane && options?.updateSinglePaneView && env.uiState.currentSinglePaneView !== pane) {
        env.uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: pane });
    }
    if (env.uiState.focusedPane !== pane) {
        env.uiDispatch({ type: 'SET_FOCUSED_PANE', pane });
    }
}

function selectTagAndFocus(env: TagNavigationEnvironment, tagPath: string, options?: NavigateToTagOptions): void {
    env.selectionDispatch({
        type: 'SET_SELECTED_TAG',
        tag: tagPath,
        source: options?.source,
        historyIndex: options?.historyIndex
    });

    if (options?.skipFocus) {
        return;
    }

    const preserveNavigationFocus = options?.preserveNavigationFocus ?? true;
    if (env.uiState.singlePane) {
        focusPane(env, preserveNavigationFocus ? 'navigation' : 'files', { updateSinglePaneView: true });
    } else {
        focusPane(env, preserveNavigationFocus ? 'navigation' : 'files');
    }
}

function getParentTagPaths(tagPath: string): string[] {
    if (!tagPath.includes('/')) {
        return [];
    }

    const parts = tagPath.split('/');
    const tagsToExpand: string[] = [];
    for (let i = 1; i < parts.length; i++) {
        tagsToExpand.push(parts.slice(0, i).join('/'));
    }
    return tagsToExpand;
}

/**
 * Selects a tag in the navigation pane, expands ancestors, manages focus, and optionally requests scrolling.
 * Returns the canonical tag path when navigation succeeded, otherwise null.
 */
export function navigateToTag(env: TagNavigationEnvironment, tagPath: string, options?: NavigateToTagOptions): string | null {
    if (!tagPath) {
        return null;
    }

    const canonicalPath = resolveCanonicalTagPath(tagPath);
    if (!canonicalPath) {
        return null;
    }

    const isVirtualCollection = isVirtualTagCollectionId(canonicalPath);
    if (!isVirtualCollection) {
        const tagNode = env.findTagInTree(canonicalPath);
        const requireTagInTree = options?.requireTagInTree ?? true;
        if (!tagNode && requireTagInTree) {
            return null;
        }
        if (!tagNode) {
            selectTagAndFocus(env, canonicalPath, options);
            return canonicalPath;
        }
    }

    if (env.showTags && env.showAllTagsFolder && !env.expandedVirtualFolders.has(TAGS_ROOT_VIRTUAL_FOLDER_ID)) {
        const nextExpanded = new Set(env.expandedVirtualFolders);
        nextExpanded.add(TAGS_ROOT_VIRTUAL_FOLDER_ID);
        env.expansionDispatch({ type: 'SET_EXPANDED_VIRTUAL_FOLDERS', folders: nextExpanded });
    }

    if (!isVirtualCollection) {
        const tagsToExpand = getParentTagPaths(canonicalPath);
        const needsExpansion = tagsToExpand.some(path => !env.expandedTags.has(path));
        if (needsExpansion) {
            env.expansionDispatch({ type: 'EXPAND_TAGS', tagPaths: tagsToExpand });
        }
    }

    selectTagAndFocus(env, canonicalPath, options);

    const shouldSkipScroll = Boolean(options?.skipScroll);
    if (!shouldSkipScroll && env.requestScroll) {
        env.requestScroll(canonicalPath, { align: 'auto', itemType: ItemType.TAG });
    }

    return canonicalPath;
}
