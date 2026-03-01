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

/**
 * OPTIMIZATIONS:
 *
 * 1. React.memo - Component only re-renders when props actually change
 *
 * 2. Props-based data flow:
 *    - All data comes from NavigationPane via props
 *    - virtualFolder: Static UI construct defined in NavigationPane
 *    - isExpanded: Expansion state from ExpansionContext (via NavigationPane)
 *    - hasChildren: Computed by NavigationPane based on tag tree structure
 *    - No direct service or cache access
 *
 * 3. Stable callbacks:
 *    - handleDoubleClick: Memoized to handle expansion toggle
 *    - handleChevronClick: Memoized with event propagation handling
 *
 * 4. Icon optimization:
 *    - Icons set via useEffect to avoid render blocking
 *    - Chevron updates based on hasChildren and isExpanded
 *    - Virtual folder icons are defined in the virtualFolder prop
 *
 * 5. Minimal overhead:
 *    - No file operations
 *    - No tooltip functionality needed
 *    - Pure presentational component
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import type { DragEvent } from 'react';
import { useSettingsState } from '../context/SettingsContext';
import { getIconService, useIconServiceVersion } from '../services/icons';
import {
    PROPERTIES_ROOT_VIRTUAL_FOLDER_ID,
    SHORTCUTS_VIRTUAL_FOLDER_ID,
    TAGS_ROOT_VIRTUAL_FOLDER_ID,
    VirtualFolder,
    type CSSPropertiesWithVars
} from '../types';
import { useUXPreferences } from '../context/UXPreferencesContext';
import type { NoteCountInfo } from '../types/noteCounts';
import { buildNoteCountDisplay } from '../utils/noteCountFormatting';
import { buildSearchMatchContentClass } from '../utils/searchHighlight';
import { resolveUXIcon } from '../utils/uxIcons';
import { IndentGuideColumns } from './IndentGuideColumns';
import { NavItemHoverActionSlot } from './NavItemHoverActionSlot';

export interface VirtualFolderTrailingAction {
    actionLabel: string;
    icon: string;
    onClick: () => void;
    labelMode?: 'note-count';
}

interface VirtualFolderItemProps {
    virtualFolder: VirtualFolder; // Static data structure from NavigationPane
    level: number; // Nesting level for indentation
    indentGuideLevels?: number[]; // Levels of expanded ancestors whose connector lines should be rendered on this row
    isExpanded: boolean; // From ExpansionContext via NavigationPane
    hasChildren: boolean; // Computed by NavigationPane from tag tree
    onToggle: () => void; // Expansion toggle handler
    onSelect?: (event: React.MouseEvent<HTMLDivElement>) => void; // Optional selection handler
    isSelected?: boolean; // Selection state for virtual folders that act as collections
    showFileCount?: boolean; // Whether to render note count badge
    countInfo?: NoteCountInfo; // Pre-computed note counts
    searchMatch?: 'include' | 'exclude'; // Search highlight state
    trailingAction?: VirtualFolderTrailingAction; // Optional trailing action button
    onDragOver?: (event: DragEvent<HTMLDivElement>) => void; // Optional drag over handler for shortcuts
    onDrop?: (event: DragEvent<HTMLDivElement>) => void; // Optional drop handler for shortcuts
    onDragLeave?: (event: DragEvent<HTMLDivElement>) => void; // Optional drag leave handler for shortcuts
    dropConfig?: {
        zone: string;
        path: string;
        tag?: string;
        allowInternalDrop?: boolean;
        allowExternalDrop?: boolean;
    };
    onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * Renders a virtual folder item used for organizing tags in the navigation pane.
 * Virtual folders are UI-only constructs that group tags (for example, the "Tags" section).
 * They have expand/collapse functionality but no file operations or context menus.
 *
 * This is a pure presentational component - all data flows from NavigationPane via props.
 *
 * @param props - The component props
 * @param props.virtualFolder - The virtual folder data containing id, name, and optional icon (defined in NavigationPane)
 * @param props.level - The nesting level for indentation
 * @param props.isExpanded - Whether this folder is currently expanded (from ExpansionContext via NavigationPane)
 * @param props.hasChildren - Whether this folder contains child items (computed by NavigationPane)
 * @param props.onToggle - Handler called when the expand/collapse chevron is clicked
 * @returns A virtual folder item element with chevron, icon, and name
 */
