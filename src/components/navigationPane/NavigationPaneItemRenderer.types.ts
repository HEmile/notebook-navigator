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

import React from 'react';
import type { App, TFile } from 'obsidian';
import type { NotebookNavigatorSettings } from '../../settings/types';
import type { ExpansionAction } from '../../context/ExpansionContext';
import type { SelectionState } from '../../context/SelectionContext';
import type { NoteCountInfo } from '../../types/noteCounts';
import type { CombinedNavigationItem } from '../../types/virtualization';
import type { NavigationSectionId } from '../../types';
import type { NavigationPaneShortcutRenderState } from '../../hooks/navigationPane/navigationPaneShortcutTypes';
import type { NavigationPaneTreeInteractionsResult } from '../../hooks/navigationPane/useNavigationPaneTreeInteractions';
import type { NavigationSearchHighlightsResult } from '../../hooks/navigationPane/useNavigationSearchHighlights';

export interface NavigationPaneExpansionStateSnapshot {
    expandedFolders: Set<string>;
    expandedTags: Set<string>;
    expandedTopics: Set<string>;
    expandedProperties: Set<string>;
    expandedVirtualFolders: Set<string>;
}

export interface NavigationPaneRowContext {
    app: App;
    settings: NotebookNavigatorSettings;
    isMobile: boolean;
    expansionState: NavigationPaneExpansionStateSnapshot;
    expansionDispatch: React.Dispatch<ExpansionAction>;
    selectionState: SelectionState;
    indentGuideLevelsByKey: Map<string, number[]>;
    firstSectionId: NavigationSectionId | null;
    firstInlineFolderPath: string | null;
    shouldPinShortcuts: boolean;
    showHiddenItems: boolean;
    shortcutsExpanded: boolean;
    recentNotesExpanded: boolean;
    folderCounts: Map<string, NoteCountInfo>;
    tagCounts: Map<string, NoteCountInfo>;
    propertyCounts: Map<string, NoteCountInfo>;
    vaultChangeVersion: number;
    getFileDisplayName: (file: TFile) => string;
    getSolidBackground: (color?: string | null) => string | undefined;
    shortcuts: NavigationPaneShortcutRenderState;
    tree: NavigationPaneTreeInteractionsResult;
    searchHighlights: NavigationSearchHighlightsResult;
    onSectionContextMenu: (
        event: React.MouseEvent<HTMLDivElement>,
        sectionId: NavigationSectionId,
        options?: { allowSeparator?: boolean }
    ) => void;
}

export interface NavigationPaneRowProps {
    item: CombinedNavigationItem;
    context: NavigationPaneRowContext;
}
