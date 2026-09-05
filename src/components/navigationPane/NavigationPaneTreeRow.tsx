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
    ItemType,
    NavigationPaneItemType,
    NavigationSectionId,
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
import { useExpansionDispatch } from '../../context/ExpansionContext';
import { useContextMenu } from '../../hooks/useContextMenu';
import { getNavigationItemSearchMatch } from './navigationPaneItemState';
import { getNavigationItemRenderKey } from '../../utils/navigationIndex';
import { strings } from '../../i18n';

interface TopicRowProps {
    item: TopicTreeItemType;
    context: NavigationPaneRowContext;
    isSelected: boolean;
    isExpanded: boolean;
}

function TopicRow({ item, context, isSelected, isExpanded }: TopicRowProps) {
    const { settings, tree } = context;
    const expansionDispatch = useExpansionDispatch();
    const itemRef = useRef<HTMLDivElement>(null);
    const chevronRef = useRef<HTMLDivElement>(null);
    const iconRef = useRef<HTMLSpanElement>(null);
    const iconVersion = useIconServiceVersion();

    const topicNode = item.data;
    const topicPath = item.key;
    const hasChildren = topicNode.children.size > 0;
    const level = item.level ?? 0;
    const icon = item.icon;
    const color = item.color;
    const backgroundColor = item.backgroundColor;
    const applyColorToName = Boolean(color) && !settings.colorIconOnly;

    useContextMenu(itemRef, { type: ItemType.TOPIC, item: topicNode.name });

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
            tree.handleTopicClick(topicPath);
        },
        [tree, topicPath]
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
        <div ref={itemRef} className={classes.join(' ')} style={itemStyle} data-path={topicPath} data-level={level}>
            <div className="nn-navitem-content" onClick={handleClick}>
                <div
                    ref={chevronRef}
                    className={`nn-navitem-chevron ${hasChildren ? 'nn-navitem-chevron--has-children' : 'nn-navitem-chevron--no-children'}`}
                    onClick={handleChevronClick}
                />
                {settings.showTagIcons && <span className="nn-navitem-icon" ref={iconRef} style={color ? { color } : undefined} />}
                <span className="nn-navitem-name" style={applyColorToName ? { color } : undefined}>
                    {topicNode.name}
                </span>
                <span className="nn-navitem-spacer" />
                {settings.showNoteCount && item.noteCount && <span className="nn-navitem-count">{item.noteCount.total}</span>}
            </div>
        </div>
    );
}

