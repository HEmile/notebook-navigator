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

import { EventRef, TFile } from 'obsidian';
import { SortOption, type AlphaSortOrder, type NotebookNavigatorSettings } from '../../settings';
import { ItemType } from '../../types';
import { isFolderShortcut } from '../../types/shortcuts';
import { BaseMetadataService } from './BaseMetadataService';
import type { CleanupValidators } from '../MetadataService';
import { getFolderNote, getFolderNoteDetectionSettings } from '../../utils/folderNotes';
import { resolveFolderNoteName } from '../../utils/folderNoteName';
import { getDBInstanceOrNull } from '../../storage/fileOperations';
import type { FileContentChange } from '../../storage/IndexedDBStorage';
import { normalizeCanonicalIconId, serializeIconForFrontmatter } from '../../utils/iconizeFormat';
import { ensureRecord, isStringRecordValue } from '../../utils/recordUtils';
import { getParentFolderPath } from '../../utils/pathUtils';

/**
 * Service for managing folder-specific metadata operations
 * Handles folder colors, icons, sort overrides, and cleanup operations
 */
type SettingsMutation = (settings: NotebookNavigatorSettings) => boolean;

export interface FolderDisplayData {
    displayName?: string;
    color?: string;
    backgroundColor?: string;
    icon?: string;
}

interface FolderDisplayResolveOptions {
    includeDisplayName: boolean;
    includeColor: boolean;
    includeBackgroundColor: boolean;
    includeIcon: boolean;
    includeInheritedColors: boolean;
}

interface FolderStyleUpdate {
    icon?: string | null;
    color?: string | null;
    backgroundColor?: string | null;
}

interface FolderStyleValues {
    icon?: string;
    color?: string;
    backgroundColor?: string;
}

interface FolderFrontmatterFields {
    iconField?: string;
    colorField?: string;
    backgroundField?: string;
}

interface SettingsUpdateListenerProvider {
    registerSettingsUpdateListener(id: string, callback: () => void): void;
    unregisterSettingsUpdateListener(id: string): void;
}

interface FolderDisplayCacheSettingsSnapshot {
    useFrontmatterMetadata: boolean;
    enableFolderNotes: boolean;
    inheritFolderColors: boolean;
    folderNoteName: string;
    folderNoteNamePattern: string;
    frontmatterNameField: string;
    frontmatterIconField: string;
    frontmatterColorField: string;
    frontmatterBackgroundField: string;
}

interface FolderStyleRecordSnapshot {
    icons: Record<string, string> | null;
    colors: Record<string, string> | null;
    backgrounds: Record<string, string> | null;
}

export class FolderMetadataService extends BaseMetadataService {
    private folderStyleChangeListener: ((folderPath: string) => void) | null = null;
    private readonly folderDisplayDataCache = new Map<string, FolderDisplayData>();
    private readonly folderDisplayCacheKeysByFolderPath = new Map<string, Set<string>>();
    private readonly folderDisplayCacheFolderPathByKey = new Map<string, string>();
    private readonly folderDisplayCacheFolderNotesByFolderPath = new Map<string, string | null>();
    private readonly folderDisplayCacheFolderPathsByFolderNotePath = new Map<string, Set<string>>();
    private readonly folderDisplayCacheVaultEventRefs: EventRef[] = [];
    private folderDisplayCacheSettingsListenerProvider: SettingsUpdateListenerProvider | null = null;
    private readonly folderDisplayCacheSettingsListenerId: string;
    private folderDisplayCacheStyleRecordSnapshot: FolderStyleRecordSnapshot = {
        icons: null,
        colors: null,
        backgrounds: null
    };
    private folderDisplayCacheStyleRecordSnapshotInitialized = false;
    private folderDisplayCacheSettingsSnapshotInitialized = false;
    private folderDisplayCacheSettingsUseFrontmatterMetadata = false;
    private folderDisplayCacheSettingsEnableFolderNotes = false;
    private folderDisplayCacheSettingsInheritFolderColors = false;
    private folderDisplayCacheSettingsFolderNoteName = '';
    private folderDisplayCacheSettingsFolderNoteNamePattern = '';
    private folderDisplayCacheSettingsFrontmatterNameField = '';
    private folderDisplayCacheSettingsFrontmatterIconField = '';
    private folderDisplayCacheSettingsFrontmatterColorField = '';
    private folderDisplayCacheSettingsFrontmatterBackgroundField = '';
    private folderDisplayCacheUnsubscribe: (() => void) | null = null;
    private folderDisplayNameVersion = 0;
    private folderDisplayNameListeners = new Set<(version: number) => void>();
    private static readonly FOLDER_DISPLAY_CACHE_MAX_ENTRIES = 1000;
    private static readonly FOLDER_NOTE_CANDIDATE_EXTENSIONS = new Set<string>(['md', 'canvas', 'base']);
    private static readonly EXCALIDRAW_BASENAME_SUFFIX = '.excalidraw';
    private static folderDisplayCacheSettingsListenerCounter = 0;

    constructor(...args: ConstructorParameters<typeof BaseMetadataService>) {
        super(...args);
        FolderMetadataService.folderDisplayCacheSettingsListenerCounter += 1;
        this.folderDisplayCacheSettingsListenerId = `folder-display-cache-${FolderMetadataService.folderDisplayCacheSettingsListenerCounter}`;
    }

    private clearFolderDisplayDataCache(): void {
        if (this.folderDisplayDataCache.size > 0) {
            this.folderDisplayDataCache.clear();
        }
        if (this.folderDisplayCacheKeysByFolderPath.size > 0) {
            this.folderDisplayCacheKeysByFolderPath.clear();
        }
        if (this.folderDisplayCacheFolderPathByKey.size > 0) {
            this.folderDisplayCacheFolderPathByKey.clear();
        }
        if (this.folderDisplayCacheFolderNotesByFolderPath.size > 0) {
            this.folderDisplayCacheFolderNotesByFolderPath.clear();
        }
        if (this.folderDisplayCacheFolderPathsByFolderNotePath.size > 0) {
            this.folderDisplayCacheFolderPathsByFolderNotePath.clear();
        }
        this.resetFolderStyleRecordSnapshot();
    }

    private resetFolderStyleRecordSnapshot(): void {
        this.folderDisplayCacheStyleRecordSnapshot = {
            icons: null,
            colors: null,
            backgrounds: null
        };
        this.folderDisplayCacheStyleRecordSnapshotInitialized = false;
    }

    private getCurrentFolderDisplayCacheSettingsSnapshot(): FolderDisplayCacheSettingsSnapshot {
        const settings = this.settingsProvider.settings;
        return {
            useFrontmatterMetadata: settings.useFrontmatterMetadata,
            enableFolderNotes: settings.enableFolderNotes,
            inheritFolderColors: settings.inheritFolderColors,
            folderNoteName: settings.folderNoteName.trim(),
            folderNoteNamePattern: settings.folderNoteNamePattern.trim(),
            frontmatterNameField: settings.frontmatterNameField.trim(),
            frontmatterIconField: settings.frontmatterIconField.trim(),
            frontmatterColorField: settings.frontmatterColorField.trim(),
            frontmatterBackgroundField: settings.frontmatterBackgroundField.trim()
        };
    }

