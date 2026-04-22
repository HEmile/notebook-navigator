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

import { PROPERTIES_ROOT_VIRTUAL_FOLDER_ID } from '../../types';
import { casefold } from '../../utils/recordUtils';
import {
    buildPropertyKeyNodeId,
    buildPropertyValueNodeId,
    normalizePropertyNodeId,
    normalizePropertyTreeValuePath,
    parsePropertyNodeId
} from '../../utils/propertyTree';
import type { PropertyNodeParts } from '../types';

/**
 * Property node helpers for building and parsing public property node ids.
 */
export class PropertyNodesAPI {
    readonly rootId = PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;

    buildKey(key: string): string | null {
        const normalizedKey = casefold(key);
        if (!normalizedKey) {
            return null;
        }

        return buildPropertyKeyNodeId(normalizedKey);
    }

    buildValue(key: string, valuePath: string): string | null {
        const normalizedKey = casefold(key);
        if (!normalizedKey) {
            return null;
        }

        const normalizedValuePath = normalizePropertyTreeValuePath(valuePath);
        if (!normalizedValuePath) {
            return null;
        }

        return buildPropertyValueNodeId(normalizedKey, normalizedValuePath);
    }

    parse(nodeId: string): PropertyNodeParts | null {
        if (nodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
            return {
                kind: 'root',
                key: null,
                valuePath: null
            };
        }

        const parsed = parsePropertyNodeId(nodeId);
        if (!parsed) {
            return null;
        }

        const normalizedKey = casefold(parsed.key);
        if (!normalizedKey) {
            return null;
        }

        const normalizedValuePath = parsed.valuePath ? normalizePropertyTreeValuePath(parsed.valuePath) : null;
        if (parsed.valuePath && !normalizedValuePath) {
            return null;
        }

        if (normalizedValuePath === null) {
            return {
                kind: 'key',
                key: normalizedKey,
                valuePath: null
            };
        }

        return {
            kind: 'value',
            key: normalizedKey,
            valuePath: normalizedValuePath
        };
    }

    normalize(nodeId: string): string | null {
        if (nodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
            return PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;
        }

        return normalizePropertyNodeId(nodeId);
    }
}
