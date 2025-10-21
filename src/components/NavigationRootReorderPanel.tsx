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

import React, { ReactNode, useCallback } from 'react';
import { RootFolderReorderItem } from './RootFolderReorderItem';
import { strings } from '../i18n';
import type { SectionReorderRenderItem, RootReorderRenderItem } from '../hooks/useNavigationRootReorder';
import { NavigationSectionId } from '../types';

interface NavigationRootReorderPanelProps {
    sectionItems: SectionReorderRenderItem[];
    folderItems: RootReorderRenderItem[];
    tagItems: RootReorderRenderItem[];
    showRootFolderSection: boolean;
    showRootTagSection: boolean;
    notesSectionExpanded: boolean;
    tagsSectionExpanded: boolean;
    showRootFolderReset: boolean;
    showRootTagReset: boolean;
    resetRootTagOrderLabel: string;
    onResetRootFolderOrder: () => Promise<void> | void;
    onResetRootTagOrder: () => Promise<void> | void;
}

const RESET_FOLDER_LABEL = strings.navigationPane.resetRootToAlpha;

// Represents the drop position for drag and drop operations
type DropPosition = '' | 'before' | 'after';

// Updates the scroller element's drop position data attribute for visual feedback during drag operations
function updateScrollerDropPosition(target: EventTarget | null, position: DropPosition) {
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const scroller = target.closest('.nn-navigation-pane-scroller');
    if (!(scroller instanceof HTMLElement)) {
        return;
    }
    scroller.dataset.reorderDropPosition = position;
}

