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
 * Notebook Navigator 的繁體中文 (台灣) 語言字串
 * 為了方便維護，依功能/元件進行組織
 */
export const STRINGS_ZH_TW = {
    // 通用 UI 元素
    common: {
        cancel: '取消', // 用於取消對話框和操作的按鈕文字 (英文: Cancel)
        delete: '刪除', // 對話框中刪除操作的按鈕文字 (英文: Delete)
        remove: '移除', // 對話框中移除操作的按鈕文字 (英文: Remove)
        submit: '提交', // 用於送出表單和對話框的按鈕文字 (英文: Submit)
        noSelection: '未選取', // 未選取資料夾或標籤時的預留位置文字 (英文: No selection)
        untagged: '無標籤', // 沒有任何標籤的筆記標籤 (英文: Untagged)
        untitled: '未命名', // 沒有標題的筆記預設名稱 (英文: Untitled)
        featureImageAlt: '特色圖片', // 縮圖/預覽圖片的替代文字 (英文: Feature image)
        unknownError: '未知錯誤', // 當錯誤沒有訊息時的通用備用文字 (英文: Unknown error)
        updateBannerTitle: 'Notebook Navigator 有可用更新',
        updateBannerInstruction: '在設定 → 社群外掛中更新'
    },

    // 列表窗格
    listPane: {
        emptyStateNoSelection: '選取一個資料夾或標籤以檢視筆記', // 未選取資料夾或標籤時顯示的訊息 (英文: Select a folder or tag to view notes)
        emptyStateNoNotes: '沒有筆記', // 當資料夾/標籤沒有筆記時顯示的訊息 (英文: No notes)
        pinnedSection: '📌 已釘選', // 檔案列表頂部釘選筆記區段的標頭 (英文: 📌 Pinned)
        notesSection: '筆記', // 僅顯示文件時，在釘選項目和一般項目之間顯示的標頭 (英文: Notes)
        filesSection: '檔案' // 顯示支援的或所有檔案時，在釘選項目和一般項目之間顯示的標頭 (英文: Files)
    },

    // 標籤列表
    tagList: {
        untaggedLabel: '無標籤', // 顯示無標籤筆記的特殊項目標籤 (英文: Untagged)
        hiddenTags: '隱藏標籤', // 隱藏標籤虛擬資料夾的標籤 (英文: Hidden tags)
        tags: '標籤', // 標籤虛擬資料夾的標籤 (英文: Tags)
        topics: '主題', // Label for the topics virtual folder (English: Topics)
    },

    // 導覽窗格
    navigationPane: {
        shortcutsHeader: '捷徑', // 導覽窗格中捷徑區段的標頭標籤 (英文: Shortcuts)
        recentNotesHeader: '最近筆記', // 導覽窗格中最近筆記區段的標頭標籤 (英文: Recent notes)
        recentFilesHeader: '最近檔案', // 在導覽窗格中顯示最近非筆記檔案時的標頭標籤 (英文: Recent files)
        reorderRootFoldersTitle: '重新排序根資料夾',
        reorderRootFoldersHint: '拖曳資料夾以變更順序',
        vaultRootLabel: '儲存庫',
        resetRootFolderOrder: '重設為字母順序',
        dragHandleLabel: '拖曳以重新排序',
        pinShortcuts: '釘選捷徑',
        unpinShortcuts: '取消釘選捷徑'
    },

    shortcuts: {
        folderExists: '資料夾已在捷徑中',
        noteExists: '筆記已在捷徑中',
        tagExists: '標籤已在捷徑中',
        topicExists: '主題已在捷徑中',
        searchExists: '搜尋捷徑已存在',
        emptySearchQuery: '儲存前請輸入搜尋查詢',
        emptySearchName: '儲存搜尋前請輸入名稱',
        add: '新增至捷徑',
        remove: '從捷徑移除',
        moveUp: '上移',
        moveDown: '下移'
    },

    // 窗格標頭
    paneHeader: {
        collapseAllFolders: '收合項目', // 收合已展開項目的按鈕工具提示 (英文: Collapse items)
        expandAllFolders: '展開所有項目', // 展開所有項目的按鈕工具提示 (英文: Expand all items)
        scrollToTop: '捲動至頂部',
        newFolder: '新資料夾', // 建立新資料夾按鈕的工具提示 (英文: New folder)
        newNote: '新筆記', // 建立新筆記按鈕的工具提示 (英文: New note)
        mobileBackToNavigation: '返回導覽', // 行動裝置專用，返回導覽窗格的返回按鈕文字 (英文: Back to navigation)
        changeSortOrder: '變更排序順序', // 排序順序切換按鈕的工具提示 (英文: Change sort order)
        defaultSort: '預設', // 預設排序模式的標籤 (英文: Default)
        customSort: '自訂', // 自訂排序模式的標籤 (英文: Custom)
        showFolders: '顯示導覽', // 顯示導覽窗格按鈕的工具提示 (英文: Show navigation)
        hideFolders: '隱藏導覽', // 隱藏導覽窗格按鈕的工具提示 (英文: Hide navigation)
        reorderRootFolders: '重新排序根資料夾',
        finishRootFolderReorder: '完成根資料夾重新排序',
        toggleDescendantNotes: '顯示子資料夾/後代中的筆記', // 工具提示：包含資料夾和標籤的後代
        autoExpandFoldersTags: '自動展開資料夾和標籤', // 選取時自動展開資料夾和標籤的切換按鈕工具提示 (英文: Auto-expand folders and tags)
        showExcludedItems: '顯示隱藏項目', // 顯示隱藏項目的按鈕工具提示 (英文: Show hidden items)
        hideExcludedItems: '隱藏隱藏項目', // 隱藏隱藏項目的按鈕工具提示 (英文: Hide hidden items)
        showDualPane: '顯示雙窗格', // 顯示雙窗格佈局的按鈕工具提示 (英文: Show dual panes)
        showSinglePane: '顯示單一窗格', // 顯示單一窗格佈局的按鈕工具提示 (英文: Show single pane)
        changeAppearance: '變更外觀', // 變更資料夾外觀設定的按鈕工具提示 (英文: Change appearance)
        search: '搜尋' // 搜尋按鈕的工具提示 (英文: Search)
    },
    // 搜尋輸入
    searchInput: {
        placeholder: '搜尋...', // 搜尋輸入框的預留位置文字 (英文: Search...)
        placeholderOmnisearch: 'Omnisearch...', // Omnisearch 提供者啟用時的預留位置文字 (英文: Omnisearch...)
        clearSearch: '清除搜尋', // 清除搜尋按鈕的工具提示 (英文: Clear search)
        saveSearchShortcut: '儲存搜尋捷徑',
        removeSearchShortcut: '移除搜尋捷徑',
        shortcutModalTitle: '儲存搜尋捷徑',
        shortcutNameLabel: '捷徑名稱',
        shortcutNamePlaceholder: '輸入捷徑名稱'
    },

    // 右鍵選單
    contextMenu: {
        file: {
            openInNewTab: '在新分頁中開啟',
            openToRight: '在右側開啟',
            openInNewWindow: '在新視窗中開啟',
            openMultipleInNewTabs: '在新分頁中開啟 {count} 則筆記',
            openMultipleFilesInNewTabs: '在新分頁中開啟 {count} 個檔案',
            openMultipleToRight: '在右側開啟 {count} 則筆記',
            openMultipleFilesToRight: '在右側開啟 {count} 個檔案',
            openMultipleInNewWindows: '在新視窗中開啟 {count} 則筆記',
            openMultipleFilesInNewWindows: '在新視窗中開啟 {count} 個檔案',
            pinNote: '釘選筆記',
            pinFile: '釘選檔案',
            unpinNote: '取消釘選筆記',
            unpinFile: '取消釘選檔案',
            pinMultipleNotes: '釘選 {count} 則筆記',
            pinMultipleFiles: '釘選 {count} 個檔案',
            unpinMultipleNotes: '取消釘選 {count} 則筆記',
            unpinMultipleFiles: '取消釘選 {count} 個檔案',
            duplicateNote: '複製筆記',
            duplicateFile: '複製檔案',
            duplicateMultipleNotes: '複製 {count} 則筆記',
            duplicateMultipleFiles: '複製 {count} 個檔案',
            openVersionHistory: '開啟版本歷史',
            revealInFolder: '在資料夾中顯示',
            revealInFinder: '在 Finder 中顯示',
            showInExplorer: '在系統檔案總管中顯示',
            copyDeepLink: '複製 Obsidian URL',
            copyPath: '複製路徑',
            copyRelativePath: '複製相對路徑',
            renameNote: '重新命名筆記',
            renameFile: '重新命名檔案',
            deleteNote: '刪除筆記',
            deleteFile: '刪除檔案',
            deleteMultipleNotes: '刪除 {count} 則筆記',
            deleteMultipleFiles: '刪除 {count} 個檔案',
            moveToFolder: '移動至...',
            moveMultipleToFolder: '將 {count} 個檔案移動至...',
            addTag: '新增標籤',
            removeTag: '移除標籤',
            removeAllTags: '移除所有標籤',
            changeIcon: '變更圖示',
            changeColor: '變更圖示顏色'
        },
        folder: {
            newNote: '新筆記',
            newFolder: '新資料夾',
            newCanvas: '新畫布',
            newBase: '新 Base',
            newDrawing: '新繪圖',
            duplicateFolder: '複製資料夾',
            searchInFolder: '在此資料夾中搜尋',
            createFolderNote: '建立資料夾筆記',
            deleteFolderNote: '刪除資料夾筆記',
            changeIcon: '變更圖示',
            changeColor: '變更顏色',
            changeBackground: '變更背景',
            excludeFolder: '隱藏資料夾',
            moveFolder: '移動至...',
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
        topic: {
            changeIcon: '更改圖示',
            changeColor: '更改顏色',
            changeBackground: '更改背景',
            showTopic: '顯示主題',
            hideTopic: '隱藏主題'
        }
    },

    // 資料夾外觀選單
    folderAppearance: {
        defaultPreset: '預設外觀',
        slimPreset: '緊湊 (無日期/預覽/圖片)',
        titleRows: '標題列數',
        previewRows: '預覽列數',
        defaultOption: (rows: number) => `預設 (${rows})`,
        defaultTitleOption: (rows: number) => `預設標題列數 (${rows})`,
        defaultPreviewOption: (rows: number) => `預設預覽列數 (${rows})`,
        titleRowOption: (rows: number) => `${rows} 標題列`,
        previewRowOption: (rows: number) => `${rows} 預覽列`
    },

    // 彈出對話框
    modals: {
        iconPicker: {
            searchPlaceholder: '搜尋圖示...',
            recentlyUsedHeader: '最近使用',
            emptyStateSearch: '開始輸入以搜尋圖示',
            emptyStateNoResults: '找不到圖示',
            showingResultsInfo: '顯示 {count} 個結果中的 50 個。輸入更多以縮小範圍。',
            emojiInstructions: '輸入或貼上任何表情符號以作為圖示',
            removeIcon: '移除圖示'
        },
        colorPicker: {
            currentColor: '目前',
            newColor: '新增',
            presetColors: '預設顏色',
            recentColors: '最近顏色',
            clearRecentColors: '清除最近顏色',
            removeRecentColor: '移除顏色',
            removeColor: '移除顏色',
            apply: '套用',
            hexLabel: 'HEX',
            rgbLabel: 'RGBA',
            colors: {
                red: '紅色',
                orange: '橘色',
                amber: '琥珀色',
                yellow: '黃色',
                lime: '萊姆色',
                green: '綠色',
                emerald: '翡翠色',
                teal: '藍綠色',
                cyan: '青色',
                sky: '天空藍',
                blue: '藍色',
                indigo: '靛藍色',
                violet: '紫羅蘭色',
                purple: '紫色',
                fuchsia: '桃紅色',
                pink: '粉紅色',
                rose: '玫瑰色',
                gray: '灰色',
                slate: '岩灰色',
                stone: '石色'
            }
        },
        tagOperation: {
            renameTitle: '重新命名標籤 {tag}',
            deleteTitle: '刪除標籤 {tag}',
            newTagPrompt: '新標籤名稱',
            newTagPlaceholder: '輸入新標籤名稱',
            renameWarning: '重新命名標籤 {oldTag} 將會修改 {count} 個{files}。',
            deleteWarning: '刪除標籤 {tag} 將會修改 {count} 個{files}。',
            modificationWarning: '這將會更新檔案的修改日期。',
            affectedFiles: '受影響的檔案：',
            andMore: '...還有 {count} 個',
            confirmRename: '重新命名標籤',
            confirmDelete: '刪除標籤',
            file: '檔案',
            files: '檔案'
        },
        fileSystem: {
            newFolderTitle: '新資料夾',
            renameFolderTitle: '重新命名資料夾',
            renameFileTitle: '重新命名檔案',
            deleteFolderTitle: "刪除 '{name}'？",
            deleteFileTitle: "刪除 '{name}'？",
            folderNamePrompt: '輸入資料夾名稱：',
            renamePrompt: '輸入新名稱：',
            renameVaultTitle: '變更儲存庫顯示名稱',
            renameVaultPrompt: '輸入自訂顯示名稱 (留空以使用預設值)：',
            deleteFolderConfirm: '您確定要刪除此資料夾及其所有內容嗎？',
            deleteFileConfirm: '您確定要刪除此檔案嗎？',
            removeAllTagsTitle: '移除所有標籤',
            removeAllTagsFromNote: '您確定要從此筆記中移除所有標籤嗎？',
            removeAllTagsFromNotes: '您確定要從 {count} 則筆記中移除所有標籤嗎？'
        },
        folderSuggest: {
            placeholder: '移動至資料夾...',
            navigatePlaceholder: '導覽至資料夾...',
            instructions: {
                navigate: '導覽',
                move: '移動',
                select: '選取',
                dismiss: '關閉'
            }
        },
        homepage: {
            placeholder: '搜尋檔案...',
            instructions: {
                navigate: '導覽',
                select: '設定為首頁',
                dismiss: '關閉'
            }
        },
        navigationBanner: {
            placeholder: '搜尋圖片...',
            instructions: {
                navigate: '導覽',
                select: '設定橫幅',
                dismiss: '關閉'
            }
        },
        tagSuggest: {
            placeholder: '搜尋標籤...',
            navigatePlaceholder: '導覽至標籤...',
            addPlaceholder: '搜尋要新增的標籤...',
            removePlaceholder: '選取要移除的標籤...',
            createNewTag: '建立新標籤：#{tag}',
            instructions: {
                navigate: '導覽',
                select: '選取',
                dismiss: '關閉',
                add: '新增標籤',
                remove: '移除標籤'
            }
        }
    },
    // 檔案系統操作
    fileSystem: {
        errors: {
            createFolder: '建立資料夾失敗：{error}',
            createFile: '建立檔案失敗：{error}',
            renameFolder: '重新命名資料夾失敗：{error}',
            renameFolderNoteConflict: '無法重新命名："{name}" 已存在於此資料夾中',
            renameFile: '重新命名檔案失敗：{error}',
            deleteFolder: '刪除資料夾失敗：{error}',
            deleteFile: '刪除檔案失敗：{error}',
            duplicateNote: '複製筆記失敗：{error}',
            createCanvas: '建立畫布失敗：{error}',
            createDatabase: '建立 Base 失敗：{error}',
            duplicateFolder: '複製資料夾失敗：{error}',
            openVersionHistory: '開啟版本歷史失敗：{error}',
            versionHistoryNotFound: '找不到版本歷史指令。請確保已啟用 Obsidian Sync。',
            revealInExplorer: '在系統檔案總管中顯示檔案失敗：{error}',
            folderNoteAlreadyExists: '資料夾筆記已存在',
            folderAlreadyExists: '資料夾「{name}」已存在',
            folderNotesDisabled: '請在設定中啟用資料夾筆記以轉換檔案',
            folderNoteAlreadyLinked: '此檔案已作為資料夾筆記',
            folderNoteUnsupportedExtension: '不支援的檔案副檔名：{extension}',
            folderNoteMoveFailed: '轉換過程中移動檔案失敗：{error}',
            folderNoteRenameConflict: '資料夾中已存在名為「{name}」的檔案',
            folderNoteConversionFailed: '轉換為資料夾筆記失敗',
            folderNoteConversionFailedWithReason: '轉換為資料夾筆記失敗：{error}',
            folderNoteOpenFailed: '檔案已轉換但開啟資料夾筆記失敗：{error}',
            failedToDeleteFile: '刪除 {name} 失敗：{error}',
            failedToDeleteMultipleFiles: '刪除 {count} 個檔案失敗',
            versionHistoryNotAvailable: '版本歷史服務不可用',
            drawingAlreadyExists: '同名繪圖已存在',
            failedToCreateDrawing: '建立繪圖失敗',
            noFolderSelected: 'Notebook Navigator 中未選取資料夾',
            noFileSelected: '未選取檔案'
        },
        notices: {
            excludedFolder: '已排除資料夾：{name}'
        },
        notifications: {
            deletedMultipleFiles: '已刪除 {count} 個檔案',
            movedMultipleFiles: '已將 {count} 個檔案移動至 {folder}',
            folderNoteConversionSuccess: '已在「{name}」中將檔案轉換為資料夾筆記',
            folderMoved: '已移動資料夾 "{name}" ',
            deepLinkCopied: 'Obsidian URL 已複製到剪貼簿',
            pathCopied: '路徑已複製到剪貼簿',
            relativePathCopied: '相對路徑已複製到剪貼簿',
            tagAddedToNote: '已將標籤新增至 1 則筆記',
            tagAddedToNotes: '已將標籤新增至 {count} 則筆記',
            tagRemovedFromNote: '已從 1 則筆記中移除標籤',
            tagRemovedFromNotes: '已從 {count} 則筆記中移除標籤',
            tagsClearedFromNote: '已清除 1 則筆記的所有標籤',
            tagsClearedFromNotes: '已清除 {count} 則筆記的所有標籤',
            noTagsToRemove: '沒有可移除的標籤',
            noFilesSelected: '未選取檔案',
            tagOperationsNotAvailable: '標籤操作不可用',
            tagsRequireMarkdown: '僅支援 Markdown 筆記的標籤',
            iconPackDownloaded: '{provider} 已下載',
            iconPackRemoved: '{provider} 已移除',
            iconPackLoadFailed: '載入 {provider} 失敗'
        },
        confirmations: {
            deleteMultipleFiles: '您確定要刪除 {count} 個檔案嗎？',
            deleteConfirmation: '此操作無法復原。'
        },
        defaultNames: {
            untitled: '未命名',
            untitledNumber: '未命名 {number}'
        }
    },

    // 拖放操作
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: '無法將資料夾移動至其自身或子資料夾中。',
            itemAlreadyExists: '名為 "{name}" 的項目已存在於此位置。',
            failedToMove: '移動失敗：{error}',
            failedToAddTag: '新增標籤 "{tag}" 失敗',
            failedToClearTags: '清除標籤失敗',
            failedToMoveFolder: '移動資料夾 "{name}" 失敗',
            failedToImportFiles: '匯入失敗：{names}'
        },
        notifications: {
            filesAlreadyExist: '{count} 個檔案已存在於目標位置',
            addedTag: '已將標籤 "{tag}" 新增至 {count} 個檔案',
            filesAlreadyHaveTag: '{count} 個檔案已有此標籤或更具體的標籤',
            clearedTags: '已清除 {count} 個檔案的所有標籤',
            noTagsToClear: '沒有可清除的標籤',
            fileImported: '已匯入 1 個檔案',
            filesImported: '已匯入 {count} 個檔案'
        }
    },

    // 日期分組
    dateGroups: {
        today: '今天',
        yesterday: '昨天',
        previous7Days: '過去 7 天',
        previous30Days: '過去 30 天'
    },

    // 星期
    weekdays: {
        sunday: '星期日',
        monday: '星期一',
        tuesday: '星期二',
        wednesday: '星期三',
        thursday: '星期四',
        friday: '星期五',
        saturday: '星期六'
    },

    // 外掛指令
    commands: {
        open: '開啟', // 指令面板：開啟 Notebook Navigator 檢視 (英文: Open)
        openHomepage: '開啟首頁', // 指令面板：開啟 Notebook Navigator 檢視並載入首頁檔案 (英文: Open homepage)
        revealFile: '顯示檔案', // 指令面板：在導覽器中顯示並選取目前活動的檔案 (英文: Reveal file)
        revealActiveTopic: '顯示活動主題', // 指令面板：在導覽器中顯示活動主題筆記 (英文: Reveal active topic)
        search: '搜尋', // 指令面板：在檔案清單中切換搜尋 (英文: Search)
        toggleDualPane: '切換雙窗格佈局', // 指令面板：在單一窗格和雙窗格佈局之間切換 (英文: Toggle dual pane layout)
        deleteFile: '刪除檔案', // 指令面板：刪除目前活動的檔案 (英文: Delete file)
        createNewNote: '建立新筆記', // 指令面板：在目前選取的資料夾中建立新筆記 (英文: Create new note)
        moveFiles: '移動檔案', // 指令面板：將選取的檔案移動至另一個資料夾 (英文: Move files)
        convertToFolderNote: '轉換為資料夾筆記', // 指令面板：將活動檔案轉換為帶有新資料夾的資料夾筆記 (英文: Convert to folder note)
        navigateToFolder: '導覽至資料夾', // 指令面板：使用模糊搜尋導覽至資料夾 (英文: Navigate to folder)
        navigateToTag: '導覽至標籤', // 指令面板：使用模糊搜尋導覽至標籤 (英文: Navigate to tag)
        addShortcut: '新增至捷徑', // 指令面板：將目前的檔案、資料夾或標籤加入捷徑 (英文: Add to shortcuts)
        toggleDescendants: '切換後代項目', // 指令面板：切換顯示後代中的筆記 (英文: Toggle descendants)
        toggleHidden: '切換隱藏項目', // 指令面板：切換顯示隱藏項目 (英文: Toggle hidden items)
        collapseExpand: '收合/展開所有項目', // 指令面板：收合或展開所有資料夾和標籤 (英文: Collapse / expand all items)
        addTag: '為選取檔案新增標籤', // 指令面板：開啟對話框為選取檔案新增標籤 (英文: Add tag to selected files)
        removeTag: '從選取檔案移除標籤', // 指令面板：開啟對話框從選取檔案移除標籤 (英文: Remove tag from selected files)
        removeAllTags: '從選取檔案移除所有標籤', // 指令面板：從選取檔案移除所有標籤 (英文: Remove all tags from selected files)
        rebuildCache: '重建快取' // 指令面板：重建本地 Notebook Navigator 快取 (英文: Rebuild cache)
    },

    // 外掛 UI
    plugin: {
        viewName: 'Notebook Navigator', // 檢視標頭/分頁中顯示的名稱 (英文: Notebook Navigator)
        ribbonTooltip: 'Notebook Navigator', // 左側邊欄功能區圖示的工具提示 (英文: Notebook Navigator)
        revealInNavigator: '在 Notebook Navigator 中顯示' // 右鍵選單項目，在導覽器中顯示檔案 (英文: Reveal in Notebook Navigator)
    },

    // 工具提示
    tooltips: {
        lastModifiedAt: '最後修改於',
        createdAt: '建立於',
        file: '檔案',
        files: '檔案',
        folder: '資料夾',
        folders: '資料夾'
    },

    // 設定
    settings: {
        metadataReport: {
            exportSuccess: '中繼資料報告匯出失敗至：{filename}',
            exportFailed: '匯出中繼資料報告失敗'
        },
        sections: {
            general: '通用',
            navigationPane: '導覽窗格',
            icons: '圖示包',
            folders: '資料夾',
            tags: '標籤',
            topics: '主題',
            search: '搜尋',
            listPane: '列表窗格',
            notes: '筆記',
            hotkeys: '快捷鍵',
            advanced: '進階'
        },
        groups: {
            general: {
                view: '外觀',
                behavior: '行為',
                filtering: '篩選',
                formatting: '格式'
            },
            navigation: {
                behavior: '行為',
                appearance: '外觀'
            },
            list: {
                display: '外觀',
                quickActions: '快速操作'
            },
            notes: {
                frontmatter: '前置元資料',
                display: '外觀'
            }
        },
        items: {
            searchProvider: {
                name: '搜尋提供者',
                desc: '選擇快速檔案名稱搜尋或使用 Omnisearch 外掛進行全文搜尋。',
                options: {
                    internal: '篩選搜尋',
                    omnisearch: 'Omnisearch (全文)'
                },
                info: {
                    filterSearch: {
                        title: '篩選搜尋 (預設)：',
                        description:
                            '快速、輕量的搜尋，可在目前資料夾和子資料夾中依檔案名稱和標籤篩選檔案。支援使用 # 前綴進行標籤篩選 (例如 #project)、使用 ! 前綴進行排除 (例如 !draft, !#archived)，以及使用 !# 尋找無標籤的筆記。適合在目前上下文中快速導覽。'
                    },
                    omnisearch: {
                        title: 'Omnisearch：',
                        description:
                            '全文搜尋，會搜尋您的整個儲存庫，然後篩選結果以僅顯示目前資料夾、子資料夾或選定標籤中的檔案。需要安裝 Omnisearch 外掛 - 如果未安裝，搜尋將自動退回至篩選搜尋。',
                        warningNotInstalled: '未安裝 Omnisearch 外掛。將使用篩選搜尋。',
                        limitations: {
                            title: '已知限制：',
                            performance: '效能：在大型儲存庫中搜尋少於 3 個字元時可能會很慢',
                            pathBug: '路徑錯誤：無法在包含非 ASCII 字元的路徑中搜尋，且無法正確搜尋子路徑，影響搜尋結果中出現的檔案',
                            limitedResults:
                                '有限的結果：由於 Omnisearch 會搜尋整個儲存庫並在篩選前返回有限數量的結果，如果儲存庫中其他地方存在太多匹配項，您目前資料夾中的相關檔案可能不會出現',
                            previewText:
                                '預覽文字：筆記預覽會被 Omnisearch 結果摘要取代，如果實際的搜尋匹配項出現在檔案的其他地方，可能不會顯示反白'
                        }
                    }
                }
            },
            listPaneTitle: {
                name: '列表窗格標題',
                desc: '選擇列表窗格標題的顯示位置。',
                options: {
                    header: '顯示在標頭',
                    list: '顯示在列表窗格',
                    hidden: '不顯示'
                }
            },
            sortNotesBy: {
                name: '筆記排序方式',
                desc: '選擇筆記在筆記清單中的排序方式。',
                options: {
                    'modified-desc': '編輯日期 (最新在頂部)',
                    'modified-asc': '編輯日期 (最舊在頂部)',
                    'created-desc': '建立日期 (最新在頂部)',
                    'created-asc': '建立日期 (最舊在頂部)',
                    'title-asc': '標題 (升冪)',
                    'title-desc': '標題 (降冪)'
                }
            },
            includeDescendantNotes: {
                name: '顯示子資料夾/後代中的筆記',
                desc: '檢視資料夾或標籤時，包含巢狀子資料夾和標籤後代的筆記。'
            },
            separateNoteCounts: {
                name: '分別顯示當前和後代計數',
                desc: '在資料夾和標籤中以「當前 ▾ 後代」格式顯示筆記計數。'
            },
            groupByDate: {
                name: '依日期分組筆記',
                desc: '依日期排序時，將筆記分組在日期標頭下。'
            },
            optimizeNoteHeight: {
                name: '最佳化筆記高度',
                desc: '減少釘選筆記和無預覽文字筆記的高度。'
            },
            showParentFolderNames: {
                name: '顯示父資料夾名稱',
                desc: '在子資料夾或標籤中顯示筆記的父資料夾名稱。'
            },
            showQuickActions: {
                name: '顯示快速操作 (僅限桌面版)',
                desc: '在檔案項目上顯示懸停操作。'
            },
            quickActionsRevealInFolder: {
                name: '在資料夾中顯示',
                desc: '快速操作：在其父資料夾中顯示筆記。僅在檢視子資料夾或標籤中的筆記時可見 (在筆記的實際資料夾中不顯示)。'
            },
            quickActionsPinNote: {
                name: '釘選筆記',
                desc: '快速操作：在清單頂部釘選或取消釘選筆記。'
            },
            quickActionsOpenInNewTab: {
                name: '在新分頁中開啟',
                desc: '快速操作：在新分頁中開啟筆記。'
            },
            dualPane: {
                name: '雙窗格佈局 (僅限桌面版，不同步)',
                desc: '在桌面版並排顯示導覽窗格和列表窗格。'
            },
            startView: {
                name: '預設啟動檢視',
                desc: '選擇開啟 Notebook Navigator 時顯示哪個窗格。導覽窗格顯示捷徑、最近筆記和資料夾樹。列表窗格立即顯示筆記清單。',
                options: {
                    navigation: '導覽窗格',
                    files: '列表窗格'
                }
            },
            autoRevealActiveNote: {
                name: '自動顯示活動筆記',
                desc: '從快速切換器、連結或搜尋開啟筆記時自動顯示。'
            },
            autoRevealIgnoreRightSidebar: {
                name: '忽略右側邊欄事件',
                desc: '在右側邊欄點擊或變更筆記時，不變更活動筆記。'
            },
            autoSelectFirstFileOnFocusChange: {
                name: '自動選取第一則筆記 (僅限桌面版)',
                desc: '切換資料夾或標籤時自動開啟第一則筆記。'
            },
            autoExpandFoldersTags: {
                name: '自動展開資料夾和標籤',
                desc: '選取資料夾和標籤時自動展開。'
            },
            navigationBanner: {
                name: '導覽橫幅',
                desc: '在導覽窗格上方顯示圖片。',
                current: '目前橫幅：{path}',
                chooseButton: '選擇圖片',
                clearButton: '清除'
            },
            showShortcuts: {
                name: '顯示捷徑',
                desc: '在導覽窗格中顯示捷徑區段。'
            },
            showRecentNotes: {
                name: '顯示最近筆記',
                desc: '在導覽窗格中顯示最近筆記區段。'
            },
            recentNotesCount: {
                name: '最近筆記數量',
                desc: '要顯示的最近筆記數量。'
            },
            showTooltips: {
                name: '顯示工具提示 (僅限桌面版)',
                desc: '顯示懸停工具提示，提供筆記和資料夾的額外資訊。'
            },
            multiSelectModifier: {
                name: '多重選取修飾鍵',
                desc: '選擇哪個修飾鍵切換多重選取。選擇 Option/Alt 時，Cmd/Ctrl 點擊會在一個新分頁中開啟筆記。',
                options: {
                    cmdCtrl: 'Cmd/Ctrl 點擊',
                    optionAlt: 'Option/Alt 點擊'
                }
            },
            fileVisibility: {
                name: '顯示檔案類型',
                desc: '篩選在導覽器中顯示的檔案類型。Obsidian 不支援的檔案類型可能會在外部應用程式中開啟。',
                options: {
                    documents: '文件 (.md, .canvas, .base)',
                    supported: '支援的 (在 Obsidian 中開啟)',
                    all: '全部 (可能在外部開啟)'
                }
            },
            homepage: {
                name: '首頁',
                desc: '選擇 Notebook Navigator 自動開啟的檔案，例如儀表板。',
                current: '目前：{path}',
                currentMobile: '行動裝置：{path}',
                chooseButton: '選擇檔案',
                clearButton: '清除',
                separateMobile: {
                    name: '獨立的行動裝置首頁',
                    desc: '為行動裝置使用不同的首頁。'
                }
            },
            excludedNotes: {
                name: '隱藏筆記',
                desc: '以逗號分隔的 frontmatter 屬性清單。包含任何這些屬性的筆記將被隱藏 (例如 draft, private, archived)。',
                placeholder: 'draft, private'
            },
            excludedFolders: {
                name: '隱藏資料夾',
                desc: '以逗號分隔的要隱藏的資料夾清單。名稱模式：assets* (以 assets 開頭的資料夾)、*_temp (以 _temp 結尾)。路徑模式：/archive (僅根目錄的 archive)、/res* (以 res 開頭的根資料夾)、/*/temp (一層深的 temp 資料夾)、/projects/* (projects 內的所有資料夾)。',
                placeholder: 'templates, assets*, /archive, /res*'
            },
            showFileDate: {
                name: '顯示日期',
                desc: '在筆記名稱下方顯示日期。'
            },
            showFileTags: {
                name: '顯示檔案標籤',
                desc: '在檔案項目中顯示可點擊的標籤。使用標籤顏色來視覺上區分不同類型的標籤。'
            },
            showFileTagAncestors: {
                name: '顯示父標籤',
                desc: '在標籤名稱前顯示父級片段。'
            },
            colorFileTags: {
                name: '為檔案標籤著色',
                desc: '將標籤顏色套用到檔案項目的標籤徽章。'
            },
            showFileTagsInSlimMode: {
                name: '在緊湊模式下顯示檔案標籤',
                desc: '隱藏日期、預覽和圖片時顯示標籤。'
            },
            dateFormat: {
                name: '日期格式',
                desc: '顯示日期的格式 (使用 date-fns 格式)。',
                placeholder: 'yyyy/MM/dd',
                help: '常用格式：\nMMM d, yyyy = May 25, 2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\n符號：\nyyyy/yy = 年\nMMMM/MMM/MM = 月\ndd/d = 日\nEEEE/EEE = 星期',
                helpTooltip: '點擊查看格式參考'
            },
            timeFormat: {
                name: '時間格式',
                desc: '顯示時間的格式 (使用 date-fns 格式)。',
                placeholder: 'HH:mm',
                help: '常用格式：\nh:mm a = 2:30 PM (12 小時制)\nHH:mm = 14:30 (24 小時制)\nh:mm:ss a = 2:30:45 PM\nHH:mm:ss = 14:30:45\n\n符號：\nHH/H = 24 小時\nhh/h = 12 小時\nmm = 分鐘\nss = 秒\na = AM/PM',
                helpTooltip: '點擊查看格式參考'
            },
            showFilePreview: {
                name: '顯示筆記預覽 (*)',
                desc: '在筆記名稱下方顯示預覽文字。'
            },
            skipHeadingsInPreview: {
                name: '在預覽中跳過標題',
                desc: '產生預覽文字時跳過標題行。'
            },
            skipCodeBlocksInPreview: {
                name: '在預覽中跳過程式碼區塊',
                desc: '產生預覽文字時跳過程式碼區塊。'
            },
            previewProperties: {
                name: '預覽屬性',
                desc: '以逗號分隔的 frontmatter 屬性清單，用於檢查預覽文字。將使用第一個有文字的屬性。',
                placeholder: 'summary, description, abstract',
                info: '如果在指定的屬性中找不到預覽文字，將從筆記內容中產生預覽。'
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
                name: '顯示特色圖片 (*)',
                desc: '從 frontmatter 顯示縮圖。提示：使用 "Featured Image" 外掛為您的所有文件自動設定特色圖片。'
            },
            forceSquareFeatureImage: {
                name: '強制正方形特色圖片',
                desc: '將特色圖片渲染為正方形縮圖。'
            },
            featureImageProperties: {
                name: '圖片屬性',
                desc: '以逗號分隔的 frontmatter 屬性清單，用於檢查縮圖。將使用第一個有圖片的屬性。如果為空且啟用備用設定，將使用第一張嵌入的圖片。',
                placeholder: 'thumbnail, featureResized, feature'
            },
            useEmbeddedImageFallback: {
                name: '使用嵌入圖片備用',
                desc: '當在 frontmatter 屬性中找不到縮圖時，使用文件中的第一張嵌入圖片作為備用 (需要 Obsidian 1.9.4+)。停用此項以驗證縮圖是否已正確設定。'
            },
            showRootFolder: {
                name: '顯示根資料夾',
                desc: '在樹狀結構中將儲存庫名稱顯示為根資料夾。'
            },
            inheritFolderColors: {
                name: '繼承資料夾顏色',
                desc: '子資料夾繼承父資料夾的顏色。'
            },
            showNoteCount: {
                name: '顯示筆記數量',
                desc: '在每個資料夾和標籤旁邊顯示筆記數量。'
            },
            showIcons: {
                name: '顯示圖示',
                desc: '顯示資料夾、標籤和筆記的圖示。'
            },
            showIconsColorOnly: {
                name: '僅對圖示套用顏色',
                desc: '啟用時，自訂顏色僅套用於圖示。停用時，顏色將同時套用於圖示和文字標籤。'
            },
            collapseBehavior: {
                name: '收合項目',
                desc: '選擇展開/收合所有按鈕影響的對象。',
                options: {
                    all: '所有資料夾和標籤',
                    foldersOnly: '僅資料夾',
                    tagsOnly: '僅標籤'
                }
            },
            smartCollapse: {
                name: '保持選取項目展開',
                desc: '收合時，保持目前選取的資料夾或標籤及其父項目展開。'
            },
            navIndent: {
                name: '樹狀縮排',
                desc: '調整巢狀資料夾和標籤的縮排寬度。'
            },
            navItemHeight: {
                name: '項目高度',
                desc: '調整導覽窗格中資料夾和標籤的高度。'
            },
            navItemHeightScaleText: {
                name: '隨項目高度縮放文字',
                desc: '減少項目高度時，縮小導覽文字大小。'
            },
            showTags: {
                name: '顯示標籤 (*)',
                desc: '在導覽器中資料夾下方顯示標籤區段。'
            },
            tagSortOrder: {
                name: '標籤排序方式',
                desc: '選擇導覽窗格中的標籤排序順序。',
                options: {
                    alphaAsc: 'A 到 Z',
                    alphaDesc: 'Z 到 A',
                    frequencyAsc: '頻率（由低至高）',
                    frequencyDesc: '頻率（由高至低）'
                }
            },
            showTagsAboveFolders: {
                name: '在資料夾上方顯示標籤',
                desc: '在導覽器中資料夾之前顯示標籤區段。'
            },
            showAllTagsFolder: {
                name: '顯示標籤資料夾',
                desc: '將 "標籤" 顯示為可收合的資料夾。'
            },
            showUntagged: {
                name: '顯示無標籤筆記',
                desc: '為沒有任何標籤的筆記顯示 "無標籤" 項目。'
            },
            hiddenTags: {
                name: '隱藏標籤',
                desc: '以逗號分隔的標籤前綴或名稱萬用字元清單。使用 tag* 或 *tag 來匹配標籤名稱。隱藏一個標籤也會隱藏其所有子標籤 (例如 "archive" 隱藏 "archive/2024/docs")。',
                placeholder: 'internal, temp/drafts, archive/2024'
            },
            showTopics: {
                name: '顯示主題',
                desc: '在導覽窗格中顯示主題。'
            },
            topicSortOrder: {
                name: '主題排序順序',
                desc: '選擇在導覽窗格中如何排序主題。',
                options: {
                    alphaAsc: 'A 到 Z',
                    alphaDesc: 'Z 到 A',
                    frequencyAsc: '頻率（從低到高）',
                    frequencyDesc: '頻率（從高到低）'
                }
            },
            hiddenTopics: {
                name: '隱藏主題',
                desc: '要從導覽窗格隱藏的主題清單，以逗號分隔。',
                placeholder: '封存, 私密, 草稿'
            },
            enableFolderNotes: {
                name: '啟用資料夾筆記',
                desc: '啟用後，有關聯筆記的資料夾會顯示為可點擊的連結。'
            },
            folderNoteType: {
                name: '預設資料夾筆記類型',
                desc: '從右鍵選單建立的資料夾筆記類型。',
                options: {
                    markdown: 'Markdown',
                    canvas: '畫布',
                    base: 'Base'
                }
            },
            folderNoteName: {
                name: '資料夾筆記名稱',
                desc: '資料夾筆記的名稱，不含副檔名。留空以使用與資料夾相同的名稱。',
                placeholder: 'index'
            },
            folderNoteProperties: {
                name: '資料夾筆記屬性',
                desc: '新增至新建立資料夾筆記的 frontmatter 屬性 (以逗號分隔)。',
                placeholder: 'foldernote, darktheme'
            },
            hideFolderNoteInList: {
                name: '在清單中隱藏資料夾筆記',
                desc: '隱藏資料夾筆記，使其不顯示在資料夾的筆記清單中。'
            },
            pinCreatedFolderNote: {
                name: '固定建立的資料夾筆記',
                desc: '從右鍵選單建立資料夾筆記時自動固定。'
            },
            confirmBeforeDelete: {
                name: '刪除前確認',
                desc: '刪除筆記或資料夾時顯示確認對話框'
            },
            metadataCleanup: {
                name: '清理中繼資料',
                desc: '移除在 Obsidian 外部刪除、移動或重新命名檔案、資料夾或標籤時遺留的孤立中繼資料。這只會影響 Notebook Navigator 的設定檔。',
                buttonText: '清理中繼資料',
                error: '設定清理失敗',
                loading: '正在檢查中繼資料...',
                statusClean: '沒有要清理的中繼資料',
                statusCounts: '孤立項目：{folders} 個資料夾、{tags} 個標籤、{files} 個檔案、{pinned} 個釘選'
            },
            rebuildCache: {
                name: '重建快取',
                desc: '如果您遇到標籤遺失、預覽不正確或特色圖片遺失的問題，請使用此功能。這可能在同步衝突或意外關閉後發生。',
                buttonText: '重建快取',
                success: '快取已重建',
                error: '重建快取失敗'
            },
            hotkeys: {
                intro: '編輯 <plugin folder>/notebook-navigator/data.json 以自訂 Notebook Navigator 快捷鍵。開啟檔案並找到 "keyboardShortcuts" 區段。每個條目使用此結構：',
                example: '"pane:move-up": [ { "key": "ArrowUp", "modifiers": [] }, { "key": "K", "modifiers": [] } ]',
                modifierList: [
                    '"Mod" = Cmd (macOS) / Ctrl (Win/Linux)',
                    '"Alt" = Alt/Option',
                    '"Shift" = Shift',
                    '"Ctrl" = Control (建議使用 "Mod" 以實現跨平台相容)'
                ],
                guidance:
                    '新增多個對應以支援替代按鍵，如上所示的 ArrowUp 和 K 綁定。在一個條目中組合修飾鍵，請列出每個值，例如 "modifiers": ["Mod", "Shift"]。不支援如 "gg" 或 "dd" 之類的鍵盤序列。編輯檔案後請重新載入 Obsidian。'
            },
            externalIcons: {
                downloadButton: '下載',
                downloadingLabel: '下載中...',
                removeButton: '移除',
                statusInstalled: '已下載 (版本 {version})',
                statusNotInstalled: '未下載',
                versionUnknown: '未知',
                downloadFailed: '下載 {name} 失敗。請檢查您的網路連線並再試一次。',
                removeFailed: '移除 {name} 失敗。',
                infoNote:
                    '下載的圖示包會在裝置間同步安裝狀態。圖示包保留在每個裝置的本地資料庫中；同步僅追蹤是下載還是移除它們。圖示包從 Notebook Navigator 儲存庫下載 (https://github.com/johansan/notebook-navigator/tree/main/icon-assets)。',
                providers: {
                    bootstrapIconsDesc: 'https://icons.getbootstrap.com/',
                    fontAwesomeDesc: 'https://fontawesome.com/v6/search?f=classic&s=solid&ic=free&o=r',
                    materialIconsDesc: 'https://fonts.google.com/icons',
                    phosphorDesc: 'https://phosphoricons.com/',
                    rpgAwesomeDesc: 'https://nagoshiashumari.github.io/Rpg-Awesome/',
                    simpleIconsDesc: 'https://simpleicons.org/'
                }
            },
            useFrontmatterDates: {
                name: '從 frontmatter 讀取中繼資料 (*)',
                desc: '可用時從 frontmatter 讀取筆記名稱、時間戳、圖示和顏色，否則退回至檔案系統值或設定'
            },
            frontmatterNameField: {
                name: '名稱欄位',
                desc: '用作筆記顯示名稱的 frontmatter 欄位。留空以使用檔案名稱。',
                placeholder: '標題'
            },
            frontmatterIconField: {
                name: '圖示欄位',
                desc: '檔案圖示的 frontmatter 欄位。留空以使用儲存在設定中的圖示。',
                placeholder: '圖示'
            },
            frontmatterColorField: {
                name: '顏色欄位',
                desc: '檔案顏色的 frontmatter 欄位。留空以使用儲存在設定中的顏色。',
                placeholder: '顏色'
            },
            frontmatterSaveMetadata: {
                name: '將圖示和顏色儲存至 frontmatter',
                desc: '使用上方設定的欄位自動將檔案圖示和顏色寫入 frontmatter。'
            },
            frontmatterIconizeFormat: {
                name: '以 Iconize 格式儲存',
                desc: '使用 Iconize 格式（例如 LiHome, FasUser, SiGithub）儲存圖示，而不是外掛格式（例如 home, fontawesome-solid:user, simple-icons:github）。'
            },
            frontmatterMigration: {
                name: '從設定移轉圖示和顏色',
                desc: '儲存在設定中：{icons} 個圖示、{colors} 種顏色。',
                button: '移轉',
                buttonWorking: '移轉中...',
                noticeNone: '設定中未儲存任何檔案圖示或顏色。',
                noticeDone: '已移轉 {migratedIcons}/{icons} 個圖示、{migratedColors}/{colors} 種顏色。',
                noticeFailures: '失敗的項目：{failures}。',
                noticeError: '移轉失敗。請檢查主控台以取得詳細資訊。'
            },
            frontmatterCreatedField: {
                name: '建立時間戳欄位',
                desc: '用於建立時間戳的 frontmatter 欄位名稱。留空以僅使用檔案系統日期。',
                placeholder: 'created'
            },
            frontmatterModifiedField: {
                name: '修改時間戳欄位',
                desc: '用於修改時間戳的 frontmatter 欄位名稱。留空以僅使用檔案系統日期。',
                placeholder: 'modified'
            },
            frontmatterDateFormat: {
                name: '時間戳格式',
                desc: '用於解析 frontmatter 中時間戳的格式。留空以使用 ISO 8601 格式',
                helpTooltip: '請參閱 date-fns 格式文件',
                help: "常用格式：\nyyyy-MM-dd'T'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM"
            },
            supportDevelopment: {
                name: '支持開發',
                desc: '如果您喜歡使用 Notebook Navigator，請考慮支持其持續開發。',
                buttonText: '❤️ 在 GitHub 上贊助',
                coffeeButton: '☕️ 請我喝杯咖啡'
            },
            updateCheckOnStart: {
                name: '啟動時檢查新版本',
                desc: '啟動時檢查新的外掛版本，當有可用更新時顯示通知。每個版本僅通知一次，檢查最多每天一次。',
                status: '已有新版本: {version}'
            },
            whatsNew: {
                name: '最新消息',
                desc: '查看最近的更新和改進',
                buttonText: '查看最近更新'
            },
            cacheStatistics: {
                localCache: '(*) 本地快取',
                items: '項目',
                withTags: '帶有標籤',
                withPreviewText: '帶有預覽文字',
                withFeatureImage: '帶有特色圖片',
                withMetadata: '帶有中繼資料'
            },
            metadataInfo: {
                successfullyParsed: '成功解析',
                itemsWithName: '帶有名稱的項目',
                withCreatedDate: '帶有建立日期',
                withModifiedDate: '帶有修改日期',
                withIcon: '帶有圖示',
                withColor: '帶有顏色',
                failedToParse: '解析失敗',
                createdDates: '建立日期',
                modifiedDates: '修改日期',
                checkTimestampFormat: '請檢查您的時間戳格式。',
                exportFailed: '匯出錯誤'
            }
        }
    },
    whatsNew: {
        title: 'Notebook Navigator 的新功能',
        supportMessage: '如果您覺得 Notebook Navigator 有幫助，請考慮支持其開發。',
        supportButton: '請我喝杯咖啡',
        thanksButton: '謝謝！'
    }
};
