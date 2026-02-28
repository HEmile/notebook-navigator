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
 * Traditional Chinese (zh-TW) language strings for Notebook Navigator
 * Organized by feature/component for easy maintenance
 */
export const STRINGS_ZH_TW = {
    // Common UI elements
    common: {
        cancel: '取消',
        delete: '刪除',
        clear: '清除',
        remove: '移除',
        submit: '提交',
        noSelection: '未選擇',
        untagged: '無標籤',
        featureImageAlt: '特色圖片',
        unknownError: '未知錯誤',
        clipboardWriteError: '無法寫入剪貼簿',
        updateBannerTitle: 'Notebook Navigator 有可用更新',
        updateBannerInstruction: '在設定 -> 社群外掛中更新',
        previous: '上一個', // Generic aria label for previous navigation (English: Previous)
        next: '下一個' // Generic aria label for next navigation (English: Next)
    },

    // List pane
    listPane: {
        emptyStateNoSelection: '選擇資料夾或標籤以檢視筆記',
        emptyStateNoNotes: '無筆記',
        pinnedSection: '已釘選',
        notesSection: '筆記',
        filesSection: '檔案',
        hiddenItemAriaLabel: '{name} (已隱藏)'
    },

    // Tag list
    tagList: {
        untaggedLabel: '無標籤',
        tags: '標籤'
    },

    navigationPane: {
        shortcutsHeader: '捷徑',
        recentNotesHeader: '最近筆記',
        recentFilesHeader: '最近檔案',
        properties: '屬性',
        reorderRootFoldersTitle: '重新排列導覽',
        reorderRootFoldersHint: '使用方向鍵或拖曳來重新排列',
        vaultRootLabel: '保險庫',
        resetRootToAlpha: '重設為字母順序',
        resetRootToFrequency: '重設為頻率排序',
        pinShortcuts: '釘選捷徑',
        pinShortcutsAndRecentNotes: '釘選捷徑和最近筆記',
        pinShortcutsAndRecentFiles: '釘選捷徑和最近檔案',
        unpinShortcuts: '取消釘選捷徑',
        unpinShortcutsAndRecentNotes: '取消釘選捷徑和最近筆記',
        unpinShortcutsAndRecentFiles: '取消釘選捷徑和最近檔案',
        profileMenuAria: '變更保險庫設定檔'
    },

    navigationCalendar: {
        ariaLabel: '導覽日曆',
        dailyNotesNotEnabled: '未啟用每日筆記。請在 Obsidian 設定 → 核心外掛中啟用每日筆記。',
        createDailyNote: {
            title: '建立每日筆記',
            message: '每日筆記 {filename} 不存在。是否建立？',
            confirmButton: '建立'
        },
        helpModal: {
            title: '行事曆快捷鍵',
            items: [
                '點擊任意日期以開啟或建立每日筆記。週、月、季度和年份的操作方式相同。',
                '日期下方的實心圓點表示有筆記。空心圓點表示有未完成的任務。',
                '如果筆記有特色圖片，它會顯示為該日期的背景。'
            ],
            dateFilterCmdCtrl: '`Cmd/Ctrl`+點擊日期，按該日期篩選檔案列表。',
            dateFilterOptionAlt: '`Option/Alt`+點擊日期，按該日期篩選檔案列表。'
        }
    },

    dailyNotes: {
        templateReadFailed: '讀取每日筆記範本失敗',
        createFailed: '建立每日筆記失敗'
    },

    shortcuts: {
        folderExists: '資料夾已在捷徑中',
        noteExists: '筆記已在捷徑中',
        tagExists: '標籤已在捷徑中',
        propertyExists: '屬性已在捷徑中',
        invalidProperty: '無效的屬性捷徑',
        searchExists: '搜尋捷徑已存在',
        emptySearchQuery: '儲存前請輸入搜尋查詢',
        emptySearchName: '儲存搜尋前請輸入名稱',
        add: '新增至捷徑',
        addNotesCount: '新增 {count} 個筆記至捷徑',
        addFilesCount: '新增 {count} 個檔案至捷徑',
        rename: '重新命名捷徑',
        remove: '從捷徑移除',
        removeAll: '移除所有捷徑',
        removeAllConfirm: '移除所有捷徑？',
        folderNotesPinned: '已釘選 {count} 個資料夾筆記'
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: '摺疊項目',
        expandAllFolders: '展開所有項目',
        showCalendar: '顯示日曆',
        hideCalendar: '隱藏日曆',
        newFolder: '新建資料夾',
        newNote: '新筆記',
        mobileBackToNavigation: '返回導覽',
        changeSortOrder: '變更排序方式',
        defaultSort: '預設',
        showFolders: '顯示導覽',
        reorderRootFolders: '重新排列導覽',
        finishRootFolderReorder: '完成重新排列',
        showExcludedItems: '顯示隱藏的資料夾、標籤和筆記',
        hideExcludedItems: '隱藏隱藏的資料夾、標籤和筆記',
        showDualPane: '顯示雙窗格',
        showSinglePane: '顯示單窗格',
        changeAppearance: '變更外觀',
        showNotesFromSubfolders: '顯示子資料夾的筆記',
        showFilesFromSubfolders: '顯示子資料夾的檔案',
        showNotesFromDescendants: '顯示後代的筆記',
        showFilesFromDescendants: '顯示後代的檔案',
        search: '搜尋'
    },
    // Search input
    searchInput: {
        placeholder: '搜尋...',
        placeholderOmnisearch: 'Omnisearch...',
        clearSearch: '清除搜尋',
        switchToFilterSearch: '切換到篩選搜尋',
        switchToOmnisearch: '切換到 Omnisearch',
        saveSearchShortcut: '將搜尋儲存至捷徑',
        removeSearchShortcut: '從捷徑移除搜尋',
        shortcutModalTitle: '儲存搜尋捷徑',
        shortcutNamePlaceholder: '輸入捷徑名稱',
        shortcutStartIn: '始終從此處開始: {path}',
        searchHelp: '搜尋語法',
        searchHelpTitle: '搜尋語法',
        searchHelpModal: {
            intro: '在一個查詢中組合檔案名稱、屬性、標籤、日期和篩選器（例如：`meeting .status=active #work @thisweek`）。安裝 Omnisearch 外掛程式以使用全文搜尋。',
            introSwitching: '使用上/下箭頭鍵或點擊搜尋圖示在篩選搜尋和 Omnisearch 之間切換。',
            sections: {
                fileNames: {
                    title: '檔案名稱',
                    items: [
                        '`word` 尋找檔案名稱中含有 "word" 的筆記。',
                        '`word1 word2` 每個詞都必須符合檔案名稱。',
                        '`-word` 排除檔案名稱中含有 "word" 的筆記。'
                    ]
                },
                tags: {
                    title: '標籤',
                    items: [
                        '`#tag` 包含帶有標籤的筆記（也符合巢狀標籤如 `#tag/subtag`）。',
                        '`#` 僅包含有標籤的筆記。',
                        '`-#tag` 排除帶有標籤的筆記。',
                        '`-#` 僅包含無標籤的筆記。',
                        '`#tag1 #tag2` 符合兩個標籤（隱式 AND）。',
                        '`#tag1 AND #tag2` 符合兩個標籤（顯式 AND）。',
                        '`#tag1 OR #tag2` 符合任一標籤。',
                        '`#a OR #b AND #c` AND 優先順序較高：符合 `#a`，或同時符合 `#b` 和 `#c`。',
                        'Cmd/Ctrl+點擊標籤以 AND 方式新增。Cmd/Ctrl+Shift+點擊以 OR 方式新增。'
                    ]
                },
                properties: {
                    title: '屬性',
                    items: [
                        '`.key` 包含具有屬性鍵的筆記。',
                        '`.key=value` 包含具有屬性值的筆記。',
                        '`."Reading Status"` 包含屬性鍵包含空格的筆記。',
                        '`."Reading Status"="In Progress"` 包含空格的鍵和值必須用雙引號括起來。',
                        '`-.key` 排除具有屬性鍵的筆記。',
                        '`-.key=value` 排除具有屬性值的筆記。',
                        'Cmd/Ctrl+點擊屬性以 AND 方式新增。Cmd/Ctrl+Shift+點擊以 OR 方式新增。'
                    ]
                },
                tasks: {
                    title: '篩選器',
                    items: [
                        '`has:task` 包含有未完成任務的筆記。',
                        '`-has:task` 排除有未完成任務的筆記。',
                        '`folder:meetings` 包含資料夾名稱含有 `meetings` 的筆記。',
                        '`folder:/work/meetings` 僅包含 `work/meetings` 中的筆記（不含子資料夾）。',
                        '`folder:/` 僅包含保管庫根目錄中的筆記。',
                        '`-folder:archive` 排除資料夾名稱含有 `archive` 的筆記。',
                        '`-folder:/archive` 僅排除 `archive` 中的筆記（不含子資料夾）。',
                        '`ext:md` 包含副檔名為 `md` 的筆記（也支援 `ext:.md`）。',
                        '`-ext:pdf` 排除副檔名為 `pdf` 的筆記。',
                        '與標籤、名稱和日期組合使用（例如：`folder:/work/meetings ext:md @thisweek`）。'
                    ]
                },
                connectors: {
                    title: 'AND/OR 行為',
                    items: [
                        '`AND` 和 `OR` 僅在純標籤/屬性查詢中作為運算子。',
                        '純標籤/屬性查詢僅包含標籤和屬性篩選器: `#tag`、`-#tag`、`#`、`-#`、`.key`、`-.key`、`.key=value`、`-.key=value`。',
                        '如果查詢包含名稱、日期（`@...`）、任務篩選器（`has:task`）、資料夾篩選器（`folder:...`）或副檔名篩選器（`ext:...`），`AND` 和 `OR` 將作為詞語進行比對。',
                        '運算子查詢範例: `#work OR .status=started`。',
                        '混合查詢範例：`#work OR ext:md`（`OR` 在檔案名稱中進行比對）。'
                    ]
                },
                dates: {
                    title: '日期',
                    items: [
                        '`@today` 使用預設日期欄位尋找今天的筆記。',
                        '`@yesterday`、`@last7d`、`@last30d`、`@thisweek`、`@thismonth` 相對日期範圍。',
                        '`@2026-02-07` 尋找特定日期（也支援 `@20260207`）。',
                        '`@2026` 尋找日曆年。',
                        '`@2026-02` 或 `@202602` 尋找日曆月。',
                        '`@2026-W05` 或 `@2026W05` 尋找 ISO 週。',
                        '`@2026-Q2` 或 `@2026Q2` 尋找日曆季度。',
                        '`@13/02/2026` 帶分隔符的數字格式（`@07022026` 在歧義時遵循您的地區設定）。',
                        '`@2026-02-01..2026-02-07` 尋找包含性日期範圍（支援開放端點）。',
                        '`@c:...` 或 `@m:...` 指定建立或修改日期。',
                        '`-@...` 排除日期符合。'
                    ]
                },
                omnisearch: {
                    title: 'Omnisearch',
                    items: [
                        '對整個保管庫進行全文搜尋，按目前資料夾或選定標籤篩選。',
                        '在大型保管庫中輸入少於3個字元時可能會較慢。',
                        '無法搜尋包含非ASCII字元的路徑，也無法正確搜尋子路徑。',
                        '在資料夾篩選之前返回有限的結果，因此如果其他地方存在大量符合項，相關檔案可能不會顯示。',
                        '筆記預覽顯示 Omnisearch 摘錄，而不是預設預覽文字。'
                    ]
                }
            }
        }
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: '在新分頁中開啟',
            openToRight: '在右側開啟',
            openInNewWindow: '在新視窗中開啟',
            openMultipleInNewTabs: '在新分頁中開啟 {count} 個筆記',
            openMultipleToRight: '在右側開啟 {count} 個筆記',
            openMultipleInNewWindows: '在新視窗中開啟 {count} 個筆記',
            pinNote: '釘選筆記',
            unpinNote: '取消釘選筆記',
            pinMultipleNotes: '釘選 {count} 個筆記',
            unpinMultipleNotes: '取消釘選 {count} 個筆記',
            duplicateNote: '複製筆記',
            duplicateMultipleNotes: '複製 {count} 個筆記',
            openVersionHistory: '開啟版本歷史',
            revealInFolder: '在資料夾中定位',
            revealInFinder: '在 Finder 中顯示',
            showInExplorer: '在檔案總管中顯示',
            openInDefaultApp: '以預設應用程式開啟',
            renameNote: '重新命名筆記',
            deleteNote: '刪除筆記',
            deleteMultipleNotes: '刪除 {count} 個筆記',
            moveNoteToFolder: '移動筆記至...',
            moveFileToFolder: '移動檔案至...',
            moveMultipleNotesToFolder: '將 {count} 個筆記移動至...',
            moveMultipleFilesToFolder: '將 {count} 個檔案移動至...',
            addTag: '新增標籤',
            addPropertyKey: '設定屬性',
            removeTag: '移除標籤',
            removeAllTags: '移除所有標籤',
            changeIcon: '變更圖示',
            changeColor: '變更顏色',
            // File-specific context menu items (non-markdown files)
            openMultipleFilesInNewTabs: '在新分頁中開啟 {count} 個檔案',
            openMultipleFilesToRight: '在右側開啟 {count} 個檔案',
            openMultipleFilesInNewWindows: '在新視窗中開啟 {count} 個檔案',
            pinFile: '釘選檔案',
            unpinFile: '取消釘選檔案',
            pinMultipleFiles: '釘選 {count} 個檔案',
            unpinMultipleFiles: '取消釘選 {count} 個檔案',
            duplicateFile: '複製檔案',
            duplicateMultipleFiles: '複製 {count} 個檔案',
            renameFile: '重新命名檔案',
            deleteFile: '刪除檔案',
            deleteMultipleFiles: '刪除 {count} 個檔案'
        },
        folder: {
            newNote: '新筆記',
            newNoteFromTemplate: '從範本新建筆記',
            newFolder: '新建資料夾',
            newCanvas: '新建畫布',
            newBase: '新建資料庫',
            newDrawing: '新建繪圖',
            newExcalidrawDrawing: '新建 Excalidraw 繪圖',
            newTldrawDrawing: '新建 Tldraw 繪圖',
            duplicateFolder: '複製資料夾',
            searchInFolder: '在資料夾中搜尋',
            createFolderNote: '建立資料夾筆記',
            detachFolderNote: '解除資料夾筆記',
            deleteFolderNote: '刪除資料夾筆記',
            changeIcon: '變更圖示',
            changeColor: '變更顏色',
            changeBackground: '變更背景',
            excludeFolder: '隱藏資料夾',
            unhideFolder: '顯示資料夾',
            moveFolder: '移動資料夾至...',
            renameFolder: '重新命名資料夾',
            deleteFolder: '刪除資料夾'
        },
        tag: {
            changeIcon: '變更圖示',
            changeColor: '變更顏色',
            changeBackground: '變更背景',
            showTag: '顯示標籤',
            hideTag: '隱藏標籤'
        },
        property: {
            addKey: '設定屬性鍵',
            renameKey: '重新命名屬性',
            deleteKey: '刪除屬性'
        },
        navigation: {
            addSeparator: '新增分隔線',
            removeSeparator: '移除分隔線'
        },
        copyPath: {
            title: '複製路徑',
            asObsidianUrl: '作為 Obsidian URL',
            fromVaultFolder: '從保險庫資料夾',
            fromSystemRoot: '從系統根目錄'
        },
        style: {
            title: '樣式',
            copy: '複製樣式',
            paste: '貼上樣式',
            removeIcon: '移除圖示',
            removeColor: '移除顏色',
            removeBackground: '移除背景',
            clear: '清除樣式'
        }
    },

    // Folder appearance menu
    folderAppearance: {
        standardPreset: '標準',
        compactPreset: '精簡',
        defaultSuffix: '(預設)',
        defaultLabel: '預設',
        titleRows: '標題行數',
        previewRows: '預覽行數',
        groupBy: '分組依據',
        defaultTitleOption: (rows: number) => `預設標題行數 (${rows})`,
        defaultPreviewOption: (rows: number) => `預設預覽行數 (${rows})`,
        defaultGroupOption: (groupLabel: string) => `預設分組 (${groupLabel})`,
        titleRowOption: (rows: number) => `標題${rows}行`,
        previewRowOption: (rows: number) => `預覽${rows}行`
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: '搜尋圖示...',
            recentlyUsedHeader: '最近使用',
            emptyStateSearch: '開始輸入以搜尋圖示',
            emptyStateNoResults: '未找到圖示',
            showingResultsInfo: '顯示 {count} 個結果中的 50 個。輸入更多內容以縮小範圍。',
            emojiInstructions: '輸入或貼上任何表情符號作為圖示使用',
            removeIcon: '移除圖示',
            removeFromRecents: '從最近使用中移除',
            allTabLabel: '全部'
        },
        fileIconRuleEditor: {
            addRuleAria: '新增規則'
        },
        interfaceIcons: {
            title: '介面圖示',
            fileItemsSection: '檔案項目',
            items: {
                'nav-shortcuts': '捷徑',
                'nav-recent-files': '最近檔案',
                'nav-expand-all': '全部展開',
                'nav-collapse-all': '全部摺疊',
                'nav-calendar': '日曆',
                'nav-tree-expand': '樹狀箭頭: 展開',
                'nav-tree-collapse': '樹狀箭頭: 摺疊',
                'nav-hidden-items': '隱藏項目',
                'nav-root-reorder': '重新排列根資料夾',
                'nav-new-folder': '新建資料夾',
                'nav-show-single-pane': '顯示單窗格',
                'nav-show-dual-pane': '顯示雙窗格',
                'nav-profile-chevron': '設定檔選單箭頭',
                'list-search': '搜尋',
                'list-descendants': '子資料夾中的筆記',
                'list-sort-ascending': '排序: 升序',
                'list-sort-descending': '排序: 降序',
                'list-appearance': '變更外觀',
                'list-new-note': '新建筆記',
                'nav-folder-open': '資料夾開啟',
                'nav-folder-closed': '資料夾關閉',
                'nav-tags': '標籤',
                'nav-tag': '標籤',
                'nav-properties': '屬性',
                'nav-property': '屬性',
                'nav-property-value': '值',
                'list-pinned': '釘選項目',
                'file-unfinished-task': '未完成任務',
                'file-word-count': '字數統計'
            }
        },
        colorPicker: {
            currentColor: '目前',
            newColor: '新顏色',
            paletteDefault: '預設',
            paletteCustom: '自訂',
            copyColors: '複製顏色',
            colorsCopied: '顏色已複製到剪貼簿',
            pasteColors: '貼上顏色',
            pasteClipboardError: '無法讀取剪貼簿',
            pasteInvalidFormat: '需要十六進位顏色值',
            colorsPasted: '顏色貼上成功',
            resetUserColors: '清除自訂顏色',
            clearCustomColorsConfirm: '刪除所有自訂顏色？',
            userColorSlot: '顏色 {slot}',
            recentColors: '最近使用的顏色',
            clearRecentColors: '清除最近使用的顏色',
            removeRecentColor: '移除顏色',
            removeColor: '移除顏色',
            apply: '套用',
            hexLabel: 'HEX',
            rgbLabel: 'RGBA'
        },
        selectVaultProfile: {
            title: '選擇保險庫設定檔',
            currentBadge: '使用中',
            emptyState: '沒有可用的保險庫設定檔。'
        },
        tagOperation: {
            renameTitle: '重新命名標籤 {tag}',
            deleteTitle: '刪除標籤 {tag}',
            newTagPrompt: '新標籤名稱',
            newTagPlaceholder: '輸入新標籤名稱',
            renameWarning: '重新命名標籤 {oldTag} 將修改 {count} 個{files}。',
            deleteWarning: '刪除標籤 {tag} 將修改 {count} 個{files}。',
            modificationWarning: '這將更新檔案修改日期。',
            affectedFiles: '受影響的檔案：',
            andMore: '以及 {count} 個更多...',
            confirmRename: '重新命名標籤',
            renameUnchanged: '{tag} 未變更',
            renameNoChanges: '{oldTag} → {newTag} ({countLabel})',
            renameBatchNotFinalized: '已重新命名 {renamed}/{total}。未更新：{notUpdated}。中繼資料和捷徑未更新。',
            invalidTagName: '請輸入有效的標籤名稱。',
            descendantRenameError: '無法將標籤移動到自身或其子標籤中。',
            confirmDelete: '刪除標籤',
            deleteBatchNotFinalized: '已從 {removed}/{total} 中刪除。未更新：{notUpdated}。中繼資料和捷徑未更新。',
            checkConsoleForDetails: '查看主控台了解詳情。',
            file: '個檔案',
            files: '個檔案',
            inlineParsingWarning: {
                title: '內嵌標籤相容性',
                message: '{tag} 包含 Obsidian 無法在內嵌標籤中解析的字元。Frontmatter 標籤不受影響。',
                confirm: '仍然使用'
            }
        },
        propertyOperation: {
            renameTitle: '重新命名屬性 {property}',
            deleteTitle: '刪除屬性 {property}',
            newKeyPrompt: '新屬性名稱',
            newKeyPlaceholder: '輸入新屬性名稱',
            renameWarning: '重新命名屬性 {property} 將修改 {count} 個{files}。',
            renameConflictWarning: '屬性 {newKey} 已存在於 {count} 個{files}中。重新命名 {oldKey} 將取代現有的 {newKey} 值。',
            deleteWarning: '刪除屬性 {property} 將修改 {count} 個{files}。',
            confirmRename: '重新命名屬性',
            confirmDelete: '刪除屬性',
            renameNoChanges: '{oldKey} → {newKey}（無變更）',
            renameSettingsUpdateFailed: '已重新命名屬性 {oldKey} → {newKey}。更新設定失敗。',
            deleteSingleSuccess: '已從 1 篇筆記中刪除屬性 {property}',
            deleteMultipleSuccess: '已從 {count} 篇筆記中刪除屬性 {property}',
            deleteSettingsUpdateFailed: '已刪除屬性 {property}。更新設定失敗。',
            invalidKeyName: '請輸入有效的屬性名稱。'
        },
        fileSystem: {
            newFolderTitle: '新建資料夾',
            renameFolderTitle: '重新命名資料夾',
            renameFileTitle: '重新命名檔案',
            deleteFolderTitle: "刪除 '{name}'？",
            deleteFileTitle: "刪除 '{name}'？",
            deleteFileAttachmentsTitle: '刪除檔案附件？',
            moveFileConflictTitle: '移動衝突',
            folderNamePrompt: '輸入資料夾名稱：',
            hideInOtherVaultProfiles: '在其他保險庫設定檔中隱藏',
            renamePrompt: '輸入新名稱：',
            renameVaultTitle: '變更保險庫顯示名稱',
            renameVaultPrompt: '輸入自訂顯示名稱（留空使用預設值）：',
            deleteFolderConfirm: '您確定要刪除此資料夾及其所有內容嗎？',
            deleteFileConfirm: '您確定要刪除此檔案嗎？',
            deleteFileAttachmentsDescriptionSingle: '此附件不再被任何筆記使用。是否要刪除？',
            deleteFileAttachmentsDescriptionMultiple: '這些附件不再被任何筆記使用。是否要刪除？',
            deleteFileAttachmentsViewFileTreeAriaLabel: '檔案樹',
            deleteFileAttachmentsViewGalleryAriaLabel: '圖庫',
            moveFileConflictDescriptionSingle: '在「{folder}」中發現檔案衝突。',
            moveFileConflictDescriptionMultiple: '在「{folder}」中發現 {count} 個檔案衝突。',
            moveFileConflictAffectedFiles: '受影響的檔案',
            moveFileConflictItem: '「{name}」->「{suggested}」{renameOnly}',
            moveFileConflictRenameOnly: '（僅重新命名）',
            moveFileConflictRename: '重新命名',
            moveFileConflictOverwrite: '覆蓋',
            removeAllTagsTitle: '移除所有標籤',
            removeAllTagsFromNote: '您確定要從這個筆記中移除所有標籤嗎？',
            removeAllTagsFromNotes: '您確定要從 {count} 個筆記中移除所有標籤嗎？'
        },
        folderNoteType: {
            title: '選擇資料夾筆記類型',
            folderLabel: '資料夾：{name}'
        },
        folderSuggest: {
            placeholder: (name: string) => `將 ${name} 移動至資料夾...`,
            multipleFilesLabel: (count: number) => `${count} 個檔案`,
            navigatePlaceholder: '導覽至資料夾...',
            instructions: {
                navigate: '導覽',
                move: '移動',
                select: '選擇',
                dismiss: '取消'
            }
        },
        homepage: {
            placeholder: '搜尋檔案...',
            instructions: {
                navigate: '導覽',
                select: '設為首頁',
                dismiss: '取消'
            }
        },
        calendarTemplate: {
            placeholder: '搜尋範本...',
            instructions: {
                navigate: '導覽',
                select: '選擇範本',
                dismiss: '取消'
            }
        },
        navigationBanner: {
            placeholder: '搜尋圖片...',
            instructions: {
                navigate: '導覽',
                select: '設為橫幅',
                dismiss: '取消'
            }
        },
        tagSuggest: {
            navigatePlaceholder: '導覽至標籤...',
            addPlaceholder: '搜尋要新增的標籤...',
            removePlaceholder: '選擇要移除的標籤...',
            createNewTag: '建立新標籤: #{tag}',
            instructions: {
                navigate: '導覽',
                select: '選擇',
                dismiss: '取消',
                add: '新增標籤',
                remove: '移除標籤'
            }
        },
        propertySuggest: {
            placeholder: '選擇屬性鍵...',
            navigatePlaceholder: '導航到屬性...',
            instructions: {
                navigate: '導覽',
                select: '新增屬性',
                dismiss: '取消'
            }
        },
        propertyKeyVisibility: {
            title: '屬性鍵可見性',
            description: '控制屬性值的顯示位置。各欄分別對應導航面板、列表面板和檔案上下文選單。使用底部列切換某欄中的所有列。',
            searchPlaceholder: '搜尋屬性鍵...',
            propertyColumnLabel: '屬性',
            showInNavigation: '在導覽中顯示',
            showInList: '在清單中顯示',
            showInFileMenu: '在檔案選單中顯示',
            toggleAllInNavigation: '切換導覽中的全部',
            toggleAllInList: '切換清單中的全部',
            toggleAllInFileMenu: '切換檔案選單中的全部',
            applyButton: '套用',
            emptyState: '未找到屬性鍵。'
        },
        welcome: {
            title: '歡迎使用 {pluginName}',
            introText: '您好！在開始之前，強烈建議您觀看下方影片的前五分鐘，以了解面板和「顯示子資料夾中的筆記」開關是如何運作的。',
            continueText: '如果您還有五分鐘時間，請繼續觀看影片以了解精簡顯示模式以及如何正確設定捷徑和重要的快速鍵。',
            thanksText: '非常感謝您的下載，祝您使用愉快！',
            videoAlt: '安裝與精通 Notebook Navigator',
            openVideoButton: '播放影片',
            closeButton: '以後再說'
        }
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: '建立資料夾失敗：{error}',
            createFile: '建立檔案失敗：{error}',
            renameFolder: '重新命名資料夾失敗：{error}',
            renameFolderNoteConflict: '無法重新命名：「{name}」已在此資料夾中存在',
            renameFile: '重新命名檔案失敗：{error}',
            deleteFolder: '刪除資料夾失敗：{error}',
            deleteFile: '刪除檔案失敗：{error}',
            deleteAttachments: '刪除附件失敗: {error}',
            duplicateNote: '複製筆記失敗：{error}',
            duplicateFolder: '複製資料夾失敗：{error}',
            openVersionHistory: '開啟版本歷史失敗：{error}',
            versionHistoryNotFound: '未找到版本歷史命令。請確保已啟用 Obsidian 同步。',
            revealInExplorer: '在系統檔案總管中定位檔案失敗：{error}',
            openInDefaultApp: '以預設應用程式開啟失敗：{error}',
            openInDefaultAppNotAvailable: '此平台不支援以預設應用程式開啟',
            folderNoteAlreadyExists: '資料夾筆記已存在',
            folderAlreadyExists: '資料夾「{name}」已存在',
            folderNotesDisabled: '請在設定中啟用資料夾筆記以轉換檔案',
            folderNoteAlreadyLinked: '此檔案已作為資料夾筆記',
            folderNoteNotFound: '所選資料夾中沒有資料夾筆記',
            folderNoteUnsupportedExtension: '不支援的檔案副檔名：{extension}',
            folderNoteMoveFailed: '轉換過程中移動檔案失敗：{error}',
            folderNoteRenameConflict: '資料夾中已存在名為「{name}」的檔案',
            folderNoteConversionFailed: '轉換為資料夾筆記失敗',
            folderNoteConversionFailedWithReason: '轉換為資料夾筆記失敗：{error}',
            folderNoteOpenFailed: '檔案已轉換但開啟資料夾筆記失敗：{error}',
            failedToDeleteFile: '刪除 {name} 失敗: {error}',
            failedToDeleteMultipleFiles: '刪除 {count} 個檔案失敗',
            versionHistoryNotAvailable: '版本歷史服務不可用',
            drawingAlreadyExists: '同名繪圖已存在',
            failedToCreateDrawing: '建立繪圖失敗',
            noFolderSelected: 'Notebook Navigator 中未選擇資料夾',
            noFileSelected: '未選擇檔案'
        },
        warnings: {
            linkBreakingNameCharacters: '該名稱包含會破壞 Obsidian 連結的字元：#, |, ^, %%, [[, ]].',
            forbiddenNameCharactersAllPlatforms: '名稱不能以 . 開頭，也不能包含 : 或 /。',
            forbiddenNameCharactersWindows: 'Windows 保留字元不允許使用：<, >, ", \\, |, ?, *。'
        },
        notices: {
            hideFolder: '已隱藏資料夾：{name}',
            showFolder: '已顯示資料夾：{name}'
        },
        notifications: {
            deletedMultipleFiles: '已刪除 {count} 個檔案',
            movedMultipleFiles: '已將 {count} 個檔案移動至 {folder}',
            folderNoteConversionSuccess: '已在「{name}」中將檔案轉換為資料夾筆記',
            folderMoved: '已移動資料夾「{name}」',
            deepLinkCopied: 'Obsidian URL 已複製到剪貼簿',
            pathCopied: '路徑已複製到剪貼簿',
            relativePathCopied: '相對路徑已複製到剪貼簿',
            tagAddedToNote: '已將標籤新增到 1 個筆記',
            tagAddedToNotes: '已將標籤新增到 {count} 個筆記',
            tagRemovedFromNote: '已從 1 個筆記中移除標籤',
            tagRemovedFromNotes: '已從 {count} 個筆記中移除標籤',
            tagsClearedFromNote: '已從 1 個筆記中清除所有標籤',
            tagsClearedFromNotes: '已從 {count} 個筆記中清除所有標籤',
            noTagsToRemove: '沒有可移除的標籤',
            noFilesSelected: '未選擇檔案',
            tagOperationsNotAvailable: '標籤操作不可用',
            propertyOperationsNotAvailable: '屬性操作不可用',
            tagsRequireMarkdown: '標籤僅支援 Markdown 筆記',
            propertiesRequireMarkdown: '屬性僅在 Markdown 筆記中受支援',
            propertySetOnNote: '已在 1 篇筆記中更新屬性',
            propertySetOnNotes: '已在 {count} 篇筆記中更新屬性',
            iconPackDownloaded: '{provider} 已下載',
            iconPackUpdated: '{provider} 已更新 ({version})',
            iconPackRemoved: '{provider} 已移除',
            iconPackLoadFailed: '{provider} 載入失敗',
            hiddenFileReveal: '檔案已隱藏。啟用「顯示隱藏項目」以顯示它'
        },
        confirmations: {
            deleteMultipleFiles: '確定要刪除 {count} 個檔案嗎？',
            deleteConfirmation: '此操作無法復原。'
        },
        defaultNames: {
            untitled: '未命名'
        }
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: '無法將資料夾移動到自身或其子資料夾中。',
            itemAlreadyExists: '此位置已存在名為「{name}」的項目。',
            failedToMove: '移動失敗：{error}',
            failedToAddTag: '新增標籤「{tag}」失敗',
            failedToSetProperty: '更新屬性失敗: {error}',
            failedToClearTags: '清除標籤失敗',
            failedToMoveFolder: '移動資料夾「{name}」失敗',
            failedToImportFiles: '匯入失敗：{names}'
        },
        notifications: {
            filesAlreadyExist: '{count} 個檔案在目標位置已存在',
            filesAlreadyHaveTag: '{count} 個檔案已經有此標籤或更具體的標籤',
            filesAlreadyHaveProperty: '{count} 個檔案已擁有此屬性',
            noTagsToClear: '沒有要清除的標籤',
            fileImported: '已匯入 1 個檔案',
            filesImported: '已匯入 {count} 個檔案'
        }
    },

    // Date grouping
    dateGroups: {
        today: '今天',
        yesterday: '昨天',
        previous7Days: '過去 7 天',
        previous30Days: '過去 30 天'
    },

    // Plugin commands
    commands: {
        open: '開啟',
        toggleLeftSidebar: '切換左側邊欄',
        openHomepage: '開啟首頁',
        openDailyNote: '開啟每日筆記',
        openWeeklyNote: '開啟每週筆記',
        openMonthlyNote: '開啟每月筆記',
        openQuarterlyNote: '開啟季度筆記',
        openYearlyNote: '開啟每年筆記',
        revealFile: '定位檔案',
        search: '搜尋',
        searchVaultRoot: '在保險庫根目錄搜尋',
        toggleDualPane: '切換雙窗格布局',
        toggleCalendar: '切換日曆',
        selectVaultProfile: '變更保險庫設定檔',
        selectVaultProfile1: '切換到保險庫設定檔 1',
        selectVaultProfile2: '切換到保險庫設定檔 2',
        selectVaultProfile3: '切換到保險庫設定檔 3',
        deleteFile: '刪除檔案',
        createNewNote: '建立新筆記',
        createNewNoteFromTemplate: '從範本新建筆記',
        moveFiles: '移動檔案',
        selectNextFile: '選擇下一個檔案',
        selectPreviousFile: '選擇上一個檔案',
        convertToFolderNote: '轉換為資料夾筆記',
        setAsFolderNote: '設為資料夾筆記',
        detachFolderNote: '解除資料夾筆記',
        pinAllFolderNotes: '釘選所有資料夾筆記',
        navigateToFolder: '導覽至資料夾',
        navigateToTag: '導覽至標籤',
        navigateToProperty: '導航到屬性',
        addShortcut: '新增至捷徑',
        openShortcut: '開啟捷徑 {number}',
        toggleDescendants: '切換後代',
        toggleHidden: '切換隱藏的資料夾、標籤和筆記',
        toggleTagSort: '切換標籤排序',
        toggleCompactMode: '切換精簡模式', // Command palette: Toggles list mode between standard and compact (English: Toggle compact mode)
        collapseExpand: '摺疊/展開所有項目',
        addTag: '為選定檔案新增標籤',
        removeTag: '從選定檔案移除標籤',
        removeAllTags: '從選定檔案移除所有標籤',
        openAllFiles: '開啟所有檔案',
        rebuildCache: '重建快取'
    },

    // Plugin UI
    plugin: {
        viewName: '筆記本導覽器',
        calendarViewName: '日曆',
        ribbonTooltip: '筆記本導覽器',
        revealInNavigator: '在筆記本導覽器中定位'
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: '最後修改於',
        createdAt: '建立於',
        file: '個檔案',
        files: '個檔案',
        folder: '個資料夾',
        folders: '個資料夾'
    },

    // Settings
    settings: {
        metadataReport: {
            exportSuccess: '失敗的中繼資料報告已匯出至：{filename}',
            exportFailed: '匯出中繼資料報告失敗'
        },
        sections: {
            general: '一般',
            notes: '筆記',
            navigationPane: '導覽',
            calendar: '導覽日曆',
            files: '檔案',
            icons: '圖示包',
            tags: '標籤',
            folders: '資料夾',
            folderNotes: '資料夾筆記',
            foldersAndTags: '資料夾',
            tagsAndProperties: '標籤與屬性',
            listPane: '列表',
            advanced: '進階'
        },
        groups: {
            general: {
                vaultProfiles: '保險庫設定檔',
                filtering: '篩選',
                templates: '範本',
                behavior: '行為',
                keyboardNavigation: '鍵盤導覽',
                view: '外觀',
                icons: '圖示',
                desktopAppearance: '桌面外觀',
                mobileAppearance: '行動裝置外觀',
                formatting: '格式'
            },
            navigation: {
                appearance: '外觀',
                leftSidebar: '左側邊欄',
                calendarIntegration: '行事曆整合'
            },
            list: {
                display: '外觀',
                pinnedNotes: '釘選筆記'
            },
            notes: {
                frontmatter: '前置中繼資料',
                icon: '圖示',
                title: '標題',
                previewText: '預覽文字',
                featureImage: '特色圖片',
                tags: '標籤',
                properties: '屬性',
                date: '日期',
                parentFolder: '父資料夾'
            }
        },
        syncMode: {
            notSynced: '（未同步）',
            disabled: '（已停用）',
            switchToSynced: '啟用同步',
            switchToLocal: '停用同步'
        },
        items: {
            listPaneTitle: {
                name: '列表窗格標題',
                desc: '選擇列表窗格標題的顯示位置。',
                options: {
                    header: '顯示在標題列',
                    list: '顯示在列表窗格',
                    hidden: '不顯示'
                }
            },
            sortNotesBy: {
                name: '筆記排序方式',
                desc: '選擇筆記列表中的筆記排序方式。',
                options: {
                    'modified-desc': '編輯日期（最新在頂部）',
                    'modified-asc': '編輯日期（最舊在頂部）',
                    'created-desc': '建立日期（最新在頂部）',
                    'created-asc': '建立日期（最舊在頂部）',
                    'title-asc': '標題（升序）',
                    'title-desc': '標題（降序）',
                    'filename-asc': '檔案名稱（升序）',
                    'filename-desc': '檔案名稱（降序）',
                    'property-asc': '屬性（升序）',
                    'property-desc': '屬性（降序）'
                },
                propertyOverride: {
                    asc: '屬性 ‘{property}’（升序）',
                    desc: '屬性 ‘{property}’（降序）'
                }
            },
            propertySortKey: {
                name: '排序屬性',
                desc: '用於屬性排序。具有此 frontmatter 屬性的筆記首先列出，並按屬性值排序。陣列合併為單一值。',
                placeholder: 'order'
            },
            propertySortSecondary: {
                name: '次要排序',
                desc: '與屬性排序配合使用，當筆記具有相同的屬性值或沒有屬性值時生效。',
                options: {
                    title: '標題',
                    filename: '檔案名稱',
                    created: '建立日期',
                    modified: '編輯日期'
                }
            },
            revealFileOnListChanges: {
                name: '列表變更時捲動到選定檔案',
                desc: '在釘選筆記、顯示後代筆記、變更資料夾外觀或執行檔案操作時捲動到選定的檔案。'
            },
            includeDescendantNotes: {
                name: '顯示子資料夾/後代的筆記',
                desc: '在檢視資料夾或標籤時包含巢狀子資料夾和標籤後代中的筆記。'
            },
            limitPinnedToCurrentFolder: {
                name: '將釘選筆記限制在其資料夾',
                desc: '釘選筆記僅在檢視其釘選的資料夾或標籤時顯示。'
            },
            separateNoteCounts: {
                name: '分別顯示目前和後代計數',
                desc: '在資料夾和標籤中以「目前 ▾ 後代」格式顯示筆記計數。'
            },
            groupNotes: {
                name: '分組筆記',
                desc: '在按日期或資料夾分組的筆記之間顯示標題。啟用資料夾分組時，標籤檢視使用日期分組。',
                options: {
                    none: '不分組',
                    date: '按日期分組',
                    folder: '按資料夾分組'
                }
            },
            showPinnedGroupHeader: {
                name: '顯示釘選群組標題',
                desc: '在釘選筆記上方顯示分組標題。'
            },
            showPinnedIcon: {
                name: '顯示釘選圖示',
                desc: '在釘選區段標題旁顯示圖示。'
            },
            defaultListMode: {
                name: '預設列表模式',
                desc: '選擇預設列表布局。標準顯示標題、日期、描述和預覽文字。精簡只顯示標題。外觀可按資料夾覆寫。',
                options: {
                    standard: '標準',
                    compact: '精簡'
                }
            },
            showFileIcons: {
                name: '顯示檔案圖示',
                desc: '顯示檔案圖示並保留左對齊間距。停用後將移除圖示和縮排。優先順序：未完成任務圖示 > 自訂圖示 > 檔名圖示 > 檔案類型圖示 > 預設圖示。'
            },
            showFileIconUnfinishedTask: {
                name: '未完成任務圖示',
                desc: '當筆記包含未完成任務時顯示任務圖示。'
            },
            showFilenameMatchIcons: {
                name: '按檔名設定圖示',
                desc: '根據檔名中的文字指派圖示。'
            },
            fileNameIconMap: {
                name: '檔名圖示對應',
                desc: '包含指定文字的檔案將取得指定圖示。每行一個對應：文字=圖示',
                placeholder: '# 文字=圖示\n會議=LiCalendar\n發票=PhReceipt',
                editTooltip: '編輯對應'
            },
            showCategoryIcons: {
                name: '按檔案類型設定圖示',
                desc: '根據檔案副檔名指派圖示。'
            },
            fileTypeIconMap: {
                name: '檔案類型圖示對應',
                desc: '具有指定副檔名的檔案將取得指定圖示。每行一個對應：副檔名=圖示',
                placeholder: '# 副檔名=圖示\ncpp=LiFileCode\npdf=RaBook',
                editTooltip: '編輯對應'
            },
            optimizeNoteHeight: {
                name: '可變筆記高度',
                desc: '為釘選筆記和無預覽文字的筆記使用精簡高度。'
            },
            compactItemHeight: {
                name: '精簡項目高度',
                desc: '設定桌面和行動裝置的精簡列表項目高度。',
                resetTooltip: '恢復預設值 (28px)'
            },
            compactItemHeightScaleText: {
                name: '隨精簡高度縮放文字',
                desc: '當減小精簡列表項目高度時同步縮放文字。'
            },
            showParentFolder: {
                name: '顯示父資料夾',
                desc: '為子資料夾或標籤中的筆記顯示父資料夾名稱。'
            },
            parentFolderClickRevealsFile: {
                name: '點按父資料夾開啟資料夾',
                desc: '點按父資料夾名稱時，在列表面板中開啟該資料夾。'
            },
            showParentFolderColor: {
                name: '顯示父資料夾顏色',
                desc: '在父資料夾標籤上使用資料夾顏色。'
            },
            showParentFolderIcon: {
                name: '顯示父資料夾圖示',
                desc: '在父資料夾標籤旁顯示資料夾圖示。'
            },
            showQuickActions: {
                name: '顯示快速操作',
                desc: '懸停在檔案上時顯示操作按鈕。按鈕控制項選擇顯示哪些操作。'
            },
            dualPane: {
                name: '雙窗格布局',
                desc: '在桌面端並排顯示導覽窗格和列表窗格。'
            },
            dualPaneOrientation: {
                name: '雙欄布局方向',
                desc: '雙欄啟用時選擇水平或垂直布局。',
                options: {
                    horizontal: '水平分割',
                    vertical: '垂直分割'
                }
            },
            appearanceBackground: {
                name: '背景色',
                desc: '為導覽窗格和列表窗格選擇背景色。',
                options: {
                    separate: '分開背景',
                    primary: '使用列表背景',
                    secondary: '使用導覽背景'
                }
            },
            appearanceScale: {
                name: '縮放級別',
                desc: '控制 Notebook Navigator 的整體縮放級別。'
            },
            useFloatingToolbars: {
                name: '在 iOS/iPadOS 上使用浮動工具列',
                desc: '適用於 Obsidian 1.11 及更高版本。'
            },
            startView: {
                name: '預設啟動檢視',
                desc: '選擇開啟 Notebook Navigator 時顯示的窗格。導覽窗格顯示捷徑、最近筆記和資料夾結構。列表窗格顯示筆記列表。',
                options: {
                    navigation: '導覽窗格',
                    files: '列表窗格'
                }
            },
            toolbarButtons: {
                name: '工具列按鈕',
                desc: '選擇在工具列中顯示哪些按鈕。隱藏的按鈕仍可透過命令和選單存取。',
                navigationLabel: '導覽工具列',
                listLabel: '列表工具列'
            },
            createNewNotesInNewTab: {
                name: '在新分頁中開啟新筆記',
                desc: '啟用後，「建立新筆記」命令會在新分頁中開啟筆記。停用後，筆記將取代目前的分頁。'
            },
            autoRevealActiveNote: {
                name: '自動定位使用中的筆記',
                desc: '從快速切換器、連結或搜尋開啟筆記時自動顯示。'
            },
            autoRevealShortestPath: {
                name: '使用最短路徑',
                desc: '啟用：自動顯示選擇最近的可見祖先資料夾或標籤。停用：自動顯示選擇檔案的實際資料夾和精確標籤。'
            },
            autoRevealIgnoreRightSidebar: {
                name: '忽略右側邊欄事件',
                desc: '在右側邊欄中點按或變更筆記時不變更使用中的筆記。'
            },
            paneTransitionDuration: {
                name: '單窗格動畫',
                desc: '在單窗格模式下切換窗格時的過渡持續時間（毫秒）。',
                resetTooltip: '重設為預設值'
            },
            autoSelectFirstFileOnFocusChange: {
                name: '自動選擇第一個筆記',
                desc: '切換資料夾或標籤時自動開啟第一個筆記。'
            },
            skipAutoScroll: {
                name: '停用捷徑自動捲動',
                desc: '點按捷徑中的項目時不捲動導覽面板。'
            },
            autoExpandNavItems: {
                name: '選取時展開',
                desc: '選取時展開資料夾和標籤。在單窗格模式下，首次選取展開，再次選取顯示檔案。'
            },
            springLoadedFolders: {
                name: '拖曳時展開',
                desc: '拖曳操作中懸停時展開資料夾和標籤。'
            },
            springLoadedFoldersInitialDelay: {
                name: '首次展開延遲',
                desc: '拖曳時首次展開資料夾或標籤前的延遲（秒）。'
            },
            springLoadedFoldersSubsequentDelay: {
                name: '後續展開延遲',
                desc: '同一次拖曳中展開更多資料夾或標籤前的延遲（秒）。'
            },
            navigationBanner: {
                name: '導覽橫幅（保險庫設定檔）',
                desc: '在導覽窗格頂部顯示一張圖片。隨所選保險庫設定檔而變化。',
                current: '目前橫幅：{path}',
                chooseButton: '選擇圖片'
            },
            pinNavigationBanner: {
                name: '固定橫幅',
                desc: '將導航橫幅固定在導航樹上方。'
            },
            showShortcuts: {
                name: '顯示捷徑',
                desc: '在導覽窗格中顯示捷徑區段。'
            },
            shortcutBadgeDisplay: {
                name: '捷徑徽章',
                desc: '在捷徑旁邊顯示的內容。使用「開啟捷徑 1-9」命令可直接開啟捷徑。',
                options: {
                    index: '位置 (1-9)',
                    count: '項目計數',
                    none: '無'
                }
            },
            showRecentNotes: {
                name: '顯示最近筆記',
                desc: '在導覽窗格中顯示最近筆記區段。'
            },
            hideRecentNotes: {
                name: '隱藏筆記',
                desc: '選擇在最近筆記區段中隱藏的筆記類型。',
                options: {
                    none: '無',
                    folderNotes: '資料夾筆記'
                }
            },
            recentNotesCount: {
                name: '最近筆記數量',
                desc: '要顯示的最近筆記數量。'
            },
            pinRecentNotesWithShortcuts: {
                name: '將最近筆記與捷徑一起釘選',
                desc: '釘選捷徑時包含最近筆記。'
            },
            calendarPlacement: {
                name: '日曆位置',
                desc: '在左側邊欄或右側邊欄中顯示。',
                options: {
                    leftSidebar: '左側邊欄',
                    rightSidebar: '右側邊欄'
                }
            },
            calendarLeftPlacement: {
                name: '單窗格位置',
                desc: '單窗格模式下日曆顯示的位置。',
                options: {
                    navigationPane: '導航窗格',
                    below: '窗格下方'
                }
            },
            calendarLocale: {
                name: '日曆語言',
                desc: '選擇日曆顯示的語言。',
                options: {
                    systemDefault: '系統預設'
                }
            },
            calendarWeekendDays: {
                name: '週末',
                desc: '以不同背景顏色顯示週末。',
                options: {
                    none: '無',
                    satSun: '週六和週日',
                    friSat: '週五和週六',
                    thuFri: '週四和週五'
                }
            },
            showInfoButtons: {
                name: '顯示資訊按鈕',
                desc: '在搜尋列和日曆標題中顯示資訊按鈕。'
            },
            calendarWeeksToShow: {
                name: '左側邊欄顯示週數',
                desc: '右側邊欄的日曆始終顯示完整月份。',
                options: {
                    fullMonth: '完整月份',
                    oneWeek: '1 週',
                    weeksCount: '{count} 週'
                }
            },
            calendarHighlightToday: {
                name: '醒目顯示今天日期',
                desc: '使用背景顏色和粗體文字醒目顯示今天日期。'
            },
            calendarShowFeatureImage: {
                name: '顯示特色圖片',
                desc: '在日曆中顯示筆記的特色圖片。'
            },
            calendarShowWeekNumber: {
                name: '顯示週號',
                desc: '在每行開頭顯示週號。'
            },
            calendarShowQuarter: {
                name: '顯示季度',
                desc: '在行事曆標題中新增季度標籤。'
            },
            calendarShowYearCalendar: {
                name: '顯示年曆',
                desc: '在右側邊欄中顯示年份導覽和月份網格。'
            },
            calendarConfirmBeforeCreate: {
                name: '建立前確認',
                desc: '點按沒有筆記的日期時顯示確認對話方塊。'
            },
            calendarIntegrationMode: {
                name: '日記來源',
                desc: '行事曆筆記的來源。',
                options: {
                    dailyNotes: '日記（核心外掛）',
                    notebookNavigator: 'Notebook Navigator'
                },
                info: {
                    dailyNotes: '資料夾和日期格式在日記核心外掛程式中設定。'
                }
            },

            calendarCustomRootFolder: {
                name: '根資料夾',
                desc: '週期筆記的基礎資料夾。日期模式可以包含子資料夾。隨所選儲存庫設定檔更改。',
                placeholder: 'Personal/Diary'
            },
            calendarTemplateFolder: {
                name: '範本資料夾位置',
                desc: '範本檔案選擇器顯示此資料夾中的筆記。',
                placeholder: 'Templates'
            },
            calendarCustomFilePattern: {
                name: '日記',
                desc: '使用 Moment 日期格式設定路徑。將子資料夾名稱用方括號括起來，例如 [Work]/YYYY。點擊範本圖示設定範本。在一般 > 範本中設定範本資料夾位置。',
                momentDescPrefix: '使用 ',
                momentLinkText: 'Moment 日期格式',
                momentDescSuffix:
                    ' 設定路徑。將子資料夾名稱用方括號括起來，例如 [Work]/YYYY。點擊範本圖示設定範本。在一般 > 範本中設定範本資料夾位置。',
                placeholder: 'YYYY/YYYYMMDD',
                example: '目前語法：{path}',
                parsingError: '模式必須能格式化並重新解析為完整日期（年、月、日）。'
            },
            calendarCustomWeekPattern: {
                name: '週記',
                parsingError: '模式必須能格式化並重新解析為完整週（週年、週數）。'
            },
            calendarCustomMonthPattern: {
                name: '月記',
                parsingError: '模式必須能格式化並重新解析為完整月份（年、月）。'
            },
            calendarCustomQuarterPattern: {
                name: '季度筆記',
                parsingError: '模式必須能格式化並重新解析為完整季度（年、季度）。'
            },
            calendarCustomYearPattern: {
                name: '年記',
                parsingError: '模式必須能格式化並重新解析為完整年份（年）。'
            },
            calendarTemplateFile: {
                current: '範本檔案：{name}'
            },
            showTooltips: {
                name: '顯示工具提示',
                desc: '懸停時顯示筆記和資料夾的額外資訊工具提示。'
            },
            showTooltipPath: {
                name: '顯示路徑',
                desc: '在工具提示中的筆記名稱下方顯示資料夾路徑。'
            },
            resetPaneSeparator: {
                name: '重設面板分隔符位置',
                desc: '將導覽面板和列表面板之間的可拖曳分隔符重設為預設位置。',
                buttonText: '重設分隔符',
                notice: '分隔符位置已重設。重新啟動 Obsidian 或重新開啟 Notebook Navigator 以套用。'
            },
            resetAllSettings: {
                name: '重設所有設定',
                desc: '將 Notebook Navigator 的所有設定重設為預設值。',
                buttonText: '重設所有設定',
                confirmTitle: '重設所有設定？',
                confirmMessage: '這將把 Notebook Navigator 的所有設定重設為預設值。此操作無法復原。',
                confirmButtonText: '重設所有設定',
                notice: '所有設定已重設。重新啟動 Obsidian 或重新開啟 Notebook Navigator 以套用。',
                error: '重設設定失敗。'
            },
            multiSelectModifier: {
                name: '多選修飾鍵',
                desc: '選擇哪個修飾鍵切換多選模式。選擇 Option/Alt 時，Cmd/Ctrl 點按會在新分頁中開啟筆記。',
                options: {
                    cmdCtrl: 'Cmd/Ctrl 點按',
                    optionAlt: 'Option/Alt 點按'
                }
            },
            enterToOpenFiles: {
                name: '按 Enter 鍵開啟檔案',
                desc: '僅在清單鍵盤導覽時按 Enter 鍵開啟檔案。'
            },
            shiftEnterOpenContext: {
                name: 'Shift+Enter',
                desc: '按 Shift+Enter 在新分頁、分割或視窗中開啟所選檔案。'
            },
            cmdEnterOpenContext: {
                name: 'Cmd+Enter',
                desc: '按 Cmd+Enter 在新分頁、分割或視窗中開啟所選檔案。'
            },
            ctrlEnterOpenContext: {
                name: 'Ctrl+Enter',
                desc: '按 Ctrl+Enter 在新分頁、分割或視窗中開啟所選檔案。'
            },
            excludedNotes: {
                name: '依屬性規則隱藏筆記（保險庫設定檔）',
                desc: '逗號分隔的前置中繼資料規則列表。使用 `key` 或 `key=value` 條目（例如：status=done, published=true, archived）。',
                placeholder: 'status=done, published=true, archived'
            },
            excludedFileNamePatterns: {
                name: '隱藏檔案（保險庫設定檔）',
                desc: '逗號分隔的檔名模式列表，用於隱藏檔案。支援 * 萬用字元和 / 路徑（例如：temp-*、*.png、/assets/*）。',
                placeholder: 'temp-*, *.png, /assets/*'
            },
            vaultProfiles: {
                name: '保險庫設定檔',
                desc: '設定檔儲存檔案類型可見性、隱藏檔案、隱藏資料夾、隱藏標籤、隱藏筆記、捷徑和導覽橫幅。從導覽窗格標題切換設定檔。',
                defaultName: '預設',
                addButton: '新增設定檔',
                editProfilesButton: '編輯設定檔',
                addProfileOption: '新增設定檔...',
                applyButton: '套用',
                deleteButton: '刪除設定檔',
                addModalTitle: '新增設定檔',
                editProfilesModalTitle: '編輯設定檔',
                addModalPlaceholder: '設定檔名稱',
                deleteModalTitle: '刪除 {name}',
                deleteModalMessage: '刪除 {name}？儲存在此設定檔中的隱藏檔案、資料夾、標籤和筆記篩選器將被刪除。',
                moveUp: '上移',
                moveDown: '下移',
                errors: {
                    emptyName: '請輸入設定檔名稱',
                    duplicateName: '設定檔名稱已存在'
                }
            },
            vaultTitle: {
                name: '保險庫標題位置',
                desc: '選擇保險庫標題顯示的位置。',
                options: {
                    header: '顯示在標題列',
                    navigation: '顯示在導覽窗格'
                }
            },
            excludedFolders: {
                name: '隱藏資料夾（保險庫設定檔）',
                desc: '逗號分隔的要隱藏的資料夾列表。名稱模式：assets*（以 assets 開頭的資料夾），*_temp（以 _temp 結尾）。路徑模式：/archive（僅根目錄 archive），/res*（以 res 開頭的根資料夾），/*/temp（一級目錄下的 temp 資料夾），/projects/*（projects 內的所有資料夾）。',
                placeholder: 'templates, assets*, /archive, /res*'
            },
            fileVisibility: {
                name: '顯示檔案類型（保險庫設定檔）',
                desc: '篩選在導覽器中顯示的檔案類型。Obsidian 不支援的檔案類型可能會在外部應用程式中開啟。',
                options: {
                    documents: '文件 (.md, .canvas, .base)',
                    supported: '支援（在 Obsidian 中開啟）',
                    all: '全部（可能外部開啟）'
                }
            },
            homepage: {
                name: '首頁',
                desc: '選擇自動開啟的檔案，例如儀表板。',
                current: '目前：{path}',
                currentMobile: '行動裝置：{path}',
                chooseButton: '選擇檔案',

                separateMobile: {
                    name: '單獨的行動裝置首頁',
                    desc: '為行動裝置使用不同的首頁。'
                }
            },
            showFileDate: {
                name: '顯示日期',
                desc: '在筆記名稱下方顯示日期。'
            },
            alphabeticalDateMode: {
                name: '按名稱排序時',
                desc: '筆記按字母順序排序時顯示的日期。',
                options: {
                    created: '建立日期',
                    modified: '修改日期'
                }
            },
            showFileTags: {
                name: '顯示檔案標籤',
                desc: '在檔案項目中顯示可點按的標籤。'
            },
            showFileTagAncestors: {
                name: '顯示完整標籤路徑',
                desc: "顯示完整的標籤層級路徑。啟用：'ai/openai'，'工作/專案/2024'。停用：'openai'，'2024'。"
            },
            colorFileTags: {
                name: '為檔案標籤著色',
                desc: '將標籤顏色套用於檔案項目中的標籤徽章。'
            },
            prioritizeColoredFileTags: {
                name: '優先顯示彩色標籤',
                desc: '將彩色標籤排列在其他標籤之前。'
            },
            showFileTagsInCompactMode: {
                name: '在精簡模式中顯示檔案標籤',
                desc: '當日期、預覽和圖片被隱藏時顯示標籤。'
            },
            showFileProperties: {
                name: '顯示檔案屬性',
                desc: '在檔案項目中顯示可點擊的屬性。'
            },
            colorFileProperties: {
                name: '為檔案屬性著色',
                desc: '將屬性顏色套用到檔案項目的屬性徽章上。'
            },
            prioritizeColoredFileProperties: {
                name: '優先顯示彩色屬性',
                desc: '在檔案項目中將彩色屬性排列在其他屬性之前。'
            },
            showFilePropertiesInCompactMode: {
                name: '在精簡模式中顯示屬性',
                desc: '精簡模式啟用時顯示屬性。'
            },
            notePropertyType: {
                name: '筆記屬性',
                desc: '選擇要在檔案項目中顯示的筆記屬性。',
                options: {
                    frontmatter: '前置中繼資料屬性',
                    wordCount: '字數統計',
                    none: '無'
                }
            },
            propertyFields: {
                name: '屬性鍵（保險庫設定檔）',
                desc: 'Frontmatter 屬性鍵，可按鍵設定導覽和檔案清單的可見性。',
                addButtonTooltip: '設定屬性鍵',
                noneConfigured: '未設定屬性',
                singleConfigured: '已設定 1 個屬性：{properties}',
                multipleConfigured: '已設定 {count} 個屬性：{properties}'
            },
            showPropertiesOnSeparateRows: {
                name: '在個別行中顯示屬性',
                desc: '將每個屬性顯示在個別行中。'
            },
            dateFormat: {
                name: '日期格式',
                desc: '用於顯示日期的格式（使用 Moment 格式）。',
                placeholder: 'YYYY年M月D日',
                help: '常用格式：\nYYYY年M月D日 = 2022年5月25日\nYYYY-MM-DD = 2022-05-25\nMM/DD/YYYY = 05/25/2022\n\n標記：\nYYYY/YY = 年\nMMMM/MMM/MM/M = 月\nDD/D = 日\ndddd/ddd = 星期',
                helpTooltip: '使用 Moment 格式',
                momentLinkText: 'Moment 格式'
            },
            timeFormat: {
                name: '時間格式',
                desc: '用於顯示時間的格式（使用 Moment 格式）。',
                placeholder: 'HH:mm',
                help: '常用格式：\nHH:mm = 14:30（24小時制）\nAh:mm = 下午2:30（12小時制）\nHH:mm:ss = 14:30:45\nAh:mm:ss = 下午2:30:45\n\n標記：\nHH/H = 24小時制\nhh/h = 12小時制\nmm = 分鐘\nss = 秒\nA = 上午/下午',
                helpTooltip: '使用 Moment 格式',
                momentLinkText: 'Moment 格式'
            },
            showFilePreview: {
                name: '顯示筆記預覽',
                desc: '在筆記名稱下方顯示預覽文字。'
            },
            skipHeadingsInPreview: {
                name: '預覽中跳過標題',
                desc: '產生預覽文字時跳過標題行。'
            },
            skipCodeBlocksInPreview: {
                name: '預覽中跳過程式碼區塊',
                desc: '產生預覽文字時跳過程式碼區塊。'
            },
            stripHtmlInPreview: {
                name: '移除預覽中的 HTML',
                desc: '從預覽文字中移除 HTML 標籤。可能會影響大型筆記的效能。'
            },
            stripLatexInPreview: {
                name: '移除預覽中的 LaTeX',
                desc: '從預覽文字中移除行內和區塊 LaTeX 運算式。'
            },
            previewProperties: {
                name: '預覽屬性',
                desc: '用於尋找預覽文字的前置屬性的逗號分隔列表。將使用第一個包含文字的屬性。',
                placeholder: 'summary, description, abstract',
                info: '如果在指定的屬性中找不到預覽文字，預覽將從筆記內容中產生。'
            },
            previewRows: {
                name: '預覽行數',
                desc: '預覽文字顯示的行數。',
                options: {
                    '1': '1 行',
                    '2': '2 行',
                    '3': '3 行',
                    '4': '4 行',
                    '5': '5 行'
                }
            },
            fileNameRows: {
                name: '標題行數',
                desc: '筆記標題顯示的行數。',
                options: {
                    '1': '1 行',
                    '2': '2 行'
                }
            },
            showFeatureImage: {
                name: '顯示特色圖片',
                desc: '顯示筆記中找到的第一張圖片的縮圖。'
            },
            forceSquareFeatureImage: {
                name: '強制正方形特色圖片',
                desc: '將特色圖片呈現為正方形縮圖。'
            },
            featureImageProperties: {
                name: '圖片屬性',
                desc: '首先檢查的前置中繼資料屬性的逗號分隔列表。如果未找到，則使用 markdown 內容中的第一張圖片。',
                placeholder: 'thumbnail, featureResized, feature'
            },
            featureImageExcludeProperties: {
                name: '排除含有屬性的筆記',
                desc: '逗號分隔的前置中繼資料屬性列表。包含這些屬性的筆記不會儲存特色圖片。',
                placeholder: 'private, confidential'
            },

            downloadExternalFeatureImages: {
                name: '下載外部圖片',
                desc: '下載遠端圖片和 YouTube 縮圖作為特色圖片。'
            },
            showRootFolder: {
                name: '顯示根資料夾',
                desc: '在樹狀結構中顯示根資料夾名稱。'
            },
            showFolderIcons: {
                name: '顯示資料夾圖示',
                desc: '在導覽窗格的資料夾旁顯示圖示。'
            },
            inheritFolderColors: {
                name: '繼承資料夾顏色',
                desc: '子資料夾從父資料夾繼承顏色。'
            },
            folderSortOrder: {
                name: '資料夾排序方式',
                desc: '右鍵點擊任意資料夾，可為其子項目設定不同的排序方式。',
                options: {
                    alphaAsc: 'A 到 Z',
                    alphaDesc: 'Z 到 A'
                }
            },
            showNoteCount: {
                name: '顯示筆記數',
                desc: '在每個資料夾和標籤旁顯示筆記數量。'
            },
            showSectionIcons: {
                name: '顯示捷徑和最近項目的圖示',
                desc: '顯示導覽區段（如捷徑和最近檔案）的圖示。'
            },
            interfaceIcons: {
                name: '介面圖示',
                desc: '編輯工具列、資料夾、標籤、釘選、搜尋和排序圖示。',
                buttonText: '編輯圖示'
            },
            showIconsColorOnly: {
                name: '僅對圖示套用顏色',
                desc: '啟用時，自訂顏色僅套用於圖示。停用時，顏色將同時套用於圖示和文字標籤。'
            },
            collapseBehavior: {
                name: '摺疊項目',
                desc: '選擇展開/摺疊全部按鈕影響的內容。',
                options: {
                    all: '所有資料夾和標籤',
                    foldersOnly: '僅資料夾',
                    tagsOnly: '僅標籤'
                }
            },
            smartCollapse: {
                name: '保持選取項展開',
                desc: '摺疊時，保持目前選取的資料夾或標籤及其父級展開。'
            },
            navIndent: {
                name: '樹狀縮排',
                desc: '調整巢狀資料夾和標籤的縮排寬度。'
            },
            navItemHeight: {
                name: '行高',
                desc: '調整導覽窗格中資料夾和標籤的高度。'
            },
            navItemHeightScaleText: {
                name: '隨行高調整文字大小',
                desc: '降低行高時減小導覽文字大小。'
            },
            showIndentGuides: {
                name: '顯示縮排參考線',
                desc: '顯示巢狀資料夾和標籤的縮排參考線。'
            },
            navRootSpacing: {
                name: '根級項目間距',
                desc: '根級資料夾和標籤之間的間距。'
            },
            showTags: {
                name: '顯示標籤',
                desc: '在導覽器中顯示標籤區段。'
            },
            showTagIcons: {
                name: '顯示標籤圖示',
                desc: '在導覽窗格的標籤旁顯示圖示。'
            },
            inheritTagColors: {
                name: '繼承標籤顏色',
                desc: '子標籤從父標籤繼承顏色。'
            },
            tagSortOrder: {
                name: '標籤排序方式',
                desc: '右鍵點擊任意標籤，可為其子項目設定不同的排序方式。',
                options: {
                    alphaAsc: 'A 到 Z',
                    alphaDesc: 'Z 到 A',
                    frequency: '頻率',
                    lowToHigh: '從低到高',
                    highToLow: '從高到低'
                }
            },
            showAllTagsFolder: {
                name: '顯示標籤資料夾',
                desc: '將「標籤」顯示為可摺疊資料夾。'
            },
            showUntagged: {
                name: '顯示無標籤筆記',
                desc: '為沒有任何標籤的筆記顯示「無標籤」項目。'
            },
            keepEmptyTagsProperty: {
                name: '刪除最後一個標籤後保留 tags 屬性',
                desc: '當所有標籤被刪除時保留 frontmatter 中的 tags 屬性。停用時，tags 屬性將從 frontmatter 中刪除。'
            },
            showProperties: {
                name: '顯示屬性',
                desc: '在導覽器中顯示屬性區段。',
                propertyKeysInfoPrefix: '在',
                propertyKeysInfoLinkText: '一般 > 屬性鍵',
                propertyKeysInfoSuffix: '中設定屬性'
            },
            showPropertyIcons: {
                name: '顯示屬性圖示',
                desc: '在導覽面板中屬性旁邊顯示圖示。'
            },
            inheritPropertyColors: {
                name: '繼承屬性顏色',
                desc: '屬性值繼承其屬性鍵的顏色和背景色。'
            },
            propertySortOrder: {
                name: '屬性排序方式',
                desc: '右鍵點擊任意屬性以設定其值的不同排序方式。',
                options: {
                    alphaAsc: 'A 到 Z',
                    alphaDesc: 'Z 到 A',
                    frequency: '頻率',
                    lowToHigh: '由低到高',
                    highToLow: '由高到低'
                }
            },
            showAllPropertiesFolder: {
                name: '顯示屬性資料夾',
                desc: '將「屬性」顯示為可摺疊資料夾。'
            },
            hiddenTags: {
                name: '隱藏標籤（保險庫設定檔）',
                desc: '逗號分隔的標籤模式列表。名稱模式：tag*（以...開頭）、*tag（以...結尾）。路徑模式：archive（標籤及其後代）、archive/*（僅後代）、projects/*/drafts（中間萬用字元）。',
                placeholder: 'archive*, *draft, projects/*/old'
            },
            hiddenFileTags: {
                name: '隱藏帶有標籤的筆記（保險庫設定檔）',
                desc: 'Comma-separated list of tag patterns. Notes containing matching tags are hidden. Name patterns: tag* (starting with), *tag (ending with). Path patterns: archive (tag and descendants), archive/* (descendants only), projects/*/drafts (mid-segment wildcard).',
                placeholder: 'archive*, *draft, projects/*/old'
            },
            enableFolderNotes: {
                name: '啟用資料夾筆記',
                desc: '具有匹配筆記檔案的資料夾顯示為可點擊的連結。'
            },
            folderNoteType: {
                name: '預設資料夾筆記類型',
                desc: '從右鍵選單建立的資料夾筆記類型。',
                options: {
                    ask: '建立時詢問',
                    markdown: 'Markdown',
                    canvas: 'Canvas',
                    base: 'Base'
                }
            },
            folderNoteName: {
                name: '資料夾筆記名稱',
                desc: '資料夾筆記的名稱。留空以使用與資料夾相同的名稱。',
                placeholder: 'index'
            },
            folderNoteNamePattern: {
                name: '資料夾筆記名稱模式',
                desc: '不含副檔名的資料夾筆記名稱模式。使用 {{folder}} 插入資料夾名稱。設定後，資料夾筆記名稱不適用。'
            },
            folderNoteTemplate: {
                name: '資料夾筆記範本',
                desc: '新建 Markdown 資料夾筆記的範本檔案。在一般 > 範本中設定範本資料夾位置。'
            },
            enableFolderNoteLinks: {
                name: '啟用資料夾筆記連結',
                desc: '資料夾標籤顯示為連結樣式，點擊可開啟資料夾筆記。關閉時，資料夾筆記仍提供名稱、圖示和顏色中繼資料。'
            },
            hideFolderNoteInList: {
                name: '在列表中隱藏資料夾筆記',
                desc: '在檔案列表中隱藏資料夾筆記。'
            },
            pinCreatedFolderNote: {
                name: '釘選建立的資料夾筆記',
                desc: '從右鍵選單建立時釘選資料夾筆記。'
            },
            openFolderNotesInNewTab: {
                name: '在新分頁中開啟資料夾筆記',
                desc: '點擊資料夾時在新分頁中開啟資料夾筆記。'
            },
            confirmBeforeDelete: {
                name: '刪除前確認',
                desc: '刪除筆記或資料夾時顯示確認對話方塊'
            },
            deleteAttachments: {
                name: '刪除檔案時刪除附件',
                desc: '如果附件未在其他地方使用，則在刪除檔案時自動刪除關聯的附件',
                options: {
                    ask: '每次詢問',
                    always: '始終',
                    never: '從不'
                }
            },
            moveFileConflicts: {
                name: '移動衝突',
                desc: '將檔案移動到已有同名檔案的資料夾時。每次詢問（重新命名、覆蓋、取消）或始終重新命名。',
                options: {
                    ask: '每次詢問',
                    rename: '始終重新命名'
                }
            },
            metadataCleanup: {
                name: '清理中繼資料',
                desc: '移除在 Obsidian 外部刪除、移動或重新命名檔案、資料夾或標籤時留下的孤立中繼資料。這僅影響 Notebook Navigator 設定檔案。',
                buttonText: '清理中繼資料',
                error: '設定清理失敗',
                loading: '正在檢查中繼資料...',
                statusClean: '沒有需要清理的中繼資料',
                statusCounts: '孤立項目：{folders} 資料夾，{tags} 標籤，{properties} 屬性，{files} 檔案，{pinned} 釘選，{separators} 分隔線'
            },
            rebuildCache: {
                name: '重建快取',
                desc: '如果出現標籤缺失、預覽不正確或圖片缺失，請使用此功能。這可能在同步衝突或意外關閉後發生。',
                buttonText: '重建快取',
                error: '重建快取失敗',
                indexingTitle: '正在索引保險庫...',
                progress: '正在更新 Notebook Navigator 快取.'
            },
            externalIcons: {
                downloadButton: '下載',
                downloadingLabel: '正在下載...',
                removeButton: '移除',
                statusInstalled: '已下載（版本 {version}）',
                statusNotInstalled: '未下載',
                versionUnknown: '未知',
                downloadFailed: '下載 {name} 失敗。請檢查您的連線並重試。',
                removeFailed: '移除 {name} 失敗。',
                infoNote:
                    '下載的圖示包會在裝置之間同步安裝狀態。圖示包儲存在每個裝置的本機資料庫中；同步僅追蹤它們是否應該被下載或移除。圖示包從 Notebook Navigator 儲存庫下載 (https://github.com/johansan/notebook-navigator/tree/main/icon-assets)。'
            },
            useFrontmatterDates: {
                name: '使用前置中繼資料',
                desc: '使用前置設定筆記名稱、時間戳記、圖示和顏色'
            },
            frontmatterNameField: {
                name: '名稱欄位（多個）',
                desc: '逗號分隔的前置欄位列表。使用第一個非空值。回退到檔名。',
                placeholder: 'title, name'
            },
            frontmatterIconField: {
                name: '圖示欄位',
                desc: '檔案圖示的前置欄位。留空使用儲存在設定中的圖示。',
                placeholder: 'icon'
            },
            frontmatterColorField: {
                name: '顏色欄位',
                desc: '檔案顏色的前置欄位。留空使用儲存在設定中的顏色。',
                placeholder: 'color'
            },
            frontmatterBackgroundField: {
                name: '背景欄位',
                desc: '背景顏色的前置欄位。留空使用儲存在設定中的背景顏色。',
                placeholder: 'background'
            },
            frontmatterMigration: {
                name: '從設定遷移圖示和顏色',
                desc: '儲存在設定中：{icons} 個圖示，{colors} 種顏色。',
                button: '遷移',
                buttonWorking: '正在遷移...',
                noticeNone: '設定中未儲存任何檔案圖示或顏色。',
                noticeDone: '已遷移 {migratedIcons}/{icons} 個圖示，{migratedColors}/{colors} 種顏色。',
                noticeFailures: '失敗的條目：{failures}。',
                noticeError: '遷移失敗。請檢查主控台以取得詳細資訊。'
            },
            frontmatterCreatedField: {
                name: '建立時間戳記欄位',
                desc: '建立時間戳記的前置欄位名稱。留空僅使用檔案系統日期。',
                placeholder: 'created'
            },
            frontmatterModifiedField: {
                name: '修改時間戳記欄位',
                desc: '修改時間戳記的前置欄位名稱。留空僅使用檔案系統日期。',
                placeholder: 'modified'
            },
            frontmatterDateFormat: {
                name: '時間戳記格式',
                desc: '用於解析前置中時間戳記的格式。留空使用 ISO 8601 解析。',
                helpTooltip: '使用 Moment 格式',
                momentLinkText: 'Moment 格式',
                help: '常用格式:\nYYYY-MM-DD[T]HH:mm:ss → 2025-01-04T14:30:45\nYYYY-MM-DD[T]HH:mm:ssZ → 2025-08-07T16:53:39+02:00\nDD/MM/YYYY HH:mm:ss → 04/01/2025 14:30:45\nMM/DD/YYYY h:mm:ss a → 01/04/2025 2:30:45 PM'
            },
            supportDevelopment: {
                name: '支持開發',
                desc: '如果您喜歡使用筆記本導覽器，請考慮支持其持續開發。',
                buttonText: '❤️ 贊助',
                coffeeButton: '☕️ 請我喝咖啡'
            },
            updateCheckOnStart: {
                name: '啟動時檢查新版本',
                desc: '啟動時檢查新的外掛版本，當有可用更新時顯示通知。每個版本僅通知一次，檢查最多每天一次。',
                status: '有新版本可用：{version}'
            },
            whatsNew: {
                name: 'Notebook Navigator {version} 的最新動態',
                desc: '查看最近的更新和改進',
                buttonText: '查看最近更新'
            },
            masteringVideo: {
                name: '精通 Notebook Navigator（影片）',
                desc: '本影片涵蓋了在 Notebook Navigator 中高效工作所需的一切內容，包括快速鍵、搜尋、標籤和進階自訂。'
            },
            cacheStatistics: {
                localCache: '本機快取',
                items: '項',
                withTags: '包含標籤',
                withPreviewText: '包含預覽文字',
                withFeatureImage: '包含特色圖片',
                withMetadata: '包含中繼資料'
            },
            metadataInfo: {
                successfullyParsed: '成功解析',
                itemsWithName: '個帶名稱的項目',
                withCreatedDate: '個帶建立日期',
                withModifiedDate: '個帶修改日期',
                withIcon: '個帶圖示',
                withColor: '個帶顏色',
                failedToParse: '解析失敗',
                createdDates: '個建立日期',
                modifiedDates: '個修改日期',
                checkTimestampFormat: '請檢查您的時間戳記格式。',
                exportFailed: '匯出錯誤'
            }
        }
    },
    whatsNew: {
        title: 'Notebook Navigator 的新功能',
        supportMessage: '如果您覺得 Notebook Navigator 有用，請考慮支持其開發。',
        supportButton: '請我喝咖啡',
        thanksButton: '謝謝！'
    }
};
