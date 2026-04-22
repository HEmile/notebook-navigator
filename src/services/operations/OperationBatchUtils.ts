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

import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import { strings } from '../../i18n';

const SAMPLE_FILE_LIMIT = 8;

export interface OperationUsageSummary {
    total: number;
    sample: string[];
}

/**
 * Yields control back to the event loop to prevent blocking UI during batch operations.
 * Uses requestAnimationFrame when available for smoother UI updates.
 */
export async function yieldToEventLoop(): Promise<void> {
    await new Promise<void>(resolve => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve());
            return;
        }
        setTimeout(resolve, 0);
    });
}

/**
 * Builds a usage summary from file paths.
 * Limits sample to 8 files for display in modals.
 */
export function buildUsageSummaryFromPaths(app: App, paths: Iterable<string>): OperationUsageSummary {
    const sample: string[] = [];
    let total = 0;

    for (const filePath of paths) {
        total += 1;
        if (sample.length >= SAMPLE_FILE_LIMIT) {
            continue;
        }
        const abstractFile = app.vault.getAbstractFileByPath(filePath);
        if (abstractFile instanceof TFile) {
            sample.push(abstractFile.basename);
        } else {
            sample.push(filePath);
        }
    }

    return { total, sample };
}

/**
 * Renders affected files preview list for operation confirmation and rename modals.
 */
export function renderAffectedFilesPreview(container: HTMLElement, usage: OperationUsageSummary): void {
    if (usage.sample.length === 0) {
        return;
    }

    const listContainer = container.createDiv('nn-tag-rename-file-preview');
    listContainer.createEl('h4', { text: strings.modals.tagOperation.affectedFiles });
    const list = listContainer.createEl('ul');
    usage.sample.forEach(fileName => {
        list.createEl('li', { text: fileName });
    });

    const remaining = usage.total - usage.sample.length;
    if (remaining > 0) {
        listContainer.createEl('p', {
            text: strings.modals.tagOperation.andMore.replace('{count}', remaining.toString())
        });
    }
}
