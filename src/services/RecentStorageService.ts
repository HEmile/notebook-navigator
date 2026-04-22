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

import type { NotebookNavigatorSettings } from '../settings/types';
import type { LocalStorageKeys } from '../types';
import { DEFAULT_SETTINGS } from '../settings/defaultSettings';
import { localStorage } from '../utils/localStorage';
import { normalizeCanonicalIconId } from '../utils/iconizeFormat';
import { sanitizeRecord } from '../utils/recordUtils';
import { isRecord } from '../utils/typeGuards';
import { RECENT_ICONS_PER_PROVIDER_LIMIT } from './icons/types';

// Delay before persisting changes to local storage (milliseconds)
const PERSIST_DELAY_MS = 1000;

// Service for managing recent notes and icons in local storage
export class RecentStorageService {
    private readonly settings: NotebookNavigatorSettings;
    private readonly keys: LocalStorageKeys;
    private readonly notifyChange: () => void;
    private readonly vaultProfileId: string;

    // In-memory caches for recent data
    private notesCache: string[] = [];
    private notesByProfileCache: Record<string, string[]> = sanitizeRecord<string[]>(undefined);
    private iconsCache: Record<string, string[]> = sanitizeRecord<string[]>(undefined);

    // Timer IDs for delayed persistence
    private notesPersistTimer: number | null = null;
    private iconsPersistTimer: number | null = null;

    // Track last persisted state to avoid unnecessary writes
    private lastPersistedNotesByProfile: Record<string, string[]> = sanitizeRecord<string[]>(undefined);
    private lastPersistedIcons: Record<string, string[]> = sanitizeRecord<string[]>(undefined);

    constructor(options: {
        settings: NotebookNavigatorSettings;
        keys: LocalStorageKeys;
        notifyChange: () => void;
        vaultProfileId: string;
    }) {
        this.settings = options.settings;
        this.keys = options.keys;
        this.notifyChange = options.notifyChange;
        this.vaultProfileId = options.vaultProfileId;
    }

    // Load data from local storage into memory caches
    hydrate(): void {
        this.hydrateRecentNotes();
        this.hydrateRecentIcons();
    }

    getRecentNotes(): string[] {
        return [...this.notesCache];
    }

    setRecentNotes(recentNotes: string[]): void {
        const normalized = this.normalizeRecentNotes(recentNotes, this.getRecentNotesLimit());
        if (this.areArraysEqual(normalized, this.notesCache)) {
            return;
        }

        this.notesCache = normalized;
        if (normalized.length === 0) {
            delete this.notesByProfileCache[this.vaultProfileId];
        } else {
            this.notesByProfileCache[this.vaultProfileId] = normalized;
        }
        this.scheduleRecentNotesPersist();
    }

    getRecentIcons(): Record<string, string[]> {
        return this.cloneIconMap(this.iconsCache);
    }

    setRecentIcons(recentIcons: Record<string, string[]>): void {
        const normalized = this.normalizeRecentIconsMap(recentIcons);
        if (this.areIconMapsEqual(normalized, this.iconsCache)) {
            return;
        }

        this.iconsCache = normalized;
        this.scheduleRecentIconsPersist();
    }

    applyRecentNotesLimit(): void {
        const limit = this.getRecentNotesLimit();
        const cachedProfiles = Object.keys(this.notesByProfileCache);
        let didChange = false;

        cachedProfiles.forEach(profileId => {
            const storedNotes = this.notesByProfileCache[profileId] ?? [];
            const normalized = this.normalizeRecentNotes(storedNotes, limit);
            if (this.areArraysEqual(normalized, storedNotes)) {
                return;
            }

            didChange = true;
            if (normalized.length === 0) {
                delete this.notesByProfileCache[profileId];
            } else {
                this.notesByProfileCache[profileId] = normalized;
            }
        });

        const activeNotes = this.notesByProfileCache[this.vaultProfileId] ?? [];
        if (!this.areArraysEqual(activeNotes, this.notesCache)) {
            this.notesCache = [...activeNotes];
            didChange = true;
        }

        if (!didChange) {
            return;
        }

        this.scheduleRecentNotesPersist();
    }

