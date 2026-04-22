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

import { App } from 'obsidian';
import { ExtendedApp } from '../../../types/obsidian-extended';

export interface IconAssetRecord {
    id: string;
    version: string;
    mimeType: string;
    data: ArrayBuffer;
    metadataFormat: 'json';
    metadata: string;
    updated: number;
}

/**
 * IndexedDB wrapper for storing downloaded icon assets (fonts + metadata).
 * Each record is keyed by provider id and kept per-vault using the appId namespace.
 */
export class IconAssetDatabase {
    private static readonly STORE_NAME = 'providers';
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;
    private readonly dbName: string;

    constructor(app: App) {
        const appId = (app as ExtendedApp).appId || 'default';
        this.dbName = `notebooknavigator/icons/${appId}`;
    }

    async init(): Promise<void> {
        if (this.db) {
            return;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.openDatabase().catch(error => {
            this.initPromise = null;
            throw error;
        });
        return this.initPromise;
    }

    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    async get(id: string): Promise<IconAssetRecord | null> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Icon asset database not initialized'));
                return;
            }

            const transaction = this.db.transaction([IconAssetDatabase.STORE_NAME], 'readonly');
            const store = transaction.objectStore(IconAssetDatabase.STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                // Validate the result from IndexedDB
                const result: unknown = request.result;
                if (result === null || result === undefined) {
                    resolve(null);
                    return;
                }

                // Ensure the record has the expected structure
                if (isIconAssetRecord(result)) {
                    resolve(result);
                    return;
                }

                // Invalid record found in database, return null instead
                console.log('[IconAssetDatabase] Ignoring invalid icon asset record', { id });
                resolve(null);
            };
            request.onerror = () => {
                reject(getRequestError(request.error, 'Failed to fetch icon asset'));
            };
        });
    }

    async put(record: IconAssetRecord): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Icon asset database not initialized'));
                return;
            }

            const transaction = this.db.transaction([IconAssetDatabase.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(IconAssetDatabase.STORE_NAME);
            const request = store.put(record);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                reject(getRequestError(request.error, 'Failed to store icon asset'));
            };
        });
    }

    async delete(id: string): Promise<void> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Icon asset database not initialized'));
                return;
            }

            const transaction = this.db.transaction([IconAssetDatabase.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(IconAssetDatabase.STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                reject(getRequestError(request.error, 'Failed to delete icon asset'));
            };
        });
    }

    async getAll(): Promise<IconAssetRecord[]> {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Icon asset database not initialized'));
                return;
            }

            const transaction = this.db.transaction([IconAssetDatabase.STORE_NAME], 'readonly');
            const store = transaction.objectStore(IconAssetDatabase.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                // Validate that getAll returned an array
                const result: unknown = request.result;
                if (!Array.isArray(result)) {
                    console.log('[IconAssetDatabase] Unexpected result when fetching all icon assets');
                    resolve([]);
                    return;
                }

                // Filter out any invalid records from the database
                const records: IconAssetRecord[] = [];
                for (const entry of result) {
                    if (isIconAssetRecord(entry)) {
                        records.push(entry);
                    } else {
                        console.log('[IconAssetDatabase] Skipping invalid icon asset record');
                    }
                }

                resolve(records);
            };
            request.onerror = () => {
                reject(getRequestError(request.error, 'Failed to fetch icon assets'));
            };
        });
    }

    private async openDatabase(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = event => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(IconAssetDatabase.STORE_NAME)) {
                    db.createObjectStore(IconAssetDatabase.STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                if (this.db) {
                    this.db.onversionchange = () => {
                        try {
                            this.db?.close();
                        } catch {
                            // noop
                        }
                        this.db = null;
                    };
                }
                resolve();
            };

            request.onerror = () => {
                reject(getRequestError(request.error, 'Failed to open icon asset database'));
            };

            request.onblocked = () => {
                reject(new Error('Icon asset database open blocked'));
            };
        });
    }
}

/**
 * Converts IndexedDB request errors to standard Error objects.
 * Returns the original error if it's already an Error, otherwise creates a new Error with the fallback message.
 */
function getRequestError(domError: DOMException | null, fallbackMessage: string): Error {
    if (domError instanceof Error) {
        return domError;
    }
    return new Error(fallbackMessage);
}

/**
 * Type guard that validates whether a value matches the expected IconAssetRecord structure.
 * Checks all required properties and their types to ensure data integrity from IndexedDB.
 */
function isIconAssetRecord(value: unknown): value is IconAssetRecord {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const record = value as Partial<IconAssetRecord>;
    return (
        typeof record.id === 'string' &&
        typeof record.version === 'string' &&
        typeof record.mimeType === 'string' &&
        record.data instanceof ArrayBuffer &&
        record.metadataFormat === 'json' &&
        typeof record.metadata === 'string' &&
        typeof record.updated === 'number'
    );
}
