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
import {
    ShortcutType,
    ShortcutStartType,
    getShortcutKey,
    getShortcutStartTargetFingerprint,
    isShortcutStartFolder,
    isShortcutStartProperty,
    isShortcutStartTag,
    normalizeSearchShortcutName,
    normalizeShortcutStartTarget
} from '../../src/types/shortcuts';

describe('shortcuts', () => {
    describe('shortcut start target guards', () => {
        it('validates shape at runtime', () => {
            expect(isShortcutStartFolder({ type: ShortcutStartType.FOLDER, path: 'projects' })).toBe(true);
            expect(isShortcutStartFolder({ type: ShortcutStartType.FOLDER, path: 42 })).toBe(false);
            expect(isShortcutStartTag({ type: ShortcutStartType.TAG, tagPath: '#work' })).toBe(true);
            expect(isShortcutStartTag({ type: ShortcutStartType.TAG, tagPath: 42 })).toBe(false);
            expect(isShortcutStartProperty({ type: ShortcutStartType.PROPERTY, nodeId: 'key:title' })).toBe(true);
            expect(isShortcutStartProperty({ type: ShortcutStartType.PROPERTY, nodeId: 42 })).toBe(false);
        });
    });

    describe('normalizeShortcutStartTarget', () => {
        it('returns undefined for malformed values', () => {
            expect(normalizeShortcutStartTarget(undefined)).toBeUndefined();
            expect(normalizeShortcutStartTarget({})).toBeUndefined();
            expect(normalizeShortcutStartTarget({ type: 'unknown', nodeId: 'key:title' })).toBeUndefined();
            expect(normalizeShortcutStartTarget({ type: ShortcutStartType.PROPERTY })).toBeUndefined();
        });

        it('normalizes folder, tag, and property targets', () => {
            expect(normalizeShortcutStartTarget({ type: ShortcutStartType.FOLDER, path: '/projects//active/' })).toEqual({
                type: ShortcutStartType.FOLDER,
                path: 'projects/active'
            });

            expect(normalizeShortcutStartTarget({ type: ShortcutStartType.TAG, tagPath: '#Work/Today' })).toEqual({
                type: ShortcutStartType.TAG,
                tagPath: 'work/today'
            });

            expect(normalizeShortcutStartTarget({ type: ShortcutStartType.PROPERTY, nodeId: 'key:Status=In Progress' })).toEqual({
                type: ShortcutStartType.PROPERTY,
                nodeId: 'key:status=in progress'
            });
        });

        it('keeps properties root virtual folder id', () => {
            expect(
                normalizeShortcutStartTarget({
                    type: ShortcutStartType.PROPERTY,
                    nodeId: PROPERTIES_ROOT_VIRTUAL_FOLDER_ID
                })
            ).toEqual({
                type: ShortcutStartType.PROPERTY,
                nodeId: PROPERTIES_ROOT_VIRTUAL_FOLDER_ID
            });
        });
    });

    describe('getShortcutStartTargetFingerprint', () => {
        it('returns canonical fingerprints and handles malformed input', () => {
            expect(getShortcutStartTargetFingerprint(undefined)).toBe('');
            expect(getShortcutStartTargetFingerprint({ type: ShortcutStartType.PROPERTY })).toBe('');

            expect(getShortcutStartTargetFingerprint({ type: ShortcutStartType.FOLDER, path: '/projects//active/' })).toBe(
                'folder:projects/active'
            );
            expect(getShortcutStartTargetFingerprint({ type: ShortcutStartType.TAG, tagPath: '#Work/Today' })).toBe('tag:work/today');
            expect(getShortcutStartTargetFingerprint({ type: ShortcutStartType.PROPERTY, nodeId: 'key:Status=In Progress' })).toBe(
                'property:key:status=in progress'
            );
        });
    });

    describe('search shortcut names', () => {
        it('normalizes NFC and NFD-equivalent names to the same canonical identifier', () => {
            expect(normalizeSearchShortcutName('Café')).toBe(normalizeSearchShortcutName('Cafe\u0301'));
        });

        it('builds the same shortcut key for NFC and NFD-equivalent names', () => {
            const nfcShortcut = {
                type: ShortcutType.SEARCH,
                name: 'Café',
                query: 'tag:#inbox',
                provider: 'internal' as const
            };
            const nfdShortcut = {
                type: ShortcutType.SEARCH,
                name: 'Cafe\u0301',
                query: 'tag:#inbox',
                provider: 'internal' as const
            };

            expect(getShortcutKey(nfcShortcut)).toBe(getShortcutKey(nfdShortcut));
        });
    });
});
