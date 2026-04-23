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

import React, { useCallback, useEffect, useRef } from 'react';
import { setIcon } from 'obsidian';
import { getIconService, useIconServiceVersion } from '../../services/icons';
import {
    NavigationPaneItemType,
    NavigationSectionId,
    ItemType,
    PROPERTIES_ROOT_VIRTUAL_FOLDER_ID,
    RECENT_NOTES_VIRTUAL_FOLDER_ID,
    SHORTCUTS_VIRTUAL_FOLDER_ID,
    TAGGED_TAG_ID,
    TAGS_ROOT_VIRTUAL_FOLDER_ID,
    TOPICS_ROOT_VIRTUAL_FOLDER_ID,
    UNTAGGED_TAG_ID
} from '../../types';
import { FolderItem } from '../FolderItem';
import { PropertyTreeItem } from '../PropertyTreeItem';
import { TagTreeItem } from '../TagTreeItem';
import { VirtualFolderComponent, type VirtualFolderTrailingAction } from '../VirtualFolderItem';
import type { NavigationPaneRowProps } from './NavigationPaneItemRenderer.types';
import type { TopicTreeItem as TopicTreeItemType } from '../../types/virtualization';
import type { NavigationPaneRowContext } from './NavigationPaneItemRenderer.types';
import { useTopicNavigation } from '../../hooks/useTopicNavigation';

interface TopicRowProps {
    item: TopicTreeItemType;
    context: NavigationPaneRowContext;
}

function TopicRow({ item, context }: TopicRowProps) {
    const { settings, expansionState, expansionDispatch, selectionState } = context;
    const { navigateToTopic } = useTopicNavigation();
    const chevronRef = useRef<HTMLDivElement>(null);
    const iconRef = useRef<HTMLSpanElement>(null);
    const iconVersion = useIconServiceVersion();

    const topicNode = item.data;
    const topicPath = item.key;
    const isExpanded = expansionState.expandedTopics?.has(topicPath) ?? false;
    const isSelected = selectionState.selectionType === ItemType.TOPIC && selectionState.selectedTopicPath === topicPath;
    const hasChildren = topicNode.children.size > 0;
    const level = item.level ?? 0;
    const icon = item.icon;
    const color = item.color;
    const backgroundColor = item.backgroundColor;
    const applyColorToName = Boolean(color) && !settings.colorIconOnly;

    useEffect(() => {
        const el = chevronRef.current;
        if (!el) return;
        el.empty();
        if (hasChildren) {
            setIcon(el, isExpanded ? 'chevron-down' : 'chevron-right');
        }
    }, [isExpanded, hasChildren]);

    useEffect(() => {
        if (iconRef.current && settings.showTagIcons) {
            getIconService().renderIcon(iconRef.current, icon || 'tag');
        }
    }, [icon, settings.showTagIcons, iconVersion, settings.interfaceIcons]);

    const handleChevronClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (hasChildren) {
                expansionDispatch({ type: 'TOGGLE_TOPIC_EXPANDED', topicName: topicPath });
            }
        },
        [hasChildren, expansionDispatch, topicPath]
    );

    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            navigateToTopic(topicPath);
        },
        [navigateToTopic, topicPath]
    );

    const classes = ['nn-navitem', 'nn-tag'];
    if (isSelected) classes.push('nn-selected');
    if (item.isHidden) classes.push('nn-excluded');
    if (applyColorToName) classes.push('nn-has-custom-color');

    const itemStyle: React.CSSProperties & { '--level'?: number; '--nn-navitem-custom-bg-color'?: string } = {
        '--level': level,
        ...(backgroundColor ? { '--nn-navitem-custom-bg-color': backgroundColor } : {})
    };

    return (
        <div className={classes.join(' ')} style={itemStyle} data-path={topicPath} data-level={level}>
            <div className="nn-navitem-content" onClick={handleClick}>
                <div
                    ref={chevronRef}
                    className={`nn-navitem-chevron ${hasChildren ? 'nn-navitem-chevron--has-children' : 'nn-navitem-chevron--no-children'}`}
                    onClick={handleChevronClick}
                />
                {settings.showTagIcons && (
                    <span className="nn-navitem-icon" ref={iconRef} style={color ? { color } : undefined} />
                )}
                <span className="nn-navitem-name" style={applyColorToName ? { color } : undefined}>{topicNode.name}</span>
                <span className="nn-navitem-spacer" />
                {settings.showNoteCount && item.noteCount && (
                    <span className="nn-navitem-count">{item.noteCount.total}</span>
                )}
            </div>
        </div>
    );
}

