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

import { App, normalizePath } from 'obsidian';
import { BaseMetadataService } from './BaseMetadataService';
import type { ISettingsProvider } from '../../interfaces/ISettingsProvider';
import type { NotebookNavigatorSettings } from '../../settings';
import type { CleanupValidators } from '../MetadataService';
import type { ITagTreeProvider } from '../../interfaces/ITagTreeProvider';
import type { IPropertyTreeProvider } from '../../interfaces/IPropertyTreeProvider';
import {
    NavigationSeparatorTarget,
    buildFolderSeparatorKey,
    buildPropertySeparatorKey,
    buildSectionSeparatorKey,
    buildTagSeparatorKey,
    normalizeNavigationSeparatorKey,
    parseNavigationSeparatorKey
} from '../../utils/navigationSeparators';
import { createConfiguredPropertyNodeValidator, normalizePropertyNodeId } from '../../utils/propertyTree';
import { normalizeTagPath } from '../../utils/tagUtils';
import { TAGGED_TAG_ID, UNTAGGED_TAG_ID } from '../../types';
import { ensureRecord, isBooleanRecordValue } from '../../utils/recordUtils';
import { getDBInstanceOrNull } from '../../storage/fileOperations';
import { getActivePropertyFields } from '../../utils/vaultProfiles';

const FOLDER_PREFIX = 'folder:';
const TAG_PREFIX = 'tag:';
const VIRTUAL_TAG_PATHS = new Set([TAGGED_TAG_ID, UNTAGGED_TAG_ID]);

/**
 * Manages persisted separator entries for navigation sections, folders, tags, and properties.
 */
export class NavigationSeparatorService extends BaseMetadataService {
    constructor(
        app: App,
        settingsProvider: ISettingsProvider,
        private readonly getTagTreeProvider?: () => ITagTreeProvider | null,
        private readonly getPropertyTreeProvider?: () => IPropertyTreeProvider | null
    ) {
        super(app, settingsProvider);
    }

    private separatorsVersion = 0;
    private separatorListeners = new Set<(version: number) => void>();

    /** Returns a shallow copy of the current separator map */
    getSeparators(): Record<string, boolean> {
        return { ...(this.settingsProvider.settings.navigationSeparators || {}) };
    }

    /** Checks whether a separator exists for the provided target */
    hasSeparator(target: NavigationSeparatorTarget): boolean {
        const key = this.getKeyForTarget(target);
        if (!key) {
            return false;
        }
        return Boolean(this.settingsProvider.settings.navigationSeparators?.[key]);
    }

    /** Adds or replaces a separator entry */
    async setSeparator(target: NavigationSeparatorTarget): Promise<void> {
        const key = this.getKeyForTarget(target);
        if (!key) {
            return;
        }
        await this.saveAndUpdate(settings => {
            const store = this.ensureStore(settings);
            if (store[key]) {
                return false;
            }
            store[key] = true;
            this.markSeparatorsChanged();
            return true;
        });
    }

    /** Removes a separator entry if it exists */
    async removeSeparator(target: NavigationSeparatorTarget): Promise<void> {
        const key = this.getKeyForTarget(target);
        if (!key) {
            return;
        }
        await this.saveAndUpdate(settings => {
            const store = settings.navigationSeparators;
            if (!store || !store[key]) {
                return false;
            }
            delete store[key];
            this.markSeparatorsChanged();
            return true;
        });
    }

    /** Updates folder separator keys when a folder moves */
    async handleFolderRename(oldPath: string, newPath: string, preserveExisting = false): Promise<void> {
        await this.saveAndUpdate(settings => this.applyFolderRename(settings, oldPath, newPath, preserveExisting));
    }

    /** Removes folder separator entries when a folder is deleted */
    async handleFolderDelete(folderPath: string): Promise<void> {
        await this.saveAndUpdate(settings => this.applyFolderDelete(settings, folderPath));
    }

