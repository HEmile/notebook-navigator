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

import type { TFile } from 'obsidian';
import type { NavigationItemType } from '../types';
import type { FeatureImageStatus, FileData } from '../storage/IndexedDBStorage';
import { type FeatureImageSizeSetting, type NotePropertyType } from '../settings/types';
import { isImageFile } from './fileTypeUtils';
import { isPropertyKeyOnlyValuePath, normalizePropertyTreeValuePath } from './propertyTree';
import { casefold } from './recordUtils';

/**
 * Layout measurements used by the list pane virtualizer.
 * These values mirror the CSS variables defined in styles.css.
 */
export interface ListPaneMeasurements {
    basePadding: number;
    titleLineHeight: number;
    singleTextLineHeight: number;
    multilineTextLineHeight: number;
    tagRowHeight: number;
    featureImageHeight: number;
    firstHeader: number;
    subsequentHeader: number;
    fileIconSize: number;
    topSpacer: number;
    bottomSpacer: number;
}

export interface FeatureImageDisplayMeasurements {
    listMaxSize: number;
}

const FEATURE_IMAGE_DISPLAY_MEASUREMENTS: Readonly<Record<FeatureImageSizeSetting, FeatureImageDisplayMeasurements>> = Object.freeze({
    '64': { listMaxSize: 64 },
    '96': { listMaxSize: 96 },
    '128': { listMaxSize: 128 }
});

const DESKTOP_MEASUREMENTS: ListPaneMeasurements = Object.freeze({
    basePadding: 16, // 8px padding on each side
    titleLineHeight: 20,
    singleTextLineHeight: 19,
    multilineTextLineHeight: 18,
    tagRowHeight: 26, // 22px row + 4px gap
    featureImageHeight: 42,
    firstHeader: 35,
    subsequentHeader: 50,
    fileIconSize: 16,
    topSpacer: 8,
    bottomSpacer: 20
});

const MOBILE_MEASUREMENTS: ListPaneMeasurements = Object.freeze({
    basePadding: 24, // 12px padding on each side
    titleLineHeight: 21,
    singleTextLineHeight: 20,
    multilineTextLineHeight: 19,
    tagRowHeight: 26, // 22px row + 4px gap
    featureImageHeight: 42,
    firstHeader: 43, // 35px + 8px mobile increment
    subsequentHeader: 58, // 50px + 8px mobile increment
    fileIconSize: 20, // 16px + 4px mobile increment
    topSpacer: 8,
    bottomSpacer: 20
});

/**
 * Returns the static measurement set for the current platform.
 */
export function getFeatureImageDisplayMeasurements(featureImageSize: FeatureImageSizeSetting): FeatureImageDisplayMeasurements {
    return FEATURE_IMAGE_DISPLAY_MEASUREMENTS[featureImageSize];
}

export function getListPaneMeasurements(isMobile: boolean): ListPaneMeasurements {
    return isMobile ? MOBILE_MEASUREMENTS : DESKTOP_MEASUREMENTS;
}

export function isListPaneCompactMode({
    showDate,
    showPreview,
    showImage
}: {
    showDate: boolean;
    showPreview: boolean;
    showImage: boolean;
}): boolean {
    return !showDate && !showPreview && !showImage;
}

export interface FileItemLayoutState {
    isCompactMode: boolean;
    pinnedItemShouldUseCompactLayout: boolean;
    shouldUseSingleLineForDateAndPreview: boolean;
    shouldUseMultiLinePreviewLayout: boolean;
    shouldCollapseEmptyPreviewSpace: boolean;
    shouldAlwaysReservePreviewSpace: boolean;
    shouldSuppressEmptyPreviewLines: boolean;
    shouldShowDateForItem: boolean;
    shouldShowSingleLineSecondLine: boolean;
    multilinePreviewRowCount: number;
}

export function getFileItemLayoutState({
    showDate,
    showPreview,
    showImage,
    previewRows,
    optimizeNoteHeight,
    isPinned,
    hasPreviewContent,
    showFeatureImageArea,
    hasVisiblePillRows
}: {
    showDate: boolean;
    showPreview: boolean;
    showImage: boolean;
    previewRows: number;
    optimizeNoteHeight: boolean;
    isPinned: boolean;
    hasPreviewContent: boolean;
    showFeatureImageArea: boolean;
    hasVisiblePillRows: boolean;
}): FileItemLayoutState {
    const isCompactMode = isListPaneCompactMode({ showDate, showPreview, showImage });
    const pinnedItemShouldUseCompactLayout = isPinned && optimizeNoteHeight;
    const shouldUseSingleLineForDateAndPreview = pinnedItemShouldUseCompactLayout || previewRows < 2;
    const shouldUseMultiLinePreviewLayout = !pinnedItemShouldUseCompactLayout && previewRows >= 2;
    const shouldCollapseEmptyPreviewSpace = optimizeNoteHeight && !hasPreviewContent && !showFeatureImageArea;
    const shouldAlwaysReservePreviewSpace = !optimizeNoteHeight || hasPreviewContent || showFeatureImageArea;
    const shouldSuppressEmptyPreviewLines = !hasPreviewContent && hasVisiblePillRows;
    const shouldShowDateForItem = showDate && !pinnedItemShouldUseCompactLayout;
    const shouldShowSingleLineSecondLine = shouldShowDateForItem || (showPreview && !shouldSuppressEmptyPreviewLines);
    const multilinePreviewRowCount = showPreview && shouldAlwaysReservePreviewSpace && !shouldSuppressEmptyPreviewLines ? previewRows : 0;

    return {
        isCompactMode,
        pinnedItemShouldUseCompactLayout,
        shouldUseSingleLineForDateAndPreview,
        shouldUseMultiLinePreviewLayout,
        shouldCollapseEmptyPreviewSpace,
        shouldAlwaysReservePreviewSpace,
        shouldSuppressEmptyPreviewLines,
        shouldShowDateForItem,
        shouldShowSingleLineSecondLine,
        multilinePreviewRowCount
    };
}