    private captureFolderDisplayCacheSettingsSnapshot(snapshot: FolderDisplayCacheSettingsSnapshot): void {
        this.folderDisplayCacheSettingsUseFrontmatterMetadata = snapshot.useFrontmatterMetadata;
        this.folderDisplayCacheSettingsEnableFolderNotes = snapshot.enableFolderNotes;
        this.folderDisplayCacheSettingsInheritFolderColors = snapshot.inheritFolderColors;
        this.folderDisplayCacheSettingsFolderNoteName = snapshot.folderNoteName;
        this.folderDisplayCacheSettingsFolderNoteNamePattern = snapshot.folderNoteNamePattern;
        this.folderDisplayCacheSettingsFrontmatterNameField = snapshot.frontmatterNameField;
        this.folderDisplayCacheSettingsFrontmatterIconField = snapshot.frontmatterIconField;
        this.folderDisplayCacheSettingsFrontmatterColorField = snapshot.frontmatterColorField;
        this.folderDisplayCacheSettingsFrontmatterBackgroundField = snapshot.frontmatterBackgroundField;
        this.folderDisplayCacheSettingsSnapshotInitialized = true;
    }

    private hasFolderDisplayCacheSettingsSnapshotChanged(snapshot: FolderDisplayCacheSettingsSnapshot): boolean {
        if (!this.folderDisplayCacheSettingsSnapshotInitialized) {
            return true;
        }

        return (
            this.folderDisplayCacheSettingsUseFrontmatterMetadata !== snapshot.useFrontmatterMetadata ||
            this.folderDisplayCacheSettingsEnableFolderNotes !== snapshot.enableFolderNotes ||
            this.folderDisplayCacheSettingsInheritFolderColors !== snapshot.inheritFolderColors ||
            this.folderDisplayCacheSettingsFolderNoteName !== snapshot.folderNoteName ||
            this.folderDisplayCacheSettingsFolderNoteNamePattern !== snapshot.folderNoteNamePattern ||
            this.folderDisplayCacheSettingsFrontmatterNameField !== snapshot.frontmatterNameField ||
            this.folderDisplayCacheSettingsFrontmatterIconField !== snapshot.frontmatterIconField ||
            this.folderDisplayCacheSettingsFrontmatterColorField !== snapshot.frontmatterColorField ||
            this.folderDisplayCacheSettingsFrontmatterBackgroundField !== snapshot.frontmatterBackgroundField
        );
    }

    private hasFolderDisplayNameSettingsSnapshotChanged(snapshot: FolderDisplayCacheSettingsSnapshot): boolean {
        if (!this.folderDisplayCacheSettingsSnapshotInitialized) {
            return true;
        }

        return (
            this.folderDisplayCacheSettingsUseFrontmatterMetadata !== snapshot.useFrontmatterMetadata ||
            this.folderDisplayCacheSettingsEnableFolderNotes !== snapshot.enableFolderNotes ||
            this.folderDisplayCacheSettingsFolderNoteName !== snapshot.folderNoteName ||
            this.folderDisplayCacheSettingsFolderNoteNamePattern !== snapshot.folderNoteNamePattern ||
            this.folderDisplayCacheSettingsFrontmatterNameField !== snapshot.frontmatterNameField
        );
    }

    private getSettingsUpdateListenerProvider(): SettingsUpdateListenerProvider | null {
        const providerCandidate: unknown = this.settingsProvider;
        if (!providerCandidate || typeof providerCandidate !== 'object') {
            return null;
        }

        const provider = providerCandidate as {
            registerSettingsUpdateListener?: unknown;
            unregisterSettingsUpdateListener?: unknown;
        };
        if (
            typeof provider.registerSettingsUpdateListener !== 'function' ||
            typeof provider.unregisterSettingsUpdateListener !== 'function'
        ) {
            return null;
        }

        return provider as SettingsUpdateListenerProvider;
    }

    private cloneStringRecord(record: Record<string, string> | undefined): Record<string, string> | null {
        if (!record) {
            return null;
        }

        const keys = Object.keys(record);
        if (keys.length === 0) {
            return null;
        }

        const clone = Object.create(null) as Record<string, string>;
        for (const key of keys) {
            clone[key] = record[key];
        }
        return clone;
    }

    private areStringRecordsEqual(left: Record<string, string> | null, right: Record<string, string> | undefined): boolean {
        const rightRecord = right;
        const rightKeys = rightRecord ? Object.keys(rightRecord) : [];
        const leftKeys = left ? Object.keys(left) : [];
        if (leftKeys.length !== rightKeys.length) {
            return false;
        }

        for (const key of rightKeys) {
            if (!left || !rightRecord || left[key] !== rightRecord[key]) {
                return false;
            }
        }

        return true;
    }

    private captureFolderStyleRecordSnapshot(): void {
        const settings = this.settingsProvider.settings;
        this.folderDisplayCacheStyleRecordSnapshot = {
            icons: this.cloneStringRecord(settings.folderIcons),
            colors: this.cloneStringRecord(settings.folderColors),
            backgrounds: this.cloneStringRecord(settings.folderBackgroundColors)
        };
        this.folderDisplayCacheStyleRecordSnapshotInitialized = true;
    }

    private hasFolderStyleRecordSnapshotChanged(): boolean {
        const settings = this.settingsProvider.settings;
        return (
            !this.areStringRecordsEqual(this.folderDisplayCacheStyleRecordSnapshot.icons, settings.folderIcons) ||
            !this.areStringRecordsEqual(this.folderDisplayCacheStyleRecordSnapshot.colors, settings.folderColors) ||
            !this.areStringRecordsEqual(this.folderDisplayCacheStyleRecordSnapshot.backgrounds, settings.folderBackgroundColors)
        );
    }

    private handleFolderDisplayCacheSettingsUpdate(): void {
        let shouldClear = false;
        const settingsSnapshot = this.getCurrentFolderDisplayCacheSettingsSnapshot();
        const folderDisplayNameSettingsChanged = this.hasFolderDisplayNameSettingsSnapshotChanged(settingsSnapshot);

        if (this.hasFolderDisplayCacheSettingsSnapshotChanged(settingsSnapshot)) {
            this.captureFolderDisplayCacheSettingsSnapshot(settingsSnapshot);
            shouldClear = true;
        }

        if (
            this.folderDisplayDataCache.size > 0 &&
            this.folderDisplayCacheStyleRecordSnapshotInitialized &&
            this.hasFolderStyleRecordSnapshotChanged()
        ) {
            shouldClear = true;
        }

        if (shouldClear) {
            this.clearFolderDisplayDataCache();
        }
        if (folderDisplayNameSettingsChanged) {
            this.markFolderDisplayNamesChanged();
        }
    }

    private ensureFolderDisplayCacheSettingsListener(): void {
        if (this.folderDisplayCacheSettingsListenerProvider) {
            return;
        }

        const provider = this.getSettingsUpdateListenerProvider();
        if (!provider) {
            return;
        }

        provider.registerSettingsUpdateListener(this.folderDisplayCacheSettingsListenerId, () => {
            this.handleFolderDisplayCacheSettingsUpdate();
        });
        this.folderDisplayCacheSettingsListenerProvider = provider;
    }

    private addFolderPathForTrackedFolderNotePath(folderNotePath: string, folderPath: string): void {
        const folderPaths = this.folderDisplayCacheFolderPathsByFolderNotePath.get(folderNotePath);
        if (folderPaths) {
            folderPaths.add(folderPath);
            return;
        }

        this.folderDisplayCacheFolderPathsByFolderNotePath.set(folderNotePath, new Set([folderPath]));
    }

    private removeFolderPathFromTrackedFolderNotePath(folderNotePath: string, folderPath: string): void {
        const folderPaths = this.folderDisplayCacheFolderPathsByFolderNotePath.get(folderNotePath);
        if (!folderPaths) {
            return;
        }

        folderPaths.delete(folderPath);
        if (folderPaths.size === 0) {
            this.folderDisplayCacheFolderPathsByFolderNotePath.delete(folderNotePath);
        }
    }

