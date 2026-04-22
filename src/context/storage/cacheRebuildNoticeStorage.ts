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

import { STORAGE_KEYS } from '../../types';
import { localStorage } from '../../utils/localStorage';
import { isRecord } from '../../utils/typeGuards';
import type { FileContentType } from '../../interfaces/IContentProvider';

// Persists minimal rebuild-notice state so a cache rebuild progress notice can be restored after an Obsidian restart.
export type CacheRebuildNoticeSource = 'rebuild' | 'settings';

export interface CacheRebuildNoticeState {
    // Number of files requiring processing when the notice started (used as the progress bar max).
    total: number;
    source?: CacheRebuildNoticeSource;
    types?: FileContentType[];
}

function isFileContentType(value: unknown): value is FileContentType {
    return (
        value === 'preview' ||
        value === 'tags' ||
        value === 'featureImage' ||
        value === 'metadata' ||
        value === 'wordCount' ||
        value === 'tasks' ||
        value === 'properties'
    );
}

// Validates the vault-scoped localStorage payload before using it to drive UI.
function isCacheRebuildNoticeState(value: unknown): value is CacheRebuildNoticeState {
    if (!isRecord(value)) {
        return false;
    }

    const totalValue = value.total;
    if (typeof totalValue !== 'number' || !Number.isFinite(totalValue) || totalValue < 0) {
        return false;
    }

    const sourceValue = value.source;
    if (sourceValue !== undefined && sourceValue !== 'rebuild' && sourceValue !== 'settings') {
        return false;
    }

    const typesValue = value.types;
    if (typesValue !== undefined) {
        if (!Array.isArray(typesValue)) {
            return false;
        }
        if (typesValue.some(type => !isFileContentType(type))) {
            return false;
        }
    }

    return true;
}

export function getCacheRebuildNoticeState(): CacheRebuildNoticeState | null {
    const stored = localStorage.get<unknown>(STORAGE_KEYS.cacheRebuildNoticeKey);
    if (!isCacheRebuildNoticeState(stored)) {
        return null;
    }
    return stored;
}

export function setCacheRebuildNoticeState(state: CacheRebuildNoticeState): void {
    localStorage.set(STORAGE_KEYS.cacheRebuildNoticeKey, state);
}

export function clearCacheRebuildNoticeState(): void {
    localStorage.remove(STORAGE_KEYS.cacheRebuildNoticeKey);
}
