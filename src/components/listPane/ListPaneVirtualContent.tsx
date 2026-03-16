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

import React, { useCallback, useMemo } from 'react';
import { TFile, TFolder } from 'obsidian';
import { Virtualizer } from '@tanstack/react-virtual';
import { useServices } from '../../context/ServicesContext';
import { strings } from '../../i18n';
import { ListPaneItemType, PINNED_SECTION_HEADER_KEY, type NavigationItemType } from '../../types';
import { runAsyncAction } from '../../utils/async';
import { getFolderNote, openFolderNoteFile } from '../../utils/folderNotes';
import { resolveFolderNoteClickOpenContext } from '../../utils/keyboardOpenContext';
import type { ListPaneItem } from '../../types/virtualization';
import type { NotebookNavigatorSettings } from '../../settings';
import type { SortOption } from '../../settings';
import type { InclusionOperator } from '../../utils/filterSearch';
import type { FolderDecorationModel } from '../../utils/folderDecoration';
import type { NavigateToFolderOptions } from '../../hooks/useNavigatorReveal';
import { FileItem } from '../FileItem';
import { ServiceIcon } from '../ServiceIcon';

interface FolderGroupHeaderTarget {
    folder: TFolder;
    folderNote: TFile | null;
}

type VirtualRowStyle = React.CSSProperties & Record<'--item-height', string>;

interface ListPaneVirtualContentProps {
    listItems: ListPaneItem[];
    rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
    scrollContainerRefCallback: (element: HTMLDivElement | null) => void;
    activeFolderDropPath: string | null;
    isCompactMode: boolean;
    isEmptySelection: boolean;
    hasNoFiles: boolean;
    topSpacerHeight: number;
    settings: NotebookNavigatorSettings;
    pinnedSectionIcon: string;
    selectionType: NavigationItemType | null;
    sortOption?: SortOption;
    searchHighlightQuery?: string;
    isFolderNavigation: boolean;
    lastSelectedFilePath: string | null;
    isFileSelected: (file: TFile) => boolean;
    onFileClick: (file: TFile, fileIndex: number | undefined, event: React.MouseEvent) => void;
    onModifySearchWithTag: (tag: string, operator: InclusionOperator) => void;
    onModifySearchWithProperty: (key: string, value: string | null, operator: InclusionOperator) => void;
    localDayReference: Date | null;
    fileIconSize: number;
    visibleListPropertyKeys: ReadonlySet<string>;
    visibleNavigationPropertyKeys: ReadonlySet<string>;
    onNavigateToFolder: (folderPath: string, options?: NavigateToFolderOptions) => void;
    folderDecorationModel: FolderDecorationModel;
}

function getItemAt<T>(items: T[], index: number): T | undefined {
    if (index < 0 || index >= items.length) {
        return undefined;
    }

    return items[index];
}

function getDateGroupLabel(listItems: ListPaneItem[], index: number): string | null {
    for (let listIndex = index - 1; listIndex >= 0; listIndex -= 1) {
        const item = getItemAt(listItems, listIndex);
        if (item?.type === ListPaneItemType.HEADER && typeof item.data === 'string') {
            return item.data;
        }
    }

    return null;
}

