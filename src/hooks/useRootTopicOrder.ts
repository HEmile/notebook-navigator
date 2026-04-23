import { useEffect, useMemo } from 'react';
import type { TopicNode } from '../types/storage';
import type { NotebookNavigatorSettings } from '../settings/types';
import { useSettingsUpdate } from '../context/SettingsContext';
import { areStringArraysEqual, createIndexMap } from '../utils/arrayUtils';
import { naturalCompare } from '../utils/sortUtils';

interface UseRootTopicOrderParams {
    settings: NotebookNavigatorSettings;
    topicGraph: Map<string, TopicNode> | null;
    comparator?: (a: TopicNode, b: TopicNode) => number;
}

export interface RootTopicOrderState {
    rootTopicOrderMap: Map<string, number>;
    missingRootTopicNames: string[];
}

interface NormalizedTopicOrder {
    normalizedOrder: string[];
    missingNames: string[];
}

function normalizeRootTopicOrder(
    existingOrder: string[],
    nodes: TopicNode[],
    fallbackComparator: (a: TopicNode, b: TopicNode) => number
): NormalizedTopicOrder {
    const nodeMap = new Map<string, TopicNode>();
    nodes.forEach(node => {
        nodeMap.set(node.name, node);
    });

    const seen = new Set<string>();
    const normalizedOrder: string[] = [];
    const missingNames: string[] = [];

    existingOrder.forEach(name => {
        if (!name || name.length === 0) {
            return;
        }
        if (seen.has(name)) {
            return;
        }
        seen.add(name);
        normalizedOrder.push(name);
        if (!nodeMap.has(name)) {
            missingNames.push(name);
        }
    });

    const appendedNodes = nodes
        .filter(node => !seen.has(node.name))
        .slice()
        .sort(fallbackComparator);

    appendedNodes.forEach(node => {
        if (!seen.has(node.name)) {
            seen.add(node.name);
            normalizedOrder.push(node.name);
        }
    });

    return { normalizedOrder, missingNames };
}

export function useRootTopicOrder({ settings, topicGraph, comparator }: UseRootTopicOrderParams): RootTopicOrderState {
    const updateSettings = useSettingsUpdate();

    const fallbackComparator = useMemo(() => {
        if (comparator) {
            return comparator;
        }
        return (a: TopicNode, b: TopicNode) => naturalCompare(a.name, b.name);
    }, [comparator]);

    const rootTopicNodes = useMemo(() => {
        if (!topicGraph || topicGraph.size === 0) {
            return [] as TopicNode[];
        }
        return Array.from(topicGraph.values()).filter(node => node.parents.size === 0);
    }, [topicGraph]);

    const hasCustomOrder = Array.isArray(settings.rootTopicOrder) && settings.rootTopicOrder.length > 0;

    const normalization = useMemo<NormalizedTopicOrder>(() => {
        if (!hasCustomOrder) {
            return { normalizedOrder: [], missingNames: [] };
        }
        return normalizeRootTopicOrder(settings.rootTopicOrder, rootTopicNodes, fallbackComparator);
    }, [fallbackComparator, hasCustomOrder, rootTopicNodes, settings.rootTopicOrder]);

    useEffect(() => {
        if (!hasCustomOrder) {
            return;
        }
        if (areStringArraysEqual(normalization.normalizedOrder, settings.rootTopicOrder)) {
            return;
        }
        void updateSettings(current => {
            current.rootTopicOrder = normalization.normalizedOrder;
        });
    }, [hasCustomOrder, normalization.normalizedOrder, settings.rootTopicOrder, updateSettings]);

    const rootTopicOrderMap = useMemo(() => {
        if (!hasCustomOrder) {
            return new Map<string, number>();
        }
        return createIndexMap(normalization.normalizedOrder);
    }, [hasCustomOrder, normalization.normalizedOrder]);

    const missingRootTopicNames = useMemo(() => {
        if (!hasCustomOrder) {
            return [];
        }
        return normalization.missingNames;
    }, [hasCustomOrder, normalization.missingNames]);

    return { rootTopicOrderMap, missingRootTopicNames };
}
