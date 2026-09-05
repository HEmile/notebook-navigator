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

import { useRef } from 'react';

type AnyHandler = (...args: never[]) => unknown;

/**
 * Builds an identity-stable facade over the listed handler members of `source`.
 * The facade object is created once per mount; each member forwards its call to
 * the latest `source[key]` through a ref, so memoized consumers can hold the
 * facade without re-rendering when the underlying handler identities rotate.
 *
 * Only function members can be listed. Values that rows read during render must
 * be passed through reactive props instead, so memoization sees them change.
 */
export function useStableHandlerFacade<T extends Record<K, AnyHandler>, K extends keyof T & string>(
    source: T,
    keys: readonly K[]
): Pick<T, K> {
    const sourceRef = useRef(source);
    sourceRef.current = source;

    const facadeRef = useRef<Pick<T, K> | null>(null);
    if (facadeRef.current === null) {
        const facade = {} as Record<K, AnyHandler>;
        for (const key of keys) {
            facade[key] = (...args: never[]) => sourceRef.current[key](...args);
        }
        facadeRef.current = facade as Pick<T, K>;
    }
    return facadeRef.current;
}
