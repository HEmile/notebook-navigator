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
import { fileMatchesFilterTokens, parseFilterSearchTokens, updateFilterQueryWithProperty } from '../src/utils/filterSearch';
import { foldSearchText } from '../src/utils/recordUtils';

describe('filterSearch property tokenization', () => {
    it('keeps quoted property values in one token', () => {
        const tokens = parseFilterSearchTokens('.status="In Progress"');
        expect(tokens.propertyTokens).toEqual([{ key: 'status', value: 'in progress' }]);
        expect(tokens.nameTokens).toEqual([]);
    });

    it('parses quoted property keys with whitespace', () => {
        const tokens = parseFilterSearchTokens('."Reading Status"="In Progress"');
        expect(tokens.propertyTokens).toEqual([{ key: 'reading status', value: 'in progress' }]);
        expect(tokens.nameTokens).toEqual([]);
    });

    it('supports escaped quotes and round-trips query mutation', () => {
        const parsed = parseFilterSearchTokens('.status="He said \\"ok\\""');
        expect(parsed.propertyTokens).toEqual([{ key: 'status', value: 'he said "ok"' }]);

        const added = updateFilterQueryWithProperty('', 'status', 'He said "ok"', 'AND');
        expect(added.query).toBe('.status="he said \\"ok\\""');
        expect(added.action).toBe('added');
        expect(added.changed).toBe(true);

        const removed = updateFilterQueryWithProperty(added.query, 'status', 'He said "ok"', 'AND');
        expect(removed.query).toBe('');
        expect(removed.action).toBe('removed');
        expect(removed.changed).toBe(true);
    });

    it('parses escaped "=" in property keys and values', () => {
        const tokens = parseFilterSearchTokens('."Status\\=Phase"="In\\=Progress"');
        expect(tokens.propertyTokens).toEqual([{ key: 'status=phase', value: 'in=progress' }]);
        expect(tokens.nameTokens).toEqual([]);
    });
});

describe('filterSearch property parsing', () => {
    it('parses include and exclude property tokens in filter mode', () => {
        const includeTokens = parseFilterSearchTokens('.status');
        expect(includeTokens.mode).toBe('tag');
        expect(includeTokens.propertyTokens).toEqual([{ key: 'status', value: null }]);

        const excludeTokens = parseFilterSearchTokens('-.flag=internal');
        expect(excludeTokens.mode).toBe('tag');
        expect(excludeTokens.excludePropertyTokens).toEqual([{ key: 'flag', value: 'internal' }]);
    });

    it('supports expression mode with tag and property operands', () => {
        const tokens = parseFilterSearchTokens('#work AND .status=started');
        expect(tokens.mode).toBe('tag');
        expect(tokens.requiresProperties).toBe(true);
        expect(tokens.expression.length).toBeGreaterThan(0);
    });
});

describe('filterSearch property evaluation', () => {
    it('matches key-only and value tokens', () => {
        const keyOnlyTokens = parseFilterSearchTokens('.status');
        const valueTokens = parseFilterSearchTokens('.status=work');

        const statusProperties = new Map<string, string[]>([['status', ['work/finished']]]);
        const exactStatusProperties = new Map<string, string[]>([['status', ['work']]]);
        const noProperties = new Map<string, string[]>();

        expect(
            fileMatchesFilterTokens('note', [], keyOnlyTokens, { hasUnfinishedTasks: false, propertyValuesByKey: statusProperties })
        ).toBe(true);
        expect(
            fileMatchesFilterTokens('note', [], keyOnlyTokens, {
                hasUnfinishedTasks: false,
                propertyValuesByKey: new Map<string, string[]>([['status', []]])
            })
        ).toBe(true);
        expect(fileMatchesFilterTokens('note', [], keyOnlyTokens, { hasUnfinishedTasks: false, propertyValuesByKey: noProperties })).toBe(
            false
        );

        expect(fileMatchesFilterTokens('note', [], valueTokens, { hasUnfinishedTasks: false, propertyValuesByKey: statusProperties })).toBe(
            false
        );
        expect(
            fileMatchesFilterTokens('note', [], valueTokens, { hasUnfinishedTasks: false, propertyValuesByKey: exactStatusProperties })
        ).toBe(true);
        expect(
            fileMatchesFilterTokens('note', [], valueTokens, {
                hasUnfinishedTasks: false,
                propertyValuesByKey: new Map<string, string[]>([['status', ['done']]])
            })
        ).toBe(false);
    });

    it('evaluates OR expressions between property tokens', () => {
        const tokens = parseFilterSearchTokens('.status=started OR .status=finished');
        expect(tokens.mode).toBe('tag');

        expect(
            fileMatchesFilterTokens('note', [], tokens, {
                hasUnfinishedTasks: false,
                propertyValuesByKey: new Map<string, string[]>([['status', ['started']]])
            })
        ).toBe(true);
        expect(
            fileMatchesFilterTokens('note', [], tokens, {
                hasUnfinishedTasks: false,
                propertyValuesByKey: new Map<string, string[]>([['status', ['finished']]])
            })
        ).toBe(true);
        expect(
            fileMatchesFilterTokens('note', [], tokens, {
                hasUnfinishedTasks: false,
                propertyValuesByKey: new Map<string, string[]>([['status', ['paused']]])
            })
        ).toBe(false);
    });

    it('matches folded property keys and values', () => {
        const tokens = parseFilterSearchTokens('.status=accion');
        expect(
            fileMatchesFilterTokens('note', [], tokens, {
                hasUnfinishedTasks: false,
                propertyValuesByKey: new Map<string, string[]>([[foldSearchText('Státus'), [foldSearchText('acción')]]])
            })
        ).toBe(true);
    });
});