    // Immediately persist any pending changes and cancel timers
    flushPendingPersists(): void {
        // Cancel pending persist timers
        if (this.notesPersistTimer !== null) {
            window.clearTimeout(this.notesPersistTimer);
            this.notesPersistTimer = null;
        }
        if (this.iconsPersistTimer !== null) {
            window.clearTimeout(this.iconsPersistTimer);
            this.iconsPersistTimer = null;
        }

        // Persist data immediately
        this.persistRecentNotesImmediately();
        this.persistRecentIconsImmediately();
    }

    // Load recent notes from local storage and normalize data
    private hydrateRecentNotes(): void {
        const limit = this.getRecentNotesLimit();
        const storedValue = localStorage.get<unknown>(this.keys.recentNotesKey);
        const validProfileIds = this.getValidVaultProfileIds();
        const normalizedByProfile = sanitizeRecord<string[]>(undefined);
        let didNormalize = false;

        if (Array.isArray(storedValue)) {
            const storedList = storedValue.filter((item): item is string => typeof item === 'string');
            const normalized = this.normalizeRecentNotes(storedList, limit);
            if (normalized.length > 0) {
                normalizedByProfile[this.vaultProfileId] = normalized;
            }
            didNormalize = true;
        } else if (isRecord(storedValue)) {
            for (const [profileId, value] of Object.entries(storedValue)) {
                if (!validProfileIds.has(profileId)) {
                    didNormalize = true;
                    continue;
                }

                if (!Array.isArray(value)) {
                    didNormalize = true;
                    continue;
                }

                if (value.length === 0) {
                    didNormalize = true;
                    continue;
                }

                const storedList = value.filter((item): item is string => typeof item === 'string');
                if (storedList.length !== value.length) {
                    didNormalize = true;
                }
                const normalized = this.normalizeRecentNotes(storedList, limit);

                if (!this.areArraysEqual(normalized, storedList)) {
                    didNormalize = true;
                }

                if (normalized.length > 0) {
                    normalizedByProfile[profileId] = normalized;
                } else if (storedList.length > 0) {
                    didNormalize = true;
                }
            }
        }

        this.notesByProfileCache = normalizedByProfile;
        this.notesCache = [...(normalizedByProfile[this.vaultProfileId] ?? [])];
        this.lastPersistedNotesByProfile = this.cloneIconMap(normalizedByProfile);

        // Persist normalized data if it differs from stored data
        if (didNormalize) {
            localStorage.set(this.keys.recentNotesKey, this.cloneIconMap(normalizedByProfile));
        }
    }

    // Load recent icons from local storage and normalize data
    private hydrateRecentIcons(): void {
        const storedValue = localStorage.get<unknown>(this.keys.recentIconsKey);
        const storedRecord = isRecord(storedValue) ? storedValue : {};
        const { sanitized, didSanitize } = this.sanitizeIconRecord(storedRecord);
        const normalized = this.normalizeRecentIconsMap(sanitized);

        this.iconsCache = normalized;
        this.lastPersistedIcons = this.cloneIconMap(normalized);

        // Persist normalized data if it differs from stored data
        if (didSanitize || !this.areIconMapsEqual(normalized, sanitized)) {
            localStorage.set(this.keys.recentIconsKey, normalized);
        }
    }

    // Schedule delayed persistence of recent notes
    private scheduleRecentNotesPersist(): void {
        // Cancel existing timer if present
        if (this.notesPersistTimer !== null) {
            window.clearTimeout(this.notesPersistTimer);
        }

        // Set new timer for delayed persistence
        this.notesPersistTimer = window.setTimeout(() => {
            this.notesPersistTimer = null;
            this.persistRecentNotesAsync();
        }, PERSIST_DELAY_MS);
    }

