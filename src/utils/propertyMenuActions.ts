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

import type { NotebookNavigatorSettings } from '../settings';
import type { PropertyTreeService } from '../services/PropertyTreeService';
import { getDBInstanceOrNull } from '../storage/fileOperations';
import type { PropertyTreeNode, PropertyTreeNodeId } from '../types/storage';
import { getDirectPropertyKeyFilePathSet, normalizePropertyTreeValuePath } from './propertyTree';
import { casefold } from './recordUtils';
import { naturalCompare } from './sortUtils';
import { getActiveVaultProfile } from './vaultProfiles';

export interface FileMenuPropertyAction {
    nodeId: PropertyTreeNodeId;
    keyNodeId: PropertyTreeNodeId;
    label: string;
}

/**
 * Caches whether a key node has at least one direct boolean true value.
 */
const booleanTrueKeyNodeCache = new WeakMap<PropertyTreeNode, boolean>();

/**
 * Returns whether the key node has a direct boolean true entry.
 */
function keyNodeHasBooleanTrueValue(keyNode: PropertyTreeNode): boolean {
    const cached = booleanTrueKeyNodeCache.get(keyNode);
    if (cached !== undefined) {
        return cached;
    }

    const directPaths = getDirectPropertyKeyFilePathSet(keyNode);
    if (directPaths.size === 0) {
        booleanTrueKeyNodeCache.set(keyNode, false);
        return false;
    }

    const db = getDBInstanceOrNull();
    if (!db) {
        booleanTrueKeyNodeCache.set(keyNode, false);
        return false;
    }

    const normalizedKey = keyNode.key;
    for (const path of directPaths) {
        const fileData = db.getFile(path);
        const properties = fileData?.properties;
        if (!properties) {
            continue;
        }

        for (const entry of properties) {
            if (casefold(entry.fieldKey) !== normalizedKey) {
                continue;
            }

            if (entry.valueKind !== undefined && entry.valueKind !== 'boolean') {
                continue;
            }

            if (normalizePropertyTreeValuePath(entry.value) === 'true') {
                booleanTrueKeyNodeCache.set(keyNode, true);
                return true;
            }
        }
    }

    booleanTrueKeyNodeCache.set(keyNode, false);
    return false;
}

/**
 * Collects property actions configured for the file context menu.
 */
export function collectFileMenuPropertyActions(
    settings: NotebookNavigatorSettings,
    propertyTreeService: PropertyTreeService | null
): FileMenuPropertyAction[] {
    const profile = getActiveVaultProfile(settings);
    const configuredKeys = Array.isArray(profile.propertyKeys) ? profile.propertyKeys : [];
    const enabledKeys: { normalizedKey: string; displayKey: string }[] = [];
    const seenKeys = new Set<string>();

    configuredKeys.forEach(entry => {
        if (!entry.showInFileMenu) {
            return;
        }

        const displayKey = entry.key.trim();
        const normalizedKey = casefold(displayKey);
        if (!displayKey || !normalizedKey || seenKeys.has(normalizedKey)) {
            return;
        }

        seenKeys.add(normalizedKey);
        enabledKeys.push({ normalizedKey, displayKey });
    });

    if (enabledKeys.length === 0) {
        return [];
    }

    const actions: FileMenuPropertyAction[] = [];
    enabledKeys.forEach(({ normalizedKey, displayKey }) => {
        const keyNode = propertyTreeService?.getKeyNode(normalizedKey) ?? null;
        if (!keyNode) {
            return;
        }

        const keyLabel = (keyNode.name.trim() || displayKey).trim();
        const hasBooleanTrueValue = keyNodeHasBooleanTrueValue(keyNode);
        const valueNodes = Array.from(keyNode.children.values()).filter(node => node.kind === 'value' && node.name.trim().length > 0);

        if (!hasBooleanTrueValue && valueNodes.length === 0) {
            return;
        }

        if (hasBooleanTrueValue) {
            actions.push({
                nodeId: keyNode.id,
                keyNodeId: keyNode.id,
                label: `${keyLabel}: true`
            });
        }

        valueNodes.sort((left, right) => {
            const compare = naturalCompare(left.name, right.name);
            if (compare !== 0) {
                return compare;
            }
            return left.name.localeCompare(right.name);
        });

        valueNodes.forEach(node => {
            const valueLabel = node.name.trim();
            actions.push({
                nodeId: node.id,
                keyNodeId: keyNode.id,
                label: `${keyLabel}: ${valueLabel}`
            });
        });
    });

    const deduped: FileMenuPropertyAction[] = [];
    const seenNodeIds = new Set<string>();
    actions.forEach(action => {
        // Keeps one menu action per canonical property node id.
        if (seenNodeIds.has(action.nodeId)) {
            return;
        }
        seenNodeIds.add(action.nodeId);
        deduped.push(action);
    });

    return deduped;
}