export function NavigationRootReorderPanel({
    sectionItems,
    folderItems,
    tagItems,
    showRootFolderSection,
    showRootTagSection,
    notesSectionExpanded,
    tagsSectionExpanded,
    showRootFolderReset,
    showRootTagReset,
    resetRootTagOrderLabel,
    onResetRootFolderOrder,
    onResetRootTagOrder
}: NavigationRootReorderPanelProps) {
    // Renders a section of reorderable items with optional reset button
    const renderRootReorderSection = useCallback(
        (
            items: RootReorderRenderItem[],
            options?: { showReset: boolean; resetLabel: string; onReset: (() => Promise<void> | void) | undefined }
        ): ReactNode => {
            if (items.length === 0) {
                return null;
            }

            const handleReset = (event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                event.stopPropagation();
                if (options?.onReset) {
                    void options.onReset();
                }
            };

            const shouldShowReset = Boolean(options?.showReset && options?.onReset);
            const resetLabel = options?.resetLabel ?? '';

            return (
                <div className="nn-root-reorder-section-list">
                    {items.map(item => (
                        <RootFolderReorderItem key={item.key} {...item.props} />
                    ))}
                    {shouldShowReset ? (
                        <div className="nn-root-reorder-actions">
                            <button type="button" className="nn-root-reorder-reset nn-support-button" onClick={handleReset}>
                                <span className="nn-root-reorder-reset-icon" aria-hidden="true">
                                    Aa
                                </span>
                                <span>{resetLabel}</span>
                            </button>
                        </div>
                    ) : null}
                </div>
            );
        },
        []
    );

    const sectionContent: ReactNode[] = [];

    if (sectionItems.length > 0) {
        const noopDragHandler = () => {};

        sectionItems.forEach((sectionItem, index) => {
            const { showDropIndicatorBefore, showDropIndicatorAfter, dragHandlers, ...rowProps } = sectionItem.props;
            const shouldRenderFolders =
                sectionItem.sectionId === NavigationSectionId.NOTES && notesSectionExpanded && showRootFolderSection;
            const shouldRenderTags = sectionItem.sectionId === NavigationSectionId.TAGS && tagsSectionExpanded && showRootTagSection;
            const hasExpandedContent = (shouldRenderFolders && folderItems.length > 0) || (shouldRenderTags && tagItems.length > 0);
            const headerShowsDropAfter = Boolean(showDropIndicatorAfter && !hasExpandedContent);
            const sectionShowsDropAfter = Boolean(showDropIndicatorAfter && hasExpandedContent);

            // Drag handlers for spacer elements between sections
            let spacerDragHandlers:
                | {
                      onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
                      onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
                      onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
                  }
                | undefined;

            // Create spacer drag handlers that stop propagation and update drop position indicators
            if (dragHandlers) {
                spacerDragHandlers = {
                    onDragOver: event => {
                        event.stopPropagation();
                        dragHandlers.onDragOver(event);
                        updateScrollerDropPosition(event.currentTarget, 'after');
                    },
                    onDragLeave: event => {
                        event.stopPropagation();
                        dragHandlers.onDragLeave(event);
                        updateScrollerDropPosition(event.currentTarget, '');
                    },
                    onDrop: event => {
                        event.stopPropagation();
                        dragHandlers.onDrop(event);
                        updateScrollerDropPosition(event.currentTarget, '');
                    }
                };
            }

            if (index > 0) {
                sectionContent.push(
                    <div
                        key={`${sectionItem.key}-spacer`}
                        className="nn-nav-list-spacer"
                        aria-hidden="true"
                        data-reorder-gap="true"
                        data-reorder-insert="before"
                        onDragOver={spacerDragHandlers?.onDragOver}
                        onDragLeave={spacerDragHandlers?.onDragLeave}
                        onDrop={spacerDragHandlers?.onDrop}
                    />
                );
            }

            const headerDragHandlers = dragHandlers
                ? {
                      draggable: dragHandlers.draggable,
                      onDragStart: dragHandlers.onDragStart,
                      onDragOver: noopDragHandler,
                      onDragLeave: noopDragHandler,
                      onDrop: noopDragHandler,
                      onDragEnd: dragHandlers.onDragEnd
                  }
                : undefined;

            sectionContent.push(
                <div
                    key={sectionItem.key}
                    className="nn-root-reorder-section"
                    data-reorder-drop-after={sectionShowsDropAfter ? 'true' : undefined}
                    onDragOver={
                        dragHandlers
                            ? event => {
                                  event.stopPropagation();
                                  dragHandlers.onDragOver(event);
                                  if (showDropIndicatorBefore) {
                                      updateScrollerDropPosition(event.currentTarget, 'before');
                                  } else if (headerShowsDropAfter || sectionShowsDropAfter) {
                                      updateScrollerDropPosition(event.currentTarget, 'after');
                                  } else {
                                      updateScrollerDropPosition(event.currentTarget, '');
                                  }
                              }
                            : undefined
                    }
                    onDragLeave={
                        dragHandlers
                            ? event => {
                                  event.stopPropagation();
                                  dragHandlers.onDragLeave(event);
                                  updateScrollerDropPosition(event.currentTarget, '');
                              }
                            : undefined
                    }
                    onDrop={
                        dragHandlers
                            ? event => {
                                  event.stopPropagation();
                                  dragHandlers.onDrop(event);
                                  updateScrollerDropPosition(event.currentTarget, '');
                              }
                            : undefined
                    }
                >
                    <RootFolderReorderItem
                        {...rowProps}
                        dragHandlers={headerDragHandlers}
                        showDropIndicatorBefore={showDropIndicatorBefore}
                        showDropIndicatorAfter={headerShowsDropAfter}
                    />
                    {shouldRenderFolders
                        ? renderRootReorderSection(folderItems, {
                              showReset: showRootFolderReset,
                              resetLabel: RESET_FOLDER_LABEL,
                              onReset: onResetRootFolderOrder
                          })
                        : null}
                    {shouldRenderTags
                        ? renderRootReorderSection(tagItems, {
                              showReset: showRootTagReset,
                              resetLabel: resetRootTagOrderLabel,
                              onReset: onResetRootTagOrder
                          })
                        : null}
                </div>
            );
        });
    } else {
        if (showRootFolderSection) {
            sectionContent.push(
                <div key="root-folders" className="nn-root-reorder-section">
                    {renderRootReorderSection(folderItems, {
                        showReset: showRootFolderReset,
                        resetLabel: RESET_FOLDER_LABEL,
                        onReset: onResetRootFolderOrder
                    })}
                </div>
            );
        }

        if (showRootTagSection) {
            if (sectionContent.length > 0) {
                sectionContent.push(<div key="root-tags-spacer" className="nn-nav-list-spacer" aria-hidden="true" />);
            }
            sectionContent.push(
                <div key="root-tags" className="nn-root-reorder-section">
                    {renderRootReorderSection(tagItems, {
                        showReset: showRootTagReset,
                        resetLabel: resetRootTagOrderLabel,
                        onReset: onResetRootTagOrder
                    })}
                </div>
            );
        }
    }

    const hasContent = sectionContent.length > 0;

    return (
        <div className="nn-root-reorder-panel">
            <div className="nn-root-reorder-header">
                <span className="nn-root-reorder-title">{strings.navigationPane.reorderRootFoldersTitle}</span>
                <span className="nn-root-reorder-hint">{strings.navigationPane.reorderRootFoldersHint}</span>
            </div>
            <div className="nn-root-reorder-list" role="presentation">
                {hasContent ? <div className="nn-nav-top-spacer" aria-hidden="true" /> : null}
                {sectionContent}
                {hasContent ? <div className="nn-nav-bottom-spacer" aria-hidden="true" /> : null}
            </div>
        </div>
    );
}
