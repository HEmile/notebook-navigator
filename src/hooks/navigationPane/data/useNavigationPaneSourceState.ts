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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TFolder, type App, debounce } from 'obsidian';
import type { ShortcutsContextValue } from '../../../context/ShortcutsContext';
import type { ActiveProfileState } from '../../../context/SettingsContext';
import type { StorageFileData } from '../../../context/storage/storageFileData';
import type { NotebookNavigatorSettings } from '../../../settings/types';
import type { MetadataService } from '../../../services/MetadataService';
import { getDBInstance, getDBInstanceOrNull } from '../../../storage/fileOperations';
import { PROPERTIES_ROOT_VIRTUAL_FOLDER_ID } from '../../../types';
import { FOLDER_NOTE_TYPE_EXTENSIONS } from '../../../types/folderNote';
import { TIMEOUTS } from '../../../types/obsidian-extended';
import type { PropertyTreeNode, TagTreeNode } from '../../../types/storage';
import { isPropertyShortcut } from '../../../types/shortcuts';
import { createFileHiddenMatcher, getEffectiveFrontmatterExclusions } from '../../../utils/exclusionUtils';
import {
    createFrontmatterPropertyExclusionMatcher,
    createHiddenFileNameMatcherForVisibility,
    shouldExcludeFileWithMatcher,
    type HiddenFileNameMatcher
} from '../../../utils/fileFilters';
import { resolveFolderDisplayName } from '../../../utils/folderDisplayName';
import { resolveFolderNoteName } from '../../../utils/folderNoteName';
import { getFolderNote, getFolderNoteDetectionSettings } from '../../../utils/folderNotes';
import { EXCALIDRAW_BASENAME_SUFFIX } from '../../../utils/fileNameUtils';
import { getParentFolderPath, getPathBaseName } from '../../../utils/pathUtils';
import { getDirectPropertyKeyNoteCount } from '../../../utils/propertyTree';
import { casefold } from '../../../utils/recordUtils';
import { createHiddenTagVisibility } from '../../../utils/tagPrefixMatcher';
import { excludeFromTagTree } from '../../../utils/tagTree';
import { getCachedFileTags } from '../../../utils/tagUtils';
import { useRootFolderOrder, type RootFileChangeEvent } from '../../useRootFolderOrder';
import { useRootPropertyOrder } from '../../useRootPropertyOrder';
import { useRootTagOrder } from '../../useRootTagOrder';
import {
    comparePropertyKeyNodesAlphabetically,
    compareTagAlphabetically,
    createPropertyComparator,
    createTagComparator,
    type PropertyNodeComparator,
    type TagComparator
} from './navigationComparators';

const FOLDER_SORT_NAME_CACHE_MAX_ENTRIES = 2000;
const FOLDER_NOTE_EXTENSIONS = new Set<string>(Object.values(FOLDER_NOTE_TYPE_EXTENSIONS));

export interface UseNavigationPaneSourceStateParams {
    app: App;
    settings: NotebookNavigatorSettings;
    activeProfile: ActiveProfileState;
    metadataService: MetadataService;
    fileData: StorageFileData;
    hydratedShortcuts: ShortcutsContextValue['hydratedShortcuts'];
    showHiddenItems: boolean;
    includeDescendantNotes: boolean;
}

export interface NavigationPaneSourceState {
    effectiveFrontmatterExclusions: string[];
    hiddenFolders: string[];
    hiddenFileProperties: string[];
    hiddenFileNames: string[];
    hiddenFileTags: string[];
    fileVisibility: ActiveProfileState['fileVisibility'];
    navigationBannerPath: string | null;
    folderCountFileNameMatcher: HiddenFileNameMatcher | null;
    hiddenFilePropertyMatcher: ReturnType<typeof createFrontmatterPropertyExclusionMatcher>;
    rootFolders: TFolder[];
    rootLevelFolders: TFolder[];
    rootFolderOrderMap: Map<string, number>;
    missingRootFolderPaths: string[];
    tagTree: Map<string, TagTreeNode>;
    propertyTree: Map<string, PropertyTreeNode>;
    untaggedCount: number;
    visibleTaggedCount: number;
    hiddenTagMatcher: ReturnType<typeof createHiddenTagVisibility>['matcher'];
    hiddenMatcherHasRules: boolean;
    visibleTagTree: Map<string, TagTreeNode>;
    hasRootPropertyShortcut: boolean;
    tagComparator: TagComparator | undefined;
    hiddenRootTagNodes: Map<string, TagTreeNode>;
    tagTreeForOrdering: Map<string, TagTreeNode>;
    rootTagOrderMap: Map<string, number>;
    missingRootTagPaths: string[];
    propertyKeyComparator: PropertyNodeComparator;
    rootPropertyOrderMap: Map<string, number>;
    missingRootPropertyKeys: string[];
    visiblePropertyNavigationKeySet: Set<string>;
    metadataDecorationVersion: number;
    getFolderSortName: (folder: TFolder) => string;
    folderExclusionByFolderNote: ((folder: TFolder) => boolean) | undefined;
    recentNotesHiddenFileMatcher: ReturnType<typeof createFileHiddenMatcher>;
    fileChangeVersion: number;
    bumpVaultChangeVersion: () => void;
}

