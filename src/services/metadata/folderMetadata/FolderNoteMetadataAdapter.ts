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

import { App, TFile } from 'obsidian';
import type { ISettingsProvider } from '../../../interfaces/ISettingsProvider';
import { getDBInstanceOrNull } from '../../../storage/fileOperations';
import type { FileContentChange } from '../../../storage/IndexedDBStorage';
import { normalizeCanonicalIconId, serializeIconForFrontmatter } from '../../../utils/iconizeFormat';
import { getParentFolderPath } from '../../../utils/pathUtils';
import { findMatchingRecordKey } from '../../../utils/recordUtils';
import { getFolderNote, getFolderNoteDetectionSettings } from '../../../utils/folderNotes';
import { resolveFolderNoteName } from '../../../utils/folderNoteName';
import type { FolderFrontmatterFields, FolderNoteMetadata, FolderStyleUpdate, FolderStyleValues, FolderStyleWriteResult } from './types';

const FOLDER_NOTE_CANDIDATE_EXTENSIONS = new Set<string>(['md', 'canvas', 'base']);
const EXCALIDRAW_BASENAME_SUFFIX = '.excalidraw';

export class FolderNoteMetadataAdapter {
    constructor(
        private readonly app: App,
        private readonly settingsProvider: ISettingsProvider
    ) {}

    getFolderFrontmatterFields(): FolderFrontmatterFields {
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

    getFolderNoteFile(folderPath: string): TFile | null {
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

    getCurrentFolderNotePath(folderPath: string): string | null {
        const folderNote = this.getFolderNoteFile(folderPath);
        return folderNote ? folderNote.path : null;
    }

    getFolderNoteMetadata(folderPath: string): FolderNoteMetadata | null {
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

    async writeFolderStyleToFrontmatter(
        folderPath: string,
        updates: FolderStyleUpdate,
        directStyle: FolderStyleValues
    ): Promise<FolderStyleWriteResult> {
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

        return {
            icon: shouldSyncIconField,
            color: shouldSyncColorField,
            backgroundColor: shouldSyncBackgroundField
        };
    }

    hasFolderDisplayNameMetadataChanges(changes: FileContentChange[], hasTrackedFolderNotePath: (path: string) => boolean): boolean {
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

            if (hasTrackedFolderNotePath(change.path)) {
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

    isFolderNotePathForFolder(path: string, folderPath: string): boolean {
        const folder = this.app.vault.getFolderByPath(folderPath);
        if (!folder) {
            return false;
        }

        const expectedName = resolveFolderNoteName(folder.name, getFolderNoteDetectionSettings(this.settingsProvider.settings));
        return this.isFolderNotePathForExpectedName(path, expectedName);
    }

    private updateFrontmatterField(frontmatter: Record<string, unknown>, field: string, value: string | null): void {
        const targetField = findMatchingRecordKey(frontmatter, field) ?? field;
        if (value !== null) {
            if (frontmatter[targetField] !== value) {
                frontmatter[targetField] = value;
            }
            return;
        }

        if (Reflect.has(frontmatter, targetField)) {
            delete frontmatter[targetField];
        }
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
        return FOLDER_NOTE_CANDIDATE_EXTENSIONS.has(this.getPathExtension(path));
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

        return extension === 'md' && basename === `${expectedName}${EXCALIDRAW_BASENAME_SUFFIX}`;
    }
}
