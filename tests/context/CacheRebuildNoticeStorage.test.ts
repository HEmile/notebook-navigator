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
import {
    clearCacheRebuildNoticeState,
    getCacheRebuildNoticeState,
    setCacheRebuildNoticeState
} from '../../src/context/storage/cacheRebuildNoticeStorage';

const storage = new Map<string, unknown>();

vi.mock('../../src/utils/localStorage', () => ({
    localStorage: {
        get: (key: string) => {
            if (!storage.has(key)) {
                return null;
            }
            return storage.get(key) ?? null;
        },
        set: (key: string, value: unknown) => {
            storage.set(key, value);
            return true;
        },
        remove: (key: string) => {
            storage.delete(key);
            return true;
        }
    }
}));

describe('cacheRebuildNoticeStorage', () => {
    beforeEach(() => {
        storage.clear();
        clearCacheRebuildNoticeState();
    });

    it('restores persisted notices that track word count and tasks', () => {
        setCacheRebuildNoticeState({ total: 12, types: ['wordCount', 'tasks'] });

        expect(getCacheRebuildNoticeState()).toEqual({ total: 12, types: ['wordCount', 'tasks'] });
    });
});