    /** Updates tag separator keys when a tag is renamed */
    async handleTagRename(oldPath: string, newPath: string, preserveExisting = false): Promise<void> {
        await this.saveAndUpdate(settings => this.applyTagRename(settings, oldPath, newPath, preserveExisting));
    }

    /** Removes tag separator entries when a tag is deleted */
    async handleTagDelete(tagPath: string): Promise<void> {
        await this.saveAndUpdate(settings => this.applyTagDelete(settings, tagPath));
    }

    /** Applies folder rename mutations without triggering a save */
    applyFolderRename(targetSettings: NotebookNavigatorSettings, oldPath: string, newPath: string, preserveExisting = false): boolean {
        const store = targetSettings.navigationSeparators;
        if (!store) {
            return false;
        }
        const changed = this.updatePrefixedPaths(store, FOLDER_PREFIX, oldPath, newPath, preserveExisting);
        if (changed) {
            this.markSeparatorsChangedIfLive(targetSettings);
        }
        return changed;
    }

    /** Applies folder delete mutations without triggering a save */
    applyFolderDelete(targetSettings: NotebookNavigatorSettings, folderPath: string): boolean {
        const store = targetSettings.navigationSeparators;
        if (!store) {
            return false;
        }
        const changed = this.deletePrefixedPaths(store, FOLDER_PREFIX, folderPath);
        if (changed) {
            this.markSeparatorsChangedIfLive(targetSettings);
        }
        return changed;
    }

    /** Applies tag rename mutations without triggering a save */
    applyTagRename(targetSettings: NotebookNavigatorSettings, oldPath: string, newPath: string, preserveExisting = false): boolean {
        const store = targetSettings.navigationSeparators;
        if (!store) {
            return false;
        }
        const normalizedOld = normalizeTagPath(oldPath);
        const normalizedNew = normalizeTagPath(newPath);
        if (!normalizedOld || !normalizedNew) {
            return false;
        }
        const changed = this.updatePrefixedPaths(store, TAG_PREFIX, normalizedOld, normalizedNew, preserveExisting);
        if (changed) {
            this.markSeparatorsChangedIfLive(targetSettings);
        }
        return changed;
    }

    /** Applies tag delete mutations without triggering a save */
    applyTagDelete(targetSettings: NotebookNavigatorSettings, tagPath: string): boolean {
        const store = targetSettings.navigationSeparators;
        if (!store) {
            return false;
        }
        const normalized = normalizeTagPath(tagPath);
        if (!normalized) {
            return false;
        }
        const changed = this.deletePrefixedPaths(store, TAG_PREFIX, normalized);
        if (changed) {
            this.markSeparatorsChangedIfLive(targetSettings);
        }
        return changed;
    }

    /** Removes separators that reference folders or tags that no longer exist */
    async cleanupSeparators(targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings): Promise<boolean> {
        const tagLookup = this.getKnownTagPaths();
        const propertyExists = this.createPropertyNodeValidator(targetSettings);
        const changed = await this.removeInvalidEntries(
            targetSettings,
            path => this.folderExists(path),
            path => this.tagExists(path, tagLookup),
            propertyExists ?? undefined
        );
        if (changed) {
            this.markSeparatorsChangedIfLive(targetSettings);
        }
        return changed;
    }

    /** Removes separators using preloaded validators for faster startup cleanup */
    async cleanupWithValidators(
        validators: CleanupValidators,
        targetSettings: NotebookNavigatorSettings = this.settingsProvider.settings
    ): Promise<boolean> {
        const folderExists = (path: string) => validators.vaultFolders.has(path);
        const tagExists = (path: string) => this.isVirtualTag(path) || validators.tagTree.has(path);
        const propertyExists = this.createPropertyNodeValidator(targetSettings, validators);
        const changed = await this.removeInvalidEntries(targetSettings, folderExists, tagExists, propertyExists ?? undefined);
        if (changed) {
            this.markSeparatorsChangedIfLive(targetSettings);
        }
        return changed;
    }

