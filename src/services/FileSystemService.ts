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

import { App, TFile, TFolder, TAbstractFile, normalizePath, Platform, WorkspaceLeaf, ViewState } from 'obsidian';
import type { SelectionDispatch } from '../context/SelectionContext';
import { strings } from '../i18n';
import { ConfirmModal } from '../modals/ConfirmModal';
import { FolderSuggestModal } from '../modals/FolderSuggestModal';
import { InputModal } from '../modals/InputModal';
import { MoveFileConflictModal, type MoveFileConflictItem, type MoveFileConflictResolution } from '../modals/MoveFileConflictModal';
import { NotebookNavigatorSettings } from '../settings';
import { NavigationItemType, PROPERTIES_ROOT_VIRTUAL_FOLDER_ID, TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../types';
import type { VisibilityPreferences } from '../types';
import { ExtendedApp, TIMEOUTS, OBSIDIAN_COMMANDS } from '../types/obsidian-extended';
import {
    buildFilePathInFolder,
    buildPathInFolder,
    createFileWithOptions,
    createDatabaseContent,
    generateUniqueFilename
} from '../utils/fileCreationUtils';
import { cleanupExclusionPatterns, isPathInExcludedFolder } from '../utils/fileFilters';
import {
    containsForbiddenNameCharactersAllPlatforms,
    containsForbiddenNameCharactersWindows,
    containsInvalidLinkCharacters,
    EXCALIDRAW_BASENAME_SUFFIX,
    isExcalidrawFile,
    stripExcalidrawSuffix,
    stripForbiddenNameCharactersAllPlatforms,
    stripForbiddenNameCharactersWindows,
    stripLeadingPeriods
} from '../utils/fileNameUtils';
import { resolveFolderNoteName, shouldRenameFolderNoteWithFolderName } from '../utils/folderNoteName';
import { getFolderNote, getFolderNoteDetectionSettings, isFolderNote, isSupportedFolderNoteExtension } from '../utils/folderNotes';
import { findNextFileAfterRemoval, getFilesForNavigationSelection, updateSelectionAfterFileOperation } from '../utils/selectionUtils';
import { executeCommand, isPluginInstalled } from '../utils/typeGuards';
import { getErrorMessage } from '../utils/errorUtils';
import { TagTreeService } from './TagTreeService';
import type { PropertyTreeService } from './PropertyTreeService';
import { CommandQueueService, type MoveFilesCommandData } from './CommandQueueService';
import type { MaybePromise } from '../utils/async';
import { showNotice } from '../utils/noticeUtils';
import {
    getDirectPropertyKeyNoteCount,
    normalizePropertyNodeId,
    normalizePropertyTreeValuePath,
    parsePropertyNodeId,
    type PropertySelectionNodeId
} from '../utils/propertyTree';
import type { ISettingsProvider } from '../interfaces/ISettingsProvider';
import { casefold, ensureRecord, isStringRecordValue } from '../utils/recordUtils';
import type { MetadataService } from './MetadataService';
import {
    ensureVaultProfiles,
    getActiveVaultProfile,
    normalizeHiddenFolderPath,
    removeHiddenFolderExactMatches,
    updateHiddenFolderExactMatches
} from '../utils/vaultProfiles';
import { EXCALIDRAW_PLUGIN_ID, TLDRAW_PLUGIN_ID } from '../constants/pluginIds';
import { createDrawingWithPlugin, DrawingType, getDrawingFilePath, getDrawingTemplate } from '../utils/drawingFileUtils';
import { resolveFolderDisplayName } from '../utils/folderDisplayName';
import { normalizeTagPath } from '../utils/tagUtils';
import { isPrimaryDocumentFile } from '../utils/fileTypeUtils';
import {
    type DeleteAttachmentsSetting,
    type MoveFileConflictsSetting,
    resolveDeleteAttachmentsSetting,
    resolveMoveFileConflictsSetting
} from '../settings/types';

/**
 * Selection context for file operations
 * Contains the current selection state needed for smart deletion
 */
interface SelectionContext {
    selectionType: NavigationItemType;
    selectedFolder?: TFolder;
    selectedTag?: string;
    selectedProperty?: PropertySelectionNodeId;
}

/**
 * Options for the moveFilesToFolder method
 */
interface MoveFilesOptions {
    /** Files to move */
    files: TFile[];
    /** Target folder to move files into */
    targetFolder: TFolder;
    /** Current selection context for smart selection updates */
    selectionContext?: {
        selectedFile: TFile | null;
        dispatch: SelectionDispatch;
        allFiles: TFile[];
    };
    /** Whether to show notifications (default: true) */
    showNotifications?: boolean;
}

/**
 * Result of the moveFilesToFolder operation
 */
interface MoveFilesResult {
    /** Number of files successfully moved */
    movedCount: number;
    /** Number of files skipped due to conflicts */
    skippedCount: number;
    /** Number of files skipped due to user cancellation */
    cancelledCount: number;
    /** Files that failed to move with their errors */
    errors: { file: TFile; error: Error }[];
}

/**
 * Summary of property assignment results across a file batch.
 */
interface ApplyPropertyNodeResult {
    updated: number;
    skipped: number;
}

/**
 * Serialized value shape written into frontmatter.
 */
type PropertyNodeAssignmentValueKind = 'boolean' | 'string';

/**
 * Normalized property write request derived from a tree node id.
 */
interface ResolvedPropertyNodeAssignment {
    propertyKey: string;
    nodeKind: 'key' | 'value';
    desiredValue: string | null;
    normalizedDesiredValue: string | null;
    writeValue: boolean | string;
    writeValueKind: PropertyNodeAssignmentValueKind;
}

interface PlannedFileMove {
    file: TFile;
    originalPath: string;
    targetPath: string;
    overwrite: boolean;
}

interface DeferredMoveConflict {
    file: TFile;
    originalPath: string;
    desiredPath: string;
    suggestedPath: string;
    canOverwrite: boolean;
}

interface PlannedMoveExecutionOutcomeMoved {
    status: 'moved';
    originalPath: string;
}

interface PlannedMoveExecutionOutcomeSkipped {
    status: 'skipped';
}

interface PlannedMoveExecutionOutcomeErrored {
    status: 'error';
    originalPath: string;
    error: unknown;
}

type PlannedMoveExecutionOutcome =
    | PlannedMoveExecutionOutcomeMoved
    | PlannedMoveExecutionOutcomeSkipped
    | PlannedMoveExecutionOutcomeErrored;

const FILE_MOVE_BATCH_SIZE = 12;

/**
 * Result of a folder move initiated from the context menu
 */
interface MoveFolderResult {
    /** Original folder path before the move */
    oldPath: string;
    /** New folder path after the move */
    newPath: string;
    /** Destination folder that now contains the moved folder */
    targetFolder: TFolder;
}

/**
 * Result of a folder move operation initiated via modal
 */
type MoveFolderModalResult = { status: 'success'; data: MoveFolderResult } | { status: 'cancelled' } | { status: 'error'; error: unknown };

export class FolderMoveError extends Error {
    constructor(
        public readonly code: 'invalid-target' | 'destination-exists' | 'verification-failed',
        message?: string
    ) {
        super(message ?? code);
        this.name = 'FolderMoveError';
    }
}

/**
 * Folder suggest modal that handles cancellation events.
 * Invokes a callback when the modal is closed without selection.
 */
class CancelAwareFolderSuggestModal extends FolderSuggestModal {
    constructor(
        app: App,
        onChooseFolder: (folder: TFolder) => MaybePromise,
        placeholderText: string,
        actionText: string,
        excludePaths: Set<string>,
        private readonly onCancel: () => void
    ) {
        super(app, onChooseFolder, placeholderText, actionText, excludePaths);
    }

    /**
     * Invokes the cancellation callback when modal is closed
     */
    onClose(): void {
        super.onClose();
        this.onCancel();
    }
}

/**
 * Handles all file system operations for Notebook Navigator
 * Provides centralized methods for creating, renaming, and deleting files/folders
 * Manages user input modals and confirmation dialogs
 */
export class FileSystemOperations {
    /**
     * Creates a new FileSystemOperations instance
     * @param app - The Obsidian app instance for vault operations
     * @param getTagTreeService - Function to get the TagTreeService instance
     * @param getPropertyTreeService - Function to get the PropertyTreeService instance
     * @param getCommandQueue - Function to get the CommandQueueService instance
     * @param getMetadataService - Function to get the MetadataService instance
     */
    constructor(
        private app: App,
        private getTagTreeService: () => TagTreeService | null,
        private getPropertyTreeService: () => PropertyTreeService | null,
        private getCommandQueue: () => CommandQueueService | null,
        private getMetadataService: () => MetadataService | null,
        private getVisibilityPreferences: () => VisibilityPreferences, // Function to get current visibility preferences for descendant/hidden items state
        private settingsProvider: ISettingsProvider
    ) {}

    /**
     * Resolves UI label for a folder, including frontmatter display names.
     */
    private resolveFolderDisplayLabel(folder: TFolder): string {
        const metadataService = this.getMetadataService();
        if (!metadataService) {
            return folder.path === '/' ? this.settingsProvider.settings.customVaultName || this.app.vault.getName() : folder.name;
        }
        return resolveFolderDisplayName({
            app: this.app,
            metadataService,
            settings: { customVaultName: this.settingsProvider.settings.customVaultName },
            folderPath: folder.path,
            fallbackName: folder.name
        });
    }

    /**
     * Shows a notification with a formatted error message
     */
    private notifyError(template: string, error: unknown, fallback?: string): void {
        const message = template.replace('{error}', getErrorMessage(error, fallback ?? strings.common.unknownError));
        showNotice(message, { variant: 'warning' });
    }

    private isAttachmentFile(file: TFile): boolean {
        return !isPrimaryDocumentFile(file);
    }

    private normalizeAttachmentLinkTarget(rawLink: string): string | null {
        const trimmed = rawLink.trim();
        if (!trimmed) {
            return null;
        }

        const withoutAlias = trimmed.split('|')[0]?.trim() ?? '';
        if (!withoutAlias) {
            return null;
        }

        const withoutSubpath = withoutAlias.split(/[#^]/, 1)[0]?.trim() ?? '';
        if (!withoutSubpath) {
            return null;
        }

        const lower = withoutSubpath.toLowerCase();
        if (lower.includes('://') || lower.startsWith('mailto:')) {
            return null;
        }

        return withoutSubpath;
    }

    private getLinkedAttachmentCandidates(sourceFile: TFile): TFile[] {
        const cache = this.app.metadataCache.getFileCache(sourceFile);
        if (!cache) {
            return [];
        }

        const resolved = new Map<string, TFile>();
        const references = [...(cache.links ?? []), ...(cache.embeds ?? []), ...(cache.frontmatterLinks ?? [])];

        for (const reference of references) {
            const target = this.normalizeAttachmentLinkTarget(reference.link);
            if (!target) {
                continue;
            }

            const destination = this.app.metadataCache.getFirstLinkpathDest(target, sourceFile.path);
            if (!(destination instanceof TFile)) {
                continue;
            }

            if (!this.isAttachmentFile(destination)) {
                continue;
            }

            resolved.set(destination.path, destination);
        }

        return Array.from(resolved.values()).sort((a, b) => a.path.localeCompare(b.path));
    }

    private getOrphanLinkedAttachments(attachmentCandidates: readonly TFile[], deletedSourcePaths: Set<string>): TFile[] {
        if (attachmentCandidates.length === 0) {
            return [];
        }

        const candidatesByPath = new Map<string, TFile>();
        attachmentCandidates.forEach(file => {
            candidatesByPath.set(file.path, file);
        });

        const candidatePaths = new Set<string>(candidatesByPath.keys());
        const usedElsewhere = new Set<string>();

        const { resolvedLinks } = this.app.metadataCache;
        for (const sourcePath of Object.keys(resolvedLinks)) {
            if (deletedSourcePaths.has(sourcePath)) {
                continue;
            }

            const destinations = resolvedLinks[sourcePath];
            for (const destinationPath of Object.keys(destinations)) {
                if (!candidatePaths.has(destinationPath)) {
                    continue;
                }
                usedElsewhere.add(destinationPath);
                if (usedElsewhere.size === candidatePaths.size) {
                    break;
                }
            }

            if (usedElsewhere.size === candidatePaths.size) {
                break;
            }
        }

        const orphaned = Array.from(candidatesByPath.values()).filter(file => !usedElsewhere.has(file.path));
        return orphaned.sort((a, b) => a.path.localeCompare(b.path));
    }

    private resolveAttachmentDeletionSetting(): DeleteAttachmentsSetting {
        return resolveDeleteAttachmentsSetting(this.settingsProvider.settings.deleteAttachments, 'ask');
    }

    private resolveMoveFileConflictsSetting(): MoveFileConflictsSetting {
        return resolveMoveFileConflictsSetting(this.settingsProvider.settings.moveFileConflicts, 'ask');
    }

    private collectAttachmentCandidatesBySourcePath(
        sourceFiles: readonly TFile[],
        setting: DeleteAttachmentsSetting
    ): Map<string, TFile[]> {
        const candidatesBySourcePath = new Map<string, TFile[]>();
        if (setting === 'never') {
            return candidatesBySourcePath;
        }

        sourceFiles.forEach(file => {
            candidatesBySourcePath.set(file.path, this.getLinkedAttachmentCandidates(file));
        });
        return candidatesBySourcePath;
    }

    private prepareAttachmentDeletionState(sourceFiles: readonly TFile[]): {
        setting: DeleteAttachmentsSetting;
        candidatesBySourcePath: Map<string, TFile[]>;
    } {
        const setting = this.resolveAttachmentDeletionSetting();
        return {
            setting,
            candidatesBySourcePath: this.collectAttachmentCandidatesBySourcePath(sourceFiles, setting)
        };
    }

    private getAttachmentCandidatesForDeletedSources(
        candidatesBySourcePath: ReadonlyMap<string, readonly TFile[]>,
        deletedSourcePaths: Set<string>
    ): TFile[] {
        if (candidatesBySourcePath.size === 0 || deletedSourcePaths.size === 0) {
            return [];
        }

        const dedupedCandidatesByPath = new Map<string, TFile>();
        deletedSourcePaths.forEach(path => {
            const candidates = candidatesBySourcePath.get(path);
            if (!candidates || candidates.length === 0) {
                return;
            }

            candidates.forEach(candidate => {
                if (!deletedSourcePaths.has(candidate.path)) {
                    dedupedCandidatesByPath.set(candidate.path, candidate);
                }
            });
        });

        return Array.from(dedupedCandidatesByPath.values());
    }

    private async maybeDeleteAttachmentsAfterFileDelete(
        candidatesBySourcePath: ReadonlyMap<string, readonly TFile[]>,
        deletedSourcePaths: Set<string>,
        setting: DeleteAttachmentsSetting
    ): Promise<void> {
        if (setting === 'never' || deletedSourcePaths.size === 0) {
            return;
        }

        const attachmentCandidates = this.getAttachmentCandidatesForDeletedSources(candidatesBySourcePath, deletedSourcePaths);
        if (attachmentCandidates.length === 0) {
            return;
        }

        try {
            await this.maybeDeleteOrphanedLinkedAttachments(attachmentCandidates, deletedSourcePaths, setting);
        } catch (error) {
            this.notifyError(strings.fileSystem.errors.deleteAttachments, error);
        }
    }

    private async maybeDeleteOrphanedLinkedAttachments(
        attachmentCandidates: readonly TFile[],
        deletedSourcePaths: Set<string>,
        setting: DeleteAttachmentsSetting
    ): Promise<void> {
        if (setting === 'never') {
            return;
        }

        const orphaned = this.getOrphanLinkedAttachments(attachmentCandidates, deletedSourcePaths);
        if (orphaned.length === 0) {
            return;
        }

        let attachmentsToDelete: readonly TFile[] | null = orphaned;

        if (setting === 'ask') {
            const { promptDeleteFileAttachments } = await import('../modals/DeleteFileAttachmentsModal');
            attachmentsToDelete = await promptDeleteFileAttachments(this.app, orphaned);
        }

        if (!attachmentsToDelete || attachmentsToDelete.length === 0) {
            return;
        }

        const results = await Promise.allSettled(attachmentsToDelete.map(file => this.app.fileManager.trashFile(file)));

        const failures: { file: TFile; error: unknown }[] = [];
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                failures.push({ file: attachmentsToDelete[index], error: result.reason });
                console.error('Error deleting attachment:', attachmentsToDelete[index].path, result.reason);
            }
        });

        if (failures.length === 0) {
            return;
        }

        const errorMsg =
            failures.length === 1
                ? strings.fileSystem.errors.failedToDeleteFile
                      .replace('{name}', failures[0].file.name)
                      .replace('{error}', getErrorMessage(failures[0].error))
                : strings.fileSystem.errors.failedToDeleteMultipleFiles.replace('{count}', failures.length.toString());
        showNotice(errorMsg, { variant: 'warning' });
    }

    private resolveConfiguredPropertyDisplayKey(normalizedKey: string): string | null {
        const activeProfile = getActiveVaultProfile(this.settingsProvider.settings);
        const propertyKeys = Array.isArray(activeProfile.propertyKeys) ? activeProfile.propertyKeys : [];

        for (let index = 0; index < propertyKeys.length; index += 1) {
            const rawKey = propertyKeys[index]?.key;
            if (typeof rawKey !== 'string') {
                continue;
            }

            const displayKey = rawKey.trim();
            if (!displayKey) {
                continue;
            }

            if (casefold(displayKey) === normalizedKey) {
                return displayKey;
            }
        }

        return null;
    }

    /**
     * Resolves a property node id into a normalized frontmatter assignment.
     */
    private resolvePropertyNodeAssignment(propertyNodeId: string): ResolvedPropertyNodeAssignment | null {
        const requestedNode = parsePropertyNodeId(propertyNodeId);
        if (!requestedNode) {
            return null;
        }

        const normalizedNodeId = normalizePropertyNodeId(propertyNodeId);
        if (!normalizedNodeId) {
            return null;
        }

        const parsedNode = parsePropertyNodeId(normalizedNodeId);
        if (!parsedNode) {
            return null;
        }

        const propertyTreeService = this.getPropertyTreeService();
        const targetNode = propertyTreeService?.findNode(normalizedNodeId) ?? null;
        const keyNode = propertyTreeService?.getKeyNode(parsedNode.key) ?? null;

        const propertyKey = (keyNode?.name?.trim() || this.resolveConfiguredPropertyDisplayKey(parsedNode.key) || parsedNode.key).trim();
        if (!propertyKey) {
            return null;
        }

        const nodeKind: 'key' | 'value' = targetNode?.kind === 'value' || parsedNode.valuePath ? 'value' : 'key';
        const requestedValuePath = requestedNode.valuePath?.trim() ?? null;
        const desiredValue: string | null =
            nodeKind === 'key'
                ? null
                : targetNode && targetNode.kind === 'value' && targetNode.name.trim().length > 0
                  ? targetNode.name.trim()
                  : requestedValuePath || parsedNode.valuePath || null;
        const normalizedDesiredValue = desiredValue ? normalizePropertyTreeValuePath(desiredValue) : null;
        if (nodeKind === 'value' && !normalizedDesiredValue) {
            return null;
        }

        if (nodeKind === 'key') {
            return {
                propertyKey,
                nodeKind,
                desiredValue,
                normalizedDesiredValue,
                writeValue: true,
                writeValueKind: 'boolean'
            };
        }

        if (!desiredValue || !normalizedDesiredValue) {
            return null;
        }

        const isBooleanLiteral = normalizedDesiredValue === 'true' || normalizedDesiredValue === 'false';
        const canResolveBooleanValue =
            isBooleanLiteral && keyNode !== null && targetNode === null && getDirectPropertyKeyNoteCount(keyNode) > 0;
        if (canResolveBooleanValue) {
            return {
                propertyKey,
                nodeKind,
                desiredValue,
                normalizedDesiredValue,
                writeValue: normalizedDesiredValue === 'true',
                writeValueKind: 'boolean'
            };
        }

        return {
            propertyKey,
            nodeKind,
            desiredValue,
            normalizedDesiredValue,
            writeValue: desiredValue,
            writeValueKind: 'string'
        };
    }

    private async syncHiddenFolderPathChange(previousPath: string, nextPath: string): Promise<void> {
        const updated = updateHiddenFolderExactMatches(this.settingsProvider.settings, previousPath, nextPath);
        if (!updated) {
            return;
        }

        try {
            await this.settingsProvider.saveSettingsAndUpdate();
        } catch (error) {
            console.error('Failed to persist hidden folder path updates', error);
        }
    }

    private async removeHiddenFolderPathMatch(targetPath: string): Promise<void> {
        const removed = removeHiddenFolderExactMatches(this.settingsProvider.settings, targetPath);
        if (!removed) {
            return;
        }

        try {
            await this.settingsProvider.saveSettingsAndUpdate();
        } catch (error) {
            console.error('Failed to persist hidden folder removal updates', error);
        }
    }

    private isFolderHiddenInProfile(normalizedPath: string, patterns: string[]): boolean {
        if (!normalizedPath || !Array.isArray(patterns) || patterns.length === 0) {
            return false;
        }

        const trimmedPath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
        if (!trimmedPath) {
            return false;
        }

        const placeholderPath = `${trimmedPath}/__nn_new_folder__`;
        return isPathInExcludedFolder(placeholderPath, patterns);
    }

    private async hideFolderInOtherVaultProfiles(folderPath: string): Promise<void> {
        const normalizedPath = normalizeHiddenFolderPath(folderPath);
        if (!normalizedPath) {
            return;
        }

        const settings = this.settingsProvider.settings;
        ensureVaultProfiles(settings);
        const activeProfileId = settings.vaultProfile;
        let didUpdate = false;

        settings.vaultProfiles.forEach(profile => {
            if (profile.id === activeProfileId) {
                return;
            }

            if (!Array.isArray(profile.hiddenFolders)) {
                profile.hiddenFolders = [];
            }

            if (this.isFolderHiddenInProfile(normalizedPath, profile.hiddenFolders)) {
                return;
            }

            profile.hiddenFolders = cleanupExclusionPatterns(profile.hiddenFolders, normalizedPath);
            didUpdate = true;
        });

        if (!didUpdate) {
            return;
        }

        try {
            await this.settingsProvider.saveSettingsAndUpdate();
        } catch (error) {
            console.error('Failed to persist hidden folder preference for other vault profiles', error);
        }
    }

    /**
     * Copies folder icon and color metadata to a duplicated folder path
     * @param sourcePath - Original folder path
     * @param targetPath - New folder path created by duplication
     */
    private async copyFolderDisplayMetadata(sourcePath: string, targetPath: string): Promise<void> {
        if (!sourcePath || !targetPath || sourcePath === targetPath || sourcePath === '/') {
            return;
        }

        const sourcePrefix = `${sourcePath}/`;
        let changed = false;

        const processRecord = (record: Record<string, string> | undefined, updateRecord: (sanitized: Record<string, string>) => void) => {
            if (!record) {
                return;
            }

            const keys = Object.keys(record);
            let sanitized = record;
            let sanitizedApplied = false;

            for (const key of keys) {
                if (key !== sourcePath && !key.startsWith(sourcePrefix)) {
                    continue;
                }

                const value = record[key];
                if (typeof value !== 'string') {
                    continue;
                }

                if (!sanitizedApplied) {
                    sanitized = ensureRecord(record, isStringRecordValue);
                    updateRecord(sanitized);
                    sanitizedApplied = true;
                }

                const suffix = key === sourcePath ? '' : key.substring(sourcePrefix.length);
                const destinationPath = suffix ? `${targetPath}/${suffix}` : targetPath;

                if (Object.prototype.hasOwnProperty.call(sanitized, destinationPath)) {
                    continue;
                }

                sanitized[destinationPath] = value;
                changed = true;
            }
        };

        const settings = this.settingsProvider.settings;
        processRecord(settings.folderIcons, sanitized => {
            settings.folderIcons = sanitized;
        });
        processRecord(settings.folderColors, sanitized => {
            settings.folderColors = sanitized;
        });
        processRecord(settings.folderBackgroundColors, sanitized => {
            settings.folderBackgroundColors = sanitized;
        });

        if (!changed) {
            return;
        }

        try {
            await this.settingsProvider.saveSettingsAndUpdate();
        } catch (error) {
            console.error('Failed to persist folder display metadata after duplication', error);
        }
    }

    /**
     * Generates placeholder text for folder move modal
     * Optionally wraps the target name in single quotes
     */
    private getMovePlaceholder(targetName: string, shouldQuote: boolean): string {
        const label = shouldQuote ? `'${targetName}'` : targetName;
        return strings.modals.folderSuggest.placeholder(label);
    }

    /**
     * Returns label text for files being moved
     * Returns file name for single file, or count label for multiple files
     */
    private getMoveTargetLabelForFiles(files: TFile[]): string {
        if (files.length === 1) {
            return files[0].name;
        }

        return strings.modals.folderSuggest.multipleFilesLabel(files.length);
    }

    /**
     * Filters input name for live typing
     * Strips leading periods to avoid hidden files
     * Removes forbidden characters across all platforms (: and /)
     * Removes Windows-reserved characters on Windows (<, >, ", \\, |, ?, *)
     * Does NOT trim whitespace during live filtering to allow typing spaces
     * @param value - The input name to filter
     * @returns Filtered value
     */
    private filterNameInputLive(value: string): string {
        let filtered = stripLeadingPeriods(value);
        filtered = stripForbiddenNameCharactersAllPlatforms(filtered);
        if (Platform.isWin) {
            filtered = stripForbiddenNameCharactersWindows(filtered);
        }
        return filtered;
    }

    /**
     * Filters and trims input name for final submission
     * @param value - The input name to filter
     * @returns Trimmed and filtered value
     */
    private filterNameInputFinal(value: string): string {
        return this.filterNameInputLive(value).trim();
    }

    /**
     * Builds a folder note filename for the provided base name.
     */
    private buildFolderNoteFileName(baseName: string, extension: string, isExcalidraw: boolean): string {
        const folderNoteBaseName = isExcalidraw ? `${baseName}${EXCALIDRAW_BASENAME_SUFFIX}` : baseName;
        return `${folderNoteBaseName}.${extension}`;
    }

    /**
     * Builds a folder note filename for the provided base name.
     */
    private getFolderNoteFileName(baseName: string, folderNote: TFile): string {
        return this.buildFolderNoteFileName(baseName, folderNote.extension, isExcalidrawFile(folderNote));
    }

    /**
     * Returns options for input filtering and warnings in InputModal
     */
    private getNameInputModalOptions(): {
        inputFilter: (value: string) => string;
        onInputChange: (context: { rawValue: string; filteredValue: string }) => void;
    } {
        let previouslyHadLinkBreakingCharacters = false;

        return {
            inputFilter: (input: string) => this.filterNameInputLive(input),
            onInputChange: ({ rawValue, filteredValue }) => {
                const charactersWereRemoved = rawValue !== filteredValue;
                if (charactersWereRemoved) {
                    const hasLeadingPeriods = rawValue.startsWith('.');
                    const hasForbiddenAllPlatforms = hasLeadingPeriods || containsForbiddenNameCharactersAllPlatforms(rawValue);
                    if (hasForbiddenAllPlatforms) {
                        showNotice(strings.fileSystem.warnings.forbiddenNameCharactersAllPlatforms, { variant: 'warning' });
                    }

                    if (Platform.isWin) {
                        const hasForbiddenWindows = containsForbiddenNameCharactersWindows(rawValue);
                        if (hasForbiddenWindows) {
                            showNotice(strings.fileSystem.warnings.forbiddenNameCharactersWindows, { variant: 'warning' });
                        }
                    }
                }

                const hasLinkBreakingCharacters = containsInvalidLinkCharacters(filteredValue);
                if (hasLinkBreakingCharacters && !previouslyHadLinkBreakingCharacters) {
                    showNotice(strings.fileSystem.warnings.linkBreakingNameCharacters, { variant: 'warning' });
                }
                previouslyHadLinkBreakingCharacters = hasLinkBreakingCharacters;
            }
        };
    }

    /**
     * Returns display title for file deletion modal
     * Uses full path for folder notes, basename for regular notes
     */
    private getDeleteFileTitle(file: TFile): string {
        const settings = this.settingsProvider.settings;
        const parent = file.parent;
        if (!parent || !(parent instanceof TFolder)) {
            return file.basename;
        }

        const detectionSettings = getFolderNoteDetectionSettings(settings);

        if (!isFolderNote(file, parent, detectionSettings)) {
            return file.basename;
        }

        return file.path;
    }

    /**
     * Creates a new folder with user-provided name
     * Shows input modal for folder name and handles creation
     * @param parent - The parent folder to create the new folder in
     * @param onSuccess - Optional callback with the new folder path on successful creation
     */
    async createNewFolder(parent: TFolder, onSuccess?: (path: string) => void): Promise<void> {
        const settings = this.settingsProvider.settings;
        ensureVaultProfiles(settings);
        const showHiddenOption = settings.vaultProfiles.length >= 2;
        const nameInputOptions = this.getNameInputModalOptions();
        const modalOptions = showHiddenOption
            ? {
                  checkbox: {
                      label: strings.modals.fileSystem.hideInOtherVaultProfiles
                  },
                  ...nameInputOptions
              }
            : nameInputOptions;

        const modal = new InputModal(
            this.app,
            strings.modals.fileSystem.newFolderTitle,
            strings.modals.fileSystem.folderNamePrompt,
            async (name, context) => {
                const filteredName = this.filterNameInputFinal(name);
                if (!filteredName) {
                    return;
                }

                try {
                    const path = buildPathInFolder(parent.path, filteredName);
                    await this.app.vault.createFolder(path);
                    if (showHiddenOption && context?.checkboxValue) {
                        await this.hideFolderInOtherVaultProfiles(path);
                    }
                    if (onSuccess) {
                        onSuccess(path);
                    }
                } catch (error) {
                    this.notifyError(strings.fileSystem.errors.createFolder, error);
                }
            },
            '',
            modalOptions
        );
        modal.open();
    }

    /**
     * Creates a new markdown file with auto-generated "Untitled" name
     * Automatically increments name if "Untitled" already exists
     * Opens the file and triggers rename mode for immediate naming
     * @param parent - The parent folder to create the file in
     * @param openInNewTab - Whether the file should open in a new tab
     * @returns The created file or null if creation failed
     */
    async createNewFile(parent: TFolder, openInNewTab = false): Promise<TFile | null> {
        return createFileWithOptions(parent, this.app, {
            extension: 'md',
            content: '',
            openInNewTab,
            errorKey: 'createFile'
        });
    }

    /**
     * Creates a new markdown file in the user's configured default location and adds the selected tag in frontmatter.
     * Uses Obsidian's markdown file creation API so plugin hooks run on creation.
     * @param tagPath - Canonical tag path without # prefix
     * @param sourcePath - Current file path used for "same folder as current file" preference
     * @param openInNewTab - Whether the file should open in a new tab
     * @returns The created file or null when creation fails
     */
    async createNewFileForTag(tagPath: string, sourcePath?: string, openInNewTab = false): Promise<TFile | null> {
        const normalizedTag = normalizeTagPath(tagPath);
        if (!normalizedTag || normalizedTag === TAGGED_TAG_ID || normalizedTag === UNTAGGED_TAG_ID) {
            return null;
        }

        const tagTreeService = this.getTagTreeService();
        const tagNode = tagTreeService?.findTagNode(normalizedTag);
        const resolvedTagPath = tagNode?.displayPath ?? normalizedTag;

        try {
            const activeFilePath = this.app.workspace.getActiveFile()?.path ?? '';
            const sourceFilePath = sourcePath?.trim().length ? sourcePath : activeFilePath;
            const defaultParent = this.app.fileManager.getNewFileParent(sourceFilePath ?? '');
            const targetFolder = defaultParent instanceof TFolder ? defaultParent : this.app.vault.getRoot();
            const fileName = generateUniqueFilename(targetFolder.path, strings.fileSystem.defaultNames.untitled, 'md', this.app);
            const file = await this.app.fileManager.createNewMarkdownFile(targetFolder, fileName);

            try {
                // Mutate frontmatter through Obsidian's API so YAML serialization matches other tag operations.
                await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
                    frontmatter.tags = [resolvedTagPath];
                });
            } catch (error) {
                console.error('[Notebook Navigator] Failed to update created note tags', error);
                showNotice(strings.dragDrop.errors.failedToAddTag.replace('{tag}', `#${resolvedTagPath}`), { variant: 'warning' });
            }

            const leaf = this.app.workspace.getLeaf(openInNewTab);
            await leaf.openFile(file, { state: { mode: 'source' }, active: true });

            window.setTimeout(() => {
                executeCommand(this.app, OBSIDIAN_COMMANDS.EDIT_FILE_TITLE);
            }, TIMEOUTS.FILE_OPERATION_DELAY);

            return file;
        } catch (error) {
            this.notifyError(strings.fileSystem.errors.createFile, error);
            return null;
        }
    }

    /**
     * Creates a new markdown file in the user's configured default location and applies the selected property.
     * Uses Obsidian's markdown file creation API so plugin hooks run on creation.
     * @param propertyNodeId - Canonical property node id (`key:<property>` or `key:<property>=<value>`)
     * @param sourcePath - Current file path used for "same folder as current file" preference
     * @param openInNewTab - Whether the file should open in a new tab
     * @returns The created file or null when creation fails
     */
    async createNewFileForProperty(propertyNodeId: string, sourcePath?: string, openInNewTab = false): Promise<TFile | null> {
        if (propertyNodeId === PROPERTIES_ROOT_VIRTUAL_FOLDER_ID) {
            return null;
        }

        const assignment = this.resolvePropertyNodeAssignment(propertyNodeId);
        if (!assignment) {
            return null;
        }

        const propertyValue: unknown = assignment.writeValue;

        try {
            const activeFilePath = this.app.workspace.getActiveFile()?.path ?? '';
            const sourceFilePath = sourcePath?.trim().length ? sourcePath : activeFilePath;
            const defaultParent = this.app.fileManager.getNewFileParent(sourceFilePath ?? '');
            const targetFolder = defaultParent instanceof TFolder ? defaultParent : this.app.vault.getRoot();
            const fileName = generateUniqueFilename(targetFolder.path, strings.fileSystem.defaultNames.untitled, 'md', this.app);
            const file = await this.app.fileManager.createNewMarkdownFile(targetFolder, fileName);

            try {
                // Mutate frontmatter through Obsidian's API so YAML serialization matches other property operations.
                await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
                    frontmatter[assignment.propertyKey] = propertyValue;
                });
            } catch (error) {
                console.error('[Notebook Navigator] Failed to update created note properties', error);
                showNotice(
                    strings.dragDrop.errors.failedToSetProperty.replace('{error}', getErrorMessage(error, strings.common.unknownError)),
                    { variant: 'warning' }
                );
            }

            const leaf = this.app.workspace.getLeaf(openInNewTab);
            await leaf.openFile(file, { state: { mode: 'source' }, active: true });

            window.setTimeout(() => {
                executeCommand(this.app, OBSIDIAN_COMMANDS.EDIT_FILE_TITLE);
            }, TIMEOUTS.FILE_OPERATION_DELAY);

            return file;
        } catch (error) {
            this.notifyError(strings.fileSystem.errors.createFile, error);
            return null;
        }
    }

    /**
     * Applies a property key/value node to one or more markdown files.
     * Key nodes set `key: true`.
     * Value nodes set `key: value`, replacing the current value. When the current value is a string array, replaces it with a single item array.
     */
    async applyPropertyNodeToFiles(propertyNodeId: string, files: readonly TFile[]): Promise<ApplyPropertyNodeResult> {
        const markdownFiles = files.filter(file => file.extension === 'md');
        if (markdownFiles.length === 0) {
            return { updated: 0, skipped: 0 };
        }

        if (markdownFiles.length !== files.length) {
            showNotice(strings.fileSystem.notifications.propertiesRequireMarkdown, { variant: 'warning' });
            return { updated: 0, skipped: 0 };
        }

        const assignment = this.resolvePropertyNodeAssignment(propertyNodeId);
        if (!assignment) {
            return { updated: 0, skipped: 0 };
        }

        const normalizedPropertyKey = casefold(assignment.propertyKey);

        const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);

        let updated = 0;
        let skipped = 0;

        try {
            for (const file of markdownFiles) {
                let didChange = false;

                await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
                    const resolveExistingFrontmatterKey = (): string | null => {
                        for (const existingKey of Object.keys(frontmatter)) {
                            if (casefold(existingKey) === normalizedPropertyKey) {
                                return existingKey;
                            }
                        }
                        return null;
                    };

                    const targetPropertyKey = resolveExistingFrontmatterKey() ?? assignment.propertyKey;
                    const currentValue = frontmatter[targetPropertyKey];

                    if (assignment.nodeKind === 'key') {
                        if (currentValue === true || currentValue === null) {
                            return;
                        }

                        frontmatter[targetPropertyKey] = true;
                        didChange = true;
                        return;
                    }

                    if (assignment.writeValueKind === 'boolean') {
                        const desiredValue = assignment.writeValue;
                        if (typeof desiredValue !== 'boolean') {
                            return;
                        }

                        if (currentValue === desiredValue || (desiredValue && currentValue === null)) {
                            return;
                        }

                        frontmatter[targetPropertyKey] = desiredValue;
                        didChange = true;
                        return;
                    }

                    const desiredValue = assignment.desiredValue;
                    const normalizedDesiredValue = assignment.normalizedDesiredValue;
                    if (!desiredValue || !normalizedDesiredValue) {
                        return;
                    }

                    if (typeof currentValue === 'string') {
                        if (normalizePropertyTreeValuePath(currentValue) === normalizedDesiredValue) {
                            return;
                        }
                        frontmatter[targetPropertyKey] = desiredValue;
                        didChange = true;
                        return;
                    }

                    if (isUnknownArray(currentValue)) {
                        const isSingleMatch =
                            currentValue.length === 1 &&
                            typeof currentValue[0] === 'string' &&
                            normalizePropertyTreeValuePath(currentValue[0]) === normalizedDesiredValue;
                        if (isSingleMatch) {
                            return;
                        }

                        frontmatter[targetPropertyKey] = [desiredValue];
                        didChange = true;
                        return;
                    }

                    frontmatter[targetPropertyKey] = desiredValue;
                    didChange = true;
                });

                if (didChange) {
                    updated += 1;
                } else {
                    skipped += 1;
                }
            }
        } catch (error) {
            const message = getErrorMessage(error, strings.common.unknownError);
            showNotice(strings.dragDrop.errors.failedToSetProperty.replace('{error}', message), { variant: 'warning' });
            return { updated, skipped };
        }

        if (updated > 0) {
            const message =
                updated === 1
                    ? strings.fileSystem.notifications.propertySetOnNote
                    : strings.fileSystem.notifications.propertySetOnNotes.replace('{count}', updated.toString());
            showNotice(message, { variant: 'success' });
        }

        if (skipped > 0) {
            showNotice(strings.dragDrop.notifications.filesAlreadyHaveProperty.replace('{count}', skipped.toString()), {
                timeout: TIMEOUTS.NOTICE_ERROR,
                variant: 'warning'
            });
        }

        return { updated, skipped };
    }

    /**
     * Renames a folder with user-provided name
     * Shows input modal pre-filled with current name
     * Validates that new name is different from current
     * Also renames associated folder note if it exists
     * @param folder - The folder to rename
     * @param settings - The plugin settings (optional)
     */
    async renameFolder(folder: TFolder, settings?: NotebookNavigatorSettings): Promise<void> {
        const nameInputOptions = this.getNameInputModalOptions();

        const modal = new InputModal(
            this.app,
            strings.modals.fileSystem.renameFolderTitle,
            strings.modals.fileSystem.renamePrompt,
            async newName => {
                const filteredName = this.filterNameInputFinal(newName);
                if (!filteredName || filteredName === folder.name) {
                    return;
                }

                try {
                    const previousFolderPath = folder.path;
                    const folderNoteNamingSettings =
                        settings?.enableFolderNotes && shouldRenameFolderNoteWithFolderName(settings) ? settings : null;

                    let folderNote: TFile | null = null;
                    let renamedFolderNoteFileName: string | null = null;
                    if (folderNoteNamingSettings) {
                        folderNote = getFolderNote(folder, folderNoteNamingSettings);
                    }

                    if (folderNote && folderNoteNamingSettings) {
                        const newFolderNoteBaseName = resolveFolderNoteName(filteredName, folderNoteNamingSettings);
                        renamedFolderNoteFileName = this.getFolderNoteFileName(newFolderNoteBaseName, folderNote);
                        const conflictPath = buildPathInFolder(folder.path, renamedFolderNoteFileName);
                        const conflict = this.app.vault.getFileByPath(conflictPath);
                        if (conflict) {
                            showNotice(strings.fileSystem.errors.renameFolderNoteConflict.replace('{name}', renamedFolderNoteFileName), {
                                variant: 'warning'
                            });
                            return;
                        }
                    }

                    const parentPath = folder.parent?.path ?? '/';
                    const newFolderPath = buildPathInFolder(parentPath, filteredName);

                    // Rename the folder (moves contents including the folder note)
                    await this.app.fileManager.renameFile(folder, newFolderPath);
                    await this.syncHiddenFolderPathChange(previousFolderPath, newFolderPath);

                    // Rename folder note when naming is tied to the folder name.
                    if (folderNote && renamedFolderNoteFileName !== null) {
                        const newNotePath = buildPathInFolder(newFolderPath, renamedFolderNoteFileName);
                        await this.app.fileManager.renameFile(folderNote, newNotePath);
                    }
                } catch (error) {
                    this.notifyError(strings.fileSystem.errors.renameFolder, error);
                }
            },
            folder.name,
            nameInputOptions
        );
        modal.open();
    }

    /**
     * Renames a file with user-provided name
     * Shows input modal pre-filled with current basename
     * Preserves original file extension if not provided in new name
     * @param file - The file to rename
     */
    async renameFile(file: TFile): Promise<void> {
        // Check if file is Excalidraw to handle composite extension
        const isExcalidraw = isExcalidrawFile(file);
        const extension = file.extension;
        const extensionSuffix = extension ? `.${extension}` : '';
        // Strip .excalidraw suffix from default value for Excalidraw files
        const defaultValue = isExcalidraw ? stripExcalidrawSuffix(file.basename) : file.basename;
        const nameInputOptions = this.getNameInputModalOptions();

        const modal = new InputModal(
            this.app,
            strings.modals.fileSystem.renameFileTitle,
            strings.modals.fileSystem.renamePrompt,
            async rawInput => {
                const trimmedInput = this.filterNameInputFinal(rawInput);
                if (!trimmedInput) {
                    return;
                }

                let finalFileName: string;

                if (isExcalidraw) {
                    // Process Excalidraw files to ensure .excalidraw suffix is preserved
                    let workingName = trimmedInput;
                    const lowerWorking = workingName.toLowerCase();

                    // Remove file extension if user included it
                    if (extensionSuffix && lowerWorking.endsWith(extensionSuffix.toLowerCase())) {
                        workingName = workingName.slice(0, -extensionSuffix.length);
                    }

                    // Remove .excalidraw suffix if user included it
                    workingName = stripExcalidrawSuffix(workingName);

                    if (!workingName) {
                        return;
                    }

                    // Reconstruct filename with .excalidraw suffix
                    finalFileName = `${workingName}${EXCALIDRAW_BASENAME_SUFFIX}${extensionSuffix}`;
                } else {
                    // Preserve original extension for all other files
                    let workingName = trimmedInput;
                    if (extensionSuffix && workingName.toLowerCase().endsWith(extensionSuffix.toLowerCase())) {
                        workingName = workingName.slice(0, -extensionSuffix.length);
                    }
                    workingName = workingName.replace(/\.+$/u, '');
                    if (!workingName) {
                        return;
                    }
                    finalFileName = extensionSuffix ? `${workingName}${extensionSuffix}` : workingName;
                }

                // Skip rename if name unchanged
                if (!finalFileName || finalFileName === file.name) {
                    return;
                }

                try {
                    const parentPath = file.parent?.path ?? '/';
                    const newPath = buildPathInFolder(parentPath, finalFileName);
                    await this.app.fileManager.renameFile(file, newPath);
                } catch (error) {
                    this.notifyError(strings.fileSystem.errors.renameFile, error);
                }
            },
            defaultValue,
            nameInputOptions
        );
        modal.open();
    }

    /**
     * Deletes a folder and all its contents
     * Shows confirmation dialog if confirmBeforeDelete is true
     * Recursively deletes all files and subfolders
     * @param folder - The folder to delete
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     * @param onSuccess - Optional callback on successful deletion
     */
    async deleteFolder(folder: TFolder, confirmBeforeDelete: boolean, onSuccess?: () => void): Promise<void> {
        const folderDisplayName = this.resolveFolderDisplayLabel(folder);
        const deleteFolderWithCleanup = async () => {
            const deletedPath = folder.path;
            await this.app.fileManager.trashFile(folder);
            await this.removeHiddenFolderPathMatch(deletedPath);
            if (onSuccess) {
                onSuccess();
            }
        };

        if (confirmBeforeDelete) {
            const confirmModal = new ConfirmModal(
                this.app,
                strings.modals.fileSystem.deleteFolderTitle.replace('{name}', folderDisplayName),
                strings.modals.fileSystem.deleteFolderConfirm,
                async () => {
                    try {
                        await deleteFolderWithCleanup();
                    } catch (error) {
                        this.notifyError(strings.fileSystem.errors.deleteFolder, error);
                    }
                }
            );
            confirmModal.open();
        } else {
            // Direct deletion without confirmation
            try {
                await deleteFolderWithCleanup();
            } catch (error) {
                this.notifyError(strings.fileSystem.errors.deleteFolder, error);
            }
        }
    }

    /**
     * Deletes a file from the vault
     * Shows confirmation dialog if confirmBeforeDelete is true
     * @param file - The file to delete
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     * @param onSuccess - Optional callback on successful deletion
     * @param preDeleteAction - Optional action to run BEFORE the file is deleted (e.g., to select next file)
     */
    async deleteFile(
        file: TFile,
        confirmBeforeDelete: boolean,
        onSuccess?: () => void,
        preDeleteAction?: () => Promise<void>
    ): Promise<void> {
        const deleteTitle = this.getDeleteFileTitle(file);
        const performDeleteCore = async () => {
            const attachmentDeletion = this.prepareAttachmentDeletionState([file]);
            try {
                // Run pre-delete action if provided
                if (preDeleteAction) {
                    await preDeleteAction();
                }

                await this.app.fileManager.trashFile(file);

                if (onSuccess) {
                    onSuccess();
                }
            } catch (error) {
                this.notifyError(strings.fileSystem.errors.deleteFile, error);
                return;
            }

            await this.maybeDeleteAttachmentsAfterFileDelete(
                attachmentDeletion.candidatesBySourcePath,
                new Set([file.path]),
                attachmentDeletion.setting
            );
        };

        if (confirmBeforeDelete) {
            const confirmModal = new ConfirmModal(
                this.app,
                strings.modals.fileSystem.deleteFileTitle.replace('{name}', deleteTitle),
                strings.modals.fileSystem.deleteFileConfirm,
                async () => {
                    const commandQueue = this.getCommandQueue();
                    if (commandQueue) {
                        await commandQueue.executeDeleteFiles([file], performDeleteCore);
                    } else {
                        await performDeleteCore();
                    }
                }
            );
            confirmModal.open();
        } else {
            // Direct deletion without confirmation
            const commandQueue = this.getCommandQueue();
            if (commandQueue) {
                await commandQueue.executeDeleteFiles([file], performDeleteCore);
            } else {
                await performDeleteCore();
            }
        }
    }

    /**
     * Smart delete handler for the currently selected file in the Navigator
     * Automatically selects the next file in the same folder before deletion
     * Used by both keyboard shortcuts and context menu
     *
     * @param file - The file to delete
     * @param settings - Plugin settings
     * @param selectionContext - Current selection context (type, folder, tag)
     * @param selectionDispatch - Selection dispatch function
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     */
    async deleteSelectedFile(
        file: TFile,
        settings: NotebookNavigatorSettings,
        selectionContext: SelectionContext,
        selectionDispatch: SelectionDispatch,
        confirmBeforeDelete: boolean
    ): Promise<void> {
        // Get the file list based on selection type
        // Get current UX preferences for descendant/hidden items when determining next file to select
        const visibility = this.getVisibilityPreferences();
        const currentFiles = getFilesForNavigationSelection(
            {
                selectionType: selectionContext.selectionType,
                selectedFolder: selectionContext.selectedFolder ?? null,
                selectedTag: selectionContext.selectedTag ?? null,
                selectedProperty: selectionContext.selectedProperty ?? null
            },
            settings,
            visibility,
            this.app,
            this.getTagTreeService(),
            this.getPropertyTreeService()
        );

        // Find next file to select
        let nextFileToSelect: TFile | null = null;
        const currentIndex = currentFiles.findIndex(f => f.path === file.path);

        if (currentIndex !== -1 && currentFiles.length > 1) {
            // Try next file first
            if (currentIndex < currentFiles.length - 1) {
                nextFileToSelect = currentFiles[currentIndex + 1];
            } else if (currentIndex > 0) {
                // No next file, use previous
                nextFileToSelect = currentFiles[currentIndex - 1];
            }
        }

        // Perform the delete with pre-selection
        await this.deleteFile(file, confirmBeforeDelete, undefined, async () => {
            // Pre-delete action: select next file or close editor
            if (nextFileToSelect) {
                // Verify the next file still exists (in case of concurrent deletions)
                const stillExists = this.app.vault.getFileByPath(nextFileToSelect.path);
                if (stillExists) {
                    // Update selection and open the file
                    await updateSelectionAfterFileOperation(nextFileToSelect, selectionDispatch, this.app);
                } else {
                    // Next file was deleted, clear selection
                    await updateSelectionAfterFileOperation(null, selectionDispatch, this.app);
                }
            } else {
                // No other files in folder
                // Don't detach the leaf - let Obsidian handle it naturally after deletion
                // Just clear the selection
                selectionDispatch({ type: 'SET_SELECTED_FILE', file: null });
            }

            // Try to maintain focus on file list using a more reliable method
            window.setTimeout(() => {
                const fileListEl = document.querySelector('.nn-list-pane-scroller');
                if (fileListEl instanceof HTMLElement) {
                    fileListEl.focus();
                }
            }, TIMEOUTS.FILE_OPERATION_DELAY);
        });
    }

    /**
     * Checks if one file/folder is a descendant of another
     * Used to prevent invalid drag-and-drop operations
     * Prevents moving a folder into its own subfolder
     * @param parent - The potential parent file/folder
     * @param child - The potential descendant file/folder
     * @returns True if child is a descendant of parent
     */
    isDescendant(parent: TAbstractFile, child: TAbstractFile): boolean {
        let current = child.parent;
        while (current) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    }

    /**
     * Moves multiple files to a target folder with validation and smart selection
     * Extracted from useDragAndDrop to enable reuse across drag-drop and context menu
     *
     * @param options - Move operation options
     * @returns Result object with moved count, skipped count, and errors
     */
    async moveFilesToFolder(options: MoveFilesOptions): Promise<MoveFilesResult> {
        const { files, targetFolder, selectionContext, showNotifications = true } = options;
        const result: MoveFilesResult = { movedCount: 0, skippedCount: 0, cancelledCount: 0, errors: [] };

        if (files.length === 0) return result;

        const selectedFileOriginalPath = selectionContext?.selectedFile?.path ?? null;

        const commandQueue = this.getCommandQueue();
        if (commandQueue) {
            const moveConflictsSetting = this.resolveMoveFileConflictsSetting();
            const targetFolderLabel = this.resolveFolderDisplayLabel(targetFolder);

            const performMove = async (): Promise<MoveFilesCommandData> => {
                let cancelledCount = 0;
                const movedSourcePaths: string[] = [];
                const errors: { filePath: string; error: unknown }[] = [];

                const plannedMoves: PlannedFileMove[] = [];
                const deferredConflicts: DeferredMoveConflict[] = [];
                const existingDestinationEntries = new Map<string, TAbstractFile>();
                const reservedPaths = new Set<string>();
                const suggestionReservedPaths = new Set<string>();

                targetFolder.children.forEach(child => {
                    const childPath = normalizePath(child.path);
                    existingDestinationEntries.set(childPath, child);
                    suggestionReservedPaths.add(childPath);
                });

                const computeUniqueTargetPath = (file: TFile, additionalReserved: ReadonlySet<string>, useVaultLookup: boolean): string => {
                    const excalidraw = isExcalidrawFile(file);
                    const baseName = excalidraw ? stripExcalidrawSuffix(file.basename) : file.basename;
                    const uniqueFileName = generateUniqueFilename(targetFolder.path, baseName, file.extension, this.app, {
                        occupiedPaths: additionalReserved,
                        useVaultLookup,
                        baseNameSuffix: excalidraw ? EXCALIDRAW_BASENAME_SUFFIX : ''
                    });
                    return buildFilePathInFolder(targetFolder.path, uniqueFileName, file.extension);
                };

                for (const file of files) {
                    const originalPath = file.path;
                    const desiredPath = buildPathInFolder(targetFolder.path, file.name);

                    if (desiredPath === originalPath) {
                        continue;
                    }

                    const reservedCollision = reservedPaths.has(desiredPath);
                    const existingEntry = reservedCollision ? null : (existingDestinationEntries.get(desiredPath) ?? null);

                    if (!reservedCollision && !existingEntry) {
                        plannedMoves.push({ file, originalPath, targetPath: desiredPath, overwrite: false });
                        reservedPaths.add(desiredPath);
                        suggestionReservedPaths.add(desiredPath);
                        continue;
                    }

                    const suggestedPath = computeUniqueTargetPath(file, suggestionReservedPaths, false);
                    suggestionReservedPaths.add(suggestedPath);
                    const canOverwrite = existingEntry instanceof TFile;

                    if (moveConflictsSetting === 'rename') {
                        plannedMoves.push({ file, originalPath, targetPath: suggestedPath, overwrite: false });
                        reservedPaths.add(suggestedPath);
                        continue;
                    }

                    deferredConflicts.push({
                        file,
                        originalPath,
                        desiredPath,
                        suggestedPath,
                        canOverwrite
                    });
                }

                if (moveConflictsSetting === 'ask' && deferredConflicts.length > 0) {
                    const conflictItems: MoveFileConflictItem[] = deferredConflicts.map(conflict => {
                        const suggestedFileName = conflict.suggestedPath.split('/').pop() ?? conflict.file.name;
                        return {
                            sourceFileName: conflict.file.name,
                            suggestedFileName,
                            canOverwrite: conflict.canOverwrite
                        };
                    });

                    const resolution = await new Promise<MoveFileConflictResolution | null>(resolve => {
                        const modal = new MoveFileConflictModal(this.app, {
                            targetFolderName: targetFolderLabel,
                            conflicts: conflictItems,
                            onResolve: resolve
                        });
                        modal.open();
                    });

                    if (!resolution) {
                        cancelledCount = deferredConflicts.length;
                        return { movedCount: 0, skippedCount: 0, cancelledCount, movedSourcePaths: [], errors: [] };
                    }

                    for (const conflict of deferredConflicts) {
                        const shouldOverwrite =
                            resolution === 'overwrite' && conflict.canOverwrite && !reservedPaths.has(conflict.desiredPath);
                        let targetPath = shouldOverwrite ? conflict.desiredPath : conflict.suggestedPath;

                        if (!shouldOverwrite && reservedPaths.has(targetPath)) {
                            targetPath = computeUniqueTargetPath(conflict.file, suggestionReservedPaths, false);
                            suggestionReservedPaths.add(targetPath);
                        }

                        plannedMoves.push({
                            file: conflict.file,
                            originalPath: conflict.originalPath,
                            targetPath,
                            overwrite: shouldOverwrite
                        });
                        reservedPaths.add(targetPath);
                    }
                }

                let movedCount = 0;
                let skippedCount = 0;

                const executePlannedMove = async (plan: PlannedFileMove): Promise<PlannedMoveExecutionOutcome> => {
                    let finalTargetPath = plan.targetPath;

                    if (!plan.overwrite && this.app.vault.getAbstractFileByPath(finalTargetPath)) {
                        finalTargetPath = computeUniqueTargetPath(plan.file, reservedPaths, true);
                        reservedPaths.add(finalTargetPath);
                    }

                    try {
                        if (plan.overwrite) {
                            const entryToOverwrite = this.app.vault.getAbstractFileByPath(finalTargetPath);
                            if (entryToOverwrite instanceof TFile) {
                                await this.app.fileManager.trashFile(entryToOverwrite);
                            } else if (entryToOverwrite) {
                                return { status: 'skipped' };
                            }
                        }

                        await this.app.fileManager.renameFile(plan.file, finalTargetPath);
                        return {
                            status: 'moved',
                            originalPath: plan.originalPath
                        };
                    } catch (error) {
                        console.error('Error moving file:', plan.originalPath, error);
                        return {
                            status: 'error',
                            originalPath: plan.originalPath,
                            error
                        };
                    }
                };

                for (let index = 0; index < plannedMoves.length; index += FILE_MOVE_BATCH_SIZE) {
                    const batch = plannedMoves.slice(index, index + FILE_MOVE_BATCH_SIZE);
                    const outcomes = await Promise.all(batch.map(plan => executePlannedMove(plan)));

                    for (const outcome of outcomes) {
                        if (outcome.status === 'moved') {
                            movedCount++;
                            movedSourcePaths.push(outcome.originalPath);
                            continue;
                        }

                        if (outcome.status === 'skipped') {
                            skippedCount++;
                            continue;
                        }

                        errors.push({ filePath: outcome.originalPath, error: outcome.error });
                    }
                }

                return { movedCount, skippedCount, cancelledCount, movedSourcePaths, errors };
            };

            const moveResult = await commandQueue.executeMoveFiles(files, targetFolder, performMove);
            if (!moveResult.success || !moveResult.data) {
                if (moveResult.error) {
                    console.error('Error during move operation:', moveResult.error);
                    throw moveResult.error;
                }
                throw new Error('Move operation failed');
            }

            result.movedCount = moveResult.data.movedCount;
            result.skippedCount = moveResult.data.skippedCount;
            result.cancelledCount = moveResult.data.cancelledCount;

            // Handle selection updates if needed
            if (selectionContext && selectedFileOriginalPath) {
                const movedPathSet = new Set(moveResult.data.movedSourcePaths);
                if (movedPathSet.has(selectedFileOriginalPath)) {
                    const nextFileToSelect = findNextFileAfterRemoval(selectionContext.allFiles, movedPathSet);
                    await updateSelectionAfterFileOperation(nextFileToSelect, selectionContext.dispatch, this.app);
                }
            }

            // Map per-file errors back to TFile where possible for downstream notices
            if (Array.isArray(moveResult.data.errors) && moveResult.data.errors.length > 0) {
                for (const err of moveResult.data.errors) {
                    const f = this.app.vault.getFileByPath(err.filePath);
                    if (f) {
                        result.errors.push({ file: f, error: err.error as Error });
                    } else {
                        // Fall back to first of the requested files with matching path
                        const fallback = files.find(x => x.path === err.filePath) || files[0];
                        result.errors.push({ file: fallback, error: err.error as Error });
                    }
                }
            }
        }

        // Show notifications if enabled
        if (showNotifications) {
            if (result.skippedCount > 0) {
                const message =
                    files.length === 1
                        ? strings.dragDrop.errors.itemAlreadyExists.replace('{name}', files[0].name)
                        : strings.dragDrop.notifications.filesAlreadyExist.replace('{count}', result.skippedCount.toString());
                showNotice(message, { timeout: TIMEOUTS.NOTICE_ERROR, variant: 'warning' });
            }

            if (result.errors.length > 0 && files.length === 1) {
                const firstError = result.errors[0]?.error as unknown;
                const msg =
                    typeof (firstError as { message?: unknown })?.message === 'string' &&
                    ((firstError as { message?: string }).message?.trim() ?? '')
                        ? (firstError as { message: string }).message
                        : strings.common.unknownError;
                showNotice(strings.dragDrop.errors.failedToMove.replace('{error}', msg), { variant: 'warning' });
            }
        }

        return result;
    }

    /**
     * Shows a folder selection modal and moves files to the selected folder
     * Used by context menu and keyboard shortcuts for interactive file moving
     *
     * @param files - Files to move
     * @param selectionContext - Optional selection context for smart selection updates
     */
    async moveFilesWithModal(
        files: TFile[],
        selectionContext?: {
            selectedFile: TFile | null;
            dispatch: SelectionDispatch;
            allFiles: TFile[];
        }
    ): Promise<void> {
        if (files.length === 0) return;

        // Create a set of paths to exclude (source folders and their parents)
        const excludePaths = new Set<string>();

        // For single file moves, exclude the parent folder
        if (files.length === 1 && files[0].parent) {
            excludePaths.add(files[0].parent.path);
        }

        const isMultiple = files.length > 1;
        const placeholderText = this.getMovePlaceholder(this.getMoveTargetLabelForFiles(files), !isMultiple);

        // Show the folder selection modal
        const modal = new FolderSuggestModal(
            this.app,
            async targetFolder => {
                // Move the files to the selected folder
                const result = await this.moveFilesToFolder({
                    files,
                    targetFolder,
                    selectionContext,
                    showNotifications: true
                });

                // Show summary notification for multiple files
                if (files.length > 1 && result.movedCount > 0) {
                    showNotice(
                        strings.fileSystem.notifications.movedMultipleFiles
                            .replace('{count}', result.movedCount.toString())
                            .replace('{folder}', targetFolder.name),
                        { variant: 'success' }
                    );
                }
            },
            placeholderText,
            strings.modals.folderSuggest.instructions.move,
            excludePaths
        );

        modal.open();
    }

    /**
     * Shows a folder selection modal and moves the specified folder to the chosen destination
     * Excludes the folder itself and all descendants from the destination list to prevent recursion
     *
     * @param folder - Folder to move
     * @returns Status object describing success with the new location data, a cancel signal, or an error payload
     */
    async moveFolderWithModal(folder: TFolder): Promise<MoveFolderModalResult> {
        const folderDisplayName = this.resolveFolderDisplayLabel(folder);
        const excludePaths = new Set<string>();

        const collectPaths = (current: TFolder) => {
            excludePaths.add(current.path);
            current.children.forEach(child => {
                if (child instanceof TFolder) {
                    collectPaths(child);
                }
            });
        };

        collectPaths(folder);

        return new Promise(resolve => {
            let isResolved = false;

            const finish = (result: MoveFolderModalResult) => {
                if (!isResolved) {
                    isResolved = true;
                    resolve(result);
                }
            };

            const modal = new CancelAwareFolderSuggestModal(
                this.app,
                async targetFolder => {
                    // Prevent selecting the folder itself or any descendant
                    if (targetFolder.path === folder.path || targetFolder.path.startsWith(`${folder.path}/`)) {
                        showNotice(strings.dragDrop.errors.cannotMoveIntoSelf, { variant: 'warning' });
                        return;
                    }

                    const newPath = buildPathInFolder(targetFolder.path, folder.name);

                    // No-op if destination equals current location
                    if (newPath === folder.path) {
                        modal.close();
                        finish({ status: 'cancelled' });
                        return;
                    }

                    try {
                        const moveData = await this.moveFolderToTarget(folder, targetFolder);
                        showNotice(strings.fileSystem.notifications.folderMoved.replace('{name}', folderDisplayName), {
                            variant: 'success'
                        });
                        modal.close();
                        finish({ status: 'success', data: moveData });
                    } catch (error) {
                        if (error instanceof FolderMoveError) {
                            if (error.code === 'destination-exists') {
                                showNotice(strings.fileSystem.errors.folderAlreadyExists.replace('{name}', folderDisplayName), {
                                    variant: 'warning'
                                });
                                return;
                            }
                            if (error.code === 'invalid-target') {
                                showNotice(strings.dragDrop.errors.cannotMoveIntoSelf, { variant: 'warning' });
                                return;
                            }
                        }
                        console.error('Failed to move folder via modal:', error);
                        showNotice(strings.dragDrop.errors.failedToMoveFolder.replace('{name}', folderDisplayName), { variant: 'warning' });
                        modal.close();
                        finish({ status: 'error', error });
                    }
                },
                this.getMovePlaceholder(folderDisplayName, true),
                strings.modals.folderSuggest.instructions.move,
                excludePaths,
                () => finish({ status: 'cancelled' })
            );

            modal.open();
        });
    }

    async moveFolderToTarget(folder: TFolder, targetFolder: TFolder): Promise<MoveFolderResult> {
        if (targetFolder.path === folder.path || targetFolder.path.startsWith(`${folder.path}/`)) {
            throw new FolderMoveError('invalid-target');
        }

        const newPath = buildPathInFolder(targetFolder.path, folder.name);
        if (newPath === folder.path) {
            throw new FolderMoveError('invalid-target');
        }

        const existingEntry = this.app.vault.getAbstractFileByPath(newPath);
        if (existingEntry) {
            throw new FolderMoveError('destination-exists');
        }

        const oldPath = folder.path;
        await this.app.fileManager.renameFile(folder, newPath);

        const movedEntry = this.app.vault.getAbstractFileByPath(newPath);
        if (!movedEntry || !(movedEntry instanceof TFolder)) {
            throw new FolderMoveError('verification-failed');
        }

        await this.syncHiddenFolderPathChange(oldPath, newPath);

        return { oldPath, newPath, targetFolder };
    }

    /**
     * Renames a file to match its parent folder's folder note naming
     * @param file - The file to rename
     * @param settings - Notebook Navigator settings for folder note configuration
     */
    async setFileAsFolderNote(file: TFile, settings: NotebookNavigatorSettings): Promise<void> {
        if (!settings.enableFolderNotes) {
            return;
        }

        const parent = file.parent;
        if (!parent || !(parent instanceof TFolder)) {
            return;
        }

        if (parent.path === '/') {
            return;
        }

        const detectionSettings = getFolderNoteDetectionSettings(settings);

        if (isFolderNote(file, parent, detectionSettings)) {
            showNotice(strings.fileSystem.errors.folderNoteAlreadyLinked, { variant: 'warning' });
            return;
        }

        if (!isSupportedFolderNoteExtension(file.extension)) {
            showNotice(strings.fileSystem.errors.folderNoteUnsupportedExtension.replace('{extension}', file.extension), {
                variant: 'warning'
            });
            return;
        }

        const existingFolderNote = getFolderNote(parent, detectionSettings);
        if (existingFolderNote && existingFolderNote.path !== file.path) {
            showNotice(strings.fileSystem.errors.folderNoteAlreadyExists, { variant: 'warning' });
            return;
        }

        const isExcalidraw = isExcalidrawFile(file);
        let targetBaseName = resolveFolderNoteName(parent.name, settings);
        if (isExcalidraw) {
            // Strip .excalidraw from the base name for folder note naming.
            targetBaseName = stripExcalidrawSuffix(targetBaseName);
            if (!targetBaseName) {
                return;
            }
        }

        const targetFileName = this.buildFolderNoteFileName(targetBaseName, file.extension, isExcalidraw);
        const targetPath = buildPathInFolder(parent.path, targetFileName);

        if (file.path === targetPath) {
            return;
        }

        if (this.app.vault.getAbstractFileByPath(targetPath)) {
            showNotice(strings.fileSystem.errors.folderNoteRenameConflict.replace('{name}', targetFileName), {
                variant: 'warning'
            });
            return;
        }

        try {
            await this.app.fileManager.renameFile(file, targetPath);
        } catch (error) {
            this.notifyError(strings.fileSystem.errors.renameFile, error);
        }
    }

    /**
     * Converts a single file into a folder note by creating a sibling folder and moving the file inside
     * @param file - The file to convert
     * @param settings - Notebook Navigator settings for folder note configuration
     */
    async convertFileToFolderNote(file: TFile, settings: NotebookNavigatorSettings): Promise<void> {
        // Validate folder notes are enabled
        if (!settings.enableFolderNotes) {
            showNotice(strings.fileSystem.errors.folderNotesDisabled, { variant: 'warning' });
            return;
        }

        // Validate file has a parent folder
        const parent = file.parent;
        if (!parent || !(parent instanceof TFolder)) {
            showNotice(strings.fileSystem.errors.folderNoteConversionFailed, { variant: 'warning' });
            return;
        }

        const detectionSettings = getFolderNoteDetectionSettings(settings);

        // Check if file is already acting as a folder note
        if (isFolderNote(file, parent, detectionSettings)) {
            showNotice(strings.fileSystem.errors.folderNoteAlreadyLinked, { variant: 'warning' });
            return;
        }

        // Validate file extension is supported for folder notes
        if (!isSupportedFolderNoteExtension(file.extension)) {
            showNotice(strings.fileSystem.errors.folderNoteUnsupportedExtension.replace('{extension}', file.extension), {
                variant: 'warning'
            });
            return;
        }

        const isExcalidraw = isExcalidrawFile(file);
        let folderName = file.basename;
        if (isExcalidraw) {
            // Strip .excalidraw from the basename when deriving the folder name.
            folderName = stripExcalidrawSuffix(folderName);
            if (!folderName) {
                showNotice(strings.fileSystem.errors.folderNoteConversionFailed, { variant: 'warning' });
                return;
            }
        }

        // Build target folder path using the file's basename
        const targetFolderPath = buildPathInFolder(parent.path, folderName);

        // Check if folder already exists to avoid conflicts
        if (this.app.vault.getAbstractFileByPath(targetFolderPath)) {
            showNotice(strings.fileSystem.errors.folderAlreadyExists.replace('{name}', folderName), { variant: 'warning' });
            return;
        }

        // Determine final filename based on folder note settings
        let finalBaseName = resolveFolderNoteName(folderName, settings);
        if (isExcalidraw) {
            // Strip .excalidraw from the base name for folder note naming.
            finalBaseName = stripExcalidrawSuffix(finalBaseName);
            if (!finalBaseName) {
                showNotice(strings.fileSystem.errors.folderNoteConversionFailed, { variant: 'warning' });
                return;
            }
        }

        // Create the target folder
        try {
            await this.app.vault.createFolder(targetFolderPath);
        } catch (error) {
            this.notifyError(strings.fileSystem.errors.createFolder, error);
            return;
        }

        // Verify folder was created successfully
        const targetFolder = this.app.vault.getAbstractFileByPath(targetFolderPath);
        if (!targetFolder || !(targetFolder instanceof TFolder)) {
            showNotice(strings.fileSystem.errors.folderNoteConversionFailed, { variant: 'warning' });
            return;
        }

        try {
            // Move file into the newly created folder
            const moveResult = await this.moveFilesToFolder({
                files: [file],
                targetFolder,
                showNotifications: false
            });

            // Handle move failure by cleaning up empty folder
            if (moveResult.movedCount === 0) {
                await this.removeFolderIfEmpty(targetFolder);
                const firstError = moveResult.errors[0]?.error;
                this.notifyError(strings.fileSystem.errors.folderNoteMoveFailed, firstError, strings.common.unknownError);
                return;
            }

            // Get reference to the moved file
            const movedFilePath = buildPathInFolder(targetFolder.path, file.name);
            const movedFileEntry = this.app.vault.getAbstractFileByPath(movedFilePath);
            if (!movedFileEntry || !(movedFileEntry instanceof TFile)) {
                showNotice(strings.fileSystem.errors.folderNoteConversionFailed, { variant: 'warning' });
                return;
            }
            let movedFile: TFile = movedFileEntry;

            // Rename file if folder note name setting requires it
            const finalFileName = this.buildFolderNoteFileName(finalBaseName, file.extension, isExcalidraw);
            const finalPath = buildPathInFolder(targetFolder.path, finalFileName);

            if (movedFile.path !== finalPath) {
                if (this.app.vault.getAbstractFileByPath(finalPath)) {
                    showNotice(strings.fileSystem.errors.folderNoteRenameConflict.replace('{name}', finalFileName), { variant: 'warning' });
                } else {
                    await this.app.fileManager.renameFile(movedFile, finalPath);
                    const updatedFile = this.app.vault.getAbstractFileByPath(finalPath);
                    if (updatedFile instanceof TFile) {
                        movedFile = updatedFile;
                    }
                }
            }

            // Attempt to open the folder note using command queue for proper context tracking
            const commandQueue = this.getCommandQueue();
            let opened = false;

            if (commandQueue) {
                const openResult = await commandQueue.executeOpenFolderNote(targetFolder.path, async () => {
                    await this.app.workspace.getLeaf().openFile(movedFile);
                });

                if (openResult.success) {
                    opened = true;
                } else {
                    console.error('Failed to open folder note via command queue', openResult.error);
                }
            }

            // Fallback to direct file opening if command queue unavailable or failed
            if (!opened) {
                try {
                    await this.app.workspace.getLeaf().openFile(movedFile);
                    opened = true;
                } catch (openError) {
                    console.error('Failed to open folder note after conversion', openError);
                    this.notifyError(strings.fileSystem.errors.folderNoteOpenFailed, openError);
                }
            }

            // Show success notification only if file was successfully opened
            if (opened) {
                showNotice(strings.fileSystem.notifications.folderNoteConversionSuccess.replace('{name}', targetFolder.name), {
                    variant: 'success'
                });
            }
        } catch (error) {
            // Clean up folder on any error and show error message
            await this.removeFolderIfEmpty(targetFolder);
            this.notifyError(strings.fileSystem.errors.folderNoteConversionFailedWithReason, error);
        }
    }

    /**
     * Removes a folder if it's empty
     * Used for cleanup after failed folder note conversion
     * @param folder - The folder to remove if empty
     */
    private async removeFolderIfEmpty(folder: TFolder): Promise<void> {
        if (folder.children.length > 0) {
            return;
        }

        try {
            await this.app.fileManager.trashFile(folder);
        } catch (error) {
            console.error('Failed to remove folder after conversion failure', error);
        }
    }

    /**
     * Duplicates a file with an incremented name
     * @param file - The file to duplicate
     */
    async duplicateNote(file: TFile): Promise<void> {
        try {
            const baseName = file.basename;
            const extension = file.extension;
            const parentPath = file.parent?.path ?? '/';
            const newName = generateUniqueFilename(parentPath, baseName, extension, this.app);
            const newPath = buildFilePathInFolder(parentPath, newName, extension);

            const newFile = await this.app.vault.copy(file, newPath);

            if (newFile instanceof TFile) {
                await this.app.workspace.getLeaf(false).openFile(newFile);
            }
        } catch (error) {
            this.notifyError(strings.fileSystem.errors.duplicateNote, error);
        }
    }

    /**
     * Creates a new canvas file in the specified folder
     * @param parent - The parent folder
     */
    async createCanvas(parent: TFolder): Promise<TFile | null> {
        return createFileWithOptions(parent, this.app, {
            extension: 'canvas',
            content: '{}',
            errorKey: 'createCanvas'
        });
    }

    /**
     * Creates a new database view file in the specified folder
     * @param parent - The parent folder
     */
    async createBase(parent: TFolder): Promise<TFile | null> {
        return createFileWithOptions(parent, this.app, {
            extension: 'base',
            content: createDatabaseContent(),
            errorKey: 'createDatabase'
        });
    }

    /**
     * Duplicates a folder and all its contents
     * @param folder - The folder to duplicate
     */
    async duplicateFolder(folder: TFolder): Promise<void> {
        try {
            const baseName = folder.name;
            let counter = 1;
            let newName = `${baseName} ${counter}`;
            const parentPath = folder.parent?.path ?? '/';
            let newPath = buildPathInFolder(parentPath, newName);

            while (this.app.vault.getFolderByPath(newPath)) {
                counter++;
                newName = `${baseName} ${counter}`;
                newPath = buildPathInFolder(parentPath, newName);
            }

            await this.app.vault.copy(folder, newPath);
            await this.copyFolderDisplayMetadata(folder.path, newPath);
        } catch (error) {
            this.notifyError(strings.fileSystem.errors.duplicateFolder, error);
        }
    }

    /**
     * Deletes multiple files with confirmation
     * @param files - Array of files to delete
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     * @param preDeleteAction - Optional action to run BEFORE files are deleted
     */
    async deleteMultipleFiles(files: TFile[], confirmBeforeDelete = true, preDeleteAction?: () => void | Promise<void>): Promise<void> {
        if (files.length === 0) return;

        const performDeleteCore = async () => {
            const attachmentDeletion = this.prepareAttachmentDeletionState(files);

            // Run optional pre-delete action (e.g., to update selection)
            if (preDeleteAction) {
                try {
                    await preDeleteAction();
                } catch (e) {
                    // Continue with delete even if pre-delete action throws
                    console.error('Pre-delete action failed:', e);
                }
            }

            // Delete all files in parallel for instant removal
            const errors: { file: TFile; error: unknown }[] = [];
            let deletedCount = 0;

            const results = await Promise.allSettled(files.map(file => this.app.fileManager.trashFile(file)));
            const deletedSourcePaths = new Set<string>();

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    deletedCount++;
                    deletedSourcePaths.add(files[index].path);
                } else {
                    const file = files[index];
                    errors.push({ file, error: result.reason });
                    console.error('Error deleting file:', file.path, result.reason);
                }
            });

            await this.maybeDeleteAttachmentsAfterFileDelete(
                attachmentDeletion.candidatesBySourcePath,
                deletedSourcePaths,
                attachmentDeletion.setting
            );

            // Show appropriate notifications
            if (deletedCount > 0) {
                showNotice(strings.fileSystem.notifications.deletedMultipleFiles.replace('{count}', deletedCount.toString()), {
                    variant: 'success'
                });
            }

            if (errors.length > 0) {
                const errorMsg =
                    errors.length === 1
                        ? strings.fileSystem.errors.failedToDeleteFile
                              .replace('{name}', errors[0].file.name)
                              .replace('{error}', getErrorMessage(errors[0].error))
                        : strings.fileSystem.errors.failedToDeleteMultipleFiles.replace('{count}', errors.length.toString());
                showNotice(errorMsg, { variant: 'warning' });
            }
        };

        if (confirmBeforeDelete) {
            // Import dynamically to avoid circular dependencies
            const { ConfirmModal } = await import('../modals/ConfirmModal');

            const modal = new ConfirmModal(
                this.app,
                strings.fileSystem.confirmations.deleteMultipleFiles.replace('{count}', files.length.toString()),
                strings.fileSystem.confirmations.deleteConfirmation,
                async () => {
                    const commandQueue = this.getCommandQueue();
                    if (commandQueue) {
                        await commandQueue.executeDeleteFiles(files, performDeleteCore);
                    } else {
                        await performDeleteCore();
                    }
                }
            );
            modal.open();
        } else {
            const commandQueue = this.getCommandQueue();
            if (commandQueue) {
                await commandQueue.executeDeleteFiles(files, performDeleteCore);
            } else {
                await performDeleteCore();
            }
        }
    }

    /**
     * Deletes selected files with smart selection of next file
     * Centralizes the delete logic used by both keyboard shortcuts and context menu
     * @param selectedFiles - Set of selected file paths
     * @param allFiles - All files in the current view (for finding next file)
     * @param selectionDispatch - Selection dispatch function
     * @param confirmBeforeDelete - Whether to show confirmation dialog
     */
    async deleteFilesWithSmartSelection(
        selectedFiles: Set<string>,
        allFiles: TFile[],
        selectionDispatch: SelectionDispatch,
        confirmBeforeDelete: boolean
    ): Promise<void> {
        // Convert selected paths to files
        const filesToDelete = Array.from(selectedFiles)
            .map(path => this.app.vault.getFileByPath(path))
            .filter((f): f is TFile => f !== null);

        if (filesToDelete.length === 0) return;

        // Find next file to select using utility
        const nextFileToSelect = findNextFileAfterRemoval(allFiles, selectedFiles);

        // Delete the files with a pre-delete action that updates selection only after confirmation
        await this.deleteMultipleFiles(filesToDelete, confirmBeforeDelete, async () => {
            if (nextFileToSelect) {
                // Verify the next file still exists (matching single file deletion)
                const stillExists = this.app.vault.getFileByPath(nextFileToSelect.path);
                if (stillExists) {
                    // Update selection using same params as single file deletion
                    await updateSelectionAfterFileOperation(nextFileToSelect, selectionDispatch, this.app);
                } else {
                    // Next file was deleted, clear selection
                    await updateSelectionAfterFileOperation(null, selectionDispatch, this.app);
                }
            } else {
                // No files left in folder - clear selection
                selectionDispatch({ type: 'CLEAR_FILE_SELECTION' });
            }

            // Focus management (matching single file deletion)
            window.setTimeout(() => {
                const fileListEl = document.querySelector('.nn-list-pane-scroller');
                if (fileListEl instanceof HTMLElement) {
                    fileListEl.focus();
                }
            }, TIMEOUTS.FILE_OPERATION_DELAY);
        });
    }

    /**
     * Opens version history for a file using Obsidian Sync.
     *
     * The version history modal requires the editor to have focus when the command executes.
     * The Notebook Navigator's aggressive focus management can interfere with this.
     *
     * Solution:
     * 1. Track the operation to prevent the navigator from stealing focus
     * 2. Always use openLinkText to open/re-open the file (ensures proper editor focus)
     * 3. Wait briefly for the editor to be ready
     * 4. Execute the version history command
     *
     * @param file - The file to view version history for
     */
    async openVersionHistory(file: TFile): Promise<void> {
        const commandQueue = this.getCommandQueue();
        if (!commandQueue) {
            showNotice(strings.fileSystem.errors.versionHistoryNotAvailable, { variant: 'warning' });
            return;
        }

        const result = await commandQueue.executeOpenVersionHistory(file, async () => {
            // Always open/re-open the file to ensure proper focus
            await this.app.workspace.openLinkText(file.path, '', false);

            // Small delay to ensure the editor is ready
            await new Promise(resolve => window.setTimeout(resolve, TIMEOUTS.FILE_OPERATION_DELAY));

            // Execute the version history command
            if (!executeCommand(this.app, OBSIDIAN_COMMANDS.VERSION_HISTORY)) {
                showNotice(strings.fileSystem.errors.versionHistoryNotFound, { variant: 'warning' });
            }
        });

        if (!result.success && result.error) {
            this.notifyError(strings.fileSystem.errors.openVersionHistory, result.error);
        }
    }

    /**
     * Gets the platform-specific text for the "Reveal in system explorer" menu option
     * @returns The appropriate text based on the current platform
     */
    getRevealInSystemExplorerText(): string {
        if (Platform.isMacOS) {
            return strings.contextMenu.file.revealInFinder;
        }
        return strings.contextMenu.file.showInExplorer;
    }

    /**
     * Reveals a file or folder in the system's file explorer
     * @param file - The file or folder to reveal
     */
    async revealInSystemExplorer(file: TFile | TFolder): Promise<void> {
        try {
            // Use Obsidian's built-in method to reveal the file or folder
            // Note: showInFolder is not in Obsidian's public TypeScript API, but is widely used by plugins
            // showInFolder expects the vault-relative path, not the full system path
            if (!this.hasShowInFolder(this.app)) {
                showNotice(strings.fileSystem.errors.revealInExplorer, { variant: 'warning' });
                return;
            }
            await this.app.showInFolder(file.path);
        } catch (error) {
            this.notifyError(strings.fileSystem.errors.revealInExplorer, error);
        }
    }

    /** Type guard checking if the app exposes the showInFolder method */
    private hasShowInFolder(app: App): app is ExtendedApp {
        const showInFolder: unknown = Reflect.get(app, 'showInFolder');
        return typeof showInFolder === 'function';
    }

    /**
     * Creates a new drawing in the specified folder
     * Supports Excalidraw and Tldraw
     * @param parent - The parent folder to create the drawing in
     * @param type - Drawing provider to use
     * @returns The created file or null if creation failed
     */
    async createNewDrawing(parent: TFolder, type: DrawingType = 'excalidraw'): Promise<TFile | null> {
        try {
            const pluginFile = await createDrawingWithPlugin(this.app, parent, type);
            if (pluginFile) {
                return pluginFile;
            }

            const allowCompatibilitySuffix = type !== 'excalidraw';
            const filePath = getDrawingFilePath(this.app, parent, type, { allowCompatibilitySuffix });
            const content = getDrawingTemplate(type);

            const file = await this.app.vault.create(filePath, content);

            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);

            await this.trySwitchToDrawingView(leaf, file, type);

            return file;
        } catch (error) {
            const message = getErrorMessage(error);
            if (message.includes('already exists')) {
                showNotice(strings.fileSystem.errors.drawingAlreadyExists, { variant: 'warning' });
            } else {
                showNotice(strings.fileSystem.errors.failedToCreateDrawing, { variant: 'warning' });
            }
            return null;
        }
    }

    /**
     * Returns the view type identifier for the drawing plugin, or null if plugin is not installed
     */
    private getDrawingViewType(type: DrawingType): string | null {
        if (type === 'excalidraw' && isPluginInstalled(this.app, EXCALIDRAW_PLUGIN_ID)) {
            return 'excalidraw';
        }

        if (type === 'tldraw' && isPluginInstalled(this.app, TLDRAW_PLUGIN_ID)) {
            return 'tldraw-view';
        }

        return null;
    }

    /**
     * Attempts to switch the leaf view state to the drawing plugin's view
     */
    private async trySwitchToDrawingView(leaf: WorkspaceLeaf, file: TFile, type: DrawingType): Promise<void> {
        const viewType = this.getDrawingViewType(type);
        if (!viewType) {
            return;
        }

        const viewState: ViewState = {
            type: viewType,
            state: { file: file.path }
        };

        try {
            await leaf.setViewState(viewState);
        } catch (error: unknown) {
            console.error('Failed to switch drawing view', { viewType, error });
        }
    }
}
