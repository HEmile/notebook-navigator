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

import React, { useMemo } from 'react';
import { useSettingsState } from '../context/SettingsContext';
import type { ListReorderHandlers } from '../hooks/useListReorder';
import { NavigationListRow, type DragHandleConfig } from './NavigationListRow';
import type { NoteCountInfo } from '../types/noteCounts';
import { buildNoteCountDisplay } from '../utils/noteCountFormatting';

/**
 * Props for a shortcut item component that can represent folders, notes, searches, or tags
 */
interface ShortcutItemProps {
    icon: string;
    color?: string;
    label: string;
    description?: string;
    level: number;
    isDisabled?: boolean;
    isMissing?: boolean;
    type: 'folder' | 'note' | 'search' | 'tag' | 'topic';
    countInfo?: NoteCountInfo;
    isExcluded?: boolean;
    onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
    onMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
    onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
    dragHandlers?: ListReorderHandlers;
    showDropIndicatorBefore?: boolean;
    showDropIndicatorAfter?: boolean;
    isDragSource?: boolean;
    dragHandleConfig?: DragHandleConfig;
    hasFolderNote?: boolean;
    onLabelClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
}

/**
 * Renders a shortcut item in the navigation pane that supports clicking, drag-and-drop, and context menus.
 * Handles disabled states and conditionally shows item counts based on type and settings.
 */
export const ShortcutItem = React.memo(function ShortcutItem({
    icon,
    color,
    label,
    description,
    level,
    isDisabled,
    isMissing,
    type,
    countInfo,
    isExcluded,
    onClick,
    onMouseDown,
    onContextMenu,
    dragHandlers,
    showDropIndicatorBefore,
    showDropIndicatorAfter,
    isDragSource,
    dragHandleConfig,
    hasFolderNote,
    onLabelClick
}: ShortcutItemProps) {
    const settings = useSettingsState();
    // Build formatted display object with label based on note count settings
    const countDisplay = buildNoteCountDisplay(
        countInfo,
        settings.includeDescendantNotes,
        settings.includeDescendantNotes && settings.separateNoteCounts
    );
    // Check if this item type supports displaying note counts
    const supportsCount = type === 'folder' || type === 'tag' || type === 'topic';
    // Determines whether to display count based on settings and item type
    // Only shows counts for folder, tag, and topic types when showNoteCount is enabled
    const shouldShowCount = settings.showNoteCount && supportsCount && countDisplay.shouldDisplay;
    // Row is disabled when item exists but is disabled (missing items are handled separately)
    const shouldDisableRow = Boolean(isDisabled) && !isMissing;
    // Builds CSS class names for the shortcut item with conditional missing state
    const classNames = useMemo(() => {
        const classes = ['nn-shortcut-item'];
        if (isMissing) {
            classes.push('nn-shortcut-item--missing');
        }
        return classes.join(' ');
    }, [isMissing]);

    // Conditionally enables label click handler based on row state
    const labelClickHandler = useMemo(() => {
        if (shouldDisableRow || isMissing) {
            return undefined;
        }
        return onLabelClick;
    }, [isMissing, onLabelClick, shouldDisableRow]);

    return (
        <NavigationListRow
            icon={icon}
            color={color}
            label={label}
            description={description}
            level={level}
            itemType={type}
            isDisabled={shouldDisableRow}
            isExcluded={isExcluded}
            onClick={event => {
                // Prevent click action when item is disabled or missing
                if (shouldDisableRow || isMissing) {
                    event.preventDefault();
                    return;
                }
                onClick(event);
            }}
            onMouseDown={event => {
                // Prevent mouse down action when item is disabled or missing
                if (shouldDisableRow || isMissing) {
                    return;
                }
                onMouseDown?.(event);
            }}
            onContextMenu={onContextMenu}
            dragHandlers={dragHandlers}
            showDropIndicatorBefore={showDropIndicatorBefore}
            showDropIndicatorAfter={showDropIndicatorAfter}
            isDragSource={isDragSource}
            showCount={shouldShowCount}
            count={countDisplay.label}
            className={classNames}
            tabIndex={-1}
            ariaDisabled={shouldDisableRow || isMissing}
            ariaGrabbed={isDragSource}
            dragHandleConfig={dragHandleConfig}
            labelClassName={hasFolderNote ? 'nn-has-folder-note' : undefined}
            onLabelClick={labelClickHandler}
        />
    );
});
