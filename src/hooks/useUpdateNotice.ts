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

import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../context/ServicesContext';
import type { ReleaseUpdateNotice } from '../services/ReleaseCheckService';

/** State returned by the useUpdateNotice hook */
interface UpdateNoticeState {
    bannerNotice: ReleaseUpdateNotice | null;
    markAsDisplayed: (version: string) => void;
}

/**
 * Provides access to the pending release update notice and a handler to mark it as shown.
 */
export function useUpdateNotice(): UpdateNoticeState {
    const { plugin } = useServices();
    const [bannerNotice, setBannerNotice] = useState<ReleaseUpdateNotice | null>(() => plugin.getPendingUpdateNotice());

    // Subscribe to update notice changes
    useEffect(() => {
        // Generate unique listener ID to avoid conflicts
        const id = `update-notice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const listener = (value: ReleaseUpdateNotice | null) => {
            setBannerNotice(value);
        };

        plugin.registerUpdateNoticeListener(id, listener);

        return () => {
            plugin.unregisterUpdateNoticeListener(id);
        };
    }, [plugin]);

    // Callback to mark a specific version as having been displayed to the user
    const markAsDisplayed = useCallback(
        (version: string) => {
            plugin.markUpdateNoticeAsDisplayed(version);
        },
        [plugin]
    );

    return {
        bannerNotice,
        markAsDisplayed
    };
}
