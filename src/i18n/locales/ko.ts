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
 * Korean language strings for Notebook Navigator
 * Organized by feature/component for easy maintenance
 */
export const STRINGS_KO = {
    // Common UI elements
    common: {
        cancel: '취소', // Button text for canceling dialogs and operations (English: Cancel)
        delete: '삭제', // Button text for delete operations in dialogs (English: Delete)
        remove: '제거', // Button text for remove operations in dialogs (English: Remove)
        submit: '제출', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: '선택 없음', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: '태그 없음', // Label for notes without any tags (English: Untagged)
        untitled: '제목 없음', // Default name for notes without a title (English: Untitled)
        featureImageAlt: '대표 이미지', // Alt text for thumbnail/preview images (English: Feature image)
        unknownError: '알 수 없는 오류', // Generic fallback when an error has no message (English: Unknown error)
        updateBannerTitle: 'Notebook Navigator 업데이트 사용 가능',
        updateBannerInstruction: '설정 -> 커뮤니티 플러그인에서 업데이트',
        updateIndicatorLabel: '새 버전이 있습니다'
    },

    // List pane
    listPane: {
        emptyStateNoSelection: '노트를 보려면 폴더나 태그를 선택하세요', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: '노트 없음', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 고정됨', // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
        notesSection: '노트', // Header shown between pinned and regular items when showing documents only (English: Notes)
        filesSection: '파일' // Header shown between pinned and regular items when showing supported or all files (English: Files)
    },

    // Tag list
    tagList: {
        untaggedLabel: '태그 없음', // Label for the special item showing notes without tags (English: Untagged)
        hiddenTags: '숨겨진 태그', // Label for the hidden tags virtual folder (English: Hidden tags)
        tags: '태그', // Label for the tags virtual folder (English: Tags)
        topics: '주제', // Label for the topics virtual folder (English: Topics)
    },

    navigationPane: {
        shortcutsHeader: '바로가기',
        recentNotesHeader: '최근 노트',
        recentFilesHeader: '최근 파일',
        reorderRootFoldersTitle: '내비게이션 섹션 재정렬',
        reorderRootFoldersHint: '헤더나 항목을 드래그하여 순서를 변경합니다',
        vaultRootLabel: '보관함',
        resetRootToAlpha: '알파벳 순서로 리셋',
        resetRootToFrequency: '빈도 순으로 리셋',
        dragHandleLabel: '드래그하여 순서 변경',
        pinShortcuts: '바로가기를 고정',
        unpinShortcuts: '바로가기 고정을 해제'
    },

    shortcuts: {
        folderExists: '폴더가 이미 바로가기에 있습니다',
        noteExists: '노트가 이미 바로가기에 있습니다',
        tagExists: '태그가 이미 바로가기에 있습니다',
        topicExists: '주제가 이미 바로가기에 있습니다',
        searchExists: '검색 바로가기가 이미 존재합니다',
        emptySearchQuery: '저장하기 전에 검색 쿼리를 입력하세요',
        emptySearchName: '검색을 저장하기 전에 이름을 입력하세요',
        add: '바로가기에 추가',
        remove: '바로가기에 제거',
        moveUp: '위로 이동',
        moveDown: '아래로 이동'
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: '항목 접기', // Tooltip for button that collapses expanded items (English: Collapse items)
        expandAllFolders: '모든 항목 펼치기', // Tooltip for button that expands all items (English: Expand all items)
        scrollToTop: '맨 위로 스크롤',
        newFolder: '새 폴더', // Tooltip for create new folder button (English: New folder)
        newNote: '새 노트', // Tooltip for create new note button (English: New note)
        mobileBackToNavigation: '탐색으로 돌아가기', // Mobile-only back button text to return to navigation pane (English: Back to navigation)
        changeSortOrder: '정렬 순서 변경', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: '기본', // Label for default sorting mode (English: Default)
        customSort: '사용자 정의', // Label for custom sorting mode (English: Custom)
        showFolders: '탐색 표시', // Tooltip for button to show the navigation pane (English: Show navigation)
        hideFolders: '탐색 숨기기', // Tooltip for button to hide the navigation pane (English: Hide navigation)
        reorderRootFolders: '루트 폴더와 태그 재정렬',
        finishRootFolderReorder: '재정렬 완료',
        toggleDescendantNotes: '하위 폴더 / 하위 항목 노트 표시', // Tooltip: include descendants for folders and tags
        autoExpandFoldersTags: '폴더 및 태그 자동 펼치기', // Tooltip for button to toggle auto-expanding folders and tags when selected (English: Auto-expand folders and tags)
        showExcludedItems: '숨겨진 항목 표시', // Tooltip for button to show hidden items (English: Show hidden items)
        hideExcludedItems: '숨겨진 항목 숨기기', // Tooltip for button to hide hidden items (English: Hide hidden items)
        showDualPane: '이중 창 표시', // Tooltip for button to show dual-pane layout (English: Show dual panes)
        showSinglePane: '단일 창 표시', // Tooltip for button to show single-pane layout (English: Show single pane)
        changeAppearance: '모양 변경', // Tooltip for button to change folder appearance settings (English: Change appearance)
        search: '검색' // Tooltip for search button (English: Search)
    },
    // Search input
    searchInput: {
        placeholder: '검색...', // Placeholder text for search input (English: Search...)
        placeholderOmnisearch: 'Omnisearch...', // Placeholder text when Omnisearch provider is active (English: Omnisearch...)
        clearSearch: '검색 지우기', // Tooltip for clear search button (English: Clear search)
        saveSearchShortcut: '검색을 바로가기에 저장',
        removeSearchShortcut: '바로가기에서 검색 제거',
        shortcutModalTitle: '검색 바로가기 저장',
        shortcutNameLabel: '바로가기 이름',
        shortcutNamePlaceholder: '바로가기 이름을 입력하세요'
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: '새 탭에서 열기',
            openToRight: '오른쪽에 열기',
            openInNewWindow: '새 창에서 열기',
            openMultipleInNewTabs: '{count}개의 노트를 새 탭에서 열기',
            openMultipleFilesInNewTabs: '{count}개의 파일을 새 탭에서 열기',
            openMultipleToRight: '{count}개의 노트를 오른쪽에 열기',
            openMultipleFilesToRight: '{count}개의 파일을 오른쪽에 열기',
            openMultipleInNewWindows: '{count}개의 노트를 새 창에서 열기',
            openMultipleFilesInNewWindows: '{count}개의 파일을 새 창에서 열기',
            pinNote: '노트 고정',
            pinFile: '파일 고정',
            unpinNote: '노트 고정 해제',
            unpinFile: '파일 고정 해제',
            pinMultipleNotes: '{count}개의 노트 고정',
            pinMultipleFiles: '{count}개의 파일 고정',
            unpinMultipleNotes: '{count}개의 노트 고정 해제',
            unpinMultipleFiles: '{count}개의 파일 고정 해제',
            duplicateNote: '노트 복제',
            duplicateFile: '파일 복제',
            duplicateMultipleNotes: '{count}개의 노트 복제',
            duplicateMultipleFiles: '{count}개의 파일 복제',
            openVersionHistory: '버전 기록 열기',
            revealInFolder: '폴더에서 표시',
            revealInFinder: 'Finder에서 표시',
            showInExplorer: '시스템 탐색기에서 표시',
            copyDeepLink: 'Obsidian URL 복사',
            copyPath: '경로 복사',
            copyRelativePath: '상대 경로 복사',
            renameNote: '노트 이름 변경',
            renameFile: '파일 이름 변경',
            deleteNote: '노트 삭제',
            deleteFile: '파일 삭제',
            deleteMultipleNotes: '{count}개의 노트 삭제',
            deleteMultipleFiles: '{count}개의 파일 삭제',
            moveToFolder: '이동...',
            moveMultipleToFolder: '{count}개의 파일을 이동...',
            addTag: '태그 추가',
            removeTag: '태그 제거',
            removeAllTags: '모든 태그 제거',
            changeIcon: '아이콘 변경',
            changeColor: '색상 변경'
        },
        folder: {
            newNote: '새 노트',
            newFolder: '새 폴더',
            newCanvas: '새 캔버스',
            newBase: '새 베이스',
            newDrawing: '새 드로잉',
            duplicateFolder: '폴더 복제',
            searchInFolder: '폴더에서 검색',
            createFolderNote: '폴더 노트 만들기',
            deleteFolderNote: '폴더 노트 삭제',
            changeIcon: '아이콘 변경',
            changeColor: '아이콘 색상 변경',
            changeBackground: '배경색 변경',
            excludeFolder: '폴더 숨기기',
            moveFolder: '이동...',
            renameFolder: '폴더 이름 변경',
            deleteFolder: '폴더 삭제'
        },
        tag: {
            changeIcon: '아이콘 변경',
            changeColor: '색상 변경',
            changeBackground: '배경색 변경',
            showTag: '태그 표시',
            hideTag: '태그 숨기기'
        },
        topic: {
            changeIcon: '아이콘 변경',
            changeColor: '색상 변경',
            changeBackground: '배경 변경',
            showTopic: '주제 표시',
            hideTopic: '주제 숨기기'
        }
    },

    // Folder appearance menu
    folderAppearance: {
        defaultPreset: '기본 모양',
        slimPreset: '슬림 (날짜/미리보기/이미지 없음)',
        titleRows: '제목 행',
        previewRows: '미리보기 행',
        defaultOption: (rows: number) => `기본 (${rows})`,
        defaultTitleOption: (rows: number) => `기본 제목 행 (${rows})`,
        defaultPreviewOption: (rows: number) => `기본 미리보기 행 (${rows})`,
        titleRowOption: (rows: number) => `${rows}개 제목 행`,
        previewRowOption: (rows: number) => `${rows}개 미리보기 행`
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: '아이콘 검색...',
            recentlyUsedHeader: '최근 사용',
            emptyStateSearch: '아이콘을 검색하려면 입력하세요',
            emptyStateNoResults: '아이콘을 찾을 수 없음',
            showingResultsInfo: '{count}개 중 50개 결과 표시. 더 좁혀서 검색하세요.',
            emojiInstructions: '이모지를 입력하거나 붙여넣어 아이콘으로 사용하세요',
            removeIcon: '아이콘 제거'
        },
        colorPicker: {
            currentColor: '현재',
            newColor: '새로운',
            presetColors: '프리셋 색상',
            recentColors: '최근 색상',
            clearRecentColors: '최근 색상 지우기',
            removeRecentColor: '색상 제거',
            removeColor: '색상 제거',
            apply: '적용',
            hexLabel: 'HEX',
            rgbLabel: 'RGBA',
            colors: {
                red: '빨강',
                orange: '주황',
                amber: '호박색',
                yellow: '노랑',
                lime: '라임',
                green: '초록',
                emerald: '에메랄드',
                teal: '청록',
                cyan: '시안',
                sky: '하늘',
                blue: '파랑',
                indigo: '남색',
                violet: '보라',
                purple: '자주',
                fuchsia: '푸크시아',
                pink: '분홍',
                rose: '장미',
                gray: '회색',
                slate: '슬레이트',
                stone: '돌'
            }
        },
        tagOperation: {
            renameTitle: '태그 {tag} 이름 변경',
            deleteTitle: '태그 {tag} 삭제',
            newTagPrompt: '새 태그 이름',
            newTagPlaceholder: '새 태그 이름 입력',
            renameWarning: '태그 {oldTag}의 이름을 변경하면 {count}개의 {files}이(가) 수정됩니다.',
            deleteWarning: '태그 {tag}을(를) 삭제하면 {count}개의 {files}이(가) 수정됩니다.',
            modificationWarning: '파일 수정 날짜가 업데이트됩니다.',
            affectedFiles: '영향받는 파일:',
            andMore: '...그리고 {count}개 더',
            confirmRename: '태그 이름 변경',
            confirmDelete: '태그 삭제',
            file: '파일',
            files: '파일'
        },
        fileSystem: {
            newFolderTitle: '새 폴더',
            renameFolderTitle: '폴더 이름 변경',
            renameFileTitle: '파일 이름 변경',
            deleteFolderTitle: "'{name}'을(를) 삭제하시겠습니까?",
            deleteFileTitle: "'{name}'을(를) 삭제하시겠습니까?",
            folderNamePrompt: '폴더 이름 입력:',
            renamePrompt: '새 이름 입력:',
            renameVaultTitle: '보관함 표시 이름 변경',
            renameVaultPrompt: '사용자 정의 표시 이름 입력 (기본값을 사용하려면 비워두세요):',
            deleteFolderConfirm: '이 폴더와 모든 내용을 삭제하시겠습니까?',
            deleteFileConfirm: '이 파일을 삭제하시겠습니까?',
            removeAllTagsTitle: '모든 태그 제거',
            removeAllTagsFromNote: '이 노트에서 모든 태그를 제거하시겠습니까?',
            removeAllTagsFromNotes: '{count}개의 노트에서 모든 태그를 제거하시겠습니까?'
        },
        folderSuggest: {
            placeholder: '폴더로 이동...',
            navigatePlaceholder: '폴더로 이동...',
            instructions: {
                navigate: '이동',
                move: '이동',
                select: '선택',
                dismiss: '닫기'
            }
        },
        homepage: {
            placeholder: '파일 검색...',
            instructions: {
                navigate: '이동',
                select: '홈페이지 설정',
                dismiss: '닫기'
            }
        },
        navigationBanner: {
            placeholder: '이미지 검색...',
            instructions: {
                navigate: '이동',
                select: '배너 설정',
                dismiss: '닫기'
            }
        },
        tagSuggest: {
            placeholder: '태그 검색...',
            navigatePlaceholder: '태그로 이동...',
            addPlaceholder: '추가할 태그 검색...',
            removePlaceholder: '제거할 태그 선택...',
            createNewTag: '새 태그 생성: #{tag}',
            instructions: {
                navigate: '이동',
                select: '선택',
                dismiss: '닫기',
                add: '태그 추가',
                remove: '태그 제거'
            }
        }
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: '폴더 생성 실패: {error}',
            createFile: '파일 생성 실패: {error}',
            renameFolder: '폴더 이름 변경 실패: {error}',
            renameFolderNoteConflict: '이름 변경 불가: 이 폴더에 "{name}"이(가) 이미 존재합니다',
            renameFile: '파일 이름 변경 실패: {error}',
            deleteFolder: '폴더 삭제 실패: {error}',
            deleteFile: '파일 삭제 실패: {error}',
            duplicateNote: '노트 복제 실패: {error}',
            createCanvas: '캔버스 생성 실패: {error}',
            createDatabase: '데이터베이스 생성 실패: {error}',
            duplicateFolder: '폴더 복제 실패: {error}',
            openVersionHistory: '버전 기록 열기 실패: {error}',
            versionHistoryNotFound: '버전 기록 명령을 찾을 수 없습니다. Obsidian Sync가 활성화되어 있는지 확인하세요.',
            revealInExplorer: '시스템 탐색기에서 파일 표시 실패: {error}',
            folderNoteAlreadyExists: '폴더 노트가 이미 존재합니다',
            folderAlreadyExists: '폴더 "{name}"이(가) 이미 존재합니다',
            folderNotesDisabled: '파일을 변환하려면 설정에서 폴더 노트를 활성화하세요',
            folderNoteAlreadyLinked: '이 파일은 이미 폴더 노트로 작동하고 있습니다',
            folderNoteUnsupportedExtension: '지원되지 않는 파일 확장자: {extension}',
            folderNoteMoveFailed: '변환 중 파일 이동 실패: {error}',
            folderNoteRenameConflict: '"{name}"이라는 이름의 파일이 이미 폴더에 존재합니다',
            folderNoteConversionFailed: '폴더 노트로 변환 실패',
            folderNoteConversionFailedWithReason: '폴더 노트로 변환 실패: {error}',
            folderNoteOpenFailed: '파일은 변환되었지만 폴더 노트 열기 실패: {error}',
            failedToDeleteFile: '{name} 삭제 실패: {error}',
            failedToDeleteMultipleFiles: '{count}개의 파일 삭제 실패',
            versionHistoryNotAvailable: '버전 기록 서비스를 사용할 수 없습니다',
            drawingAlreadyExists: '이 이름의 드로잉이 이미 존재합니다',
            failedToCreateDrawing: '드로잉 생성 실패',
            noFolderSelected: 'Notebook Navigator에서 선택된 폴더가 없습니다',
            noFileSelected: '선택된 파일이 없습니다'
        },
        notices: {
            excludedFolder: '숨겨진 폴더: {name}'
        },
        notifications: {
            deletedMultipleFiles: '{count}개의 파일이 삭제됨',
            movedMultipleFiles: '{count}개의 파일이 {folder}로 이동됨',
            folderNoteConversionSuccess: '"{name}"에서 파일을 폴더 노트로 변환함',
            folderMoved: '폴더 "{name}"이(가) 이동됨',
            deepLinkCopied: 'Obsidian URL이 클립보드에 복사됨',
            pathCopied: '경로가 클립보드에 복사됨',
            relativePathCopied: '상대 경로가 클립보드에 복사됨',
            tagAddedToNote: '1개의 노트에 태그 추가됨',
            tagAddedToNotes: '{count}개의 노트에 태그 추가됨',
            tagRemovedFromNote: '1개의 노트에서 태그 제거됨',
            tagRemovedFromNotes: '{count}개의 노트에서 태그 제거됨',
            tagsClearedFromNote: '1개의 노트에서 모든 태그 제거됨',
            tagsClearedFromNotes: '{count}개의 노트에서 모든 태그 제거됨',
            noTagsToRemove: '제거할 태그 없음',
            noFilesSelected: '선택된 파일 없음',
            tagOperationsNotAvailable: '태그 작업을 사용할 수 없음',
            tagsRequireMarkdown: '태그는 마크다운 노트에서만 지원됩니다',
            iconPackDownloaded: '{provider} 다운로드됨',
            iconPackUpdated: '{provider} 업데이트됨 ({version})',
            iconPackRemoved: '{provider} 제거됨',
            iconPackLoadFailed: '{provider} 로드에 실패했습니다'
        },
        confirmations: {
            deleteMultipleFiles: '{count}개의 파일을 삭제하시겠습니까?',
            deleteConfirmation: '이 작업은 취소할 수 없습니다.'
        },
        defaultNames: {
            untitled: '제목 없음',
            untitledNumber: '제목 없음 {number}'
        }
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: '폴더를 자기 자신이나 하위 폴더로 이동할 수 없습니다.',
            itemAlreadyExists: '이 위치에 "{name}"이(가) 이미 존재합니다.',
            failedToMove: '이동 실패: {error}',
            failedToAddTag: '태그 "{tag}" 추가 실패',
            failedToClearTags: '태그 지우기 실패',
            failedToMoveFolder: '폴더 "{name}" 이동 실패',
            failedToImportFiles: '가져오기 실패: {names}'
        },
        notifications: {
            filesAlreadyExist: '대상에 {count}개의 파일이 이미 존재합니다',
            addedTag: '{count}개의 파일에 태그 "{tag}" 추가됨',
            filesAlreadyHaveTag: '{count}개의 파일이 이미 이 태그나 더 구체적인 태그를 가지고 있습니다',
            clearedTags: '{count}개의 파일에서 모든 태그 제거됨',
            noTagsToClear: '지울 태그 없음',
            fileImported: '1개의 파일 가져옴',
            filesImported: '{count}개의 파일 가져옴'
        }
    },

    // Date grouping
    dateGroups: {
        today: '오늘',
        yesterday: '어제',
        previous7Days: '지난 7일',
        previous30Days: '지난 30일'
    },

    // Weekdays
    weekdays: {
        sunday: '일요일',
        monday: '월요일',
        tuesday: '화요일',
        wednesday: '수요일',
        thursday: '목요일',
        friday: '금요일',
        saturday: '토요일'
    },

    // Plugin commands
    commands: {
        open: '열기', // Command palette: Opens the Notebook Navigator view (English: Open)
        openHomepage: '홈페이지 열기', // Command palette: Opens the Notebook Navigator view and loads the homepage file (English: Open homepage)
        revealFile: '파일 표시', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal file)
        revealActiveTopic: '활성 주제 표시', // Command palette: Reveals the active topic note in the navigator (English: Reveal active topic)
        revealActiveTopicAllPaths: '활성 주제 표시 (모든 경로)', // Command palette: Reveals the active topic note by expanding all paths to root nodes (English: Reveal active topic (all paths))
        search: '검색', // Command palette: Toggle search in the file list (English: Search)
        toggleDualPane: '이중 창 레이아웃 전환', // Command palette: Toggles between single-pane and dual-pane layout (English: Toggle dual pane layout)
        deleteFile: '파일 삭제', // Command palette: Deletes the currently active file (English: Delete file)
        createNewNote: '새 노트 만들기', // Command palette: Creates a new note in the currently selected folder (English: Create new note)
        moveFiles: '파일 이동', // Command palette: Move selected files to another folder (English: Move files)
        convertToFolderNote: '폴더 노트로 변환', // Command palette: Converts the active file into a folder note with a new folder (English: Convert to folder note)
        navigateToFolder: '폴더로 이동', // Command palette: Navigate to a folder using fuzzy search (English: Navigate to folder)
        navigateToTag: '태그로 이동', // Command palette: Navigate to a tag using fuzzy search (English: Navigate to tag)
        addShortcut: '바로가기에 추가', // Command palette: Adds the current file, folder, or tag to shortcuts (English: Add to shortcuts)
        toggleDescendants: '하위 항목 전환', // Command palette: Toggles showing notes from descendants (English: Toggle descendants)
        toggleHidden: '숨겨진 항목 전환', // Command palette: Toggles showing hidden items (English: Toggle hidden items)
        collapseExpand: '모든 항목 접기 / 펼치기', // Command palette: Collapse or expand all folders and tags (English: Collapse / expand all items)
        addTag: '선택한 파일에 태그 추가', // Command palette: Opens a dialog to add a tag to selected files (English: Add tag to selected files)
        removeTag: '선택한 파일에서 태그 제거', // Command palette: Opens a dialog to remove a tag from selected files (English: Remove tag from selected files)
        removeAllTags: '선택한 파일에서 모든 태그 제거', // Command palette: Removes all tags from selected files (English: Remove all tags from selected files)
        rebuildCache: '캐시 다시 빌드' // Command palette: Rebuilds the local Notebook Navigator cache (English: Rebuild cache)
    },

    // Plugin UI
    plugin: {
        viewName: 'Notebook Navigator', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: 'Notebook Navigator', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: 'Notebook Navigator에서 표시' // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: '마지막 수정',
        createdAt: '생성됨',
        file: '파일',
        files: '파일',
        folder: '폴더',
        folders: '폴더'
    },

    // Settings
    settings: {
        metadataReport: {
            exportSuccess: '메타데이터 보고서 내보내기 실패: {filename}',
            exportFailed: '메타데이터 보고서 내보내기 실패'
        },
        sections: {
            general: '일반',
            navigationPane: '탐색 창',
            icons: '아이콘 팩',
            folders: '폴더',
            tags: '태그',
            topics: '주제',
            search: '검색',
            listPane: '목록 창',
            notes: '노트',
            hotkeys: '단축키',
            advanced: '고급'
        },
        groups: {
            general: {
                view: '모양',
                behavior: '동작',
                filtering: '필터링',
                formatting: '서식'
            },
            navigation: {
                behavior: '동작',
                appearance: '모양'
            },
            list: {
                display: '모양',
                quickActions: '빠른 작업'
            },
            notes: {
                frontmatter: '프런트매터',
                display: '모양'
            }
        },
        items: {
            searchProvider: {
                name: '검색 제공자',
                desc: '빠른 파일명 검색 또는 Omnisearch 플러그인을 통한 전체 텍스트 검색 중에서 선택하세요.',
                options: {
                    internal: '필터 검색',
                    omnisearch: 'Omnisearch (전체 텍스트)'
                },
                info: {
                    filterSearch: {
                        title: '필터 검색 (기본값):',
                        description:
                            '현재 폴더와 하위 폴더 내의 파일을 이름과 태그로 필터링하는 빠르고 가벼운 검색. # 접두사를 사용한 태그 필터링(예: #프로젝트), ! 접두사를 사용한 제외(예: !초안, !#보관됨), !#를 사용한 태그 없는 노트 찾기를 지원합니다. 현재 컨텍스트 내에서 빠른 탐색에 이상적입니다.'
                    },
                    omnisearch: {
                        title: 'Omnisearch:',
                        description:
                            '전체 보관소를 검색한 다음 현재 폴더, 하위 폴더 또는 선택한 태그의 파일만 표시하도록 결과를 필터링하는 전체 텍스트 검색. Omnisearch 플러그인 설치가 필요합니다 - 사용할 수 없는 경우 검색이 자동으로 필터 검색으로 대체됩니다.',
                        warningNotInstalled: 'Omnisearch 플러그인이 설치되지 않았습니다. 필터 검색을 사용합니다.',
                        limitations: {
                            title: '알려진 제한 사항:',
                            performance: '성능: 대용량 보관소에서 3자 미만을 검색할 때 특히 느릴 수 있음',
                            pathBug:
                                '경로 버그: 비ASCII 문자가 있는 경로에서 검색할 수 없으며 하위 경로를 올바르게 검색하지 않아 검색 결과에 표시되는 파일에 영향을 줍니다',
                            limitedResults:
                                '제한된 결과: Omnisearch가 전체 보관소를 검색하고 필터링 전에 제한된 수의 결과를 반환하므로 보관소의 다른 곳에 일치 항목이 너무 많으면 현재 폴더의 관련 파일이 나타나지 않을 수 있음',
                            previewText:
                                '미리보기 텍스트: 노트 미리보기가 Omnisearch 결과 발췌로 대체되어 검색 일치 하이라이트가 파일의 다른 위치에 나타나는 경우 실제 하이라이트가 표시되지 않을 수 있음'
                        }
                    }
                }
            },
            listPaneTitle: {
                name: '목록 창 제목',
                desc: '목록 창 제목을 표시할 위치를 선택하세요.',
                options: {
                    header: '헤더에 표시',
                    list: '목록 창에 표시',
                    hidden: '표시하지 않음'
                }
            },
            sortNotesBy: {
                name: '노트 정렬 기준',
                desc: '노트 목록에서 노트를 정렬하는 방법을 선택하세요.',
                options: {
                    'modified-desc': '수정 날짜 (최신 상위)',
                    'modified-asc': '수정 날짜 (오래된 상위)',
                    'created-desc': '생성 날짜 (최신 상위)',
                    'created-asc': '생성 날짜 (오래된 상위)',
                    'title-asc': '제목 (가나다 상위)',
                    'title-desc': '제목 (역순 상위)'
                }
            },
            includeDescendantNotes: {
                name: '하위 폴더 / 하위 항목 노트 표시',
                desc: '폴더나 태그를 볼 때 중첩된 하위 폴더와 태그 하위 항목의 노트를 포함합니다.'
            },
            separateNoteCounts: {
                name: '현재와 하위 항목 수를 별도로 표시',
                desc: '폴더와 태그의 노트 수를 "현재 ▾ 하위" 형식으로 표시합니다.'
            },
            groupByDate: {
                name: '날짜별로 노트 그룹화',
                desc: '날짜별로 정렬할 때 날짜 헤더 아래에 노트를 그룹화합니다.'
            },
            optimizeNoteHeight: {
                name: '노트 높이 최적화',
                desc: '고정된 노트와 미리보기 텍스트가 없는 노트의 높이를 줄입니다.'
            },
            showParentFolderNames: {
                name: '상위 폴더 이름 표시',
                desc: '하위 폴더나 태그의 노트에 상위 폴더 이름을 표시합니다.'
            },
            showQuickActions: {
                name: '빠른 작업 표시 (데스크톱 전용)',
                desc: '파일 항목에 호버 작업을 표시합니다.'
            },
            quickActionsRevealInFolder: {
                name: '폴더에서 표시',
                desc: '빠른 작업: 노트를 상위 폴더에서 표시합니다. 하위 폴더나 태그에서 노트를 볼 때만 표시됩니다 (노트의 실제 폴더에서는 표시되지 않음).'
            },
            quickActionsPinNote: {
                name: '노트 고정',
                desc: '빠른 작업: 목록 상단에 노트를 고정하거나 고정 해제합니다.'
            },
            quickActionsOpenInNewTab: {
                name: '새 탭에서 열기',
                desc: '빠른 작업: 새 탭에서 노트를 엽니다.'
            },
            dualPane: {
                name: '이중 창 레이아웃 (데스크톱 전용, 동기화되지 않음)',
                desc: '데스크톱에서 탐색 창과 목록 창을 나란히 표시합니다.'
            },
            startView: {
                name: '기본 시작 보기',
                desc: 'Notebook Navigator를 열 때 표시할 창을 선택하세요. 탐색 창은 바로가기, 최근 노트, 폴더 구조를 표시합니다. 목록 창은 노트 목록을 표시합니다.',
                options: {
                    navigation: '탐색 창',
                    files: '목록 창'
                }
            },
            autoRevealActiveNote: {
                name: '활성 노트 자동 표시',
                desc: '빠른 전환기, 링크 또는 검색에서 열 때 노트를 자동으로 표시합니다.'
            },
            autoRevealIgnoreRightSidebar: {
                name: '오른쪽 사이드바의 이벤트 무시',
                desc: '오른쪽 사이드바에서 클릭하거나 노트를 변경할 때 활성 노트를 변경하지 않습니다.'
            },
            autoSelectFirstFileOnFocusChange: {
                name: '첫 번째 노트 자동 선택 (데스크톱 전용)',
                desc: '폴더나 태그를 전환할 때 첫 번째 노트를 자동으로 엽니다.'
            },
            autoExpandFoldersTags: {
                name: '폴더 및 태그 자동 펼치기',
                desc: '폴더와 태그가 선택되면 자동으로 펼칩니다.'
            },
            navigationBanner: {
                name: '탐색 배너',
                desc: '탐색 창 상단에 이미지를 표시합니다.',
                current: '현재 배너: {path}',
                chooseButton: '이미지 선택',
                clearButton: '지우기'
            },
            showShortcuts: {
                name: '바로가기 표시',
                desc: '탐색 창에 바로가기 섹션을 표시합니다.'
            },
            showRecentNotes: {
                name: '최근 노트 표시',
                desc: '탐색 창에 최근 노트 섹션을 표시합니다.'
            },
            recentNotesCount: {
                name: '최근 노트 수',
                desc: '표시할 최근 노트의 수입니다.'
            },
            showTooltips: {
                name: '도구 설명 표시 (데스크톱 전용)',
                desc: '노트와 폴더에 대한 추가 정보가 있는 호버 도구 설명을 표시합니다.'
            },
            showTooltipPath: {
                name: '경로 표시',
                desc: '도구 설명에서 노트 이름 아래에 폴더 경로를 표시합니다.'
            },
            multiSelectModifier: {
                name: '다중 선택 수정자',
                desc: '다중 선택을 전환하는 수정자 키를 선택하세요. Option/Alt를 선택하면 Cmd/Ctrl 클릭이 새 탭에서 노트를 엽니다.',
                options: {
                    cmdCtrl: 'Cmd/Ctrl 클릭',
                    optionAlt: 'Option/Alt 클릭'
                }
            },
            fileVisibility: {
                name: '파일 유형 표시',
                desc: '네비게이터에 표시할 파일 유형을 필터링합니다. Obsidian에서 지원하지 않는 파일 유형은 외부 응용 프로그램에서 열릴 수 있습니다.',
                options: {
                    documents: '문서 (.md, .canvas, .base)',
                    supported: '지원됨 (Obsidian에서 열림)',
                    all: '모두 (외부에서 열릴 수 있음)'
                }
            },
            homepage: {
                name: '홈페이지',
                desc: '자동으로 열릴 대시보드 같은 파일을 선택합니다.',
                current: '현재: {path}',
                currentMobile: '모바일: {path}',
                chooseButton: '파일 선택',
                clearButton: '지우기',
                separateMobile: {
                    name: '별도 모바일 홈페이지',
                    desc: '모바일 기기에서 다른 홈페이지를 사용합니다.'
                }
            },
            excludedNotes: {
                name: '노트 숨기기',
                desc: '쉼표로 구분된 frontmatter 속성 목록입니다. 이러한 속성 중 하나라도 포함된 노트는 숨겨집니다 (예: draft, private, archived).',
                placeholder: 'draft, private'
            },
            excludedFolders: {
                name: '폴더 숨기기',
                desc: '숨길 폴더의 쉼표로 구분된 목록입니다. 이름 패턴: assets* (assets로 시작하는 폴더), *_temp (_temp로 끝나는). 경로 패턴: /archive (루트 archive만), /res* (res로 시작하는 루트 폴더), /*/temp (한 레벨 깊이의 temp 폴더), /projects/* (projects 내부의 모든 폴더).',
                placeholder: 'templates, assets*, /archive, /res*'
            },
            showFileDate: {
                name: '날짜 표시',
                desc: '노트 이름 아래에 날짜를 표시합니다.'
            },
            showFileTags: {
                name: '파일 태그 표시',
                desc: '파일 항목에 클릭 가능한 태그를 표시합니다. 태그 색상을 사용하여 다른 태그 유형을 시각적으로 구분합니다.'
            },
            showFileTagAncestors: {
                name: '상위 태그 표시',
                desc: '태그 이름 앞에 상위 세그먼트를 표시합니다.'
            },
            colorFileTags: {
                name: '파일 태그 색상 지정',
                desc: '파일 항목의 태그 배지에 태그 색상을 적용합니다.'
            },
            showFileTagsInSlimMode: {
                name: '슬림 모드에서 파일 태그 표시',
                desc: '날짜, 미리보기, 이미지가 숨겨져 있을 때 태그를 표시합니다.'
            },
            dateFormat: {
                name: '날짜 형식',
                desc: '날짜 표시 형식 (date-fns 형식 사용).',
                placeholder: 'MMM d, yyyy',
                help: '일반적인 형식:\nMMM d, yyyy = 5월 25, 2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\n토큰:\nyyyy/yy = 년도\nMMMM/MMM/MM = 월\ndd/d = 일\nEEEE/EEE = 요일',
                helpTooltip: '형식 참조를 보려면 클릭'
            },
            timeFormat: {
                name: '시간 형식',
                desc: '시간 표시 형식 (date-fns 형식 사용).',
                placeholder: 'h:mm a',
                help: '일반적인 형식:\nh:mm a = 2:30 PM (12시간)\nHH:mm = 14:30 (24시간)\nh:mm:ss a = 2:30:45 PM\nHH:mm:ss = 14:30:45\n\n토큰:\nHH/H = 24시간\nhh/h = 12시간\nmm = 분\nss = 초\na = AM/PM',
                helpTooltip: '형식 참조를 보려면 클릭'
            },
            showFilePreview: {
                name: '노트 미리보기 표시',
                desc: '노트 이름 아래에 미리보기 텍스트를 표시합니다.'
            },
            skipHeadingsInPreview: {
                name: '미리보기에서 제목 건너뛰기',
                desc: '미리보기 텍스트를 생성할 때 제목 줄을 건너뜁니다.'
            },
            skipCodeBlocksInPreview: {
                name: '미리보기에서 코드 블록 건너뛰기',
                desc: '미리보기 텍스트를 생성할 때 코드 블록을 건너뜁니다.'
            },
            previewProperties: {
                name: '미리보기 속성',
                desc: '미리보기 텍스트를 확인할 frontmatter 속성의 쉼표로 구분된 목록입니다. 텍스트가 있는 첫 번째 속성이 사용됩니다.',
                placeholder: 'summary, description, abstract',
                info: '지정된 속성에서 미리보기 텍스트를 찾을 수 없으면 노트 내용에서 미리보기가 생성됩니다.'
            },
            previewRows: {
                name: '미리보기 행',
                desc: '미리보기 텍스트에 표시할 행 수입니다.',
                options: {
                    '1': '1행',
                    '2': '2행',
                    '3': '3행',
                    '4': '4행',
                    '5': '5행'
                }
            },
            fileNameRows: {
                name: '제목 행',
                desc: '노트 제목에 표시할 행 수입니다.',
                options: {
                    '1': '1행',
                    '2': '2행'
                }
            },
            showFeatureImage: {
                name: '대표 이미지 표시',
                desc: 'frontmatter에서 썸네일 이미지를 표시합니다. 팁: "Featured Image" 플러그인을 사용하여 모든 문서에 대표 이미지를 자동으로 설정하세요.'
            },
            forceSquareFeatureImage: {
                name: '대표 이미지를 정사각형으로 고정',
                desc: '대표 이미지를 정사각형 썸네일로 렌더링합니다.'
            },
            featureImageProperties: {
                name: '이미지 속성',
                desc: '썸네일 이미지를 확인할 frontmatter 속성의 쉼표로 구분된 목록입니다. 이미지가 있는 첫 번째 속성이 사용됩니다. 비어 있고 대체 설정이 활성화되면 첫 번째 임베디드 이미지가 사용됩니다.',
                placeholder: 'thumbnail, featureResized, feature'
            },
            useEmbeddedImageFallback: {
                name: '임베디드 이미지 대체 사용',
                desc: 'frontmatter 속성에 썸네일을 찾을 수 없을 때 문서의 첫 번째 임베디드 이미지를 대체로 사용합니다 (Obsidian 1.9.4+ 필요). 썸네일이 올바르게 구성되었는지 확인하려면 이 기능을 비활성화하세요.'
            },
            showRootFolder: {
                name: '루트 폴더 표시',
                desc: '트리에서 보관함 이름을 루트 폴더로 표시합니다.'
            },
            inheritFolderColors: {
                name: '폴더 색상 상속',
                desc: '하위 폴더가 상위 폴더에서 색상을 상속합니다.'
            },
            showNoteCount: {
                name: '노트 수 표시',
                desc: '각 폴더와 태그 옆에 노트 수를 표시합니다.'
            },
            showIcons: {
                name: '아이콘 표시',
                desc: '폴더, 태그 및 노트에 아이콘을 표시합니다.'
            },
            showIconsColorOnly: {
                name: '아이콘에만 색상 적용',
                desc: '활성화하면 사용자 지정 색상이 아이콘에만 적용됩니다. 비활성화하면 아이콘과 텍스트 레이블 모두에 색상이 적용됩니다.'
            },
            collapseBehavior: {
                name: '항목 접기',
                desc: '모두 펼치기/접기 버튼이 영향을 미치는 항목을 선택하세요.',
                options: {
                    all: '모든 폴더 및 태그',
                    foldersOnly: '폴더만',
                    tagsOnly: '태그만'
                }
            },
            smartCollapse: {
                name: '선택한 항목 펼친 상태 유지',
                desc: '접을 때 현재 선택한 폴더나 태그와 상위 항목을 펼친 상태로 유지합니다.'
            },
            navIndent: {
                name: '트리 들여쓰기',
                desc: '중첩된 폴더와 태그의 들여쓰기 너비를 조정합니다.'
            },
            navItemHeight: {
                name: '항목 높이',
                desc: '탐색 창에서 폴더와 태그의 높이를 조정합니다.'
            },
            navItemHeightScaleText: {
                name: '항목 높이에 따라 글자 크기 조정',
                desc: '항목 높이를 줄이면 탐색 글자 크기를 작게 합니다.'
            },
            showTags: {
                name: '태그 표시',
                desc: '네비게이터에서 폴더 아래에 태그 섹션을 표시합니다.'
            },
            tagSortOrder: {
                name: '태그 정렬 순서',
                desc: '탐색 창에서 태그를 정렬하는 방식을 선택합니다.',
                options: {
                    alphaAsc: 'A부터 Z까지',
                    alphaDesc: 'Z부터 A까지',
                    frequencyAsc: '빈도 (낮음 → 높음)',
                    frequencyDesc: '빈도 (높음 → 낮음)'
                }
            },
            showAllTagsFolder: {
                name: '태그 폴더 표시',
                desc: '"태그"를 접을 수 있는 폴더로 표시합니다.'
            },
            showUntagged: {
                name: '태그 없는 노트 표시',
                desc: '태그가 없는 노트에 대해 "태그 없음" 항목을 표시합니다.'
            },
            hiddenTags: {
                name: '숨겨진 태그',
                desc: '숨길 태그 접두사 또는 이름 와일드카드의 쉼표로 구분된 목록입니다. `tag*` 또는 `*tag` 로 태그 이름을 일치시킵니다. 태그를 숨기면 모든 하위 태그도 숨겨집니다 (예: "archive"는 "archive/2024/docs" 숨김).',
                placeholder: 'internal, temp/drafts, archive/2024'
            },
            showTopics: {
                name: '주제 표시',
                desc: '탐색 창에 주제를 표시합니다.'
            },
            topicSortOrder: {
                name: '주제 정렬 순서',
                desc: '탐색 창에서 주제를 정렬하는 방법을 선택합니다.',
                options: {
                    alphaAsc: 'A부터 Z까지',
                    alphaDesc: 'Z부터 A까지',
                    frequencyAsc: '빈도 (낮음에서 높음)',
                    frequencyDesc: '빈도 (높음에서 낮음)'
                }
            },
            hiddenTopics: {
                name: '숨겨진 주제',
                desc: '탐색 창에서 숨길 주제의 쉼표로 구분된 목록.',
                placeholder: '보관, 비공개, 초안'
            },
            enableFolderNotes: {
                name: '폴더 노트 활성화',
                desc: '활성화되면 관련 노트가 있는 폴더가 클릭 가능한 링크로 표시됩니다.'
            },
            folderNoteType: {
                name: '기본 폴더 노트 형식',
                desc: '컨텍스트 메뉴에서 생성되는 폴더 노트 형식입니다.',
                options: {
                    markdown: 'Markdown',
                    canvas: 'Canvas',
                    base: 'Base'
                }
            },
            folderNoteName: {
                name: '폴더 노트 이름',
                desc: '확장자 없는 폴더 노트의 이름입니다. 폴더와 같은 이름을 사용하려면 비워 두세요.',
                placeholder: 'index'
            },
            folderNoteProperties: {
                name: '폴더 노트 속성',
                desc: '새로 생성된 폴더 노트에 추가할 frontmatter 속성 (쉼표로 구분).',
                placeholder: 'foldernote, darktheme'
            },
            hideFolderNoteInList: {
                name: '목록에서 폴더 노트 숨기기',
                desc: '폴더 노트가 폴더의 노트 목록에 나타나지 않도록 숨깁니다.'
            },
            pinCreatedFolderNote: {
                name: '생성된 폴더 노트 고정',
                desc: '컨텍스트 메뉴에서 생성한 폴더 노트를 자동으로 고정합니다.'
            },
            confirmBeforeDelete: {
                name: '삭제 전 확인',
                desc: '노트나 폴더를 삭제할 때 확인 대화 상자 표시'
            },
            metadataCleanup: {
                name: '메타데이터 정리',
                desc: 'Obsidian 외부에서 파일, 폴더 또는 태그가 삭제, 이동 또는 이름이 변경될 때 남겨진 고아 메타데이터를 제거합니다. 이는 Notebook Navigator 설정 파일에만 영향을 줍니다.',
                buttonText: '메타데이터 정리',
                error: '설정 정리에 실패했습니다',
                loading: '메타데이터 확인 중...',
                statusClean: '정리할 메타데이터가 없습니다',
                statusCounts: '고아 항목: {folders} 폴더, {tags} 태그, {files} 파일, {pinned} 고정'
            },
            rebuildCache: {
                name: '캐시 다시 빌드',
                desc: '태그 누락, 잘못된 미리보기 또는 누락된 이미지가 있을 때 사용하세요. 동기화 충돌이나 예기치 않은 종료 후에 발생할 수 있습니다.',
                buttonText: '캐시 다시 빌드',
                success: '캐시가 다시 빌드되었습니다',
                error: '캐시 다시 빌드 실패'
            },
            hotkeys: {
                intro: 'Notebook Navigator 단축키는 <plugin folder>/notebook-navigator/data.json을 편집하여 구성합니다. 파일을 텍스트 편집기로 열고 "keyboardShortcuts" 섹션을 확인하세요. 각 항목은 다음 구조를 사용합니다:',
                example: '"pane:move-up": [ { "key": "ArrowUp", "modifiers": [] }, { "key": "K", "modifiers": [] } ]',
                modifierList: [
                    '"Mod" = Cmd (macOS) / Ctrl (Win/Linux)',
                    '"Alt" = Alt/Option',
                    '"Shift" = Shift',
                    '"Ctrl" = Control (크로스 플랫폼에서는 "Mod" 권장)'
                ],
                guidance:
                    '위 예제처럼 ArrowUp과 K를 함께 허용하려면 동일한 명령에 여러 매핑을 추가하세요. 여러 수정 키를 사용하려면 "modifiers": ["Mod", "Shift"]처럼 모두 나열합니다. "gg" 또는 "dd"와 같은 키 시퀀스는 지원되지 않습니다. 파일을 수정한 후 Obsidian을 다시 로드하세요.'
            },
            externalIcons: {
                downloadButton: '다운로드',
                downloadingLabel: '다운로드 중...',
                removeButton: '제거',
                statusInstalled: '다운로드됨 (버전 {version})',
                statusNotInstalled: '다운로드되지 않음',
                versionUnknown: '알 수 없음',
                downloadFailed: '{name} 다운로드에 실패했습니다. 연결을 확인하고 다시 시도해주세요.',
                removeFailed: '{name} 제거에 실패했습니다.',
                infoNote:
                    '다운로드된 아이콘 팩은 기기 간 설치 상태를 동기화합니다. 아이콘 팩은 각 기기의 로컬 데이터베이스에 남아 있습니다. 동기화는 다운로드 또는 제거 여부만 추적합니다. 아이콘 팩은 Notebook Navigator 저장소에서 다운로드됩니다 (https://github.com/johansan/notebook-navigator/tree/main/icon-assets).',
                providers: {
                    bootstrapIconsDesc: 'https://icons.getbootstrap.com/',
                    fontAwesomeDesc: 'https://fontawesome.com/',
                    materialIconsDesc: 'https://fonts.google.com/icons',
                    phosphorDesc: 'https://phosphoricons.com/',
                    rpgAwesomeDesc: 'https://nagoshiashumari.github.io/Rpg-Awesome/',
                    simpleIconsDesc: 'https://simpleicons.org/'
                }
            },
            useFrontmatterDates: {
                name: 'frontmatter에서 메타데이터 읽기',
                desc: '사용 가능한 경우 frontmatter에서 노트 이름, 타임스탬프, 아이콘, 색상을 읽고, 파일 시스템 값 또는 설정으로 대체'
            },
            frontmatterNameField: {
                name: '이름 필드',
                desc: '노트 표시 이름으로 사용할 frontmatter 필드입니다. 파일 이름을 사용하려면 비워 두세요.',
                placeholder: 'title'
            },
            frontmatterIconField: {
                name: '아이콘 필드',
                desc: '파일 아이콘용 frontmatter 필드입니다. 설정에 저장된 아이콘을 사용하려면 비워 두세요.',
                placeholder: 'icon'
            },
            frontmatterColorField: {
                name: '색상 필드',
                desc: '파일 색상용 frontmatter 필드입니다. 설정에 저장된 색상을 사용하려면 비워 두세요.',
                placeholder: 'color'
            },
            frontmatterSaveMetadata: {
                name: 'frontmatter에 아이콘과 색상 저장',
                desc: '위에서 구성한 필드를 사용하여 파일 아이콘과 색상을 frontmatter에 자동으로 기록합니다.'
            },
            frontmatterIconizeFormat: {
                name: 'Iconize 형식으로 저장',
                desc: '플러그인 형식(예: home, fontawesome-solid:user, simple-icons:github) 대신 Iconize 형식(예: LiHome, FasUser, SiGithub)으로 아이콘을 저장합니다.'
            },
            frontmatterMigration: {
                name: '설정에서 아이콘과 색상 이동',
                desc: '설정에 저장됨: 아이콘 {icons}개, 색상 {colors}개.',
                button: '이동',
                buttonWorking: '이동 중...',
                noticeNone: '설정에 저장된 파일 아이콘 또는 색상이 없습니다.',
                noticeDone: '아이콘 {migratedIcons}/{icons}개, 색상 {migratedColors}/{colors}개를 이동했습니다.',
                noticeFailures: '실패한 항목: {failures}.',
                noticeError: '이동에 실패했습니다. 자세한 내용은 콘솔을 확인하세요.'
            },
            frontmatterCreatedField: {
                name: '생성 타임스탬프 필드',
                desc: '생성된 타임스탬프의 frontmatter 필드 이름입니다. 파일 시스템 날짜만 사용하려면 비워 두세요.',
                placeholder: 'created'
            },
            frontmatterModifiedField: {
                name: '수정 타임스탬프 필드',
                desc: '수정된 타임스탬프의 frontmatter 필드 이름입니다. 파일 시스템 날짜만 사용하려면 비워 두세요.',
                placeholder: 'modified'
            },
            frontmatterDateFormat: {
                name: '타임스탬프 형식',
                desc: 'frontmatter에서 타임스탬프를 구문 분석하는 데 사용되는 형식입니다. ISO 8601 형식을 사용하려면 비워 두세요',
                helpTooltip: 'date-fns 형식 문서 참조',
                help: "일반적인 형식:\nyyyy-MM-dd'T'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM"
            },
            supportDevelopment: {
                name: '개발 지원',
                desc: 'Notebook Navigator를 사용하는 것을 좋아하신다면 지속적인 개발을 지원해 주시기 바랍니다.',
                buttonText: '❤️ 후원하기',
                coffeeButton: '☕️ 커피 한 잔 사주기'
            },
            updateCheckOnStart: {
                name: '시작 시 새 버전 확인',
                desc: '시작 시 새로운 플러그인 릴리스를 확인하고 업데이트가 있으면 알림을 표시합니다. 각 버전은 한 번만 알림되며, 확인은 하루에 한 번 수행됩니다.',
                status: 'New version available: {version}'
            },
            whatsNew: {
                name: '새로운 기능',
                desc: '최근 업데이트와 개선 사항 보기',
                buttonText: '최근 업데이트 보기'
            },
            cacheStatistics: {
                localCache: '로컬 캐시',
                items: '항목',
                withTags: '태그 포함',
                withPreviewText: '미리보기 텍스트 포함',
                withFeatureImage: '대표 이미지 포함',
                withMetadata: '메타데이터 포함'
            },
            metadataInfo: {
                successfullyParsed: '성공적으로 구문 분석됨',
                itemsWithName: '이름이 있는 항목',
                withCreatedDate: '생성 날짜 포함',
                withModifiedDate: '수정 날짜 포함',
                withIcon: '아이콘 포함',
                withColor: '색상 포함',
                failedToParse: '구문 분석 실패',
                createdDates: '생성 날짜',
                modifiedDates: '수정 날짜',
                checkTimestampFormat: '타임스탬프 형식을 확인하세요.',
                exportFailed: '오류 내보내기'
            }
        }
    },
    whatsNew: {
        title: 'Notebook Navigator의 새로운 기능',
        supportMessage: 'Notebook Navigator가 도움이 되신다면 개발을 지원해 주시기 바랍니다.',
        supportButton: '커피 사주기',
        thanksButton: '감사합니다!'
    }
};
