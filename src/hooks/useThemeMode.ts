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

import { useEffect, useState } from 'react';
import type { App } from 'obsidian';
import { getCurrentThemeMode, subscribeThemeModeChanges, type ThemeMode } from '../utils/themeMode';

export function useThemeMode(app: App, enabled = true): ThemeMode {
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => getCurrentThemeMode());

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const syncThemeMode = () => {
            setThemeMode(previousThemeMode => {
                const nextThemeMode = getCurrentThemeMode();
                return previousThemeMode === nextThemeMode ? previousThemeMode : nextThemeMode;
            });
        };

        const unsubscribe = subscribeThemeModeChanges(app, syncThemeMode);
        syncThemeMode();

        return unsubscribe;
    }, [app, enabled]);

    return themeMode;
}
