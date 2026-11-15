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
import { useCallback, useMemo } from 'react';
import { useSettingsUpdate } from '../context/SettingsContext';
import type { MetadataService } from '../services/MetadataService';
import type { TopicService } from '../services/TopicGraphService';
import type { NotebookNavigatorSettings } from '../settings/types';
import type { TopicNode } from '../types/storage';
import { createTopicComparator, orderRootTopics } from '../utils/topicOrder';
import { resolveTopicStyle } from '../utils/topicStyle';
import { resolveUXIcon } from '../utils/uxIcons';
import type { ReorderTreeNode, ReorderTreeSource } from './useNavigationRootReorder';
import { useTopicGraphVersion } from './useTopicGraphVersion';

const EMPTY_EXPANDED: ReadonlySet<string> = new Set();
const NO_ROWS: ReorderTreeNode[] = [];

/**
 * Fork: the Topics section in reorder mode. Root topics can be dragged into a manual order, stored in
 * rootTopicOrder; child topics keep the topic sort order and are not listed.
 */
export function useTopicReorderTree(params: {
    settings: NotebookNavigatorSettings;
    topicService: TopicService | null;
    metadataService: MetadataService;
}): {
    source: ReorderTreeSource;
    showSection: boolean;
    showReset: boolean;
    onReorder: (orderedNames: string[]) => Promise<void>;
    onReset: () => Promise<void>;
} {
    const { settings, topicService, metadataService } = params;
    const updateSettings = useSettingsUpdate();
    const topicGraphVersion = useTopicGraphVersion(topicService);

    const rootTopics = useMemo(() => {
        void topicGraphVersion;
        if (!settings.showTopics || !topicService) {
            return [] as TopicNode[];
        }
        const roots = Array.from(topicService.getTopicGraph().values()).filter(node => node.parents.size === 0);
        return orderRootTopics(roots, settings.rootTopicOrder, createTopicComparator(settings.topicSortOrder));
    }, [settings.rootTopicOrder, settings.showTopics, settings.topicSortOrder, topicGraphVersion, topicService]);

    const rootRows = useMemo<ReorderTreeNode[]>(
        () =>
            rootTopics.map(node => ({
                key: node.name,
                name: node.name,
                parentPath: '/',
                hasChildren: false,
                props: {
                    icon: metadataService.getTopicIcon(node.name) ?? resolveUXIcon(settings.interfaceIcons, 'nav-tag'),
                    color: resolveTopicStyle(metadataService, node.name, { inheritTopicColors: false }).color,
                    label: node.name,
                    level: 1,
                    isMissing: false,
                    itemType: 'tag',
                    className: settings.hiddenTopics.includes(node.name) ? 'nn-excluded' : undefined
                }
            })),
        [metadataService, rootTopics, settings.hiddenTopics, settings.interfaceIcons]
    );

    const getChildren = useCallback((parentPath: string) => (parentPath === '/' ? rootRows : NO_ROWS), [rootRows]);
    const noop = useCallback(() => {}, []);

    const source = useMemo<ReorderTreeSource>(
        () => ({ type: 'topic', getChildren, expanded: EMPTY_EXPANDED, onToggle: noop, canReorder: rootRows.length > 1 }),
        [getChildren, noop, rootRows.length]
    );

    const onReorder = useCallback(
        async (orderedNames: string[]) => {
            await updateSettings(current => {
                current.rootTopicOrder = orderedNames.slice();
            });
        },
        [updateSettings]
    );

    const onReset = useCallback(async () => {
        await updateSettings(current => {
            current.rootTopicOrder = [];
        });
    }, [updateSettings]);

    return {
        source,
        showSection: settings.showTopics && rootRows.length > 0,
        showReset: settings.rootTopicOrder.length > 0,
        onReorder,
        onReset
    };
}