export function useNavigationPaneSourceState({
    app,
    settings,
    activeProfile,
    metadataService,
    fileData,
    hydratedShortcuts,
    showHiddenItems,
    includeDescendantNotes
}: UseNavigationPaneSourceStateParams): NavigationPaneSourceState {
    const { hiddenFolders, hiddenFileProperties, hiddenFileNames, hiddenTags, hiddenFileTags, fileVisibility, navigationBanner } =
        activeProfile;
    const navigationBannerPath = navigationBanner;
    const effectiveFrontmatterExclusions = getEffectiveFrontmatterExclusions(settings, showHiddenItems);

    const folderCountFileNameMatcher = useMemo(() => {
        return createHiddenFileNameMatcherForVisibility(hiddenFileNames, showHiddenItems);
    }, [hiddenFileNames, showHiddenItems]);
    const folderVisibilityFileNameMatcher = useMemo(() => {
        return createHiddenFileNameMatcherForVisibility(hiddenFileNames, false);
    }, [hiddenFileNames]);
    const hiddenFilePropertyMatcher = useMemo(
        () => createFrontmatterPropertyExclusionMatcher(hiddenFileProperties),
        [hiddenFileProperties]
    );
    const folderNoteSettings = useMemo(() => {
        return getFolderNoteDetectionSettings({
            enableFolderNotes: settings.enableFolderNotes,
            folderNoteName: settings.folderNoteName,
            folderNoteNamePattern: settings.folderNoteNamePattern
        });
    }, [settings.enableFolderNotes, settings.folderNoteName, settings.folderNoteNamePattern]);
    const shouldEvaluateFolderNoteExclusions = useMemo(() => {
        return (
            settings.enableFolderNotes &&
            (hiddenFilePropertyMatcher.hasCriteria || folderVisibilityFileNameMatcher !== null || hiddenFileTags.length > 0)
        );
    }, [settings.enableFolderNotes, hiddenFilePropertyMatcher, hiddenFileTags, folderVisibilityFileNameMatcher]);

    const isFolderNoteRelatedPath = useCallback(
        (path: string): boolean => {
            if (!shouldEvaluateFolderNoteExclusions) {
                return false;
            }

            const parentPath = getParentFolderPath(path);
            if (parentPath === '/') {
                return false;
            }

            const fileName = path.split('/').pop();
            if (!fileName) {
                return false;
            }

            const dotIndex = fileName.lastIndexOf('.');
            if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
                return false;
            }

            const basename = fileName.slice(0, dotIndex);
            const extension = fileName.slice(dotIndex + 1).toLowerCase();
            const folderName = getPathBaseName(parentPath);
            const expectedName = resolveFolderNoteName(folderName, folderNoteSettings);

            if (basename === expectedName && FOLDER_NOTE_EXTENSIONS.has(extension)) {
                return true;
            }

            return extension === 'md' && basename === `${expectedName}${EXCALIDRAW_BASENAME_SUFFIX}`;
        },
        [folderNoteSettings, shouldEvaluateFolderNoteExclusions]
    );

    const [fileChangeVersion, setFileChangeVersion] = useState(0);
    const [folderExclusionVersion, setFolderExclusionVersion] = useState(0);
    const bumpVaultChangeVersion = useCallback(() => {
        setFileChangeVersion(value => value + 1);
    }, []);
    const handleRootFileChange = useCallback(
        (change: RootFileChangeEvent) => {
            bumpVaultChangeVersion();
            if (isFolderNoteRelatedPath(change.path) || (change.oldPath !== undefined && isFolderNoteRelatedPath(change.oldPath))) {
                setFolderExclusionVersion(value => value + 1);
            }
        },
        [bumpVaultChangeVersion, isFolderNoteRelatedPath]
    );

    const { rootFolders, rootLevelFolders, rootFolderOrderMap, missingRootFolderPaths } = useRootFolderOrder({
        settings,
        onFileChange: handleRootFileChange
    });

    const tagTree = useMemo(() => fileData.tagTree ?? new Map<string, TagTreeNode>(), [fileData.tagTree]);
    const propertyTree = useMemo(() => fileData.propertyTree ?? new Map<string, PropertyTreeNode>(), [fileData.propertyTree]);
    const untaggedCount = fileData.untagged;

    const hiddenTagVisibility = useMemo(() => createHiddenTagVisibility(hiddenTags, showHiddenItems), [hiddenTags, showHiddenItems]);
    const hiddenTagMatcher = hiddenTagVisibility.matcher;
    const hiddenMatcherHasRules = hiddenTagVisibility.hasHiddenRules;

    const visibleTagTree = useMemo(() => {
        if (!hiddenMatcherHasRules || showHiddenItems) {
            return tagTree;
        }
        return excludeFromTagTree(tagTree, hiddenTagMatcher);
    }, [tagTree, hiddenMatcherHasRules, showHiddenItems, hiddenTagMatcher]);

    const visibleTaggedCount = fileData.tagged ?? 0;

    const hasRootPropertyShortcut = useMemo(() => {
        return hydratedShortcuts.some(({ shortcut, propertyNodeId }) => {
            if (!isPropertyShortcut(shortcut)) {
                return false;
            }

            return propertyNodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID || shortcut.nodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID;
        });
    }, [hydratedShortcuts]);

    const tagComparator = useMemo(
        () => createTagComparator(settings.tagSortOrder, includeDescendantNotes),
        [settings.tagSortOrder, includeDescendantNotes]
    );

    const hiddenRootTagNodes = useMemo(() => {
        if (!settings.showTags || showHiddenItems) {
            return new Map<string, TagTreeNode>();
        }
        return fileData.hiddenRootTags ?? new Map<string, TagTreeNode>();
    }, [fileData.hiddenRootTags, showHiddenItems, settings.showTags]);

    const tagTreeForOrdering = useMemo(() => {
        if (hiddenRootTagNodes.size === 0) {
            return tagTree;
        }
        const combined = new Map<string, TagTreeNode>(tagTree);
        hiddenRootTagNodes.forEach((node, path) => {
            if (!combined.has(path)) {
                combined.set(path, node);
            }
        });
        return combined;
    }, [hiddenRootTagNodes, tagTree]);

    const { rootTagOrderMap, missingRootTagPaths } = useRootTagOrder({
        settings,
        tagTree: tagTreeForOrdering,
        comparator: tagComparator ?? compareTagAlphabetically
    });

    const propertyKeyComparator = useMemo(() => {
        return createPropertyComparator({
            order: settings.propertySortOrder,
            compareAlphabetically: comparePropertyKeyNodesAlphabetically,
            getFrequency: node => (includeDescendantNotes ? node.notesWithValue.size : getDirectPropertyKeyNoteCount(node))
        });
    }, [includeDescendantNotes, settings.propertySortOrder]);

    const { rootPropertyOrderMap, missingRootPropertyKeys } = useRootPropertyOrder({
        settings,
        propertyTree,
        comparator: propertyKeyComparator
    });

    const [folderDisplayNameVersion, setFolderDisplayNameVersion] = useState(() => metadataService.getFolderDisplayNameVersion());

    useEffect(() => {
        setFolderDisplayNameVersion(metadataService.getFolderDisplayNameVersion());
        const applyFolderDisplayNameVersion = debounce(
            (version: number) => {
                setFolderDisplayNameVersion(version);
            },
            TIMEOUTS.FILE_OPERATION_DELAY,
            true
        );
        const unsubscribe = metadataService.subscribeToFolderDisplayNameChanges(version => {
            applyFolderDisplayNameVersion(version);
        });

        return () => {
            unsubscribe();
            applyFolderDisplayNameVersion.cancel();
        };
    }, [metadataService]);

    const [metadataDecorationVersion, setMetadataDecorationVersion] = useState(0);

    useEffect(() => {
        const db = getDBInstance();
        const bumpFolderExclusionVersion = debounce(
            () => {
                setFolderExclusionVersion(version => version + 1);
            },
            TIMEOUTS.FILE_OPERATION_DELAY,
            true
        );
        const unsubscribe = db.onContentChange(changes => {
            let hasMetadataChange = false;
            let shouldRefreshFolderExclusions = false;
            const folderNotePathByParentPath = new Map<string, string | null>();

            for (const change of changes) {
                if (change.changeType !== 'metadata' && change.changeType !== 'both') {
                    continue;
                }

                hasMetadataChange = true;
                if (!shouldEvaluateFolderNoteExclusions || shouldRefreshFolderExclusions) {
                    continue;
                }

                const parentPath = getParentFolderPath(change.path);
                let cachedFolderNotePath = folderNotePathByParentPath.get(parentPath);
                if (cachedFolderNotePath === undefined) {
                    const parentFolder = app.vault.getFolderByPath(parentPath);
                    cachedFolderNotePath = parentFolder ? (getFolderNote(parentFolder, folderNoteSettings)?.path ?? null) : null;
                    folderNotePathByParentPath.set(parentPath, cachedFolderNotePath);
                }

                if (cachedFolderNotePath === change.path) {
                    shouldRefreshFolderExclusions = true;
                }
            }

            if (hasMetadataChange) {
                setMetadataDecorationVersion(version => version + 1);
                if (shouldRefreshFolderExclusions) {
                    bumpFolderExclusionVersion();
                }
            }
        });
        return () => {
            unsubscribe();
            bumpFolderExclusionVersion.cancel();
        };
    }, [app, folderNoteSettings, shouldEvaluateFolderNoteExclusions]);

    const visiblePropertyNavigationKeySet = useMemo(() => {
        const keys = new Set<string>();
        const seen = new Set<string>();
        const entries = activeProfile.profile.propertyKeys ?? [];
        entries.forEach(entry => {
            if (!entry.showInNavigation) {
                return;
            }

            const normalizedKey = casefold(entry.key);
            if (!normalizedKey || seen.has(normalizedKey)) {
                return;
            }

            seen.add(normalizedKey);
            keys.add(normalizedKey);
        });

        return keys;
    }, [activeProfile.profile.propertyKeys]);

    const getFolderSortName = useMemo(() => {
        void folderDisplayNameVersion;
        const folderSortNameByPath = new Map<string, string>();
        const cacheFolderSortName = (path: string, name: string): string => {
            if (folderSortNameByPath.size >= FOLDER_SORT_NAME_CACHE_MAX_ENTRIES) {
                folderSortNameByPath.clear();
            }
            folderSortNameByPath.set(path, name);
            return name;
        };

        return (folder: TFolder): string => {
            const cachedName = folderSortNameByPath.get(folder.path);
            if (cachedName !== undefined) {
                return cachedName;
            }

            if (!settings.useFrontmatterMetadata) {
                return cacheFolderSortName(folder.path, folder.name);
            }

            const resolvedName = resolveFolderDisplayName({
                app,
                metadataService,
                settings: {
                    customVaultName: settings.customVaultName
                },
                folderPath: folder.path,
                fallbackName: folder.name
            });
            return cacheFolderSortName(folder.path, resolvedName);
        };
    }, [app, settings.customVaultName, settings.useFrontmatterMetadata, metadataService, folderDisplayNameVersion]);

    const folderExclusionByFolderNote = useMemo(() => {
        void folderExclusionVersion;
        if (!shouldEvaluateFolderNoteExclusions) {
            return undefined;
        }

        const hiddenFileTagVisibility = createHiddenTagVisibility(hiddenFileTags, false);
        const shouldFilterHiddenFileTags = hiddenFileTagVisibility.hasHiddenRules;
        const db = shouldFilterHiddenFileTags ? getDBInstanceOrNull() : null;
        const directExclusionCache = new Map<string, boolean>();
        const inheritedExclusionCache = new Map<string, boolean>();
        const recursionGuard = new Set<string>();

        const isDirectlyExcludedByFolderNote = (folder: TFolder): boolean => {
            const cached = directExclusionCache.get(folder.path);
            if (cached !== undefined) {
                return cached;
            }

            const folderNote = getFolderNote(folder, folderNoteSettings);
            if (!folderNote) {
                directExclusionCache.set(folder.path, false);
                return false;
            }

            let isExcluded = false;
            if (hiddenFilePropertyMatcher.hasCriteria && shouldExcludeFileWithMatcher(folderNote, hiddenFilePropertyMatcher, app)) {
                isExcluded = true;
            }

            if (!isExcluded && folderVisibilityFileNameMatcher && folderVisibilityFileNameMatcher.matches(folderNote)) {
                isExcluded = true;
            }

            if (!isExcluded && shouldFilterHiddenFileTags) {
                const tags = getCachedFileTags({ app, file: folderNote, db });
                if (tags.some(tagValue => !hiddenFileTagVisibility.isTagVisible(tagValue))) {
                    isExcluded = true;
                }
            }

            directExclusionCache.set(folder.path, isExcluded);
            return isExcluded;
        };

        const isExcludedByFolderNote = (folder: TFolder): boolean => {
            if (folder.path === '/') {
                return false;
            }

            const cached = inheritedExclusionCache.get(folder.path);
            if (cached !== undefined) {
                return cached;
            }

            if (recursionGuard.has(folder.path)) {
                return false;
            }
            recursionGuard.add(folder.path);

            let isExcluded = isDirectlyExcludedByFolderNote(folder);
            if (!isExcluded && folder.parent instanceof TFolder) {
                isExcluded = isExcludedByFolderNote(folder.parent);
            }

            recursionGuard.delete(folder.path);
            inheritedExclusionCache.set(folder.path, isExcluded);
            return isExcluded;
        };

        return (folder: TFolder): boolean => isExcludedByFolderNote(folder);
    }, [
        app,
        folderExclusionVersion,
        hiddenFilePropertyMatcher,
        hiddenFileTags,
        folderVisibilityFileNameMatcher,
        folderNoteSettings,
        shouldEvaluateFolderNoteExclusions
    ]);

    const recentNotesHiddenFileMatcher = useMemo(() => {
        return createFileHiddenMatcher({ hiddenFileProperties, hiddenFolders, hiddenFileNames, hiddenFileTags }, app, showHiddenItems);
    }, [app, showHiddenItems, hiddenFileProperties, hiddenFolders, hiddenFileNames, hiddenFileTags]);

    return useMemo(
        () => ({
            effectiveFrontmatterExclusions,
            hiddenFolders,
            hiddenFileProperties,
            hiddenFileNames,
            hiddenFileTags,
            fileVisibility,
            navigationBannerPath,
            folderCountFileNameMatcher,
            hiddenFilePropertyMatcher,
            rootFolders,
            rootLevelFolders,
            rootFolderOrderMap,
            missingRootFolderPaths,
            tagTree,
            propertyTree,
            untaggedCount,
            visibleTaggedCount,
            hiddenTagMatcher,
            hiddenMatcherHasRules,
            visibleTagTree,
            hasRootPropertyShortcut,
            tagComparator,
            hiddenRootTagNodes,
            tagTreeForOrdering,
            rootTagOrderMap,
            missingRootTagPaths,
            propertyKeyComparator,
            rootPropertyOrderMap,
            missingRootPropertyKeys,
            visiblePropertyNavigationKeySet,
            metadataDecorationVersion,
            getFolderSortName,
            folderExclusionByFolderNote,
            recentNotesHiddenFileMatcher,
            fileChangeVersion,
            bumpVaultChangeVersion
        }),
        [
            effectiveFrontmatterExclusions,
            hiddenFolders,
            hiddenFileProperties,
            hiddenFileNames,
            hiddenFileTags,
            fileVisibility,
            navigationBannerPath,
            folderCountFileNameMatcher,
            hiddenFilePropertyMatcher,
            rootFolders,
            rootLevelFolders,
            rootFolderOrderMap,
            missingRootFolderPaths,
            tagTree,
            propertyTree,
            untaggedCount,
            visibleTaggedCount,
            hiddenTagMatcher,
            hiddenMatcherHasRules,
            visibleTagTree,
            hasRootPropertyShortcut,
            tagComparator,
            hiddenRootTagNodes,
            tagTreeForOrdering,
            rootTagOrderMap,
            missingRootTagPaths,
            propertyKeyComparator,
            rootPropertyOrderMap,
            missingRootPropertyKeys,
            visiblePropertyNavigationKeySet,
            metadataDecorationVersion,
            getFolderSortName,
            folderExclusionByFolderNote,
            recentNotesHiddenFileMatcher,
            fileChangeVersion,
            bumpVaultChangeVersion
        ]
    );
}
