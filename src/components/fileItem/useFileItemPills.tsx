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

import React, { useCallback, useMemo } from 'react';
import type { TFile } from 'obsidian';
import { useMetadataService, useServices } from '../../context/ServicesContext';
import { useSelectionState } from '../../context/SelectionContext';
import { useTagNavigation } from '../../hooks/useTagNavigation';
import type { PropertyItem } from '../../storage/IndexedDBStorage';
import type { NotePropertyType, NotebookNavigatorSettings } from '../../settings/types';
import { ItemType } from '../../types';
import { runAsyncAction } from '../../utils/async';
import { naturalCompare } from '../../utils/sortUtils';
import { getTagSearchModifierOperator, normalizeTagPath } from '../../utils/tagUtils';
import { isSupportedCssColor, parsePropertyLinkTarget, type PropertyLinkTarget } from '../../utils/propertyUtils';
import { casefold } from '../../utils/recordUtils';
import { resolveUXIcon } from '../../utils/uxIcons';
import type { InclusionOperator } from '../../utils/filterSearch';
import {
    buildPropertyKeyNodeId,
    buildPropertyValueNodeId,
    getPropertyKeyNodeIdFromNodeId,
    isPropertyKeyOnlyValuePath,
    normalizePropertyNodeId,
    parsePropertyNodeId,
    normalizePropertyTreeValuePath
} from '../../utils/propertyTree';
import type { HiddenTagVisibility } from '../../utils/tagPrefixMatcher';
import {
    resolveFileItemPropertyDecorationColors,
    resolveFileItemTagDecorationColors,
    type FileItemPillDecorationModel
} from '../../utils/fileItemPillDecoration';
import { ServiceIcon } from '../ServiceIcon';

