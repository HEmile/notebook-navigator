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

import { TFile, TFolder } from 'obsidian';
import { ListPaneItemType, NavigationPaneItemType, VirtualFolder } from '../types';
import type { SearchResultMeta } from './search';
import { TagTreeNode, TopicNode } from '../types/storage';
import type { SearchShortcut, ShortcutEntry } from '../types/shortcuts';

export interface VirtualItem<T> {
    type: string;
    data: T;
    key: string;
    level?: number; // For hierarchical items
}

export interface ListPaneItem {
    type: ListPaneItemType;
    data: TFile | string; // File or header text
    parentFolder?: string | null;
    key: string;
    // Pre-computed file index for stable onClick handlers
    fileIndex?: number;
    // Indicates if this file is pinned
    isPinned?: boolean;
    searchMeta?: SearchResultMeta;
    // Pre-computed flag indicating if file has tags (for height calculation optimization)
    hasTags?: boolean;
}

export interface FolderTreeItem {
    type: typeof NavigationPaneItemType.FOLDER;
    data: TFolder;
    level: number;
    path: string;
    key: string;
    color?: string;
    backgroundColor?: string;
    icon?: string;
    parsedExcludedFolders?: string[];
    isExcluded?: boolean;
}

export interface TagTreeItem {
    type: typeof NavigationPaneItemType.TAG;
    data: TagTreeNode;
    level: number;
    path?: string;
    key: string;
    color?: string;
    backgroundColor?: string;
    icon?: string;
    isHidden?: boolean; // Marks tags that are normally hidden but being shown
}

export interface TopicItem {
    type: typeof NavigationPaneItemType.TOPIC;
    data: TopicNode;
    level: number;
    path?: string;
    key: string;
    color?: string;
    backgroundColor?: string;
    icon?: string;
    isHidden?: boolean; // Marks topics that are normally hidden but being shown
}

export interface UntaggedItem {
    type: typeof NavigationPaneItemType.UNTAGGED;
    data: TagTreeNode;
    level: number;
    key: string;
    color?: string;
    backgroundColor?: string;
    icon?: string;
}

export interface VirtualFolderItem {
    type: typeof NavigationPaneItemType.VIRTUAL_FOLDER;
    data: VirtualFolder;
    level: number;
    key: string;
}

interface ShortcutNavigationBase {
    shortcut: ShortcutEntry;
    level: number;
    key: string;
    icon?: string;
    color?: string;
    isExcluded?: boolean;
    isMissing?: boolean;
    missingLabel?: string;
}

export interface ShortcutHeaderItem {
    type: typeof NavigationPaneItemType.SHORTCUT_HEADER;
    key: string;
    level: number;
    count: number;
}

export interface ShortcutFolderNavItem extends ShortcutNavigationBase {
    type: typeof NavigationPaneItemType.SHORTCUT_FOLDER;
    folder: TFolder | null;
}

export interface ShortcutNoteNavItem extends ShortcutNavigationBase {
    type: typeof NavigationPaneItemType.SHORTCUT_NOTE;
    note: TFile | null;
}

export interface RecentNoteNavItem {
    type: typeof NavigationPaneItemType.RECENT_NOTE;
    note: TFile;
    level: number;
    key: string;
    icon?: string;
    color?: string;
}

export interface ShortcutSearchNavItem extends ShortcutNavigationBase {
    type: typeof NavigationPaneItemType.SHORTCUT_SEARCH;
    searchShortcut: SearchShortcut;
}

export interface ShortcutTagNavItem extends ShortcutNavigationBase {
    type: typeof NavigationPaneItemType.SHORTCUT_TAG;
    tagPath: string;
    displayName: string;
}

export interface ShortcutTopicNavItem extends ShortcutNavigationBase {
    type: typeof NavigationPaneItemType.SHORTCUT_TOPIC;
    topicName: string;
    displayName: string;
}

export interface NavigationBannerItem {
    type: typeof NavigationPaneItemType.BANNER;
    key: string;
    path: string;
}

export type CombinedNavigationItem =
    | FolderTreeItem
    | VirtualFolderItem
    | TagTreeItem
    | UntaggedItem
    | ShortcutHeaderItem
    | ShortcutFolderNavItem
    | ShortcutNoteNavItem
    | RecentNoteNavItem
    | ShortcutSearchNavItem
    | ShortcutTagNavItem
    | ShortcutTopicNavItem
    | NavigationBannerItem
    | TopicItem
    | { type: typeof NavigationPaneItemType.TOP_SPACER; key: string }
    | { type: typeof NavigationPaneItemType.BOTTOM_SPACER; key: string }
    | { type: typeof NavigationPaneItemType.LIST_SPACER; key: string };
