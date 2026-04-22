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

// Creates a logger that only logs each unique key once to prevent log spam.
// The key set is capped to avoid unbounded memory growth on long-running sessions.
export function createOnceLogger(maxEntries = 500): (key: string, message: string, error?: unknown) => void {
    const maxEntriesSafe = Number.isFinite(maxEntries) && maxEntries > 0 ? Math.floor(maxEntries) : 1;
    const loggedFailures = new Map<string, true>();

    return (key: string, message: string, error?: unknown): void => {
        if (loggedFailures.has(key)) {
            return;
        }
        loggedFailures.set(key, true);

        // Evict oldest entries when the map exceeds the maximum size
        while (loggedFailures.size > maxEntriesSafe) {
            const next = loggedFailures.keys().next();
            if (next.done) {
                break;
            }
            loggedFailures.delete(next.value);
        }

        if (error !== undefined) {
            console.log(message, error);
            return;
        }

        console.log(message);
    };
}

// Controls concurrent render operations with an acquire/release pattern
export interface RenderLimiter {
    acquire: () => Promise<() => void>;
    getActiveCount: () => number;
}

// Creates a limiter that restricts the number of concurrent render operations
export function createRenderLimiter(maxParallel: number): RenderLimiter {
    const maxParallelSafe = Number.isFinite(maxParallel) && maxParallel > 0 ? Math.floor(maxParallel) : 1;

    let active = 0;
    let waiterHead = 0;
    const waiters: (() => void)[] = [];

    // Decrements active count and notifies the next waiter if any
    function release(): void {
        active = Math.max(0, active - 1);

        const next = waiters[waiterHead];
        if (!next) {
            if (waiterHead > 0) {
                waiters.splice(0, waiterHead);
                waiterHead = 0;
            }
            return;
        }

        waiterHead += 1;
        active += 1;
        next();

        if (waiterHead > 50 && waiterHead > waiters.length / 2) {
            waiters.splice(0, waiterHead);
            waiterHead = 0;
        }
    }

    // Waits for an available slot and returns a release function
    async function acquire(): Promise<() => void> {
        if (active < maxParallelSafe) {
            active += 1;
            return () => release();
        }

        await new Promise<void>(resolve => {
            waiters.push(resolve);
        });

        return () => release();
    }

    return {
        acquire,
        getActiveCount: () => active
    };
}

// Controls concurrent render operations using a weight-based budget.
export interface RenderBudgetLimiter {
    // Waits until the requested weight fits within the remaining budget.
    // Resolves with a release function that must be called once when the operation is finished.
    acquire: (weight: number) => Promise<() => void>;
    // Returns the sum of weights currently acquired.
    getActiveWeight: () => number;
}

// Creates a limiter that restricts the total weight of concurrent operations.
export function createRenderBudgetLimiter(maxBudget: number): RenderBudgetLimiter {
    // Coerce the configured budget to a positive integer so we always allow at least one operation.
    const maxBudgetSafe = Number.isFinite(maxBudget) && maxBudget > 0 ? Math.floor(maxBudget) : 1;

    // Total weight currently acquired by in-flight operations.
    let activeWeight = 0;

    // Head index into the waiter queue (used instead of shifting the array on every fulfillment).
    let waiterHead = 0;

    // FIFO queue of pending acquisitions.
    // Each waiter stores its requested weight and a resolver that receives the release callback.
    const waiters: { weight: number; resolve: (release: () => void) => void }[] = [];

    // Attempts to fulfill queued acquisitions in FIFO order.
    //
    // This implementation does not skip over an overweight head-of-queue waiter. If the head cannot
    // fit into the remaining budget, all later waiters remain queued until budget is released.
    function tryFulfillWaiters(): void {
        while (waiterHead < waiters.length) {
            const next = waiters[waiterHead];
            if (!next) {
                break;
            }

            // Stop once the head waiter cannot fit into the remaining budget.
            if (activeWeight + next.weight > maxBudgetSafe) {
                break;
            }

            // Fulfill the head waiter by reserving its weight and advancing the queue head.
            waiterHead += 1;
            activeWeight += next.weight;

            // Release callback returned to the caller.
            // Calling release decreases activeWeight and immediately tries to fulfill more waiters.
            //
            // Callers must invoke release exactly once. Releasing multiple times can temporarily
            // undercount activeWeight and allow more concurrent work than intended.
            const release = () => {
                activeWeight = Math.max(0, activeWeight - next.weight);
                tryFulfillWaiters();
            };

            next.resolve(release);

            // Occasionally compact the queue to avoid unbounded memory growth from processed entries.
            if (waiterHead > 50 && waiterHead > waiters.length / 2) {
                waiters.splice(0, waiterHead);
                waiterHead = 0;
            }
        }
    }

    async function acquire(weight: number): Promise<() => void> {
        // Coerce caller-provided weight to a positive integer.
        const weightSafe = Number.isFinite(weight) && weight > 0 ? Math.floor(weight) : 1;

        // Clamp overweight requests to the total budget so they can be fulfilled by running alone.
        // Without this, a request larger than maxBudgetSafe could never be fulfilled and would
        // block the FIFO queue indefinitely.
        const requestedWeight = Math.min(weightSafe, maxBudgetSafe);

        // Fast path: if there are no queued waiters and we have budget, acquire immediately.
        if (waiterHead === waiters.length && activeWeight + requestedWeight <= maxBudgetSafe) {
            activeWeight += requestedWeight;
            return () => {
                activeWeight = Math.max(0, activeWeight - requestedWeight);
                tryFulfillWaiters();
            };
        }

        // Slow path: enqueue the acquisition and return a promise that resolves when the limiter
        // reserves budget for this request.
        return await new Promise(resolve => {
            waiters.push({ weight: requestedWeight, resolve });
            tryFulfillWaiters();
        });
    }

    return {
        acquire,
        getActiveWeight: () => activeWeight
    };
}
