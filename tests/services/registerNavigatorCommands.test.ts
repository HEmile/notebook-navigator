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

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

interface CommandShape {
    id: string;
    checkable: boolean;
}

async function readRepoFile(relativePath: string): Promise<string> {
    return readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

function expandShortcutCommandShapes(checkable: boolean): CommandShape[] {
    return Array.from({ length: 9 }, (_unused, index) => ({
        id: `open-shortcut-${index + 1}`,
        checkable
    }));
}

function parseRegisteredCommandSpecs(source: string): Map<string, boolean> {
    const specs = new Map<string, boolean>();
    const specPattern = /\{\s*id:\s*'([^']+)'([^}]*)\}/gu;

    for (const match of source.matchAll(specPattern)) {
        const id = match[1];
        const body = match[2] ?? '';
        specs.set(id, /checkable:\s*true/u.test(body));
    }

    expandShortcutCommandShapes(true).forEach(command => specs.set(command.id, command.checkable));
    return specs;
}

function parseHandlerCommandShapes(source: string): Map<string, boolean> {
    const handlers = new Map<string, boolean>();
    const commandBlockPattern = /plugin\.addCommand\(\{([\s\S]*?)\n\s*\}\);/gu;

    for (const match of source.matchAll(commandBlockPattern)) {
        const block = match[1] ?? '';
        const checkable = /checkCallback\s*:/u.test(block);
        const literalId = /id:\s*'([^']+)'/u.exec(block)?.[1];

        if (literalId) {
            handlers.set(literalId, checkable);
            continue;
        }

        if (/id:\s*`open-shortcut-\$\{shortcutNumber\}`/u.test(block)) {
            expandShortcutCommandShapes(checkable).forEach(command => handlers.set(command.id, command.checkable));
        }
    }

    const quickProfilePattern = /registerQuickProfileCommand\('([^']+)'/gu;
    for (const match of source.matchAll(quickProfilePattern)) {
        handlers.set(match[1], false);
    }

    return handlers;
}

function compareCommandShapes(specs: Map<string, boolean>, handlers: Map<string, boolean>): string[] {
    const failures: string[] = [];

    for (const [id, checkable] of specs) {
        const handlerCheckable = handlers.get(id);
        if (handlerCheckable === undefined) {
            failures.push(`${id}: missing handler`);
            continue;
        }

        if (handlerCheckable !== checkable) {
            failures.push(
                `${id}: wrapper=${checkable ? 'checkCallback' : 'callback'} handler=${handlerCheckable ? 'checkCallback' : 'callback'}`
            );
        }
    }

    for (const id of handlers.keys()) {
        if (!specs.has(id)) {
            failures.push(`${id}: missing wrapper metadata`);
        }
    }

    return failures.sort();
}

describe('registerNavigatorCommands', () => {
    it('keeps lazy command metadata in sync with command handlers', async () => {
        const [registrationSource, handlerSource] = await Promise.all([
            readRepoFile('src/services/commands/registerNavigatorCommands.ts'),
            readRepoFile('src/services/commands/navigatorCommandHandlers.ts')
        ]);

        const specs = parseRegisteredCommandSpecs(registrationSource);
        const handlers = parseHandlerCommandShapes(handlerSource);

        expect(compareCommandShapes(specs, handlers)).toEqual([]);
    });
});