describe('updateFilterQueryWithProperty', () => {
    it('adds and removes key-only property tokens', () => {
        const added = updateFilterQueryWithProperty('', 'status', null, 'AND');
        expect(added.query).toBe('.status');
        expect(added.action).toBe('added');
        expect(added.changed).toBe(true);

        const removed = updateFilterQueryWithProperty(added.query, 'status', null, 'AND');
        expect(removed.query).toBe('');
        expect(removed.action).toBe('removed');
        expect(removed.changed).toBe(true);
    });

    it('removes property tokens using folded key/value matching', () => {
        const result = updateFilterQueryWithProperty('.Státus=acción AND .phase=done', 'status', 'accion', 'AND');
        expect(result.query).toBe('.phase=done');
        expect(result.action).toBe('removed');
        expect(result.changed).toBe(true);
    });

    it('inserts OR connectors in expression queries', () => {
        const result = updateFilterQueryWithProperty('#work', 'status', 'in progress', 'OR');
        expect(result.query).toBe('#work OR .status="in progress"');
        expect(result.action).toBe('added');
        expect(result.changed).toBe(true);
    });

    it('quotes keys with whitespace in generated query tokens', () => {
        const result = updateFilterQueryWithProperty('', 'Reading Status', 'Acme Corp', 'AND');
        expect(result.query).toBe('."reading status"="acme corp"');
        expect(result.action).toBe('added');
        expect(result.changed).toBe(true);
    });

    it('round-trips keys containing "="', () => {
        const added = updateFilterQueryWithProperty('', 'Status=Phase', null, 'AND');
        expect(added.query).toBe('."status\\=phase"');
        expect(added.action).toBe('added');
        expect(added.changed).toBe(true);

        const parsed = parseFilterSearchTokens(added.query);
        expect(parsed.propertyTokens).toEqual([{ key: 'status=phase', value: null }]);

        const removed = updateFilterQueryWithProperty(added.query, 'Status=Phase', null, 'AND');
        expect(removed.query).toBe('');
        expect(removed.action).toBe('removed');
        expect(removed.changed).toBe(true);
    });

    it('round-trips values containing "="', () => {
        const added = updateFilterQueryWithProperty('', 'status', 'In=Progress', 'AND');
        expect(added.query).toBe('.status="in\\=progress"');
        expect(added.action).toBe('added');
        expect(added.changed).toBe(true);

        const parsed = parseFilterSearchTokens(added.query);
        expect(parsed.propertyTokens).toEqual([{ key: 'status', value: 'in=progress' }]);
    });

    it('appends tokens without connectors in mixed queries', () => {
        const result = updateFilterQueryWithProperty('meeting @today', 'status', 'in progress', 'OR');
        expect(result.query).toBe('meeting @today .status="in progress"');
        expect(result.action).toBe('added');
        expect(result.changed).toBe(true);
    });
});