export const VirtualFolderComponent = React.memo(function VirtualFolderComponent({
    virtualFolder,
    level,
    indentGuideLevels,
    isExpanded,
    hasChildren,
    onSelect,
    isSelected = false,
    showFileCount = false,
    countInfo,
    searchMatch,
    trailingAction,
    onToggle,
    onDragOver,
    onDrop,
    onDragLeave,
    dropConfig,
    onContextMenu
}: VirtualFolderItemProps) {
    const settings = useSettingsState();
    const uxPreferences = useUXPreferences();
    const folderRef = useRef<HTMLDivElement>(null);
    const chevronRef = useRef<HTMLDivElement>(null);
    const iconRef = useRef<HTMLSpanElement>(null);
    const iconVersion = useIconServiceVersion();
    const includeDescendantNotes = uxPreferences.includeDescendantNotes;

    // Format note count display based on descendant notes preference and count settings
    const noteCountDisplay = useMemo(() => {
        if (!countInfo) {
            return null;
        }
        const useSeparateCounts = includeDescendantNotes && settings.separateNoteCounts;
        return buildNoteCountDisplay(countInfo, includeDescendantNotes, useSeparateCounts);
    }, [countInfo, includeDescendantNotes, settings.separateNoteCounts]);

    // Determine if count badge should be rendered based on settings and available data
    const shouldDisplayCount = useMemo(() => {
        if (!showFileCount) {
            return false;
        }
        if (!noteCountDisplay) {
            return false;
        }
        if (
            (virtualFolder.id === TAGS_ROOT_VIRTUAL_FOLDER_ID || virtualFolder.id === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) &&
            !includeDescendantNotes
        ) {
            return false;
        }
        return noteCountDisplay.shouldDisplay;
    }, [includeDescendantNotes, noteCountDisplay, showFileCount, virtualFolder.id]);

    const trailingActionLabelMode = trailingAction?.labelMode;

    const trailingActionLabel = useMemo(() => {
        if (trailingActionLabelMode !== 'note-count') {
            return undefined;
        }
        if (!shouldDisplayCount || !noteCountDisplay) {
            return undefined;
        }
        return noteCountDisplay.label;
    }, [noteCountDisplay, shouldDisplayCount, trailingActionLabelMode]);

    const shouldRenderCountBadge = useMemo(() => {
        if (!shouldDisplayCount || !noteCountDisplay) {
            return false;
        }
        return trailingActionLabelMode !== 'note-count';
    }, [noteCountDisplay, shouldDisplayCount, trailingActionLabelMode]);

    // Build CSS class name with selection state
    const className = useMemo(() => {
        const classes = ['nn-navitem'];
        if (virtualFolder.id === SHORTCUTS_VIRTUAL_FOLDER_ID) {
            classes.push('nn-shortcut-header-item');
        }
        if (virtualFolder.id === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
            classes.push('nn-properties-header-item');
        }
        if (isSelected) {
            classes.push('nn-selected');
        }
        if (searchMatch) {
            classes.push('nn-has-search-match');
        }
        return classes.join(' ');
    }, [isSelected, searchMatch, virtualFolder.id]);

    const contentClassName = useMemo(() => buildSearchMatchContentClass(['nn-navitem-content'], searchMatch), [searchMatch]);

    const handleDoubleClick = useCallback(() => {
        if (hasChildren) {
            onToggle();
        }
    }, [hasChildren, onToggle]);

    const handleChevronClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (hasChildren) onToggle();
        },
        [hasChildren, onToggle]
    );

    const handleChevronDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
    }, []);

    // Route click to selection handler if provided, otherwise toggle expansion
    const handleContentClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (onSelect) {
                event.preventDefault();
                event.stopPropagation();
                onSelect(event);
                return;
            }
            onToggle();
        },
        [onSelect, onToggle]
    );

    useEffect(() => {
        const chevronEl = chevronRef.current;
        if (!chevronEl) {
            return;
        }

        if (!hasChildren) {
            chevronEl.replaceChildren();
            return;
        }

        getIconService().renderIcon(
            chevronEl,
            resolveUXIcon(settings.interfaceIcons, isExpanded ? 'nav-tree-collapse' : 'nav-tree-expand')
        );
    }, [hasChildren, iconVersion, isExpanded, settings.interfaceIcons]);

    // Renders icon for virtual folders when an icon is configured on the item
    useEffect(() => {
        if (iconRef.current && virtualFolder.icon) {
            getIconService().renderIcon(iconRef.current, virtualFolder.icon);
        }
    }, [virtualFolder.icon, iconVersion]);

    const virtualFolderStyle: CSSPropertiesWithVars = { '--level': level };

    return (
        <div
            ref={folderRef}
            className={className}
            data-search-match={searchMatch ?? undefined}
            data-path={virtualFolder.id}
            data-drop-zone={dropConfig?.zone}
            data-drop-path={dropConfig?.path}
            data-tag={dropConfig?.tag}
            data-allow-internal-drop={dropConfig?.allowInternalDrop === false ? 'false' : undefined}
            data-allow-external-drop={dropConfig?.allowExternalDrop === false ? 'false' : undefined}
            data-level={level}
            style={virtualFolderStyle}
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-selected={onSelect ? isSelected : undefined}
            aria-level={level + 1}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragLeave={onDragLeave}
            onContextMenu={onContextMenu}
        >
            <div className={contentClassName} onClick={handleContentClick} onDoubleClick={handleDoubleClick}>
                <IndentGuideColumns levels={indentGuideLevels} />
                <div
                    className={`nn-navitem-chevron ${hasChildren ? 'nn-navitem-chevron--has-children' : 'nn-navitem-chevron--no-children'}`}
                    ref={chevronRef}
                    onClick={handleChevronClick}
                    onDoubleClick={handleChevronDoubleClick}
                    tabIndex={-1}
                />
                {virtualFolder.icon && <span className="nn-navitem-icon" ref={iconRef} />}
                <span className="nn-navitem-name">{virtualFolder.name}</span>
                <span className="nn-navitem-spacer" />
                {shouldRenderCountBadge && noteCountDisplay && <span className="nn-navitem-count">{noteCountDisplay.label}</span>}
                {trailingAction && (
                    <NavItemHoverActionSlot
                        label={trailingActionLabel}
                        actionLabel={trailingAction.actionLabel}
                        icon={trailingAction.icon}
                        onClick={trailingAction.onClick}
                    />
                )}
            </div>
        </div>
    );
});
