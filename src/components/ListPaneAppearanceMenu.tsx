import { Menu, TFolder } from 'obsidian';
import { strings } from '../i18n';
import { FolderAppearance, TagAppearance } from '../hooks/useListPaneAppearance';
import { NotebookNavigatorSettings } from '../settings';
import { ItemType } from '../types';

interface AppearanceMenuProps {
    event: MouseEvent;
    titleRows: number;
    previewRows: number;
    showDate: boolean;
    showPreview: boolean;
    showImage: boolean;
    settings: NotebookNavigatorSettings;
    selectedFolder: TFolder | null;
    selectedTag?: string | null;
    selectedTopic?: string | null;
    selectionType?: ItemType;
    updateSettings: (updater: (settings: NotebookNavigatorSettings) => void) => Promise<void>;
}

export function showListPaneAppearanceMenu({
    event,
    titleRows,
    previewRows,
    showDate,
    showPreview,
    showImage,
    settings,
    selectedFolder,
    selectedTag,
    selectedTopic,
    selectionType,
    updateSettings
}: AppearanceMenuProps) {
    const updateAppearance = (updates: Partial<FolderAppearance | TagAppearance>) => {
        if (selectionType === ItemType.TAG && selectedTag) {
            // Update tag appearance
            updateSettings(s => {
                const newAppearances = { ...s.tagAppearances };
                const currentAppearance = newAppearances[selectedTag] || {};

                // Merge updates
                newAppearances[selectedTag] = { ...currentAppearance, ...updates };

                // Remove tag entry if all settings are cleared (back to defaults)
                const hasDefinedValues = Object.values(newAppearances[selectedTag]).some(value => value !== undefined);
                if (!hasDefinedValues) {
                    delete newAppearances[selectedTag];
                }

                s.tagAppearances = newAppearances;
            });
        } else if (selectionType === ItemType.TOPIC && selectedTopic) {
            // Update topic appearance (topics share tag appearance storage)
            updateSettings(s => {
                const newAppearances = { ...s.tagAppearances };
                const currentAppearance = newAppearances[selectedTopic] || {};

                // Merge updates
                newAppearances[selectedTopic] = { ...currentAppearance, ...updates };

                // Remove topic entry if all settings are cleared (back to defaults)
                const hasDefinedValues = Object.values(newAppearances[selectedTopic]).some(value => value !== undefined);
                if (!hasDefinedValues) {
                    delete newAppearances[selectedTopic];
                }

                s.tagAppearances = newAppearances;
            });
        } else if (selectionType === ItemType.FOLDER && selectedFolder) {
            // Update folder appearance
            const folderPath = selectedFolder.path;
            updateSettings(s => {
                const newAppearances = { ...s.folderAppearances };
                const currentAppearance = newAppearances[folderPath] || {};

                // Merge updates
                newAppearances[folderPath] = { ...currentAppearance, ...updates };

                // Remove folder entry if all settings are cleared (back to defaults)
                const hasDefinedValues = Object.values(newAppearances[folderPath]).some(value => value !== undefined);
                if (!hasDefinedValues) {
                    delete newAppearances[folderPath];
                }

                s.folderAppearances = newAppearances;
            });
        }
    };

    const menu = new Menu();

    // Get custom appearance settings for the selected folder/tag/topic
    // Will be undefined if no custom appearance has been set
    let appearance: FolderAppearance | TagAppearance | undefined;
    if (selectionType === ItemType.TAG && selectedTag) {
        appearance = settings.tagAppearances?.[selectedTag];
    } else if (selectionType === ItemType.TOPIC && selectedTopic) {
        appearance = settings.tagAppearances?.[selectedTopic];
    } else if (selectionType === ItemType.FOLDER && selectedFolder) {
        appearance = settings.folderAppearances?.[selectedFolder.path];
    }

    const hasAnyCustomValues =
        appearance &&
        (appearance.titleRows !== undefined ||
            appearance.previewRows !== undefined ||
            appearance.showDate !== undefined ||
            appearance.showPreview !== undefined ||
            appearance.showImage !== undefined);

    const isUsingDefaults = !hasAnyCustomValues;

    // Check if we're in slim mode
    const isSlim = !showDate && !showPreview && !showImage;

    // Default preset
    menu.addItem(item => {
        item.setTitle(strings.folderAppearance.defaultPreset)
            .setChecked(isUsingDefaults)
            .onClick(() => {
                updateAppearance({
                    titleRows: undefined,
                    previewRows: undefined,
                    showDate: undefined,
                    showPreview: undefined,
                    showImage: undefined
                });
            });
    });

    // Slim preset
    menu.addItem(item => {
        item.setTitle(strings.folderAppearance.slimPreset)
            .setChecked(isSlim)
            .onClick(() => {
                updateAppearance({
                    showDate: false,
                    showPreview: false,
                    showImage: false
                });
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
        const isDefaultTitle = titleRows === settings.fileNameRows && !hasCustomTitleRows;
        item.setTitle(`    ${strings.folderAppearance.defaultTitleOption(settings.fileNameRows)}`)
            .setChecked(isDefaultTitle)
            .onClick(() => {
                updateAppearance({ titleRows: undefined });
            });
    });

    // Title row options
    [1, 2].forEach(rows => {
        menu.addItem(item => {
            const hasCustomTitleRows = appearance?.titleRows !== undefined;
            const isChecked = titleRows === rows && hasCustomTitleRows;
            item.setTitle(`    ${strings.folderAppearance.titleRowOption(rows)}`)
                .setChecked(isChecked)
                .onClick(() => {
                    updateAppearance({ titleRows: rows });
                });
        });
    });

    menu.addSeparator();

    // Preview rows header
    menu.addItem(item => {
        item.setTitle(strings.folderAppearance.previewRows).setIcon('lucide-file-text').setDisabled(true);
    });

    // Default preview rows option
    menu.addItem(item => {
        const hasCustomPreviewRows = appearance?.previewRows !== undefined;
        const isDefaultPreview = previewRows === settings.previewRows && !hasCustomPreviewRows;
        item.setTitle(`    ${strings.folderAppearance.defaultPreviewOption(settings.previewRows)}`)
            .setChecked(isDefaultPreview && !isSlim)
            .onClick(() => {
                if (isSlim) {
                    // Exit slim mode and reset to default preview rows
                    updateAppearance({
                        previewRows: undefined,
                        showDate: undefined,
                        showPreview: undefined,
                        showImage: undefined
                    });
                } else {
                    updateAppearance({ previewRows: undefined });
                }
            });
    });

    // Preview row options
    [1, 2, 3, 4, 5].forEach(rows => {
        menu.addItem(item => {
            const hasCustomPreviewRows = appearance?.previewRows !== undefined;
            const isChecked = previewRows === rows && hasCustomPreviewRows && !isSlim;
            item.setTitle(`    ${strings.folderAppearance.previewRowOption(rows)}`)
                .setChecked(isChecked)
                .onClick(() => {
                    if (isSlim) {
                        // Exit slim mode and apply the selected preview rows
                        updateAppearance({
                            previewRows: rows,
                            showDate: undefined,
                            showPreview: undefined,
                            showImage: undefined
                        });
                    } else {
                        updateAppearance({ previewRows: rows });
                    }
                });
        });
    });

    menu.showAtMouseEvent(event);
}
