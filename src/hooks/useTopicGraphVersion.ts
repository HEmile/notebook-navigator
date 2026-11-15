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

import { useCallback, useSyncExternalStore } from 'react';
import type { TopicService } from '../services/TopicGraphService';

const noopUnsubscribe = () => {};

/** Returns a number that changes on every topic graph rebuild, for use as a memo dependency */
export function useTopicGraphVersion(topicService: TopicService | null): number {
    const subscribe = useCallback(
        (onStoreChange: () => void) => (topicService ? topicService.subscribe(onStoreChange) : noopUnsubscribe),
        [topicService]
    );
    const getSnapshot = useCallback(() => topicService?.getVersion() ?? 0, [topicService]);
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
