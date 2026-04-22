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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App, TFile } from 'obsidian';
import { PropertyFileMutations } from '../../../src/services/propertyOperations/PropertyFileMutations';
import { createTestTFile } from '../../utils/createTestTFile';

function createFile(path: string, frontmatter: Record<string, unknown>): TFile & { frontmatter: Record<string, unknown> } {
    return Object.assign(createTestTFile(path), { frontmatter });
}

describe('PropertyFileMutations', () => {
    let app: App;
    let fileMutations: PropertyFileMutations;

    beforeEach(() => {
        app = new App();
        app.fileManager.processFrontMatter = vi.fn((file: TFile, callback: (fm: Record<string, unknown>) => void) => {
            callback((file as unknown as { frontmatter: Record<string, unknown> }).frontmatter);
            return Promise.resolve();
        });

        fileMutations = new PropertyFileMutations(app);
    });

    it('renames property key and preserves value', async () => {
        const file = createFile('Note.md', { Status: 'todo', priority: 'high' });

        const changed = await fileMutations.renamePropertyKeyInFile(file, { oldKey: 'Status', newKeyDisplay: 'State' });

        expect(changed).toBe(true);
        expect(file.frontmatter).toEqual({ State: 'todo', priority: 'high' });
    });

    it('overwrites destination key variants when renaming', async () => {
        const file = createFile('Note.md', { Status: 'todo', state: 'done', State: 'later' });

        const changed = await fileMutations.renamePropertyKeyInFile(file, { oldKey: 'Status', newKeyDisplay: 'state' });

        expect(changed).toBe(true);
        expect(file.frontmatter).toEqual({ state: 'todo' });
    });

    it('deletes all key casing variants', async () => {
        const file = createFile('Note.md', { Status: 'todo', status: 'done', other: 1 });

        const changed = await fileMutations.deletePropertyKeyFromFile(file, 'status');

        expect(changed).toBe(true);
        expect(file.frontmatter).toEqual({ other: 1 });
    });

    it('returns false for non-markdown files', async () => {
        const file = createFile('Note.txt', { Status: 'todo' });

        const renamed = await fileMutations.renamePropertyKeyInFile(file, { oldKey: 'Status', newKeyDisplay: 'State' });
        const deleted = await fileMutations.deletePropertyKeyFromFile(file, 'status');

        expect(renamed).toBe(false);
        expect(deleted).toBe(false);
        expect(file.frontmatter).toEqual({ Status: 'todo' });
    });
});
