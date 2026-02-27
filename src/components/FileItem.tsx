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

/**
 * OPTIMIZATIONS:
 *
 * 1. React.memo - Component only re-renders when props actually change
 *
 * 2. Memoized values:
 *    - displayName: Cached computation of file display name from frontmatter/filename
 *    - displayDate: Cached date formatting to avoid repeated date calculations
 *    - showExtensionBadge: Cached logic for when to show file extension badges
 *    - className: Cached CSS class string to avoid string concatenation on each render
 *
 * 3. Stable callbacks:
 *    - handleTagClick: Memoized to prevent re-creating function on each render
 *
 * 4. Content subscription optimization:
 *    - Single useEffect subscribes to all content changes (preview, tags, feature image)
 *    - Uses file.path as dependency to properly handle file renames
 *    - All data is fetched from RAM cache (MemoryFileCache) for synchronous access
 *    - RAM cache is kept in sync with IndexedDB by StorageContext
 *
 * 5. Data loading pattern:
 *    - Initial load: Synchronously fetch all data from RAM cache
 *    - Updates: Subscribe to cache changes and update state when data changes
 *    - Background: Content providers asynchronously generate preview text and find feature images
 *
 * 6. Image optimization:
 *    - Feature images use default browser loading behavior
 *    - Resource paths are cached to avoid repeated vault.getResourcePath calls
 */

import React, { useRef, useMemo, useEffect, useState, useCallback, useId } from 'react';
import { TFile, TFolder, setTooltip, setIcon } from 'obsidian';
import { useServices } from '../context/ServicesContext';
import type { PropertyItem, FeatureImageStatus, FileContentChange } from '../storage/IndexedDBStorage';
import { useMetadataService } from '../context/ServicesContext';
import { useActiveProfile, useSettingsDerived, useSettingsState } from '../context/SettingsContext';
import { useUXPreferences } from '../context/UXPreferencesContext';
import { useFileCache } from '../context/StorageContext';
import { useContextMenu } from '../hooks/useContextMenu';
import { useTagNavigation } from '../hooks/useTagNavigation';
import { useListPaneAppearance } from '../hooks/useListPaneAppearance';
import { useShortcuts } from '../context/ShortcutsContext';
import { strings } from '../i18n';
import { SortOption } from '../settings';
import { ItemType } from '../types';
import { DateUtils } from '../utils/dateUtils';
import { runAsyncAction } from '../utils/async';
import { getTooltipPlacement } from '../utils/domUtils';
import { openFileInContext } from '../utils/openFileInContext';
import { FILE_VISIBILITY, getExtensionSuffix, isImageFile, shouldDisplayFile } from '../utils/fileTypeUtils';
import { resolveFileDragIconId, resolveFileIconId } from '../utils/fileIconUtils';
import { naturalCompare, resolveDefaultDateField } from '../utils/sortUtils';
import { getCachedFileTags, getTagSearchModifierOperator } from '../utils/tagUtils';
import {
    arePropertyItemsEqual,
    clonePropertyItems,
    isSupportedCssColor,
    parseStrictWikiLink,
    type WikiLinkTarget
} from '../utils/propertyUtils';
import { shouldShowFeatureImageArea } from '../utils/listPaneMeasurements';
import { getIconService, useIconServiceVersion } from '../services/icons';
import type { SearchResultMeta } from '../types/search';
import { createHiddenTagVisibility } from '../utils/tagPrefixMatcher';
import { areStringArraysEqual, mergeRanges, NumericRange } from '../utils/arrayUtils';
import { openAddTagToFilesModal } from '../utils/tagModalHelpers';
import { casefold } from '../utils/recordUtils';
import { resolveUXIcon } from '../utils/uxIcons';
import type { InclusionOperator } from '../utils/filterSearch';
import {
    buildPropertyKeyNodeId,
    buildPropertyValueNodeId,
    getPropertyKeyNodeIdFromNodeId,
    isPropertyKeyOnlyValuePath,
    normalizePropertyNodeId,
    parsePropertyNodeId,
    normalizePropertyTreeValuePath
} from '../utils/propertyTree';
import { ServiceIcon } from './ServiceIcon';

const FEATURE_IMAGE_MAX_ASPECT_RATIO = 16 / 9;
const FEATURE_IMAGE_REGEN_THROTTLE_MS = 10000;
const sortTagsAlphabetically = (tags: string[]): void => {
    tags.sort((firstTag, secondTag) => naturalCompare(firstTag, secondTag));
};

const sortPropertyPillsAlphabetically = (pills: PropertyPill[]): void => {
    pills.sort((firstPill, secondPill) => {
        const labelCompare = naturalCompare(firstPill.label, secondPill.label);
        if (labelCompare !== 0) {
            return labelCompare;
        }

        const valueCompare = naturalCompare(firstPill.value, secondPill.value);
        if (valueCompare !== 0) {
            return valueCompare;
        }

        return naturalCompare(firstPill.fieldKey ?? '', secondPill.fieldKey ?? '');
    });
};

const sortPropertyPillGroup = (pills: readonly PropertyPill[], prioritizeColoredPills: boolean): PropertyPill[] => {
    if (pills.length <= 1) {
        return [...pills];
    }

    if (!prioritizeColoredPills) {
        const sortedPills = [...pills];
        sortPropertyPillsAlphabetically(sortedPills);
        return sortedPills;
    }

    const coloredPills: PropertyPill[] = [];
    const regularPills: PropertyPill[] = [];

    pills.forEach(pill => {
        const hasColor = typeof pill.color === 'string' && pill.color.trim().length > 0;
        const hasBackground = typeof pill.background === 'string' && pill.background.trim().length > 0;
        if (hasColor || hasBackground) {
            coloredPills.push(pill);
            return;
        }

        regularPills.push(pill);
    });

    sortPropertyPillsAlphabetically(coloredPills);
    sortPropertyPillsAlphabetically(regularPills);

    return [...coloredPills, ...regularPills];
};

type PropertyPill = {
    value: string;
    label: string;
    wikiLink: WikiLinkTarget | null;
    iconId?: string;
    fieldKey?: string;
    propertyKeyNodeId?: string;
    color?: string;
    background?: string;
    propertyNodeId?: string;
    propertySearchKey?: string;
    propertySearchValuePath?: string | null;
    canNavigateToProperty?: boolean;
};

function resolveNormalizedPropertyKeyNodeId(fieldKey: string | undefined): string | undefined {
    const trimmedFieldKey = fieldKey?.trim() ?? '';
    if (!trimmedFieldKey) {
        return undefined;
    }

    const rawKeyNodeId = buildPropertyKeyNodeId(trimmedFieldKey);
    return normalizePropertyNodeId(rawKeyNodeId) ?? rawKeyNodeId;
}

function hasOwnRecordEntries(record: Record<string, string> | undefined): boolean {
    if (!record) {
        return false;
    }

    for (const key in record) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
            return true;
        }
    }

    return false;
}

interface FileItemProps {
    file: TFile;
    isSelected: boolean;
    hasSelectedAbove?: boolean;
    hasSelectedBelow?: boolean;
    onFileClick: (file: TFile, fileIndex: number | undefined, event: React.MouseEvent) => void;
    fileIndex?: number;
    dateGroup?: string | null;
    sortOption?: SortOption;
    parentFolder?: string | null;
    isPinned?: boolean;
    selectionType?: ItemType | null;
    /** Active search query for highlighting matches in the file name */
    searchQuery?: string;
    /** Search metadata from Omnisearch provider */
    searchMeta?: SearchResultMeta;
    /** Whether the file is normally hidden (frontmatter or excluded folder) */
    isHidden?: boolean;
    /** Modifies the active search query with a tag token when modifier clicking */
    onModifySearchWithTag?: (tag: string, operator: InclusionOperator) => void;
    /** Modifies the active search query with a property token when modifier clicking */
    onModifySearchWithProperty?: (key: string, value: string | null, operator: InclusionOperator) => void;
    /** Local day reference date used for relative date group calculations */
    localDayReference: Date | null;
    /** Icon size for rendering file icons */
    fileIconSize: number;
    /** Visible frontmatter property keys for file list pills (normalized keys) */
    visiblePropertyKeys: ReadonlySet<string>;
    /** Visible frontmatter property keys in navigation pane (normalized keys) */
    visibleNavigationPropertyKeys: ReadonlySet<string>;
}

/**
 * Computes merged highlight ranges for all occurrences of search segments.
 * Overlapping ranges are merged to avoid nested highlights.
 */
function getMergedHighlightRanges(text: string, query?: string, searchMeta?: SearchResultMeta): NumericRange[] {
    if (!text) return [];

    const lower = text.toLowerCase();
    const ranges: NumericRange[] = [];
    const seenTokens = new Set<string>();

    const addTokenRanges = (rawToken: string | undefined) => {
        if (!rawToken) return;
        const token = rawToken.toLowerCase();
        if (!token || seenTokens.has(token)) return;
        seenTokens.add(token);

        let idx = lower.indexOf(token);
        while (idx !== -1) {
            ranges.push({ start: idx, end: idx + token.length });
            idx = lower.indexOf(token, idx + token.length);
        }
    };

    if (searchMeta) {
        searchMeta.matches.forEach(match => addTokenRanges(match.text));
        searchMeta.terms.forEach(term => addTokenRanges(term));
    }

    // When Omnisearch metadata is present, highlight strictly from provider tokens.
    // This avoids raw-query fallback highlighting for path/ext-only filters.
    if (!searchMeta && ranges.length === 0 && query) {
        const normalizedQuery = query.trim().toLowerCase();
        if (normalizedQuery) {
            normalizedQuery
                .split(/\s+/)
                .filter(Boolean)
                .forEach(segment => addTokenRanges(segment));
        }
    }

    if (ranges.length === 0) {
        return [];
    }

    return mergeRanges(ranges);
}