    private getKeyForTarget(target: NavigationSeparatorTarget): string | null {
        if (target.type === 'section') {
            return buildSectionSeparatorKey(target.id);
        }
        if (target.type === 'folder') {
            const normalizedFolderPath = this.normalizeFolderPath(target.path);
            return normalizedFolderPath ? buildFolderSeparatorKey(normalizedFolderPath) : null;
        }
        if (target.type === 'property') {
            const normalizedNodeId = normalizePropertyNodeId(target.nodeId);
            return normalizedNodeId ? buildPropertySeparatorKey(normalizedNodeId) : null;
        }
        const normalizedTagPath = normalizeTagPath(target.path);
        if (!normalizedTagPath) {
            return null;
        }
        return buildTagSeparatorKey(normalizedTagPath);
    }

    private normalizeFolderPath(input: string): string | null {
        const trimmed = input?.trim() ?? '';
        if (trimmed.length === 0 || trimmed === '/') {
            return '/';
        }

        try {
            const normalized = normalizePath(trimmed);
            return normalized.length === 0 ? '/' : normalized;
        } catch (error) {
            console.error('[Notebook Navigator] Invalid folder path for navigation separator:', input, error);
            return null;
        }
    }

    private ensureStore(settings: NotebookNavigatorSettings): Record<string, boolean> {
        const store = ensureRecord(settings.navigationSeparators, isBooleanRecordValue);
        settings.navigationSeparators = store;
        return store;
    }

    private updatePrefixedPaths(
        store: Record<string, boolean>,
        prefix: string,
        oldPath: string,
        newPath: string,
        preserveExisting: boolean
    ): boolean {
        const oldKey = `${prefix}${oldPath}`;
        const nestedPrefix = `${prefix}${oldPath}/`;
        const updates: { from: string; to: string }[] = [];

        if (Object.prototype.hasOwnProperty.call(store, oldKey)) {
            updates.push({ from: oldKey, to: `${prefix}${newPath}` });
        }

        Object.keys(store).forEach(key => {
            if (key.startsWith(nestedPrefix)) {
                const suffix = key.slice(nestedPrefix.length);
                updates.push({ from: key, to: `${prefix}${newPath}/${suffix}` });
            }
        });

        if (updates.length === 0) {
            return false;
        }

        let changed = false;

        updates.forEach(({ from, to }) => {
            if (from === to) {
                return;
            }
            const newKeyExists = Object.prototype.hasOwnProperty.call(store, to) === true;
            if (newKeyExists && preserveExisting) {
                delete store[from];
                changed = true;
                return;
            }
            store[to] = true;
            delete store[from];
            changed = true;
        });

        return changed;
    }

    private deletePrefixedPaths(store: Record<string, boolean>, prefix: string, path: string): boolean {
        const directKey = `${prefix}${path}`;
        const nestedPrefix = `${directKey}/`;
        let changed = false;

        if (Object.prototype.hasOwnProperty.call(store, directKey)) {
            delete store[directKey];
            changed = true;
        }

        Object.keys(store).forEach(key => {
            if (key.startsWith(nestedPrefix)) {
                delete store[key];
                changed = true;
            }
        });

        return changed;
    }

    private folderExists(path: string): boolean {
        return this.app.vault.getFolderByPath(path) !== null;
    }

    private tagExists(path: string, lookup: Set<string> | null): boolean {
        if (this.isVirtualTag(path)) {
            return true;
        }
        if (!lookup) {
            return true;
        }
        return lookup.has(path);
    }

    private isVirtualTag(path: string): boolean {
        return VIRTUAL_TAG_PATHS.has(path);
    }

    private getKnownTagPaths(): Set<string> | null {
        const provider = this.getTagTreeProvider?.();
        if (!provider) {
            return null;
        }
        return new Set(provider.getAllTagPaths());
    }

