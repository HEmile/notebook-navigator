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

import React from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { CombinedNavigationItem } from '../../types/virtualization';
import type { CSSPropertiesWithVars } from '../../types';
import { NavigationPaneHeader } from '../NavigationPaneHeader';
import { VaultTitleArea } from '../VaultTitleArea';

interface NavigationPaneLayoutProps {
    navigationPaneRef: React.RefObject<HTMLDivElement | null>;
    navigationPaneStyle: CSSPropertiesWithVars;
    shouldRenderCalendarOverlay: boolean;
    isShortcutSorting: boolean;
    isMobile: boolean;
    isPinnedShortcutsResizing: boolean;
    onTreeUpdateComplete: () => void;
    onToggleRootReorder: () => void;
    rootReorderActive: boolean;
    rootReorderDisabled: boolean;
    showVaultTitleInHeader: boolean;
    shouldShowVaultTitleInNavigationPane: boolean;
    showAndroidToolbar: boolean;
    navigationToolbar: React.ReactNode;
    pinNavigationBanner: boolean;
    navigationBannerContent: React.ReactNode;
    shouldRenderPinnedShortcuts: boolean;
    pinnedShortcutsContainerRef: React.RefObject<HTMLDivElement | null>;
    pinnedShortcutsHasOverflow: boolean;
    pinnedShortcutsMaxHeight: number | null;
    allowEmptyShortcutDrop: boolean;
    onShortcutRootDragOver: (event: React.DragEvent<HTMLElement>) => void;
    onShortcutRootDrop: (event: React.DragEvent<HTMLElement>) => void;
    pinnedShortcutsScrollRefCallback: (node: HTMLDivElement | null) => void;
    pinnedNavigationItems: CombinedNavigationItem[];
    renderNavigationItem: (item: CombinedNavigationItem) => React.ReactNode;
    onPinnedShortcutsResizePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    scrollContainerRefCallback: (node: HTMLDivElement | null) => void;
    hasNavigationBannerConfigured: boolean;
    navigationBannerRef: React.RefObject<HTMLDivElement | null>;
    rootReorderContent: React.ReactNode;
    isRootReorderMode: boolean;
    items: CombinedNavigationItem[];
    rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
    navigationScrollMargin: number;
    shouldRenderBottomToolbarInsidePanel: boolean;
    shouldRenderBottomToolbarOutsidePanel: boolean;
    calendarOverlay: React.ReactNode;
}

