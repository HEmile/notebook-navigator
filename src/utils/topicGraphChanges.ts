/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2026 Emile van Krieken
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

import type { CachedMetadata } from 'obsidian';
import { getTopicTags, hasTopicTag, HAS_TOPIC_RELATIONS } from './topicGraph';

/**
 * Wait after the last topic-relevant change before rebuilding, so a burst of saves (typing a link in
 * frontmatter, a sync bringing in many notes) becomes one rebuild.
 */
export const TOPIC_GRAPH_REBUILD_DEBOUNCE_MS = 2000;

/** Minimum time between two automatic rebuilds. A full rebuild walks every note, so large vaults cap it. */
export const TOPIC_GRAPH_REBUILD_MIN_INTERVAL_MS = 60000;

/** A change that keeps arriving still rebuilds after this long, instead of waiting for a quiet period forever. */
export const TOPIC_GRAPH_REBUILD_MAX_WAIT_MS = 60000;

/**
 * Summarizes the parts of a note's metadata that the topic graph reads: the frontmatter relation values
 * and whether its inline tags mark it as a topic. Two equal signatures mean a metadata change cannot
 * have changed the graph through this note. Notes without any of these return an empty string.
 */
export function getTopicRelationSignature(metadata: CachedMetadata | null | undefined, topicTags: string[]): string {
    if (!metadata) {
        return '';
    }

    const parts: string[] = [];
    if (hasTopicTag(getTopicTags(metadata), topicTags)) {
        parts.push('#topic');
    }

    const frontmatter = metadata.frontmatter;
    if (frontmatter) {
        for (const relation of HAS_TOPIC_RELATIONS) {
            const value: unknown = frontmatter[relation];
            if (value === undefined || value === null) {
                continue;
            }
            parts.push(`${relation}=${JSON.stringify(value)}`);
        }
    }

    return parts.join('\n');
}

export interface TopicRebuildScheduler {
    /** Requests a rebuild, subject to the debounce, the minimum interval and the maximum wait */
    schedule: () => void;
    /** Runs a rebuild now, dropping any pending one */
    flush: () => void;
    /** Records a rebuild that ran outside the scheduler, so the minimum interval counts from it */
    markRun: () => void;
    /** Drops any pending rebuild */
    cancel: () => void;
    hasPending: () => boolean;
}

export interface TopicRebuildSchedulerOptions {
    run: () => void;
    debounceMs?: number;
    minIntervalMs?: number;
    maxWaitMs?: number;
    now?: () => number;
    setTimer?: (callback: () => void, delayMs: number) => number;
    clearTimer?: (timerId: number) => void;
}

/**
 * Rate-limits topic graph rebuilds. A request runs once no new request arrived for `debounceMs`, but never
 * sooner than `minIntervalMs` after the previous rebuild, and no later than `maxWaitMs` after the first
 * pending request (or the minimum interval, whichever is later). So a single edit shows after the
 * debounce, and continuous changes rebuild at most once per minimum interval.
 */
export function createTopicRebuildScheduler(options: TopicRebuildSchedulerOptions): TopicRebuildScheduler {
    const debounceMs = options.debounceMs ?? TOPIC_GRAPH_REBUILD_DEBOUNCE_MS;
    const minIntervalMs = options.minIntervalMs ?? TOPIC_GRAPH_REBUILD_MIN_INTERVAL_MS;
    const maxWaitMs = options.maxWaitMs ?? TOPIC_GRAPH_REBUILD_MAX_WAIT_MS;
    const now = options.now ?? (() => Date.now());
    const setTimer = options.setTimer ?? ((callback: () => void, delayMs: number) => window.setTimeout(callback, delayMs));
    const clearTimer = options.clearTimer ?? ((timerId: number) => window.clearTimeout(timerId));

    let lastRunAt = Number.NEGATIVE_INFINITY;
    let firstPendingAt: number | null = null;
    let timerId: number | null = null;

    const clearPending = () => {
        if (timerId !== null) {
            clearTimer(timerId);
            timerId = null;
        }
        firstPendingAt = null;
    };

    const runNow = () => {
        clearPending();
        lastRunAt = now();
        options.run();
    };

    return {
        schedule: () => {
            const current = now();
            if (firstPendingAt === null) {
                firstPendingAt = current;
            }
            const earliest = lastRunAt + minIntervalMs;
            const latest = Math.max(firstPendingAt + maxWaitMs, earliest);
            const dueAt = Math.min(Math.max(current + debounceMs, earliest), latest);

            if (timerId !== null) {
                clearTimer(timerId);
            }
            timerId = setTimer(runNow, Math.max(0, dueAt - current));
        },
        flush: runNow,
        markRun: () => {
            clearPending();
            lastRunAt = now();
        },
        cancel: clearPending,
        hasPending: () => timerId !== null
    };
}
