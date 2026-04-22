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

import { useEffect, useState } from 'react';
import { getDBInstance } from '../../storage/fileOperations';
import { runAsyncAction } from '../../utils/async';

/**
 * Initializes the shared IndexedDB-backed storage and exposes a readiness flag.
 *
 * `StorageContext` relies on synchronous reads from the storage layer (via an in-memory mirror inside
 * `IndexedDBStorage`). That mirror is only valid after `db.init()` completes.
 *
 * This hook:
 * - Calls `getDBInstance().init()` once on mount.
 * - Returns `true` after initialization, allowing other hooks/effects to start diffing and queueing work.
 * - Logs errors and keeps readiness `false` when IndexedDB is unavailable (private mode, quota issues, etc).
 */
export function useIndexedDBReady(): boolean {
    const [isIndexedDBReady, setIsIndexedDBReady] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const initializeDatabase = async () => {
            try {
                const db = getDBInstance();
                await db.init();
                if (!cancelled) {
                    setIsIndexedDBReady(true);
                }
            } catch (error: unknown) {
                console.error('Database not available for StorageContext:', error);
                if (!cancelled) {
                    setIsIndexedDBReady(false);
                }
            }
        };

        // `runAsyncAction` ensures errors are surfaced consistently (and avoids an unhandled promise chain
        // when React tears down effects during hot reload / view closure).
        runAsyncAction(initializeDatabase);

        return () => {
            cancelled = true;
        };
    }, []);

    return isIndexedDBReady;
}
