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
 * 1. React.memo with forwardRef - Component only re-renders when props change
 *
 * 2. Props-based data flow:
 *    - All data comes from NavigationPane via props (no direct cache access)
 *    - color: Custom tag color from MetadataService (via NavigationPane)
 *    - icon: Custom tag icon from MetadataService (via NavigationPane)
 *    - countInfo: Pre-computed note counts from NavigationPane
 *    - tagNode: Tag tree structure from StorageContext (via NavigationPane)
 *
 * 3. Memoized values:
 *    - hasChildren: Cached check using tagNode.children.size
 *    - className: Cached CSS class string construction
 *    - tagNameClassName: Cached tag name styling classes
 *
 * 4. Stable callbacks:
 *    - handleDoubleClick: Memoized expansion handler
 *    - handleChevronClick: Memoized with Alt+click support for bulk operations
 *    - handleChevronDoubleClick: Prevents unwanted event propagation
 *
 * 5. Icon optimization:
 *    - Icons rendered via useEffect to avoid blocking
 *    - Chevron icon updates based on expansion state
 *    - Custom tag icons support with color inheritance
 *
 * 6. Data source hierarchy:
 *    - NavigationPane fetches all data from services/contexts
 *    - TagTreeItem is purely presentational with no service dependencies
 *    - Enables efficient re-rendering only when specific props change
 */

import React, { forwardRef, useMemo, useCallback } from 'react';
import { setIcon } from 'obsidian';
import { useSettingsState } from '../context/SettingsContext';
import { useContextMenu } from '../hooks/useContextMenu';
import { getIconService, useIconServiceVersion } from '../services/icons';
import { ItemType } from '../types';
import { NNNode } from '../types/storage';
import type { NoteCountInfo } from '../types/noteCounts';
import { buildNoteCountDisplay } from '../utils/noteCountFormatting';
import { getTotalNoteCount } from '../utils/tagTree';

/**
 * Props for the TagTreeItem component
 */
interface TagTreeItemProps {
    /** The tag node to render */
    tagNode: NNNode;
    /** Nesting level for indentation */
    level: number;
    /** Whether this tag is expanded to show children */
    isExpanded: boolean;
    /** Whether this tag is currently selected */
    isSelected: boolean;
    /** Callback when the expand/collapse chevron is clicked */
    onToggle: () => void;
    /** Callback when the tag name is clicked */
    onClick: () => void;
    /** Callback when all sibling tags should be toggled */
    onToggleAllSiblings?: () => void;
    /** Pre-computed note counts for this tag (current and descendants) */
    countInfo?: NoteCountInfo;
    /** Whether to show file counts */
    showFileCount: boolean;
    /** Custom color for the tag - fetched by NavigationPane from MetadataService */
    color?: string;
    /** Custom background color for the tag - fetched by NavigationPane from MetadataService */
    backgroundColor?: string;
    /** Custom icon for the tag - fetched by NavigationPane from MetadataService */
    icon?: string;
    /** Whether this tag is normally hidden but being shown */
    isHidden?: boolean;
}

/**
 * Component that renders a single tag in the hierarchical tag tree.
 * Handles indentation, expand/collapse state, and selection state.
 * All data is passed via props from NavigationPane - no direct service access.
 */