    private updateTrackedFolderNotePath(folderPath: string, folderNotePath: string | null): void {
        const previousPath = this.folderDisplayCacheFolderNotesByFolderPath.get(folderPath);
        if (previousPath === folderNotePath) {
            return;
        }

        if (previousPath !== undefined) {
            this.folderDisplayCacheFolderNotesByFolderPath.delete(folderPath);
            if (previousPath) {
                this.removeFolderPathFromTrackedFolderNotePath(previousPath, folderPath);
            }
        }

        this.folderDisplayCacheFolderNotesByFolderPath.set(folderPath, folderNotePath);
        if (folderNotePath) {
            this.addFolderPathForTrackedFolderNotePath(folderNotePath, folderPath);
        }
    }

    private untrackFolderNotePathForCachedFolder(folderPath: string): void {
        const previousPath = this.folderDisplayCacheFolderNotesByFolderPath.get(folderPath);
        if (previousPath === undefined) {
            return;
        }

        this.folderDisplayCacheFolderNotesByFolderPath.delete(folderPath);
        if (previousPath) {
            this.removeFolderPathFromTrackedFolderNotePath(previousPath, folderPath);
        }
    }

    private removeFolderDisplayCacheEntry(cacheKey: string): void {
        this.folderDisplayDataCache.delete(cacheKey);
        if (this.folderDisplayDataCache.size === 0) {
            this.resetFolderStyleRecordSnapshot();
        }
        const folderPath = this.folderDisplayCacheFolderPathByKey.get(cacheKey);
        if (!folderPath) {
            return;
        }

        this.folderDisplayCacheFolderPathByKey.delete(cacheKey);
        const cacheKeys = this.folderDisplayCacheKeysByFolderPath.get(folderPath);
        if (!cacheKeys) {
            return;
        }

        cacheKeys.delete(cacheKey);
        if (cacheKeys.size === 0) {
            this.folderDisplayCacheKeysByFolderPath.delete(folderPath);
            this.untrackFolderNotePathForCachedFolder(folderPath);
        }
    }

    private invalidateFolderDisplayCacheForFolder(folderPath: string): void {
        const cacheKeys = this.folderDisplayCacheKeysByFolderPath.get(folderPath);
        if (!cacheKeys || cacheKeys.size === 0) {
            this.untrackFolderNotePathForCachedFolder(folderPath);
            return;
        }

        const keys = Array.from(cacheKeys);
        for (const key of keys) {
            this.removeFolderDisplayCacheEntry(key);
        }
    }

    private isFolderPathWithinSubtree(rootFolderPath: string, folderPath: string): boolean {
        if (rootFolderPath === '/') {
            return true;
        }
        return folderPath === rootFolderPath || folderPath.startsWith(`${rootFolderPath}/`);
    }

    private invalidateFolderDisplayCacheForFolderAndDescendants(folderPath: string): void {
        if (folderPath === '/') {
            this.clearFolderDisplayDataCache();
            return;
        }

        const cachedFolderPaths = Array.from(this.folderDisplayCacheKeysByFolderPath.keys());
        for (const cachedFolderPath of cachedFolderPaths) {
            if (!this.isFolderPathWithinSubtree(folderPath, cachedFolderPath)) {
                continue;
            }

            this.invalidateFolderDisplayCacheForFolder(cachedFolderPath);
        }
    }

    private getCurrentFolderNotePath(folderPath: string): string | null {
        const folderNote = this.getFolderNoteFile(folderPath);
        return folderNote ? folderNote.path : null;
    }

    private invalidateFolderDisplayCacheForContentChanges(changes: FileContentChange[]): boolean {
        const settings = this.settingsProvider.settings;
        if (!settings.useFrontmatterMetadata || !settings.enableFolderNotes) {
            return false;
        }

        const hasFolderDisplayNameChange = this.hasFolderDisplayNameMetadataChanges(changes);

        if (this.folderDisplayDataCache.size === 0) {
            return hasFolderDisplayNameChange;
        }

        const affectedFolderPaths = new Set<string>();
        for (const change of changes) {
            const folderPaths = this.folderDisplayCacheFolderPathsByFolderNotePath.get(change.path);
            if (!folderPaths) {
                continue;
            }

            for (const folderPath of folderPaths) {
                affectedFolderPaths.add(folderPath);
            }
        }

        for (const folderPath of affectedFolderPaths) {
            this.invalidateFolderDisplayCacheForFolderAndDescendants(folderPath);
        }

        return hasFolderDisplayNameChange;
    }

    hasFolderDisplayNameMetadataChanges(changes: FileContentChange[]): boolean {
        const settings = this.settingsProvider.settings;
        if (!settings.useFrontmatterMetadata || !settings.enableFolderNotes) {
            return false;
        }

        const folderNoteSettings = getFolderNoteDetectionSettings(settings);
        const checkedCandidatePaths = new Set<string>();
        const expectedFolderNoteNameByFolderPath = new Map<string, string>();
        for (const change of changes) {
            if (change.changes.metadata === undefined || change.metadataNameChanged !== true) {
                continue;
            }

            if (this.folderDisplayCacheFolderPathsByFolderNotePath.has(change.path)) {
                return true;
            }

            if (!this.isFolderNoteCandidatePath(change.path)) {
                continue;
            }

            if (checkedCandidatePaths.has(change.path)) {
                continue;
            }
            checkedCandidatePaths.add(change.path);

            const parentFolderPath = getParentFolderPath(change.path);
            let expectedFolderNoteName = expectedFolderNoteNameByFolderPath.get(parentFolderPath);
            if (expectedFolderNoteName === undefined) {
                const folderName = this.getFolderNameFromPath(parentFolderPath);
                expectedFolderNoteName = resolveFolderNoteName(folderName, folderNoteSettings);
                expectedFolderNoteNameByFolderPath.set(parentFolderPath, expectedFolderNoteName);
            }

            if (this.isFolderNotePathForExpectedName(change.path, expectedFolderNoteName)) {
                return true;
            }
        }

        return false;
    }

    private getFolderNameFromPath(folderPath: string): string {
        if (folderPath === '/') {
            return this.app.vault.getRoot().name;
        }

        const separatorIndex = folderPath.lastIndexOf('/');
        if (separatorIndex === -1) {
            return folderPath;
        }
        return folderPath.slice(separatorIndex + 1);
    }

    private getPathExtension(path: string): string {
        const fileName = path.split('/').pop() ?? '';
        const dotIndex = fileName.lastIndexOf('.');
        if (dotIndex === -1 || dotIndex === fileName.length - 1) {
            return '';
        }
        return fileName.slice(dotIndex + 1).toLowerCase();
    }

    private getPathBasename(path: string): string {
        const fileName = path.split('/').pop() ?? '';
        const dotIndex = fileName.lastIndexOf('.');
        if (dotIndex === -1) {
            return fileName;
        }
        return fileName.slice(0, dotIndex);
    }

    private isFolderNoteCandidatePath(path: string): boolean {
        const extension = this.getPathExtension(path);
        return FolderMetadataService.FOLDER_NOTE_CANDIDATE_EXTENSIONS.has(extension);
    }

    private isFolderNotePathForExpectedName(path: string, expectedName: string): boolean {
        if (!this.isFolderNoteCandidatePath(path)) {
            return false;
        }

        const extension = this.getPathExtension(path);
        const basename = this.getPathBasename(path);
        if (basename === expectedName) {
            return true;
        }

        return extension === 'md' && basename === `${expectedName}${FolderMetadataService.EXCALIDRAW_BASENAME_SUFFIX}`;
    }

    private isFolderNotePathForFolder(path: string, folderPath: string): boolean {
        const folder = this.app.vault.getFolderByPath(folderPath);
        if (!folder) {
            return false;
        }

        const expectedName = resolveFolderNoteName(folder.name, getFolderNoteDetectionSettings(this.settingsProvider.settings));
        return this.isFolderNotePathForExpectedName(path, expectedName);
    }

