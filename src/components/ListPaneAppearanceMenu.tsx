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

import { Menu, TFolder } from 'obsidian';
import { strings } from '../i18n';
import { FolderAppearance, getDefaultListMode, resolveListMode } from '../hooks/useListPaneAppearance';
import type { NotePropertyType, ListDisplayMode, ListNoteGroupingOption } from '../settings/types';
import { NotebookNavigatorSettings } from '../settings';
import { ItemType } from '../types';
import { resolveListGrouping } from '../utils/listGrouping';
import { runAsyncAction } from '../utils/async';
import { ensureRecord, sanitizeRecord } from '../utils/recordUtils';
import { resolveUXIconForMenu } from '../utils/uxIcons';
import type { PropertySelectionNodeId } from '../utils/propertyTree';

interface AppearanceMenuProps {
    event: MouseEvent;
    settings: NotebookNavigatorSettings;
    selectedFolder: TFolder | null;
    selectedTag?: string | null;
    selectedProperty?: PropertySelectionNodeId | null;
    selectionType?: ItemType;
    updateSettings: (updater: (settings: NotebookNavigatorSettings) => void) => Promise<void>;
    descendantAction?: {
        menuTitle: string;
        onApply: () => void;
        disabled?: boolean;
    };
}

interface AppearanceRecordAccessor {
    key: string;
    getRecord: (settings: NotebookNavigatorSettings) => Record<string, FolderAppearance> | undefined;
    setRecord: (settings: NotebookNavigatorSettings, next: Record<string, FolderAppearance>) => void;
}

