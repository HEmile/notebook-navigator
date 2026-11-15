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
import { TFile, type App } from 'obsidian';
import { addTopicLinkToFrontmatter, type AddTopicLinkResult } from './topicFrontmatter';
import { getTopicNameFromPath } from './topicGraph';

/** Fork: drag payload type for a topic row */
export const TOPIC_DRAG_MIME = 'application/x-notebook-navigator-topic';

export interface LinkFilesToTopicResult {
    linked: number;
    alreadyLinked: number;
    unsupported: number;
    skipped: number;
    failed: number;
}

/**
 * Fork: links dropped notes to a topic by adding `hasTopic: ["[[Topic]]"]` to their frontmatter. Each path is
 * handled once. Folders, missing files, non-markdown files and the topic's own note are skipped, so a note can
 * never link to itself. Frontmatter is changed through Obsidian's processFrontMatter with addTopicLinkToFrontmatter,
 * which never overwrites a value it does not understand. A failure on one note does not stop the others.
 */
export async function linkFilesToTopic(app: App, paths: readonly string[], topicName: string): Promise<LinkFilesToTopicResult> {
    const result: LinkFilesToTopicResult = { linked: 0, alreadyLinked: 0, unsupported: 0, skipped: 0, failed: 0 };
    const lowerTopicName = topicName.trim().toLowerCase();

    for (const path of new Set(paths)) {
        const file = app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile) || file.extension !== 'md' || getTopicNameFromPath(file.path).toLowerCase() === lowerTopicName) {
            result.skipped++;
            continue;
        }

        // Set inside the callback, so it lives in an object TypeScript does not narrow
        const state: { outcome: AddTopicLinkResult } = { outcome: 'invalid-name' };
        try {
            await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
                state.outcome = addTopicLinkToFrontmatter(frontmatter, topicName);
            });
        } catch (error) {
            console.error('[Notebook Navigator] Failed to link note to topic', path, error);
            result.failed++;
            continue;
        }

        if (state.outcome === 'added') {
            result.linked++;
        } else if (state.outcome === 'already-linked') {
            result.alreadyLinked++;
        } else if (state.outcome === 'unsupported-value') {
            result.unsupported++;
        } else {
            result.skipped++;
        }
    }
    return result;
}
