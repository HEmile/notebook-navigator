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

import { useEffect, useRef, useState } from 'react';

const RESUME_EVENT_COALESCE_MS = 120;

function pad2(value: number): string {
    return String(value).padStart(2, '0');
}

export function getLocalDayKey(date: Date): string {
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    return `${year}-${month}-${day}`;
}

export function getMsUntilNextLocalMidnight(now: Date): number {
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const diff = nextMidnight.getTime() - now.getTime();
    return diff > 0 ? diff : 0;
}

export function useLocalDayKey(): string {
    const [dayKey, setDayKey] = useState(() => getLocalDayKey(new Date()));
    const timeoutRef = useRef<number | null>(null);
    const lastResumeSyncMsRef = useRef(0);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const clearTimer = () => {
            const timeoutId = timeoutRef.current;
            if (timeoutId === null) {
                return;
            }

            window.clearTimeout(timeoutId);
            timeoutRef.current = null;
        };

        const updateDayKey = () => {
            const nextDayKey = getLocalDayKey(new Date());
            setDayKey(current => (current === nextDayKey ? current : nextDayKey));
        };

        const scheduleNextTick = () => {
            clearTimer();

            const delayMs = getMsUntilNextLocalMidnight(new Date());
            timeoutRef.current = window.setTimeout(() => {
                updateDayKey();
                scheduleNextTick();
            }, delayMs + 100);
        };

        const handleResume = () => {
            const nowMs = Date.now();
            if (nowMs - lastResumeSyncMsRef.current < RESUME_EVENT_COALESCE_MS) {
                return;
            }
            lastResumeSyncMsRef.current = nowMs;
            updateDayKey();
            scheduleNextTick();
        };

        scheduleNextTick();
        window.addEventListener('focus', handleResume);
        window.addEventListener('pageshow', handleResume);
        document.addEventListener('visibilitychange', handleResume);

        return () => {
            window.removeEventListener('focus', handleResume);
            window.removeEventListener('pageshow', handleResume);
            document.removeEventListener('visibilitychange', handleResume);
            clearTimer();
        };
    }, []);

    return dayKey;
}