    // Schedule delayed persistence of recent icons
    private scheduleRecentIconsPersist(): void {
        // Cancel existing timer if present
        if (this.iconsPersistTimer !== null) {
            window.clearTimeout(this.iconsPersistTimer);
        }

        // Set new timer for delayed persistence
        this.iconsPersistTimer = window.setTimeout(() => {
            this.iconsPersistTimer = null;
            this.persistRecentIconsAsync();
        }, PERSIST_DELAY_MS);
    }

    // Persist recent notes asynchronously when idle
    private persistRecentNotesAsync(): void {
        this.runWhenIdle(() => {
            this.persistRecentNotesImmediately();
        });
    }

    // Persist recent icons asynchronously when idle
    private persistRecentIconsAsync(): void {
        this.runWhenIdle(() => {
            this.persistRecentIconsImmediately();
        });
    }

    // Save recent notes to local storage immediately
    private persistRecentNotesImmediately(): void {
        this.pruneRecentNotesByProfileCache();

        // Skip if data hasn't changed
        if (this.areIconMapsEqual(this.notesByProfileCache, this.lastPersistedNotesByProfile)) {
            return;
        }

        // Create snapshot and persist
        const snapshot = this.cloneIconMap(this.notesByProfileCache);
        localStorage.set(this.keys.recentNotesKey, snapshot);
        this.lastPersistedNotesByProfile = snapshot;
        this.notifyChange();
    }

    // Save recent icons to local storage immediately
    private persistRecentIconsImmediately(): void {
        // Skip if data hasn't changed
        if (this.areIconMapsEqual(this.iconsCache, this.lastPersistedIcons)) {
            return;
        }

        // Create snapshot and persist
        const snapshot = this.cloneIconMap(this.iconsCache);
        localStorage.set(this.keys.recentIconsKey, snapshot);
        this.lastPersistedIcons = snapshot;
        this.notifyChange();
    }

    // Schedule callback to run on next tick
    private runWhenIdle(callback: () => void): void {
        window.setTimeout(() => {
            callback();
        }, 0);
    }

    // Normalize recent notes array: remove duplicates, invalid entries, and apply limit
    private normalizeRecentNotes(notes: unknown[], limit: number): string[] {
        const unique = new Set<string>();
        const normalized: string[] = [];

        for (const value of notes) {
            // Skip non-string or empty values
            if (typeof value !== 'string' || value.length === 0) {
                continue;
            }

            // Skip duplicates
            if (unique.has(value)) {
                continue;
            }

            // Add to result
            unique.add(value);
            normalized.push(value);

            // Stop when limit reached
            if (normalized.length >= limit) {
                break;
            }
        }

        return normalized;
    }

    // Normalize recent icons map: validate structure, remove duplicates, apply per-provider limit
    private normalizeRecentIconsMap(source: Record<string, unknown>): Record<string, string[]> {
        const normalized = sanitizeRecord<string[]>(undefined);

        for (const [providerId, value] of Object.entries(source)) {
            // Skip invalid provider IDs
            if (typeof providerId !== 'string' || providerId.length === 0) {
                continue;
            }

            const icons = Array.isArray(value) ? value : [];
            const seen = new Set<string>();
            const providerIcons: string[] = [];

            for (const iconId of icons) {
                // Skip invalid icon IDs
                if (typeof iconId !== 'string' || iconId.length === 0) {
                    continue;
                }

                const normalizedIdentifier = this.normalizeIconIdentifierForProvider(providerId, iconId);
                if (!normalizedIdentifier) {
                    continue;
                }

                // Skip duplicates
                if (seen.has(normalizedIdentifier)) {
                    continue;
                }

                // Add to result
                seen.add(normalizedIdentifier);
                providerIcons.push(normalizedIdentifier);

                // Stop when per-provider limit reached
                if (providerIcons.length >= RECENT_ICONS_PER_PROVIDER_LIMIT) {
                    break;
                }
            }

            // Only include providers with at least one icon
            if (providerIcons.length > 0) {
                normalized[providerId] = providerIcons;
            }
        }

        return normalized;
    }