export function NavigationPaneLayout({
    navigationPaneRef,
    navigationPaneStyle,
    shouldRenderCalendarOverlay,
    isShortcutSorting,
    isMobile,
    isPinnedShortcutsResizing,
    onTreeUpdateComplete,
    onToggleRootReorder,
    rootReorderActive,
    rootReorderDisabled,
    showVaultTitleInHeader,
    shouldShowVaultTitleInNavigationPane,
    showAndroidToolbar,
    navigationToolbar,
    pinNavigationBanner,
    navigationBannerContent,
    shouldRenderPinnedShortcuts,
    pinnedShortcutsContainerRef,
    pinnedShortcutsHasOverflow,
    pinnedShortcutsMaxHeight,
    allowEmptyShortcutDrop,
    onShortcutRootDragOver,
    onShortcutRootDrop,
    pinnedShortcutsScrollRefCallback,
    pinnedNavigationItems,
    renderNavigationItem,
    onPinnedShortcutsResizePointerDown,
    scrollContainerRefCallback,
    hasNavigationBannerConfigured,
    navigationBannerRef,
    rootReorderContent,
    isRootReorderMode,
    items,
    rowVirtualizer,
    navigationScrollMargin,
    shouldRenderBottomToolbarInsidePanel,
    shouldRenderBottomToolbarOutsidePanel,
    calendarOverlay
}: NavigationPaneLayoutProps) {
    return (
        <div
            ref={navigationPaneRef}
            className="nn-navigation-pane"
            style={navigationPaneStyle}
            data-calendar={shouldRenderCalendarOverlay ? 'true' : undefined}
            data-shortcut-sorting={isShortcutSorting ? 'true' : undefined}
            data-shortcuts-resizing={!isMobile && isPinnedShortcutsResizing ? 'true' : undefined}
        >
            <div className="nn-navigation-pane-chrome">
                <NavigationPaneHeader
                    onTreeUpdateComplete={onTreeUpdateComplete}
                    onToggleRootFolderReorder={onToggleRootReorder}
                    rootReorderActive={rootReorderActive}
                    rootReorderDisabled={rootReorderDisabled}
                    showVaultTitleInHeader={showVaultTitleInHeader}
                />
                {shouldShowVaultTitleInNavigationPane ? <VaultTitleArea /> : null}
                {showAndroidToolbar ? navigationToolbar : null}
                {pinNavigationBanner ? navigationBannerContent : null}
                {shouldRenderPinnedShortcuts ? (
                    <div
                        className="nn-shortcut-pinned"
                        ref={pinnedShortcutsContainerRef}
                        role="presentation"
                        data-scroll={pinnedShortcutsHasOverflow ? 'true' : undefined}
                        style={pinnedShortcutsMaxHeight !== null ? { maxHeight: pinnedShortcutsMaxHeight } : undefined}
                        onDragOver={allowEmptyShortcutDrop ? onShortcutRootDragOver : undefined}
                        onDrop={allowEmptyShortcutDrop ? onShortcutRootDrop : undefined}
                    >
                        <div className="nn-shortcut-pinned-scroll" ref={pinnedShortcutsScrollRefCallback}>
                            <div className="nn-shortcut-pinned-inner">
                                {pinnedNavigationItems.map(pinnedItem => (
                                    <React.Fragment key={pinnedItem.key}>{renderNavigationItem(pinnedItem)}</React.Fragment>
                                ))}
                            </div>
                        </div>
                        <div
                            className="nn-shortcuts-resize-handle"
                            role="separator"
                            aria-orientation="horizontal"
                            aria-label="Resize pinned shortcuts"
                            onPointerDown={onPinnedShortcutsResizePointerDown}
                        />
                    </div>
                ) : null}
            </div>
            <div className="nn-navigation-pane-panel">
                <div
                    ref={scrollContainerRefCallback}
                    className="nn-navigation-pane-scroller"
                    data-banner={hasNavigationBannerConfigured ? 'true' : undefined}
                    data-pane="navigation"
                    tabIndex={-1}
                >
                    <div className="nn-navigation-pane-content">
                        {!pinNavigationBanner && navigationBannerContent ? (
                            <div className="nn-navigation-pane-banner" ref={navigationBannerRef}>
                                {navigationBannerContent}
                            </div>
                        ) : null}
                        <div role={isRootReorderMode ? 'list' : 'tree'}>
                            {isRootReorderMode
                                ? rootReorderContent
                                : items.length > 0 && (
                                      <div
                                          className="nn-virtual-container"
                                          style={{
                                              height: `${rowVirtualizer.getTotalSize()}px`
                                          }}
                                      >
                                          {rowVirtualizer.getVirtualItems().map(virtualItem => {
                                              const item =
                                                  virtualItem.index >= 0 && virtualItem.index < items.length
                                                      ? items[virtualItem.index]
                                                      : null;
                                              if (!item) {
                                                  return null;
                                              }

                                              return (
                                                  <div
                                                      key={virtualItem.key}
                                                      data-index={virtualItem.index}
                                                      className="nn-virtual-nav-item"
                                                      style={{
                                                          transform: `translateY(${Math.max(0, virtualItem.start - navigationScrollMargin)}px)`
                                                      }}
                                                  >
                                                      {renderNavigationItem(item)}
                                                  </div>
                                              );
                                          })}
                                      </div>
                                  )}
                        </div>
                    </div>
                </div>
                {shouldRenderBottomToolbarInsidePanel ? <div className="nn-pane-bottom-toolbar">{navigationToolbar}</div> : null}
            </div>
            {calendarOverlay}
            {shouldRenderBottomToolbarOutsidePanel ? <div className="nn-pane-bottom-toolbar">{navigationToolbar}</div> : null}
        </div>
    );
}
