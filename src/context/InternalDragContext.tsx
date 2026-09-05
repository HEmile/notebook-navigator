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

import { createContext, type ReactNode, useContext, useMemo, useRef } from 'react';
import { ItemType } from '../types';

export type InternalDragSession =
    | { type: typeof ItemType.FILE; filePaths: string[] }
    | { type: typeof ItemType.FOLDER; folderPath: string }
    | { type: typeof ItemType.TAG; displayPath: string; canonicalPath: string | null }
    | { type: typeof ItemType.PROPERTY; nodeId: string }
    | null;

interface InternalDragSessionContextValue {
    getSession: () => InternalDragSession;
    setSession: (session: InternalDragSession) => void;
    clearSession: () => void;
}

const InternalDragSessionContext = createContext<InternalDragSessionContextValue | null>(null);

interface InternalDragSessionProviderProps {
    children: ReactNode;
}

export function InternalDragSessionProvider({ children }: InternalDragSessionProviderProps) {
    const sessionRef = useRef<InternalDragSession>(null);

    const value = useMemo<InternalDragSessionContextValue>(
        () => ({
            getSession: () => sessionRef.current,
            setSession: session => {
                sessionRef.current = session;
            },
            clearSession: () => {
                sessionRef.current = null;
            }
        }),
        []
    );

    return <InternalDragSessionContext.Provider value={value}>{children}</InternalDragSessionContext.Provider>;
}

export function useInternalDragSession(): InternalDragSessionContextValue {
    const context = useContext(InternalDragSessionContext);
    if (!context) {
        throw new Error('useInternalDragSession must be used within InternalDragSessionProvider');
    }
    return context;
}