export function NavigationPaneTreeRow({
    item,
    context,
    adjacentFilledClassName,
    isSelected,
    isExpanded,
    renameTarget
}: NavigationPaneRowProps) {
    const {
        settings,
        isMobile,
        indentGuideLevelsByKey,
        firstSectionId,
        firstInlineFolderPath,
        shouldPinShortcuts,
        folderCounts,
        tagCounts,
        propertyCounts,
        vaultChangeVersion,
        descendantExcludedFolders,
        getSolidBackground,
        shortcuts,
        shortcutUiState,
        tree,
        searchHighlights,
        inlineRename,
        onSectionContextMenu
    } = context;

    switch (item.type) {
        case NavigationPaneItemType.FOLDER: {
            const folderPath = item.data.path;
            const countInfo = folderCounts.get(folderPath);
            const indentGuideLevels = indentGuideLevelsByKey.get(getNavigationItemRenderKey(item));
            const shouldHideFolderSeparatorActions =
                shouldPinShortcuts && firstInlineFolderPath !== null && folderPath === firstInlineFolderPath;

            return (
                <FolderItem
                    folder={item.data}
                    displayName={item.displayName}
                    level={item.level}
                    indentGuideLevels={indentGuideLevels}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    isExcluded={item.isExcluded}
                    onToggle={() => tree.handleFolderToggle(item.data.path)}
                    onClick={() => tree.handleFolderClick(item.data)}
                    onNameClick={event => tree.handleFolderNameClick(item.data, event)}
                    onNameMouseDown={event => tree.handleFolderNameMouseDown(item.data, event)}
                    onToggleAllSiblings={() => tree.handleFolderToggleAllSiblings(item.data)}
                    icon={item.icon}
                    color={item.color}
                    backgroundColor={getSolidBackground(item.backgroundColor)}
                    adjacentFilledClassName={adjacentFilledClassName}
                    countInfo={countInfo}
                    excludedFolders={item.parsedExcludedFolders || []}
                    descendantExcludedFolders={descendantExcludedFolders}
                    vaultChangeVersion={vaultChangeVersion}
                    disableNavigationSeparatorActions={shouldHideFolderSeparatorActions}
                    onStartInlineRename={inlineRename.startFolder}
                    inlineRename={
                        renameTarget
                            ? {
                                  initialValue: renameTarget.initialValue,
                                  ariaLabel: strings.contextMenu.folder.renameFolder,
                                  onCommit: value => inlineRename.commit(renameTarget, value),
                                  onCancel: inlineRename.cancel,
                                  onRestoreFocus: inlineRename.restoreFocus
                              }
                            : undefined
                    }
                />
            );
        }

        case NavigationPaneItemType.VIRTUAL_FOLDER: {
            const virtualFolder = item.data;
            const indentGuideLevels = indentGuideLevelsByKey.get(getNavigationItemRenderKey(item));
            const isShortcutsGroup = virtualFolder.id === SHORTCUTS_VIRTUAL_FOLDER_ID;
            const isRecentNotesGroup = virtualFolder.id === RECENT_NOTES_VIRTUAL_FOLDER_ID;
            const hasChildren = item.hasChildren ?? false;
            const tagCollectionId = item.tagCollectionId ?? null;
            const propertyCollectionId = item.propertyCollectionId ?? null;
            const isTagCollection = Boolean(tagCollectionId);
            const isPropertyCollection = Boolean(propertyCollectionId);
            const collectionCountInfo = item.noteCount ?? (tagCollectionId ? tagCounts.get(tagCollectionId) : undefined);
            const showFileCount = item.showFileCount ?? false;
            const collectionSearchMatch = getNavigationItemSearchMatch(item, searchHighlights);
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
                ? shortcutUiState.shortcutHeaderTrailingAction
                : isPropertiesGroup
                  ? shortcutUiState.propertiesHeaderTrailingAction
                  : undefined;

            return (
                <VirtualFolderComponent
                    virtualFolder={virtualFolder}
                    level={item.level}
                    color={item.color}
                    backgroundColor={getSolidBackground(item.backgroundColor)}
                    adjacentFilledClassName={adjacentFilledClassName}
                    indentGuideLevels={indentGuideLevels}
                    isExpanded={isExpanded}
                    hasChildren={hasChildren}
                    isSelected={isSelected}
                    showFileCount={showFileCount}
                    showCountLeader={!isShortcutsGroup && !isRecentNotesGroup}
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
                        isTagsGroup || isPropertiesGroup ? () => tree.handleVirtualFolderToggleAllSiblings(virtualFolder.id) : undefined
                    }
                    onDragOver={
                        isShortcutsGroup && shortcutUiState.allowEmptyShortcutDrop ? shortcuts.handleShortcutRootDragOver : undefined
                    }
                    onDrop={isShortcutsGroup && shortcutUiState.allowEmptyShortcutDrop ? shortcuts.handleShortcutRootDrop : undefined}
                    dropConfig={dropConfig}
                    onContextMenu={sectionContextMenu}
                />
            );
        }

        case NavigationPaneItemType.TAG:
        case NavigationPaneItemType.UNTAGGED: {
            const tagNode = item.data;
            const indentGuideLevels = indentGuideLevelsByKey.get(getNavigationItemRenderKey(item));
            const searchMatch = getNavigationItemSearchMatch(item, searchHighlights);
            const inclusionOperator = searchMatch === 'include' ? searchHighlights.getTagInclusionOperator(tagNode.path) : undefined;

            return (
                <TagTreeItem
                    tagNode={tagNode}
                    level={item.level ?? 0}
                    indentGuideLevels={indentGuideLevels}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    isHidden={'isHidden' in item ? item.isHidden : false}
                    onToggle={() => tree.handleTagToggle(tagNode.path)}
                    onClick={event => tree.handleTagClick(tagNode.path, event)}
                    color={item.color}
                    backgroundColor={getSolidBackground(item.backgroundColor)}
                    adjacentFilledClassName={adjacentFilledClassName}
                    icon={item.icon}
                    searchMatch={searchMatch}
                    inclusionOperator={inclusionOperator}
                    isDraggable={!isMobile && tagNode.path !== UNTAGGED_TAG_ID && tagNode.path !== TAGGED_TAG_ID}
                    onToggleAllSiblings={() => tree.handleTagToggleAllSiblings(tagNode.path)}
                    countInfo={item.noteCount ?? tagCounts.get(tagNode.path)}
                    showFileCount={settings.showNoteCount}
                    inlineRename={
                        renameTarget
                            ? {
                                  initialValue: renameTarget.initialValue,
                                  ariaLabel: strings.modals.tagOperation.confirmRename,
                                  onCommit: value => inlineRename.commit(renameTarget, value),
                                  onCancel: inlineRename.cancel,
                                  onRestoreFocus: inlineRename.restoreFocus
                              }
                            : undefined
                    }
                />
            );
        }

        case NavigationPaneItemType.PROPERTY_KEY:
        case NavigationPaneItemType.PROPERTY_VALUE: {
            const propertyNode = item.data;
            const indentGuideLevels = indentGuideLevelsByKey.get(getNavigationItemRenderKey(item));
            const searchMatch = getNavigationItemSearchMatch(item, searchHighlights);
            const inclusionOperator =
                searchMatch === 'include' ? searchHighlights.getPropertyInclusionOperator(propertyNode.id) : undefined;

            return (
                <PropertyTreeItem
                    propertyNode={propertyNode}
                    level={item.level ?? 0}
                    indentGuideLevels={indentGuideLevels}
                    isExpanded={isExpanded}
                    isSelected={isSelected}
                    onToggle={() => tree.handlePropertyToggle(propertyNode.id)}
                    onClick={event => tree.handlePropertyClick(propertyNode, event)}
                    onToggleAllSiblings={() => tree.handlePropertyToggleAllSiblings(propertyNode)}
                    color={item.color}
                    backgroundColor={getSolidBackground(item.backgroundColor)}
                    adjacentFilledClassName={adjacentFilledClassName}
                    icon={item.icon}
                    searchMatch={searchMatch}
                    inclusionOperator={inclusionOperator}
                    isDraggable={!isMobile}
                    countInfo={propertyCounts.get(propertyNode.id)}
                    showFileCount={settings.showNoteCount}
                    inlineRename={
                        renameTarget
                            ? {
                                  initialValue: renameTarget.initialValue,
                                  ariaLabel: strings.contextMenu.property.renameKey,
                                  onCommit: value => inlineRename.commit(renameTarget, value),
                                  onCancel: inlineRename.cancel,
                                  onRestoreFocus: inlineRename.restoreFocus
                              }
                            : undefined
                    }
                />
            );
        }

        case NavigationPaneItemType.TOPIC:
            return <TopicRow item={item} context={context} isSelected={isSelected} isExpanded={isExpanded} />;

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