export function NavigationPaneTreeRow({ item, context }: NavigationPaneRowProps) {
    const {
        settings,
        isMobile,
        expansionState,
        expansionDispatch,
        selectionState,
        indentGuideLevelsByKey,
        firstSectionId,
        firstInlineFolderPath,
        shouldPinShortcuts,
        shortcutsExpanded,
        recentNotesExpanded,
        folderCounts,
        tagCounts,
        propertyCounts,
        vaultChangeVersion,
        getSolidBackground,
        shortcuts,
        tree,
        searchHighlights,
        onSectionContextMenu
    } = context;

    switch (item.type) {
        case NavigationPaneItemType.FOLDER: {
            const folderPath = item.data.path;
            const countInfo = folderCounts.get(folderPath);
            const indentGuideLevels = indentGuideLevelsByKey.get(item.key);
            const shouldHideFolderSeparatorActions =
                shouldPinShortcuts && firstInlineFolderPath !== null && folderPath === firstInlineFolderPath;

            return (
                <FolderItem
                    folder={item.data}
                    displayName={item.displayName}
                    level={item.level}
                    indentGuideLevels={indentGuideLevels}
                    isExpanded={expansionState.expandedFolders.has(item.data.path)}
                    isSelected={selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder?.path === folderPath}
                    isExcluded={item.isExcluded}
                    onToggle={() => tree.handleFolderToggle(item.data.path)}
                    onClick={() => tree.handleFolderClick(item.data)}
                    onNameClick={event => tree.handleFolderNameClick(item.data, event)}
                    onNameMouseDown={event => tree.handleFolderNameMouseDown(item.data, event)}
                    onToggleAllSiblings={() => {
                        const isCurrentlyExpanded = expansionState.expandedFolders.has(item.data.path);
                        tree.handleFolderToggle(item.data.path);
                        const descendantPaths = tree.getAllDescendantFolders(item.data);
                        if (descendantPaths.length > 0) {
                            expansionDispatch({
                                type: 'TOGGLE_DESCENDANT_FOLDERS',
                                descendantPaths,
                                expand: !isCurrentlyExpanded
                            });
                        }
                    }}
                    icon={item.icon}
                    color={item.color}
                    backgroundColor={getSolidBackground(item.backgroundColor)}
                    countInfo={countInfo}
                    excludedFolders={item.parsedExcludedFolders || []}
                    vaultChangeVersion={vaultChangeVersion}
                    disableNavigationSeparatorActions={shouldHideFolderSeparatorActions}
                />
            );
        }

        case NavigationPaneItemType.VIRTUAL_FOLDER: {
            const virtualFolder = item.data;
            const indentGuideLevels = indentGuideLevelsByKey.get(item.key);
            const isShortcutsGroup = virtualFolder.id === SHORTCUTS_VIRTUAL_FOLDER_ID;
            const isRecentNotesGroup = virtualFolder.id === RECENT_NOTES_VIRTUAL_FOLDER_ID;
            const hasChildren = item.hasChildren ?? false;
            const isExpanded = isShortcutsGroup
                ? shortcutsExpanded
                : isRecentNotesGroup
                  ? recentNotesExpanded
                  : expansionState.expandedVirtualFolders.has(virtualFolder.id);
            const tagCollectionId = item.tagCollectionId ?? null;
            const propertyCollectionId = item.propertyCollectionId ?? null;
            const isTagCollection = Boolean(tagCollectionId);
            const isPropertyCollection = Boolean(propertyCollectionId);
            const isPropertyCollectionSelected =
                isPropertyCollection &&
                selectionState.selectionType === ItemType.PROPERTY &&
                selectionState.selectedProperty === propertyCollectionId;
            const isSelected =
                (isTagCollection && selectionState.selectionType === ItemType.TAG && selectionState.selectedTag === tagCollectionId) ||
                isPropertyCollectionSelected;
            const collectionCountInfo = item.noteCount ?? (tagCollectionId ? tagCounts.get(tagCollectionId) : undefined);
            const showFileCount = item.showFileCount ?? false;
            const collectionSearchMatch = searchHighlights.getTagCollectionSearchMatch(tagCollectionId);
            const dropConfig =
                virtualFolder.id === TAGS_ROOT_VIRTUAL_FOLDER_ID
                    ? {
                          zone: 'tag-root',
                          path: '__nn-tag-root__',
                          allowExternalDrop: false
                      }
                    : undefined;
            const sectionId = isShortcutsGroup
                ? NavigationSectionId.SHORTCUTS
                : isRecentNotesGroup
                  ? NavigationSectionId.RECENT
                  : virtualFolder.id === TAGS_ROOT_VIRTUAL_FOLDER_ID
                    ? NavigationSectionId.TAGS
                    : virtualFolder.id === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID
                      ? NavigationSectionId.PROPERTIES
                      : virtualFolder.id === TOPICS_ROOT_VIRTUAL_FOLDER_ID
                        ? NavigationSectionId.TOPICS
                        : null;
            const shouldDisableFirstSectionMenu =
                shouldPinShortcuts && sectionId !== null && firstSectionId !== null && sectionId === firstSectionId;
            const baseAllowSeparatorActions = !isShortcutsGroup || !shouldPinShortcuts;
            const allowSeparatorActions = baseAllowSeparatorActions && !shouldDisableFirstSectionMenu;
            const sectionContextMenu =
                sectionId !== null
                    ? (event: React.MouseEvent<HTMLDivElement>) =>
                          onSectionContextMenu(event, sectionId, { allowSeparator: allowSeparatorActions })
                    : undefined;
            const isPropertiesGroup = virtualFolder.id === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;
            const isTagsGroup = virtualFolder.id === TAGS_ROOT_VIRTUAL_FOLDER_ID;
            const trailingAction: VirtualFolderTrailingAction | undefined = isShortcutsGroup
                ? shortcuts.shortcutHeaderTrailingAction
                : isPropertiesGroup
                  ? shortcuts.propertiesHeaderTrailingAction
                  : undefined;

            return (
                <VirtualFolderComponent
                    virtualFolder={virtualFolder}
                    level={item.level}
                    color={item.color}
                    backgroundColor={getSolidBackground(item.backgroundColor)}
                    indentGuideLevels={indentGuideLevels}
                    isExpanded={isExpanded}
                    hasChildren={hasChildren}
                    isSelected={Boolean(isSelected)}
                    showFileCount={showFileCount}
                    countInfo={collectionCountInfo}
                    searchMatch={collectionSearchMatch}
                    trailingAction={trailingAction}
                    onSelect={
                        isTagCollection && tagCollectionId
                            ? event => tree.handleTagCollectionClick(tagCollectionId, event)
                            : isPropertyCollection
                              ? tree.handlePropertyCollectionClick
                              : undefined
                    }
                    onToggle={() => tree.handleVirtualFolderToggle(virtualFolder.id)}
                    onToggleAllSiblings={
                        isTagsGroup
                            ? () => {
                                  const isCurrentlyExpanded = expansionState.expandedVirtualFolders.has(virtualFolder.id);
                                  tree.handleVirtualFolderToggle(virtualFolder.id);
                                  const descendantPaths = tree.getAllTagPaths();
                                  if (descendantPaths.length > 0) {
                                      expansionDispatch({
                                          type: 'TOGGLE_DESCENDANT_TAGS',
                                          descendantPaths,
                                          expand: !isCurrentlyExpanded
                                      });
                                  }
                              }
                            : isPropertiesGroup
                              ? () => {
                                    const isCurrentlyExpanded = expansionState.expandedVirtualFolders.has(virtualFolder.id);
                                    tree.handleVirtualFolderToggle(virtualFolder.id);
                                    const descendantNodeIds = tree.getAllPropertyNodeIds();
                                    if (descendantNodeIds.length > 0) {
                                        expansionDispatch({
                                            type: 'TOGGLE_DESCENDANT_PROPERTIES',
                                            descendantNodeIds,
                                            expand: !isCurrentlyExpanded
                                        });
                                    }
                                }
                              : undefined
                    }
                    onDragOver={isShortcutsGroup && shortcuts.allowEmptyShortcutDrop ? shortcuts.handleShortcutRootDragOver : undefined}
                    onDrop={isShortcutsGroup && shortcuts.allowEmptyShortcutDrop ? shortcuts.handleShortcutRootDrop : undefined}
                    dropConfig={dropConfig}
                    onContextMenu={sectionContextMenu}
                />
            );
        }

        case NavigationPaneItemType.TAG:
        case NavigationPaneItemType.UNTAGGED: {
            const tagNode = item.data;
            const indentGuideLevels = indentGuideLevelsByKey.get(item.key);
            const searchMatch = searchHighlights.getTagSearchMatch(tagNode.path);

            return (
                <TagTreeItem
                    tagNode={tagNode}
                    level={item.level ?? 0}
                    indentGuideLevels={indentGuideLevels}
                    isExpanded={expansionState.expandedTags.has(tagNode.path)}
                    isSelected={selectionState.selectionType === ItemType.TAG && selectionState.selectedTag === tagNode.path}
                    isHidden={'isHidden' in item ? item.isHidden : false}
                    onToggle={() => tree.handleTagToggle(tagNode.path)}
                    onClick={event => tree.handleTagClick(tagNode.path, event)}
                    color={item.color}
                    backgroundColor={getSolidBackground(item.backgroundColor)}
                    icon={item.icon}
                    searchMatch={searchMatch}
                    isDraggable={!isMobile && tagNode.path !== UNTAGGED_TAG_ID && tagNode.path !== TAGGED_TAG_ID}
                    onToggleAllSiblings={() => {
                        const isCurrentlyExpanded = expansionState.expandedTags.has(tagNode.path);
                        tree.handleTagToggle(tagNode.path);
                        const descendantPaths = tree.getAllDescendantTags(tagNode.path);
                        if (descendantPaths.length > 0) {
                            expansionDispatch({
                                type: 'TOGGLE_DESCENDANT_TAGS',
                                descendantPaths,
                                expand: !isCurrentlyExpanded
                            });
                        }
                    }}
                    countInfo={item.noteCount ?? tagCounts.get(tagNode.path)}
                    showFileCount={settings.showNoteCount}
                />
            );
        }

        case NavigationPaneItemType.PROPERTY_KEY:
        case NavigationPaneItemType.PROPERTY_VALUE: {
            const propertyNode = item.data;
            const indentGuideLevels = indentGuideLevelsByKey.get(item.key);
            const selectedPropertyNodeId = selectionState.selectionType === ItemType.PROPERTY ? selectionState.selectedProperty : null;
            const searchMatch = searchHighlights.getPropertySearchMatch(propertyNode.id);

            return (
                <PropertyTreeItem
                    propertyNode={propertyNode}
                    level={item.level ?? 0}
                    indentGuideLevels={indentGuideLevels}
                    isExpanded={expansionState.expandedProperties.has(propertyNode.id)}
                    isSelected={selectedPropertyNodeId === propertyNode.id}
                    onToggle={() => tree.handlePropertyToggle(propertyNode.id)}
                    onClick={event => tree.handlePropertyClick(propertyNode, event)}
                    onToggleAllSiblings={() => {
                        const isCurrentlyExpanded = expansionState.expandedProperties.has(propertyNode.id);
                        tree.handlePropertyToggle(propertyNode.id);
                        const descendantNodeIds = tree.getAllDescendantPropertyNodeIds(propertyNode);
                        if (descendantNodeIds.length > 0) {
                            expansionDispatch({
                                type: 'TOGGLE_DESCENDANT_PROPERTIES',
                                descendantNodeIds,
                                expand: !isCurrentlyExpanded
                            });
                        }
                    }}
                    color={item.color}
                    backgroundColor={getSolidBackground(item.backgroundColor)}
                    icon={item.icon}
                    searchMatch={searchMatch}
                    isDraggable={!isMobile}
                    countInfo={propertyCounts.get(propertyNode.id)}
                    showFileCount={settings.showNoteCount}
                />
            );
        }

        case NavigationPaneItemType.TOPIC:
            return <TopicRow item={item} context={context} />;

        case NavigationPaneItemType.TOP_SPACER: {
            const spacerClass = item.hasSeparator ? 'nn-nav-top-spacer nn-nav-spacer--with-separator' : 'nn-nav-top-spacer';
            return <div className={spacerClass} />;
        }

        case NavigationPaneItemType.BOTTOM_SPACER:
            return <div className="nn-nav-bottom-spacer" />;

        case NavigationPaneItemType.LIST_SPACER: {
            const spacerClass = item.hasSeparator ? 'nn-nav-list-spacer nn-nav-spacer--with-separator' : 'nn-nav-list-spacer';
            return <div className={spacerClass} />;
        }

        case NavigationPaneItemType.ROOT_SPACER:
            return <div className="nn-nav-root-spacer" style={{ height: `${item.spacing}px` }} aria-hidden="true" />;

        default:
            return null;
    }
}
