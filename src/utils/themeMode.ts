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

import type { App, EventRef } from 'obsidian';

export type ThemeMode = 'dark' | 'light';

type ThemeModeListener = () => void;

const listeners = new Set<ThemeModeListener>();
let bodyObserver: MutationObserver | null = null;
let cssChangeRef: EventRef | null = null;
let subscribedApp: App | null = null;

export function getCurrentThemeMode(): ThemeMode {
    return activeDocument.body?.classList.contains('theme-dark') ? 'dark' : 'light';
}

function notifyThemeModeListeners(): void {
    listeners.forEach(listener => listener());
}

function disconnectThemeModeListeners(): void {
    bodyObserver?.disconnect();
    bodyObserver = null;

    if (subscribedApp && cssChangeRef) {
        subscribedApp.workspace.offref(cssChangeRef);
    }
    cssChangeRef = null;
    subscribedApp = null;
}

function ensureThemeModeListeners(app: App): void {
    if (subscribedApp && subscribedApp !== app) {
        disconnectThemeModeListeners();
    }

    subscribedApp = app;

    if (!bodyObserver && activeDocument.body) {
        bodyObserver = new MutationObserver(notifyThemeModeListeners);
        bodyObserver.observe(activeDocument.body, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    if (!cssChangeRef) {
        cssChangeRef = app.workspace.on('css-change', notifyThemeModeListeners);
    }
}

export function subscribeThemeModeChanges(app: App, listener: ThemeModeListener): () => void {
    listeners.add(listener);
    ensureThemeModeListeners(app);

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            disconnectThemeModeListeners();
        }
    };
}
