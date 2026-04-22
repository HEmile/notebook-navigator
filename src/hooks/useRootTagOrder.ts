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

import { useEffect, useMemo } from 'react';
import type { TagTreeNode } from '../types/storage';
import type { NotebookNavigatorSettings } from '../settings/types';
import { useSettingsUpdate } from '../context/SettingsContext';
import { areStringArraysEqual, createIndexMap } from '../utils/arrayUtils';
import { normalizeTagPathValue } from '../utils/tagPrefixMatcher';
import { naturalCompare } from '../utils/sortUtils';
import { runAsyncAction } from '../utils/async';

interface UseRootTagOrderParams {
    settings: NotebookNavigatorSettings;
    tagTree: Map<string, TagTreeNode> | null;
    comparator?: (a: TagTreeNode, b: TagTreeNode) => number;
}

interface RootTagOrderState {
    rootTagOrderMap: Map<string, number>;
    missingRootTagPaths: string[];
}

interface NormalizedTagOrder {
    normalizedOrder: string[];
    missingPaths: string[];
}

// Normalizes the root tag order by validating paths and appending new tags
function normalizeRootTagOrder(
    existingOrder: string[],
    nodes: TagTreeNode[],
    fallbackComparator: (a: TagTreeNode, b: TagTreeNode) => number
): NormalizedTagOrder {
    const nodeMap = new Map<string, TagTreeNode>();
    nodes.forEach(node => {
        nodeMap.set(node.path, node);
    });

    const seen = new Set<string>();
    const normalizedOrder: string[] = [];
    const missingPaths: string[] = [];

    existingOrder.forEach(pathValue => {
        const normalizedPath = normalizeTagPathValue(pathValue);
        if (normalizedPath.length === 0) {
            return;
        }
        if (seen.has(normalizedPath)) {
            return;
        }
        seen.add(normalizedPath);
        normalizedOrder.push(normalizedPath);
        if (!nodeMap.has(normalizedPath)) {
            missingPaths.push(normalizedPath);
        }
    });

    const appendedNodes = nodes
        .filter(node => !seen.has(node.path))
        .slice()
        .sort(fallbackComparator);

    appendedNodes.forEach(node => {
        if (!seen.has(node.path)) {
            seen.add(node.path);
            normalizedOrder.push(node.path);
        }
    });

    return {
        normalizedOrder,
        missingPaths
    };
}

/**
 * Hook that manages custom ordering of root-level tags.
 * Maintains order consistency as tags are created or deleted.
 */
export function useRootTagOrder({ settings, tagTree, comparator }: UseRootTagOrderParams): RootTagOrderState {
    const updateSettings = useSettingsUpdate();

    // Determine comparator for tag sorting (custom or natural)
    const fallbackComparator = useMemo(() => {
        if (comparator) {
            return comparator;
        }
        return (a: TagTreeNode, b: TagTreeNode) => naturalCompare(a.name, b.name);
    }, [comparator]);

    // Extract root tag nodes from the tag tree
    const rootTagNodes = useMemo(() => {
        if (!tagTree || tagTree.size === 0) {
            return [] as TagTreeNode[];
        }
        return Array.from(tagTree.values());
    }, [tagTree]);

    const hasCustomOrder = Array.isArray(settings.rootTagOrder) && settings.rootTagOrder.length > 0;

    // Normalize custom order to handle missing and new tags
    const normalization = useMemo<NormalizedTagOrder>(() => {
        if (!hasCustomOrder) {
            return { normalizedOrder: [], missingPaths: [] };
        }
        return normalizeRootTagOrder(settings.rootTagOrder, rootTagNodes, fallbackComparator);
    }, [fallbackComparator, hasCustomOrder, rootTagNodes, settings.rootTagOrder]);

    // Update settings when normalization changes to maintain consistency
    useEffect(() => {
        if (!hasCustomOrder) {
            return;
        }
        if (areStringArraysEqual(normalization.normalizedOrder, settings.rootTagOrder)) {
            return;
        }
        runAsyncAction(async () => {
            await updateSettings(current => {
                current.rootTagOrder = normalization.normalizedOrder;
            });
        });
    }, [hasCustomOrder, normalization.normalizedOrder, settings.rootTagOrder, updateSettings]);

    // Build order map for efficient position lookups during sorting
    const rootTagOrderMap = useMemo(() => {
        if (!hasCustomOrder) {
            return new Map<string, number>();
        }
        return createIndexMap(normalization.normalizedOrder);
    }, [hasCustomOrder, normalization.normalizedOrder]);

    const missingRootTagPaths = useMemo(() => {
        if (!hasCustomOrder) {
            return [];
        }
        return normalization.missingPaths;
    }, [hasCustomOrder, normalization.missingPaths]);

    return {
        rootTagOrderMap,
        missingRootTagPaths
    };
}