type PropertyPill = {
    value: string;
    label: string;
    linkTarget: PropertyLinkTarget | null;
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

export interface UseFileItemPillsParams {
    file: TFile;
    isCompactMode: boolean;
    tags: string[];
    properties: PropertyItem[] | null;
    wordCount: number | null;
    notePropertyType: NotePropertyType;
    settings: NotebookNavigatorSettings;
    visiblePropertyKeys: ReadonlySet<string>;
    visibleNavigationPropertyKeys: ReadonlySet<string>;
    hiddenTagVisibility: HiddenTagVisibility;
    onModifySearchWithTag?: (tag: string, operator: InclusionOperator) => void;
    onModifySearchWithProperty?: (key: string, value: string | null, operator: InclusionOperator) => void;
    fileItemPillDecorationModel: FileItemPillDecorationModel;
}

export interface FileItemPillsState {
    shouldShowFileTags: boolean;
    shouldShowProperty: boolean;
    shouldShowWordCountProperty: boolean;
    hasVisiblePillRows: boolean;
    pillRows: React.ReactNode;
}

const EMPTY_COLOR_MAP = new Map<string, { color?: string; background?: string }>();
const EXTERNAL_PROPERTY_LINK_ICON_ID = 'external-link';

function sortTagsAlphabetically(tags: string[]): void {
    tags.sort((firstTag, secondTag) => naturalCompare(firstTag, secondTag));
}

function sortPropertyPillsAlphabetically(pills: PropertyPill[]): void {
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
}

function sortPropertyPillGroup(pills: readonly PropertyPill[], prioritizeColoredPills: boolean): PropertyPill[] {
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
}

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

export function useFileItemPills({
    file,
    isCompactMode,
    tags,
    properties,
    wordCount,
    notePropertyType,
    settings,
    visiblePropertyKeys,
    visibleNavigationPropertyKeys,
    hiddenTagVisibility,
    onModifySearchWithTag,
    onModifySearchWithProperty,
    fileItemPillDecorationModel
}: UseFileItemPillsParams): FileItemPillsState {
    const { app, isMobile } = useServices();
    const metadataService = useMetadataService();
    const selectionState = useSelectionState();
    const { navigateToTag, navigateToProperty } = useTagNavigation();
    const wordCountPillIconId = useMemo(() => resolveUXIcon(settings.interfaceIcons, 'file-word-count'), [settings.interfaceIcons]);
    const selectedTagToHide = useMemo(() => {
        if (settings.showSelectedNavigationPills) {
            return null;
        }

        if (selectionState.selectionType !== ItemType.TAG) {
            return null;
        }

        return normalizeTagPath(selectionState.selectedTag);
    }, [selectionState.selectedTag, selectionState.selectionType, settings.showSelectedNavigationPills]);
    const selectedPropertyValueNodeIdToHide = useMemo(() => {
        if (settings.showSelectedNavigationPills) {
            return null;
        }

        if (selectionState.selectionType !== ItemType.PROPERTY || !selectionState.selectedProperty) {
            return null;
        }

        const parsedNode = parsePropertyNodeId(selectionState.selectedProperty);
        if (!parsedNode?.valuePath) {
            return null;
        }

        return normalizePropertyNodeId(selectionState.selectedProperty) ?? selectionState.selectedProperty;
    }, [selectionState.selectedProperty, selectionState.selectionType, settings.showSelectedNavigationPills]);

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
        [isMobile, navigateToTag, onModifySearchWithTag, settings.multiSelectModifier]
    );

    const handlePropertyClick = useCallback(
        (event: React.MouseEvent, pill: PropertyPill) => {
            const propertyNodeId = pill.propertyNodeId;
            const propertySearchKey = pill.propertySearchKey;
            const canNavigateToProperty = pill.canNavigateToProperty === true;
            event.stopPropagation();

            if (pill.linkTarget?.kind === 'unsupported') {
                return;
            }

            if (canNavigateToProperty && onModifySearchWithProperty && propertySearchKey) {
                const operator = getTagSearchModifierOperator(event, settings.multiSelectModifier, isMobile);
                if (operator) {
                    event.preventDefault();
                    onModifySearchWithProperty(propertySearchKey, pill.propertySearchValuePath ?? null, operator);
                    return;
                }
            }

            const linkTarget = pill.linkTarget;
            if (linkTarget?.kind === 'internal' && settings.enablePropertyInternalLinks) {
                event.preventDefault();
                runAsyncAction(() => app.workspace.openLinkText(linkTarget.target, file.path, false));
                return;
            }

            if (linkTarget?.kind === 'external' && settings.enablePropertyExternalLinks) {
                event.preventDefault();
                window.open(linkTarget.target);
                return;
            }

            if (!canNavigateToProperty || !propertyNodeId || !propertySearchKey) {
                return;
            }

            navigateToProperty(propertyNodeId, { preserveNavigationFocus: false });
        },
        [
            app.workspace,
            file.path,
            isMobile,
            navigateToProperty,
            onModifySearchWithProperty,
            settings.enablePropertyExternalLinks,
            settings.enablePropertyInternalLinks,
            settings.multiSelectModifier
        ]
    );

    const getTagColorData = useCallback(
        (tag: string): { color?: string; background?: string } => {
            return metadataService.getTagColorData(tag);
        },
        [metadataService]
    );

    const visibleTags = useMemo(() => {
        if (tags.length === 0) {
            return tags;
        }

        if (!hiddenTagVisibility.shouldFilterHiddenTags && !selectedTagToHide) {
            return tags;
        }

        return tags.filter(tag => {
            if (hiddenTagVisibility.shouldFilterHiddenTags && !hiddenTagVisibility.isTagVisible(tag)) {
                return false;
            }

            if (!selectedTagToHide) {
                return true;
            }

            return normalizeTagPath(tag) !== selectedTagToHide;
        });
    }, [hiddenTagVisibility, selectedTagToHide, tags]);

    const tagColorData = useMemo(() => {
        void settings.tagColors;
        void settings.tagBackgroundColors;
        void settings.inheritTagColors;

        if (!settings.colorFileTags || visibleTags.length === 0) {
            return EMPTY_COLOR_MAP;
        }

        const entries = new Map<string, { color?: string; background?: string }>();
        visibleTags.forEach(tag => {
            const tagColorData = getTagColorData(tag);
            const resolved = resolveFileItemTagDecorationColors({
                model: fileItemPillDecorationModel,
                tagPath: tag,
                color: tagColorData.color,
                backgroundColor: tagColorData.background
            });
            if (resolved.color || resolved.backgroundColor) {
                entries.set(tag, {
                    color: resolved.color,
                    background: resolved.backgroundColor
                });
            }
        });

        return entries;
    }, [
        fileItemPillDecorationModel,
        getTagColorData,
        settings.colorFileTags,
        settings.inheritTagColors,
        settings.tagBackgroundColors,
        settings.tagColors,
        visibleTags
    ]);

    const categorizedTags = useMemo(() => {
        if (visibleTags.length === 0) {
            return visibleTags;
        }

        if (!settings.prioritizeColoredFileTags || !settings.colorFileTags) {
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
    }, [settings.colorFileTags, settings.prioritizeColoredFileTags, tagColorData, visibleTags]);

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

        return properties.filter(entry => {
            const normalizedFieldKey = casefold(entry.fieldKey);
            if (!visiblePropertyKeys.has(normalizedFieldKey)) {
                return false;
            }

            if (entry.valueKind === undefined) {
                const normalizedValuePath = normalizePropertyTreeValuePath(entry.value);
                return !isPropertyKeyOnlyValuePath(normalizedValuePath, entry.valueKind);
            }

            return true;
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

            const normalizedValuePath = normalizePropertyTreeValuePath(rawValue);
            const isKeyOnlyValue = entry.valueKind === 'boolean' ? false : isPropertyKeyOnlyValuePath(normalizedValuePath, entry.valueKind);
            const rawPropertyNodeId = isKeyOnlyValue
                ? buildPropertyKeyNodeId(entry.fieldKey)
                : buildPropertyValueNodeId(entry.fieldKey, normalizedValuePath);
            const valueNodeId = normalizePropertyNodeId(rawPropertyNodeId) ?? rawPropertyNodeId;
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
        settings.colorFileProperties,
        settings.inheritPropertyColors,
        settings.propertyBackgroundColors,
        settings.propertyColors,
        settings.showFileProperties,
        visibleProperties
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
        if (!canShowPropertyPills || notePropertyType !== 'wordCount') {
            return null;
        }

        if (typeof wordCount !== 'number' || !Number.isFinite(wordCount) || wordCount <= 0) {
            return null;
        }

        const truncatedWordCount = Math.trunc(wordCount);
        return {
            value: truncatedWordCount.toString(),
            label: truncatedWordCount.toLocaleString(),
            linkTarget: null,
            iconId: wordCountPillIconId
        };
    }, [canShowPropertyPills, notePropertyType, wordCount, wordCountPillIconId]);

    const propertyPills = useMemo<PropertyPill[]>(() => {
        void propertyColorSignature;

        const pills: PropertyPill[] = [];
        const frontmatterPills: PropertyPill[] = [];

        if (!canShowPropertyPills || !settings.showFileProperties || !visibleProperties || visibleProperties.length === 0) {
            return pills;
        }

        const colorLookupCache = new Map<string, { color?: string; background?: string }>();
        for (const entry of visibleProperties) {
            const rawValue = entry.value;
            if (rawValue.trim().length === 0) {
                continue;
            }

            const trimmedFieldKey = entry.fieldKey.trim();
            const normalizedValuePath = normalizePropertyTreeValuePath(rawValue);
            const isKeyOnlyValue = entry.valueKind === 'boolean' ? false : isPropertyKeyOnlyValuePath(normalizedValuePath, entry.valueKind);
            const linkTarget = isKeyOnlyValue ? null : parsePropertyLinkTarget(rawValue);
            const label = linkTarget ? linkTarget.displayText : rawValue;
            const propertyNodeId = (() => {
                if (!trimmedFieldKey) {
                    return undefined;
                }

                const rawPropertyNodeId = isKeyOnlyValue
                    ? buildPropertyKeyNodeId(trimmedFieldKey)
                    : buildPropertyValueNodeId(trimmedFieldKey, normalizedValuePath);
                return normalizePropertyNodeId(rawPropertyNodeId) ?? rawPropertyNodeId;
            })();

            const cacheKey = propertyNodeId ?? `${entry.fieldKey}\u0000${rawValue}`;
            let colorData = colorLookupCache.get(cacheKey);
            if (!colorData) {
                if (settings.colorFileProperties && propertyNodeId) {
                    const baseColorData = metadataService.getPropertyColorData(propertyNodeId);
                    const resolved = resolveFileItemPropertyDecorationColors({
                        model: fileItemPillDecorationModel,
                        nodeId: propertyNodeId,
                        color: baseColorData.color,
                        backgroundColor: baseColorData.background
                    });
                    colorData = {
                        color: resolved.color,
                        background: resolved.backgroundColor
                    };
                } else {
                    colorData = {};
                }
                colorLookupCache.set(cacheKey, colorData);
            }

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

            if (selectedPropertyValueNodeIdToHide && propertyNodeId === selectedPropertyValueNodeIdToHide) {
                continue;
            }

            frontmatterPills.push({
                value: rawValue,
                label,
                linkTarget,
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

        const prioritizeColoredPills = settings.prioritizeColoredFileProperties && settings.colorFileProperties;
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
        fileItemPillDecorationModel,
        metadataService,
        propertyColorSignature,
        settings.colorFileProperties,
        settings.prioritizeColoredFileProperties,
        settings.showFileProperties,
        selectedPropertyValueNodeIdToHide,
        visibleNavigationPropertyKeys,
        visibleProperties
    ]);

    const propertyColorData = useMemo(() => {
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
        if (!settings.tagIcons || !hasOwnRecordEntries(settings.tagIcons) || categorizedTags.length === 0) {
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
        const resolvePropertyPillIconId = (pill: PropertyPill): string | undefined => {
            if (pill.linkTarget?.kind === 'external' && settings.enablePropertyExternalLinks) {
                return EXTERNAL_PROPERTY_LINK_ICON_ID;
            }

            if (pill.iconId) {
                return pill.iconId;
            }

            if (!settings.propertyIcons || !hasOwnRecordEntries(settings.propertyIcons)) {
                return undefined;
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
            if (!fallbackKeyNodeId || checkedKeyNodeId === fallbackKeyNodeId) {
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
    }, [metadataService, propertyPills, settings.enablePropertyExternalLinks, settings.propertyIcons, wordCountPropertyPill]);

    const renderPropertyPill = useCallback(
        (pill: PropertyPill, index: number) => {
            const isUnsupportedMarkdownLink = pill.linkTarget?.kind === 'unsupported';
            const canNavigateToProperty = pill.canNavigateToProperty === true && !isUnsupportedMarkdownLink;
            const isPropertyLink =
                (pill.linkTarget?.kind === 'internal' && settings.enablePropertyInternalLinks) ||
                (pill.linkTarget?.kind === 'external' && settings.enablePropertyExternalLinks);
            const isClickable = canNavigateToProperty || isPropertyLink;
            const className = [
                'nn-file-tag',
                'nn-file-property',
                isClickable ? 'nn-clickable-tag' : '',
                isPropertyLink ? 'nn-file-property-link' : ''
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
        [
            handlePropertyClick,
            propertyColorData,
            propertyPillIcons,
            settings.enablePropertyExternalLinks,
            settings.enablePropertyInternalLinks
        ]
    );

    const tagRows = useMemo(() => {
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
                            onClick={event => handleTagClick(event, tag)}
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

    const propertyRowsNode = useMemo(() => {
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

    const wordCountRow = useMemo(() => {
        if (!shouldShowWordCountProperty || !wordCountPropertyPill) {
            return null;
        }

        return <div className="nn-file-property-row">{renderPropertyPill(wordCountPropertyPill, 0)}</div>;
    }, [renderPropertyPill, shouldShowWordCountProperty, wordCountPropertyPill]);

    const pillRows = useMemo(() => {
        return (
            <>
                {tagRows}
                {propertyRowsNode}
                {wordCountRow}
            </>
        );
    }, [propertyRowsNode, tagRows, wordCountRow]);

    return {
        shouldShowFileTags,
        shouldShowProperty,
        shouldShowWordCountProperty,
        hasVisiblePillRows: shouldShowFileTags || shouldShowProperty || shouldShowWordCountProperty,
        pillRows
    };
}
