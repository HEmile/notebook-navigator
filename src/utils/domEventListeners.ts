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

import { runAsyncAction } from './async';

export type AsyncEventHandler<TEvent extends Event = Event> = (event: TEvent) => void | Promise<void>;

/**
 * Attaches an event listener that routes the handler through runAsyncAction
 * and returns a disposer to unregister it.
 */
export function addAsyncEventListener<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: AsyncEventHandler<HTMLElementEventMap[K]>,
    options?: boolean | AddEventListenerOptions
): () => void;
export function addAsyncEventListener<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    handler: AsyncEventHandler<DocumentEventMap[K]>,
    options?: boolean | AddEventListenerOptions
): () => void;
export function addAsyncEventListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    handler: AsyncEventHandler<WindowEventMap[K]>,
    options?: boolean | AddEventListenerOptions
): () => void;
export function addAsyncEventListener<TEvent extends Event = Event>(
    target: EventTarget,
    type: string,
    handler: AsyncEventHandler<TEvent>,
    options?: boolean | AddEventListenerOptions
): () => void {
    // Wrap handler to run through runAsyncAction for consistent error handling
    const wrappedHandler = (event: Event) => {
        runAsyncAction(() => handler(event as TEvent));
    };
    target.addEventListener(type, wrappedHandler as EventListener, options);
    // Return disposer function to remove the listener
    return () => target.removeEventListener(type, wrappedHandler as EventListener, options);
}
