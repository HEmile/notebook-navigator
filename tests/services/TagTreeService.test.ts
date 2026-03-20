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
import { TagTreeService } from '../../src/services/TagTreeService';
import type { TagTreeNode } from '../../src/types/storage';

function createTagNode(name: string, path: string, displayPath: string, notes: string[] = []): TagTreeNode {
    return {
        name,
        path,
        displayPath,
        children: new Map(),
        notesWithTag: new Set(notes)
    };
}

describe('TagTreeService', () => {
    it('reports whether the tree has indexed nodes', () => {
        const service = new TagTreeService();
        expect(service.hasNodes()).toBe(false);

        const root = createTagNode('Root', 'root', 'Root');
        service.updateTagTree(new Map([[root.path, root]]), 0, 0);

        expect(service.hasNodes()).toBe(true);
    });

    it('finds tag nodes by canonical path, hash-prefixed path, and case-insensitive path', () => {
        const service = new TagTreeService();
        const projects = createTagNode('Projects', 'projects', 'Projects');
        const client = createTagNode('Client', 'projects/client', 'Projects/Client');
        projects.children.set(client.path, client);

        service.updateTagTree(new Map([[projects.path, projects]]), 0, 0);

        expect(service.findTagNode('projects/client')).toBe(client);
        expect(service.findTagNode('#projects/client')).toBe(client);
        expect(service.findTagNode('#PROJECTS/CLIENT')).toBe(client);
        expect(service.findTagNode('missing/tag')).toBeNull();
    });

    it('finds and resolves tags across NFC and NFD-equivalent paths', () => {
        const service = new TagTreeService();
        const reunion = createTagNode('Réunion', 'réunion', 'Réunion');

        service.updateTagTree(new Map([[reunion.path, reunion]]), 0, 0);

        expect(service.findTagNode('re\u0301union')).toBe(reunion);
        expect(service.resolveSelectionTagPath('#re\u0301union/notes')).toBe('réunion');
    });

    it('resolves selected tag paths to canonical node or nearest existing parent', () => {
        const service = new TagTreeService();
        const projects = createTagNode('Projects', 'projects', 'Projects');
        const client = createTagNode('Client', 'projects/client', 'Projects/Client');
        projects.children.set(client.path, client);

        service.updateTagTree(new Map([[projects.path, projects]]), 0, 0);

        expect(service.resolveSelectionTagPath('#PROJECTS/CLIENT')).toBe('projects/client');
        expect(service.resolveSelectionTagPath('projects/client/unknown')).toBe('projects/client');
        expect(service.resolveSelectionTagPath('missing/tag')).toBeNull();
    });

    it('rebuilds lookup indexes and cached paths when tree data is replaced', () => {
        const service = new TagTreeService();

        const alpha = createTagNode('Alpha', 'alpha', 'Alpha');
        service.updateTagTree(new Map([[alpha.path, alpha]]), 1, 0);

        expect(service.getAllTagPaths()).toEqual(['alpha']);
        expect(service.findTagNode('alpha')).toBe(alpha);
        const mutatedPaths = service.getAllTagPaths();
        Array.prototype.push.call(mutatedPaths, 'mutated');
        expect(service.getAllTagPaths()).toEqual(['alpha']);

        const beta = createTagNode('Beta', 'beta', 'Beta');
        service.updateTagTree(new Map([[beta.path, beta]]), 1, 0);

        expect(service.getAllTagPaths()).toEqual(['beta']);
        expect(service.findTagNode('alpha')).toBeNull();
        expect(service.findTagNode('beta')).toBe(beta);
    });

    it('collects unique file paths from a tag and descendants', () => {
        const service = new TagTreeService();
        const root = createTagNode('Topics', 'topics', 'Topics', ['a.md', 'b.md']);
        const child = createTagNode('Ai', 'topics/ai', 'Topics/Ai', ['b.md', 'c.md']);
        root.children.set(child.path, child);

        service.updateTagTree(new Map([[root.path, root]]), 0, 0);

        const firstResult = service.collectTagFilePaths('topics');
        expect(new Set(firstResult)).toEqual(new Set(['a.md', 'b.md', 'c.md']));
        firstResult.push('mutated.md');
        expect(new Set(service.collectTagFilePaths('topics'))).toEqual(new Set(['a.md', 'b.md', 'c.md']));

        expect(service.collectTagFilePaths('unknown')).toEqual([]);
    });

    it('collects descendant tag paths without including the selected path', () => {
        const service = new TagTreeService();
        const topics = createTagNode('Topics', 'topics', 'Topics');
        const ai = createTagNode('Ai', 'topics/ai', 'Topics/Ai');
        const llm = createTagNode('Llm', 'topics/ai/llm', 'Topics/Ai/Llm');
        topics.children.set(ai.path, ai);
        ai.children.set(llm.path, llm);

        service.updateTagTree(new Map([[topics.path, topics]]), 0, 0);

        expect(service.collectDescendantTagPaths('topics')).toEqual(new Set(['topics/ai', 'topics/ai/llm']));
        expect(service.collectDescendantTagPaths('topics/ai')).toEqual(new Set(['topics/ai/llm']));
        expect(service.collectDescendantTagPaths('missing')).toEqual(new Set());
    });

    it('notifies listeners when the tree updates and stops after unsubscribe', () => {
        const service = new TagTreeService();
        const alpha = createTagNode('Alpha', 'alpha', 'Alpha');
        const beta = createTagNode('Beta', 'beta', 'Beta');
        let notifications = 0;

        const unsubscribe = service.addTreeUpdateListener(() => {
            notifications += 1;
        });

        service.updateTagTree(new Map([[alpha.path, alpha]]), 1, 0);
        expect(notifications).toBe(1);

        unsubscribe();

        service.updateTagTree(new Map([[beta.path, beta]]), 1, 0);
        expect(notifications).toBe(1);
    });
});
