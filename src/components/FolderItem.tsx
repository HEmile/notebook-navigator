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
 * 2. Props-based state:
 *    - icon and color passed as props from NavigationPane to enable proper reactivity
 *    - File count pre-computed by parent to avoid redundant calculations
 *
 * 3. Memoized values:
 *    - hasFolderNote: Cached check for folder note existence
 *    - className: Cached CSS class string construction
 *    - folderNameClassName: Cached folder name styling classes
 *
 * 4. Stable callbacks:
 *    - handleDoubleClick: Memoized folder expansion handler
 *    - handleChevronClick: Memoized chevron click with Alt+click support
 *    - handleChevronDoubleClick: Prevents event propagation
 *    - handleNameClick: Optional folder name click handler
 *
 * 5. Direct computations:
 *    - hasChildren: NOT memoized because Obsidian mutates folder.children array
 *    - This ensures chevron updates immediately when subfolders are added/removed
 *
 * 6. Icon rendering optimization:
 *    - Icons rendered via useEffect to avoid blocking main render
 *    - Conditional rendering based on settings.showFolderIcons
 *
 * 7. Tooltip optimization:
 *    - Tooltip only created on desktop (mobile skipped)
 *    - Tooltip creation deferred to useEffect
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { TFolder, TFile, setTooltip } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useUXPreferences } from '../context/UXPreferencesContext';
import { useContextMenu, hideNavigatorContextMenu } from '../hooks/useContextMenu';
import { strings } from '../i18n';
import { getIconService, useIconServiceVersion } from '../services/icons';
import { getTooltipPlacement } from '../utils/domUtils';
import { getFolderNote } from '../utils/folderNotes';
import {
    createFrontmatterPropertyExclusionMatcher,
    hasSubfolders,
    shouldExcludeFolder,
    shouldExcludeFileWithMatcher
} from '../utils/fileFilters';
import { getEffectiveFrontmatterExclusions } from '../utils/exclusionUtils';
import { shouldDisplayFile } from '../utils/fileTypeUtils';
import { IndentGuideColumns } from './IndentGuideColumns';
import type { NoteCountInfo } from '../types/noteCounts';
import { buildNoteCountDisplay, buildSortableNoteCountDisplay } from '../utils/noteCountFormatting';
import { useActiveProfile } from '../context/SettingsContext';
import { resolveUXIcon } from '../utils/uxIcons';
import { ItemType, type CSSPropertiesWithVars } from '../types';

interface FolderItemProps {
    folder: TFolder;
    displayName?: string;
    level: number;
    indentGuideLevels?: number[];
    isExpanded: boolean;
    isSelected: boolean;
    isExcluded?: boolean;
    onToggle: () => void;
    onClick: () => void;
    onNameClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
    onNameMouseDown?: (event: React.MouseEvent<HTMLSpanElement>) => void;
    onToggleAllSiblings?: () => void;
    icon?: string;
    color?: string;
    backgroundColor?: string;
    countInfo?: NoteCountInfo;
    excludedFolders: string[];
    vaultChangeVersion: number;
    disableContextMenu?: boolean;
    disableNavigationSeparatorActions?: boolean;
}

/**
 * Renders an individual folder item in the folder tree with expand/collapse functionality.
 * Displays folder icon, name, and optional file count. Handles selection state,
 * context menus, drag-and-drop, and auto-scrolling when selected.
 *
 * @param props - The component props
 * @param props.folder - The Obsidian TFolder to display
 * @param props.level - The nesting level for indentation
 * @param props.isExpanded - Whether this folder is currently expanded
 * @param props.isSelected - Whether this folder is currently selected
 * @param props.onToggle - Handler called when the expand/collapse chevron is clicked
 * @param props.onClick - Handler called when the folder is clicked
 * @returns A folder item element with chevron, icon, name and optional file count
 */
