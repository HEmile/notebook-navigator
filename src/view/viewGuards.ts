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

import type { NotebookNavigatorCalendarView } from './NotebookNavigatorCalendarView';
import type { NotebookNavigatorView } from './NotebookNavigatorView';

function hasFunctionProperty<TName extends string>(
    value: unknown,
    propertyName: TName
): value is Record<TName, (...args: unknown[]) => unknown> {
    return typeof value === 'object' && value !== null && typeof (value as Record<TName, unknown>)[propertyName] === 'function';
}

export function isNotebookNavigatorView(value: unknown): value is NotebookNavigatorView {
    return (
        hasFunctionProperty(value, 'whenReady') &&
        hasFunctionProperty(value, 'navigateToFile') &&
        hasFunctionProperty(value, 'navigateToFolder') &&
        hasFunctionProperty(value, 'stopContentProcessing')
    );
}

export function isNotebookNavigatorCalendarView(value: unknown): value is NotebookNavigatorCalendarView {
    return hasFunctionProperty(value, 'stopContentProcessing');
}
