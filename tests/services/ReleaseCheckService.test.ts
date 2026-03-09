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
import ReleaseCheckService from '../../src/services/ReleaseCheckService';

const { requestUrlMock } = vi.hoisted(() => {
    return {
        requestUrlMock: vi.fn()
    };
});

vi.mock('obsidian', async () => {
    const actual = await vi.importActual<typeof import('obsidian')>('obsidian');
    return {
        ...actual,
        requestUrl: requestUrlMock
    };
});

interface ReleasePluginStub {
    manifest: { version: string };
    getReleaseCheckTimestamp: ReturnType<typeof vi.fn<() => number | null>>;
    setReleaseCheckTimestamp: ReturnType<typeof vi.fn<(timestamp: number) => void>>;
}

function createPlugin(overrides: Partial<ReleasePluginStub> = {}): ReleasePluginStub {
    return {
        manifest: { version: '1.0.0' },
        getReleaseCheckTimestamp: vi.fn(() => null),
        setReleaseCheckTimestamp: vi.fn(),
        ...overrides
    };
}

describe('ReleaseCheckService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-09T10:00:00.000Z'));
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not reuse the cached newer release when the daily check interval has not elapsed', async () => {
        const plugin = createPlugin({
            getReleaseCheckTimestamp: vi.fn(() => Date.now() - 60_000)
        });
        const service = new ReleaseCheckService(plugin as never);

        await expect(service.checkForUpdates()).resolves.toBeNull();

        expect(requestUrlMock).not.toHaveBeenCalled();
        expect(plugin.setReleaseCheckTimestamp).not.toHaveBeenCalled();
        expect(service.getPendingNotice()).toBeNull();
    });

    it('returns a notice when a fresh check finds a newer release', async () => {
        requestUrlMock.mockResolvedValue({
            status: 200,
            json: {
                tag_name: 'v1.1.0',
                html_url: 'https://example.com/releases/1.1.0',
                published_at: '2026-03-08T12:00:00.000Z',
                draft: false,
                prerelease: false
            },
            headers: {}
        });

        const plugin = createPlugin();
        const service = new ReleaseCheckService(plugin as never);

        await expect(service.checkForUpdates()).resolves.toEqual({
            version: '1.1.0',
            publishedAt: '2026-03-08T12:00:00.000Z',
            url: 'https://example.com/releases/1.1.0'
        });

        expect(requestUrlMock).toHaveBeenCalledOnce();
        expect(plugin.setReleaseCheckTimestamp).toHaveBeenCalledWith(Date.now());
        expect(service.getPendingNotice()).toEqual({
            version: '1.1.0',
            publishedAt: '2026-03-08T12:00:00.000Z',
            url: 'https://example.com/releases/1.1.0'
        });
    });

    it('does not surface a cached notice when a fresh check fails', async () => {
        requestUrlMock.mockResolvedValue({
            status: 500,
            headers: {}
        });

        const plugin = createPlugin();
        const service = new ReleaseCheckService(plugin as never);

        await expect(service.checkForUpdates()).resolves.toBeNull();

        expect(requestUrlMock).toHaveBeenCalledOnce();
        expect(plugin.setReleaseCheckTimestamp).toHaveBeenCalledWith(Date.now());
        expect(service.getPendingNotice()).toBeNull();
    });
});
