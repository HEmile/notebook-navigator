import { useMemo } from 'react';
import { useServices, useMetadataService } from '../context/ServicesContext';
import { useSettingsState } from '../context/SettingsContext';
import { useSelectionState } from '../context/SelectionContext';
import { useFileCache } from '../context/StorageContext';
import { useExpansionState } from '../context/ExpansionContext';
import { strings } from '../i18n';
import { ItemType, UNTAGGED_TAG_ID } from '../types';
import { hasSubfolders } from '../utils/fileFilters';

export type BreadcrumbTargetType = 'folder' | 'tag' | 'topic' | 'none';

export interface BreadcrumbSegment {
    label: string;
    targetType: BreadcrumbTargetType;
    targetPath?: string;
    isLast: boolean;
}

interface UseListPaneTitleResult {
    desktopTitle: string;
    breadcrumbSegments: BreadcrumbSegment[];
    iconName: string;
    showIcon: boolean;
    selectionType: ItemType | null;
}

export function useListPaneTitle(): UseListPaneTitleResult {
    const { app } = useServices();
    const settings = useSettingsState();
    const selectionState = useSelectionState();
    const { getTagDisplayPath } = useFileCache();
    const expansionState = useExpansionState();
    const metadataService = useMetadataService();

    const iconName = useMemo(() => {
        if (!settings.showIcons) {
            return '';
        }

        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            const folder = selectionState.selectedFolder;
            const customIcon = metadataService.getFolderIcon(folder.path);
            if (customIcon) {
                return customIcon;
            }

            const excludedFolders = settings.excludedFolders;
            const showHiddenFolders = settings.showHiddenItems;
            const hasChildren = hasSubfolders(folder, excludedFolders, showHiddenFolders);
            const isExpanded = expansionState.expandedFolders.has(folder.path);
            return hasChildren && isExpanded ? 'lucide-folder-open' : 'lucide-folder-closed';
        }

        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            return metadataService.getTagIcon(selectionState.selectedTag) || 'lucide-tags';
        }

        if (selectionState.selectionType === ItemType.TOPIC && selectionState.selectedTopic) {
            return 'lucide-tags'; // TODO: Topics use tags icon for now
        }

        return '';
    }, [
        expansionState.expandedFolders,
        metadataService,
        selectionState.selectedFolder,
        selectionState.selectedTag,
        selectionState.selectedTopic,
        selectionState.selectionType,
        settings.excludedFolders,
        settings.showHiddenItems,
        settings.showIcons
    ]);

    const { desktopTitle, breadcrumbSegments } = useMemo(() => {
        if (selectionState.selectionType === ItemType.FOLDER && selectionState.selectedFolder) {
            const folder = selectionState.selectedFolder;

            if (folder.path === '/') {
                const vaultName = settings.customVaultName || app.vault.getName();
                const rootBreadcrumb: BreadcrumbSegment[] = [
                    {
                        label: vaultName,
                        targetType: 'none',
                        isLast: true
                    }
                ];
                return {
                    desktopTitle: vaultName,
                    breadcrumbSegments: rootBreadcrumb
                };
            }

            const segments = folder.path.split('/').filter(Boolean);
            const breadcrumb: BreadcrumbSegment[] = segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                return {
                    label: segment,
                    targetType: isLast ? 'none' : 'folder',
                    targetPath: isLast ? undefined : segments.slice(0, index + 1).join('/'),
                    isLast
                };
            });

            return {
                desktopTitle: folder.name,
                breadcrumbSegments: breadcrumb
            };
        }

        if (selectionState.selectionType === ItemType.TAG && selectionState.selectedTag) {
            const tag = selectionState.selectedTag;

            if (tag === UNTAGGED_TAG_ID) {
                const untaggedBreadcrumb: BreadcrumbSegment[] = [
                    {
                        label: strings.common.untagged,
                        targetType: 'none',
                        isLast: true
                    }
                ];
                return {
                    desktopTitle: strings.common.untagged,
                    breadcrumbSegments: untaggedBreadcrumb
                };
            }

            const displayPath = getTagDisplayPath(tag);
            const segments = displayPath.split('/').filter(Boolean);
            const breadcrumb: BreadcrumbSegment[] = segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                return {
                    label: segment,
                    targetType: isLast ? 'none' : 'tag',
                    targetPath: isLast ? undefined : segments.slice(0, index + 1).join('/'),
                    isLast
                };
            });

            return {
                desktopTitle: segments[segments.length - 1] || displayPath,
                breadcrumbSegments: breadcrumb
            };
        }

        if (selectionState.selectionType === ItemType.TOPIC && selectionState.selectedTopic) {
            const topicName = selectionState.selectedTopic;
            
            const topicBreadcrumb: BreadcrumbSegment[] = [
                {
                    label: topicName,
                    targetType: 'none',
                    isLast: true
                }
            ];

            return {
                desktopTitle: topicName,
                breadcrumbSegments: topicBreadcrumb
            };
        }

        const noSelectionBreadcrumb: BreadcrumbSegment[] = [
            {
                label: strings.common.noSelection,
                targetType: 'none',
                isLast: true
            }
        ];

        return {
            desktopTitle: strings.common.noSelection,
            breadcrumbSegments: noSelectionBreadcrumb
        };
    }, [
        app.vault,
        getTagDisplayPath,
        selectionState.selectedFolder,
        selectionState.selectedTag,
        selectionState.selectedTopic,
        selectionState.selectionType,
        settings.customVaultName
    ]);

    return {
        desktopTitle,
        breadcrumbSegments,
        iconName,
        showIcon: settings.showIcons && iconName.length > 0,
        selectionType: selectionState.selectionType
    };
}
