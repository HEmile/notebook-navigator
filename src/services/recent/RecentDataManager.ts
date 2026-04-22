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

import type { NotebookNavigatorSettings } from '../../settings';
import type { LocalStorageKeys } from '../../types';
import { RecentStorageService } from '../RecentStorageService';

interface RecentDataManagerOptions {
    // Plugin settings containing recent data limits
    settings: NotebookNavigatorSettings;
    // Local storage keys for persisting data
    keys: LocalStorageKeys;
    // Callback invoked when recent data changes
    onRecentDataChange: () => void;
}

/**
 * Wraps RecentStorageService lifecycle so the plugin stops hosting persistence helpers.
 */
export default class RecentDataManager {
    private storage: RecentStorageService | null = null;
    private readonly options: RecentDataManagerOptions;

    constructor(options: RecentDataManagerOptions) {
        this.options = options;
    }

    /**
     * Creates a new storage service instance and loads recent data from local storage
     */
    initialize(activeVaultProfileId: string): void {
        this.dispose();
        this.storage = new RecentStorageService({
            settings: this.options.settings,
            keys: this.options.keys,
            notifyChange: this.options.onRecentDataChange,
            vaultProfileId: activeVaultProfileId
        });
        this.storage.hydrate();
        this.options.onRecentDataChange();
    }

    /**
     * Persists pending changes and releases the storage service
     */
    dispose(): void {
        this.storage?.flushPendingPersists();
        this.storage = null;
    }

    /**
     * Returns the list of recent note paths
     */
    getRecentNotes(): string[] {
        return this.storage?.getRecentNotes() ?? [];
    }

    /**
     * Updates the list of recent note paths
     */
    setRecentNotes(recentNotes: string[]): void {
        this.storage?.setRecentNotes(recentNotes);
    }

    /**
     * Trims the recent notes list to the configured maximum count
     */
    applyRecentNotesLimit(): void {
        this.storage?.applyRecentNotesLimit();
    }

    /**
     * Returns the map of recent icon IDs per provider
     */
    getRecentIcons(): Record<string, string[]> {
        return this.storage?.getRecentIcons() ?? {};
    }

    /**
     * Updates the map of recent icon IDs per provider
     */
    setRecentIcons(recentIcons: Record<string, string[]>): void {
        this.storage?.setRecentIcons(recentIcons);
    }

    /**
     * Immediately writes any pending changes to local storage
     */
    flushPendingPersists(): void {
        this.storage?.flushPendingPersists();
    }
}
