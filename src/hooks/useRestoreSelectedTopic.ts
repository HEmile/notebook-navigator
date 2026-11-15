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
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ExpansionAction } from '../context/ExpansionContext';
import type { SelectionAction } from '../context/selection/types';
import type { TopicService } from '../services/TopicGraphService';
import { ItemType, STORAGE_KEYS, TOPICS_ROOT_VIRTUAL_FOLDER_ID } from '../types';
import { localStorage } from '../utils/localStorage';
import { useTopicGraphVersion } from './useTopicGraphVersion';

interface ScrollableNavigationPane {
    requestScroll: (path: string, options: { align?: 'auto' | 'center' | 'start' | 'end'; itemType: ItemType }) => void;
}

/** Returns the ancestor paths of a topic path, root first */
export function getTopicAncestorPaths(topicPath: string): string[] {
    const parts = topicPath.split('/');
    return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'));
}

/**
 * Fork: restores the topic that was selected before a reload. The stored path is read when the view mounts, before
 * the startup selection overwrites it, and applied once the first topic graph with topics is built, when it still
 * resolves. Its branch and the Topics section are expanded so the row is visible.
 */
export function useRestoreSelectedTopic(params: {
    topicService: TopicService | null;
    showTopics: boolean;
    expandedVirtualFolders: ReadonlySet<string>;
    selectionDispatch: (action: SelectionAction) => void;
    expansionDispatch: (action: ExpansionAction) => void;
    navigationPaneRef: RefObject<ScrollableNavigationPane | null>;
}): void {
    const { topicService, showTopics, expandedVirtualFolders, selectionDispatch, expansionDispatch, navigationPaneRef } = params;
    const [storedTopicPath] = useState<string | null>(() => {
        try {
            return localStorage.get<string>(STORAGE_KEYS.selectedTopicKey);
        } catch {
            return null;
        }
    });
    const doneRef = useRef(false);
    const topicGraphVersion = useTopicGraphVersion(topicService);

    useEffect(() => {
        if (doneRef.current || !storedTopicPath || !topicService || !showTopics) {
            return;
        }
        if (topicService.getTopicGraph().size === 0) {
            return;
        }
        doneRef.current = true;
        if (!topicService.findTopicNodeByPath(storedTopicPath)) {
            return;
        }

        if (!expandedVirtualFolders.has(TOPICS_ROOT_VIRTUAL_FOLDER_ID)) {
            const nextExpanded = new Set(expandedVirtualFolders);
            nextExpanded.add(TOPICS_ROOT_VIRTUAL_FOLDER_ID);
            expansionDispatch({ type: 'SET_EXPANDED_VIRTUAL_FOLDERS', folders: nextExpanded });
        }
        const ancestorPaths = getTopicAncestorPaths(storedTopicPath);
        if (ancestorPaths.length > 0) {
            expansionDispatch({ type: 'EXPAND_TOPICS', topicNames: ancestorPaths });
        }
        selectionDispatch({ type: 'SET_SELECTED_TOPIC', topicPath: storedTopicPath });
        window.requestAnimationFrame(() => {
            navigationPaneRef.current?.requestScroll(storedTopicPath, { align: 'center', itemType: ItemType.TOPIC });
        });
    }, [
        expandedVirtualFolders,
        expansionDispatch,
        navigationPaneRef,
        selectionDispatch,
        showTopics,
        storedTopicPath,
        topicGraphVersion,
        topicService
    ]);
}
