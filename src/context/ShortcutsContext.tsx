/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Notice, TAbstractFile, TFile, TFolder } from 'obsidian';
import { useSettingsState, useSettingsUpdate } from './SettingsContext';
import { useServices } from './ServicesContext';
import {
    ShortcutEntry,
    ShortcutType,
    SearchShortcut,
    getShortcutKey,
    isFolderShortcut,
    isNoteShortcut,
    isSearchShortcut,
    isTagShortcut,
    isTopicShortcut
} from '../types/shortcuts';
import type { SearchProvider } from '../types/search';
import { strings } from '../i18n';
import { normalizeTagPath } from '../utils/tagUtils';

/**
 * Represents a shortcut with resolved file/folder references and validation state.
 * Hydrated shortcuts have their paths resolved to actual Obsidian file objects.
 */
interface HydratedShortcut {
    key: string;
    shortcut: ShortcutEntry;
    folder: TFolder | null;
    note: TFile | null;
    search: SearchShortcut | null;
    tagPath: string | null;
    topicName: string | null;
    isMissing: boolean;
}

/**
 * Context value providing shortcut management functionality and state
 */
export interface ShortcutsContextValue {
    shortcuts: ShortcutEntry[];
    hydratedShortcuts: HydratedShortcut[];
    shortcutMap: Map<string, ShortcutEntry>;
    folderShortcutKeysByPath: Map<string, string>;
    noteShortcutKeysByPath: Map<string, string>;
    tagShortcutKeysByPath: Map<string, string>;
    topicShortcutKeysByName: Map<string, string>;
    searchShortcutsByName: Map<string, SearchShortcut>;
    addFolderShortcut: (path: string, options?: { index?: number }) => Promise<boolean>;
    addNoteShortcut: (path: string, options?: { index?: number }) => Promise<boolean>;
    addTagShortcut: (tagPath: string, options?: { index?: number }) => Promise<boolean>;
    addTopicShortcut: (topicName: string, options?: { index?: number }) => Promise<boolean>;
    addSearchShortcut: (input: { name: string; query: string; provider: SearchProvider }, options?: { index?: number }) => Promise<boolean>;
    removeShortcut: (key: string) => Promise<boolean>;
    removeSearchShortcut: (name: string) => Promise<boolean>;
    reorderShortcuts: (orderedKeys: string[]) => Promise<boolean>;
    hasFolderShortcut: (path: string) => boolean;
    hasNoteShortcut: (path: string) => boolean;
    hasTagShortcut: (tagPath: string) => boolean;
    hasTopicShortcut: (topicName: string) => boolean;
    findSearchShortcut: (name: string) => SearchShortcut | undefined;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

// Type guard to check if an abstract file is a folder
function isFolder(file: TAbstractFile | null): file is TFolder {
    return file instanceof TFolder;
}

// Type guard to check if an abstract file is a file
function isFile(file: TAbstractFile | null): file is TFile {
    return file instanceof TFile;
}

interface ShortcutsProviderProps {
    children: React.ReactNode;
}

/**
 * Provider component that manages shortcuts state and operations.
 * Handles adding, removing, reordering shortcuts and maintains lookup maps for fast access.
 */
export function ShortcutsProvider({ children }: ShortcutsProviderProps) {
    const settings = useSettingsState();
    const updateSettings = useSettingsUpdate();
    const { app } = useServices();
    const [vaultChangeVersion, setVaultChangeVersion] = useState(0);

    // Extracts shortcuts array from settings with fallback to empty array
    const rawShortcuts = useMemo(() => settings.shortcuts ?? [], [settings.shortcuts]);

    // TODO: remove migration once tag shortcuts are normalized across active installs
    // Normalize stored tag shortcut paths for consistent lookups
    useEffect(() => {
        const requiresNormalization = rawShortcuts.some(shortcut => {
            if (!isTagShortcut(shortcut)) {
                return false;
            }
            const normalized = normalizeTagPath(shortcut.tagPath);
            return normalized !== null && normalized !== shortcut.tagPath;
        });

        if (!requiresNormalization) {
            return;
        }

        void (async () => {
            await updateSettings(current => {
                const existing = current.shortcuts ?? [];
                current.shortcuts = existing.map(entry => {
                    if (isTagShortcut(entry)) {
                        const normalized = normalizeTagPath(entry.tagPath);
                        if (!normalized) {
                            return entry;
                        }
                        return {
                            ...entry,
                            tagPath: normalized
                        };
                    }
                    return entry;
                });
            });
        })();
    }, [rawShortcuts, updateSettings]);

    // Creates map of shortcuts by their unique keys for O(1) lookup
    const shortcutMap = useMemo(() => {
        const map = new Map<string, ShortcutEntry>();
        rawShortcuts.forEach(shortcut => {
            map.set(getShortcutKey(shortcut), shortcut);
        });
        return map;
    }, [rawShortcuts]);

    // Maps folder paths to their shortcut keys for duplicate detection
    const folderShortcutKeysByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isFolderShortcut(shortcut)) {
                map.set(shortcut.path, getShortcutKey(shortcut));
            }
        });
        return map;
    }, [rawShortcuts]);

    // Maps note paths to their shortcut keys for duplicate detection
    const noteShortcutKeysByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isNoteShortcut(shortcut)) {
                map.set(shortcut.path, getShortcutKey(shortcut));
            }
        });
        return map;
    }, [rawShortcuts]);

    // Maps tag paths to their shortcut keys for duplicate detection
    const tagShortcutKeysByPath = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isTagShortcut(shortcut)) {
                const normalized = normalizeTagPath(shortcut.tagPath);
                if (normalized) {
                    map.set(normalized, getShortcutKey(shortcut));
                }
            }
        });
        return map;
    }, [rawShortcuts]);

    // Maps topic names to their shortcut keys for duplicate detection
    const topicShortcutKeysByName = useMemo(() => {
        const map = new Map<string, string>();
        rawShortcuts.forEach(shortcut => {
            if (isTopicShortcut(shortcut)) {
                map.set(shortcut.topicName, getShortcutKey(shortcut));
            }
        });
        return map;
    }, [rawShortcuts]);

    // Maps search shortcut names (lowercase) to shortcuts for fast lookup
    const searchShortcutsByName = useMemo(() => {
        const map = new Map<string, SearchShortcut>();
        rawShortcuts.forEach(shortcut => {
            if (isSearchShortcut(shortcut)) {
                map.set(shortcut.name.toLowerCase(), shortcut);
            }
        });
        return map;
    }, [rawShortcuts]);

    // Monitors vault changes for shortcut target files to trigger re-hydration when they are created/deleted/renamed
    useEffect(() => {
        const folderPaths = new Map(folderShortcutKeysByPath);
        const notePaths = new Map(noteShortcutKeysByPath);

        if (folderPaths.size === 0 && notePaths.size === 0) {
            return;
        }

        const vault = app.vault;

        const handleCreate = (file: TAbstractFile) => {
            if (!isFolder(file) && !isFile(file)) {
                return;
            }
            if (folderPaths.has(file.path) || notePaths.has(file.path)) {
                setVaultChangeVersion(value => value + 1);
            }
        };

        const handleDelete = (file: TAbstractFile) => {
            if (!isFolder(file) && !isFile(file)) {
                return;
            }
            if (folderPaths.has(file.path) || notePaths.has(file.path)) {
                setVaultChangeVersion(value => value + 1);
            }
        };

        const handleRename = (file: TAbstractFile, oldPath: string) => {
            if (!isFolder(file) && !isFile(file)) {
                return;
            }
            if (folderPaths.has(oldPath) || notePaths.has(oldPath) || folderPaths.has(file.path) || notePaths.has(file.path)) {
                setVaultChangeVersion(value => value + 1);
            }
        };

        const createRef = vault.on('create', handleCreate);
        const deleteRef = vault.on('delete', handleDelete);
        const renameRef = vault.on('rename', (file, oldPath) => {
            handleRename(file, oldPath);
        });

        return () => {
            vault.offref(createRef);
            vault.offref(deleteRef);
            vault.offref(renameRef);
        };
    }, [app.vault, folderShortcutKeysByPath, noteShortcutKeysByPath]);

    // Hydrates shortcuts by resolving file references and validating existence
    // Transforms shortcut entries into hydrated objects with resolved file/folder references
    const hydratedShortcuts = useMemo<HydratedShortcut[]>(() => {
        // Reference vaultChangeVersion to ensure memoized value updates when tracked files change
        void vaultChangeVersion;
        return rawShortcuts.map(shortcut => {
            const key = getShortcutKey(shortcut);

            if (isFolderShortcut(shortcut)) {
                const target = shortcut.path === '/' ? app.vault.getRoot() : app.vault.getAbstractFileByPath(shortcut.path);
                if (isFolder(target)) {
                    return {
                        key,
                        shortcut,
                        folder: target,
                        note: null,
                        search: null,
                        tagPath: null,
                        topicName: null,
                        isMissing: false
                    };
                }
                return {
                    key,
                    shortcut,
                    folder: null,
                    note: null,
                    search: null,
                    tagPath: null,
                    topicName: null,
                    isMissing: true
                };
            }

            if (isNoteShortcut(shortcut)) {
                const target = app.vault.getAbstractFileByPath(shortcut.path);
                if (isFile(target)) {
                    return {
                        key,
                        shortcut,
                        folder: null,
                        note: target,
                        search: null,
                        tagPath: null,
                        topicName: null,
                        isMissing: false
                    };
                }
                return {
                    key,
                    shortcut,
                    folder: null,
                    note: null,
                    search: null,
                    tagPath: null,
                    topicName: null,
                    isMissing: true
                };
            }

            if (isTagShortcut(shortcut)) {
                const normalizedTagPath = normalizeTagPath(shortcut.tagPath);
                return {
                    key,
                    shortcut,
                    folder: null,
                    note: null,
                    search: null,
                    tagPath: normalizedTagPath ?? shortcut.tagPath,
                    topicName: null,
                    isMissing: !normalizedTagPath
                };
            }

            if (isTopicShortcut(shortcut)) {
                return {
                    key,
                    shortcut,
                    folder: null,
                    note: null,
                    search: null,
                    tagPath: null,
                    topicName: shortcut.topicName,
                    isMissing: false
                };
            }

            // Search shortcut
            return {
                key,
                shortcut,
                folder: null,
                note: null,
                search: shortcut,
                tagPath: null,
                topicName: null,
                isMissing: false
            };
        });
    }, [app.vault, rawShortcuts, vaultChangeVersion]);

    // Inserts a shortcut at the specified index or appends to the end
    const insertShortcut = useCallback(
        async (shortcut: ShortcutEntry, index?: number) => {
            await updateSettings(current => {
                const existing = current.shortcuts ?? [];
                const next = [...existing];
                const insertAt = typeof index === 'number' ? Math.max(0, Math.min(index, next.length)) : next.length;
                next.splice(insertAt, 0, shortcut);
                current.shortcuts = next;
            });
            return true;
        },
        [updateSettings]
    );

    // Adds a folder shortcut if it doesn't already exist
    const addFolderShortcut = useCallback(
        async (path: string, options?: { index?: number }) => {
            if (folderShortcutKeysByPath.has(path)) {
                new Notice(strings.shortcuts.folderExists);
                return false;
            }
            return insertShortcut({ type: ShortcutType.FOLDER, path }, options?.index);
        },
        [insertShortcut, folderShortcutKeysByPath]
    );

    // Adds a note shortcut if it doesn't already exist
    const addNoteShortcut = useCallback(
        async (path: string, options?: { index?: number }) => {
            if (noteShortcutKeysByPath.has(path)) {
                new Notice(strings.shortcuts.noteExists);
                return false;
            }
            return insertShortcut({ type: ShortcutType.NOTE, path }, options?.index);
        },
        [insertShortcut, noteShortcutKeysByPath]
    );

    // Adds a tag shortcut if it doesn't already exist
    const addTagShortcut = useCallback(
        async (tagPath: string, options?: { index?: number }) => {
            const normalizedPath = normalizeTagPath(tagPath);
            if (!normalizedPath) {
                return false;
            }
            if (tagShortcutKeysByPath.has(normalizedPath)) {
                new Notice(strings.shortcuts.tagExists);
                return false;
            }
            return insertShortcut({ type: ShortcutType.TAG, tagPath: normalizedPath }, options?.index);
        },
        [insertShortcut, tagShortcutKeysByPath]
    );

    // Adds a topic shortcut if it doesn't already exist
    const addTopicShortcut = useCallback(
        async (topicName: string, options?: { index?: number }) => {
            if (topicShortcutKeysByName.has(topicName)) {
                new Notice(strings.shortcuts.topicExists || 'Topic shortcut already exists');
                return false;
            }
            return insertShortcut({ type: ShortcutType.TOPIC, topicName }, options?.index);
        },
        [insertShortcut, topicShortcutKeysByName]
    );

    // Adds a search shortcut with validation for name and query uniqueness
    const addSearchShortcut = useCallback(
        async ({ name, query, provider }: { name: string; query: string; provider: SearchProvider }, options?: { index?: number }) => {
            const normalizedQuery = query.trim();
            if (!normalizedQuery) {
                new Notice(strings.shortcuts.emptySearchQuery);
                return false;
            }

            const normalizedName = name.trim();
            if (!normalizedName) {
                new Notice(strings.shortcuts.emptySearchName);
                return false;
            }

            const nameKey = normalizedName.toLowerCase();
            if (searchShortcutsByName.has(nameKey)) {
                new Notice(strings.shortcuts.searchExists);
                return false;
            }

            return insertShortcut(
                {
                    type: ShortcutType.SEARCH,
                    name: normalizedName,
                    query: normalizedQuery,
                    provider
                },
                options?.index
            );
        },
        [insertShortcut, searchShortcutsByName]
    );

    // Removes a shortcut by its unique key
    const removeShortcut = useCallback(
        async (key: string) => {
            if (!shortcutMap.has(key)) {
                return false;
            }

            await updateSettings(current => {
                const existing = current.shortcuts ?? [];
                current.shortcuts = existing.filter(entry => getShortcutKey(entry) !== key);
            });

            return true;
        },
        [shortcutMap, updateSettings]
    );

    // Removes a search shortcut by its name (case-insensitive)
    const removeSearchShortcut = useCallback(
        async (name: string) => {
            const shortcut = searchShortcutsByName.get(name.trim().toLowerCase());
            if (!shortcut) {
                return false;
            }

            return removeShortcut(getShortcutKey(shortcut));
        },
        [removeShortcut, searchShortcutsByName]
    );

    // Reorders shortcuts based on provided key order (for drag & drop functionality)
    // Validates that all keys are present before applying the new order
    const reorderShortcuts = useCallback(
        async (orderedKeys: string[]) => {
            if (orderedKeys.length !== rawShortcuts.length) {
                return false;
            }

            const orderedEntries: ShortcutEntry[] = [];
            for (const key of orderedKeys) {
                const entry = shortcutMap.get(key);
                if (!entry) {
                    return false;
                }
                orderedEntries.push(entry);
            }

            await updateSettings(current => {
                current.shortcuts = orderedEntries;
            });

            return true;
        },
        [rawShortcuts.length, shortcutMap, updateSettings]
    );

    // Checks if a folder shortcut exists for the given path
    const hasFolderShortcut = useCallback((path: string) => folderShortcutKeysByPath.has(path), [folderShortcutKeysByPath]);
    // Checks if a note shortcut exists for the given path
    const hasNoteShortcut = useCallback((path: string) => noteShortcutKeysByPath.has(path), [noteShortcutKeysByPath]);
    // Checks if a tag shortcut exists for the given tag path
    const hasTagShortcut = useCallback(
        (tagPath: string) => {
            const normalized = normalizeTagPath(tagPath);
            return normalized ? tagShortcutKeysByPath.has(normalized) : false;
        },
        [tagShortcutKeysByPath]
    );
    // Checks if a topic shortcut exists for the given topic name
    const hasTopicShortcut = useCallback((topicName: string) => topicShortcutKeysByName.has(topicName), [topicShortcutKeysByName]);

    // Finds a search shortcut by name (case-insensitive)
    const findSearchShortcut = useCallback((name: string) => searchShortcutsByName.get(name.trim().toLowerCase()), [searchShortcutsByName]);

    const value: ShortcutsContextValue = useMemo(
        () => ({
            shortcuts: rawShortcuts,
            hydratedShortcuts,
            shortcutMap,
            folderShortcutKeysByPath,
            noteShortcutKeysByPath,
            tagShortcutKeysByPath,
            topicShortcutKeysByName,
            searchShortcutsByName,
            addFolderShortcut,
            addNoteShortcut,
            addTagShortcut,
            addTopicShortcut,
            addSearchShortcut,
            removeShortcut,
            removeSearchShortcut,
            reorderShortcuts,
            hasFolderShortcut,
            hasNoteShortcut,
            hasTagShortcut,
            hasTopicShortcut,
            findSearchShortcut
        }),
        [
            rawShortcuts,
            hydratedShortcuts,
            shortcutMap,
            folderShortcutKeysByPath,
            noteShortcutKeysByPath,
            tagShortcutKeysByPath,
            topicShortcutKeysByName,
            searchShortcutsByName,
            addFolderShortcut,
            addNoteShortcut,
            addTagShortcut,
            addTopicShortcut,
            addSearchShortcut,
            removeShortcut,
            removeSearchShortcut,
            reorderShortcuts,
            hasFolderShortcut,
            hasNoteShortcut,
            hasTagShortcut,
            hasTopicShortcut,
            findSearchShortcut
        ]
    );

    return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

/**
 * Hook to access the shortcuts context.
 * Must be used within a ShortcutsProvider.
 */
export function useShortcuts() {
    const context = useContext(ShortcutsContext);
    if (!context) {
        throw new Error('useShortcuts must be used within a ShortcutsProvider');
    }
    return context;
}