export const FolderItem = React.memo(function FolderItem({
    folder,
    displayName,
    level,
    indentGuideLevels,
    isExpanded,
    isSelected,
    isExcluded,
    onToggle,
    onClick,
    onNameClick,
    onNameMouseDown,
    onToggleAllSiblings,
    icon,
    color,
    backgroundColor,
    countInfo,
    excludedFolders,
    vaultChangeVersion,
    disableContextMenu,
    disableNavigationSeparatorActions
}: FolderItemProps) {
    const { app, isMobile } = useServices();
    const settings = useSettingsState();
    const { fileVisibility } = useActiveProfile();
    const uxPreferences = useUXPreferences();
    const includeDescendantNotes = uxPreferences.includeDescendantNotes;
    const showHiddenItems = uxPreferences.showHiddenItems;
    const folderRef = useRef<HTMLDivElement>(null);

    const chevronRef = React.useRef<HTMLDivElement>(null);
    const iconRef = React.useRef<HTMLSpanElement>(null);
    const iconVersion = useIconServiceVersion();
    // Resolves frontmatter exclusions, returns empty array when hidden items are shown
    const effectiveExcludedFiles = getEffectiveFrontmatterExclusions(settings, showHiddenItems);
    const effectiveExcludedFileMatcher = useMemo(
        () => createFrontmatterPropertyExclusionMatcher(effectiveExcludedFiles),
        [effectiveExcludedFiles]
    );

    // Count folders and files for tooltip (skip on mobile to save computation)
    const folderStats = React.useMemo(() => {
        // Return early if tooltips aren't needed
        if (isMobile || !settings.showTooltips) {
            return { fileCount: 0, folderCount: 0 };
        }

        const showHidden = showHiddenItems;
        // Tooltip should show immediate files only (non-recursive)
        let fileCount = 0;
        for (const child of folder.children) {
            if (child instanceof TFile) {
                if (shouldDisplayFile(child, fileVisibility, app)) {
                    if (!shouldExcludeFileWithMatcher(child, effectiveExcludedFileMatcher, app)) {
                        fileCount++;
                    }
                }
            }
        }

        // Count immediate child folders respecting hidden/excluded rules
        let folderCount = 0;
        for (const child of folder.children) {
            if (child instanceof TFolder) {
                if (showHidden) {
                    folderCount++;
                } else if (!shouldExcludeFolder(child.name, excludedFolders, child.path)) {
                    folderCount++;
                }
            }
        }

        return { fileCount, folderCount };
    }, [
        folder.children,
        isMobile,
        settings.showTooltips,
        showHiddenItems,
        fileVisibility,
        effectiveExcludedFileMatcher,
        excludedFolders,
        app
    ]);

    // Merge provided count info with default values to ensure all properties are present
    const noteCounts: NoteCountInfo = countInfo ?? { current: 0, descendants: 0, total: 0 };

    const folderTreeSortOverrides = settings.folderTreeSortOverrides;
    const hasChildSortOrderOverride = Boolean(
        folderTreeSortOverrides && Object.prototype.hasOwnProperty.call(folderTreeSortOverrides, folder.path)
    );
    const childSortOrderOverride = hasChildSortOrderOverride ? folderTreeSortOverrides?.[folder.path] : undefined;
    const sortOrderIndicator = childSortOrderOverride === 'alpha-desc' ? '↓' : childSortOrderOverride === 'alpha-asc' ? '↑' : undefined;

    // Determine if we should show separate counts (e.g., "2 • 5") or combined count (e.g., "7")
    const useSeparateCounts = includeDescendantNotes && settings.separateNoteCounts;
    // Build formatted display object with label and visibility flags
    const noteCountDisplay = buildSortableNoteCountDisplay(
        buildNoteCountDisplay(noteCounts, includeDescendantNotes, useSeparateCounts, '•'),
        sortOrderIndicator
    );
    const noteCountLabel = noteCountDisplay.label;
    // Render count badge when note counts are enabled and there is either a count or a sort override indicator
    const shouldDisplayCount = settings.showNoteCount && noteCountDisplay.shouldDisplay;

    // Check if folder has children - not memoized because Obsidian mutates the children array
    // The hasSubfolders function handles the logic of whether to show all or only visible subfolders
    const showHiddenFolders = showHiddenItems;
    const hasChildren = hasSubfolders(folder, excludedFolders, showHiddenFolders);

    // Use color from props (passed from NavigationPane)
    const customColor = color;
    // Determine whether to apply color to the folder name instead of the icon
    const applyColorToName = Boolean(customColor) && !settings.colorIconOnly;
    const folderNoteLinksEnabled = settings.enableFolderNotes && settings.enableFolderNoteLinks;

    const hasFolderNote = useMemo(() => {
        if (!folderNoteLinksEnabled) return false;
        const folderNote = getFolderNote(folder, settings);
        return folderNote !== null;
        // NOTE TO REVIEWER: Including **noteCounts.current** to detect folder content changes
        // NOTE TO REVIEWER: Including **vaultChangeVersion** to react to new folder notes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folder, settings, folderNoteLinksEnabled, noteCounts.current, vaultChangeVersion]);

    const isRootFolder = folder.path === '/';
    const effectiveDisplayName = isRootFolder ? settings.customVaultName || app.vault.getName() : displayName || folder.name;
    const shouldShowFolderIcon = settings.showFolderIcons || isRootFolder;

    const dragIconId = useMemo(() => {
        if (icon) {
            return icon;
        }
        if (isRootFolder) {
            return hasChildren && isExpanded ? 'open-vault' : 'vault';
        }
        return hasChildren && isExpanded
            ? resolveUXIcon(settings.interfaceIcons, 'nav-folder-open')
            : resolveUXIcon(settings.interfaceIcons, 'nav-folder-closed');
    }, [hasChildren, icon, isExpanded, isRootFolder, settings.interfaceIcons]);
    const customBackground = backgroundColor;

    // Memoize className to avoid string concatenation on every render
    const className = useMemo(() => {
        const classes = ['nn-navitem', 'nn-folder'];
        if (isSelected) classes.push('nn-selected');
        if (isExcluded) classes.push('nn-excluded');
        if (customBackground) classes.push('nn-has-custom-background');
        return classes.join(' ');
    }, [customBackground, isSelected, isExcluded]);

    const folderNameClassName = useMemo(() => {
        const classes = ['nn-navitem-name'];
        if (hasFolderNote) classes.push('nn-has-folder-note');
        if (applyColorToName) classes.push('nn-has-custom-color');
        return classes.join(' ');
    }, [applyColorToName, hasFolderNote]);

    // Stable event handlers
    const handleDoubleClick = useCallback(() => {
        if (hasChildren) {
            onToggle();
        }
    }, [hasChildren, onToggle]);

    const handleChevronClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (hasChildren) {
                if (e.altKey && onToggleAllSiblings) {
                    onToggleAllSiblings();
                } else {
                    onToggle();
                }
            }
        },
        [hasChildren, onToggle, onToggleAllSiblings]
    );

    const handleChevronDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
    }, []);

    const handleNameClick = useCallback(
        (e: React.MouseEvent<HTMLSpanElement>) => {
            if (onNameClick) {
                e.stopPropagation();
                onNameClick(e);
            }
        },
        [onNameClick]
    );

    const handleNameMouseDown = useCallback(
        (e: React.MouseEvent<HTMLSpanElement>) => {
            hideNavigatorContextMenu();
            if (onNameMouseDown) {
                e.stopPropagation();
                onNameMouseDown(e);
            }
        },
        [onNameMouseDown]
    );

    // Add Obsidian tooltip
    useEffect(() => {
        if (!folderRef.current) return;

        // Skip tooltip creation on mobile
        if (isMobile) return;

        // Remove tooltip if disabled
        if (!settings.showTooltips) {
            setTooltip(folderRef.current, '');
            return;
        }

        // Build tooltip with proper singular/plural forms
        const fileText =
            folderStats.fileCount === 1
                ? `${folderStats.fileCount} ${strings.tooltips.file}`
                : `${folderStats.fileCount} ${strings.tooltips.files}`;
        const folderText =
            folderStats.folderCount === 1
                ? `${folderStats.folderCount} ${strings.tooltips.folder}`
                : `${folderStats.folderCount} ${strings.tooltips.folders}`;
        const statsTooltip = `${fileText}, ${folderText}`;

        const tooltip = folder.path === '/' ? statsTooltip : `${effectiveDisplayName}\n\n${statsTooltip}`;

        setTooltip(folderRef.current, tooltip, {
            placement: getTooltipPlacement()
        });
    }, [folder.path, folderStats.fileCount, folderStats.folderCount, settings, isMobile, effectiveDisplayName]);

    useEffect(() => {
        if (chevronRef.current) {
            const iconService = getIconService();
            const iconId = resolveUXIcon(settings.interfaceIcons, isExpanded ? 'nav-tree-collapse' : 'nav-tree-expand');
            iconService.renderIcon(chevronRef.current, iconId);
        }
    }, [iconVersion, isExpanded, settings.interfaceIcons]);

    // Update folder icon
    useEffect(() => {
        if (iconRef.current && shouldShowFolderIcon) {
            const iconService = getIconService();

            if (icon) {
                // Custom icon is set - always show it, never toggle
                iconService.renderIcon(iconRef.current, icon);
            } else if (isRootFolder) {
                // Root folder - use vault icon (open/closed based on expansion state)
                const vaultIconName = hasChildren && isExpanded ? 'open-vault' : 'vault';
                iconService.renderIcon(iconRef.current, vaultIconName);
            } else {
                // Default icon - show open folder only if has children AND is expanded
                const iconName =
                    hasChildren && isExpanded
                        ? resolveUXIcon(settings.interfaceIcons, 'nav-folder-open')
                        : resolveUXIcon(settings.interfaceIcons, 'nav-folder-closed');
                iconService.renderIcon(iconRef.current, iconName);
            }
        }
    }, [hasChildren, icon, iconVersion, isExpanded, isRootFolder, settings.interfaceIcons, shouldShowFolderIcon]);

    // Enable context menu
    const folderMenuConfig = disableContextMenu
        ? null
        : {
              type: ItemType.FOLDER,
              item: folder,
              options: disableNavigationSeparatorActions ? { disableNavigationSeparatorActions: true } : undefined
          };

    useContextMenu(folderRef, folderMenuConfig);

    const isDraggable = !isMobile && !isRootFolder;
    const folderStyle: CSSPropertiesWithVars = {
        '--level': level,
        ...(customBackground ? { '--nn-navitem-custom-bg-color': customBackground } : {})
    };

    return (
        <div
            ref={folderRef}
            className={className}
            data-path={folder.path}
            // Path to use when this folder is dragged
            data-drag-path={folder.path}
            // Type of item being dragged (folder, file, or tag)
            data-drag-type="folder"
            // Marks element as draggable for event delegation
            data-draggable={isDraggable ? 'true' : undefined}
            // Icon to display in drag ghost
            data-drag-icon={dragIconId}
            // Icon color to display in drag ghost
            data-drag-icon-color={customColor || undefined}
            draggable={isDraggable}
            // Drop zone type (folder or tag)
            data-drop-zone="folder"
            // Target path for drop operations on this folder
            data-drop-path={folder.path}
            data-clickable="folder"
            data-level={level}
            onClick={onClick}
            onDoubleClick={handleDoubleClick}
            style={folderStyle}
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-level={level + 1}
        >
            <div className="nn-navitem-content">
                <IndentGuideColumns levels={indentGuideLevels} />
                <div
                    className={`nn-navitem-chevron ${hasChildren ? 'nn-navitem-chevron--has-children' : 'nn-navitem-chevron--no-children'}`}
                    ref={chevronRef}
                    onClick={handleChevronClick}
                    onDoubleClick={handleChevronDoubleClick}
                    tabIndex={-1}
                />
                {shouldShowFolderIcon && (
                    <span className="nn-navitem-icon" ref={iconRef} style={customColor ? { color: customColor } : undefined}></span>
                )}
                <span
                    className={folderNameClassName}
                    style={applyColorToName ? { color: customColor } : undefined}
                    onClick={handleNameClick}
                    onMouseDown={handleNameMouseDown}
                >
                    {effectiveDisplayName}
                </span>
                <span className="nn-navitem-spacer" />
                {shouldDisplayCount && <span className="nn-navitem-count">{noteCountLabel}</span>}
            </div>
        </div>
    );
});
