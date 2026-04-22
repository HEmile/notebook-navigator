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

/**
 * Converts unknown error types to Error instances for consistent error handling.
 * IndexedDB errors can be DOMExceptions, null, or undefined - this normalizes them.
 */
export function normalizeIdbError(error: unknown, fallbackMessage: string): Error {
    return error instanceof Error ? error : new Error(fallbackMessage);
}

/**
 * Rejects a promise with a normalized error from either the transaction or the last request.
 * Prefers the transaction error if available, otherwise uses the last request error.
 */
export function rejectWithTransactionError(
    reject: (reason?: unknown) => void,
    transaction: IDBTransaction,
    lastRequestError: DOMException | Error | null,
    fallbackMessage: string
): void {
    const combinedError = transaction.error || lastRequestError;
    reject(normalizeIdbError(combinedError, fallbackMessage));
}

export function isVersionError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'VersionError';
}