/**
 * Splits text into plain and highlighted parts based on merged ranges.
 */
function renderHighlightedText(text: string, query?: string, searchMeta?: SearchResultMeta): React.ReactNode {
    if (!text) return text;
    const ranges = getMergedHighlightRanges(text, query, searchMeta);
    if (ranges.length === 0) return text;

    const parts: React.ReactNode[] = [];
    let cursor = 0;
    ranges.forEach((r, i) => {
        if (r.start > cursor) {
            parts.push(text.slice(cursor, r.start));
        }
        parts.push(
            <span key={`h-${i}`} className="nn-search-highlight">
                {text.slice(r.start, r.end)}
            </span>
        );
        cursor = r.end;
    });
    if (cursor < text.length) {
        parts.push(text.slice(cursor));
    }
    return <>{parts}</>;
}

interface ParentFolderLabelProps {
    iconId: string;
    label: string;
    iconVersion: number;
    color?: string;
    showIcon: boolean;
    applyColorToName: boolean;
    onReveal?: () => void;
}

/**
 * Renders a parent folder label with icon for display in file items.
 */
function ParentFolderLabel({ iconId, label, iconVersion, color, showIcon, applyColorToName, onReveal }: ParentFolderLabelProps) {
    const iconRef = useRef<HTMLSpanElement>(null);
    const hasColor = Boolean(color);
    const iconStyle: React.CSSProperties | undefined = color ? { color } : undefined;
    const labelStyle: React.CSSProperties | undefined = applyColorToName && color ? { color } : undefined;
    const labelClassName = applyColorToName ? 'nn-parent-folder-label nn-parent-folder-label--colored' : 'nn-parent-folder-label';
    const isRevealEnabled = Boolean(onReveal);

    // Handles click on parent folder label to reveal the file when enabled
    const handleClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (!onReveal) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            onReveal();
        },
        [onReveal]
    );

    // Render the folder icon when iconId or iconVersion changes
    useEffect(() => {
        const iconContainer = iconRef.current;
        if (!iconContainer) {
            return;
        }

        iconContainer.innerHTML = '';
        if (!iconId || !showIcon) {
            return;
        }

        const iconService = getIconService();
        iconService.renderIcon(iconContainer, iconId);
    }, [iconId, iconVersion, showIcon]);

    return (
        <div className="nn-parent-folder" data-dot-separator={showIcon ? 'false' : 'true'}>
            <div
                className="nn-parent-folder-content"
                data-reveal={isRevealEnabled ? 'true' : 'false'}
                onClick={isRevealEnabled ? handleClick : undefined}
            >
                {showIcon ? (
                    <span
                        className="nn-parent-folder-icon"
                        ref={iconRef}
                        aria-hidden="true"
                        data-has-color={hasColor ? 'true' : 'false'}
                        style={iconStyle}
                    />
                ) : null}
                <span className={labelClassName} style={labelStyle} data-has-color={applyColorToName ? 'true' : 'false'}>
                    {label}
                </span>
            </div>
        </div>
    );
}

/**
 * Memoized FileItem component.
 * Renders an individual file item in the file list with preview text and metadata.
 * Displays the file name, date, preview text, and optional feature image.
 * Handles selection state, context menus, and drag-and-drop functionality.
 *
 * @param props - The component props
 * @param props.file - The Obsidian TFile to display
 * @param props.isSelected - Whether this file is currently selected
 * @param props.onClick - Handler called when the file is clicked
 * @returns A file item element with name, date, preview and optional image
 */
