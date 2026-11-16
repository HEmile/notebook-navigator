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
import { App, TFile } from 'obsidian';
import { getFilesForTopicByPath } from '../../src/utils/fileFinder';
import { TopicService } from '../../src/services/TopicGraphService';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { NotebookNavigatorSettings } from '../../src/settings/types';
import type { TopicNode } from '../../src/types/storage';

function node(name: string, paths: string[], children: TopicNode[] = []): TopicNode {
    return { name, parents: new Map(), children: new Map(children.map(child => [child.name, child])), notesWithTag: new Set(paths) };
}

function setup(hiddenFolders: string[] = []) {
    const optics = node('Optics', ['Notes/Lens.md']);
    const physics = node('Physics', ['Notes/Force.md', 'Archive/Old.md', 'Images/diagram.png'], [optics]);
    const service = new TopicService();
    service.updateTopicGraph(new Map([['Physics', physics]]));

    const files = new Map(['Notes/Lens.md', 'Notes/Force.md', 'Archive/Old.md', 'Images/diagram.png'].map(path => [path, new TFile(path)]));
    const app = new App();
    app.vault.getFileByPath = (path: string) => files.get(path) ?? null;

    const settings = structuredClone<NotebookNavigatorSettings>(DEFAULT_SETTINGS);
    settings.vaultProfiles[0].hiddenFolders = hiddenFolders;
    return { app, service, settings };
}

function paths(files: TFile[]): string[] {
    return files.map(file => file.path).sort();
}

describe('getFilesForTopicByPath', () => {
    it('follows the descendants toggle passed in, not the stored setting', () => {
        const { app, service, settings } = setup();
        settings.includeDescendantNotes = true;
        const options = { orderResults: false };

        expect(
            paths(
                getFilesForTopicByPath(
                    'Physics',
                    settings,
                    { includeDescendantNotes: false, showHiddenItems: false },
                    app,
                    service,
                    options
                )
            )
        ).toEqual(['Archive/Old.md', 'Notes/Force.md']);
        expect(
            paths(
                getFilesForTopicByPath('Physics', settings, { includeDescendantNotes: true, showHiddenItems: false }, app, service, options)
            )
        ).toEqual(['Archive/Old.md', 'Notes/Force.md', 'Notes/Lens.md']);
    });

    it('hides notes in hidden folders unless hidden items are shown', () => {
        const { app, service, settings } = setup(['Archive']);
        const options = { orderResults: false };

        expect(
            paths(
                getFilesForTopicByPath(
                    'Physics',
                    settings,
                    { includeDescendantNotes: false, showHiddenItems: false },
                    app,
                    service,
                    options
                )
            )
        ).toEqual(['Notes/Force.md']);
        expect(
            paths(
                getFilesForTopicByPath('Physics', settings, { includeDescendantNotes: false, showHiddenItems: true }, app, service, options)
            )
        ).toEqual(['Archive/Old.md', 'Notes/Force.md']);
    });

    it('lists only markdown notes, and nothing for unknown paths', () => {
        const { app, service, settings } = setup();
        const visibility = { includeDescendantNotes: false, showHiddenItems: true };
        expect(paths(getFilesForTopicByPath('Physics', settings, visibility, app, service, { orderResults: false }))).not.toContain(
            'Images/diagram.png'
        );
        expect(getFilesForTopicByPath('Nope', settings, visibility, app, service)).toEqual([]);
    });
});
