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

export type MaybePromise = void | Promise<unknown>;

export interface AsyncErrorRecord {
    error: unknown;
    timestamp: number;
}

// Determines if a value has a Promise-like then method.
export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return typeof value === 'object' && value !== null && typeof (value as PromiseLike<unknown>).then === 'function';
}

type AsyncAction = () => MaybePromise;

interface RunAsyncActionOptions {
    onError?: (error: unknown) => void;
}

const MAX_ASYNC_ERROR_HISTORY = 20;
const asyncErrorHistory: AsyncErrorRecord[] = [];

// Records async errors to history, keeping only the most recent entries
function recordAsyncError(error: unknown) {
    asyncErrorHistory.push({ error, timestamp: Date.now() });
    if (asyncErrorHistory.length > MAX_ASYNC_ERROR_HISTORY) {
        asyncErrorHistory.shift();
    }
}

// Logs unhandled async errors and records them to history
const defaultErrorHandler = (error: unknown) => {
    console.error('Unhandled async action error', error);
    recordAsyncError(error);
};

// Executes an async action with error handling for both sync and async failures
export function runAsyncAction(action: AsyncAction, options?: RunAsyncActionOptions): void {
    const handleError = options?.onError ?? defaultErrorHandler;

    try {
        const result = action();
        if (isPromiseLike(result)) {
            void result.catch(handleError);
        }
    } catch (error) {
        handleError(error);
    }
}
