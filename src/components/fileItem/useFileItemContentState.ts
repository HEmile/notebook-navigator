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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { App, TFile } from 'obsidian';
import { IndexedDBStorage, type FeatureImageStatus, type FileContentChange, type PropertyItem } from '../../storage/IndexedDBStorage';
import { getCachedFileTags } from '../../utils/tagUtils';
import { isImageFile } from '../../utils/fileTypeUtils';
import { arePropertyItemsEqual, clonePropertyItems } from '../../utils/propertyUtils';
import { areStringArraysEqual } from '../../utils/arrayUtils';

const FEATURE_IMAGE_REGEN_THROTTLE_MS = 10000;

export type FileItemContentDb = Pick<
    IndexedDBStorage,
    'getCachedPreviewText' | 'getFile' | 'onFileContentChange' | 'ensurePreviewTextLoaded' | 'getFeatureImageBlob'
>;

export interface FileItemCacheSnapshot {
    previewText: string;
    tags: string[];
    featureImageKey: string | null;
    featureImageStatus: FeatureImageStatus;
    featureImageUrl: string | null;
    properties: PropertyItem[] | null;
    wordCount: number | null;
    taskUnfinished: number | null;
}

export interface UseFileItemContentStateParams {
    app: App;
    file: TFile;
    showPreview: boolean;
    showImage: boolean;
    getDB: () => FileItemContentDb;
    regenerateFeatureImageForFile: (file: TFile) => Promise<void>;
}

export interface FileItemContentState {
    previewText: string;
    tags: string[];
    featureImageStatus: FeatureImageStatus;
    featureImageUrl: string | null;
    properties: PropertyItem[] | null;
    wordCount: number | null;
    taskUnfinished: number | null;
    metadataVersion: number;
}

export function loadFileItemCacheSnapshot({
    app,
    file,
    showPreview,
    showImage,
    db
}: {
    app: App;
    file: TFile;
    showPreview: boolean;
    showImage: boolean;
    db: FileItemContentDb;
}): FileItemCacheSnapshot {
    const preview = showPreview && file.extension === 'md' ? db.getCachedPreviewText(file.path) : '';
    const record = db.getFile(file.path);
    const tags = [...getCachedFileTags({ app, file, db, fileData: record })];
    const featureImageKey = record?.featureImageKey ?? null;
    const featureImageStatus: FeatureImageStatus = record?.featureImageStatus ?? 'unprocessed';
    const properties = clonePropertyItems(record?.properties ?? null);
    const wordCount = record?.wordCount ?? null;
    const taskUnfinished = record?.taskUnfinished ?? null;

    let featureImageUrl: string | null = null;
    if (showImage && isImageFile(file)) {
        try {
            featureImageUrl = app.vault.getResourcePath(file);
        } catch {
            featureImageUrl = null;
        }
    }

    return {
        previewText: preview,
        tags,
        featureImageKey,
        featureImageStatus,
        featureImageUrl,
        properties,
        wordCount,
        taskUnfinished
    };
}

