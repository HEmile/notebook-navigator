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

import { describe, expect, it } from 'vitest';

import type { PropertyTreeNode, TagTreeNode } from '../../src/types/storage';
import { buildRainbowPalette, parseCssColor } from '../../src/utils/colorUtils';
import { buildFileItemPropertyRainbowColors, buildFileItemTagRainbowColors } from '../../src/utils/fileItemPillDecoration';

function createPalette(): string[] {
    const start = parseCssColor('#000000') ?? { r: 0, g: 0, b: 0, a: 1 };
    const end = parseCssColor('#ffffff') ?? { r: 255, g: 255, b: 255, a: 1 };
    return buildRainbowPalette({ steps: 1024, start, end, style: 'rgb' });
}

function createTagNode(path: string, children: TagTreeNode[] = []): TagTreeNode {
    const node: TagTreeNode = {
        name: path.split('/').pop() ?? path,
        path,
        displayPath: path,
        children: new Map(),
        notesWithTag: new Set()
    };
    children.forEach(child => {
        node.children.set(child.name.toLowerCase(), child);
    });
    return node;
}

function createPropertyNode(params: {
    id: `key:${string}` | `key:${string}=${string}`;
    kind: 'key' | 'value';
    key: string;
    valuePath: string | null;
    name: string;
    children?: PropertyTreeNode[];
}): PropertyTreeNode {
    const node: PropertyTreeNode = {
        id: params.id,
        kind: params.kind,
        key: params.key,
        valuePath: params.valuePath,
        name: params.name,
        displayPath: params.name,
        children: new Map(),
        notesWithValue: new Set()
    };
    params.children?.forEach(child => {
        node.children.set(child.valuePath ?? child.key, child);
    });
    return node;
}

describe('fileItemPillDecoration', () => {
    it('builds tag colors for descendant tags without depending on expanded nav rows', () => {
        const palette = createPalette();
        const childNode = createTagNode('alpha/child');
        const rootNode = createTagNode('alpha', [childNode]);
        const colors = buildFileItemTagRainbowColors({
            visibleTagTree: new Map([['alpha', rootNode]]),
            rootTagOrderMap: new Map(),
            tagComparator: undefined,
            palette,
            scope: 'child',
            showAllTagsFolder: false,
            inheritColors: false
        });

        expect(colors.colorsByPath.has('alpha')).toBe(false);
        expect(colors.colorsByPath.get('alpha/child')).toBe(palette[0]);
    });

    it('builds property value colors without depending on expanded navigation keys', () => {
        const palette = createPalette();
        const doneNode = createPropertyNode({
            id: 'key:status=done',
            kind: 'value',
            key: 'status',
            valuePath: 'done',
            name: 'done'
        });
        const todoNode = createPropertyNode({
            id: 'key:status=todo',
            kind: 'value',
            key: 'status',
            valuePath: 'todo',
            name: 'todo'
        });
        const keyNode = createPropertyNode({
            id: 'key:status',
            kind: 'key',
            key: 'status',
            valuePath: null,
            name: 'status',
            children: [doneNode, todoNode]
        });
        const colors = buildFileItemPropertyRainbowColors({
            propertyTree: new Map([['status', keyNode]]),
            visiblePropertyNavigationKeySet: new Set(['status']),
            rootPropertyOrderMap: new Map(),
            propertyKeyComparator: (a, b) => a.key.localeCompare(b.key),
            palette,
            scope: 'child',
            showAllPropertiesFolder: false,
            propertySortOrder: 'alpha-asc',
            includeDescendantNotes: false
        });

        expect(colors.colorsByNodeId.has('key:status')).toBe(false);
        expect(colors.colorsByNodeId.get('key:status=done')).toBe(palette[0]);
        expect(colors.colorsByNodeId.get('key:status=todo')).toBe(palette[palette.length - 1]);
    });
});
