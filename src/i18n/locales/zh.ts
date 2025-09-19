/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025 Johan Sanneblad
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
 * English language strings for Notebook Navigator
 * Organized by feature/component for easy maintenance
 */
export const STRINGS_ZH = {
    // Common UI elements
    common: {
        cancel: '取消', // Button text for canceling dialogs and operations (English: Cancel)
        delete: '删除', // Button text for delete operations in dialogs (English: Delete)
        remove: '移除', // Button text for remove operations in dialogs (English: Remove)
        submit: '提交', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: '未选择', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: '无标签', // Label for notes without any tags (English: Untagged)
        untitled: '无标题', // Default name for notes without a title (English: Untitled)
        featureImageAlt: '特色图片', // Alt text for thumbnail/preview images (English: Feature image)
        unknownError: '未知错误' // Generic fallback when an error has no message (English: Unknown error)
    },

    // List pane
    listPane: {
        emptyStateNoSelection: '选择文件夹或标签以查看笔记', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: '无笔记', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 已固定', // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
        notesSection: '笔记', // Header shown between pinned and regular items when showing documents only (English: Notes)
        filesSection: '文件' // Header shown between pinned and regular items when showing supported or all files (English: Files)
    },

    // Tag list
    tagList: {
        untaggedLabel: '无标签', // Label for the special item showing notes without tags (English: Untagged)
        favoriteTags: '收藏', // Label for the favorites virtual folder (English: Favorites)
        hiddenTags: '隐藏标签', // Label for the hidden tags virtual folder (English: Hidden tags)
        allTags: '标签', // Label for the tags virtual folder when favorites exist (English: Tags)
        tags: '标签' // Label for the tags virtual folder when no favorites exist (English: Tags)
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: '折叠项目', // Tooltip for button that collapses expanded items (English: Collapse items)
        expandAllFolders: '展开所有项目', // Tooltip for button that expands all items (English: Expand all items)
        newFolder: '新建文件夹', // Tooltip for create new folder button (English: New folder)
        newNote: '新笔记', // Tooltip for create new note button (English: New note)
        mobileBackToNavigation: '返回导航', // Mobile-only back button text to return to navigation pane (English: Back to navigation)
        changeSortOrder: '更改排序方式', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: '默认', // Label for default sorting mode (English: Default)
        customSort: '自定义', // Label for custom sorting mode (English: Custom)
        showFolders: '显示导航', // Tooltip for button to show the navigation pane (English: Show navigation)
        hideFolders: '隐藏导航', // Tooltip for button to hide the navigation pane (English: Hide navigation)
        toggleDescendantNotes: '显示后代笔记（文件夹和标签）', // Tooltip for button to toggle showing notes from descendants (English: Show notes from descendants (folders and tags))
        autoExpandFoldersTags: '自动展开文件夹和标签', // Tooltip for button to toggle auto-expanding folders and tags when selected (English: Auto-expand folders and tags)
        showExcludedItems: '显示隐藏项', // Tooltip for button to show hidden items (English: Show hidden items)
        hideExcludedItems: '隐藏隐藏项', // Tooltip for button to hide hidden items (English: Hide hidden items)
        showDualPane: '显示双窗格', // Tooltip for button to show dual-pane layout (English: Show dual panes)
        showSinglePane: '显示单窗格', // Tooltip for button to show single-pane layout (English: Show single pane)
        changeAppearance: '更改外观', // Tooltip for button to change folder appearance settings (English: Change appearance)
        search: '搜索' // Tooltip for search button (English: Search)
    },
    // Search input
    searchInput: {
        placeholder: '搜索...', // Placeholder text for search input (English: Search...)
        placeholderOmnisearch: 'Omnisearch...', // Placeholder text when Omnisearch provider is active (English: Omnisearch...)
        clearSearch: '清除搜索' // Tooltip for clear search button (English: Clear search)
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: '在新标签页中打开',
            openToRight: '在右侧打开',
            openInNewWindow: '在新窗口中打开',
            openMultipleInNewTabs: '在新标签页中打开 {count} 个笔记',
            openMultipleToRight: '在右侧打开 {count} 个笔记',
            openMultipleInNewWindows: '在新窗口中打开 {count} 个笔记',
            pinNote: '固定笔记',
            unpinNote: '取消固定笔记',
            pinMultipleNotes: '固定 {count} 个笔记',
            unpinMultipleNotes: '取消固定 {count} 个笔记',
            duplicateNote: '复制笔记',
            duplicateMultipleNotes: '复制 {count} 个笔记',
            openVersionHistory: '打开版本历史',
            revealInFolder: '在文件夹中显示',
            revealInFinder: '在访达中显示',
            showInExplorer: '在资源管理器中显示',
            copyDeepLink: '复制深层链接',
            renameNote: '重命名笔记',
            deleteNote: '删除笔记',
            deleteMultipleNotes: '删除 {count} 个笔记',
            moveToFolder: '移动到...',
            moveMultipleToFolder: '将 {count} 个文件移动到...',
            addTag: '添加标签',
            removeTag: '移除标签',
            removeAllTags: '移除所有标签',
            // File-specific context menu items (non-markdown files)
            openMultipleFilesInNewTabs: '在新标签页中打开 {count} 个文件',
            openMultipleFilesToRight: '在右侧打开 {count} 个文件',
            openMultipleFilesInNewWindows: '在新窗口中打开 {count} 个文件',
            pinFile: '固定文件',
            unpinFile: '取消固定文件',
            pinMultipleFiles: '固定 {count} 个文件',
            unpinMultipleFiles: '取消固定 {count} 个文件',
            duplicateFile: '复制文件',
            duplicateMultipleFiles: '复制 {count} 个文件',
            renameFile: '重命名文件',
            deleteFile: '删除文件',
            deleteMultipleFiles: '删除 {count} 个文件'
        },
        folder: {
            newNote: '新笔记',
            newFolder: '新建文件夹',
            newCanvas: '新建画布',
            newBase: '新建数据库',
            newDrawing: '新建绘图',
            duplicateFolder: '复制文件夹',
            searchInFolder: '在文件夹中搜索',
            createFolderNote: '创建文件夹笔记',
            deleteFolderNote: '删除文件夹笔记',
            changeIcon: '更改图标',
            removeIcon: '移除图标',
            changeColor: '更改颜色',
            changeBackground: '更改背景',
            removeColor: '移除颜色',
            excludeFolder: '隐藏文件夹',
            renameFolder: '重命名文件夹',
            deleteFolder: '删除文件夹'
        },
        tag: {
            changeIcon: '更改图标',
            removeIcon: '移除图标',
            changeColor: '更改颜色',
            changeBackground: '更改背景',
            removeColor: '移除颜色',
            addToFavorites: '添加到收藏',
            removeFromFavorites: '从收藏中移除',
            hideTag: '隐藏标签'
        }
    },

    // Folder appearance menu
    folderAppearance: {
        defaultPreset: '默认外观',
        slimPreset: '精简（无日期/预览/图片）',
        titleRows: '标题行数',
        previewRows: '预览行数',
        defaultOption: (rows: number) => `默认 (${rows})`,
        defaultTitleOption: (rows: number) => `默认标题行数 (${rows})`,
        defaultPreviewOption: (rows: number) => `默认预览行数 (${rows})`,
        titleRowOption: (rows: number) => `标题${rows}行`,
        previewRowOption: (rows: number) => `预览${rows}行`
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: '搜索图标...',
            recentlyUsedHeader: '最近使用',
            emptyStateSearch: '开始输入以搜索图标',
            emptyStateNoResults: '未找到图标',
            showingResultsInfo: '显示 {count} 个结果中的 50 个。输入更多内容以缩小范围。',
            emojiInstructions: '输入或粘贴任何表情符号作为图标使用'
        },
        colorPicker: {
            currentColor: '当前',
            newColor: '新颜色',
            presetColors: '预设颜色',
            recentColors: '最近使用的颜色',
            clearRecentColors: '清除最近使用的颜色',
            apply: '应用',
            hexLabel: 'HEX',
            rgbLabel: 'RGB',
            colors: {
                red: '红色',
                orange: '橙色',
                amber: '琥珀色',
                yellow: '黄色',
                lime: '青柠色',
                green: '绿色',
                emerald: '翡翠色',
                teal: '青绿色',
                cyan: '青色',
                sky: '天蓝色',
                blue: '蓝色',
                indigo: '靛蓝色',
                violet: '紫罗兰色',
                purple: '紫色',
                fuchsia: '品红色',
                pink: '粉色',
                rose: '玫瑰色',
                gray: '灰色',
                slate: '石板色',
                stone: '石灰色'
            }
        },
        tagOperation: {
            renameTitle: '重命名标签',
            deleteTitle: '删除标签',
            newTagPrompt: '输入新的标签名称：',
            newTagPlaceholder: '新名称',
            renameWarning: '这将重命名所有受影响笔记中的标签。',
            deleteWarning: '这将从所有受影响笔记中删除标签。',
            modificationWarning: '标签修改',
            affectedFiles: '{count} 个文件受影响',
            andMore: '以及 {count} 个更多...',
            confirmRename: '重命名标签',
            confirmDelete: '删除标签',
            file: '个文件',
            files: '个文件'
        },
        fileSystem: {
            newFolderTitle: '新建文件夹',
            renameFolderTitle: '重命名文件夹',
            renameFileTitle: '重命名文件',
            deleteFolderTitle: "删除 '{name}'？",
            deleteFileTitle: "删除 '{name}'？",
            folderNamePrompt: '输入文件夹名称：',
            renamePrompt: '输入新名称：',
            renameVaultTitle: '更改仓库显示名称',
            renameVaultPrompt: '输入自定义显示名称（留空使用默认值）：',
            deleteFolderConfirm: '您确定要删除此文件夹及其所有内容吗？',
            deleteFileConfirm: '您确定要删除此文件吗？',
            removeAllTagsTitle: '移除所有标签',
            removeAllTagsFromNote: '您确定要从这个笔记中移除所有标签吗？',
            removeAllTagsFromNotes: '您确定要从 {count} 个笔记中移除所有标签吗？'
        },
        folderSuggest: {
            placeholder: '移动到文件夹...',
            navigatePlaceholder: '导航到文件夹...',
            instructions: {
                navigate: '导航',
                move: '移动',
                select: '选择',
                dismiss: '取消'
            }
        },
        tagSuggest: {
            placeholder: '搜索标签...',
            navigatePlaceholder: '导航到标签...',
            addPlaceholder: '搜索要添加的标签...',
            removePlaceholder: '选择要移除的标签...',
            createNewTag: '创建新标签: #{tag}',
            instructions: {
                navigate: '导航',
                select: '选择',
                dismiss: '取消',
                add: '添加标签',
                remove: '移除标签'
            }
        }
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: '创建文件夹失败：{error}',
            createFile: '创建文件失败：{error}',
            renameFolder: '重命名文件夹失败：{error}',
            renameFolderNoteConflict: '无法重命名："{name}"已在此文件夹中存在',
            renameFile: '重命名文件失败：{error}',
            deleteFolder: '删除文件夹失败：{error}',
            deleteFile: '删除文件失败：{error}',
            duplicateNote: '复制笔记失败：{error}',
            createCanvas: '创建画布失败：{error}',
            createDatabase: '创建数据库失败：{error}',
            duplicateFolder: '复制文件夹失败：{error}',
            openVersionHistory: '打开版本历史失败：{error}',
            versionHistoryNotFound: '未找到版本历史命令。请确保已启用 Obsidian 同步。',
            revealInExplorer: '在系统资源管理器中显示文件失败：{error}',
            folderNoteAlreadyExists: '文件夹笔记已存在',
            failedToDeleteFile: '删除 {name} 失败: {error}',
            failedToDeleteMultipleFiles: '删除{count}个文件失败',
            versionHistoryNotAvailable: '版本历史服务不可用',
            drawingAlreadyExists: '同名绘图已存在',
            failedToCreateDrawing: '创建绘图失败',
            noFolderSelected: 'Notebook Navigator 中未选择文件夹',
            noFileSelected: '未选择文件'
        },
        notices: {
            excludedFolder: '已排除文件夹：{name}'
        },
        notifications: {
            deletedMultipleFiles: '已删除 {count} 个文件',
            movedMultipleFiles: '已将{count}个文件移动到{folder}',
            folderMoved: '已移动文件夹"{name}"',
            deepLinkCopied: '深层链接已复制到剪贴板',
            tagAddedToNote: '已将标签添加到 1 个笔记',
            tagAddedToNotes: '已将标签添加到 {count} 个笔记',
            tagRemovedFromNote: '已从 1 个笔记中移除标签',
            tagRemovedFromNotes: '已从 {count} 个笔记中移除标签',
            tagsClearedFromNote: '已从 1 个笔记中清除所有标签',
            tagsClearedFromNotes: '已从 {count} 个笔记中清除所有标签',
            noTagsToRemove: '没有可移除的标签',
            noFilesSelected: '未选择文件',
            tagOperationsNotAvailable: '标签操作不可用'
        },
        confirmations: {
            deleteMultipleFiles: '确定要删除 {count} 个文件吗？',
            deleteConfirmation: '此操作无法撤销。'
        },
        defaultNames: {
            untitled: '无标题',
            untitledNumber: '无标题 {number}'
        }
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: '无法将文件夹移动到自身或其子文件夹中。',
            itemAlreadyExists: '此位置已存在名为 "{name}" 的项目。',
            failedToMove: '移动失败：{error}',
            failedToAddTag: '添加标签 "{tag}" 失败',
            failedToClearTags: '清除标签失败',
            failedToMoveFolder: '移动文件夹"{name}"失败',
            foldersCannotHaveTags: '文件夹不能有标签',
            failedToImportFiles: 'Failed to import: {names}'
        },
        notifications: {
            filesAlreadyExist: '{count} 个文件在目标位置已存在',
            addedTag: '已将标签 "{tag}" 添加到 {count} 个文件',
            filesAlreadyHaveTag: '{count} 个文件已经有此标签或更具体的标签',
            clearedTags: '已从 {count} 个文件中清除所有标签',
            noTagsToClear: '没有要清除的标签',
            fileImported: 'Imported 1 file',
            filesImported: 'Imported {count} files'
        }
    },

    // Date grouping
    dateGroups: {
        today: '今天',
        yesterday: '昨天',
        previous7Days: '过去 7 天',
        previous30Days: '过去 30 天'
    },

    // Weekdays
    weekdays: {
        sunday: '星期日',
        monday: '星期一',
        tuesday: '星期二',
        wednesday: '星期三',
        thursday: '星期四',
        friday: '星期五',
        saturday: '星期六'
    },

    // Plugin commands
    commands: {
        open: '打开', // Command palette: Opens the Notebook Navigator view (English: Open)
        revealFile: '显示文件', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal file)
        search: '搜索', // Command palette: Toggle search in the file list (English: Search)
        toggleDualPane: '切换双窗格布局', // Command palette: Toggles between single-pane and dual-pane layout (English: Toggle dual pane layout)
        deleteFile: '删除文件', // Command palette: Deletes the currently active file (English: Delete file)
        createNewNote: '创建新笔记', // Command palette: Creates a new note in the currently selected folder (English: Create new note)
        moveFiles: '移动文件', // Command palette: Move selected files to another folder (English: Move files)
        navigateToFolder: '导航到文件夹', // Command palette: Navigate to a folder using fuzzy search (English: Navigate to folder)
        navigateToTag: '导航到标签', // Command palette: Navigate to a tag using fuzzy search (English: Navigate to tag)
        toggleDescendants: '切换后代', // Command palette: Toggles showing notes from descendants (English: Toggle descendants)
        toggleHidden: '切换隐藏项', // Command palette: Toggles showing hidden items (English: Toggle hidden items)
        collapseExpand: '折叠/展开所有项目', // Command palette: Collapse or expand all folders and tags (English: Collapse / expand all items)
        addTag: '为选定文件添加标签', // Command palette: Opens a dialog to add a tag to selected files (English: Add tag to selected files)
        removeTag: '从选定文件移除标签', // Command palette: Opens a dialog to remove a tag from selected files (English: Remove tag from selected files)
        removeAllTags: '从选定文件移除所有标签' // Command palette: Removes all tags from selected files (English: Remove all tags from selected files)
    },

    // Plugin UI
    plugin: {
        viewName: '笔记本导航器', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: '笔记本导航器', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: '在笔记本导航器中显示' // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: '最后修改于',
        createdAt: '创建于',
        file: '个文件',
        files: '个文件',
        folder: '个文件夹',
        folders: '个文件夹'
    },

    // Settings
    settings: {
        metadataReport: {
            exportSuccess: '失败的元数据报告已导出至：{filename}',
            exportFailed: '导出元数据报告失败'
        },
        sections: {
            notes: '笔记显示',
            navigationPane: '文件夹显示',
            icons: '图标包',
            tags: '标签显示',
            folders: '文件夹笔记',
            search: '搜索',
            listPane: '列表窗格',
            advanced: '高级'
        },
        items: {
            searchProvider: {
                name: '搜索提供器',
                desc: '在快速文件名搜索或使用Omnisearch插件的全文搜索之间选择。',
                options: {
                    internal: '过滤搜索',
                    omnisearch: 'Omnisearch（全文）'
                },
                info: {
                    filterSearch: {
                        title: '过滤搜索（默认）：',
                        description:
                            '快速、轻量级搜索，按名称和标签过滤当前文件夹和子文件夹中的文件。支持使用 # 前缀进行标签过滤（例如 #项目），使用 ! 前缀进行排除（例如 !草稿，!#已归档），以及使用 !# 查找无标签笔记。非常适合在当前上下文中快速导航。'
                    },
                    omnisearch: {
                        title: 'Omnisearch：',
                        description:
                            '全文搜索，搜索整个仓库，然后过滤结果以仅显示来自当前文件夹、子文件夹或选定标签的文件。需要安装Omnisearch插件 - 如果不可用，搜索将自动回退到过滤搜索。',
                        warningNotInstalled: '未安装 Omnisearch 插件。使用过滤搜索。',
                        limitations: {
                            title: '已知限制：',
                            performance: '性能：可能较慢，特别是在大型仓库中搜索少于3个字符时',
                            pathBug: '路径错误：无法在包含非ASCII字符的路径中搜索，且不能正确搜索子路径，影响搜索结果中显示的文件',
                            limitedResults:
                                '结果有限：由于Omnisearch搜索整个仓库并在过滤前返回有限数量的结果，如果仓库其他地方存在太多匹配项，当前文件夹中的相关文件可能不会出现',
                            previewText:
                                '预览文本：笔记预览被Omnisearch结果摘录替换，如果搜索匹配高亮出现在文件的其他位置，可能不会显示实际的高亮'
                        }
                    }
                }
            },
            sortNotesBy: {
                name: '笔记排序方式',
                desc: '选择笔记列表中的笔记排序方式。',
                options: {
                    'modified-desc': '编辑日期（最新优先）',
                    'modified-asc': '编辑日期（最旧优先）',
                    'created-desc': '创建日期（最新优先）',
                    'created-asc': '创建日期（最旧优先）',
                    'title-asc': '标题（A 优先）',
                    'title-desc': '标题（Z 优先）'
                }
            },
            groupByDate: {
                name: '按日期分组笔记',
                desc: '按日期排序时，在日期标题下分组笔记。'
            },
            optimizeNoteHeight: {
                name: '优化笔记高度',
                desc: '减少固定笔记和无预览文本笔记的高度。'
            },
            showParentFolderNames: {
                name: '显示父文件夹名称',
                desc: '为子文件夹或标签中的笔记显示父文件夹名称。'
            },
            showQuickActions: {
                name: '显示快速操作（仅桌面版）',
                desc: '在文件项上显示悬停操作。'
            },
            quickActionsRevealInFolder: {
                name: '在文件夹中显示',
                desc: '快速操作：在父文件夹中显示笔记。仅在从子文件夹或在标签中查看笔记时显示（在笔记的实际文件夹中不显示）。'
            },
            quickActionsPinNote: {
                name: '固定笔记',
                desc: '快速操作：在列表顶部固定或取消固定笔记。'
            },
            quickActionsOpenInNewTab: {
                name: '在新标签页中打开',
                desc: '快速操作：在新标签页中打开笔记。'
            },
            dualPane: {
                name: '双窗格布局（仅桌面端）',
                desc: '在桌面端并排显示导航窗格和列表窗格。'
            },
            autoRevealActiveNote: {
                name: '自动定位活动笔记',
                desc: '从快速切换器、链接或搜索打开笔记时自动显示。'
            },
            autoRevealIgnoreRightSidebar: {
                name: '忽略右侧边栏',
                desc: '禁用来自右侧边栏的自动显示。'
            },
            autoSelectFirstFileOnFocusChange: {
                name: '自动选择第一个笔记（仅桌面端）',
                desc: '切换文件夹或标签时自动打开第一个笔记。'
            },
            autoExpandFoldersTags: {
                name: '自动展开文件夹和标签',
                desc: '选择文件夹和标签时自动展开它们。'
            },
            showTooltips: {
                name: '显示工具提示（仅桌面端）',
                desc: '悬停时显示笔记和文件夹的额外信息工具提示。'
            },
            multiSelectModifier: {
                name: '多选修饰键',
                desc: '选择哪个修饰键切换多选模式。选择 Option/Alt 时，Cmd/Ctrl 点击会在新标签页中打开笔记。',
                options: {
                    cmdCtrl: 'Cmd/Ctrl 点击',
                    optionAlt: 'Option/Alt 点击'
                }
            },
            excludedNotes: {
                name: '隐藏笔记',
                desc: '逗号分隔的前置元数据属性列表。包含任何这些属性的笔记将被隐藏（例如：draft, private, archived）。',
                placeholder: 'draft, private'
            },
            excludedFolders: {
                name: '隐藏文件夹',
                desc: '逗号分隔的要隐藏的文件夹列表。名称模式：assets*（以assets开头的文件夹），*_temp（以_temp结尾）。路径模式：/archive（仅根目录archive），/res*（以res开头的根文件夹），/*/temp（一级目录下的temp文件夹），/projects/*（projects内的所有文件夹）。',
                placeholder: 'templates, assets*, /archive, /res*',
                info: '自动清理：通过右键排除时，冗余的模式会被移除（例如，如果您排除/projects且/projects/app已在列表中，它将被移除）。'
            },
            fileVisibility: {
                name: '显示文件类型',
                desc: '过滤在导航器中显示的文件类型。Obsidian不支持的文件类型可能会在外部应用程序中打开。',
                options: {
                    documents: '文档 (.md, .canvas, .base)',
                    supported: '支持 (在Obsidian中打开)',
                    all: '全部 (可能外部打开)'
                }
            },
            showFileDate: {
                name: '显示日期',
                desc: '在笔记名称下方显示日期。'
            },
            showFileTags: {
                name: '显示文件标签',
                desc: '在文件项中显示可点击的标签。使用标签颜色来直观区分不同的标签类型。'
            },
            showFileTagsInSlimMode: {
                name: '在精简模式中显示文件标签',
                desc: '当日期、预览和图像被隐藏时显示标签。'
            },
            dateFormat: {
                name: '日期格式',
                desc: '用于显示日期的格式（使用 date-fns 格式）。',
                placeholder: 'yyyy年M月d日',
                help: '常用格式：\nyyyy年M月d日 = 2022年5月25日\nyyyy-MM-dd = 2022-05-25\nMM/dd/yyyy = 05/25/2022\n\n标记：\nyyyy/yy = 年\nMMMM/MMM/MM/M = 月\ndd/d = 日\nEEEE/EEE = 星期',
                helpTooltip: '点击查看格式参考'
            },
            timeFormat: {
                name: '时间格式',
                desc: '用于显示时间的格式（使用 date-fns 格式）。',
                placeholder: 'HH:mm',
                help: '常用格式：\nHH:mm = 14:30（24小时制）\nh:mm a = 2:30 PM（12小时制）\nHH:mm:ss = 14:30:45\nh:mm:ss a = 2:30:45 PM\n\n标记：\nHH/H = 24小时制\nhh/h = 12小时制\nmm = 分钟\nss = 秒\na = 上午/下午',
                helpTooltip: '点击查看格式参考'
            },
            showFilePreview: {
                name: '显示笔记预览 (*)',
                desc: '在笔记名称下方显示预览文本。'
            },
            skipHeadingsInPreview: {
                name: '预览中跳过标题',
                desc: '生成预览文本时跳过标题行。'
            },
            previewProperties: {
                name: '预览属性',
                desc: '用于查找预览文本的前置属性的逗号分隔列表。将使用第一个包含文本的属性。',
                placeholder: '摘要, 描述, 概要',
                info: '如果在指定的属性中找不到预览文本，预览将从笔记内容中生成。'
            },
            previewRows: {
                name: '预览行数',
                desc: '预览文本显示的行数。',
                options: {
                    '1': '1 行',
                    '2': '2 行',
                    '3': '3 行',
                    '4': '4 行',
                    '5': '5 行'
                }
            },
            fileNameRows: {
                name: '标题行数',
                desc: '笔记标题显示的行数。',
                options: {
                    '1': '1 行',
                    '2': '2 行'
                }
            },
            showFeatureImage: {
                name: '显示特色图片 (*)',
                desc: '从前置元数据显示缩略图。提示：使用"Featured Image"插件自动为所有文档设置特色图片。'
            },
            featureImageProperties: {
                name: '图片属性',
                desc: '用于缩略图的前置元数据属性的逗号分隔列表。将使用第一个包含图片的属性。如果为空且启用了后备设置，将使用第一个嵌入的图片。',
                placeholder: 'thumbnail, featureResized, feature'
            },
            useEmbeddedImageFallback: {
                name: '使用嵌入图片作为后备',
                desc: '当在前置元数据属性中找不到缩略图时，使用文档中的第一个嵌入图片作为后备（需要 Obsidian 1.9.4+）。禁用此选项以验证缩略图是否正确配置。'
            },
            showRootFolder: {
                name: '显示根文件夹',
                desc: '在树中显示根文件夹名称。'
            },
            inheritFolderColors: {
                name: '继承文件夹颜色',
                desc: '子文件夹从父文件夹继承颜色。'
            },
            showNoteCount: {
                name: '显示笔记数',
                desc: '在每个文件夹和标签旁显示笔记数量。'
            },
            showIcons: {
                name: '显示图标',
                desc: '在导航面板中的文件夹和标签旁显示图标。'
            },
            collapseBehavior: {
                name: '折叠项目',
                desc: '选择展开/折叠全部按钮影响的内容。',
                options: {
                    all: '所有文件夹和标签',
                    foldersOnly: '仅文件夹',
                    tagsOnly: '仅标签'
                }
            },
            smartCollapse: {
                name: '保持选中项展开',
                desc: '折叠时，保持当前选中的文件夹或标签及其父级展开。'
            },
            navIndent: {
                name: '树形缩进',
                desc: '调整嵌套文件夹和标签的缩进宽度。'
            },
            navItemHeight: {
                name: '行高',
                desc: '调整导航窗格中文件夹和标签的高度。'
            },
            navItemHeightScaleText: {
                name: '随行高调整文字大小',
                desc: '降低行高时减小导航文字大小。'
            },
            showTags: {
                name: '显示标签 (*)',
                desc: '在导航器中的文件夹下方显示标签部分。'
            },
            showTagsAboveFolders: {
                name: '在文件夹上方显示标签',
                desc: '在导航器中的文件夹之前显示标签部分。'
            },
            showFavoriteTagsFolder: {
                name: '显示收藏文件夹',
                desc: '当配置了收藏标签时，将"收藏"显示为可折叠文件夹。'
            },
            showAllTagsFolder: {
                name: '显示标签文件夹',
                desc: '将"标签"显示为可折叠文件夹。'
            },
            showUntagged: {
                name: '显示无标签笔记',
                desc: '为没有任何标签的笔记显示"无标签"项目。'
            },
            showUntaggedInFavorites: {
                name: '在收藏部分显示无标签笔记',
                desc: '在收藏部分显示无标签笔记，可以在文件夹内或直接在收藏下方显示。'
            },
            favoriteTags: {
                name: '收藏标签',
                desc: '标签前缀的逗号分隔列表。添加标签包含所有子标签（例如："photo"包含"photo/camera/fuji"）。',
                placeholder: '收件箱, 项目/工作, 日记/2025'
            },
            hiddenTags: {
                name: '隐藏标签',
                desc: '要隐藏的标签前缀或名称通配符的逗号分隔列表。使用 `tag*` 或 `*tag` 匹配标签名称。隐藏标签也会隐藏所有子标签（例如："归档"隐藏"归档/2024/docs"）。',
                placeholder: '内部, 临时/草稿, 归档/2024'
            },
            enableFolderNotes: {
                name: '启用文件夹笔记',
                desc: '启用后，具有关联笔记的文件夹将显示为可点击的链接。'
            },
            folderNoteType: {
                name: '默认文件夹笔记类型',
                desc: '从上下文菜单创建的文件夹笔记类型。',
                options: {
                    markdown: 'Markdown',
                    canvas: 'Canvas',
                    base: 'Base'
                }
            },
            folderNoteName: {
                name: '文件夹笔记名称',
                desc: '文件夹笔记的名称。留空以使用与文件夹相同的名称。',
                placeholder: '留空以使用文件夹名称'
            },
            folderNoteProperties: {
                name: '文件夹笔记属性',
                desc: '添加到新创建的文件夹笔记的 frontmatter 属性（逗号分隔）。',
                placeholder: 'foldernote, darktheme'
            },
            hideFolderNoteInList: {
                name: '在列表中隐藏文件夹笔记',
                desc: '隐藏文件夹笔记，使其不出现在文件夹的笔记列表中。'
            },
            confirmBeforeDelete: {
                name: '删除前确认',
                desc: '删除笔记或文件夹时显示确认对话框'
            },
            metadataCleanup: {
                name: '清理插件设置',
                desc: '移除在您的仓库中不再存在的文件、文件夹和标签的已保存设置。这仅影响 Notebook Navigator 设置文件。',
                buttonText: '清理设置',
                success: '设置清理完成',
                successNoChanges: '未找到未使用的设置',
                error: '设置清理失败'
            },
            externalIcons: {
                downloadButton: '下载',
                downloadingLabel: '正在下载...',
                removeButton: '移除',
                statusInstalled: '已下载 (版本 {version})',
                statusNotInstalled: '未下载',
                versionUnknown: '未知',
                downloadFailed: '下载{name}失败。请检查您的连接并重试。',
                removeFailed: '移除{name}失败。',
                infoNote:
                    '下载的图标包会在设备之间同步安装状态。字体保存在每个设备的本地数据库中；同步仅跟踪它们是否应该被下载或移除。字体从Notebook Navigator仓库下载 (https://github.com/johansan/notebook-navigator/tree/main/icon-assets)。',
                providers: {
                    bootstrapIconsDesc: 'https://icons.getbootstrap.com/',
                    fontAwesomeDesc: 'https://fontawesome.com/v6/search?f=classic&s=solid&ic=free&o=r',
                    materialIconsDesc: 'https://fonts.google.com/icons',
                    phosphorDesc: 'https://phosphoricons.com/',
                    rpgAwesomeDesc: 'https://nagoshiashumari.github.io/Rpg-Awesome/'
                }
            },
            useFrontmatterDates: {
                name: '从前言读取元数据 (*)',
                desc: '如果可用，从前言读取笔记名称和时间戳，否则使用文件系统值'
            },
            frontmatterNameField: {
                name: '名称字段',
                desc: '用作笔记显示名称的前言字段。留空使用文件名。',
                placeholder: '标题'
            },
            frontmatterCreatedField: {
                name: '创建时间戳字段',
                desc: '创建时间戳的前言字段名称。留空仅使用文件系统日期。',
                placeholder: '创建时间'
            },
            frontmatterModifiedField: {
                name: '修改时间戳字段',
                desc: '修改时间戳的前言字段名称。留空仅使用文件系统日期。',
                placeholder: '修改时间'
            },
            frontmatterDateFormat: {
                name: '时间戳格式',
                desc: '用于解析前言中时间戳的格式。留空使用 ISO 8601 格式',
                helpTooltip: '查看 date-fns 格式文档',
                help: "常用格式:\nyyyy-MM-dd'T'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM"
            },
            supportDevelopment: {
                name: '支持开发',
                desc: '如果您喜欢使用笔记本导航器，请考虑支持其持续开发。',
                buttonText: '❤️ 在 GitHub 上赞助'
            },
            whatsNew: {
                name: '最新动态',
                desc: '查看最近的更新和改进',
                buttonText: '查看最近更新'
            },
            cacheStatistics: {
                localCache: '(*) 本地缓存',
                items: '项',
                withTags: '包含标签',
                withPreviewText: '包含预览文本',
                withFeatureImage: '包含特色图片',
                withMetadata: '包含元数据'
            },
            metadataInfo: {
                successfullyParsed: '成功解析',
                itemsWithName: '个带名称的项目',
                withCreatedDate: '个带创建日期',
                withModifiedDate: '个带修改日期',
                failedToParse: '解析失败',
                createdDates: '个创建日期',
                modifiedDates: '个修改日期',
                checkTimestampFormat: '请检查您的时间戳格式。',
                exportFailed: '导出错误'
            }
        }
    },
    whatsNew: {
        title: 'Notebook Navigator 的新功能',
        supportMessage: '如果您觉得 Notebook Navigator 有用，请考虑支持其开发。',
        supportButton: '请我喝咖啡',
        thanksButton: '谢谢！'
    }
};
