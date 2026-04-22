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
import { PROPERTIES_ROOT_VIRTUAL_FOLDER_ID } from '../../src/types';
import { PropertyTreeService } from '../../src/services/PropertyTreeService';
import type { PropertyTreeNode } from '../../src/types/storage';
import { buildPropertyKeyNodeId, buildPropertyValueNodeId } from '../../src/utils/propertyTree';

function createKeyNode(key: string, name: string, notes: string[]): PropertyTreeNode {
    return {
        id: buildPropertyKeyNodeId(key),
        kind: 'key',
        key,
        valuePath: null,
        name,
        displayPath: name,
        children: new Map(),
        notesWithValue: new Set(notes)
    };
}

function createValueNode(key: string, valuePath: string, displayPath: string, notes: string[]): PropertyTreeNode {
    return {
        id: buildPropertyValueNodeId(key, valuePath),
        kind: 'value',
        key,
        valuePath,
        name: displayPath,
        displayPath,
        children: new Map(),
        notesWithValue: new Set(notes)
    };
}

describe('PropertyTreeService', () => {
    it('indexes property nodes by id and by key', () => {
        const service = new PropertyTreeService();
        const statusKey = createKeyNode('status', 'Status', ['a.md', 'b.md']);
        const statusDone = createValueNode('status', 'work/done', 'Work/Done', ['b.md']);
        statusKey.children.set(statusDone.id, statusDone);

        service.updatePropertyTree(new Map([[statusKey.key, statusKey]]));

        expect(service.hasNodes()).toBe(true);
        expect(service.findNode(statusKey.id)).toBe(statusKey);
        expect(service.findNode(statusDone.id)).toBe(statusDone);
        expect(service.getKeyNode('status')).toBe(statusKey);
        expect(service.findNode('key:missing')).toBeNull();
        expect(service.getKeyNode('missing')).toBeNull();
    });

    it('collects descendant ids and returns independent sets', () => {
        const service = new PropertyTreeService();
        const statusKey = createKeyNode('status', 'Status', ['a.md', 'b.md', 'c.md']);
        const work = createValueNode('status', 'work', 'Work', ['b.md']);
        const done = createValueNode('status', 'work/done', 'Work/Done', ['c.md']);
        statusKey.children.set(work.id, work);
        statusKey.children.set(done.id, done);

        service.updatePropertyTree(new Map([[statusKey.key, statusKey]]));

        const first = service.collectDescendantNodeIds(statusKey.id);
        expect(first).toEqual(new Set([work.id, done.id]));

        first.add('mutated');
        const second = service.collectDescendantNodeIds(statusKey.id);
        expect(second).toEqual(new Set([work.id, done.id]));
    });

    it('collects key and value file paths with and without descendants', () => {
        const service = new PropertyTreeService();
        const statusKey = createKeyNode('status', 'Status', ['a.md', 'b.md', 'c.md']);
        const work = createValueNode('status', 'work', 'Work', ['b.md']);
        const done = createValueNode('status', 'work/done', 'Work/Done', ['c.md']);
        statusKey.children.set(work.id, work);
        statusKey.children.set(done.id, done);

        service.updatePropertyTree(new Map([[statusKey.key, statusKey]]));

        expect(service.collectFilePaths(statusKey.id, false)).toEqual(new Set(['a.md']));
        expect(service.collectFilePaths(statusKey.id, true)).toEqual(new Set(['a.md', 'b.md', 'c.md']));
        expect(service.collectFilePaths(work.id, false)).toEqual(new Set(['b.md']));
        expect(service.collectFilePaths(work.id, true)).toEqual(new Set(['b.md']));
        expect(service.collectFilePaths('key:missing', true)).toEqual(new Set());
    });

    it('collects file paths across normalized keys', () => {
        const service = new PropertyTreeService();
        const statusKey = createKeyNode('status', 'Status', ['a.md', 'b.md']);
        const priorityKey = createKeyNode('priority', 'Priority', ['b.md', 'c.md']);

        service.updatePropertyTree(
            new Map([
                [statusKey.key, statusKey],
                [priorityKey.key, priorityKey]
            ])
        );

        expect(service.collectFilesForKeys(['status', 'priority', 'missing'])).toEqual(new Set(['a.md', 'b.md', 'c.md']));
    });

    it('resolves selection ids against the current property tree', () => {
        const service = new PropertyTreeService();
        const statusKey = createKeyNode('status', 'Status', ['a.md', 'b.md']);
        const done = createValueNode('status', 'work/done', 'Work/Done', ['b.md']);
        statusKey.children.set(done.id, done);
        service.updatePropertyTree(new Map([[statusKey.key, statusKey]]));

        const missingValueId = buildPropertyValueNodeId('status', 'work/open');
        const missingKeyId = buildPropertyKeyNodeId('priority');

        expect(service.resolveSelectionNodeId(PROPERTIES_ROOT_VIRTUAL_FOLDER_ID)).toBe(PROPERTIES_ROOT_VIRTUAL_FOLDER_ID);
        expect(service.resolveSelectionNodeId(done.id)).toBe(done.id);
        expect(service.resolveSelectionNodeId(missingValueId)).toBe(statusKey.id);
        expect(service.resolveSelectionNodeId(missingKeyId)).toBe(PROPERTIES_ROOT_VIRTUAL_FOLDER_ID);
    });

    it('notifies listeners on updates and stops notifying after unsubscribe', () => {
        const service = new PropertyTreeService();
        let notifications = 0;

        const unsubscribe = service.addTreeUpdateListener(() => {
            notifications += 1;
        });

        const statusKey = createKeyNode('status', 'Status', []);
        const priorityKey = createKeyNode('priority', 'Priority', []);

        service.updatePropertyTree(new Map([[statusKey.key, statusKey]]));
        expect(notifications).toBe(1);

        unsubscribe();

        service.updatePropertyTree(new Map([[priorityKey.key, priorityKey]]));
        expect(notifications).toBe(1);
    });
});