    private normalizeIconIdentifierForProvider(providerId: string, identifier: string): string | null {
        const trimmedIdentifier = identifier.trim();
        if (!trimmedIdentifier) {
            return null;
        }

        let canonical = trimmedIdentifier;
        if (!canonical.includes(':') && providerId !== 'lucide') {
            canonical = `${providerId}:${canonical}`;
        }

        const normalizedCanonical = normalizeCanonicalIconId(canonical);
        if (!normalizedCanonical) {
            return null;
        }

        const colonIndex = normalizedCanonical.indexOf(':');
        const normalizedProvider = colonIndex === -1 ? 'lucide' : normalizedCanonical.substring(0, colonIndex);
        const normalizedIdentifier = colonIndex === -1 ? normalizedCanonical : normalizedCanonical.substring(colonIndex + 1);

        if (!normalizedIdentifier || normalizedProvider !== providerId) {
            return null;
        }

        return providerId === 'lucide' ? normalizedIdentifier : `${providerId}:${normalizedIdentifier}`;
    }

    // Check if two string arrays are identical
    private areArraysEqual(a: string[], b: string[]): boolean {
        if (a.length !== b.length) {
            return false;
        }

        for (let index = 0; index < a.length; index += 1) {
            if (a[index] !== b[index]) {
                return false;
            }
        }

        return true;
    }

    // Check if two icon maps are identical
    private areIconMapsEqual(a: Record<string, string[]>, b: Record<string, string[]>): boolean {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length) {
            return false;
        }

        for (const key of aKeys) {
            if (!Object.prototype.hasOwnProperty.call(b, key)) {
                return false;
            }

            const aList = a[key];
            const bList = b[key];
            if (!this.areArraysEqual(aList, bList)) {
                return false;
            }
        }

        return true;
    }

    // Create deep copy of icon map
    private cloneIconMap(source: Record<string, string[]>): Record<string, string[]> {
        const clone = sanitizeRecord<string[]>(undefined);
        for (const [key, value] of Object.entries(source)) {
            clone[key] = [...value];
        }
        return clone;
    }

    // Get configured limit for recent notes with validation
    private getRecentNotesLimit(): number {
        const limitValue =
            typeof this.settings.recentNotesCount === 'number' ? this.settings.recentNotesCount : DEFAULT_SETTINGS.recentNotesCount;
        return Math.max(1, limitValue);
    }

    private getValidVaultProfileIds(): Set<string> {
        const profiles = Array.isArray(this.settings.vaultProfiles) ? this.settings.vaultProfiles : [];
        const ids = new Set<string>();

        profiles.forEach(profile => {
            if (profile.id) {
                ids.add(profile.id);
            }
        });

        if (this.vaultProfileId) {
            ids.add(this.vaultProfileId);
        }

        return ids;
    }

    private pruneRecentNotesByProfileCache(): void {
        const validProfileIds = this.getValidVaultProfileIds();

        Object.keys(this.notesByProfileCache).forEach(profileId => {
            if (validProfileIds.has(profileId)) {
                return;
            }
            delete this.notesByProfileCache[profileId];
        });
    }

    // Convert unknown record to validated icon record structure
    private sanitizeIconRecord(source: Record<string, unknown>): { sanitized: Record<string, string[]>; didSanitize: boolean } {
        const sanitized = sanitizeRecord<string[]>(undefined);
        let didSanitize = false;

        for (const [key, value] of Object.entries(source)) {
            // Validate key
            if (typeof key !== 'string' || key.length === 0) {
                didSanitize = true;
                continue;
            }

            // Validate value is array
            if (!Array.isArray(value)) {
                didSanitize = true;
                continue;
            }

            if (value.length === 0) {
                didSanitize = true;
                continue;
            }

            // Filter to only string values
            const icons = value.filter((item): item is string => typeof item === 'string');
            if (icons.length !== value.length) {
                didSanitize = true;
            }

            if (icons.length > 0) {
                sanitized[key] = icons;
            } else {
                didSanitize = true;
            }
        }
        return { sanitized, didSanitize };
    }
}
