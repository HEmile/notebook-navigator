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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'obsidian';

const { mockLocalStorageStore, localStorageGet, localStorageSet, localStorageRemove } = vi.hoisted(() => {
    const mockLocalStorageStore = new Map<string, unknown>();
    const localStorageGet = vi.fn((key: string) => (mockLocalStorageStore.has(key) ? (mockLocalStorageStore.get(key) ?? null) : null));
    const localStorageSet = vi.fn((key: string, value: unknown) => {
        mockLocalStorageStore.set(key, value);
        return true;
    });
    const localStorageRemove = vi.fn((key: string) => {
        mockLocalStorageStore.delete(key);
        return true;
    });

    return { mockLocalStorageStore, localStorageGet, localStorageSet, localStorageRemove };
});

vi.mock('../../src/utils/localStorage', () => {
    return {
        localStorage: {
            get: localStorageGet,
            set: localStorageSet,
            remove: localStorageRemove
        }
    };
});

import {
    clearPdfProcessingInProgress,
    clearPendingPdfProcessingDiagnostic,
    consumePendingPdfProcessingDiagnostic,
    markPdfProcessingInProgress
} from '../../src/services/content/pdf/pdfCrashDiagnostics';
import { setDebugLoggingService } from '../../src/services/diagnostics/DebugLoggingService';
import { STORAGE_KEYS } from '../../src/types';

describe('PDF crash diagnostics', () => {
    beforeEach(() => {
        mockLocalStorageStore.clear();
        vi.clearAllMocks();
        setDebugLoggingService(null);
        Platform.isMobile = true;
    });

    afterEach(() => {
        Platform.isMobile = false;
        setDebugLoggingService(null);
    });

    it('does not write the mobile marker when debug logging is disabled', () => {
        const handle = markPdfProcessingInProgress('a.pdf');

        expect(handle).toBeNull();
        expect(localStorageSet).not.toHaveBeenCalledWith(STORAGE_KEYS.pdfProcessingDiagnosticKey, expect.anything());
    });

    it('writes and consumes the mobile marker when debug logging is enabled', () => {
        mockLocalStorageStore.set(STORAGE_KEYS.debugLoggingEnabledKey, true);

        const handle = markPdfProcessingInProgress('a.pdf');

        expect(handle).not.toBeNull();
        expect(localStorageSet).toHaveBeenCalledWith(STORAGE_KEYS.pdfProcessingDiagnosticKey, expect.objectContaining({ path: 'a.pdf' }));
        expect(consumePendingPdfProcessingDiagnostic()).toBe('a.pdf');
        expect(localStorageRemove).toHaveBeenCalledWith(STORAGE_KEYS.pdfProcessingDiagnosticKey);
    });

    it('clears a matching marker even if debug logging has stopped', () => {
        mockLocalStorageStore.set(STORAGE_KEYS.debugLoggingEnabledKey, true);
        const handle = markPdfProcessingInProgress('a.pdf');
        mockLocalStorageStore.set(STORAGE_KEYS.debugLoggingEnabledKey, false);

        clearPdfProcessingInProgress(handle);

        expect(mockLocalStorageStore.has(STORAGE_KEYS.pdfProcessingDiagnosticKey)).toBe(false);
    });

    it('clears pending marker state regardless of enabled state', () => {
        mockLocalStorageStore.set(STORAGE_KEYS.pdfProcessingDiagnosticKey, { path: 'stale.pdf', token: 'token' });

        clearPendingPdfProcessingDiagnostic();

        expect(mockLocalStorageStore.has(STORAGE_KEYS.pdfProcessingDiagnosticKey)).toBe(false);
    });
});