    private invalidateFolderDisplayCacheForVaultFilePath(path: string): void {
        this.invalidateFolderDisplayCacheForContentChanges([{ path, changes: {} }]);

        const parentFolderPath = getParentFolderPath(path);
        if (!this.isFolderNotePathForFolder(path, parentFolderPath)) {
            return;
        }
        this.invalidateFolderDisplayCacheForFolderAndDescendants(parentFolderPath);
    }

    private handleFolderDisplayCacheVaultCreateOrDelete(file: unknown): void {
        if (!(file instanceof TFile)) {
            return;
        }

        const settings = this.settingsProvider.settings;
        if (!settings.useFrontmatterMetadata || !settings.enableFolderNotes) {
            return;
        }

        const parentFolderPath = getParentFolderPath(file.path);
        const isTrackedFolderNotePath = this.folderDisplayCacheFolderPathsByFolderNotePath.has(file.path);
        const isFolderNotePath = this.isFolderNotePathForFolder(file.path, parentFolderPath);
        this.invalidateFolderDisplayCacheForVaultFilePath(file.path);
        if (isTrackedFolderNotePath || isFolderNotePath) {
            this.markFolderDisplayNamesChanged();
        }
    }

    private handleFolderDisplayCacheVaultRename(file: unknown, oldPath: unknown): void {
        if (!(file instanceof TFile) || typeof oldPath !== 'string') {
            return;
        }

        const settings = this.settingsProvider.settings;
        if (!settings.useFrontmatterMetadata || !settings.enableFolderNotes) {
            return;
        }

        const oldParentFolderPath = getParentFolderPath(oldPath);
        const newParentFolderPath = getParentFolderPath(file.path);
        const hadTrackedOldPath = this.folderDisplayCacheFolderPathsByFolderNotePath.has(oldPath);
        const hasTrackedNewPath = this.folderDisplayCacheFolderPathsByFolderNotePath.has(file.path);
        const oldPathWasFolderNote = this.isFolderNotePathForFolder(oldPath, oldParentFolderPath);
        const newPathIsFolderNote = this.isFolderNotePathForFolder(file.path, newParentFolderPath);
        this.invalidateFolderDisplayCacheForVaultFilePath(oldPath);
        this.invalidateFolderDisplayCacheForVaultFilePath(file.path);
        if (hadTrackedOldPath || hasTrackedNewPath || oldPathWasFolderNote || newPathIsFolderNote) {
            this.markFolderDisplayNamesChanged();
        }
    }

    private ensureFolderDisplayCacheVaultListeners(): void {
        if (this.folderDisplayCacheVaultEventRefs.length > 0) {
            return;
        }

        const createRef = this.app.vault.on('create', file => {
            this.handleFolderDisplayCacheVaultCreateOrDelete(file);
        });
        const deleteRef = this.app.vault.on('delete', file => {
            this.handleFolderDisplayCacheVaultCreateOrDelete(file);
        });
        const renameRef = this.app.vault.on('rename', (file, oldPath) => {
            this.handleFolderDisplayCacheVaultRename(file, oldPath);
        });
        this.folderDisplayCacheVaultEventRefs.push(createRef, deleteRef, renameRef);
    }

    private ensureFolderDisplayCacheState(): void {
        const settingsSnapshot = this.getCurrentFolderDisplayCacheSettingsSnapshot();
        if (this.hasFolderDisplayCacheSettingsSnapshotChanged(settingsSnapshot)) {
            this.captureFolderDisplayCacheSettingsSnapshot(settingsSnapshot);
            this.clearFolderDisplayDataCache();
        }
        this.ensureFolderDisplayCacheSettingsListener();

        if (!this.folderDisplayCacheUnsubscribe) {
            const db = getDBInstanceOrNull();
            if (db) {
                this.folderDisplayCacheUnsubscribe = db.onContentChange(changes => {
                    const hasFolderDisplayNameChanges = this.invalidateFolderDisplayCacheForContentChanges(changes);
                    if (hasFolderDisplayNameChanges) {
                        this.markFolderDisplayNamesChanged();
                    }
                });
            }
        }
        this.ensureFolderDisplayCacheVaultListeners();
    }

    private markFolderDisplayNamesChanged(): void {
        this.folderDisplayNameVersion += 1;
        this.folderDisplayNameListeners.forEach(listener => listener(this.folderDisplayNameVersion));
    }

    getFolderDisplayNameVersion(): number {
        return this.folderDisplayNameVersion;
    }

    subscribeToFolderDisplayNameChanges(listener: (version: number) => void): () => void {
        this.folderDisplayNameListeners.add(listener);
        return () => this.folderDisplayNameListeners.delete(listener);
    }

    dispose(): void {
        if (this.folderDisplayCacheUnsubscribe) {
            this.folderDisplayCacheUnsubscribe();
            this.folderDisplayCacheUnsubscribe = null;
        }
        if (this.folderDisplayNameListeners.size > 0) {
            this.folderDisplayNameListeners.clear();
        }
        if (this.folderDisplayCacheSettingsListenerProvider) {
            this.folderDisplayCacheSettingsListenerProvider.unregisterSettingsUpdateListener(this.folderDisplayCacheSettingsListenerId);
            this.folderDisplayCacheSettingsListenerProvider = null;
        }
        if (this.folderDisplayCacheVaultEventRefs.length > 0) {
            this.folderDisplayCacheVaultEventRefs.forEach(eventRef => {
                this.app.vault.offref(eventRef);
            });
            this.folderDisplayCacheVaultEventRefs.length = 0;
        }
        this.clearFolderDisplayDataCache();
    }

    private createFolderDisplayCacheKey(folderPath: string, options: FolderDisplayResolveOptions): string {
        return [
            folderPath,
            options.includeDisplayName ? '1' : '0',
            options.includeColor ? '1' : '0',
            options.includeBackgroundColor ? '1' : '0',
            options.includeIcon ? '1' : '0',
            options.includeInheritedColors ? '1' : '0'
        ].join('|');
    }

    private getFolderDisplayCacheValue(key: string): FolderDisplayData | undefined {
        const cached = this.folderDisplayDataCache.get(key);
        if (!cached) {
            return undefined;
        }

        // Move hit to the end to keep insertion order as LRU order.
        this.folderDisplayDataCache.delete(key);
        this.folderDisplayDataCache.set(key, cached);
        return cached;
    }

    private setFolderDisplayCacheValue(folderPath: string, key: string, data: FolderDisplayData): void {
        this.removeFolderDisplayCacheEntry(key);

        this.folderDisplayDataCache.set(key, data);
        if (!this.folderDisplayCacheStyleRecordSnapshotInitialized) {
            this.captureFolderStyleRecordSnapshot();
        }
        let cacheKeys = this.folderDisplayCacheKeysByFolderPath.get(folderPath);
        if (!cacheKeys) {
            cacheKeys = new Set<string>();
            this.folderDisplayCacheKeysByFolderPath.set(folderPath, cacheKeys);
        }
        cacheKeys.add(key);
        this.folderDisplayCacheFolderPathByKey.set(key, folderPath);
        if (this.folderDisplayDataCache.size <= FolderMetadataService.FOLDER_DISPLAY_CACHE_MAX_ENTRIES) {
            return;
        }

        const oldestEntry = this.folderDisplayDataCache.entries().next();
        if (!oldestEntry.done) {
            const [oldestKey] = oldestEntry.value;
            this.removeFolderDisplayCacheEntry(oldestKey);
        }
    }

    setFolderStyleChangeListener(listener: ((folderPath: string) => void) | null): void {
        this.folderStyleChangeListener = listener;
    }

    isFolderStyleEventBridgeEnabled(): boolean {
        return this.folderStyleChangeListener !== null;
    }

