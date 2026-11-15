/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2026 Emile van Krieken
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

import { TOPIC_DRAG_MIME } from '../utils/topicDragDrop';
import { hasPotentialObsidianFileDragType } from '../utils/dragData';
import React, { forwardRef, useCallback, useMemo } from 'react';
import { useSettingsState } from '../context/SettingsContext';
import { useUXPreferences } from '../context/UXPreferencesContext';
import { useContextMenu } from '../hooks/useContextMenu';
import { getIconService, useIconServiceVersion } from '../services/icons';
import { ItemType, type CSSPropertiesWithVars } from '../types';
import type { TopicNode } from '../types/storage';
import type { NoteCountInfo } from '../types/noteCounts';
import { buildNoteCountDisplay } from '../utils/noteCountFormatting';
import { buildSearchMatchContentClass } from '../utils/searchHighlight';
import { resolveUXIcon } from '../utils/uxIcons';
import { IndentGuideColumns } from './IndentGuideColumns';

interface TopicTreeItemProps {
    topicNode: TopicNode;
    /** Path the topic was reached through, which is also its row key and selection path */
    topicPath: string;
    level: number;
    /** Levels of expanded ancestors whose connector lines should be rendered on this row */
    indentGuideLevels?: number[];
    isExpanded: boolean;
    isSelected: boolean;
    /** Whether this topic is hidden but shown through Show hidden items */
    isHidden?: boolean;
    onToggle: () => void;
    onClick: (event: React.MouseEvent) => void;
    /** Called on Alt+click of the chevron, when provided */
    onToggleAllSiblings?: () => void;
    countInfo?: NoteCountInfo;
    showFileCount: boolean;
    color?: string;
    /** Solid background color, already resolved by the caller */
    backgroundColor?: string;
    /** Classes applied when adjacent filled rows alter shared corners */
    adjacentFilledClassName?: string;
    icon?: string;
    searchMatch?: 'include' | 'exclude';
    /** Lets the row be dragged to Shortcuts (topic shortcut) or into a note (a [[link]]) */
    isDraggable?: boolean;
    /** Called with the drop data when notes are dropped on the row */
    onDropNotes?: (dataTransfer: DataTransfer) => void;
}

/**
 * Renders one topic row in the Topics section. Mirrors TagTreeItem: the same classes for selection, hidden state,
 * custom colors and backgrounds, the same count formatting and chevron icons, and tree item accessibility
 * attributes. All data comes through props.
 */