    private createPropertyNodeValidator(
        targetSettings: NotebookNavigatorSettings,
        validators?: CleanupValidators
    ): ((nodeId: string) => boolean) | null {
        if (validators) {
            return createConfiguredPropertyNodeValidator({
                propertyFields: getActivePropertyFields(targetSettings),
                dbFiles: validators.dbFiles
            });
        }

        const providerValidator = createConfiguredPropertyNodeValidator({
            propertyFields: getActivePropertyFields(targetSettings),
            propertyTreeProvider: this.getPropertyTreeProvider?.() ?? null
        });
        if (providerValidator) {
            return providerValidator;
        }

        const db = getDBInstanceOrNull();
        if (!db) {
            return null;
        }

        const dbFiles = db.getAllFiles();
        if (dbFiles.length === 0) {
            return null;
        }

        return createConfiguredPropertyNodeValidator({
            propertyFields: getActivePropertyFields(targetSettings),
            dbFiles
        });
    }

    private async removeInvalidEntries(
        targetSettings: NotebookNavigatorSettings,
        folderExists: (path: string) => boolean,
        tagExists: (path: string) => boolean,
        propertyExists?: (nodeId: string) => boolean
    ): Promise<boolean> {
        const store = targetSettings.navigationSeparators;
        if (!store) {
            return false;
        }
        let changed = false;

        Object.keys(store).forEach(key => {
            const normalizedKey = normalizeNavigationSeparatorKey(key);
            if (!normalizedKey) {
                delete store[key];
                changed = true;
                return;
            }

            const descriptor = parseNavigationSeparatorKey(normalizedKey);
            if (!descriptor) {
                delete store[key];
                changed = true;
                return;
            }
            if (descriptor.type === 'folder' && !folderExists(descriptor.path)) {
                delete store[key];
                if (normalizedKey !== key && Object.prototype.hasOwnProperty.call(store, normalizedKey)) {
                    delete store[normalizedKey];
                }
                changed = true;
                return;
            }
            if (descriptor.type === 'tag' && !tagExists(descriptor.path)) {
                delete store[key];
                if (normalizedKey !== key && Object.prototype.hasOwnProperty.call(store, normalizedKey)) {
                    delete store[normalizedKey];
                }
                changed = true;
                return;
            }
            if (descriptor.type === 'property') {
                const normalizedNodeId = normalizePropertyNodeId(descriptor.nodeId);
                if (!normalizedNodeId) {
                    delete store[key];
                    if (normalizedKey !== key && Object.prototype.hasOwnProperty.call(store, normalizedKey)) {
                        delete store[normalizedKey];
                    }
                    changed = true;
                    return;
                }

                const normalizedPropertyKey = buildPropertySeparatorKey(normalizedNodeId);
                if (propertyExists && !propertyExists(normalizedNodeId)) {
                    if (Object.prototype.hasOwnProperty.call(store, key)) {
                        delete store[key];
                        changed = true;
                    }
                    if (normalizedPropertyKey !== key && Object.prototype.hasOwnProperty.call(store, normalizedPropertyKey)) {
                        delete store[normalizedPropertyKey];
                        changed = true;
                    }
                    return;
                }

                if (normalizedPropertyKey !== key) {
                    if (!Object.prototype.hasOwnProperty.call(store, normalizedPropertyKey)) {
                        store[normalizedPropertyKey] = store[key];
                    }
                    delete store[key];
                    changed = true;
                }
                return;
            }

            if (normalizedKey !== key) {
                if (!Object.prototype.hasOwnProperty.call(store, normalizedKey)) {
                    store[normalizedKey] = store[key];
                }
                delete store[key];
                changed = true;
            }
        });

        return changed;
    }

    private markSeparatorsChanged(): void {
        this.separatorsVersion += 1;
        this.separatorListeners.forEach(listener => listener(this.separatorsVersion));
    }

    private markSeparatorsChangedIfLive(targetSettings: NotebookNavigatorSettings): void {
        if (targetSettings !== this.settingsProvider.settings) {
            return;
        }
        this.markSeparatorsChanged();
    }

    getVersion(): number {
        return this.separatorsVersion;
    }

    subscribe(listener: (version: number) => void): () => void {
        this.separatorListeners.add(listener);
        return () => this.separatorListeners.delete(listener);
    }
}