export function shouldShowFileItemParentFolderLine({
    showParentFolder,
    pinnedItemShouldUseCompactLayout,
    selectionType,
    includeDescendantNotes,
    parentFolder,
    fileParentPath
}: {
    showParentFolder: boolean;
    pinnedItemShouldUseCompactLayout: boolean;
    selectionType: NavigationItemType | null | undefined;
    includeDescendantNotes: boolean;
    parentFolder: string | null | undefined;
    fileParentPath: string | null | undefined;
}): boolean {
    if (!showParentFolder || pinnedItemShouldUseCompactLayout || !fileParentPath || fileParentPath === '/') {
        return false;
    }

    if (selectionType === 'tag') {
        return true;
    }

    return includeDescendantNotes && Boolean(parentFolder) && fileParentPath !== parentFolder;
}

/**
 * Shared feature image visibility logic for list pane rendering and sizing.
 */
export function shouldShowFeatureImageArea({
    showImage,
    file,
    featureImageStatus,
    hasFeatureImageUrl
}: {
    showImage: boolean;
    file: TFile | null;
    featureImageStatus?: FeatureImageStatus | null;
    hasFeatureImageUrl?: boolean;
}): boolean {
    if (!showImage || !file) {
        return false;
    }

    if (hasFeatureImageUrl) {
        return true;
    }

    if (file.extension === 'canvas' || file.extension === 'base') {
        return true;
    }

    if (isImageFile(file)) {
        return true;
    }

    return featureImageStatus === 'has';
}

type PropertyEntries = Exclude<FileData['properties'], null>;

type PropertyRowSummary = {
    hasAnyVisibleValue: boolean;
    normalizedKeysWithVisibleValues: ReadonlySet<string>;
    uniqueDisplayFieldKeys: readonly { displayKey: string; normalizedKey: string }[];
};

const EMPTY_PROPERTY_ROW_SUMMARY: PropertyRowSummary = {
    hasAnyVisibleValue: false,
    normalizedKeysWithVisibleValues: new Set<string>(),
    uniqueDisplayFieldKeys: []
};

const propertyRowSummaryCache = new WeakMap<PropertyEntries, PropertyRowSummary>();

function getPropertyRowSummary(properties: FileData['properties'] | undefined): PropertyRowSummary {
    if (!properties || properties.length === 0) {
        return EMPTY_PROPERTY_ROW_SUMMARY;
    }

    const cached = propertyRowSummaryCache.get(properties);
    if (cached) {
        return cached;
    }

    let hasAnyVisibleValue = false;
    const normalizedKeysWithVisibleValues = new Set<string>();
    const uniqueDisplayFieldKeys = new Map<string, string>();

    properties.forEach(entry => {
        if (entry.value.trim().length === 0) {
            return;
        }

        // Mirrors FileItem visibility rules so row estimates match rendered property pills.
        if (entry.valueKind !== 'string') {
            if (entry.valueKind !== undefined) {
                return;
            }

            const normalizedValuePath = normalizePropertyTreeValuePath(entry.value);
            if (isPropertyKeyOnlyValuePath(normalizedValuePath, entry.valueKind)) {
                return;
            }
        }

        hasAnyVisibleValue = true;
        const normalizedFieldKey = casefold(entry.fieldKey);
        if (normalizedFieldKey.length > 0) {
            normalizedKeysWithVisibleValues.add(normalizedFieldKey);
        }

        const trimmedFieldKey = entry.fieldKey.trim();
        if (trimmedFieldKey.length === 0 || uniqueDisplayFieldKeys.has(trimmedFieldKey)) {
            return;
        }
        uniqueDisplayFieldKeys.set(trimmedFieldKey, normalizedFieldKey);
    });

    const summary: PropertyRowSummary = {
        hasAnyVisibleValue,
        normalizedKeysWithVisibleValues,
        uniqueDisplayFieldKeys: Array.from(uniqueDisplayFieldKeys.entries()).map(([displayKey, normalizedKey]) => ({
            displayKey,
            normalizedKey
        }))
    };

    propertyRowSummaryCache.set(properties, summary);
    return summary;
}