export const FileItem = React.memo(function FileItem({
    file,
    isSelected,
    hasSelectedAbove,
    hasSelectedBelow,
    onFileClick,
    fileIndex,
    dateGroup,
    sortOption,
    parentFolder,
    isPinned = false,
    selectionType,
    searchQuery,
    searchMeta,
    isHidden = false,
    onModifySearchWithTag,
    onModifySearchWithProperty,
    localDayReference,
    fileIconSize,
    visiblePropertyKeys,
    visibleNavigationPropertyKeys
}: FileItemProps) {
    // === Hooks (all hooks together at the top) ===
    const { app, isMobile, plugin, commandQueue, tagOperations } = useServices();
    const settings = useSettingsState();
    const { fileNameIconNeedles } = useSettingsDerived();
    const { hiddenTags } = useActiveProfile();
    const uxPreferences = useUXPreferences();
    const includeDescendantNotes = uxPreferences.includeDescendantNotes;
    const showHiddenItems = uxPreferences.showHiddenItems;
    const appearanceSettings = useListPaneAppearance();
    const { getFileDisplayName, getDB, getFileTimestamps, hasPreview, regenerateFeatureImageForFile } = useFileCache();
    const { navigateToTag, navigateToProperty } = useTagNavigation();
    const metadataService = useMetadataService();
    const { addNoteShortcut, hasNoteShortcut, noteShortcutKeysByPath, removeShortcut } = useShortcuts();
    const hiddenTagVisibility = useMemo(() => createHiddenTagVisibility(hiddenTags, showHiddenItems), [hiddenTags, showHiddenItems]);

    // === Helper functions ===
    // Load all file metadata from cache
    const loadFileData = useCallback(() => {
        const db = getDB();

        const preview = appearanceSettings.showPreview && file.extension === 'md' ? db.getCachedPreviewText(file.path) : '';

        // Pull the feature image key from the cache; blobs load asynchronously.
        const record = db.getFile(file.path);
        const tagList = [...getCachedFileTags({ app, file, db, fileData: record })];
        const featureImageKey = record?.featureImageKey ?? null;
        const featureImageStatus: FeatureImageStatus = record?.featureImageStatus ?? 'unprocessed';
        const properties = clonePropertyItems(record?.properties ?? null);
        const wordCount = record?.wordCount ?? null;
        const taskUnfinished = record?.taskUnfinished ?? null;

        let imageUrl: string | null = null;
        if (appearanceSettings.showImage && isImageFile(file)) {
            try {
                imageUrl = app.vault.getResourcePath(file);
            } catch {
                imageUrl = null;
            }
        }

        return { preview, tags: tagList, imageUrl, featureImageKey, featureImageStatus, properties, wordCount, taskUnfinished };
    }, [appearanceSettings.showImage, appearanceSettings.showPreview, app, file, getDB]);

    // === State ===
    const [isHovered, setIsHovered] = React.useState(false);

    // Cache initial data to avoid recomputing on every render
    const initialDataRef = useRef<ReturnType<typeof loadFileData> | null>(null);
    const initialData = initialDataRef.current ?? loadFileData();
    initialDataRef.current = initialData;

    const [previewText, setPreviewText] = useState<string>(initialData.preview);
    const [tags, setTags] = useState<string[]>(initialData.tags);
    const [featureImageKey, setFeatureImageKey] = useState<string | null>(initialData.featureImageKey);
    const [featureImageStatus, setFeatureImageStatus] = useState<FeatureImageStatus>(initialData.featureImageStatus);
    const [featureImageUrl, setFeatureImageUrl] = useState<string | null>(initialData.imageUrl);
    const [properties, setProperties] = useState<PropertyItem[] | null>(initialData.properties);
    const [wordCount, setWordCount] = useState<number | null>(initialData.wordCount);
    const [taskUnfinished, setTaskUnfinished] = useState<number | null>(initialData.taskUnfinished);
    const [featureImageAspectRatio, setFeatureImageAspectRatio] = useState<number | null>(null);
    const [isFeatureImageHidden, setIsFeatureImageHidden] = useState(false);
    const [metadataVersion, setMetadataVersion] = useState(0);

    // === Refs ===
    const fileRef = useRef<HTMLDivElement>(null);
    const revealInFolderIconRef = useRef<HTMLDivElement>(null);
    const addTagIconRef = useRef<HTMLDivElement>(null);
    const addShortcutIconRef = useRef<HTMLDivElement>(null);
    const pinNoteIconRef = useRef<HTMLDivElement>(null);
    const openInNewTabIconRef = useRef<HTMLDivElement>(null);
    const fileIconRef = useRef<HTMLSpanElement>(null);
    const featureImageObjectUrlRef = useRef<string | null>(null);
    const featureImageImgRef = useRef<HTMLImageElement | null>(null);
    const lastFeatureImageRegenRef = useRef<{ key: string; at: number } | null>(null);
    // Unique ID for linking screen reader description to the file item
    const hiddenDescriptionId = useId();

    // === Derived State & Memoized Values ===

    // Check which quick actions should be shown
    const shouldShowOpenInNewTab = settings.showQuickActions && settings.quickActionOpenInNewTab;
    const shouldShowPinNote = settings.showQuickActions && settings.quickActionPinNote;
    const shouldShowRevealIcon =
        settings.showQuickActions && settings.quickActionRevealInFolder && file.parent && file.parent.path !== parentFolder;
    const canAddTagsToFile = file.extension === 'md';
    const shouldShowAddTagAction = settings.showQuickActions && settings.quickActionAddTag && canAddTagsToFile && Boolean(tagOperations);
    const hasShortcut = hasNoteShortcut(file.path);
    const shouldShowShortcutAction = settings.showQuickActions && settings.quickActionAddToShortcuts;
    const hasQuickActions =
        shouldShowOpenInNewTab || shouldShowPinNote || shouldShowRevealIcon || shouldShowAddTagAction || shouldShowShortcutAction;
    const iconServiceVersion = useIconServiceVersion();
    const showFileIcons = settings.showFileIcons;
    const hasUnfinishedTasks = typeof taskUnfinished === 'number' && taskUnfinished > 0;
    const showFileIconUnfinishedTask = settings.showFileIconUnfinishedTask && hasUnfinishedTasks;
    const unfinishedTaskIconId = useMemo(() => resolveUXIcon(settings.interfaceIcons, 'file-unfinished-task'), [settings.interfaceIcons]);
    const wordCountPillIconId = useMemo(() => resolveUXIcon(settings.interfaceIcons, 'file-word-count'), [settings.interfaceIcons]);

    // Get display name from RAM cache (handles frontmatter title)
    const displayName = useMemo(() => {
        return getFileDisplayName(file);
        // NOTE TO REVIEWER: Recompute on frontmatter metadata changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file, getFileDisplayName, metadataVersion]);

    // Highlight matches in display name when search is active
    const highlightedName = useMemo(
        () => renderHighlightedText(displayName, searchQuery, searchMeta),
        [displayName, searchQuery, searchMeta]
    );

    // Decide whether to render an inline extension suffix after the name
    const extensionSuffix = useMemo(() => getExtensionSuffix(file), [file]);
    const fileIconId = metadataService.getFileIcon(file.path);
    const fileColor = metadataService.getFileColor(file.path);
    const fileExtension = file.extension.toLowerCase();
    const isBaseFile = fileExtension === 'base';
    const isCanvasFile = fileExtension === 'canvas';
    // Check if file is not natively supported by Obsidian (e.g., Office files, archives)
    const isExternalFile = useMemo(() => {
        return !shouldDisplayFile(file, FILE_VISIBILITY.SUPPORTED, app);
    }, [app, file]);
    const allowCategoryIcons = settings.showCategoryIcons || (settings.colorIconOnly && Boolean(fileColor));
    // Determine the actual icon to display, considering custom icon and colorIconOnly setting
    const effectiveFileIconId = useMemo(() => {
        void metadataVersion;
        if (showFileIconUnfinishedTask) {
            return unfinishedTaskIconId;
        }

        return resolveFileIconId(
            file,
            {
                showFilenameMatchIcons: settings.showFilenameMatchIcons,
                fileNameIconMap: settings.fileNameIconMap,
                showCategoryIcons: settings.showCategoryIcons,
                fileTypeIconMap: settings.fileTypeIconMap
            },
            {
                customIconId: fileIconId,
                metadataCache: app.metadataCache,
                isExternalFile,
                allowCategoryIcons,
                fallbackMode: allowCategoryIcons ? 'file' : 'none',
                fileNameNeedles: fileNameIconNeedles,
                fileNameForMatch: displayName
            }
        );
    }, [
        allowCategoryIcons,
        app.metadataCache,
        displayName,
        fileNameIconNeedles,
        fileIconId,
        file,
        isExternalFile,
        metadataVersion,
        settings.fileNameIconMap,
        settings.fileTypeIconMap,
        settings.showCategoryIcons,
        settings.showFilenameMatchIcons,
        showFileIconUnfinishedTask,
        unfinishedTaskIconId
    ]);
    // Determine whether to apply color to the file name instead of the icon
    const applyColorToName = Boolean(fileColor) && !settings.colorIconOnly;
    // Icon to use when dragging the file
    const dragIconId = useMemo(() => {
        void metadataVersion;
        return resolveFileDragIconId(file, settings.fileTypeIconMap, app.metadataCache, effectiveFileIconId);
    }, [app.metadataCache, effectiveFileIconId, file, metadataVersion, settings.fileTypeIconMap]);

    const isCompactMode = !appearanceSettings.showDate && !appearanceSettings.showPreview && !appearanceSettings.showImage;

    // Determines whether to display the file icon based on icon availability
    const shouldShowFileIcon = useMemo(() => {
        if (!showFileIcons) {
            return false;
        }
        if (!effectiveFileIconId) {
            return false;
        }
        return true;
    }, [effectiveFileIconId, showFileIcons]);
    const fileIconHasColor = Boolean(fileColor) && !showFileIconUnfinishedTask;
    const fileIconStyle = fileColor && !showFileIconUnfinishedTask ? ({ color: fileColor } as React.CSSProperties) : undefined;
    const fileIconClassName = showFileIconUnfinishedTask ? 'nn-file-icon nn-file-icon-unfinished-task' : 'nn-file-icon';
    const dragIconColor = showFileIconUnfinishedTask ? undefined : (fileColor ?? undefined);
    const shouldShowCompactExtensionBadge = isCompactMode && (isBaseFile || isCanvasFile);

    const fileTitleElement = useMemo(() => {
        return (
            <div
                className="nn-file-name"
                data-has-color={applyColorToName ? 'true' : 'false'}
                style={
                    {
                        '--filename-rows': appearanceSettings.titleRows,
                        ...(applyColorToName ? { '--nn-file-name-custom-color': fileColor } : {})
                    } as React.CSSProperties
                }
            >
                {highlightedName}
                {extensionSuffix.length > 0 && <span className="nn-file-ext-suffix">{extensionSuffix}</span>}
            </div>
        );
    }, [appearanceSettings.titleRows, extensionSuffix, fileColor, applyColorToName, highlightedName]);

    // === Callbacks ===

    // Handle tag click
    const handleTagClick = useCallback(
        (event: React.MouseEvent, tag: string) => {
            event.stopPropagation();

            if (onModifySearchWithTag) {
                const operator = getTagSearchModifierOperator(event, settings.multiSelectModifier, isMobile);
                if (operator) {
                    event.preventDefault();
                    onModifySearchWithTag(tag, operator);
                    return;
                }
            }

            navigateToTag(tag, { preserveNavigationFocus: false });
        },
        [navigateToTag, onModifySearchWithTag, settings.multiSelectModifier, isMobile]
    );

    const handlePropertyClick = useCallback(
        (event: React.MouseEvent, pill: PropertyPill) => {
            const propertyNodeId = pill.propertyNodeId;
            const propertySearchKey = pill.propertySearchKey;
            const canNavigateToProperty = pill.canNavigateToProperty === true;
            event.stopPropagation();

            if (canNavigateToProperty && onModifySearchWithProperty && propertySearchKey) {
                const operator = getTagSearchModifierOperator(event, settings.multiSelectModifier, isMobile);
                if (operator) {
                    event.preventDefault();
                    onModifySearchWithProperty(propertySearchKey, pill.propertySearchValuePath ?? null, operator);
                    return;
                }
            }

            const wikiLinkTarget = pill.wikiLink?.target.trim();
            if (wikiLinkTarget) {
                event.preventDefault();
                runAsyncAction(() => app.workspace.openLinkText(wikiLinkTarget, file.path, false));
                return;
            }

            if (!canNavigateToProperty || !propertyNodeId || !propertySearchKey) {
                return;
            }

            navigateToProperty(propertyNodeId, { preserveNavigationFocus: false });
        },
        [app.workspace, file.path, isMobile, navigateToProperty, onModifySearchWithProperty, settings.multiSelectModifier]
    );

    const getTagColorData = useCallback(
        (tag: string): { color?: string; background?: string } => {
            return metadataService.getTagColorData(tag);
        },
        [metadataService]
    );

    const colorFileTags = settings.colorFileTags;
    const prioritizeColoredFileTags = settings.prioritizeColoredFileTags;

    const visibleTags = useMemo(() => {
        if (tags.length === 0) {
            return tags;
        }
        if (!hiddenTagVisibility.shouldFilterHiddenTags) {
            return tags;
        }

        return tags.filter(tag => hiddenTagVisibility.isTagVisible(tag));
    }, [hiddenTagVisibility, tags]);

    // Build color and background map for visible tags
    const tagColorData = useMemo(() => {
        void settings.tagColors;
        void settings.tagBackgroundColors;
        void settings.inheritTagColors;

        if (!colorFileTags || visibleTags.length === 0) {
            return new Map<string, { color?: string; background?: string }>();
        }

        // Cache resolved tag color/background for visible tags to avoid repeated ancestor checks.
        const entries = new Map<string, { color?: string; background?: string }>();
        visibleTags.forEach(tag => {
            const data = getTagColorData(tag);
            if (data.color || data.background) {
                entries.set(tag, data);
            }
        });

        return entries;
    }, [colorFileTags, getTagColorData, settings.inheritTagColors, settings.tagBackgroundColors, settings.tagColors, visibleTags]);

    // Sort tags alphabetically and optionally prioritize colored tags
    const categorizedTags = useMemo(() => {
        if (visibleTags.length === 0) {
            return visibleTags;
        }

        if (!prioritizeColoredFileTags || !colorFileTags) {
            const sortedTags = [...visibleTags];
            sortTagsAlphabetically(sortedTags);
            return sortedTags;
        }

        const coloredTags: string[] = [];
        const regularTags: string[] = [];

        visibleTags.forEach(tag => {
            const tagColors = tagColorData.get(tag);
            const hasTagColor = Boolean(tagColors?.color);
            const hasTagBackground = Boolean(tagColors?.background);

            if (hasTagColor || hasTagBackground) {
                coloredTags.push(tag);
                return;
            }

            regularTags.push(tag);
        });

        sortTagsAlphabetically(coloredTags);
        sortTagsAlphabetically(regularTags);

        return [...coloredTags, ...regularTags];
    }, [colorFileTags, prioritizeColoredFileTags, tagColorData, visibleTags]);

    const shouldShowFileTags = useMemo(() => {
        if (!settings.showTags || !settings.showFileTags) {
            return false;
        }
        if (categorizedTags.length === 0) {
            return false;
        }
        if (isCompactMode && !settings.showFileTagsInCompactMode) {
            return false;
        }
        return true;
    }, [categorizedTags, isCompactMode, settings.showFileTags, settings.showFileTagsInCompactMode, settings.showTags]);

    const visibleProperties = useMemo(() => {
        if (!properties || properties.length === 0) {
            return properties;
        }
        if (visiblePropertyKeys.size === 0) {
            return [];
        }

        // Includes configured keys with visible values and skips key-only boolean markers.
        return properties.filter(entry => {
            const normalizedFieldKey = casefold(entry.fieldKey);
            if (!visiblePropertyKeys.has(normalizedFieldKey)) {
                return false;
            }

            if (entry.valueKind === 'string') {
                return true;
            }

            if (entry.valueKind !== undefined) {
                return false;
            }

            const normalizedValuePath = normalizePropertyTreeValuePath(entry.value);
            return !isPropertyKeyOnlyValuePath(normalizedValuePath, entry.valueKind);
        });
    }, [properties, visiblePropertyKeys]);

    const propertyColorSignature = useMemo(() => {
        if (!settings.showFileProperties || !settings.colorFileProperties || !visibleProperties || visibleProperties.length === 0) {
            return '';
        }

        const colorRecord = settings.propertyColors;
        const backgroundRecord = settings.propertyBackgroundColors;
        const inheritSignature = settings.inheritPropertyColors ? 'inherit:1' : 'inherit:0';
        const signatures: string[] = [];
        const seenValueNodeIds = new Set<string>();
        const seenKeyNodeIds = new Set<string>();

        for (const entry of visibleProperties) {
            const rawValue = entry.value;
            if (rawValue.trim().length === 0) {
                continue;
            }

            const rawValueNodeId = buildPropertyValueNodeId(entry.fieldKey, rawValue);
            const valueNodeId = normalizePropertyNodeId(rawValueNodeId) ?? rawValueNodeId;
            if (!seenValueNodeIds.has(valueNodeId)) {
                seenValueNodeIds.add(valueNodeId);
                signatures.push(`v:${valueNodeId}\u0000${colorRecord?.[valueNodeId] ?? ''}\u0000${backgroundRecord?.[valueNodeId] ?? ''}`);
            }

            const keyNodeId = getPropertyKeyNodeIdFromNodeId(valueNodeId);
            if (!keyNodeId || seenKeyNodeIds.has(keyNodeId)) {
                continue;
            }

            seenKeyNodeIds.add(keyNodeId);
            signatures.push(`k:${keyNodeId}\u0000${colorRecord?.[keyNodeId] ?? ''}\u0000${backgroundRecord?.[keyNodeId] ?? ''}`);
        }

        if (signatures.length === 0) {
            return inheritSignature;
        }

        if (signatures.length === 1) {
            return `${inheritSignature}\u0001${signatures[0] ?? ''}`;
        }

        signatures.sort();
        return `${inheritSignature}\u0001${signatures.join('\u0001')}`;
    }, [
        visibleProperties,
        settings.colorFileProperties,
        settings.inheritPropertyColors,
        settings.propertyBackgroundColors,
        settings.propertyColors,
        settings.showFileProperties
    ]);

    const canShowPropertyPills = useMemo(() => {
        if (file.extension !== 'md') {
            return false;
        }

        if (isCompactMode && !settings.showFilePropertiesInCompactMode) {
            return false;
        }

        return true;
    }, [file.extension, isCompactMode, settings.showFilePropertiesInCompactMode]);

    const wordCountPropertyPill = useMemo<PropertyPill | null>(() => {
        if (!canShowPropertyPills) {
            return null;
        }

        if (appearanceSettings.notePropertyType !== 'wordCount') {
            return null;
        }

        // Don't show `0`: it can mean "no words", a huge file (content read skipped), or an Excalidraw document.
        if (typeof wordCount !== 'number' || !Number.isFinite(wordCount) || wordCount <= 0) {
            return null;
        }

        const truncatedWordCount = Math.trunc(wordCount);
        return {
            value: truncatedWordCount.toString(),
            label: truncatedWordCount.toLocaleString(),
            wikiLink: null,
            iconId: wordCountPillIconId
        };
    }, [appearanceSettings.notePropertyType, canShowPropertyPills, wordCount, wordCountPillIconId]);

    const propertyPills = useMemo<PropertyPill[]>(() => {
        void propertyColorSignature;

        const pills: PropertyPill[] = [];
        const frontmatterPills: PropertyPill[] = [];
        const colorFileProperties = settings.colorFileProperties;
        const prioritizeColoredFileProperties = settings.prioritizeColoredFileProperties;

        if (!canShowPropertyPills || !settings.showFileProperties) {
            return pills;
        }

        if (!visibleProperties || visibleProperties.length === 0) {
            return pills;
        }

        // Convert cached property data to renderable pill models.
        const colorLookupCache = new Map<string, { color?: string; background?: string }>();
        for (const entry of visibleProperties) {
            const rawValue = entry.value;
            if (rawValue.trim().length === 0) {
                continue;
            }

            const trimmedFieldKey = entry.fieldKey.trim();
            const normalizedValuePath = normalizePropertyTreeValuePath(rawValue);
            const isKeyOnlyValue = isPropertyKeyOnlyValuePath(normalizedValuePath, entry.valueKind);
            const wikiLink = isKeyOnlyValue ? null : parseStrictWikiLink(rawValue);
            const label = wikiLink ? wikiLink.displayText : rawValue;

            // Resolve property colors at render time from field key and raw value.
            // This keeps persisted property items stable across style rule changes.
            const cacheKey = `${entry.fieldKey}\u0000${rawValue}`;
            let colorData = colorLookupCache.get(cacheKey);
            if (!colorData) {
                if (colorFileProperties) {
                    const propertyNodeId = buildPropertyValueNodeId(entry.fieldKey, rawValue);
                    colorData = metadataService.getPropertyColorData(propertyNodeId);
                } else {
                    colorData = {};
                }
                colorLookupCache.set(cacheKey, colorData);
            }

            const propertyNodeId = (() => {
                if (!trimmedFieldKey) {
                    return undefined;
                }

                const rawPropertyNodeId = isKeyOnlyValue
                    ? buildPropertyKeyNodeId(trimmedFieldKey)
                    : buildPropertyValueNodeId(trimmedFieldKey, normalizedValuePath);
                return normalizePropertyNodeId(rawPropertyNodeId) ?? rawPropertyNodeId;
            })();

            const parsedPropertyNode = propertyNodeId ? parsePropertyNodeId(propertyNodeId) : null;
            const propertyKeyNodeId = propertyNodeId
                ? (getPropertyKeyNodeIdFromNodeId(propertyNodeId) ?? resolveNormalizedPropertyKeyNodeId(trimmedFieldKey))
                : resolveNormalizedPropertyKeyNodeId(trimmedFieldKey);
            const propertySearchKey = parsedPropertyNode?.key || trimmedFieldKey;
            const propertySearchValuePath = isKeyOnlyValue ? null : (parsedPropertyNode?.valuePath ?? normalizedValuePath);
            const normalizedPropertySearchKey = casefold(propertySearchKey);
            const canNavigateToProperty =
                propertyNodeId !== undefined &&
                normalizedPropertySearchKey.length > 0 &&
                visibleNavigationPropertyKeys.has(normalizedPropertySearchKey);

            frontmatterPills.push({
                value: rawValue,
                label,
                wikiLink,
                fieldKey: entry.fieldKey,
                propertyKeyNodeId,
                color: colorData.color,
                background: colorData.background,
                propertyNodeId,
                propertySearchKey: propertySearchKey.length > 0 ? propertySearchKey : undefined,
                propertySearchValuePath,
                canNavigateToProperty
            });
        }

        const prioritizeColoredPills = prioritizeColoredFileProperties && colorFileProperties;
        const groupedPills = new Map<string, PropertyPill[]>();
        const groupOrder: string[] = [];

        frontmatterPills.forEach(pill => {
            const key = pill.fieldKey ?? '';
            const existingGroup = groupedPills.get(key);
            if (existingGroup) {
                existingGroup.push(pill);
                return;
            }

            groupedPills.set(key, [pill]);
            groupOrder.push(key);
        });

        groupOrder.forEach(groupKey => {
            const group = groupedPills.get(groupKey);
            if (!group || group.length === 0) {
                return;
            }

            pills.push(...sortPropertyPillGroup(group, prioritizeColoredPills));
        });

        return pills;
    }, [
        canShowPropertyPills,
        metadataService,
        visibleProperties,
        propertyColorSignature,
        settings.colorFileProperties,
        settings.prioritizeColoredFileProperties,
        settings.showFileProperties,
        visibleNavigationPropertyKeys
    ]);

    const propertyColorData = useMemo(() => {
        // Precompute per-token styles so each pill render is O(1).
        const entries = new Map<
            string,
            {
                style?: (React.CSSProperties & { '--nn-file-tag-custom-bg'?: string }) | undefined;
                hasColor: boolean;
                hasBackground: boolean;
            }
        >();

        if (propertyPills.length === 0) {
            return entries;
        }

        for (const pill of propertyPills) {
            const colorToken = pill.color?.trim() ?? '';
            const backgroundToken = pill.background?.trim() ?? '';
            if (!colorToken && !backgroundToken) {
                continue;
            }

            const cacheKey = `${colorToken}\u0000${backgroundToken}`;
            if (entries.has(cacheKey)) {
                continue;
            }

            const pillStyle: React.CSSProperties & { '--nn-file-tag-custom-bg'?: string } = {};

            let hasColor = false;
            let hasBackground = false;
            if (backgroundToken && isSupportedCssColor(backgroundToken)) {
                pillStyle['--nn-file-tag-custom-bg'] = backgroundToken;
                hasBackground = true;
            }
            if (colorToken && isSupportedCssColor(colorToken)) {
                pillStyle.color = colorToken;
                hasColor = true;
            }

            entries.set(cacheKey, {
                style: hasColor || hasBackground ? pillStyle : undefined,
                hasColor,
                hasBackground
            });
        }

        return entries;
    }, [propertyPills]);

    const shouldShowProperty = propertyPills.length > 0;
    const shouldShowWordCountProperty = Boolean(wordCountPropertyPill);

    const propertyRows = useMemo((): PropertyPill[][] => {
        if (!settings.showPropertiesOnSeparateRows) {
            return [];
        }

        const rows: PropertyPill[][] = [];
        const rowsByKey = new Map<string, PropertyPill[]>();
        let unkeyedRow: PropertyPill[] | null = null;

        for (const pill of propertyPills) {
            const fieldKey = pill.fieldKey?.trim() ?? '';
            if (!fieldKey) {
                if (!unkeyedRow) {
                    unkeyedRow = [];
                    rows.push(unkeyedRow);
                }
                unkeyedRow.push(pill);
                continue;
            }

            let row = rowsByKey.get(fieldKey);
            if (!row) {
                row = [];
                rowsByKey.set(fieldKey, row);
                rows.push(row);
            }
            row.push(pill);
        }

        return rows;
    }, [propertyPills, settings.showPropertiesOnSeparateRows]);

    const getTagDisplayName = useCallback(
        (tag: string): string => {
            if (settings.showFileTagAncestors) {
                return tag;
            }

            const segments = tag.split('/').filter(segment => segment.length > 0);

            if (segments.length === 0) {
                return tag;
            }

            return segments[segments.length - 1];
        },
        [settings.showFileTagAncestors]
    );

    const tagPillIcons = useMemo(() => {
        const icons = new Map<string, string>();
        const tagIcons = settings.tagIcons;
        if (!tagIcons || !hasOwnRecordEntries(tagIcons) || categorizedTags.length === 0) {
            return icons;
        }

        categorizedTags.forEach(tag => {
            const iconId = metadataService.getTagIcon(tag);
            if (iconId) {
                icons.set(tag, iconId);
            }
        });

        return icons;
    }, [categorizedTags, metadataService, settings.tagIcons]);

    const propertyPillIcons = useMemo(() => {
        const icons = new Map<PropertyPill, string>();
        const propertyIcons = settings.propertyIcons;
        if (!propertyIcons || !hasOwnRecordEntries(propertyIcons)) {
            if (wordCountPropertyPill?.iconId) {
                icons.set(wordCountPropertyPill, wordCountPropertyPill.iconId);
            }
            return icons;
        }

        if (propertyPills.length === 0) {
            if (wordCountPropertyPill?.iconId) {
                icons.set(wordCountPropertyPill, wordCountPropertyPill.iconId);
            }
            return icons;
        }

        const resolvePropertyPillIconId = (pill: PropertyPill): string | undefined => {
            if (pill.iconId) {
                return pill.iconId;
            }

            let checkedKeyNodeId: string | null = null;
            if (pill.propertyNodeId) {
                const valueIconId = metadataService.getPropertyIcon(pill.propertyNodeId);
                if (valueIconId) {
                    return valueIconId;
                }

                const keyNodeIdFromNode = getPropertyKeyNodeIdFromNodeId(pill.propertyNodeId);
                if (keyNodeIdFromNode) {
                    checkedKeyNodeId = keyNodeIdFromNode;
                    if (keyNodeIdFromNode !== pill.propertyNodeId) {
                        const keyIconId = metadataService.getPropertyIcon(keyNodeIdFromNode);
                        if (keyIconId) {
                            return keyIconId;
                        }
                    }
                }
            }

            const fallbackKeyNodeId = pill.propertyKeyNodeId;
            if (!fallbackKeyNodeId) {
                return undefined;
            }

            if (checkedKeyNodeId === fallbackKeyNodeId) {
                return undefined;
            }

            return metadataService.getPropertyIcon(fallbackKeyNodeId);
        };

        propertyPills.forEach(pill => {
            const iconId = resolvePropertyPillIconId(pill);
            if (iconId) {
                icons.set(pill, iconId);
            }
        });

        if (wordCountPropertyPill?.iconId) {
            icons.set(wordCountPropertyPill, wordCountPropertyPill.iconId);
        }

        return icons;
    }, [metadataService, propertyPills, settings.propertyIcons, wordCountPropertyPill]);

    // Render tags
    const renderTags = useCallback(() => {
        if (!shouldShowFileTags) {
            return null;
        }

        return (
            <div className="nn-file-tags">
                {categorizedTags.map((tag, index) => {
                    const tagColors = tagColorData.get(tag);
                    const tagColor = tagColors?.color;
                    const tagBackground = tagColors?.background;
                    const displayTag = getTagDisplayName(tag);
                    const tagIconId = tagPillIcons.get(tag);
                    const tagStyle: React.CSSProperties & { '--nn-file-tag-custom-bg'?: string } = {};

                    if (tagBackground) {
                        tagStyle['--nn-file-tag-custom-bg'] = tagBackground;
                    }

                    if (tagColor) {
                        tagStyle.color = tagColor;
                    }

                    return (
                        <span
                            key={index}
                            className="nn-file-tag nn-clickable-tag"
                            data-has-color={tagColor ? 'true' : undefined}
                            data-has-background={tagBackground ? 'true' : undefined}
                            onClick={e => handleTagClick(e, tag)}
                            role="button"
                            tabIndex={0}
                            style={tagColor || tagBackground ? tagStyle : undefined}
                        >
                            {tagIconId ? <ServiceIcon iconId={tagIconId} className="nn-file-pill-inline-icon" aria-hidden={true} /> : null}
                            {displayTag}
                        </span>
                    );
                })}
            </div>
        );
    }, [categorizedTags, getTagDisplayName, handleTagClick, shouldShowFileTags, tagColorData, tagPillIcons]);

    const renderPropertyPill = useCallback(
        (pill: PropertyPill, index: number) => {
            const canNavigateToProperty = pill.canNavigateToProperty === true;
            const isWikiLink = Boolean(pill.wikiLink);
            const isClickable = canNavigateToProperty || isWikiLink;
            const className = [
                'nn-file-tag',
                'nn-file-property',
                isClickable ? 'nn-clickable-tag' : '',
                isWikiLink ? 'nn-file-property-wikilink' : ''
            ]
                .filter(classToken => classToken.length > 0)
                .join(' ');
            const colorToken = pill.color?.trim() ?? '';
            const backgroundToken = pill.background?.trim() ?? '';
            const cacheKey = `${colorToken}\u0000${backgroundToken}`;
            const resolvedColorData = colorToken || backgroundToken ? propertyColorData.get(cacheKey) : undefined;
            const hasColor = Boolean(resolvedColorData?.hasColor);
            const hasBackground = Boolean(resolvedColorData?.hasBackground);
            const propertyIconId = propertyPillIcons.get(pill);

            return (
                <span
                    key={index}
                    className={className}
                    data-has-color={hasColor ? 'true' : undefined}
                    data-has-background={hasBackground ? 'true' : undefined}
                    onClick={isClickable ? event => handlePropertyClick(event, pill) : undefined}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    style={resolvedColorData?.style}
                >
                    {propertyIconId ? (
                        <ServiceIcon iconId={propertyIconId} className="nn-file-pill-inline-icon" aria-hidden={true} />
                    ) : null}
                    {pill.label}
                </span>
            );
        },
        [handlePropertyClick, propertyColorData, propertyPillIcons]
    );

    const renderProperties = useCallback(() => {
        if (!shouldShowProperty) {
            return null;
        }

        if (!settings.showPropertiesOnSeparateRows) {
            return <div className="nn-file-property-row">{propertyPills.map(renderPropertyPill)}</div>;
        }

        return (
            <>
                {propertyRows.map((row, rowIndex) => (
                    <div key={rowIndex} className="nn-file-property-row">
                        {row.map((pill, index) => renderPropertyPill(pill, index))}
                    </div>
                ))}
            </>
        );
    }, [propertyPills, propertyRows, renderPropertyPill, settings.showPropertiesOnSeparateRows, shouldShowProperty]);

    const renderWordCountProperty = useCallback(() => {
        if (!shouldShowWordCountProperty || !wordCountPropertyPill) {
            return null;
        }

        return <div className="nn-file-property-row">{renderPropertyPill(wordCountPropertyPill, 0)}</div>;
    }, [renderPropertyPill, shouldShowWordCountProperty, wordCountPropertyPill]);

    const renderPillRows = useCallback(() => {
        return (
            <>
                {renderTags()}
                {renderProperties()}
                {renderWordCountProperty()}
            </>
        );
    }, [renderProperties, renderTags, renderWordCountProperty]);

    // Format display date based on current sort
    const displayDate = useMemo(() => {
        if (!appearanceSettings.showDate || !sortOption) return '';

        const timestamps = getFileTimestamps(file);
        const defaultDateField = resolveDefaultDateField(sortOption, settings.alphabeticalDateMode ?? 'modified');
        const timestamp = defaultDateField === 'created' ? timestamps.created : timestamps.modified;

        // Pinned items are all grouped under "📌 Pinned" section regardless of their actual dates
        // We need to calculate the actual date group to show smart formatting
        if (isPinned) {
            const actualDateGroup = DateUtils.getDateGroup(timestamp, localDayReference ?? undefined);
            return DateUtils.formatDateForGroup(timestamp, actualDateGroup, settings.dateFormat, settings.timeFormat);
        }

        // If in a date group and not in pinned section, format relative to group
        if (dateGroup && dateGroup !== strings.listPane.pinnedSection) {
            return DateUtils.formatDateForGroup(timestamp, dateGroup, settings.dateFormat, settings.timeFormat);
        }

        // Otherwise format as absolute date
        return DateUtils.formatDate(timestamp, settings.dateFormat);
        // NOTE TO REVIEWER: Including **file.stat.mtime**/**file.stat.ctime** to detect file changes
        // Without them, dates won't update after file edits
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        file,
        file.stat.mtime,
        file.stat.ctime,
        sortOption,
        dateGroup,
        isPinned,
        appearanceSettings.showDate,
        settings.dateFormat,
        settings.timeFormat,
        settings.alphabeticalDateMode,
        getFileTimestamps,
        metadataVersion,
        localDayReference
    ]);

    // Height optimization settings
    const heightOptimizationEnabled = settings.optimizeNoteHeight;
    const heightOptimizationDisabled = !settings.optimizeNoteHeight;

    // Layout decision variables
    const pinnedItemShouldUseCompactLayout = isPinned && heightOptimizationEnabled; // Pinned items get compact treatment only when optimizing
    const effectivePreviewText = searchMeta?.excerpt ? searchMeta.excerpt : previewText;
    const hasPreviewAccordingToStatus = appearanceSettings.showPreview && file.extension === 'md' ? hasPreview(file.path) : false;
    const hasPreviewContent = hasPreviewAccordingToStatus || effectivePreviewText.length > 0;
    const highlightedPreview = useMemo(
        // Only Omnisearch trigger highlighting in preview, not regular filter
        () => (searchMeta ? renderHighlightedText(effectivePreviewText, searchQuery, searchMeta) : effectivePreviewText),
        [effectivePreviewText, searchMeta, searchQuery]
    );

    // Determine if we should show the feature image area (either with an image or extension badge)
    const showFeatureImageArea = shouldShowFeatureImageArea({
        showImage: appearanceSettings.showImage,
        file,
        featureImageStatus,
        hasFeatureImageUrl: Boolean(featureImageUrl)
    });

    const shouldUseSingleLineForDateAndPreview = pinnedItemShouldUseCompactLayout || appearanceSettings.previewRows < 2;
    const shouldUseMultiLinePreviewLayout = !pinnedItemShouldUseCompactLayout && appearanceSettings.previewRows >= 2;
    const shouldCollapseEmptyPreviewSpace = heightOptimizationEnabled && !hasPreviewContent && !showFeatureImageArea; // Optimization: compact layout for empty preview
    const shouldAlwaysReservePreviewSpace = heightOptimizationDisabled || hasPreviewContent || showFeatureImageArea; // Show full layout when not optimizing OR has content
    const hasVisiblePillRows = shouldShowFileTags || shouldShowProperty || shouldShowWordCountProperty;
    const shouldSuppressEmptyPreviewLines = !hasPreviewContent && hasVisiblePillRows;
    const shouldShowDateForItem = settings.showFileDate && !pinnedItemShouldUseCompactLayout;
    const shouldShowSingleLineSecondLine = shouldShowDateForItem || (settings.showFilePreview && !shouldSuppressEmptyPreviewLines);

    // Determine parent folder display metadata
    const parentFolderSource = file.parent;
    let parentFolderMeta: {
        name: string;
        iconId: string;
        color?: string;
        applyColorToName: boolean;
        showIcon: boolean;
    } | null = null;
    if (settings.showParentFolder && parentFolderSource instanceof TFolder && !pinnedItemShouldUseCompactLayout) {
        // Show parent label in tag view or when viewing descendants
        const shouldShowParentLabel =
            selectionType === ItemType.TAG || (includeDescendantNotes && parentFolder && parentFolderSource.path !== parentFolder);

        if (shouldShowParentLabel && parentFolderSource.path !== '/') {
            // Use custom icon if set, otherwise use default folder icon
            const shouldShowParentFolderIcon = settings.showParentFolderIcon;
            const shouldShowParentFolderColor = settings.showParentFolderColor;
            const parentFolderDisplayData = metadataService.getFolderDisplayData(parentFolderSource.path, {
                includeDisplayName: true,
                includeColor: shouldShowParentFolderColor,
                includeBackgroundColor: false,
                includeIcon: shouldShowParentFolderIcon
            });
            const customParentIcon = shouldShowParentFolderIcon ? parentFolderDisplayData.icon : undefined;
            const fallbackParentIcon = 'lucide-folder-closed';

            const parentFolderColor = shouldShowParentFolderColor ? parentFolderDisplayData.color : undefined;
            const shouldApplyParentFolderColor = Boolean(parentFolderColor);
            parentFolderMeta = {
                name: parentFolderDisplayData.displayName || parentFolderSource.name,
                iconId: customParentIcon ?? fallbackParentIcon,
                color: shouldApplyParentFolderColor ? parentFolderColor : undefined,
                applyColorToName: shouldApplyParentFolderColor && !settings.colorIconOnly,
                showIcon: shouldShowParentFolderIcon
            };
        }
    }

    // Render parent folder label if metadata is available
    const renderParentFolder = () =>
        parentFolderMeta ? (
            <ParentFolderLabel
                iconId={parentFolderMeta.iconId}
                label={parentFolderMeta.name}
                iconVersion={iconServiceVersion}
                color={parentFolderMeta.color}
                showIcon={parentFolderMeta.showIcon}
                applyColorToName={parentFolderMeta.applyColorToName}
                onReveal={settings.parentFolderClickRevealsFile ? revealFileInNavigation : undefined}
            />
        ) : null;

    // Reset image hidden state when the feature image URL changes
    useEffect(() => {
        setIsFeatureImageHidden(false);
    }, [featureImageUrl]);

    const featureImageContainerClassName = useMemo(() => {
        const classes = ['nn-feature-image'];
        if (!featureImageUrl || settings.forceSquareFeatureImage) {
            classes.push('nn-feature-image--square');
        } else {
            classes.push('nn-feature-image--natural');
        }
        // Hide container if image failed to load
        if (isFeatureImageHidden) {
            classes.push('nn-feature-image--hidden');
        }
        return classes.join(' ');
    }, [featureImageUrl, settings.forceSquareFeatureImage, isFeatureImageHidden]);

    const featureImageStyle = useMemo(() => {
        if (!featureImageUrl || settings.forceSquareFeatureImage) {
            return undefined;
        }

        const aspectRatio = featureImageAspectRatio ?? 1;
        return {
            '--nn-feature-image-aspect-ratio': aspectRatio
        } as React.CSSProperties;
    }, [featureImageAspectRatio, featureImageUrl, settings.forceSquareFeatureImage]);

    const handleFeatureImageLoad = useCallback(() => {
        if (!featureImageUrl || settings.forceSquareFeatureImage) {
            return;
        }

        const image = featureImageImgRef.current;
        if (!image) {
            return;
        }

        const width = image.naturalWidth || image.width || 0;
        const height = image.naturalHeight || image.height || 0;

        if (width <= 0 || height <= 0) {
            setFeatureImageAspectRatio(null);
            return;
        }

        const ratio = width / height;
        const clampedRatio = Math.min(ratio, FEATURE_IMAGE_MAX_ASPECT_RATIO);
        setFeatureImageAspectRatio(clampedRatio);
    }, [featureImageUrl, settings.forceSquareFeatureImage]);

    // Memoize className to avoid string concatenation on every render
    const className = useMemo(() => {
        const classes = ['nn-file'];
        if (isSelected) classes.push('nn-selected');
        if (isCompactMode) classes.push('nn-compact');
        if (isSelected && hasSelectedAbove) classes.push('nn-has-selected-above');
        if (isSelected && hasSelectedBelow) classes.push('nn-has-selected-below');
        // Apply muted style when file is normally hidden but shown via "show hidden items"
        if (isHidden) classes.push('nn-hidden-file');
        return classes.join(' ');
    }, [isSelected, isCompactMode, hasSelectedAbove, hasSelectedBelow, isHidden]);

    // Screen reader description for files shown via "show hidden items" toggle
    const hiddenDescription = useMemo(() => {
        if (!isHidden) {
            return undefined;
        }
        return strings.listPane.hiddenItemAriaLabel.replace('{name}', displayName);
    }, [isHidden, displayName]);

    // Handle file changes and subscribe to content updates
    useEffect(() => {
        const {
            preview,
            tags: initialTags,
            featureImageKey: initialFeatureImageKey,
            featureImageStatus: initialFeatureImageStatus,
            properties: initialProperties,
            wordCount: initialWordCount,
            taskUnfinished: initialTaskUnfinished
        } = loadFileData();

        // Only update state if values actually changed to prevent unnecessary re-renders
        setPreviewText(prev => (prev === preview ? prev : preview));
        setTags(prev => (areStringArraysEqual(prev, initialTags) ? prev : initialTags));
        setFeatureImageKey(prev => (prev === initialFeatureImageKey ? prev : initialFeatureImageKey));
        setFeatureImageStatus(prev => (prev === initialFeatureImageStatus ? prev : initialFeatureImageStatus));
        setProperties(prev => (arePropertyItemsEqual(prev, initialProperties) ? prev : initialProperties));
        setWordCount(prev => (prev === initialWordCount ? prev : initialWordCount));
        setTaskUnfinished(prev => (prev === initialTaskUnfinished ? prev : initialTaskUnfinished));

        const db = getDB();
        const unsubscribe = db.onFileContentChange(file.path, (changes: FileContentChange['changes']) => {
            let shouldRefreshFrontmatterState = false;

            // Update preview text when it changes
            if (changes.preview !== undefined && appearanceSettings.showPreview && file.extension === 'md') {
                const nextPreview = changes.preview || '';
                setPreviewText(prev => (prev === nextPreview ? prev : nextPreview));
            }
            // Update feature image key when it changes
            if (changes.featureImageKey !== undefined) {
                setFeatureImageKey(prev => (prev === changes.featureImageKey ? prev : (changes.featureImageKey ?? null)));
            }
            if (changes.featureImageStatus !== undefined) {
                const nextStatus = changes.featureImageStatus;
                setFeatureImageStatus(prev => (prev === nextStatus ? prev : nextStatus));
            }
            // Update tags when they change
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
            // Update properties when they change
            if (changes.properties !== undefined) {
                const nextProperties = clonePropertyItems(changes.properties ?? null);
                setProperties(prev => (arePropertyItemsEqual(prev, nextProperties) ? prev : nextProperties));
                shouldRefreshFrontmatterState = true;
            }
            // Trigger metadata refresh when frontmatter changes
            if (changes.metadata !== undefined) {
                shouldRefreshFrontmatterState = true;
            }

            if (shouldRefreshFrontmatterState) {
                setMetadataVersion(v => v + 1);
            }
        });

        if (appearanceSettings.showPreview && file.extension === 'md') {
            void db.ensurePreviewTextLoaded(file.path);
        }

        return () => {
            unsubscribe();
        };
        // NOTE: include file.path because Obsidian reuses TFile instance on rename
    }, [file, file.path, appearanceSettings.showPreview, appearanceSettings.showImage, getDB, app, loadFileData]);

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

        // Clear any previous object URL before loading a new one.
        if (featureImageObjectUrlRef.current) {
            URL.revokeObjectURL(featureImageObjectUrlRef.current);
            featureImageObjectUrlRef.current = null;
        }

        if (!appearanceSettings.showImage) {
            // Hide feature images when the setting is disabled.
            setFeatureImageUrl(null);
            return () => {
                isActive = false;
            };
        }

        if (isImageFile(file)) {
            // Image files render directly from the vault resource path.
            try {
                const url = app.vault.getResourcePath(file);
                setFeatureImageUrl(url);
            } catch {
                setFeatureImageUrl(null);
            }
            return () => {
                isActive = false;
            };
        }

        if (featureImageStatus !== 'has') {
            // Skip blob fetch when no thumbnail blob is recorded.
            setFeatureImageUrl(null);
            return () => {
                isActive = false;
            };
        }

        if (!featureImageKey || featureImageKey === '') {
            // Skip blob fetch when no key is recorded.
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
            // Create an object URL for the blob and store it for cleanup.
            const url = URL.createObjectURL(blob);
            featureImageObjectUrlRef.current = url;
            setFeatureImageUrl(url);
        });

        return () => {
            isActive = false;
        };
    }, [appearanceSettings.showImage, app, featureImageKey, featureImageStatus, file, getDB, regenerateFeatureImageForFile]);

    useEffect(() => {
        if (!featureImageUrl || settings.forceSquareFeatureImage) {
            setFeatureImageAspectRatio(null);
            return;
        }

        setFeatureImageAspectRatio(null);
        // If the already-rendered image is cached and completes synchronously,
        // compute the aspect ratio immediately without forcing a second decode.
        const image = featureImageImgRef.current;
        if (image && image.complete) {
            const width = image.naturalWidth || image.width || 0;
            const height = image.naturalHeight || image.height || 0;
            if (width > 0 && height > 0) {
                const ratio = width / height;
                const clampedRatio = Math.min(ratio, FEATURE_IMAGE_MAX_ASPECT_RATIO);
                setFeatureImageAspectRatio(clampedRatio);
            }
        }
    }, [featureImageUrl, settings.forceSquareFeatureImage]);

    // Add Obsidian tooltip (desktop only)
    useEffect(() => {
        if (!fileRef.current) return;

        // Skip tooltips on mobile
        if (isMobile) return;

        // Remove tooltip if disabled
        if (!settings.showTooltips) {
            setTooltip(fileRef.current, '');
            return;
        }

        // Format dates for tooltip with time
        const dateTimeFormat = settings.timeFormat ? `${settings.dateFormat} ${settings.timeFormat}` : settings.dateFormat;
        const timestamps = getFileTimestamps(file);
        const createdDate = DateUtils.formatDate(timestamps.created, dateTimeFormat);
        const modifiedDate = DateUtils.formatDate(timestamps.modified, dateTimeFormat);

        // Check current sort to determine date order
        const isCreatedSort = sortOption ? sortOption.startsWith('created-') : false;

        // Build tooltip with filename and dates
        const datesTooltip = isCreatedSort
            ? `${strings.tooltips.createdAt} ${createdDate}\n${strings.tooltips.lastModifiedAt} ${modifiedDate}`
            : `${strings.tooltips.lastModifiedAt} ${modifiedDate}\n${strings.tooltips.createdAt} ${createdDate}`;

        // Always include a name at the top. When showing suffix, prefer the true filename (with extension)
        const topLine = extensionSuffix.length > 0 ? file.name : displayName;

        // Build tooltip content with multiple lines
        const tooltipLines = [topLine];

        // Include folder path in tooltip when enabled
        if (settings.showTooltipPath) {
            const parentPath = file.parent?.path ?? '/';
            tooltipLines.push(parentPath);
        }

        // Add empty line separator and date information
        tooltipLines.push('', datesTooltip);
        const tooltip = tooltipLines.join('\n');

        setTooltip(fileRef.current, tooltip, {
            placement: getTooltipPlacement()
        });
    }, [
        isMobile,
        file,
        file.stat.ctime,
        file.stat.mtime,
        settings,
        displayName,
        extensionSuffix,
        getFileTimestamps,
        sortOption,
        metadataVersion,
        file.name
    ]);

    // Reveals the file by selecting its folder in navigation pane and showing the file in list pane
    const revealFileInNavigation = () => {
        runAsyncAction(async () => {
            await plugin.activateView();
            await plugin.revealFileInActualFolder(file);
        });
    };

    // Quick action handlers - these don't need memoization because:
    // 1. They're only attached to DOM elements that appear on hover
    // 2. They're not passed as props to child components
    // 3. They don't cause re-renders when recreated
    const handleOpenInNewTab = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        runAsyncAction(() => openFileInContext({ app, commandQueue, file, context: 'tab' }));
    };

    // Toggle pin status for the file in the current context
    const handlePinClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        runAsyncAction(async () => {
            const context =
                selectionType === ItemType.TAG ? ItemType.TAG : selectionType === ItemType.PROPERTY ? ItemType.PROPERTY : ItemType.FOLDER;
            await metadataService.togglePin(file.path, context);
        });
    };

    const handleShortcutToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        runAsyncAction(async () => {
            const shortcutKey = noteShortcutKeysByPath.get(file.path);
            if (shortcutKey) {
                await removeShortcut(shortcutKey);
            } else {
                await addNoteShortcut(file.path);
            }
        });
    };

    // Reveal the file in its actual folder in the navigator
    const handleRevealClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        revealFileInNavigation();
    };

    const handleAddTagClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (!tagOperations) {
            return;
        }

        openAddTagToFilesModal({
            app,
            plugin,
            tagOperations,
            files: [file]
        });
    };

    // Handle middle mouse button click to open in new tab
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 1) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        runAsyncAction(() => openFileInContext({ app, commandQueue, file, context: 'tab' }));
    };

    const quickActionItems: { key: string; element: React.ReactNode }[] = [];

    if (shouldShowRevealIcon) {
        quickActionItems.push({
            key: 'reveal',
            element: (
                <div
                    ref={revealInFolderIconRef}
                    className="nn-quick-action-item"
                    onClick={handleRevealClick}
                    title={strings.contextMenu.file.revealInFolder}
                />
            )
        });
    }

    if (shouldShowAddTagAction) {
        quickActionItems.push({
            key: 'add-tag',
            element: (
                <div
                    ref={addTagIconRef}
                    className="nn-quick-action-item"
                    onClick={handleAddTagClick}
                    title={strings.contextMenu.file.addTag}
                />
            )
        });
    }

    if (shouldShowShortcutAction) {
        quickActionItems.push({
            key: 'shortcut',
            element: (
                <div
                    ref={addShortcutIconRef}
                    className="nn-quick-action-item"
                    onClick={handleShortcutToggle}
                    title={hasShortcut ? strings.shortcuts.remove : strings.shortcuts.add}
                />
            )
        });
    }

    if (shouldShowPinNote) {
        quickActionItems.push({
            key: 'pin',
            element: (
                <div
                    ref={pinNoteIconRef}
                    className="nn-quick-action-item"
                    onClick={handlePinClick}
                    title={
                        isPinned
                            ? file.extension === 'md'
                                ? strings.contextMenu.file.unpinNote
                                : strings.contextMenu.file.unpinFile
                            : file.extension === 'md'
                              ? strings.contextMenu.file.pinNote
                              : strings.contextMenu.file.pinFile
                    }
                />
            )
        });
    }

    if (shouldShowOpenInNewTab) {
        quickActionItems.push({
            key: 'new-tab',
            element: (
                <div
                    ref={openInNewTabIconRef}
                    className="nn-quick-action-item"
                    onClick={handleOpenInNewTab}
                    title={strings.contextMenu.file.openInNewTab}
                />
            )
        });
    }

    // === Effects ===

    // Renders the file icon in the DOM using the icon service
    useEffect(() => {
        const iconContainer = fileIconRef.current;
        if (!iconContainer) {
            return;
        }

        iconContainer.innerHTML = '';
        if (!shouldShowFileIcon) {
            return;
        }

        const iconId = effectiveFileIconId;
        if (!iconId) {
            return;
        }
        const iconService = getIconService();
        iconService.renderIcon(iconContainer, iconId, fileIconSize);
    }, [effectiveFileIconId, iconServiceVersion, shouldShowFileIcon, isCompactMode, fileIconSize]);

    // Set up the icons when quick actions panel is shown
    useEffect(() => {
        if (isHovered && !isMobile) {
            if (revealInFolderIconRef.current && shouldShowRevealIcon) {
                setIcon(revealInFolderIconRef.current, 'lucide-folder-search');
            }
            if (addTagIconRef.current && shouldShowAddTagAction) {
                setIcon(addTagIconRef.current, 'lucide-tag');
            }
            if (addShortcutIconRef.current && shouldShowShortcutAction) {
                setIcon(addShortcutIconRef.current, hasShortcut ? 'lucide-star-off' : 'lucide-star');
            }
            if (pinNoteIconRef.current && shouldShowPinNote) {
                setIcon(pinNoteIconRef.current, isPinned ? 'lucide-pin-off' : 'lucide-pin');
            }
            if (openInNewTabIconRef.current && shouldShowOpenInNewTab) {
                setIcon(openInNewTabIconRef.current, 'lucide-file-plus');
            }
        }
    }, [
        isHovered,
        isMobile,
        shouldShowOpenInNewTab,
        shouldShowPinNote,
        shouldShowRevealIcon,
        shouldShowAddTagAction,
        shouldShowShortcutAction,
        hasShortcut,
        isPinned
    ]);

    // Enable context menu
    useContextMenu(fileRef, { type: ItemType.FILE, item: file });

    // Wrap onFileClick to pass file and fileIndex
    const handleItemClick = useCallback(
        (event: React.MouseEvent) => {
            onFileClick(file, fileIndex, event);
        },
        [file, fileIndex, onFileClick]
    );

    return (
        <div
            ref={fileRef}
            className={className}
            data-path={file.path}
            // Path to use when this file is dragged
            data-drag-path={file.path}
            // Type of item being dragged (folder, file, or tag)
            data-drag-type="file"
            // Marks element as draggable for event delegation
            data-draggable={!isMobile ? 'true' : undefined}
            // Icon to display in drag ghost
            data-drag-icon={dragIconId}
            // Icon color to display in drag ghost
            data-drag-icon-color={dragIconColor}
            onClick={handleItemClick}
            onMouseDown={handleMouseDown}
            draggable={!isMobile}
            role="listitem"
            onMouseEnter={() => !isMobile && setIsHovered(true)}
            onMouseLeave={() => !isMobile && setIsHovered(false)}
            aria-describedby={hiddenDescription ? hiddenDescriptionId : undefined}
        >
            <div className="nn-file-content">
                {/* Quick actions panel - appears on hover */}
                {isHovered && !isMobile && hasQuickActions && (
                    <div
                        className={`nn-quick-actions-panel ${isCompactMode ? 'nn-compact-mode' : ''}`}
                        data-title-rows={appearanceSettings.titleRows}
                        data-has-tags={shouldShowFileTags ? 'true' : 'false'}
                    >
                        {quickActionItems.map((action, index) => (
                            <React.Fragment key={action.key}>
                                {index > 0 && <div className="nn-quick-action-separator" />}
                                {action.element}
                            </React.Fragment>
                        ))}
                    </div>
                )}
                <div className="nn-file-inner-content">
                    {showFileIcons ? (
                        <div className="nn-file-icon-slot">
                            {shouldShowFileIcon ? (
                                <span
                                    ref={fileIconRef}
                                    className={fileIconClassName}
                                    data-has-color={fileIconHasColor ? 'true' : 'false'}
                                    style={fileIconStyle}
                                />
                            ) : null}
                        </div>
                    ) : null}
                    {isCompactMode ? (
                        // ========== COMPACT MODE ==========
                        // Minimal layout: file name + pills
                        // Used when date, preview, and image are all disabled
                        <div className="nn-compact-file-text-content">
                            <div className="nn-compact-file-header">
                                {fileTitleElement}
                                {shouldShowCompactExtensionBadge ? (
                                    <div className="nn-compact-extension-badge" aria-hidden="true">
                                        <div className="nn-file-icon-rectangle">
                                            <span className="nn-file-icon-rectangle-text">{fileExtension}</span>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                            {renderPillRows()}
                        </div>
                    ) : (
                        // ========== NORMAL MODE ==========
                        // Full layout with all enabled elements
                        <>
                            <div className="nn-file-text-content">
                                {fileTitleElement}

                                {/* ========== SINGLE LINE MODE ========== */}
                                {/* Conditions: pinnedItemShouldUseCompactLayout OR previewRows < 2 */}
                                {/* Layout: Date+Preview share one line, pills below, parent folder last */}
                                {shouldUseSingleLineForDateAndPreview && (
                                    <>
                                        {/* Date + Preview on same line */}
                                        {shouldShowSingleLineSecondLine ? (
                                            <div className="nn-file-second-line">
                                                {shouldShowDateForItem && <div className="nn-file-date">{displayDate}</div>}
                                                {settings.showFilePreview && !shouldSuppressEmptyPreviewLines && (
                                                    <div className="nn-file-preview" style={{ '--preview-rows': 1 } as React.CSSProperties}>
                                                        {highlightedPreview}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}

                                        {/* Pills */}
                                        {renderPillRows()}

                                        {/* Parent folder - gets its own line */}
                                        {renderParentFolder()}
                                    </>
                                )}

                                {/* ========== MULTI-LINE MODE ========== */}
                                {/* Conditions: !pinnedItemShouldUseCompactLayout AND previewRows >= 2 */}
                                {/* Two sub-cases based on preview content and optimization settings */}
                                {shouldUseMultiLinePreviewLayout && (
                                    <>
                                        {/* CASE 1: COLLAPSED EMPTY PREVIEW */}
                                        {/* Conditions: heightOptimizationEnabled AND !hasPreviewContent */}
                                        {/* Layout: Pills, then Date+Parent on same line (compact) */}
                                        {shouldCollapseEmptyPreviewSpace && (
                                            <>
                                                {/* Pills (show even when no preview text) */}
                                                {renderPillRows()}
                                                {/* Date + Parent folder share the second line (compact layout) */}
                                                <div className="nn-file-second-line">
                                                    {shouldShowDateForItem && <div className="nn-file-date">{displayDate}</div>}
                                                    {renderParentFolder()}
                                                </div>
                                            </>
                                        )}

                                        {/* CASE 2: ALWAYS RESERVE PREVIEW SPACE */}
                                        {/* Conditions: heightOptimizationDisabled OR hasPreviewContent */}
                                        {/* Layout: Full preview rows, tags, then Date+Parent on same line */}
                                        {shouldAlwaysReservePreviewSpace && (
                                            <>
                                                {/* Multi-row preview - show preview text spanning multiple rows */}
                                                {settings.showFilePreview && !shouldSuppressEmptyPreviewLines && (
                                                    <div
                                                        className="nn-file-preview"
                                                        style={{ '--preview-rows': appearanceSettings.previewRows } as React.CSSProperties}
                                                    >
                                                        {highlightedPreview}
                                                    </div>
                                                )}

                                                {/* Pills */}
                                                {renderPillRows()}

                                                {/* Date + Parent folder share the metadata line */}
                                                <div className="nn-file-second-line">
                                                    {shouldShowDateForItem && <div className="nn-file-date">{displayDate}</div>}
                                                    {renderParentFolder()}
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                            {/* ========== FEATURE IMAGE AREA ========== */}
                            {/* Shows either actual image or extension badge for non-markdown files */}
                            {showFeatureImageArea && (
                                <div className={featureImageContainerClassName} style={featureImageStyle}>
                                    {featureImageUrl ? (
                                        <img
                                            src={featureImageUrl}
                                            alt={strings.common.featureImageAlt}
                                            className="nn-feature-image-img"
                                            ref={featureImageImgRef}
                                            draggable={false}
                                            onDragStart={e => e.preventDefault()}
                                            onLoad={handleFeatureImageLoad}
                                            // Hide the image container when image fails to load
                                            onError={() => {
                                                setIsFeatureImageHidden(true);
                                            }}
                                        />
                                    ) : file.extension === 'canvas' || file.extension === 'base' ? (
                                        <div className="nn-file-extension-badge">
                                            <span className="nn-file-extension-text">{file.extension}</span>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            {/* Screen reader announcement for hidden files */}
            {hiddenDescription ? (
                <span id={hiddenDescriptionId} className="nn-visually-hidden">
                    {hiddenDescription}
                </span>
            ) : null}
        </div>
    );
});