export const TagTreeItem = React.memo(
    forwardRef<HTMLDivElement, TagTreeItemProps>(function TagTreeItem(
        {
            tagNode,
            level,
            isExpanded,
            isSelected,
            isHidden,
            onToggle,
            onClick,
            onToggleAllSiblings,
            countInfo,
            showFileCount,
            color,
            backgroundColor,
            icon
        },
        ref
    ) {
        const settings = useSettingsState();
        const chevronRef = React.useRef<HTMLDivElement>(null);
        const iconRef = React.useRef<HTMLSpanElement>(null);
        const iconVersion = useIconServiceVersion();
        const itemRef = React.useRef<HTMLDivElement>(null);

        // Compute note counts - use provided counts or calculate from tag node
        const resolvedCounts = React.useMemo<NoteCountInfo>(() => {
            if (countInfo) {
                return countInfo;
            }
            // Calculate counts directly from tag node if not provided
            const directCount = tagNode.notesWithTag.size;
            if (!settings.includeDescendantNotes) {
                return { current: directCount, descendants: 0, total: directCount };
            }
            const total = getTotalNoteCount(tagNode);
            const descendants = Math.max(total - directCount, 0);
            return { current: directCount, descendants, total };
        }, [countInfo, tagNode, settings.includeDescendantNotes]);

        // Determine if counts should be shown separately (e.g., "2 + 5") or combined
        const useSeparateCounts = settings.includeDescendantNotes && settings.separateNoteCounts;
        // Build formatted display object with label and visibility flags
        const noteCountDisplay = buildNoteCountDisplay(resolvedCounts, settings.includeDescendantNotes, useSeparateCounts);
        // Check if count badge should be displayed based on settings and count values
        const shouldDisplayCount = showFileCount && noteCountDisplay.shouldDisplay;

        // Memoize computed values
        const hasChildren = useMemo(() => tagNode.children.size > 0, [tagNode.children.size]);

        // Use color and icon from props (fetched by NavigationPane from MetadataService)
        const tagColor = color;
        const tagBackground = backgroundColor;
        const tagIcon = icon;
        // Determine whether to apply color to the tag name instead of the icon
        const applyColorToName = Boolean(tagColor) && !settings.colorIconOnly;

        // Memoize className to avoid string concatenation on every render
        const className = useMemo(() => {
            const classes = ['nn-navitem', 'nn-tag'];
            if (isSelected) classes.push('nn-selected');
            if (isHidden) classes.push('nn-excluded');
            if (tagBackground && !isSelected) classes.push('nn-has-custom-background');
            return classes.join(' ');
        }, [isSelected, isHidden, tagBackground]);

        const tagNameClassName = useMemo(() => {
            const classes = ['nn-navitem-name'];
            if (applyColorToName) classes.push('nn-has-custom-color');
            return classes.join(' ');
        }, [applyColorToName]);

        // Stable event handlers
        const handleDoubleClick = useCallback(
            (e: React.MouseEvent) => {
                e.preventDefault();
                if (hasChildren) {
                    onToggle();
                }
            },
            [hasChildren, onToggle]
        );

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

        // Update chevron icon based on expanded state
        React.useEffect(() => {
            if (chevronRef.current && hasChildren) {
                setIcon(chevronRef.current, isExpanded ? 'lucide-chevron-down' : 'lucide-chevron-right');
            }
        }, [isExpanded, hasChildren]);

        // Update tag icon
        React.useEffect(() => {
            if (iconRef.current && settings.showIcons) {
                getIconService().renderIcon(iconRef.current, tagIcon || 'lucide-tags');
            }
        }, [tagIcon, settings.showIcons, iconVersion]);

        // Set up forwarded ref
        React.useImperativeHandle(ref, () => itemRef.current as HTMLDivElement);

        // Add context menu
        useContextMenu(itemRef, {
            type: ItemType.TAG,
            item: ('path' in tagNode ? tagNode.path : tagNode.name) as string
        });

        return (
            <div
                ref={itemRef}
                className={className}
                data-tag={('path' in tagNode ? tagNode.path : tagNode.name) as string}
                data-drop-zone="tag"
                data-drop-path={('path' in tagNode ? tagNode.path : tagNode.name) as string}
                data-level={level}
                style={
                    {
                        '--level': level,
                        ...(tagBackground && !isSelected ? { '--nn-navitem-custom-bg-color': tagBackground } : {})
                    } as React.CSSProperties
                }
                role="treeitem"
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-level={level + 1}
            >
                <div className="nn-navitem-content" onClick={onClick} onDoubleClick={handleDoubleClick}>
                    <div
                        ref={chevronRef}
                        className={`nn-navitem-chevron ${hasChildren ? 'nn-navitem-chevron--has-children' : 'nn-navitem-chevron--no-children'}`}
                        onClick={handleChevronClick}
                        onDoubleClick={handleChevronDoubleClick}
                        tabIndex={-1}
                    />
                    {settings.showIcons && (
                        <span className="nn-navitem-icon" ref={iconRef} style={tagColor ? { color: tagColor } : undefined} />
                    )}
                    <span className={tagNameClassName} style={applyColorToName ? { color: tagColor } : undefined}>
                        {tagNode.name}
                    </span>
                    <span className="nn-navitem-spacer" />
                    {shouldDisplayCount && <span className="nn-navitem-count">{noteCountDisplay.label}</span>}
                </div>
            </div>
        );
    })
);
