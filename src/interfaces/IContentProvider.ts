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

import { TFile } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';

/**
 * Types of content providers.
 *
 * These values identify providers in the ContentProviderRegistry include/exclude lists.
 */
export type ContentProviderType = 'fileThumbnails' | 'metadata' | 'tags' | 'markdownPipeline';

/**
 * Types of file content that can be generated and stored.
 *
 * These values identify content fields in storage (preview text, feature images, tags, etc).
 */
export type FileContentType = 'preview' | 'featureImage' | 'metadata' | 'tags' | 'wordCount' | 'tasks' | 'properties';

export type ContentProviderClearContext = {
    oldSettings: NotebookNavigatorSettings;
    newSettings: NotebookNavigatorSettings;
};

/**
 * Interface for content providers that generate specific types of content
 * Each provider is responsible for:
 * - Declaring which settings affect its content
 * - Determining when content needs regeneration
 * - Clearing and regenerating its content type
 */
export interface IContentProvider {
    /**
     * Gets the type of provider.
     */
    getContentType(): ContentProviderType;

    /**
     * Gets the list of settings that affect this content type
     * Used to monitor for changes that require regeneration
     */
    getRelevantSettings(): (keyof NotebookNavigatorSettings)[];

    /**
     * Determines if content needs to be regenerated based on settings changes
     * @param oldSettings - Previous settings
     * @param newSettings - New settings
     * @returns True if content should be cleared and regenerated
     */
    shouldRegenerate(oldSettings: NotebookNavigatorSettings, newSettings: NotebookNavigatorSettings): boolean;

    /**
     * Clears all content of this type from the database
     */
    clearContent(context?: ContentProviderClearContext): Promise<void>;

    /**
     * Queues files for content generation
     * @param files - Files that need content generation
     */
    queueFiles(files: TFile[]): void;

    /**
     * Starts processing queued files
     * @param settings - Current plugin settings
     */
    startProcessing(settings: NotebookNavigatorSettings): void;

    /**
     * Stops any ongoing processing
     */
    stopProcessing(): void;

    /**
     * Waits until any in-flight batch work finishes.
     */
    waitForIdle(): Promise<void>;

    /**
     * Notifies the provider that settings have changed
     * Used to update internal state if needed
     */
    onSettingsChanged(settings: NotebookNavigatorSettings): void;
}