function hasVisiblePropertyKeyMatch(normalizedPropertyKeys: ReadonlySet<string>, visiblePropertyKeys: ReadonlySet<string>): boolean {
    if (normalizedPropertyKeys.size === 0 || visiblePropertyKeys.size === 0) {
        return false;
    }

    const iterateKeys = normalizedPropertyKeys.size <= visiblePropertyKeys.size ? normalizedPropertyKeys : visiblePropertyKeys;
    const lookupKeys = iterateKeys === normalizedPropertyKeys ? visiblePropertyKeys : normalizedPropertyKeys;
    for (const key of iterateKeys) {
        if (lookupKeys.has(key)) {
            return true;
        }
    }

    return false;
}

function shouldShowPropertyRow({
    notePropertyType,
    showFileProperties,
    showFilePropertiesInCompactMode,
    isCompactMode,
    file,
    wordCount,
    properties,
    visiblePropertyKeys
}: {
    notePropertyType: NotePropertyType;
    showFileProperties: boolean;
    showFilePropertiesInCompactMode: boolean;
    isCompactMode: boolean;
    file: TFile | null;
    wordCount: FileData['wordCount'] | undefined;
    properties: FileData['properties'] | undefined;
    visiblePropertyKeys?: ReadonlySet<string>;
}): boolean {
    if (!file || file.extension !== 'md') {
        return false;
    }

    if (isCompactMode && !showFilePropertiesInCompactMode) {
        return false;
    }

    const hasWordCount = notePropertyType === 'wordCount' && typeof wordCount === 'number' && Number.isFinite(wordCount) && wordCount > 0;
    const propertySummary = getPropertyRowSummary(properties);
    const hasPropertyValues = (() => {
        if (!showFileProperties) {
            return false;
        }
        if (visiblePropertyKeys === undefined) {
            return propertySummary.hasAnyVisibleValue;
        }
        return hasVisiblePropertyKeyMatch(propertySummary.normalizedKeysWithVisibleValues, visiblePropertyKeys);
    })();

    return hasWordCount || hasPropertyValues;
}

export function getPropertyRowCount({
    notePropertyType,
    showFileProperties,
    showPropertiesOnSeparateRows,
    showFilePropertiesInCompactMode,
    isCompactMode,
    file,
    wordCount,
    properties,
    visiblePropertyKeys
}: {
    notePropertyType: NotePropertyType;
    showFileProperties: boolean;
    showPropertiesOnSeparateRows: boolean;
    showFilePropertiesInCompactMode: boolean;
    isCompactMode: boolean;
    file: TFile | null;
    wordCount: FileData['wordCount'] | undefined;
    properties: FileData['properties'] | undefined;
    visiblePropertyKeys?: ReadonlySet<string>;
}): number {
    // Computes the number of visual rows the property area will occupy.
    // This is used by the list pane virtualizer height estimator and must stay consistent with FileItem rendering.
    const shouldShow = shouldShowPropertyRow({
        notePropertyType,
        showFileProperties,
        showFilePropertiesInCompactMode,
        isCompactMode,
        file,
        wordCount,
        properties,
        visiblePropertyKeys
    });

    if (!shouldShow) {
        // No property row will be rendered.
        return 0;
    }

    const wordCountEnabled =
        notePropertyType === 'wordCount' && typeof wordCount === 'number' && Number.isFinite(wordCount) && wordCount > 0;
    const wordCountRowCount = wordCountEnabled ? 1 : 0;

    let frontmatterPropertyRowCount = 0;
    if (showFileProperties) {
        const propertySummary = getPropertyRowSummary(properties);
        const hasVisiblePropertyValues =
            visiblePropertyKeys === undefined
                ? propertySummary.hasAnyVisibleValue
                : hasVisiblePropertyKeyMatch(propertySummary.normalizedKeysWithVisibleValues, visiblePropertyKeys);

        if (!showPropertiesOnSeparateRows) {
            frontmatterPropertyRowCount = hasVisiblePropertyValues ? 1 : 0;
        } else if (hasVisiblePropertyValues) {
            if (visiblePropertyKeys === undefined) {
                frontmatterPropertyRowCount = propertySummary.uniqueDisplayFieldKeys.length;
            } else {
                frontmatterPropertyRowCount = propertySummary.uniqueDisplayFieldKeys.reduce((count, entry) => {
                    if (!entry.normalizedKey || !visiblePropertyKeys.has(entry.normalizedKey)) {
                        return count;
                    }

                    return count + 1;
                }, 0);
            }
        }
    }

    if (frontmatterPropertyRowCount === 0) {
        return wordCountRowCount;
    }

    if (!showPropertiesOnSeparateRows) {
        // Frontmatter properties share one row in non-separate mode; word count remains its own row.
        return 1 + wordCountRowCount;
    }

    return frontmatterPropertyRowCount + wordCountRowCount;
}
