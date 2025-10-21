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
 *    - Conditional rendering based on settings.showIcons
 *
 * 7. Tooltip optimization:
 *    - Tooltip only created on desktop (mobile skipped)
 *    - Tooltip creation deferred to useEffect
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { TFolder, TFile, setTooltip, setIcon } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useContextMenu } from '../hooks/useContextMenu';
import { strings } from '../i18n';
import { getIconService, useIconServiceVersion } from '../services/icons';
import { ItemType } from '../types';
import { getFolderNote } from '../utils/folderNotes';
import { hasSubfolders, shouldExcludeFolder, shouldExcludeFile } from '../utils/fileFilters';
import { shouldDisplayFile } from '../utils/fileTypeUtils';
import type { NoteCountInfo } from '../types/noteCounts';
import { buildNoteCountDisplay } from '../utils/noteCountFormatting';

interface FolderItemProps {
    folder: TFolder;
    level: number;
    isExpanded: boolean;
    isSelected: boolean;
    isExcluded?: boolean;
    onToggle: () => void;
    onClick: () => void;
    onNameClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
    onToggleAllSiblings?: () => void;
    icon?: string;
    color?: string;
    backgroundColor?: string;
    countInfo?: NoteCountInfo;
    excludedFolders: string[];
    vaultChangeVersion: number;
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
    level,
    isExpanded,
    isSelected,
    isExcluded,
    onToggle,
    onClick,
    onNameClick,
    onToggleAllSiblings,
    icon,
    color,
    backgroundColor,
    countInfo,
    excludedFolders,
    vaultChangeVersion
}: FolderItemProps) {
    const { app, isMobile } = useServices();
    const settings = useSettingsState();
    const folderRef = useRef<HTMLDivElement>(null);

    const chevronRef = React.useRef<HTMLDivElement>(null);
    const iconRef = React.useRef<HTMLSpanElement>(null);
    const iconVersion = useIconServiceVersion();

    // Count folders and files for tooltip (skip on mobile to save computation)
    const folderStats = React.useMemo(() => {
        // Return early if tooltips aren't needed
        if (isMobile || !settings.showTooltips) {
            return { fileCount: 0, folderCount: 0 };
        }

        // Tooltip should show immediate files only (non-recursive)
        let fileCount = 0;
        for (const child of folder.children) {
            if (child instanceof TFile) {
                if (shouldDisplayFile(child, settings.fileVisibility, app)) {
                    if (!shouldExcludeFile(child, settings.excludedFiles, app)) {
                        fileCount++;
                    }
                }
            }
        }

        // Count immediate child folders respecting hidden/excluded rules
        const showHidden = settings.showHiddenItems;
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
        settings.showHiddenItems,
        settings.fileVisibility,
        settings.excludedFiles,
        excludedFolders,
        app
    ]);

    // Merge provided count info with default values to ensure all properties are present
    const noteCounts: NoteCountInfo = countInfo ?? { current: 0, descendants: 0, total: 0 };
    // Determine if we should show separate counts (e.g., "2 + 5") or combined count (e.g., "7")
    const useSeparateCounts = settings.includeDescendantNotes && settings.separateNoteCounts;
    // Build formatted display object with label and visibility flags
    const noteCountDisplay = buildNoteCountDisplay(noteCounts, settings.includeDescendantNotes, useSeparateCounts);
    // Check if count should be displayed based on settings and count values
    const shouldDisplayCount = settings.showNoteCount && noteCountDisplay.shouldDisplay;

    // Check if folder has children - not memoized because Obsidian mutates the children array
    // The hasSubfolders function handles the logic of whether to show all or only visible subfolders
    const showHiddenFolders = settings.showHiddenItems;
    const hasChildren = hasSubfolders(folder, excludedFolders, showHiddenFolders);

    // Use color from props (passed from NavigationPane)
    const customColor = color;
    // Determine whether to apply color to the folder name instead of the icon
    const applyColorToName = Boolean(customColor) && !settings.colorIconOnly;
    const dragIconId = useMemo(() => {
        if (icon) {
            return icon;
        }
        if (folder.path === '/') {
            return hasChildren && isExpanded ? 'open-vault' : 'vault';
        }
        if (hasChildren && isExpanded) {
            return 'lucide-folder-open';
        }
        return 'lucide-folder-closed';
    }, [icon, folder.path, hasChildren, isExpanded]);
    const customBackground = backgroundColor;

    const hasFolderNote = useMemo(() => {
        if (!settings.enableFolderNotes) return false;
        const folderNote = getFolderNote(folder, settings);
        return folderNote !== null;
        // NOTE TO REVIEWER: Including **noteCounts.current** to detect folder content changes
        // NOTE TO REVIEWER: Including **vaultChangeVersion** to react to new folder notes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folder, settings, noteCounts.current, vaultChangeVersion]);

    // Memoize className to avoid string concatenation on every render
    const className = useMemo(() => {
        const classes = ['nn-navitem', 'nn-folder'];
        if (isSelected) classes.push('nn-selected');
        if (isExcluded) classes.push('nn-excluded');
        if (customBackground && !isSelected) classes.push('nn-has-custom-background');
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

        // Always include folder name at the top
        const tooltip = `${folder.name}\n\n${statsTooltip}`;

        // Check if RTL mode is active
        const isRTL = document.body.classList.contains('mod-rtl');

        // Set placement to the right (left in RTL)
        setTooltip(folderRef.current, tooltip, {
            placement: isRTL ? 'left' : 'right'
        });
    }, [folderStats.fileCount, folderStats.folderCount, folder.name, settings, isMobile]);

    useEffect(() => {
        if (chevronRef.current) {
            setIcon(chevronRef.current, isExpanded ? 'lucide-chevron-down' : 'lucide-chevron-right');
        }
    }, [isExpanded]);

    // Add this useEffect for the folder icon
    useEffect(() => {
        if (iconRef.current && settings.showIcons) {
            const iconService = getIconService();

            if (icon) {
                // Custom icon is set - always show it, never toggle
                iconService.renderIcon(iconRef.current, icon);
            } else if (folder.path === '/') {
                // Root folder - use vault icon (open/closed based on expansion state)
                const vaultIconName = hasChildren && isExpanded ? 'open-vault' : 'vault';
                iconService.renderIcon(iconRef.current, vaultIconName);
            } else {
                // Default icon - show open folder only if has children AND is expanded
                const iconName = hasChildren && isExpanded ? 'lucide-folder-open' : 'lucide-folder-closed';
                iconService.renderIcon(iconRef.current, iconName);
            }
        }
    }, [isExpanded, icon, hasChildren, settings.showIcons, folder.path, iconVersion]);

    // Enable context menu
    useContextMenu(folderRef, { type: ItemType.FOLDER, item: folder });

    // Don't allow dragging the root vault folder
    const isRootFolder = folder.path === '/';
    const isDraggable = !isMobile && !isRootFolder;

    return (
        <div
            ref={folderRef}
            className={className}
            data-path={folder.path}
            data-drag-path={folder.path}
            data-drag-type="folder"
            data-draggable={isDraggable ? 'true' : undefined}
            data-drag-icon={dragIconId}
            data-drag-icon-color={customColor || undefined}
            draggable={isDraggable}
            data-drop-zone="folder"
            data-drop-path={folder.path}
            data-clickable="folder"
            data-level={level}
            onClick={onClick}
            onDoubleClick={handleDoubleClick}
            style={
                {
                    '--level': level,
                    ...(customBackground && !isSelected ? { '--nn-navitem-custom-bg-color': customBackground } : {})
                } as React.CSSProperties
            }
            role="treeitem"
            aria-expanded={hasChildren ? isExpanded : undefined}
            aria-level={level + 1}
        >
            <div className="nn-navitem-content">
                <div
                    className={`nn-navitem-chevron ${hasChildren ? 'nn-navitem-chevron--has-children' : 'nn-navitem-chevron--no-children'}`}
                    ref={chevronRef}
                    onClick={handleChevronClick}
                    onDoubleClick={handleChevronDoubleClick}
                    tabIndex={-1}
                />
                {settings.showIcons && (
                    <span className="nn-navitem-icon" ref={iconRef} style={customColor ? { color: customColor } : undefined}></span>
                )}
                <span
                    className={folderNameClassName}
                    style={applyColorToName ? { color: customColor } : undefined}
                    onClick={handleNameClick}
                >
                    {folder.path === '/' ? settings.customVaultName || app.vault.getName() : folder.name}
                </span>
                <span className="nn-navitem-spacer" />
                {shouldDisplayCount && <span className="nn-navitem-count">{noteCountDisplay.label}</span>}
            </div>
        </div>
    );
});