    private hasFolderDisplayStyleChanged(left: FolderDisplayData, right: FolderDisplayData): boolean {
        return left.color !== right.color || left.backgroundColor !== right.backgroundColor || left.icon !== right.icon;
    }

    /**
     * Validates that a folder exists in the vault
     */
    private validateFolder(folderPath: string): boolean {
        return this.app.vault.getFolderByPath(folderPath) !== null;
    }

    private getFolderFrontmatterFields(): FolderFrontmatterFields {
        const settings = this.settingsProvider.settings;
        const iconField = settings.frontmatterIconField.trim();
        const colorField = settings.frontmatterColorField.trim();
        const backgroundField = settings.frontmatterBackgroundField.trim();

        return {
            iconField: iconField.length > 0 ? iconField : undefined,
            colorField: colorField.length > 0 ? colorField : undefined,
            backgroundField: backgroundField.length > 0 ? backgroundField : undefined
        };
    }

    private getFolderNoteFile(folderPath: string): TFile | null {
        const settings = this.settingsProvider.settings;
        if (!settings.enableFolderNotes) {
            return null;
        }

        const folder = this.app.vault.getFolderByPath(folderPath);
        if (!folder) {
            return null;
        }

        const detectionSettings = getFolderNoteDetectionSettings(settings);
        const folderNote = getFolderNote(folder, detectionSettings);
        if (!folderNote || folderNote.extension !== 'md') {
            return null;
        }

        return folderNote;
    }

    private getFolderStyleFromSettings(folderPath: string): FolderStyleValues {
        return {
            icon: this.getEntityIcon(ItemType.FOLDER, folderPath),
            color: this.getEntityColor(ItemType.FOLDER, folderPath),
            backgroundColor: this.getEntityBackgroundColor(ItemType.FOLDER, folderPath)
        };
    }

    private trackFolderNotePathForCachedFolder(folderPath: string): void {
        const settings = this.settingsProvider.settings;
        if (!settings.useFrontmatterMetadata || !settings.enableFolderNotes) {
            this.untrackFolderNotePathForCachedFolder(folderPath);
            return;
        }

        const folderNotePath = this.getCurrentFolderNotePath(folderPath);
        this.updateTrackedFolderNotePath(folderPath, folderNotePath);
    }

    // Applies a single frontmatter field update without mutating unchanged values.
    private updateFrontmatterField(frontmatter: Record<string, unknown>, field: string, value: string | null): void {
        if (value !== null) {
            if (frontmatter[field] !== value) {
                frontmatter[field] = value;
            }
            return;
        }

        if (Reflect.has(frontmatter, field)) {
            delete frontmatter[field];
        }
    }

    private hasOwnFolderStyleEntry(record: Record<string, string> | undefined, key: string): boolean {
        return Boolean(record && Object.prototype.hasOwnProperty.call(record, key));
    }

    private async syncFolderStyleSettings(
        folderPath: string,
        updates: FolderStyleUpdate,
        handledByFrontmatter: { icon: boolean; color: boolean; backgroundColor: boolean }
    ): Promise<boolean> {
        if (
            updates.icon === undefined &&
            updates.color === undefined &&
            updates.backgroundColor === undefined &&
            !handledByFrontmatter.icon &&
            !handledByFrontmatter.color &&
            !handledByFrontmatter.backgroundColor
        ) {
            return false;
        }

        let changed = false;
        await this.saveAndUpdate(settings => {
            let hasChanges = false;

            if (handledByFrontmatter.icon) {
                if (this.hasOwnFolderStyleEntry(settings.folderIcons, folderPath)) {
                    delete settings.folderIcons[folderPath];
                    hasChanges = true;
                }
            } else if (updates.icon !== undefined) {
                const currentIcon = this.hasOwnFolderStyleEntry(settings.folderIcons, folderPath)
                    ? settings.folderIcons[folderPath]
                    : undefined;
                const nextIcon =
                    updates.icon === null
                        ? undefined
                        : typeof updates.icon === 'string'
                          ? (normalizeCanonicalIconId(updates.icon) ?? undefined)
                          : undefined;

                if (nextIcon !== currentIcon) {
                    const icons = ensureRecord(settings.folderIcons, isStringRecordValue);
                    if (nextIcon === undefined) {
                        delete icons[folderPath];
                    } else {
                        icons[folderPath] = nextIcon;
                    }
                    settings.folderIcons = icons;
                    hasChanges = true;
                }
            }

            if (handledByFrontmatter.color) {
                if (this.hasOwnFolderStyleEntry(settings.folderColors, folderPath)) {
                    delete settings.folderColors[folderPath];
                    hasChanges = true;
                }
            } else if (updates.color !== undefined) {
                const currentColor = this.hasOwnFolderStyleEntry(settings.folderColors, folderPath)
                    ? settings.folderColors[folderPath]
                    : undefined;
                const nextColor = updates.color === null ? undefined : updates.color;

                if (nextColor !== currentColor) {
                    const colors = ensureRecord(settings.folderColors, isStringRecordValue);
                    if (nextColor === undefined) {
                        delete colors[folderPath];
                    } else {
                        colors[folderPath] = nextColor;
                    }
                    settings.folderColors = colors;
                    hasChanges = true;
                }
            }

            if (handledByFrontmatter.backgroundColor) {
                if (this.hasOwnFolderStyleEntry(settings.folderBackgroundColors, folderPath)) {
                    delete settings.folderBackgroundColors[folderPath];
                    hasChanges = true;
                }
            } else if (updates.backgroundColor !== undefined) {
                const currentBackground = this.hasOwnFolderStyleEntry(settings.folderBackgroundColors, folderPath)
                    ? settings.folderBackgroundColors[folderPath]
                    : undefined;
                const nextBackground = updates.backgroundColor === null ? undefined : updates.backgroundColor;

                if (nextBackground !== currentBackground) {
                    const backgrounds = ensureRecord(settings.folderBackgroundColors, isStringRecordValue);
                    if (nextBackground === undefined) {
                        delete backgrounds[folderPath];
                    } else {
                        backgrounds[folderPath] = nextBackground;
                    }
                    settings.folderBackgroundColors = backgrounds;
                    hasChanges = true;
                }
            }

            changed = hasChanges;
            return hasChanges;
        });

        return changed;
    }

