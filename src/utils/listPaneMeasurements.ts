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
import { ItemType, type NavigationItemType } from '../types';
import type { FeatureImageStatus, FileData } from '../storage/IndexedDBStorage';
import { type FeatureImageSizeSetting, type NotePropertyType } from '../settings/types';
import { isImageFile } from './fileTypeUtils';
import {
    buildPropertyKeyNodeId,
    buildPropertyValueNodeId,
    isPropertyKeyOnlyValuePath,
    normalizePropertyNodeId,
    normalizePropertyTreeValuePath,
    parsePropertyNodeId
} from './propertyTree';
import { casefold } from './recordUtils';
import type { HiddenTagVisibility } from './tagPrefixMatcher';
import { normalizeTagPath } from './tagUtils';

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

export function getSelectedTagPillToHide({
    selectionType,
    selectedTag,
    showSelectedNavigationPills
}: {
    selectionType: NavigationItemType | null | undefined;
    selectedTag: string | null | undefined;
    showSelectedNavigationPills: boolean;
}): string | null {
    if (showSelectedNavigationPills || selectionType !== ItemType.TAG) {
        return null;
    }

    return normalizeTagPath(selectedTag);
}

export function getSelectedPropertyValuePillToHide({
    selectionType,
    selectedProperty,
    showSelectedNavigationPills
}: {
    selectionType: NavigationItemType | null | undefined;
    selectedProperty: string | null | undefined;
    showSelectedNavigationPills: boolean;
}): string | null {
    if (showSelectedNavigationPills || selectionType !== ItemType.PROPERTY || !selectedProperty) {
        return null;
    }

    const parsedNode = parsePropertyNodeId(selectedProperty);
    if (!parsedNode?.valuePath) {
        return null;
    }

    return normalizePropertyNodeId(selectedProperty) ?? selectedProperty;
}

export function hasVisibleTagPills({
    tags,
    hiddenTagVisibility,
    selectedTagToHide
}: {
    tags: readonly string[];
    hiddenTagVisibility?: HiddenTagVisibility | null;
    selectedTagToHide?: string | null;
}): boolean {
    for (const tag of tags) {
        if (hiddenTagVisibility?.shouldFilterHiddenTags && !hiddenTagVisibility.isTagVisible(tag)) {
            continue;
        }

        if (selectedTagToHide && normalizeTagPath(tag) === selectedTagToHide) {
            continue;
        }

        return true;
    }

    return false;
}

type FrontmatterPropertyEntry = NonNullable<FileData['properties']>[number];
type FrontmatterPropertyEntries = Exclude<FileData['properties'], null>;

export interface VisibleFrontmatterPropertyEntry {
    entry: FrontmatterPropertyEntry;
    trimmedFieldKey: string;
    rawValue: string;
    normalizedValuePath: string;
    isKeyOnlyValue: boolean;
    propertyNodeId?: string;
}

