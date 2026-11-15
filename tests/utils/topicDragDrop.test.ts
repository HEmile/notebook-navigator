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
import { describe, expect, it } from 'vitest';
import { App, TFile, TFolder } from 'obsidian';
import { linkFilesToTopic } from '../../src/utils/topicDragDrop';

/** A vault whose processFrontMatter round-trips through JSON like a YAML write, and fails for broken notes */
function createVault(notes: Record<string, Record<string, unknown> | 'broken-yaml'>, extraEntries: Record<string, TFile | TFolder> = {}) {
    const store = new Map<string, Record<string, unknown> | 'broken-yaml'>(Object.entries(notes));
    const files = new Map<string, TFile | TFolder>(Object.keys(notes).map(path => [path, new TFile(path)]));
    Object.entries(extraEntries).forEach(([path, entry]) => files.set(path, entry));
    const app = new App();
    app.vault.getAbstractFileByPath = (path: string) => files.get(path) ?? null;
    app.fileManager.processFrontMatter = async (file: TFile, fn: (frontmatter: Record<string, unknown>) => void) => {
        const current = store.get(file.path);
        if (current === 'broken-yaml') {
            throw new Error('YAML parse error');
        }
        const frontmatter = JSON.parse(JSON.stringify(current ?? {})) as Record<string, unknown>;
        fn(frontmatter);
        store.set(file.path, JSON.parse(JSON.stringify(frontmatter)) as Record<string, unknown>);
    };
    return { app, store };
}

describe('linkFilesToTopic', () => {
    it('links plain notes and leaves the rest of their frontmatter as it was', async () => {
        const { app, store } = createVault({
            'Notes/Lens.md': {},
            'Notes/Prism.md': { tags: ['idea'], created: '2026-01-01', hasTopic: ['[[Physics]]'] }
        });

        const result = await linkFilesToTopic(app, ['Notes/Lens.md', 'Notes/Prism.md'], 'Optics');

        expect(result).toEqual({ linked: 2, alreadyLinked: 0, unsupported: 0, skipped: 0, failed: 0 });
        expect(store.get('Notes/Lens.md')).toEqual({ hasTopic: ['[[Optics]]'] });
        expect(store.get('Notes/Prism.md')).toEqual({ tags: ['idea'], created: '2026-01-01', hasTopic: ['[[Physics]]', '[[Optics]]'] });
    });

    it('does not touch notes already linked through any topic relation', async () => {
        const original = { subset: ['[[Optics|light]]'], author: 'x' };
        const { app, store } = createVault({ 'Notes/Lens.md': original });

        const result = await linkFilesToTopic(app, ['Notes/Lens.md'], 'Optics');

        expect(result.alreadyLinked).toBe(1);
        expect(store.get('Notes/Lens.md')).toEqual(original);
    });

    it('never overwrites a hasTopic value it does not understand', async () => {
        const { app, store } = createVault({ 'Notes/Lens.md': { hasTopic: 7 }, 'Notes/Map.md': { hasTopic: { a: 1 } } });

        const result = await linkFilesToTopic(app, ['Notes/Lens.md', 'Notes/Map.md'], 'Optics');

        expect(result.unsupported).toBe(2);
        expect(store.get('Notes/Lens.md')).toEqual({ hasTopic: 7 });
        expect(store.get('Notes/Map.md')).toEqual({ hasTopic: { a: 1 } });
    });

    it('skips folders, missing paths, other file types and the topic note itself', async () => {
        const { app, store } = createVault(
            { 'Topics/Optics.md': { tags: ['topic'] }, 'Notes/Lens.md': {} },
            { 'Images/lens.png': new TFile('Images/lens.png'), Notes: new TFolder('Notes') }
        );

        const result = await linkFilesToTopic(app, ['Topics/Optics.md', 'Images/lens.png', 'Notes', 'Gone.md', 'Notes/Lens.md'], 'optics');

        expect(result).toEqual({ linked: 1, alreadyLinked: 0, unsupported: 0, skipped: 4, failed: 0 });
        expect(store.get('Topics/Optics.md')).toEqual({ tags: ['topic'] });
    });

    it('keeps going when one note cannot be written', async () => {
        const { app, store } = createVault({ 'Notes/Broken.md': 'broken-yaml', 'Notes/Lens.md': {} });

        const result = await linkFilesToTopic(app, ['Notes/Broken.md', 'Notes/Lens.md'], 'Optics');

        expect(result.failed).toBe(1);
        expect(result.linked).toBe(1);
        expect(store.get('Notes/Broken.md')).toBe('broken-yaml');
        expect(store.get('Notes/Lens.md')).toEqual({ hasTopic: ['[[Optics]]'] });
    });

    it('handles a path dropped twice once, and a second drop adds nothing', async () => {
        const { app, store } = createVault({ 'Notes/Lens.md': {} });

        const first = await linkFilesToTopic(app, ['Notes/Lens.md', 'Notes/Lens.md'], 'Optics');
        const second = await linkFilesToTopic(app, ['Notes/Lens.md'], 'Optics');

        expect(first.linked).toBe(1);
        expect(second.alreadyLinked).toBe(1);
        expect(store.get('Notes/Lens.md')).toEqual({ hasTopic: ['[[Optics]]'] });
    });

    it('refuses topic names that cannot be written as a link', async () => {
        const { app, store } = createVault({ 'Notes/Lens.md': { title: 'Lens' } });

        const result = await linkFilesToTopic(app, ['Notes/Lens.md'], 'A|B');

        expect(result.skipped).toBe(1);
        expect(store.get('Notes/Lens.md')).toEqual({ title: 'Lens' });
    });
});
