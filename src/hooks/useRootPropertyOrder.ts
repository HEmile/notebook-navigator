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
import type { NotebookNavigatorSettings } from '../settings/types';
import { useSettingsUpdate } from '../context/SettingsContext';
import { areStringArraysEqual, createIndexMap } from '../utils/arrayUtils';
import { runAsyncAction } from '../utils/async';
import { casefold } from '../utils/recordUtils';
import { naturalCompare } from '../utils/sortUtils';
import type { PropertyTreeNode } from '../types/storage';

interface UseRootPropertyOrderParams {
    settings: NotebookNavigatorSettings;
    propertyTree: Map<string, PropertyTreeNode> | null;
    comparator?: (a: PropertyTreeNode, b: PropertyTreeNode) => number;
}

interface RootPropertyOrderState {
    rootPropertyOrderMap: Map<string, number>;
    missingRootPropertyKeys: string[];
}

interface NormalizedPropertyOrder {
    normalizedOrder: string[];
    missingKeys: string[];
}

function comparePropertyKeysAlphabetically(a: PropertyTreeNode, b: PropertyTreeNode): number {
    const nameCompare = naturalCompare(a.name, b.name);
    if (nameCompare !== 0) {
        return nameCompare;
    }
    return a.key.localeCompare(b.key);
}

function normalizeRootPropertyOrder(
    existingOrder: string[],
    nodes: PropertyTreeNode[],
    fallbackComparator: (a: PropertyTreeNode, b: PropertyTreeNode) => number
): NormalizedPropertyOrder {
    const nodeMap = new Map<string, PropertyTreeNode>();
    nodes.forEach(node => {
        nodeMap.set(node.key, node);
    });

    const seen = new Set<string>();
    const normalizedOrder: string[] = [];
    const missingKeys: string[] = [];

    existingOrder.forEach(entry => {
        const normalizedKey = casefold(entry);
        if (!normalizedKey) {
            return;
        }
        if (seen.has(normalizedKey)) {
            return;
        }
        seen.add(normalizedKey);
        normalizedOrder.push(normalizedKey);
        if (!nodeMap.has(normalizedKey)) {
            missingKeys.push(normalizedKey);
        }
    });

    const appendedNodes = nodes
        .filter(node => !seen.has(node.key))
        .slice()
        .sort(fallbackComparator);

    appendedNodes.forEach(node => {
        if (!seen.has(node.key)) {
            seen.add(node.key);
            normalizedOrder.push(node.key);
        }
    });

    return {
        normalizedOrder,
        missingKeys
    };
}

export function useRootPropertyOrder({ settings, propertyTree, comparator }: UseRootPropertyOrderParams): RootPropertyOrderState {
    const updateSettings = useSettingsUpdate();

    const fallbackComparator = useMemo(() => {
        if (comparator) {
            return comparator;
        }
        return comparePropertyKeysAlphabetically;
    }, [comparator]);

    const rootPropertyNodes = useMemo(() => {
        if (!propertyTree || propertyTree.size === 0) {
            return [] as PropertyTreeNode[];
        }
        return Array.from(propertyTree.values());
    }, [propertyTree]);

    const hasCustomOrder = Array.isArray(settings.rootPropertyOrder) && settings.rootPropertyOrder.length > 0;

    const normalization = useMemo<NormalizedPropertyOrder>(() => {
        if (!hasCustomOrder) {
            return { normalizedOrder: [], missingKeys: [] };
        }
        return normalizeRootPropertyOrder(settings.rootPropertyOrder, rootPropertyNodes, fallbackComparator);
    }, [fallbackComparator, hasCustomOrder, rootPropertyNodes, settings.rootPropertyOrder]);

    useEffect(() => {
        if (!hasCustomOrder) {
            return;
        }
        if (areStringArraysEqual(normalization.normalizedOrder, settings.rootPropertyOrder)) {
            return;
        }
        runAsyncAction(async () => {
            await updateSettings(current => {
                current.rootPropertyOrder = normalization.normalizedOrder;
            });
        });
    }, [hasCustomOrder, normalization.normalizedOrder, settings.rootPropertyOrder, updateSettings]);

    const rootPropertyOrderMap = useMemo(() => {
        if (!hasCustomOrder) {
            return new Map<string, number>();
        }
        return createIndexMap(normalization.normalizedOrder);
    }, [hasCustomOrder, normalization.normalizedOrder]);

    const missingRootPropertyKeys = useMemo(() => {
        if (!hasCustomOrder) {
            return [];
        }
        return normalization.missingKeys;
    }, [hasCustomOrder, normalization.missingKeys]);

    return {
        rootPropertyOrderMap,
        missingRootPropertyKeys
    };
}