export function showListPaneAppearanceMenu({
    event,
    settings,
    selectedFolder,
    selectedTag,
    selectedProperty,
    selectionType,
    updateSettings,
    descendantAction
}: AppearanceMenuProps) {
    const defaultMode: ListDisplayMode = getDefaultListMode(settings);
    const resolveAppearanceAccessor = (): AppearanceRecordAccessor | null => {
        if (selectionType === ItemType.TAG && selectedTag) {
            return {
                key: selectedTag,
                getRecord: targetSettings => targetSettings.tagAppearances,
                setRecord: (targetSettings, next) => {
                    targetSettings.tagAppearances = next;
                }
            };
        }
        if (selectionType === ItemType.FOLDER && selectedFolder) {
            return {
                key: selectedFolder.path,
                getRecord: targetSettings => targetSettings.folderAppearances,
                setRecord: (targetSettings, next) => {
                    targetSettings.folderAppearances = next;
                }
            };
        }
        if (selectionType === ItemType.PROPERTY && selectedProperty) {
            return {
                key: selectedProperty,
                getRecord: targetSettings => targetSettings.propertyAppearances,
                setRecord: (targetSettings, next) => {
                    targetSettings.propertyAppearances = next;
                }
            };
        }
        return null;
    };
    const appearanceAccessor = resolveAppearanceAccessor();

    const updateAppearance = (updates: Partial<FolderAppearance>) => {
        const normalizeAppearance = (appearance: FolderAppearance) => {
            const normalized = { ...appearance };
            (Object.keys(normalized) as (keyof FolderAppearance)[]).forEach(key => {
                if (normalized[key] === undefined) {
                    delete normalized[key];
                }
            });
            if (normalized.mode === defaultMode) {
                delete normalized.mode;
            }
            return normalized;
        };

        if (!appearanceAccessor) {
            return;
        }

        runAsyncAction(() =>
            updateSettings(s => {
                const next = sanitizeRecord(ensureRecord(appearanceAccessor.getRecord(s)));
                const currentAppearance = next[appearanceAccessor.key] || {};
                const normalizedAppearance = normalizeAppearance({ ...currentAppearance, ...updates });
                if (Object.keys(normalizedAppearance).length === 0) {
                    delete next[appearanceAccessor.key];
                } else {
                    next[appearanceAccessor.key] = normalizedAppearance;
                }

                appearanceAccessor.setRecord(s, next);
            })
        );
    };

    const menu = new Menu();

    // Get custom appearance settings for the selected folder/tag
    // Will be undefined if no custom appearance has been set
    const appearance = appearanceAccessor ? appearanceAccessor.getRecord(settings)?.[appearanceAccessor.key] : undefined;
    const effectiveMode = resolveListMode({ appearance, defaultMode });

    // Resolve grouping settings to detect custom overrides for this folder/tag
    const groupingInfo = resolveListGrouping({
        settings,
        selectionType,
        folderPath: selectedFolder ? selectedFolder.path : null,
        tag: selectedTag ?? null,
        propertyNodeId: selectedProperty ?? null
    });
    const hasCustomGroupBy = groupingInfo.hasCustomOverride;

    const isStandard = effectiveMode === 'standard';
    const isCompact = effectiveMode === 'compact';

    // Standard preset
    menu.addItem(item => {
        const label =
            defaultMode === 'standard'
                ? `${strings.folderAppearance.standardPreset} ${strings.folderAppearance.defaultSuffix}`
                : strings.folderAppearance.standardPreset;
        item.setTitle(label)
            .setChecked(isStandard)
            .onClick(() => {
                updateAppearance({ mode: 'standard' });
            });
    });

    // Compact preset
    menu.addItem(item => {
        const label =
            defaultMode === 'compact'
                ? `${strings.folderAppearance.compactPreset} ${strings.folderAppearance.defaultSuffix}`
                : strings.folderAppearance.compactPreset;
        item.setTitle(label)
            .setChecked(isCompact)
            .onClick(() => {
                updateAppearance({ mode: 'compact', previewRows: undefined });
            });
    });

    menu.addSeparator();

    // Title rows header
    menu.addItem(item => {
        item.setTitle(strings.folderAppearance.titleRows).setIcon('lucide-text').setDisabled(true);
    });

    // Default title rows option
    menu.addItem(item => {
        const hasCustomTitleRows = appearance?.titleRows !== undefined;
        const isDefaultTitle = !hasCustomTitleRows;
        item.setTitle(`    ${strings.folderAppearance.defaultTitleOption(settings.fileNameRows)}`)
            .setChecked(isDefaultTitle)
            .onClick(() => {
                updateAppearance({ titleRows: undefined });
            });
    });

    // Title row options
    [1, 2, 3].forEach(rows => {
        menu.addItem(item => {
            const isChecked = appearance?.titleRows === rows;
            item.setTitle(`    ${strings.folderAppearance.titleRowOption(rows)}`)
                .setChecked(isChecked)
                .onClick(() => {
                    updateAppearance({ titleRows: rows });
                });
        });
    });

    if (settings.showFilePreview && !isCompact) {
        menu.addSeparator();

        // Preview rows header
        menu.addItem(item => {
            item.setTitle(strings.folderAppearance.previewRows).setIcon('lucide-file-text').setDisabled(true);
        });

        // Default preview rows option
        menu.addItem(item => {
            const hasCustomPreviewRows = appearance?.previewRows !== undefined;
            const isDefaultPreview = !hasCustomPreviewRows;
            item.setTitle(`    ${strings.folderAppearance.defaultPreviewOption(settings.previewRows)}`)
                .setChecked(isDefaultPreview)
                .onClick(() => {
                    updateAppearance({ previewRows: undefined });
                });
        });

        // Preview row options
        [1, 2, 3, 4, 5].forEach(rows => {
            menu.addItem(item => {
                const hasCustomPreviewRows = appearance?.previewRows !== undefined;
                const isChecked = hasCustomPreviewRows && appearance?.previewRows === rows;
                item.setTitle(`    ${strings.folderAppearance.previewRowOption(rows)}`)
                    .setChecked(isChecked)
                    .onClick(() => {
                        updateAppearance({ previewRows: rows });
                    });
            });
        });
    }

    const isFolderSelection = selectionType === ItemType.FOLDER && Boolean(selectedFolder);
    const isTagSelection = selectionType === ItemType.TAG && Boolean(selectedTag);
    const isPropertySelection = selectionType === ItemType.PROPERTY && Boolean(selectedProperty);

    // Add groupBy menu section for folders, tags, and properties
    if (isFolderSelection || isTagSelection || isPropertySelection) {
        const getNotePropertyTypeLabel = (type: NotePropertyType): string => {
            switch (type) {
                case 'wordCount':
                    return strings.settings.items.notePropertyType.options.wordCount;
                case 'none':
                default:
                    return strings.settings.items.notePropertyType.options.none;
            }
        };

        menu.addSeparator();

        // Note property header
        menu.addItem(item => {
            item.setTitle(strings.settings.items.notePropertyType.name)
                .setIcon(resolveUXIconForMenu(settings.interfaceIcons, 'file-word-count', 'lucide-sigma'))
                .setDisabled(true);
        });

        // Default note property option (clears custom override)
        const defaultNotePropertyLabel = getNotePropertyTypeLabel(settings.notePropertyType);
        const currentNotePropertyType = appearance?.notePropertyType;
        const hasNotePropertyType = currentNotePropertyType !== undefined;
        menu.addItem(item => {
            item.setTitle(`    ${strings.folderAppearance.defaultLabel} (${defaultNotePropertyLabel})`)
                .setChecked(!hasNotePropertyType)
                .onClick(() => {
                    updateAppearance({ notePropertyType: undefined });
                });
        });

        // Note property options
        const notePropertyOptions: NotePropertyType[] = ['none', 'wordCount'];
        notePropertyOptions.forEach(option => {
            menu.addItem(item => {
                const isChecked = hasNotePropertyType && currentNotePropertyType === option;
                const label = getNotePropertyTypeLabel(option);
                item.setTitle(`    ${label}`)
                    .setChecked(isChecked)
                    .onClick(() => {
                        updateAppearance({ notePropertyType: option });
                    });
            });
        });

        menu.addSeparator();

        // Group by header
        menu.addItem(item => {
            item.setTitle(strings.folderAppearance.groupBy).setIcon('lucide-layers').setDisabled(true);
        });

        // Default grouping option (clears custom override)
        const defaultGroupLabel = strings.settings.items.groupNotes.options[groupingInfo.defaultGrouping];

        menu.addItem(item => {
            item.setTitle(`    ${strings.folderAppearance.defaultGroupOption(defaultGroupLabel)}`)
                .setChecked(!hasCustomGroupBy)
                .onClick(() => {
                    updateAppearance({ groupBy: undefined });
                });
        });

        // Custom grouping options (folders support all three, tags and properties only support none/date)
        const groupOptions: ListNoteGroupingOption[] = isFolderSelection ? ['none', 'date', 'folder'] : ['none', 'date'];
        groupOptions.forEach(option => {
            menu.addItem(item => {
                const isChecked = hasCustomGroupBy && groupingInfo.normalizedOverride === option;
                const optionLabel = strings.settings.items.groupNotes.options[option];
                item.setTitle(`    ${optionLabel}`)
                    .setChecked(isChecked)
                    .onClick(() => {
                        updateAppearance({ groupBy: option });
                    });
            });
        });
    }

    if (descendantAction) {
        menu.addSeparator();
        menu.addItem(item => {
            item.setTitle(descendantAction.menuTitle)
                .setDisabled(Boolean(descendantAction.disabled))
                .onClick(() => {
                    descendantAction.onApply();
                });
        });
    }

    menu.showAtMouseEvent(event);
}