    /**
     * Writes folder icon/color/background to folder note frontmatter in a single transaction.
     */
    private async writeFolderStyleToFrontmatter(
        folderPath: string,
        updates: FolderStyleUpdate
    ): Promise<{ icon: boolean; color: boolean; backgroundColor: boolean }> {
        const settings = this.settingsProvider.settings;
        if (!settings.useFrontmatterMetadata) {
            return { icon: false, color: false, backgroundColor: false };
        }

        const folderNote = this.getFolderNoteFile(folderPath);
        if (!folderNote) {
            return { icon: false, color: false, backgroundColor: false };
        }

        const fields = this.getFolderFrontmatterFields();
        const handlesIcon = updates.icon !== undefined && Boolean(fields.iconField);
        const handlesColor = updates.color !== undefined && Boolean(fields.colorField);
        const handlesBackground = updates.backgroundColor !== undefined && Boolean(fields.backgroundField);

        if (!handlesIcon && !handlesColor && !handlesBackground) {
            return { icon: false, color: false, backgroundColor: false };
        }

        const directStyle = this.getFolderStyleFromSettings(folderPath);
        const nextStyle: FolderStyleValues = {
            icon: directStyle.icon,
            color: directStyle.color,
            backgroundColor: directStyle.backgroundColor
        };

        if (handlesIcon) {
            if (updates.icon === null) {
                nextStyle.icon = undefined;
            } else if (typeof updates.icon === 'string') {
                const normalizedIcon = normalizeCanonicalIconId(updates.icon.trim());
                nextStyle.icon = normalizedIcon || undefined;
            }
        }

        if (handlesColor) {
            if (updates.color === null) {
                nextStyle.color = undefined;
            } else if (typeof updates.color === 'string') {
                const trimmedColor = updates.color.trim();
                nextStyle.color = trimmedColor.length > 0 ? trimmedColor : undefined;
            }
        }

        if (handlesBackground) {
            if (updates.backgroundColor === null) {
                nextStyle.backgroundColor = undefined;
            } else if (typeof updates.backgroundColor === 'string') {
                const trimmedBackground = updates.backgroundColor.trim();
                nextStyle.backgroundColor = trimmedBackground.length > 0 ? trimmedBackground : undefined;
            }
        }

        // Non-serializable icon IDs resolve to null and clear the folder-note frontmatter icon field.
        const serializedIcon = nextStyle.icon ? serializeIconForFrontmatter(nextStyle.icon) : null;
        const serializedColor = nextStyle.color?.trim() || null;
        const serializedBackground = nextStyle.backgroundColor?.trim() || null;
        const iconField = fields.iconField;
        const colorField = fields.colorField;
        const backgroundField = fields.backgroundField;
        const shouldSyncIconField = Boolean(iconField) && (handlesIcon || directStyle.icon !== undefined);
        const shouldSyncColorField = Boolean(colorField) && (handlesColor || directStyle.color !== undefined);
        const shouldSyncBackgroundField = Boolean(backgroundField) && (handlesBackground || directStyle.backgroundColor !== undefined);

        try {
            await this.app.fileManager.processFrontMatter(folderNote, (frontmatter: Record<string, unknown>) => {
                if (iconField && shouldSyncIconField) {
                    this.updateFrontmatterField(frontmatter, iconField, serializedIcon);
                }

                if (colorField && shouldSyncColorField) {
                    this.updateFrontmatterField(frontmatter, colorField, serializedColor);
                }

                if (backgroundField && shouldSyncBackgroundField) {
                    this.updateFrontmatterField(frontmatter, backgroundField, serializedBackground);
                }
            });
        } catch (error: unknown) {
            console.error('Failed to update folder note frontmatter metadata', {
                folderPath,
                folderNotePath: folderNote.path,
                error
            });
            return { icon: false, color: false, backgroundColor: false };
        }

        const metadataUpdate: { icon?: string; color?: string; background?: string } = {};
        if (shouldSyncIconField) {
            metadataUpdate.icon = nextStyle.icon && nextStyle.icon.length > 0 ? nextStyle.icon : undefined;
        }
        if (shouldSyncColorField) {
            metadataUpdate.color = serializedColor ?? undefined;
        }
        if (shouldSyncBackgroundField) {
            metadataUpdate.background = serializedBackground ?? undefined;
        }

        const db = getDBInstanceOrNull();
        if (db) {
            try {
                await db.updateFileMetadata(folderNote.path, metadataUpdate);
            } catch (error: unknown) {
                console.error('Failed to sync folder note metadata to IndexedDB cache', {
                    folderPath,
                    folderNotePath: folderNote.path,
                    error
                });
            }
        }
        return { icon: shouldSyncIconField, color: shouldSyncColorField, backgroundColor: shouldSyncBackgroundField };
    }

    async setFolderStyle(folderPath: string, updates: FolderStyleUpdate): Promise<void> {
        if (!this.validateFolder(folderPath)) {
            return;
        }

        const normalizedUpdates: FolderStyleUpdate = {
            icon: updates.icon,
            color: updates.color,
            backgroundColor: updates.backgroundColor
        };
        if (typeof normalizedUpdates.color === 'string' && !this.validateColor(normalizedUpdates.color)) {
            normalizedUpdates.color = undefined;
        }
        if (typeof normalizedUpdates.backgroundColor === 'string' && !this.validateColor(normalizedUpdates.backgroundColor)) {
            normalizedUpdates.backgroundColor = undefined;
        }

        const hasIconUpdate = normalizedUpdates.icon !== undefined;
        const hasColorUpdate = normalizedUpdates.color !== undefined;
        const hasBackgroundUpdate = normalizedUpdates.backgroundColor !== undefined;
        if (!hasIconUpdate && !hasColorUpdate && !hasBackgroundUpdate) {
            return;
        }

        const directDisplayDataBefore =
            this.folderStyleChangeListener !== null
                ? this.resolveFolderDisplayData(folderPath, {
                      includeDisplayName: false,
                      includeColor: true,
                      includeBackgroundColor: true,
                      includeIcon: true,
                      includeInheritedColors: false
                  })
                : null;

        const invalidateFolderDisplayCacheForStyleUpdate = (): void => {
            if (hasColorUpdate || hasBackgroundUpdate) {
                this.invalidateFolderDisplayCacheForFolderAndDescendants(folderPath);
                return;
            }
            this.invalidateFolderDisplayCacheForFolder(folderPath);
        };

        invalidateFolderDisplayCacheForStyleUpdate();
        const handledByFrontmatter = await this.writeFolderStyleToFrontmatter(folderPath, normalizedUpdates);
        const settingsChanged = await this.syncFolderStyleSettings(folderPath, normalizedUpdates, handledByFrontmatter);
        const hadFrontmatterStyleUpdate = handledByFrontmatter.icon || handledByFrontmatter.color || handledByFrontmatter.backgroundColor;

        if (settingsChanged) {
            invalidateFolderDisplayCacheForStyleUpdate();
        }

        if (this.folderStyleChangeListener && directDisplayDataBefore && hadFrontmatterStyleUpdate && !settingsChanged) {
            const directDisplayDataAfter = this.resolveFolderDisplayData(folderPath, {
                includeDisplayName: false,
                includeColor: true,
                includeBackgroundColor: true,
                includeIcon: true,
                includeInheritedColors: false
            });

            if (this.hasFolderDisplayStyleChanged(directDisplayDataBefore, directDisplayDataAfter)) {
                this.folderStyleChangeListener(folderPath);
            }
        }
    }

    /**
     * Sets a custom color for a folder
     * @param folderPath - Path of the folder
     * @param color - CSS color value
     */
    async setFolderColor(folderPath: string, color: string): Promise<void> {
        return this.setFolderStyle(folderPath, { color });
    }

    /**
     * Sets a custom background color for a folder
     * @param folderPath - Path of the folder
     * @param color - CSS color value
     */
    async setFolderBackgroundColor(folderPath: string, color: string): Promise<void> {
        return this.setFolderStyle(folderPath, { backgroundColor: color });
    }

