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
import type { App } from 'obsidian';

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
    DebugLoggingService,
    finishStartupDiagnostics,
    getDebugLogPathForTimestamp,
    isDebugLogPath,
    isDebugLoggingEnabled,
    recordContentProviderBatch,
    recordStartupDiagnostic,
    recordStartupUserVisible,
    setDebugLoggingService
} from '../../src/services/diagnostics/DebugLoggingService';
import { STORAGE_KEYS } from '../../src/types';

function createApp(params?: { append?: (path: string, data: string) => Promise<void> }): App {
    const append = params?.append ?? vi.fn(async () => undefined);

    return {
        vault: {
            adapter: {
                append
            }
        }
    } as unknown as App;
}

describe('DebugLoggingService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockLocalStorageStore.clear();
        vi.clearAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        setDebugLoggingService(null);
    });

    afterEach(() => {
        setDebugLoggingService(null);
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('uses a timestamped root markdown file for each debug session', () => {
        expect(getDebugLogPathForTimestamp(new Date('2026-05-23T21:30:12.123Z'))).toBe('nn-debug-2026-05-23T21-30-12-123Z.md');
    });

    it('identifies root debug log files for vault-event suppression', () => {
        expect(isDebugLogPath('nn-debug-2026-05-23T21-30-12-123Z.md')).toBe(true);
        expect(isDebugLogPath('folder/nn-debug-2026-05-23T21-30-12-123Z.md')).toBe(false);
        expect(isDebugLogPath('nn-debug-notes.md')).toBe(false);
        expect(isDebugLogPath('nn-debug-2026-05-23T21-30-12-123Z.txt')).toBe(false);
    });

    it('does not append reports while disabled', async () => {
        const append = vi.fn(async () => undefined);
        const service = new DebugLoggingService(createApp({ append }), { pluginVersion: '1.0.0' });

        service.initialize();
        service.logReport('Test report', { value: 1 });
        await service.flush();

        expect(append).not.toHaveBeenCalled();
    });

    it('appends markdown reports while enabled', async () => {
        vi.setSystemTime(new Date('2026-05-23T21:30:12.123Z'));
        mockLocalStorageStore.set(STORAGE_KEYS.debugLoggingEnabledKey, true);
        const append = vi.fn(async () => undefined);
        const service = new DebugLoggingService(createApp({ append }), { pluginVersion: '1.0.0' });

        service.initialize();
        service.logReport('Test report', { value: 1 });
        await service.flush();

        expect(append).toHaveBeenCalledTimes(1);
        expect(append).toHaveBeenCalledWith('nn-debug-2026-05-23T21-30-12-123Z.md', expect.stringContaining('## '));
        expect(append.mock.calls[0]?.[1]).toContain('Test report');
        expect(append.mock.calls[0]?.[1]).toContain('"value": 1');

        service.dispose();
    });

    it('drops pending debounced writes when disabled', async () => {
        mockLocalStorageStore.set(STORAGE_KEYS.debugLoggingEnabledKey, true);
        const append = vi.fn(async () => undefined);
        const service = new DebugLoggingService(createApp({ append }), { pluginVersion: '1.0.0' });

        service.initialize();
        service.logReport('Pending report', { value: 1 });
        service.setEnabled(false);
        await vi.advanceTimersByTimeAsync(1000);

        expect(append).not.toHaveBeenCalled();
    });

    it('writes one startup report after storage and user-visible settle', async () => {
        mockLocalStorageStore.set(STORAGE_KEYS.debugLoggingEnabledKey, true);
        const append = vi.fn(async () => undefined);
        const service = new DebugLoggingService(createApp({ append }), { pluginVersion: '1.0.0' });

        service.initialize();
        setDebugLoggingService(service);

        recordContentProviderBatch({
            provider: 'metadata',
            queued: 1,
            active: 1,
            contentUpdates: 0,
            processedMtimeUpdates: 1
        });
        recordContentProviderBatch({
            provider: 'metadata',
            queued: 2,
            active: 2,
            contentUpdates: 1,
            processedMtimeUpdates: 1
        });

        await vi.advanceTimersByTimeAsync(2000);
        expect(append).not.toHaveBeenCalled();

        finishStartupDiagnostics({ status: 'storageReady', indexableFileCount: 10 });
        recordStartupUserVisible({ source: 'layout.readyTasks.complete' });
        await vi.advanceTimersByTimeAsync(2000);
        await service.flush();

        expect(append).toHaveBeenCalledTimes(1);
        const text = append.mock.calls[0]?.[1] ?? '';
        expect(text).toContain('Startup diagnostics');
        expect(text).toContain('### Summary');
        expect(text).toContain('### Timeline');
        expect(text).toContain('### Raw data');
        expect(text).toContain(
            '- Scope: starts when Obsidian calls Notebook Navigator onload; timeline gaps can include Obsidian or other plugins.'
        );
        expect(text).toContain('- User visible: 2000 ms');
        expect(text).toContain('- Diagnostic window: 4000 ms, including 2000 ms settle delay');
        expect(text).toContain('|    Time | Event | Details |');
        expect(text).toContain('|  2.000s | storage.ready |');
        expect(text).toContain('|  2.000s | userVisible | source=layout.readyTasks.complete |');
        expect(text).toContain('"reason": "settled"');
        expect(text).toContain('"storage"');
        expect(text).toContain('"userVisible"');
        expect(text).toContain('"contentProviderBatches"');
        expect(text).toContain('"batches": 2');
        expect(text).toContain('"queued": 3');
        expect(text).not.toContain('Content provider batches');
    });

    it('labels missing ready markers instead of formatting them as zero', async () => {
        mockLocalStorageStore.set(STORAGE_KEYS.debugLoggingEnabledKey, true);
        const append = vi.fn(async () => undefined);
        const service = new DebugLoggingService(createApp({ append }), { pluginVersion: '1.0.0' });

        service.initialize();
        setDebugLoggingService(service);

        recordStartupDiagnostic('layout.ready');
        service.finishStartupReport('timeout', { status: 'partial' });
        await service.flush();

        expect(append).toHaveBeenCalledTimes(1);
        const text = append.mock.calls[0]?.[1] ?? '';
        expect(text).toContain('- Ready markers: storage not recorded, layout 0 ms');
    });

    it('escapes markdown table characters in startup timeline cells', async () => {
        mockLocalStorageStore.set(STORAGE_KEYS.debugLoggingEnabledKey, true);
        const append = vi.fn(async () => undefined);
        const service = new DebugLoggingService(createApp({ append }), { pluginVersion: '1.0.0' });

        service.initialize();
        setDebugLoggingService(service);

        recordStartupDiagnostic('folder\\|ready', { path: 'notes\\|daily', label: 'one\ntwo' });
        service.finishStartupReport('timeout', { status: 'partial' });
        await service.flush();

        expect(append).toHaveBeenCalledTimes(1);
        const text = append.mock.calls[0]?.[1] ?? '';
        expect(text).toContain(`|  0.000s | ${String.raw`folder\\\|ready`} | ${String.raw`path=notes\\\|daily, label=one two`} |`);
    });

    it('stops writing debug reports after startup settles while keeping the setting enabled', async () => {
        mockLocalStorageStore.set(STORAGE_KEYS.debugLoggingEnabledKey, true);
        const append = vi.fn(async () => undefined);
        const service = new DebugLoggingService(createApp({ append }), { pluginVersion: '1.0.0' });

        service.initialize();
        setDebugLoggingService(service);

        finishStartupDiagnostics({ status: 'storageReady' });
        recordStartupUserVisible({ source: 'layout.readyTasks.complete' });
        await vi.advanceTimersByTimeAsync(2000);
        await service.flush();

        expect(service.isEnabled()).toBe(true);
        expect(isDebugLoggingEnabled()).toBe(false);
        expect(append).toHaveBeenCalledTimes(1);

        service.logReport('Late report', { value: 1 });
        recordContentProviderBatch({
            provider: 'metadata',
            queued: 1,
            active: 1,
            contentUpdates: 1,
            processedMtimeUpdates: 1
        });
        await service.flush();

        expect(append).toHaveBeenCalledTimes(1);
    });
});