export function useFileItemContentState({
    app,
    file,
    showPreview,
    showImage,
    getDB,
    regenerateFeatureImageForFile
}: UseFileItemContentStateParams): FileItemContentState {
    const loadSnapshot = useCallback(() => {
        return loadFileItemCacheSnapshot({
            app,
            file,
            showPreview,
            showImage,
            db: getDB()
        });
    }, [app, file, getDB, showImage, showPreview]);

    const initialDataRef = useRef<FileItemCacheSnapshot | null>(null);
    const initialData = initialDataRef.current ?? loadSnapshot();
    initialDataRef.current = initialData;

    const [previewText, setPreviewText] = useState<string>(initialData.previewText);
    const [tags, setTags] = useState<string[]>(initialData.tags);
    const [featureImageKey, setFeatureImageKey] = useState<string | null>(initialData.featureImageKey);
    const [featureImageStatus, setFeatureImageStatus] = useState<FeatureImageStatus>(initialData.featureImageStatus);
    const [featureImageUrl, setFeatureImageUrl] = useState<string | null>(initialData.featureImageUrl);
    const [properties, setProperties] = useState<PropertyItem[] | null>(initialData.properties);
    const [wordCount, setWordCount] = useState<number | null>(initialData.wordCount);
    const [taskUnfinished, setTaskUnfinished] = useState<number | null>(initialData.taskUnfinished);
    const [metadataVersion, setMetadataVersion] = useState(0);

    const featureImageObjectUrlRef = useRef<string | null>(null);
    const lastFeatureImageRegenRef = useRef<{ key: string; at: number } | null>(null);

    useEffect(() => {
        const initialSnapshot = loadSnapshot();

        setPreviewText(prev => (prev === initialSnapshot.previewText ? prev : initialSnapshot.previewText));
        setTags(prev => (areStringArraysEqual(prev, initialSnapshot.tags) ? prev : initialSnapshot.tags));
        setFeatureImageKey(prev => (prev === initialSnapshot.featureImageKey ? prev : initialSnapshot.featureImageKey));
        setFeatureImageStatus(prev => (prev === initialSnapshot.featureImageStatus ? prev : initialSnapshot.featureImageStatus));
        setProperties(prev => (arePropertyItemsEqual(prev, initialSnapshot.properties) ? prev : initialSnapshot.properties));
        setWordCount(prev => (prev === initialSnapshot.wordCount ? prev : initialSnapshot.wordCount));
        setTaskUnfinished(prev => (prev === initialSnapshot.taskUnfinished ? prev : initialSnapshot.taskUnfinished));

        const db = getDB();
        const unsubscribe = db.onFileContentChange(file.path, (changes: FileContentChange['changes']) => {
            let shouldRefreshFrontmatterState = false;

            if (changes.preview !== undefined && showPreview && file.extension === 'md') {
                const nextPreview = changes.preview || '';
                setPreviewText(prev => (prev === nextPreview ? prev : nextPreview));
            }

            if (changes.featureImageKey !== undefined) {
                setFeatureImageKey(prev => (prev === changes.featureImageKey ? prev : (changes.featureImageKey ?? null)));
            }

            if (changes.featureImageStatus !== undefined) {
                const nextStatus = changes.featureImageStatus;
                setFeatureImageStatus(prev => (prev === nextStatus ? prev : nextStatus));
            }

            if (changes.tags !== undefined) {
                const nextTags = [...(changes.tags ?? [])];
                setTags(prev => (areStringArraysEqual(prev, nextTags) ? prev : nextTags));
            }

            if (changes.wordCount !== undefined) {
                const nextWordCount = changes.wordCount ?? null;
                setWordCount(prev => (prev === nextWordCount ? prev : nextWordCount));
            }

            if (changes.taskUnfinished !== undefined) {
                const nextTaskUnfinished = changes.taskUnfinished ?? null;
                setTaskUnfinished(prev => (prev === nextTaskUnfinished ? prev : nextTaskUnfinished));
            }

            if (changes.properties !== undefined) {
                const nextProperties = clonePropertyItems(changes.properties ?? null);
                setProperties(prev => (arePropertyItemsEqual(prev, nextProperties) ? prev : nextProperties));
                shouldRefreshFrontmatterState = true;
            }

            if (changes.metadata !== undefined) {
                shouldRefreshFrontmatterState = true;
            }

            if (shouldRefreshFrontmatterState) {
                setMetadataVersion(version => version + 1);
            }
        });

        if (showPreview && file.extension === 'md') {
            void db.ensurePreviewTextLoaded(file.path);
        }

        return () => {
            unsubscribe();
        };
    }, [file, file.path, getDB, loadSnapshot, showPreview]);

    useEffect(() => {
        return () => {
            if (featureImageObjectUrlRef.current) {
                URL.revokeObjectURL(featureImageObjectUrlRef.current);
                featureImageObjectUrlRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        let isActive = true;

        if (featureImageObjectUrlRef.current) {
            URL.revokeObjectURL(featureImageObjectUrlRef.current);
            featureImageObjectUrlRef.current = null;
        }

        if (!showImage) {
            setFeatureImageUrl(null);
            return () => {
                isActive = false;
            };
        }

        if (isImageFile(file)) {
            try {
                setFeatureImageUrl(app.vault.getResourcePath(file));
            } catch {
                setFeatureImageUrl(null);
            }

            return () => {
                isActive = false;
            };
        }

        if (featureImageStatus !== 'has' || !featureImageKey) {
            setFeatureImageUrl(null);
            return () => {
                isActive = false;
            };
        }

        const db = getDB();
        const expectedKey = featureImageKey;
        void db.getFeatureImageBlob(file.path, expectedKey).then(blob => {
            if (!isActive) {
                return;
            }

            if (!blob) {
                setFeatureImageUrl(null);
                const now = Date.now();
                const last = lastFeatureImageRegenRef.current;
                const shouldTrigger = !last || last.key !== expectedKey || now - last.at >= FEATURE_IMAGE_REGEN_THROTTLE_MS;
                if (shouldTrigger) {
                    lastFeatureImageRegenRef.current = { key: expectedKey, at: now };
                    void regenerateFeatureImageForFile(file);
                }
                return;
            }

            const nextUrl = URL.createObjectURL(blob);
            featureImageObjectUrlRef.current = nextUrl;
            setFeatureImageUrl(nextUrl);
        });

        return () => {
            isActive = false;
        };
    }, [app, featureImageKey, featureImageStatus, file, getDB, regenerateFeatureImageForFile, showImage]);

    return {
        previewText,
        tags,
        featureImageStatus,
        featureImageUrl,
        properties,
        wordCount,
        taskUnfinished,
        metadataVersion
    };
}