export const TopicTreeItem = React.memo(
    forwardRef<HTMLDivElement, TopicTreeItemProps>(function TopicTreeItem(
        {
            topicNode,
            topicPath,
            level,
            indentGuideLevels,
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
            adjacentFilledClassName,
            icon,
            searchMatch,
            isDraggable = false,
            onDropNotes
        },
        ref
    ) {
        const settings = useSettingsState();
        const { includeDescendantNotes } = useUXPreferences();
        const chevronRef = React.useRef<HTMLDivElement | null>(null);
        const iconRef = React.useRef<HTMLSpanElement | null>(null);
        const itemRef = React.useRef<HTMLDivElement | null>(null);
        const iconVersion = useIconServiceVersion();
        const [isDropTarget, setIsDropTarget] = React.useState(false);

        const hasChildren = topicNode.children.size > 0;
        const applyColorToName = Boolean(color) && !settings.colorIconOnly;

        const resolvedCounts = useMemo<NoteCountInfo>(() => {
            if (countInfo) {
                return countInfo;
            }
            const directCount = topicNode.notesWithTag.size;
            return { current: directCount, descendants: 0, total: directCount };
        }, [countInfo, topicNode]);
        const useSeparateCounts = includeDescendantNotes && settings.separateNoteCounts;
        const noteCountDisplay = buildNoteCountDisplay(resolvedCounts, includeDescendantNotes, useSeparateCounts, '•');
        const shouldDisplayCount = showFileCount && noteCountDisplay.shouldDisplay;

        const className = useMemo(() => {
            const classes = ['nn-navitem', 'nn-tag', 'nn-topic'];
            if (isSelected) classes.push('nn-selected');
            if (isHidden) classes.push('nn-excluded');
            if (backgroundColor) classes.push('nn-has-custom-background');
            if (searchMatch) classes.push('nn-has-search-match');
            if (adjacentFilledClassName) classes.push(adjacentFilledClassName);
            if (isDropTarget) classes.push('nn-drag-over');
            return classes.join(' ');
        }, [adjacentFilledClassName, backgroundColor, isDropTarget, isHidden, isSelected, searchMatch]);

        const nameClassName = applyColorToName ? 'nn-navitem-name nn-has-custom-color' : 'nn-navitem-name';
        const contentClassName = useMemo(() => buildSearchMatchContentClass(['nn-navitem-content'], searchMatch), [searchMatch]);

        const handleDoubleClick = useCallback(
            (event: React.MouseEvent) => {
                event.preventDefault();
                if (hasChildren) {
                    onToggle();
                }
            },
            [hasChildren, onToggle]
        );

        const handleChevronClick = useCallback(
            (event: React.MouseEvent) => {
                event.stopPropagation();
                if (!hasChildren) {
                    return;
                }
                if (event.altKey && onToggleAllSiblings) {
                    onToggleAllSiblings();
                } else {
                    onToggle();
                }
            },
            [hasChildren, onToggle, onToggleAllSiblings]
        );

        const handleChevronDoubleClick = useCallback((event: React.MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();
        }, []);

        React.useEffect(() => {
            const chevron = chevronRef.current;
            if (!chevron) {
                return;
            }
            chevron.empty();
            if (hasChildren) {
                getIconService().renderIcon(
                    chevron,
                    resolveUXIcon(settings.interfaceIcons, isExpanded ? 'nav-tree-collapse' : 'nav-tree-expand')
                );
            }
        }, [hasChildren, iconVersion, isExpanded, settings.interfaceIcons]);

        React.useEffect(() => {
            if (iconRef.current && settings.showTopicIcons) {
                getIconService().renderIcon(iconRef.current, icon || resolveUXIcon(settings.interfaceIcons, 'nav-tag'));
            }
        }, [icon, iconVersion, settings.interfaceIcons, settings.showTopicIcons]);

        const handleDragStart = useCallback(
            (event: React.DragEvent<HTMLDivElement>) => {
                if (!event.dataTransfer) {
                    return;
                }
                event.stopPropagation();
                event.dataTransfer.setData(TOPIC_DRAG_MIME, topicNode.name);
                event.dataTransfer.setData('text/plain', `[[${topicNode.name}]]`);
                event.dataTransfer.effectAllowed = 'copy';
            },
            [topicNode.name]
        );

        // Notes dragged from the list or Obsidian's file explorer can be dropped here; topic rows cannot
        const acceptsDrop = useCallback(
            (dataTransfer: DataTransfer | null) =>
                Boolean(onDropNotes && dataTransfer) &&
                !Array.from(dataTransfer?.types ?? []).includes(TOPIC_DRAG_MIME) &&
                hasPotentialObsidianFileDragType(dataTransfer?.types),
            [onDropNotes]
        );

        const handleDragOver = useCallback(
            (event: React.DragEvent<HTMLDivElement>) => {
                if (!acceptsDrop(event.dataTransfer)) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = 'copy';
                setIsDropTarget(true);
            },
            [acceptsDrop]
        );

        const handleDragLeave = useCallback(() => setIsDropTarget(false), []);

        const handleDrop = useCallback(
            (event: React.DragEvent<HTMLDivElement>) => {
                setIsDropTarget(false);
                if (!onDropNotes || !acceptsDrop(event.dataTransfer)) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                onDropNotes(event.dataTransfer);
            },
            [acceptsDrop, onDropNotes]
        );

        React.useImperativeHandle(ref, () => itemRef.current as HTMLDivElement);

        useContextMenu(itemRef, { type: ItemType.TOPIC, item: topicNode.name });

        const style: CSSPropertiesWithVars = {
            '--level': level,
            ...(backgroundColor ? { '--nn-navitem-custom-bg-color': backgroundColor } : {})
        };

        return (
            <div
                ref={itemRef}
                className={className}
                data-path={topicPath}
                data-topic={topicNode.name}
                data-search-match={searchMatch ?? undefined}
                data-level={level}
                style={style}
                role="treeitem"
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-level={level + 1}
                aria-selected={isSelected}
                draggable={isDraggable}
                onDragStart={isDraggable ? handleDragStart : undefined}
                onDragOver={onDropNotes ? handleDragOver : undefined}
                onDragLeave={onDropNotes ? handleDragLeave : undefined}
                onDrop={onDropNotes ? handleDrop : undefined}
            >
                <div className={contentClassName} onClick={onClick} onDoubleClick={handleDoubleClick}>
                    <IndentGuideColumns levels={indentGuideLevels} />
                    <div
                        ref={chevronRef}
                        className={`nn-navitem-chevron ${hasChildren ? 'nn-navitem-chevron--has-children' : 'nn-navitem-chevron--no-children'}`}
                        onClick={handleChevronClick}
                        onDoubleClick={handleChevronDoubleClick}
                        tabIndex={-1}
                    />
                    {settings.showTopicIcons && <span className="nn-navitem-icon" ref={iconRef} style={color ? { color } : undefined} />}
                    <span className={nameClassName} style={applyColorToName ? { color } : undefined}>
                        {topicNode.name}
                    </span>
                    <span className="nn-navitem-spacer nn-navitem-spacer--leader" />
                    {shouldDisplayCount ? <span className="nn-navitem-count">{noteCountDisplay.label}</span> : null}
                </div>
            </div>
        );
    })
);