    /**
     * Removes the custom color from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderColor(folderPath: string): Promise<void> {
        return this.setFolderStyle(folderPath, { color: null });
    }

    /**
     * Removes the custom background color from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderBackgroundColor(folderPath: string): Promise<void> {
        return this.setFolderStyle(folderPath, { backgroundColor: null });
    }

    private resolveInheritedFolderStyleValues(
        folderPath: string,
        needs: { color: boolean; backgroundColor: boolean }
    ): { color?: string; backgroundColor?: string } {
        if (!this.settingsProvider.settings.inheritFolderColors) {
            return {};
        }

        if (!needs.color && !needs.backgroundColor) {
            return {};
        }

        if (folderPath === '/') {
            return {};
        }

        let color: string | undefined;
        let backgroundColor: string | undefined;
        const pathParts = folderPath.split('/');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const ancestorPath = pathParts.slice(0, i).join('/');
            if (!ancestorPath) {
                continue;
            }

            const ancestorDisplayData = this.getFolderDisplayData(ancestorPath, {
                includeDisplayName: false,
                includeColor: needs.color && !color,
                includeBackgroundColor: needs.backgroundColor && !backgroundColor,
                includeIcon: false,
                includeInheritedColors: false
            });

            if (!color && ancestorDisplayData.color) {
                color = ancestorDisplayData.color;
            }
            if (!backgroundColor && ancestorDisplayData.backgroundColor) {
                backgroundColor = ancestorDisplayData.backgroundColor;
            }

            if ((!needs.color || color) && (!needs.backgroundColor || backgroundColor)) {
                break;
            }
        }

        if ((!needs.color || color) && (!needs.backgroundColor || backgroundColor)) {
            return { color, backgroundColor };
        }

        const rootDisplayData = this.getFolderDisplayData('/', {
            includeDisplayName: false,
            includeColor: needs.color && !color,
            includeBackgroundColor: needs.backgroundColor && !backgroundColor,
            includeIcon: false,
            includeInheritedColors: false
        });

        if (!color && rootDisplayData.color) {
            color = rootDisplayData.color;
        }
        if (!backgroundColor && rootDisplayData.backgroundColor) {
            backgroundColor = rootDisplayData.backgroundColor;
        }

        return {
            color,
            backgroundColor
        };
    }

    /**
     * Resolves display metadata for a folder using settings and folder note frontmatter.
     */
    private resolveFolderDisplayData(folderPath: string, options: FolderDisplayResolveOptions): FolderDisplayData {
        const settings = this.settingsProvider.settings;
        const directColor = options.includeColor ? this.getEntityColor(ItemType.FOLDER, folderPath) : undefined;
        const directBackground = options.includeBackgroundColor ? this.getEntityBackgroundColor(ItemType.FOLDER, folderPath) : undefined;
        const directIcon = options.includeIcon ? this.getEntityIcon(ItemType.FOLDER, folderPath) : undefined;
        const useFrontmatterMetadata = settings.useFrontmatterMetadata;
        const frontmatterFields = this.getFolderFrontmatterFields();
        const shouldResolveDisplayName = options.includeDisplayName && useFrontmatterMetadata;
        const shouldReadIconFromFrontmatter = options.includeIcon && useFrontmatterMetadata && Boolean(frontmatterFields.iconField);
        const shouldReadColorFromFrontmatter = options.includeColor && useFrontmatterMetadata && Boolean(frontmatterFields.colorField);
        const shouldReadBackgroundFromFrontmatter =
            options.includeBackgroundColor && useFrontmatterMetadata && Boolean(frontmatterFields.backgroundField);

        const shouldReadFolderNoteMetadata =
            shouldResolveDisplayName ||
            shouldReadIconFromFrontmatter ||
            shouldReadColorFromFrontmatter ||
            shouldReadBackgroundFromFrontmatter;
        const folderNoteMetadata = shouldReadFolderNoteMetadata ? this.getFolderNoteMetadata(folderPath) : null;

        const frontmatterIcon = shouldReadIconFromFrontmatter ? folderNoteMetadata?.icon : undefined;
        const frontmatterColor = shouldReadColorFromFrontmatter ? folderNoteMetadata?.color : undefined;
        const frontmatterBackground = shouldReadBackgroundFromFrontmatter ? folderNoteMetadata?.backgroundColor : undefined;
        let color = options.includeColor ? frontmatterColor || directColor : undefined;
        let backgroundColor = options.includeBackgroundColor ? frontmatterBackground || directBackground : undefined;
        if (options.includeInheritedColors && ((options.includeColor && !color) || (options.includeBackgroundColor && !backgroundColor))) {
            const inheritedValues = this.resolveInheritedFolderStyleValues(folderPath, {
                color: options.includeColor && !color,
                backgroundColor: options.includeBackgroundColor && !backgroundColor
            });
            if (!color) {
                color = inheritedValues.color;
            }
            if (!backgroundColor) {
                backgroundColor = inheritedValues.backgroundColor;
            }
        }

        const icon = options.includeIcon ? frontmatterIcon || directIcon : undefined;
        const displayName = shouldResolveDisplayName ? folderNoteMetadata?.name : undefined;

        return {
            displayName,
            color,
            backgroundColor,
            icon
        };
    }

    /**
     * Resolves display metadata for a folder using settings and folder note frontmatter.
     */
    getFolderDisplayData(
        folderPath: string,
        options?: {
            includeDisplayName?: boolean;
            includeColor?: boolean;
            includeBackgroundColor?: boolean;
            includeIcon?: boolean;
            includeInheritedColors?: boolean;
        }
    ): FolderDisplayData {
        this.ensureFolderDisplayCacheState();
        const resolvedOptions: FolderDisplayResolveOptions = {
            includeDisplayName: options?.includeDisplayName ?? true,
            includeColor: options?.includeColor ?? true,
            includeBackgroundColor: options?.includeBackgroundColor ?? true,
            includeIcon: options?.includeIcon ?? true,
            includeInheritedColors: options?.includeInheritedColors ?? true
        };
        const cacheKey = this.createFolderDisplayCacheKey(folderPath, resolvedOptions);
        const cached = this.getFolderDisplayCacheValue(cacheKey);
        if (cached) {
            return { ...cached };
        }

        const resolved = this.resolveFolderDisplayData(folderPath, resolvedOptions);
        this.trackFolderNotePathForCachedFolder(folderPath);
        this.setFolderDisplayCacheValue(folderPath, cacheKey, resolved);
        return { ...resolved };
    }

    /**
     * Gets the custom color for a folder, checking ancestors if inheritance is enabled
     * @param folderPath - Path of the folder
     * @returns The color value or undefined
     */
    getFolderColor(folderPath: string): string | undefined {
        return this.getFolderDisplayData(folderPath, {
            includeDisplayName: false,
            includeColor: true,
            includeBackgroundColor: false,
            includeIcon: false,
            includeInheritedColors: true
        }).color;
    }

    /**
     * Gets the custom background color for a folder, checking ancestors if inheritance is enabled
     * @param folderPath - Path of the folder
     * @returns The background color value or undefined
     */
    getFolderBackgroundColor(folderPath: string): string | undefined {
        return this.getFolderDisplayData(folderPath, {
            includeDisplayName: false,
            includeColor: false,
            includeBackgroundColor: true,
            includeIcon: false,
            includeInheritedColors: true
        }).backgroundColor;
    }

    /**
     * Sets a custom icon for a folder
     * @param folderPath - Path of the folder
     * @param iconId - Lucide icon identifier
     */
    async setFolderIcon(folderPath: string, iconId: string): Promise<void> {
        return this.setFolderStyle(folderPath, { icon: iconId });
    }

    /**
     * Removes the custom icon from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderIcon(folderPath: string): Promise<void> {
        return this.setFolderStyle(folderPath, { icon: null });
    }

    /**
     * Gets the custom icon for a folder
     * @param folderPath - Path of the folder
     * @returns The icon ID or undefined
     */
    getFolderIcon(folderPath: string): string | undefined {
        return this.getFolderDisplayData(folderPath, {
            includeDisplayName: false,
            includeColor: false,
            includeBackgroundColor: false,
            includeIcon: true,
            includeInheritedColors: true
        }).icon;
    }

    /**
     * Sets a custom sort order for a folder
     * @param folderPath - Path of the folder
     * @param sortOption - Sort option to apply
     */
    async setFolderSortOverride(folderPath: string, sortOption: SortOption): Promise<void> {
        if (!this.validateFolder(folderPath)) {
            return;
        }
        return this.setEntitySortOverride(ItemType.FOLDER, folderPath, sortOption);
    }

    /**
     * Removes the custom sort order from a folder
     * @param folderPath - Path of the folder
     */
    async removeFolderSortOverride(folderPath: string): Promise<void> {
        return this.removeEntitySortOverride(ItemType.FOLDER, folderPath);
    }