export function ListPaneVirtualContent({
    listItems,
    rowVirtualizer,
    scrollContainerRefCallback,
    activeFolderDropPath,
    isCompactMode,
    isEmptySelection,
    hasNoFiles,
    topSpacerHeight,
    settings,
    pinnedSectionIcon,
    selectionType,
    sortOption,
    searchHighlightQuery,
    isFolderNavigation,
    lastSelectedFilePath,
    isFileSelected,
    onFileClick,
    onModifySearchWithTag,
    onModifySearchWithProperty,
    localDayReference,
    fileIconSize,
    visibleListPropertyKeys,
    visibleNavigationPropertyKeys,
    onNavigateToFolder,
    folderDecorationModel
}: ListPaneVirtualContentProps) {
    const { app, commandQueue, isMobile } = useServices();

    const folderGroupHeaderTargets = useMemo(() => {
        const targets = new Map<string, FolderGroupHeaderTarget>();

        listItems.forEach(item => {
            if (item.type !== ListPaneItemType.HEADER) {
                return;
            }

            const folderPath = item.headerFolderPath;
            if (!folderPath || targets.has(folderPath)) {
                return;
            }

            const folder = app.vault.getFolderByPath(folderPath);
            if (!folder) {
                return;
            }

            const folderNote =
                settings.enableFolderNotes && settings.enableFolderNoteLinks
                    ? getFolderNote(folder, {
                          enableFolderNotes: settings.enableFolderNotes,
                          folderNoteName: settings.folderNoteName,
                          folderNoteNamePattern: settings.folderNoteNamePattern
                      })
                    : null;

            targets.set(folderPath, { folder, folderNote });
        });

        return targets;
    }, [
        app.vault,
        listItems,
        settings.enableFolderNoteLinks,
        settings.enableFolderNotes,
        settings.folderNoteName,
        settings.folderNoteNamePattern
    ]);

    const handleFolderGroupHeaderClick = useCallback(
        (event: React.MouseEvent<HTMLSpanElement>, target: FolderGroupHeaderTarget) => {
            event.stopPropagation();
            const folderNote = target.folderNote;

            const navigateOptions: NavigateToFolderOptions = {
                source: 'manual',
                suppressAutoSelect: Boolean(folderNote)
            };
            onNavigateToFolder(target.folder.path, navigateOptions);

            if (!folderNote) {
                return;
            }

            const openContext = resolveFolderNoteClickOpenContext(
                event,
                settings.openFolderNotesInNewTab,
                settings.multiSelectModifier,
                isMobile
            );

            runAsyncAction(() =>
                openFolderNoteFile({
                    app,
                    commandQueue,
                    folder: target.folder,
                    folderNote,
                    context: openContext
                })
            );
        },
        [app, commandQueue, isMobile, onNavigateToFolder, settings.multiSelectModifier, settings.openFolderNotesInNewTab]
    );

    const handleFolderGroupHeaderMouseDown = useCallback(
        (event: React.MouseEvent<HTMLSpanElement>, target: FolderGroupHeaderTarget) => {
            const folderNote = target.folderNote;
            if (event.button !== 1 || !folderNote) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            onNavigateToFolder(target.folder.path, { source: 'manual', suppressAutoSelect: true });

            runAsyncAction(() =>
                openFolderNoteFile({
                    app,
                    commandQueue,
                    folder: target.folder,
                    folderNote,
                    context: 'tab'
                })
            );
        },
        [app, commandQueue, onNavigateToFolder]
    );

    return (
        <div
            ref={scrollContainerRefCallback}
            className={`nn-list-pane-scroller ${!isEmptySelection && !hasNoFiles && isCompactMode ? 'nn-compact-mode' : ''}`}
            data-drop-zone={activeFolderDropPath ? 'folder' : undefined}
            data-drop-path={activeFolderDropPath ?? undefined}
            data-allow-internal-drop={activeFolderDropPath ? 'false' : undefined}
            data-allow-external-drop={activeFolderDropPath ? 'true' : undefined}
            data-pane="files"
            role="list"
            tabIndex={-1}
        >
            <div className="nn-list-pane-content">
                {isEmptySelection ? (
                    <div className="nn-empty-state">
                        <div className="nn-empty-message">{strings.listPane.emptyStateNoSelection}</div>
                    </div>
                ) : hasNoFiles ? (
                    <div className="nn-empty-state">
                        <div className="nn-empty-message">{strings.listPane.emptyStateNoNotes}</div>
                    </div>
                ) : listItems.length > 0 ? (
                    <div
                        className="nn-virtual-container"
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map(virtualItem => {
                            const item = getItemAt(listItems, virtualItem.index);
                            if (!item) {
                                return null;
                            }

                            let isSelected = false;
                            if (item.type === ListPaneItemType.FILE && item.data instanceof TFile) {
                                isSelected = isFileSelected(item.data);
                                if (!isSelected && isFolderNavigation && lastSelectedFilePath) {
                                    isSelected = item.data.path === lastSelectedFilePath;
                                }
                            }

                            const nextItem = getItemAt(listItems, virtualItem.index + 1);
                            const previousItem = getItemAt(listItems, virtualItem.index - 1);
                            const isLastFile =
                                item.type === ListPaneItemType.FILE &&
                                (virtualItem.index === listItems.length - 1 ||
                                    (nextItem &&
                                        (nextItem.type === ListPaneItemType.HEADER ||
                                            nextItem.type === ListPaneItemType.TOP_SPACER ||
                                            nextItem.type === ListPaneItemType.BOTTOM_SPACER)));

                            const hasSelectedAbove =
                                item.type === ListPaneItemType.FILE &&
                                previousItem?.type === ListPaneItemType.FILE &&
                                previousItem.data instanceof TFile &&
                                isFileSelected(previousItem.data);
                            const hasSelectedBelow =
                                item.type === ListPaneItemType.FILE &&
                                nextItem?.type === ListPaneItemType.FILE &&
                                nextItem.data instanceof TFile &&
                                isFileSelected(nextItem.data);

                            const isFirstHeader = item.type === ListPaneItemType.HEADER && virtualItem.index === 1;
                            const isPinnedHeader = item.type === ListPaneItemType.HEADER && item.key === PINNED_SECTION_HEADER_KEY;
                            const headerLabel = item.type === ListPaneItemType.HEADER && typeof item.data === 'string' ? item.data : '';
                            const headerFolderPath = item.type === ListPaneItemType.HEADER ? (item.headerFolderPath ?? null) : null;
                            const folderGroupHeaderTarget =
                                headerFolderPath !== null ? (folderGroupHeaderTargets.get(headerFolderPath) ?? null) : null;
                            const isClickableFolderGroupHeader = Boolean(folderGroupHeaderTarget) && !isPinnedHeader;
                            const dateGroup = item.type === ListPaneItemType.FILE ? getDateGroupLabel(listItems, virtualItem.index) : null;

                            const hideSeparator =
                                item.type === ListPaneItemType.FILE &&
                                ((isSelected && !hasSelectedBelow) ||
                                    (!isSelected &&
                                        nextItem?.type === ListPaneItemType.FILE &&
                                        nextItem.data instanceof TFile &&
                                        isFileSelected(nextItem.data)));

                            const virtualItemStyle: VirtualRowStyle = {
                                top: Math.max(0, virtualItem.start),
                                '--item-height': `${virtualItem.size}px`
                            };

                            return (
                                <div
                                    key={virtualItem.key}
                                    className={`nn-virtual-item ${
                                        item.type === ListPaneItemType.FILE ? 'nn-virtual-file-item' : ''
                                    } ${isLastFile ? 'nn-last-file' : ''} ${hideSeparator ? 'nn-hide-separator-selection' : ''}`}
                                    style={virtualItemStyle}
                                    data-index={virtualItem.index}
                                >
                                    {item.type === ListPaneItemType.HEADER ? (
                                        <div
                                            className={`nn-date-group-header ${isFirstHeader ? 'nn-first-header' : ''} ${
                                                isPinnedHeader ? 'nn-pinned-section-header' : ''
                                            }`}
                                        >
                                            {isPinnedHeader ? (
                                                <>
                                                    {settings.showPinnedIcon ? (
                                                        <ServiceIcon
                                                            iconId={pinnedSectionIcon}
                                                            className="nn-date-group-header-icon"
                                                            aria-hidden={true}
                                                        />
                                                    ) : null}
                                                    <span className="nn-date-group-header-text">{headerLabel}</span>
                                                </>
                                            ) : (
                                                <span
                                                    className={`nn-date-group-header-text ${
                                                        isClickableFolderGroupHeader ? 'nn-date-group-header-text--folder-note' : ''
                                                    }`}
                                                    onClick={
                                                        folderGroupHeaderTarget
                                                            ? event => handleFolderGroupHeaderClick(event, folderGroupHeaderTarget)
                                                            : undefined
                                                    }
                                                    onMouseDown={
                                                        folderGroupHeaderTarget
                                                            ? event => handleFolderGroupHeaderMouseDown(event, folderGroupHeaderTarget)
                                                            : undefined
                                                    }
                                                >
                                                    {headerLabel}
                                                </span>
                                            )}
                                        </div>
                                    ) : item.type === ListPaneItemType.TOP_SPACER ? (
                                        <div className="nn-list-top-spacer" style={{ height: `${topSpacerHeight}px` }} />
                                    ) : item.type === ListPaneItemType.BOTTOM_SPACER ? (
                                        <div className="nn-list-bottom-spacer" />
                                    ) : item.type === ListPaneItemType.FILE && item.data instanceof TFile ? (
                                        <FileItem
                                            key={item.key}
                                            file={item.data}
                                            isSelected={isSelected}
                                            hasSelectedAbove={hasSelectedAbove}
                                            hasSelectedBelow={hasSelectedBelow}
                                            onFileClick={onFileClick}
                                            fileIndex={item.fileIndex}
                                            selectionType={selectionType}
                                            dateGroup={dateGroup}
                                            sortOption={sortOption}
                                            parentFolder={item.parentFolder}
                                            isPinned={item.isPinned}
                                            searchQuery={searchHighlightQuery}
                                            searchMeta={item.searchMeta}
                                            isHidden={Boolean(item.isHidden)}
                                            onModifySearchWithTag={onModifySearchWithTag}
                                            onModifySearchWithProperty={onModifySearchWithProperty}
                                            localDayReference={localDayReference}
                                            fileIconSize={fileIconSize}
                                            visiblePropertyKeys={visibleListPropertyKeys}
                                            visibleNavigationPropertyKeys={visibleNavigationPropertyKeys}
                                            folderDecorationModel={folderDecorationModel}
                                        />
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