export function forEachVisibleFrontmatterProperty({
    properties,
    visiblePropertyKeys,
    hiddenPropertyValueNodeId,
    visitor
}: {
    properties: FileData['properties'] | undefined;
    visiblePropertyKeys?: ReadonlySet<string>;
    hiddenPropertyValueNodeId?: string | null;
    visitor: (property: VisibleFrontmatterPropertyEntry) => void;
}): void {
    if (!properties || properties.length === 0) {
        return;
    }

    properties.forEach(entry => {
        const normalizedFieldKey = casefold(entry.fieldKey);
        if (visiblePropertyKeys && !visiblePropertyKeys.has(normalizedFieldKey)) {
            return;
        }

        const rawValue = entry.value;
        if (rawValue.trim().length === 0) {
            return;
        }

        const normalizedValuePath = normalizePropertyTreeValuePath(rawValue);
        const isKeyOnlyValue = entry.valueKind === 'boolean' ? false : isPropertyKeyOnlyValuePath(normalizedValuePath, entry.valueKind);
        if (entry.valueKind === undefined && isKeyOnlyValue) {
            return;
        }

        const trimmedFieldKey = entry.fieldKey.trim();
        const rawPropertyNodeId =
            trimmedFieldKey.length === 0
                ? undefined
                : isKeyOnlyValue
                  ? buildPropertyKeyNodeId(trimmedFieldKey)
                  : buildPropertyValueNodeId(trimmedFieldKey, normalizedValuePath);
        const propertyNodeId = rawPropertyNodeId ? (normalizePropertyNodeId(rawPropertyNodeId) ?? rawPropertyNodeId) : undefined;

        if (hiddenPropertyValueNodeId && propertyNodeId === hiddenPropertyValueNodeId) {
            return;
        }

        visitor({
            entry,
            trimmedFieldKey,
            rawValue,
            normalizedValuePath,
            isKeyOnlyValue,
            propertyNodeId
        });
    });
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

export function estimateRenderedTextRows({
    text,
    maxRows,
    charsPerRow
}: {
    text: string | null | undefined;
    maxRows: number;
    charsPerRow: number;
}): number {
    const normalizedMaxRows = Number.isFinite(maxRows) && maxRows > 0 ? Math.floor(maxRows) : 1;
    const normalizedCharsPerRow = Number.isFinite(charsPerRow) && charsPerRow > 0 ? Math.floor(charsPerRow) : 1;
    const normalizedText = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
    if (normalizedText.length === 0) {
        return 0;
    }

    if (normalizedMaxRows === 1) {
        return 1;
    }

    return Math.min(normalizedMaxRows, Math.max(1, Math.ceil(normalizedText.length / normalizedCharsPerRow)));
}

export interface FileItemLayoutState {
    isCompactMode: boolean;
    pinnedItemShouldUseCompactLayout: boolean;
    shouldUseSingleLineForDateAndPreview: boolean;
    shouldUseMultiLinePreviewLayout: boolean;
    shouldCollapseEmptyPreviewSpace: boolean;
    shouldUseExpandedMultiLineLayout: boolean;
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
    const shouldUseExpandedMultiLineLayout = !optimizeNoteHeight || hasPreviewContent || showFeatureImageArea;
    const shouldSuppressEmptyPreviewLines = !hasPreviewContent && hasVisiblePillRows;
    const shouldShowDateForItem = showDate && !pinnedItemShouldUseCompactLayout;
    const shouldShowSingleLineSecondLine = shouldShowDateForItem || (showPreview && !shouldSuppressEmptyPreviewLines);
    const multilinePreviewRowCount = showPreview && shouldUseExpandedMultiLineLayout && !shouldSuppressEmptyPreviewLines ? previewRows : 0;

    return {
        isCompactMode,
        pinnedItemShouldUseCompactLayout,
        shouldUseSingleLineForDateAndPreview,
        shouldUseMultiLinePreviewLayout,
        shouldCollapseEmptyPreviewSpace,
        shouldUseExpandedMultiLineLayout,
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

type VisibleFrontmatterPropertySummary = {
    hasVisiblePills: boolean;
    separateRowCount: number;
};

const EMPTY_VISIBLE_FRONTMATTER_PROPERTY_SUMMARY: VisibleFrontmatterPropertySummary = {
    hasVisiblePills: false,
    separateRowCount: 0
};

type VisibleFrontmatterPropertySummaryCache = {
    unfiltered: Map<string, VisibleFrontmatterPropertySummary>;
    filtered: WeakMap<ReadonlySet<string>, Map<string, VisibleFrontmatterPropertySummary>>;
};

const visibleFrontmatterPropertySummaryCache = new WeakMap<FrontmatterPropertyEntries, VisibleFrontmatterPropertySummaryCache>();

function getVisibleFrontmatterPropertySummary({
    properties,
    visiblePropertyKeys,
    hiddenPropertyValueNodeId
}: {
    properties: FileData['properties'] | undefined;
    visiblePropertyKeys?: ReadonlySet<string>;
    hiddenPropertyValueNodeId?: string | null;
}): VisibleFrontmatterPropertySummary {
    if (!properties || properties.length === 0) {
        return EMPTY_VISIBLE_FRONTMATTER_PROPERTY_SUMMARY;
    }

    let cacheContainer = visibleFrontmatterPropertySummaryCache.get(properties);
    if (!cacheContainer) {
        cacheContainer = {
            unfiltered: new Map<string, VisibleFrontmatterPropertySummary>(),
            filtered: new WeakMap<ReadonlySet<string>, Map<string, VisibleFrontmatterPropertySummary>>()
        };
        visibleFrontmatterPropertySummaryCache.set(properties, cacheContainer);
    }

    const hiddenPropertyCacheKey = hiddenPropertyValueNodeId ?? '';
    let cacheBucket: Map<string, VisibleFrontmatterPropertySummary>;
    if (!visiblePropertyKeys) {
        cacheBucket = cacheContainer.unfiltered;
    } else {
        const existingFilteredBucket = cacheContainer.filtered.get(visiblePropertyKeys);
        if (existingFilteredBucket) {
            cacheBucket = existingFilteredBucket;
        } else {
            cacheBucket = new Map<string, VisibleFrontmatterPropertySummary>();
            cacheContainer.filtered.set(visiblePropertyKeys, cacheBucket);
        }
    }

    const cachedSummary = cacheBucket.get(hiddenPropertyCacheKey);
    if (cachedSummary) {
        return cachedSummary;
    }

    let hasVisiblePills = false;
    let hasUnkeyedRow = false;
    const separateRows = new Set<string>();

    forEachVisibleFrontmatterProperty({
        properties,
        visiblePropertyKeys,
        hiddenPropertyValueNodeId,
        visitor: ({ trimmedFieldKey }) => {
            hasVisiblePills = true;

            if (trimmedFieldKey.length === 0) {
                hasUnkeyedRow = true;
                return;
            }

            separateRows.add(trimmedFieldKey);
        }
    });

    const summary = {
        hasVisiblePills,
        separateRowCount: separateRows.size + (hasUnkeyedRow ? 1 : 0)
    };
    cacheBucket.set(hiddenPropertyCacheKey, summary);
    return summary;
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
    visiblePropertyKeys,
    hiddenPropertyValueNodeId
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
    hiddenPropertyValueNodeId?: string | null;
}): number {
    // Computes the number of visual rows the property area will occupy.
    // This is used by the list pane virtualizer height estimator and must stay consistent with FileItem rendering.
    if (!file || file.extension !== 'md') {
        return 0;
    }

    if (isCompactMode && !showFilePropertiesInCompactMode) {
        return 0;
    }

    const wordCountEnabled =
        notePropertyType === 'wordCount' && typeof wordCount === 'number' && Number.isFinite(wordCount) && wordCount > 0;
    const propertySummary = showFileProperties
        ? getVisibleFrontmatterPropertySummary({
              properties,
              visiblePropertyKeys,
              hiddenPropertyValueNodeId
          })
        : EMPTY_VISIBLE_FRONTMATTER_PROPERTY_SUMMARY;

    if (!wordCountEnabled && !propertySummary.hasVisiblePills) {
        // No property row will be rendered.
        return 0;
    }

    const wordCountRowCount = wordCountEnabled ? 1 : 0;

    let frontmatterPropertyRowCount = 0;
    if (!showPropertiesOnSeparateRows) {
        frontmatterPropertyRowCount = propertySummary.hasVisiblePills ? 1 : 0;
    } else if (propertySummary.hasVisiblePills) {
        frontmatterPropertyRowCount = propertySummary.separateRowCount;
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