    /**
     * Gets the sort override for a folder
     * @param folderPath - Path of the folder
     * @returns The sort option or undefined
     */
    getFolderSortOverride(folderPath: string): SortOption | undefined {
        return this.getEntitySortOverride(ItemType.FOLDER, folderPath);
    }

    /**
     * Sets a custom alphabetical sort order for the folder's child folders in the navigation pane.
     */
    async setFolderChildSortOrderOverride(folderPath: string, sortOrder: AlphaSortOrder): Promise<void> {
        if (!this.validateFolder(folderPath)) {
            return;
        }
        return this.setEntityChildSortOrderOverride(ItemType.FOLDER, folderPath, sortOrder);
    }

    /**
     * Removes the custom child folder sort order from a folder.
     */
    async removeFolderChildSortOrderOverride(folderPath: string): Promise<void> {
        return this.removeEntityChildSortOrderOverride(ItemType.FOLDER, folderPath);
    }

    /**
     * Gets the child sort order override for a folder.
     */
    getFolderChildSortOrderOverride(folderPath: string): AlphaSortOrder | undefined {
        return this.getEntityChildSortOrderOverride(ItemType.FOLDER, folderPath);
    }

    /**
     * Handles folder rename by updating all associated metadata
     * @param oldPath - Previous folder path
     * @param newPath - New folder path
     */
    async handleFolderRename(oldPath: string, newPath: string, extraMutation?: SettingsMutation): Promise<void> {
        this.clearFolderDisplayDataCache();
        await this.saveAndUpdate(settings => {
            let changed = false;

            changed = this.updateNestedPaths(settings.folderColors, oldPath, newPath) || changed;
            changed = this.updateNestedPaths(settings.folderBackgroundColors, oldPath, newPath) || changed;
            changed = this.updateNestedPaths(settings.folderIcons, oldPath, newPath) || changed;
            changed = this.updateNestedPaths(settings.folderSortOverrides, oldPath, newPath) || changed;
            changed = this.updateNestedPaths(settings.folderTreeSortOverrides, oldPath, newPath) || changed;
            changed = this.updateNestedPaths(settings.folderAppearances, oldPath, newPath) || changed;

            const shortcutsChanged = this.updateShortcuts(settings, shortcut => {
                if (!isFolderShortcut(shortcut) || shortcut.path !== oldPath) {
                    return undefined;
                }

                return {
                    ...shortcut,
                    path: newPath
                };
            });
            changed = shortcutsChanged || changed;

            if (extraMutation) {
                changed = extraMutation(settings) || changed;
            }

            return changed;
        });
    }

    /**
     * Handles folder deletion by removing all associated metadata
     * @param folderPath - Path of the deleted folder
     */
    async handleFolderDelete(folderPath: string, extraMutation?: SettingsMutation): Promise<void> {
        this.clearFolderDisplayDataCache();
        await this.saveAndUpdate(settings => {
            let changed = false;

            changed = this.deleteNestedPaths(settings.folderColors, folderPath) || changed;
            changed = this.deleteNestedPaths(settings.folderBackgroundColors, folderPath) || changed;
            changed = this.deleteNestedPaths(settings.folderIcons, folderPath) || changed;
            changed = this.deleteNestedPaths(settings.folderSortOverrides, folderPath) || changed;
            changed = this.deleteNestedPaths(settings.folderTreeSortOverrides, folderPath) || changed;
            changed = this.deleteNestedPaths(settings.folderAppearances, folderPath) || changed;

            const shortcutsChanged = this.updateShortcuts(settings, shortcut => {
                if (!isFolderShortcut(shortcut)) {
                    return undefined;
                }
                return shortcut.path === folderPath ? null : undefined;
            });
            changed = shortcutsChanged || changed;

            if (extraMutation) {
                changed = extraMutation(settings) || changed;
            }

            return changed;
        });
    }

    /**
     * Clean up folder metadata for non-existent folders
     * @returns True if any changes were made
     */
    async cleanupFolderMetadata(targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings): Promise<boolean> {
        this.clearFolderDisplayDataCache();
        const validator = (path: string) => this.app.vault.getFolderByPath(path) !== null;

        const results = await Promise.all([
            this.cleanupMetadata(targetSettings, 'folderColors', validator),
            this.cleanupMetadata(targetSettings, 'folderBackgroundColors', validator),
            this.cleanupMetadata(targetSettings, 'folderIcons', validator),
            this.cleanupMetadata(targetSettings, 'folderSortOverrides', validator),
            this.cleanupMetadata(targetSettings, 'folderTreeSortOverrides', validator),
            this.cleanupMetadata(targetSettings, 'folderAppearances', validator)
        ]);

        return results.some(changed => changed);
    }

    /**
     * Clean up folder metadata using pre-loaded validators.
     *
     * This method is called during plugin startup as part of a unified cleanup process
     * to avoid multiple iterations over vault files. Instead of each metadata type
     * (colors, icons, sort overrides, appearances) separately checking if folders exist,
     * this method uses pre-loaded data for better performance.
     *
     * The cleanup process:
     * 1. Called from StorageContext during initial sync after all files are processed
     * 2. Uses validators object that contains:
     *    - dbFiles: All files from IndexedDB cache
     *    - tagTree: Complete tag hierarchy
     *    - vaultFiles: Set of all file paths in the vault
     *    - vaultFolders: Set of all actual folder paths from the vault
     * 3. Uses the vaultFolders set directly to validate folder existence
     * 4. Removes metadata for any folders that no longer exist in the vault
     *
     * @param validators - Pre-loaded data containing vault files, folders, database files, and tag tree
     * @returns True if any metadata was removed/changed
     */
    async cleanupWithValidators(
        validators: CleanupValidators,
        targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings
    ): Promise<boolean> {
        this.clearFolderDisplayDataCache();
        // Use the actual folder paths directly from the validators
        const validator = (path: string) => validators.vaultFolders.has(path);

        const results = await Promise.all([
            this.cleanupMetadata(targetSettings, 'folderColors', validator),
            this.cleanupMetadata(targetSettings, 'folderBackgroundColors', validator),
            this.cleanupMetadata(targetSettings, 'folderIcons', validator),
            this.cleanupMetadata(targetSettings, 'folderSortOverrides', validator),
            this.cleanupMetadata(targetSettings, 'folderTreeSortOverrides', validator),
            this.cleanupMetadata(targetSettings, 'folderAppearances', validator)
        ]);

        return results.some(changed => changed);
    }

    /**
     * Returns display metadata extracted from the folder's folder note (if any).
     */
    private getFolderNoteMetadata(folderPath: string): { name?: string; icon?: string; color?: string; backgroundColor?: string } | null {
        const folderNote = this.getFolderNoteFile(folderPath);
        if (!folderNote) {
            return null;
        }

        const db = getDBInstanceOrNull();
        if (!db) {
            return null;
        }
        const fileData = db.getFile(folderNote.path);
        if (!fileData || !fileData.metadata) {
            return null;
        }

        const nameValue = typeof fileData.metadata.name === 'string' ? fileData.metadata.name.trim() : undefined;
        const iconValue = typeof fileData.metadata.icon === 'string' ? normalizeCanonicalIconId(fileData.metadata.icon.trim()) : undefined;
        const colorValue = typeof fileData.metadata.color === 'string' ? fileData.metadata.color.trim() : undefined;
        const backgroundValue = typeof fileData.metadata.background === 'string' ? fileData.metadata.background.trim() : undefined;

        if (!nameValue && !iconValue && !colorValue && !backgroundValue) {
            return null;
        }

        return {
            name: nameValue || undefined,
            icon: iconValue || undefined,
            color: colorValue || undefined,
            backgroundColor: backgroundValue || undefined
        };
    }
}
