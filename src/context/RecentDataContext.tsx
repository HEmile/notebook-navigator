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

import React, { createContext, useContext, useEffect, useState } from 'react';
import NotebookNavigatorPlugin from '../main';

interface RecentDataState {
    recentNotes: string[];
    recentIcons: Record<string, string[]>;
}

const RecentDataContext = createContext<RecentDataState | null>(null);

interface RecentDataProviderProps {
    plugin: NotebookNavigatorPlugin;
    children: React.ReactNode;
}

/**
 * Provider that maintains recent notes and recent icons state from local storage
 */
export function RecentDataProvider({ plugin, children }: RecentDataProviderProps) {
    const [recentNotes, setRecentNotes] = useState<string[]>(() => plugin.getRecentNotes());
    const [recentIcons, setRecentIcons] = useState<Record<string, string[]>>(() => plugin.getRecentIcons());

    useEffect(() => {
        // Generate unique listener ID
        const id = `recent-data-${Date.now()}`;

        // Update state when recent data changes
        const handleRecentUpdate = () => {
            setRecentNotes(plugin.getRecentNotes());
            setRecentIcons(plugin.getRecentIcons());
        };

        plugin.registerRecentDataListener(id, handleRecentUpdate);

        return () => {
            plugin.unregisterRecentDataListener(id);
        };
    }, [plugin]);

    const value: RecentDataState = React.useMemo(() => ({ recentNotes, recentIcons }), [recentNotes, recentIcons]);

    return <RecentDataContext.Provider value={value}>{children}</RecentDataContext.Provider>;
}

/**
 * Hook to access recent notes and icons from the context
 */
export function useRecentData(): RecentDataState {
    const context = useContext(RecentDataContext);
    if (context === null) {
        throw new Error('useRecentData must be used within a RecentDataProvider');
    }
    return context;
}
