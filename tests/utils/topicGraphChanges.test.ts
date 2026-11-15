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

import { describe, expect, it } from 'vitest';
import type { CachedMetadata } from 'obsidian';
import { createTopicRebuildScheduler, getTopicRelationSignature } from '../../src/utils/topicGraphChanges';
import { TopicService } from '../../src/services/TopicGraphService';
import type { TopicNode } from '../../src/types/storage';

const TOPIC_TAGS = ['topic'];

function metadata(frontmatter?: Record<string, unknown>, tags: string[] = []): CachedMetadata {
    return {
        frontmatter,
        tags: tags.map(tag => ({ tag, position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }))
    };
}

describe('getTopicRelationSignature', () => {
    it('is empty for notes the topic graph does not read', () => {
        expect(getTopicRelationSignature(null, TOPIC_TAGS)).toBe('');
        expect(getTopicRelationSignature(metadata({ title: 'Note', aliases: ['x'] }, ['#idea']), TOPIC_TAGS)).toBe('');
    });

    it('ignores frontmatter outside the topic relations', () => {
        const before = getTopicRelationSignature(metadata({ hasTopic: ['[[Physics]]'], modified: '2026-01-01' }), TOPIC_TAGS);
        const after = getTopicRelationSignature(metadata({ hasTopic: ['[[Physics]]'], modified: '2026-11-15' }), TOPIC_TAGS);
        expect(before).not.toBe('');
        expect(after).toBe(before);
    });

    it('changes when a relation link changes', () => {
        const before = getTopicRelationSignature(metadata({ hasTopic: ['[[Physics]]'] }), TOPIC_TAGS);
        const after = getTopicRelationSignature(metadata({ hasTopic: ['[[Physics]]', '[[Optics]]'] }), TOPIC_TAGS);
        expect(after).not.toBe(before);
    });

    it('changes when an inline topic tag is added', () => {
        const before = getTopicRelationSignature(metadata({ subset: ['[[Science]]'] }), TOPIC_TAGS);
        const after = getTopicRelationSignature(metadata({ subset: ['[[Science]]'] }, ['#topic']), TOPIC_TAGS);
        expect(after).not.toBe(before);
    });
});

/** Fake clock and timers so scheduler timing is exact */
function createFakeTimers() {
    let current = 0;
    let nextId = 1;
    const timers = new Map<number, { at: number; callback: () => void }>();
    return {
        now: () => current,
        setTimer: (callback: () => void, delayMs: number) => {
            const id = nextId++;
            timers.set(id, { at: current + delayMs, callback });
            return id;
        },
        clearTimer: (id: number) => {
            timers.delete(id);
        },
        advance(ms: number) {
            const target = current + ms;
            for (;;) {
                const due = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) {
                    break;
                }
                timers.delete(due[0]);
                current = due[1].at;
                due[1].callback();
            }
            current = target;
        }
    };
}

function createScheduler() {
    const timers = createFakeTimers();
    const runs: number[] = [];
    const scheduler = createTopicRebuildScheduler({
        run: () => runs.push(timers.now()),
        debounceMs: 2000,
        minIntervalMs: 60000,
        maxWaitMs: 60000,
        now: timers.now,
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer
    });
    return { scheduler, timers, runs };
}

describe('createTopicRebuildScheduler', () => {
    it('runs a single change after the debounce when no rebuild ran recently', () => {
        const { scheduler, timers, runs } = createScheduler();
        scheduler.schedule();
        timers.advance(1999);
        expect(runs).toEqual([]);
        timers.advance(1);
        expect(runs).toEqual([2000]);
    });

    it('merges a burst of changes into one rebuild after the last change', () => {
        const { scheduler, timers, runs } = createScheduler();
        for (let i = 0; i < 5; i++) {
            scheduler.schedule();
            timers.advance(1000);
        }
        timers.advance(10000);
        expect(runs).toEqual([6000]);
    });

    it('waits for the minimum interval after a rebuild', () => {
        const { scheduler, timers, runs } = createScheduler();
        scheduler.markRun();
        timers.advance(5000);
        scheduler.schedule();
        timers.advance(54999);
        expect(runs).toEqual([]);
        timers.advance(1);
        expect(runs).toEqual([60000]);
    });

    it('rebuilds at most once per minimum interval under continuous changes', () => {
        const { scheduler, timers, runs } = createScheduler();
        // A change every second for five minutes
        for (let i = 0; i < 300; i++) {
            scheduler.schedule();
            timers.advance(1000);
        }
        timers.advance(120000);
        expect(runs.length).toBeGreaterThanOrEqual(5);
        expect(runs.length).toBeLessThanOrEqual(6);
        for (let i = 1; i < runs.length; i++) {
            expect(runs[i] - runs[i - 1]).toBeGreaterThanOrEqual(60000);
        }
    });

    it('flush runs immediately and drops the pending rebuild', () => {
        const { scheduler, timers, runs } = createScheduler();
        scheduler.schedule();
        scheduler.flush();
        expect(runs).toEqual([0]);
        expect(scheduler.hasPending()).toBe(false);
        timers.advance(120000);
        expect(runs).toEqual([0]);
    });

    it('cancel drops the pending rebuild', () => {
        const { scheduler, timers, runs } = createScheduler();
        scheduler.schedule();
        scheduler.cancel();
        timers.advance(120000);
        expect(runs).toEqual([]);
    });
});

describe('TopicService updates', () => {
    function node(name: string): TopicNode {
        return { name, parents: new Map(), children: new Map(), notesWithTag: new Set() };
    }

    it('bumps the version, notifies listeners and indexes nested topic names', () => {
        const service = new TopicService();
        const science = node('Science');
        const physics = node('Physics');
        science.children.set('Physics', physics);
        physics.parents.set('Science', science);

        let notified = 0;
        const unsubscribe = service.subscribe(() => {
            notified++;
        });
        const versionBefore = service.getVersion();

        service.updateTopicGraph(new Map([['Science', science]]));

        expect(service.getVersion()).toBe(versionBefore + 1);
        expect(notified).toBe(1);
        expect(service.hasTopicName('Physics')).toBe(true);
        expect(service.hasTopicName('Chemistry')).toBe(false);

        unsubscribe();
        service.updateTopicGraph(new Map());
        expect(notified).toBe(1);
        expect(service.hasTopicName('Physics')).toBe(false);
    });
});
