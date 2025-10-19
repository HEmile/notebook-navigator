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
 * Polish language strings for Notebook Navigator
 * Organized by feature/component for easy maintenance
 */
export const STRINGS_PL = {
    // Common UI elements
    common: {
        cancel: 'Anuluj', // Button text for canceling dialogs and operations (English: Cancel)
        delete: 'Usuń', // Button text for delete operations in dialogs (English: Delete)
        remove: 'Usuń', // Button text for remove operations in dialogs (English: Remove)
        submit: 'Wyślij', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: 'Brak wyboru', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: 'Bez tagów', // Label for notes without any tags (English: Untagged)
        untitled: 'Bez tytułu', // Default name for notes without a title (English: Untitled)
        featureImageAlt: 'Obraz wyróżniający', // Alt text for thumbnail/preview images (English: Feature image)
        unknownError: 'Nieznany błąd', // Generic fallback when an error has no message (English: Unknown error)
        updateBannerTitle: 'Aktualizacja Notebook Navigator dostępna',
        updateBannerInstruction: 'Zaktualizuj w Ustawieniach -> Wtyczki społeczności'
    },

    // List pane
    listPane: {
        emptyStateNoSelection: 'Wybierz folder lub tag aby zobaczyć notatki', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: 'Brak notatek', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 Przypięte', // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
        notesSection: 'Notatki', // Header shown between pinned and regular items when showing documents only (English: Notes)
        filesSection: 'Pliki' // Header shown between pinned and regular items when showing supported or all files (English: Files)
    },

    // Tag list
    tagList: {
        untaggedLabel: 'Bez tagów', // Label for the special item showing notes without tags (English: Untagged)
        hiddenTags: 'Ukryte tagi', // Label for the hidden tags virtual folder (English: Hidden tags)
        tags: 'Tagi', // Label for the tags virtual folder (English: Tags)
        topics: 'Tematy', // Label for the topics virtual folder (English: Topics)
    },

    navigationPane: {
        shortcutsHeader: 'Skróty',
        recentNotesHeader: 'Ostatnie notatki',
        recentFilesHeader: 'Ostatnie pliki',
        reorderRootFoldersTitle: 'Zmień kolejność folderów głównych',
        reorderRootFoldersHint: 'Przeciągnij foldery aby zmienić kolejność',
        vaultRootLabel: 'Magazyn',
        resetRootFolderOrder: 'Resetuj do kolejności alfabetycznej',
        dragHandleLabel: 'Przeciągnij aby zmienić kolejność',
        pinShortcuts: 'Pin shortcuts',
        unpinShortcuts: 'Unpin shortcuts'
    },

    shortcuts: {
        folderExists: 'Folder już jest w skrótach',
        noteExists: 'Notatka już jest w skrótach',
        tagExists: 'Tag już jest w skrótach',
        topicExists: 'Temat już jest w skrótach',
        searchExists: 'Skrót wyszukiwania już istnieje',
        emptySearchQuery: 'Wprowadź zapytanie wyszukiwania przed zapisaniem',
        emptySearchName: 'Wprowadź nazwę przed zapisaniem wyszukiwania',
        add: 'Dodaj do skrótów',
        remove: 'Usuń ze skrótów',
        moveUp: 'Przesuń w górę',
        moveDown: 'Przesuń w dół'
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Zwiń elementy', // Tooltip for button that collapses expanded items (English: Collapse items)
        expandAllFolders: 'Rozwiń wszystkie elementy', // Tooltip for button that expands all items (English: Expand all items)
        scrollToTop: 'Przewiń do góry',
        newFolder: 'Nowy folder', // Tooltip for create new folder button (English: New folder)
        newNote: 'Nowa notatka', // Tooltip for create new note button (English: New note)
        mobileBackToNavigation: 'Wróć do nawigacji', // Mobile-only back button text to return to navigation pane (English: Back to navigation)
        changeSortOrder: 'Zmień kolejność sortowania', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'Domyślne', // Label for default sorting mode (English: Default)
        customSort: 'Własne', // Label for custom sorting mode (English: Custom)
        showFolders: 'Pokaż nawigację', // Tooltip for button to show the navigation pane (English: Show navigation)
        hideFolders: 'Ukryj nawigację', // Tooltip for button to hide the navigation pane (English: Hide navigation)
        reorderRootFolders: 'Zmień kolejność folderów głównych',
        finishRootFolderReorder: 'Zakończ zmianę kolejności folderów głównych',
        toggleDescendantNotes: 'Pokaż notatki z podfolderów / potomnych', // Tooltip: include descendants for folders and tags
        autoExpandFoldersTags: 'Automatycznie rozwijaj foldery i tagi', // Tooltip for button to toggle auto-expanding folders and tags when selected (English: Auto-expand folders and tags)
        showExcludedItems: 'Pokaż ukryte elementy', // Tooltip for button to show hidden items (English: Show hidden items)
        hideExcludedItems: 'Ukryj ukryte elementy', // Tooltip for button to hide hidden items (English: Hide hidden items)
        showDualPane: 'Pokaż podwójne panele', // Tooltip for button to show dual-pane layout (English: Show dual panes)
        showSinglePane: 'Pokaż pojedynczy panel', // Tooltip for button to show single-pane layout (English: Show single pane)
        changeAppearance: 'Zmień wygląd', // Tooltip for button to change folder appearance settings (English: Change appearance)
        search: 'Szukaj' // Tooltip for search button (English: Search)
    },
    // Search input
    searchInput: {
        placeholder: 'Szukaj...', // Placeholder text for search input (English: Search...)
        placeholderOmnisearch: 'Omnisearch...', // Placeholder text when Omnisearch provider is active (English: Omnisearch...)
        clearSearch: 'Wyczyść wyszukiwanie', // Tooltip for clear search button (English: Clear search)
        saveSearchShortcut: 'Zapisz wyszukiwanie w skrótach',
        removeSearchShortcut: 'Usuń wyszukiwanie ze skrótów',
        shortcutModalTitle: 'Zapisz wyszukiwanie',
        shortcutNameLabel: 'Nazwa skrótu',
        shortcutNamePlaceholder: 'Wprowadź nazwę skrótu'
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'Otwórz w nowej karcie',
            openToRight: 'Otwórz po prawej',
            openInNewWindow: 'Otwórz w nowym oknie',
            openMultipleInNewTabs: 'Otwórz {count} notatek w nowych kartach',
            openMultipleFilesInNewTabs: 'Otwórz {count} plików w nowych kartach',
            openMultipleToRight: 'Otwórz {count} notatek po prawej',
            openMultipleFilesToRight: 'Otwórz {count} plików po prawej',
            openMultipleInNewWindows: 'Otwórz {count} notatek w nowych oknach',
            openMultipleFilesInNewWindows: 'Otwórz {count} plików w nowych oknach',
            pinNote: 'Przypnij notatkę',
            pinFile: 'Przypnij plik',
            unpinNote: 'Odepnij notatkę',
            unpinFile: 'Odepnij plik',
            pinMultipleNotes: 'Przypnij {count} notatek',
            pinMultipleFiles: 'Przypnij {count} plików',
            unpinMultipleNotes: 'Odepnij {count} notatek',
            unpinMultipleFiles: 'Odepnij {count} plików',
            duplicateNote: 'Duplikuj notatkę',
            duplicateFile: 'Duplikuj plik',
            duplicateMultipleNotes: 'Duplikuj {count} notatek',
            duplicateMultipleFiles: 'Duplikuj {count} plików',
            openVersionHistory: 'Otwórz historię wersji',
            revealInFolder: 'Pokaż w folderze',
            revealInFinder: 'Pokaż w Finderze',
            showInExplorer: 'Pokaż w eksploratorze systemowym',
            copyDeepLink: 'Kopiuj adres URL Obsidian',
            copyPath: 'Kopiuj ścieżkę',
            copyRelativePath: 'Kopiuj ścieżkę względną',
            renameNote: 'Zmień nazwę notatki',
            renameFile: 'Zmień nazwę pliku',
            deleteNote: 'Usuń notatkę',
            deleteFile: 'Usuń plik',
            deleteMultipleNotes: 'Usuń {count} notatek',
            deleteMultipleFiles: 'Usuń {count} plików',
            moveToFolder: 'Przenieś do...',
            moveMultipleToFolder: 'Przenieś {count} plików do...',
            addTag: 'Dodaj tag',
            removeTag: 'Usuń tag',
            removeAllTags: 'Usuń wszystkie tagi',
            changeIcon: 'Zmień ikonę',
            changeColor: 'Zmień kolor'
        },
        folder: {
            newNote: 'Nowa notatka',
            newFolder: 'Nowy folder',
            newCanvas: 'Nowa tablica',
            newBase: 'Nowa baza',
            newDrawing: 'Nowy rysunek',
            duplicateFolder: 'Duplikuj folder',
            searchInFolder: 'Szukaj w folderze',
            createFolderNote: 'Utwórz notatkę folderu',
            deleteFolderNote: 'Usuń notatkę folderu',
            changeIcon: 'Zmień ikonę',
            changeColor: 'Zmień kolor ikony',
            changeBackground: 'Zmień tło',
            excludeFolder: 'Ukryj folder',
            moveFolder: 'Przenieś do...',
            renameFolder: 'Zmień nazwę folderu',
            deleteFolder: 'Usuń folder'
        },
        tag: {
            changeIcon: 'Zmień ikonę',
            changeColor: 'Zmień kolor',
            changeBackground: 'Zmień tło',
            showTag: 'Pokaż tag',
            hideTag: 'Ukryj tag'
        },
        topic: {
            changeIcon: 'Zmień ikonę',
            changeColor: 'Zmień kolor',
            changeBackground: 'Zmień tło',
            showTopic: 'Pokaż temat',
            hideTopic: 'Ukryj temat'
        }
    },

    // Folder appearance menu
    folderAppearance: {
        defaultPreset: 'Domyślny wygląd',
        slimPreset: 'Szczupły (bez daty/podglądu/obrazu)',
        titleRows: 'Wiersze tytułu',
        previewRows: 'Wiersze podglądu',
        defaultOption: (rows: number) => `Domyślne (${rows})`,
        defaultTitleOption: (rows: number) => `Domyślne wiersze tytułu (${rows})`,
        defaultPreviewOption: (rows: number) => `Domyślne wiersze podglądu (${rows})`,
        titleRowOption: (rows: number) =>
            `${rows} ${rows === 1 ? 'wiersz' : rows === 2 || rows === 3 || rows === 4 ? 'wiersze' : 'wierszy'} tytułu`,
        previewRowOption: (rows: number) =>
            `${rows} ${rows === 1 ? 'wiersz' : rows === 2 || rows === 3 || rows === 4 ? 'wiersze' : 'wierszy'} podglądu`
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Szukaj ikon...',
            recentlyUsedHeader: 'Ostatnio używane',
            emptyStateSearch: 'Zacznij pisać aby szukać ikon',
            emptyStateNoResults: 'Nie znaleziono ikon',
            showingResultsInfo: 'Pokazuję 50 z {count} wyników. Wpisz więcej aby zawęzić.',
            emojiInstructions: 'Wpisz lub wklej dowolną emotkę aby użyć jej jako ikony',
            removeIcon: 'Usuń ikonę'
        },
        colorPicker: {
            currentColor: 'Obecny',
            newColor: 'Nowy',
            presetColors: 'Kolory predefiniowane',
            recentColors: 'Ostatnio używane kolory',
            clearRecentColors: 'Wyczyść ostatnie kolory',
            removeRecentColor: 'Usuń kolor',
            removeColor: 'Usuń kolor',
            apply: 'Zastosuj',
            hexLabel: 'HEX',
            rgbLabel: 'RGBA',
            colors: {
                red: 'Czerwony',
                orange: 'Pomarańczowy',
                amber: 'Bursztynowy',
                yellow: 'Żółty',
                lime: 'Limonkowy',
                green: 'Zielony',
                emerald: 'Szmaragdowy',
                teal: 'Morski',
                cyan: 'Cyjan',
                sky: 'Niebieski',
                blue: 'Niebieski',
                indigo: 'Indygo',
                violet: 'Fioletowy',
                purple: 'Purpurowy',
                fuchsia: 'Fuksja',
                pink: 'Różowy',
                rose: 'Różany',
                gray: 'Szary',
                slate: 'Łupkowy',
                stone: 'Kamienny'
            }
        },
        tagOperation: {
            renameTitle: 'Zmień nazwę tagu {tag}',
            deleteTitle: 'Usuń tag {tag}',
            newTagPrompt: 'Nowa nazwa tagu',
            newTagPlaceholder: 'Wprowadź nową nazwę tagu',
            renameWarning: 'Zmiana nazwy tagu {oldTag} zmodyfikuje {count} {files}.',
            deleteWarning: 'Usunięcie tagu {tag} zmodyfikuje {count} {files}.',
            modificationWarning: 'To zaktualizuje daty modyfikacji plików.',
            affectedFiles: 'Dotknięte pliki:',
            andMore: '...i {count} więcej',
            confirmRename: 'Zmień nazwę tagu',
            confirmDelete: 'Usuń tag',
            file: 'plik',
            files: 'plików'
        },
        fileSystem: {
            newFolderTitle: 'Nowy folder',
            renameFolderTitle: 'Zmień nazwę folderu',
            renameFileTitle: 'Zmień nazwę pliku',
            deleteFolderTitle: "Usunąć '{name}'?",
            deleteFileTitle: "Usunąć '{name}'?",
            folderNamePrompt: 'Wprowadź nazwę folderu:',
            renamePrompt: 'Wprowadź nową nazwę:',
            renameVaultTitle: 'Zmień wyświetlaną nazwę magazynu',
            renameVaultPrompt: 'Wprowadź własną nazwę wyświetlaną (zostaw puste aby użyć domyślnej):',
            deleteFolderConfirm: 'Czy na pewno chcesz usunąć ten folder i całą jego zawartość?',
            deleteFileConfirm: 'Czy na pewno chcesz usunąć ten plik?',
            removeAllTagsTitle: 'Usuń wszystkie tagi',
            removeAllTagsFromNote: 'Czy na pewno chcesz usunąć wszystkie tagi z tej notatki?',
            removeAllTagsFromNotes: 'Czy na pewno chcesz usunąć wszystkie tagi z {count} notatek?'
        },
        folderSuggest: {
            placeholder: 'Przenieś do folderu...',
            navigatePlaceholder: 'Przejdź do folderu...',
            instructions: {
                navigate: 'aby nawigować',
                move: 'aby przenieść',
                select: 'aby wybrać',
                dismiss: 'aby anulować'
            }
        },
        homepage: {
            placeholder: 'Wyszukaj pliki...',
            instructions: {
                navigate: 'aby nawigować',
                select: 'aby ustawić stronę główną',
                dismiss: 'aby anulować'
            }
        },
        navigationBanner: {
            placeholder: 'Wyszukaj obrazy...',
            instructions: {
                navigate: 'aby nawigować',
                select: 'aby ustawić baner',
                dismiss: 'aby anulować'
            }
        },
        tagSuggest: {
            placeholder: 'Szukaj tagów...',
            navigatePlaceholder: 'Przejdź do tagu...',
            addPlaceholder: 'Szukaj tagu do dodania...',
            removePlaceholder: 'Wybierz tag do usunięcia...',
            createNewTag: 'Utwórz nowy tag: #{tag}',
            instructions: {
                navigate: 'aby nawigować',
                select: 'aby wybrać',
                dismiss: 'aby anulować',
                add: 'aby dodać tag',
                remove: 'aby usunąć tag'
            }
        }
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'Nie udało się utworzyć folderu: {error}',
            createFile: 'Nie udało się utworzyć pliku: {error}',
            renameFolder: 'Nie udało się zmienić nazwy folderu: {error}',
            renameFolderNoteConflict: 'Nie można zmienić nazwy: "{name}" już istnieje w tym folderze',
            renameFile: 'Nie udało się zmienić nazwy pliku: {error}',
            deleteFolder: 'Nie udało się usunąć folderu: {error}',
            deleteFile: 'Nie udało się usunąć pliku: {error}',
            duplicateNote: 'Nie udało się zduplikować notatki: {error}',
            createCanvas: 'Nie udało się utworzyć tablicy: {error}',
            createDatabase: 'Nie udało się utworzyć bazy danych: {error}',
            duplicateFolder: 'Nie udało się zduplikować folderu: {error}',
            openVersionHistory: 'Nie udało się otworzyć historii wersji: {error}',
            versionHistoryNotFound: 'Nie znaleziono komendy historii wersji. Upewnij się, że Obsidian Sync jest włączony.',
            revealInExplorer: 'Nie udało się pokazać pliku w eksploratorze systemowym: {error}',
            folderNoteAlreadyExists: 'Notatka folderu już istnieje',
            folderAlreadyExists: 'Folder "{name}" już istnieje',
            folderNotesDisabled: 'Włącz notatki folderu w ustawieniach, aby konwertować pliki',
            folderNoteAlreadyLinked: 'Ten plik już działa jako notatka folderu',
            folderNoteUnsupportedExtension: 'Nieobsługiwane rozszerzenie pliku: {extension}',
            folderNoteMoveFailed: 'Nie udało się przenieść pliku podczas konwersji: {error}',
            folderNoteRenameConflict: 'Plik o nazwie "{name}" już istnieje w folderze',
            folderNoteConversionFailed: 'Nie udało się przekonwertować pliku na notatkę folderu',
            folderNoteConversionFailedWithReason: 'Nie udało się przekonwertować pliku na notatkę folderu: {error}',
            folderNoteOpenFailed: 'Przekonwertowano plik, ale nie udało się otworzyć notatki folderu: {error}',
            failedToDeleteFile: 'Nie udało się usunąć {name}: {error}',
            failedToDeleteMultipleFiles: 'Nie udało się usunąć {count} plików',
            versionHistoryNotAvailable: 'Usługa historii wersji niedostępna',
            drawingAlreadyExists: 'Rysunek o tej nazwie już istnieje',
            failedToCreateDrawing: 'Nie udało się utworzyć rysunku',
            noFolderSelected: 'Żaden folder nie jest wybrany w Notebook Navigator',
            noFileSelected: 'Żaden plik nie jest wybrany'
        },
        notices: {
            excludedFolder: 'Wykluczony folder: {name}'
        },
        notifications: {
            deletedMultipleFiles: 'Usunięto {count} plików',
            movedMultipleFiles: 'Przeniesiono {count} plików do {folder}',
            folderNoteConversionSuccess: 'Przekonwertowano plik na notatkę folderu w "{name}"',
            folderMoved: 'Przeniesiono folder "{name}"',
            deepLinkCopied: 'Adres URL Obsidian skopiowany do schowka',
            pathCopied: 'Ścieżka skopiowana do schowka',
            relativePathCopied: 'Ścieżka względna skopiowana do schowka',
            tagAddedToNote: 'Dodano tag do 1 notatki',
            tagAddedToNotes: 'Dodano tag do {count} notatek',
            tagRemovedFromNote: 'Usunięto tag z 1 notatki',
            tagRemovedFromNotes: 'Usunięto tag z {count} notatek',
            tagsClearedFromNote: 'Wyczyszczono wszystkie tagi z 1 notatki',
            tagsClearedFromNotes: 'Wyczyszczono wszystkie tagi z {count} notatek',
            noTagsToRemove: 'Brak tagów do usunięcia',
            noFilesSelected: 'Nie wybrano plików',
            tagOperationsNotAvailable: 'Operacje na tagach niedostępne',
            tagsRequireMarkdown: 'Tagi są obsługiwane tylko w notatkach Markdown',
            iconPackDownloaded: '{provider} pobrano',
            iconPackRemoved: '{provider} usunięto',
            iconPackLoadFailed: 'Nie udało się załadować {provider}'
        },
        confirmations: {
            deleteMultipleFiles: 'Czy na pewno chcesz usunąć {count} plików?',
            deleteConfirmation: 'Tej akcji nie można cofnąć.'
        },
        defaultNames: {
            untitled: 'Bez tytułu',
            untitledNumber: 'Bez tytułu {number}'
        }
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'Nie można przenieść folderu do niego samego lub jego podfolderu.',
            itemAlreadyExists: 'Element o nazwie "{name}" już istnieje w tej lokalizacji.',
            failedToMove: 'Nie udało się przenieść: {error}',
            failedToAddTag: 'Nie udało się dodać tagu "{tag}"',
            failedToClearTags: 'Nie udało się wyczyścić tagów',
            failedToMoveFolder: 'Nie udało się przenieść folderu "{name}"',
            failedToImportFiles: 'Nie udało się zaimportować: {names}'
        },
        notifications: {
            filesAlreadyExist: '{count} plików już istnieje w miejscu docelowym',
            addedTag: 'Dodano tag "{tag}" do {count} plików',
            filesAlreadyHaveTag: '{count} plików już ma ten tag lub bardziej szczegółowy',
            clearedTags: 'Wyczyszczono wszystkie tagi z {count} plików',
            noTagsToClear: 'Brak tagów do wyczyszczenia',
            fileImported: 'Zaimportowano 1 plik',
            filesImported: 'Zaimportowano {count} plików'
        }
    },

    // Date grouping
    dateGroups: {
        today: 'Dzisiaj',
        yesterday: 'Wczoraj',
        previous7Days: 'Poprzednie 7 dni',
        previous30Days: 'Poprzednie 30 dni'
    },

    // Weekdays
    weekdays: {
        sunday: 'Niedziela',
        monday: 'Poniedziałek',
        tuesday: 'Wtorek',
        wednesday: 'Środa',
        thursday: 'Czwartek',
        friday: 'Piątek',
        saturday: 'Sobota'
    },

    // Plugin commands
    commands: {
        open: 'Otwórz', // Command palette: Opens the Notebook Navigator view (English: Open)
        openHomepage: 'Otwórz stronę główną', // Command palette: Opens the Notebook Navigator view and loads the homepage file (English: Open homepage)
        revealFile: 'Pokaż plik', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal file)
        search: 'Szukaj', // Command palette: Toggle search in the file list (English: Search)
        toggleDualPane: 'Przełącz układ podwójnego panelu', // Command palette: Toggles between single-pane and dual-pane layout (English: Toggle dual pane layout)
        deleteFile: 'Usuń pliki', // Command palette: Deletes the currently active file (English: Delete file)
        createNewNote: 'Utwórz nową notatkę', // Command palette: Creates a new note in the currently selected folder (English: Create new note)
        moveFiles: 'Przenieś pliki', // Command palette: Move selected files to another folder (English: Move files)
        convertToFolderNote: 'Konwertuj na notatkę folderu', // Command palette: Converts the active file into a folder note with a new folder (English: Convert to folder note)
        navigateToFolder: 'Przejdź do folderu', // Command palette: Navigate to a folder using fuzzy search (English: Navigate to folder)
        navigateToTag: 'Przejdź do tagu', // Command palette: Navigate to a tag using fuzzy search (English: Navigate to tag)
        addShortcut: 'Dodaj do skrótów', // Command palette: Adds the current file, folder, or tag to shortcuts (English: Add to shortcuts)
        toggleDescendants: 'Przełącz podfoldery', // Command palette: Toggles showing notes from descendants (English: Toggle descendants)
        toggleHidden: 'Przełącz ukryte elementy', // Command palette: Toggles showing hidden items (English: Toggle hidden items)
        collapseExpand: 'Zwiń / rozwiń wszystkie elementy', // Command palette: Collapse or expand all folders and tags (English: Collapse / expand all items)
        addTag: 'Dodaj tag do wybranych plików', // Command palette: Opens a dialog to add a tag to selected files (English: Add tag to selected files)
        removeTag: 'Usuń tag z wybranych plików', // Command palette: Opens a dialog to remove a tag from selected files (English: Remove tag from selected files)
        removeAllTags: 'Usuń wszystkie tagi z wybranych plików', // Command palette: Removes all tags from selected files (English: Remove all tags from selected files)
        rebuildCache: 'Odbuduj pamięć podręczną' // Command palette: Rebuilds the local Notebook Navigator cache (English: Rebuild cache)
    },

    // Plugin UI
    plugin: {
        viewName: 'Notebook Navigator', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: 'Notebook Navigator', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: 'Pokaż w Notebook Navigator' // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: 'Ostatnio zmodyfikowano o',
        createdAt: 'Utworzono o',
        file: 'plik',
        files: 'plików',
        folder: 'folder',
        folders: 'folderów'
    },

    // Settings
    settings: {
        metadataReport: {
            exportSuccess: 'Raport błędnych metadanych wyeksportowany do: {filename}',
            exportFailed: 'Nie udało się wyeksportować raportu metadanych'
        },
        sections: {
            general: 'Ogólne',
            navigationPane: 'Panel nawigacji',
            icons: 'Pakiety ikon',
            folders: 'Foldery',
            tags: 'Tagi',
            topics: 'Tematy',
            search: 'Wyszukiwanie',
            listPane: 'Panel listy',
            notes: 'Notatki',
            hotkeys: 'Skróty klawiszowe',
            advanced: 'Zaawansowane'
        },
        groups: {
            general: {
                view: 'Wygląd',
                behavior: 'Zachowanie',
                filtering: 'Filtrowanie',
                formatting: 'Formatowanie'
            },
            navigation: {
                behavior: 'Zachowanie',
                appearance: 'Wygląd'
            },
            list: {
                display: 'Wygląd',
                quickActions: 'Szybkie akcje'
            },
            notes: {
                frontmatter: 'Frontmatter',
                display: 'Wygląd'
            }
        },
        items: {
            searchProvider: {
                name: 'Dostawca wyszukiwania',
                desc: 'Wybierz między szybkim wyszukiwaniem nazwy pliku lub pełnotekstowym wyszukiwaniem z pluginem Omnisearch.',
                options: {
                    internal: 'Wyszukiwanie filtrujące',
                    omnisearch: 'Omnisearch (pełnotekstowy)'
                },
                info: {
                    filterSearch: {
                        title: 'Wyszukiwanie filtrujące (domyślne):',
                        description:
                            'Szybkie, lekkie wyszukiwanie, które filtruje pliki według nazwy i tagów w bieżącym folderze i podfolderach. Obsługuje filtrowanie tagów z prefiksem # (np. #projekt), wykluczanie z prefiksem ! (np. !szkic, !#zarchiwizowane), oraz znajdowanie notatek bez tagów za pomocą !#. Idealne do szybkiej nawigacji w aktualnym kontekście.'
                    },
                    omnisearch: {
                        title: 'Omnisearch:',
                        description:
                            'Wyszukiwanie pełnotekstowe, które przeszukuje cały skarbiec, a następnie filtruje wyniki, aby pokazywać tylko pliki z bieżącego folderu, podfolderów lub wybranych tagów. Wymaga zainstalowania wtyczki Omnisearch - jeśli nie jest dostępna, wyszukiwanie automatycznie powróci do wyszukiwania filtrującego.',
                        warningNotInstalled: 'Wtyczka Omnisearch nie jest zainstalowana. Używana jest wyszukiwarka filtrująca.',
                        limitations: {
                            title: 'Znane ograniczenia:',
                            performance: 'Wydajność: Może być wolne, szczególnie przy wyszukiwaniu mniej niż 3 znaków w dużych skarbcach',
                            pathBug:
                                'Błąd ścieżki: Nie może wyszukiwać w ścieżkach z nie-ASCII znakami i nieprawidłowo przeszukuje podścieżki, wpływając na pliki pojawiające się w wynikach wyszukiwania',
                            limitedResults:
                                'Ograniczone wyniki: Ponieważ Omnisearch przeszukuje cały skarbiec i zwraca ograniczoną liczbę wyników przed filtrowaniem, istotne pliki z bieżącego folderu mogą się nie pojawić, jeśli istnieje zbyt wiele dopasowań w innym miejscu skarbca',
                            previewText:
                                'Tekst podglądu: Podglądy notatek są zastępowane fragmentami wyników Omnisearch, które mogą nie pokazywać rzeczywistego podświetlenia dopasowania wyszukiwania, jeśli pojawia się ono w innym miejscu pliku'
                        }
                    }
                }
            },
            listPaneTitle: {
                name: 'Tytuł panelu listy',
                desc: 'Wybierz, gdzie ma być wyświetlany tytuł panelu listy.',
                options: {
                    header: 'Wyświetlaj w nagłówku',
                    list: 'Wyświetlaj w panelu listy',
                    hidden: 'Nie wyświetlaj'
                }
            },
            sortNotesBy: {
                name: 'Sortuj notatki według',
                desc: 'Wybierz sposób sortowania notatek na liście.',
                options: {
                    'modified-desc': 'Data edycji (najnowsze na górze)',
                    'modified-asc': 'Data edycji (najstarsze na górze)',
                    'created-desc': 'Data utworzenia (najnowsze na górze)',
                    'created-asc': 'Data utworzenia (najstarsze na górze)',
                    'title-asc': 'Tytuł (A na górze)',
                    'title-desc': 'Tytuł (Z na górze)'
                }
            },
            includeDescendantNotes: {
                name: 'Pokaż notatki z podfolderów / potomnych',
                desc: 'Podczas przeglądania folderu lub tagu uwzględnij notatki z zagnieżdżonych podfolderów i potomnych tagów.'
            },
            separateNoteCounts: {
                name: 'Pokaż bieżące i potomne liczniki osobno',
                desc: 'Wyświetla liczbę notatek w formacie "bieżące ▾ potomne" w folderach i tagach.'
            },
            groupByDate: {
                name: 'Grupuj notatki według daty',
                desc: 'Podczas sortowania według daty, grupuj notatki pod nagłówkami dat.'
            },
            optimizeNoteHeight: {
                name: 'Optymalizuj wysokość notatek',
                desc: 'Zmniejsz wysokość dla przypiętych notatek i notatek bez tekstu podglądu.'
            },
            showParentFolderNames: {
                name: 'Pokaż nazwy folderów nadrzędnych',
                desc: 'Wyświetl nazwę folderu nadrzędnego dla notatek w podfolderach lub tagach.'
            },
            showQuickActions: {
                name: 'Pokaż szybkie akcje (tylko desktop)',
                desc: 'Pokaż akcje przy najechaniu na elementy plików.'
            },
            quickActionsRevealInFolder: {
                name: 'Pokaż w folderze',
                desc: 'Szybka akcja: Pokaż notatkę w jej folderze nadrzędnym. Widoczne tylko podczas przeglądania notatek z podfolderów lub w tagach (nie pokazywane w rzeczywistym folderze notatki).'
            },
            quickActionsPinNote: {
                name: 'Przypnij notatkę',
                desc: 'Szybka akcja: Przypnij lub odepnij notatkę na górze listy.'
            },
            quickActionsOpenInNewTab: {
                name: 'Otwórz w nowej karcie',
                desc: 'Szybka akcja: Otwórz notatkę w nowej karcie.'
            },
            dualPane: {
                name: 'Układ podwójnego panelu (tylko desktop, nie synchronizowany)',
                desc: 'Pokaż panel nawigacji i panel listy obok siebie na komputerze.'
            },
            startView: {
                name: 'Domyślny widok startowy',
                desc: 'Wybierz panel wyświetlany przy otwieraniu Notebook Navigator. Panel nawigacji pokazuje skróty, ostatnie notatki oraz strukturę folderów. Panel listy pokazuje listę notatek.',
                options: {
                    navigation: 'Panel nawigacji',
                    files: 'Panel listy'
                }
            },
            autoRevealActiveNote: {
                name: 'Automatycznie odkryj aktywną notatkę',
                desc: 'Automatycznie odkrywaj notatki po otwarciu z Quick Switcher, linków lub wyszukiwania.'
            },
            autoRevealIgnoreRightSidebar: {
                name: 'Ignoruj zdarzenia z prawego paska bocznego',
                desc: 'Nie zmieniaj aktywnej notatki przy klikaniu lub zmienianiu notatek w prawym pasku bocznym.'
            },
            autoSelectFirstFileOnFocusChange: {
                name: 'Automatycznie wybierz pierwszą notatkę (tylko desktop)',
                desc: 'Automatycznie otwórz pierwszą notatkę podczas zmiany folderów lub tagów.'
            },
            autoExpandFoldersTags: {
                name: 'Automatycznie rozwijaj foldery i tagi',
                desc: 'Automatycznie rozwijaj foldery i tagi gdy są wybrane.'
            },
            navigationBanner: {
                name: 'Baner nawigacji',
                desc: 'Wyświetl obraz nad panelem nawigacji.',
                current: 'Aktualny baner: {path}',
                chooseButton: 'Wybierz obraz',
                clearButton: 'Wyczyść'
            },
            showShortcuts: {
                name: 'Pokaż skróty',
                desc: 'Wyświetl sekcję skrótów w panelu nawigacji.'
            },
            showRecentNotes: {
                name: 'Pokaż ostatnie notatki',
                desc: 'Wyświetl sekcję ostatnich notatek w panelu nawigacji.'
            },
            recentNotesCount: {
                name: 'Liczba ostatnich notatek',
                desc: 'Liczba ostatnich notatek do wyświetlenia.'
            },
            showTooltips: {
                name: 'Pokaż podpowiedzi (tylko desktop)',
                desc: 'Wyświetl podpowiedzi przy najechaniu z dodatkowymi informacjami dla notatek i folderów.'
            },
            multiSelectModifier: {
                name: 'Modyfikator wielokrotnego wyboru',
                desc: 'Wybierz, który klawisz modyfikatora przełącza wielokrotny wybór. Gdy wybrano Option/Alt, Cmd/Ctrl klik otwiera notatki w nowej karcie.',
                options: {
                    cmdCtrl: 'Cmd/Ctrl klik',
                    optionAlt: 'Option/Alt klik'
                }
            },
            fileVisibility: {
                name: 'Pokaż typy plików',
                desc: 'Filtruj które typy plików są pokazywane w nawigatorze. Typy plików nieobsługiwane przez Obsidian mogą otworzyć się w zewnętrznych aplikacjach.',
                options: {
                    documents: 'Dokumenty (.md, .canvas, .base)',
                    supported: 'Obsługiwane (otwiera się w Obsidian)',
                    all: 'Wszystkie (mogą otworzyć się zewnętrznie)'
                }
            },
            homepage: {
                name: 'Strona główna',
                desc: 'Wybierz plik, który Notebook Navigator otwiera automatycznie, np. pulpit.',
                current: 'Bieżący: {path}',
                currentMobile: 'Mobilna: {path}',
                chooseButton: 'Wybierz plik',
                clearButton: 'Wyczyść',
                separateMobile: {
                    name: 'Osobna strona główna dla urządzeń mobilnych',
                    desc: 'Użyj innej strony głównej dla urządzeń mobilnych.'
                }
            },
            excludedNotes: {
                name: 'Ukryj notatki',
                desc: 'Lista właściwości frontmatter oddzielonych przecinkami. Notatki zawierające którekolwiek z tych właściwości będą ukryte (np. draft, private, archived).',
                placeholder: 'draft, private'
            },
            excludedFolders: {
                name: 'Ukryj foldery',
                desc: 'Lista folderów do ukrycia oddzielonych przecinkami. Wzory nazw: assets* (foldery zaczynające się od assets), *_temp (kończące się na _temp). Wzory ścieżek: /archive (tylko archiwum główne), /res* (foldery główne zaczynające się od res), /*/temp (foldery temp jeden poziom w głąb), /projects/* (wszystkie foldery wewnątrz projects).',
                placeholder: 'templates, assets*, /archive, /res*'
            },
            showFileDate: {
                name: 'Pokaż datę',
                desc: 'Wyświetl datę pod nazwami notatek.'
            },
            showFileTags: {
                name: 'Pokaż tagi plików',
                desc: 'Wyświetl klikalne tagi w elementach plików. Użyj kolorów tagów aby wizualnie odróżnić różne typy tagów.'
            },
            showFileTagAncestors: {
                name: 'Pokaż tagi nadrzędne',
                desc: 'Wyświetl segmenty nadrzędne przed nazwą tagu.'
            },
            colorFileTags: {
                name: 'Koloruj tagi plików',
                desc: 'Zastosuj kolory tagów do odznak tagów w elementach plików.'
            },
            showFileTagsInSlimMode: {
                name: 'Pokaż tagi plików w trybie kompaktowym',
                desc: 'Wyświetl tagi, gdy data, podgląd i obraz są ukryte.'
            },
            dateFormat: {
                name: 'Format daty',
                desc: 'Format wyświetlania dat (używa formatu date-fns).',
                placeholder: 'dd.MM.yyyy',
                help: 'Popularne formaty:\ndd.MM.yyyy = 25.05.2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\nTokeny:\nyyyy/yy = rok\nMMMM/MMM/MM = miesiąc\ndd/d = dzień\nEEEE/EEE = dzień tygodnia',
                helpTooltip: 'Kliknij po informacje o formatowaniu'
            },
            timeFormat: {
                name: 'Format czasu',
                desc: 'Format wyświetlania czasu (używa formatu date-fns).',
                placeholder: 'HH:mm',
                help: 'Popularne formaty:\nHH:mm = 14:30 (24-godzinny)\nh:mm a = 2:30 PM (12-godzinny)\nHH:mm:ss = 14:30:45\nh:mm:ss a = 2:30:45 PM\n\nTokeny:\nHH/H = 24-godzinny\nhh/h = 12-godzinny\nmm = minuty\nss = sekundy\na = AM/PM',
                helpTooltip: 'Kliknij po informacje o formatowaniu'
            },
            showFilePreview: {
                name: 'Pokaż podgląd notatki (*)',
                desc: 'Wyświetl tekst podglądu pod nazwami notatek.'
            },
            skipHeadingsInPreview: {
                name: 'Pomiń nagłówki w podglądzie',
                desc: 'Pomiń linie nagłówków podczas generowania tekstu podglądu.'
            },
            skipCodeBlocksInPreview: {
                name: 'Pomiń bloki kodu w podglądzie',
                desc: 'Pomija bloki kodu podczas generowania tekstu podglądu.'
            },
            previewProperties: {
                name: 'Właściwości podglądu',
                desc: 'Lista właściwości frontmatter oddzielonych przecinkami do sprawdzenia dla tekstu podglądu. Pierwsza właściwość z tekstem zostanie użyta.',
                placeholder: 'summary, description, abstract',
                info: 'Jeśli nie znaleziono tekstu podglądu we wskazanych właściwościach, podgląd zostanie wygenerowany z zawartości notatki.'
            },
            previewRows: {
                name: 'Wiersze podglądu',
                desc: 'Liczba wierszy do wyświetlenia dla tekstu podglądu.',
                options: {
                    '1': '1 wiersz',
                    '2': '2 wiersze',
                    '3': '3 wiersze',
                    '4': '4 wiersze',
                    '5': '5 wierszy'
                }
            },
            fileNameRows: {
                name: 'Wiersze tytułu',
                desc: 'Liczba wierszy do wyświetlenia dla tytułów notatek.',
                options: {
                    '1': '1 wiersz',
                    '2': '2 wiersze'
                }
            },
            showFeatureImage: {
                name: 'Pokaż obraz wyróżniający (*)',
                desc: 'Wyświetl miniaturki obrazów z frontmatter. Wskazówka: Użyj pluginu "Featured Image" aby automatycznie ustawić obrazy wyróżniające dla wszystkich dokumentów.'
            },
            forceSquareFeatureImage: {
                name: 'Wymuś kwadratowy obraz wyróżniający',
                desc: 'Wyświetlaj obrazy wyróżniające jako kwadratowe miniatury.'
            },
            featureImageProperties: {
                name: 'Właściwości obrazu',
                desc: 'Lista właściwości frontmatter oddzielonych przecinkami do sprawdzenia dla miniaturek obrazów. Pierwsza właściwość z obrazem zostanie użyta. Jeśli puste i ustawienie awaryjne jest włączone, pierwszy osadzony obraz zostanie użyty.',
                placeholder: 'thumbnail, featureResized, feature'
            },
            useEmbeddedImageFallback: {
                name: 'Użyj awaryjnego obrazu osadzonego',
                desc: 'Użyj pierwszego osadzonego obrazu w dokumencie jako awaryjny gdy nie znaleziono miniatury we właściwościach frontmatter (wymaga Obsidian 1.9.4+). Wyłącz to aby sprawdzić czy miniatury są poprawnie skonfigurowane.'
            },
            showRootFolder: {
                name: 'Pokaż folder główny',
                desc: 'Wyświetl nazwę magazynu jako folder główny w drzewie.'
            },
            inheritFolderColors: {
                name: 'Dziedzicz kolory folderów',
                desc: 'Podfoldery dziedziczą kolor z folderów nadrzędnych.'
            },
            showNoteCount: {
                name: 'Pokaż liczbę notatek',
                desc: 'Wyświetl liczbę notatek obok każdego folderu i tagu.'
            },
            showIcons: {
                name: 'Pokaż ikony',
                desc: 'Wyświetl ikony dla folderów, tagów i notatek.'
            },
            showIconsColorOnly: {
                name: 'Zastosuj kolor tylko do ikon',
                desc: 'Gdy włączone, niestandardowe kolory są stosowane tylko do ikon. Gdy wyłączone, kolory są stosowane zarówno do ikon, jak i etykiet tekstowych.'
            },
            collapseBehavior: {
                name: 'Zwiń elementy',
                desc: 'Wybierz na co wpływa przycisk rozwiń/zwiń wszystko.',
                options: {
                    all: 'Wszystkie foldery i tagi',
                    foldersOnly: 'Tylko foldery',
                    tagsOnly: 'Tylko tagi'
                }
            },
            smartCollapse: {
                name: 'Zachowaj wybrany element rozwinięty',
                desc: 'Podczas zwijania, zachowaj obecnie wybrany folder lub tag i jego rodziców rozwinięte.'
            },
            navIndent: {
                name: 'Wcięcie drzewa',
                desc: 'Dostosuj szerokość wcięcia dla zagnieżdżonych folderów i tagów.'
            },
            navItemHeight: {
                name: 'Wysokość elementu',
                desc: 'Dostosuj wysokość folderów i tagów w panelu nawigacji.'
            },
            navItemHeightScaleText: {
                name: 'Skaluj tekst z wysokością elementu',
                desc: 'Zmniejsza tekst nawigacji, gdy wysokość elementu jest obniżona.'
            },
            showTags: {
                name: 'Pokaż tagi (*)',
                desc: 'Wyświetl sekcję tagów poniżej folderów w nawigatorze.'
            },
            tagSortOrder: {
                name: 'Kolejność sortowania tagów',
                desc: 'Wybierz sposób sortowania tagów w panelu nawigacji.',
                options: {
                    alphaAsc: 'A do Z',
                    alphaDesc: 'Z do A',
                    frequencyAsc: 'Częstotliwość (rosnąco)',
                    frequencyDesc: 'Częstotliwość (malejąco)'
                }
            },
            showTagsAboveFolders: {
                name: 'Pokaż tagi nad folderami',
                desc: 'Wyświetl sekcję tagów przed folderami w nawigatorze.'
            },
            showAllTagsFolder: {
                name: 'Pokaż folder tagów',
                desc: 'Wyświetl "Tagi" jako zwijalny folder.'
            },
            showUntagged: {
                name: 'Pokaż notatki bez tagów',
                desc: 'Wyświetl element "Bez tagów" dla notatek bez żadnych tagów.'
            },
            hiddenTags: {
                name: 'Ukryte tagi',
                desc: 'Lista prefiksów tagów lub symboli wieloznacznych nazw oddzielonych przecinkami. Użyj `tag*` lub `*tag`, aby dopasować nazwy tagów. Ukrycie tagu ukrywa też wszystkie jego pod-tagi (np. "archive" ukrywa "archive/2024/docs").',
                placeholder: 'internal, temp/drafts, archive/2024'
            },
            showTopics: {
                name: 'Pokaż tematy',
                desc: 'Wyświetl tematy w panelu nawigacji.'
            },
            topicSortOrder: {
                name: 'Kolejność sortowania tematów',
                desc: 'Wybierz, jak tematy są sortowane w panelu nawigacji.',
                options: {
                    alphaAsc: 'Od A do Z',
                    alphaDesc: 'Od Z do A',
                    frequencyAsc: 'Częstotliwość (od niskiej do wysokiej)',
                    frequencyDesc: 'Częstotliwość (od wysokiej do niskiej)'
                }
            },
            hiddenTopics: {
                name: 'Ukryte tematy',
                desc: 'Lista tematów oddzielonych przecinkami do ukrycia w panelu nawigacji.',
                placeholder: 'archiwum, prywatne, wersja robocza'
            },
            enableFolderNotes: {
                name: 'Włącz notatki folderów',
                desc: 'Gdy włączone, foldery z powiązanymi notatkami są wyświetlane jako klikalne linki.'
            },
            folderNoteType: {
                name: 'Domyślny typ notatki folderu',
                desc: 'Typ notatki folderu tworzony z menu kontekstowego.',
                options: {
                    markdown: 'Markdown',
                    canvas: 'Canvas',
                    base: 'Base'
                }
            },
            folderNoteName: {
                name: 'Nazwa notatki folderu',
                desc: 'Nazwa notatki folderu bez rozszerzenia. Zostaw puste aby użyć takiej samej nazwy jak folder.',
                placeholder: 'index'
            },
            folderNoteProperties: {
                name: 'Właściwości notatki folderu',
                desc: 'Właściwości frontmatter do dodania do nowo tworzonych notatek folderów (oddzielone przecinkami).',
                placeholder: 'foldernote, darktheme'
            },
            hideFolderNoteInList: {
                name: 'Ukryj notatki folderów na liście',
                desc: 'Ukryj notatkę folderu przed pojawieniem się na liście notatek folderu.'
            },
            pinCreatedFolderNote: {
                name: 'Przypnij utworzone notatki folderów',
                desc: 'Automatycznie przypinaj notatki folderów podczas tworzenia z menu kontekstowego.'
            },
            confirmBeforeDelete: {
                name: 'Potwierdź przed usunięciem',
                desc: 'Pokaż dialog potwierdzenia podczas usuwania notatek lub folderów'
            },
            metadataCleanup: {
                name: 'Wyczyść metadane',
                desc: 'Usuwa osierocone metadane pozostawione, gdy pliki, foldery lub tagi są usuwane, przenoszone lub zmieniane poza Obsidian. Ma to wpływ tylko na plik ustawień Notebook Navigator.',
                buttonText: 'Wyczyść metadane',
                error: 'Czyszczenie ustawień nie powiodło się',
                loading: 'Sprawdzanie metadanych...',
                statusClean: 'Brak metadanych do wyczyszczenia',
                statusCounts: 'Osierocone elementy: {folders} folderów, {tags} tagów, {files} plików, {pinned} przypiętych'
            },
            rebuildCache: {
                name: 'Odbuduj pamięć podręczną',
                desc: 'Użyj tego, jeśli brakuje tagów, podglądy są nieprawidłowe lub brakuje obrazów. Może się to zdarzyć po konfliktach synchronizacji lub nieoczekiwanych zamknięciach.',
                buttonText: 'Odbuduj pamięć podręczną',
                success: 'Pamięć podręczna została odbudowana',
                error: 'Nie udało się odbudować pamięci podręcznej'
            },
            hotkeys: {
                intro: 'Edytuj <plugin folder>/notebook-navigator/data.json, aby dostosować skróty Notebook Navigator. Otwórz plik i znajdź sekcję "keyboardShortcuts". Każdy wpis ma następującą strukturę:',
                example: '"pane:move-up": [ { "key": "ArrowUp", "modifiers": [] }, { "key": "K", "modifiers": [] } ]',
                modifierList: [
                    '"Mod" = Cmd (macOS) / Ctrl (Win/Linux)',
                    '"Alt" = Alt/Option',
                    '"Shift" = Shift',
                    '"Ctrl" = Control (preferuj "Mod" dla wielu platform)'
                ],
                guidance:
                    'Dodaj wiele mapowań, aby obsłużyć alternatywne klawisze, na przykład ArrowUp i K pokazane powyżej. Aby użyć kilku modyfikatorów, wypisz je w jednej definicji, np. "modifiers": ["Mod", "Shift"]. Sekwencje klawiszy takie jak "gg" lub "dd" nie są obsługiwane. Po edycji ponownie uruchom Obsidian.'
            },
            externalIcons: {
                downloadButton: 'Pobierz',
                downloadingLabel: 'Pobieranie...',
                removeButton: 'Usuń',
                statusInstalled: 'Pobrano (wersja {version})',
                statusNotInstalled: 'Nie pobrano',
                versionUnknown: 'nieznana',
                downloadFailed: 'Nie udało się pobrać {name}. Sprawdź połączenie i spróbuj ponownie.',
                removeFailed: 'Nie udało się usunąć {name}.',
                infoNote:
                    'Pobrane pakiety ikon synchronizują stan instalacji między urządzeniami. Pakiety ikon pozostają w lokalnej bazie danych na każdym urządzeniu; synchronizacja śledzi tylko czy powinny być pobrane lub usunięte. Pakiety ikon są pobierane z repozytorium Notebook Navigator (https://github.com/johansan/notebook-navigator/tree/main/icon-assets).',
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
                name: 'Czytaj metadane z frontmatter (*)',
                desc: 'Czytaj nazwy notatek, znaczniki czasu, ikony i kolory z frontmatter gdy dostępne, w przeciwnym razie używaj wartości systemu plików lub ustawień'
            },
            frontmatterNameField: {
                name: 'Pole nazwy',
                desc: 'Pole frontmatter do użycia jako wyświetlana nazwa notatki. Zostaw puste aby użyć nazwy pliku.',
                placeholder: 'title'
            },
            frontmatterIconField: {
                name: 'Pole ikony',
                desc: 'Pole frontmatter dla ikon plików. Zostaw puste aby użyć ikon zapisanych w ustawieniach.',
                placeholder: 'icon'
            },
            frontmatterColorField: {
                name: 'Pole koloru',
                desc: 'Pole frontmatter dla kolorów plików. Zostaw puste aby użyć kolorów zapisanych w ustawieniach.',
                placeholder: 'color'
            },
            frontmatterSaveMetadata: {
                name: 'Zapisz ikony i kolory w frontmatter',
                desc: 'Automatycznie zapisuje ikony i kolory plików w frontmatter przy użyciu skonfigurowanych powyżej pól.'
            },
            frontmatterIconizeFormat: {
                name: 'Zapisz w formacie Iconize',
                desc: 'Zapisz ikony używając formatu Iconize (np. LiHome, FasUser, SiGithub) zamiast formatu wtyczki (np. home, fontawesome-solid:user, simple-icons:github).'
            },
            frontmatterMigration: {
                name: 'Migruj ikony i kolory z ustawień',
                desc: 'Zapisane w ustawieniach: {icons} ikon, {colors} kolorów.',
                button: 'Migruj',
                buttonWorking: 'Migracja...',
                noticeNone: 'Brak ikon lub kolorów plików zapisanych w ustawieniach.',
                noticeDone: 'Zmigrowano {migratedIcons}/{icons} ikon, {migratedColors}/{colors} kolorów.',
                noticeFailures: 'Nieudane wpisy: {failures}.',
                noticeError: 'Migracja nie powiodła się. Sprawdź konsolę po więcej szczegółów.'
            },
            frontmatterCreatedField: {
                name: 'Pole znacznika czasu utworzenia',
                desc: 'Nazwa pola frontmatter dla znacznika czasu utworzenia. Zostaw puste aby używać tylko daty systemu plików.',
                placeholder: 'created'
            },
            frontmatterModifiedField: {
                name: 'Pole znacznika czasu modyfikacji',
                desc: 'Nazwa pola frontmatter dla znacznika czasu modyfikacji. Zostaw puste aby używać tylko daty systemu plików.',
                placeholder: 'modified'
            },
            frontmatterDateFormat: {
                name: 'Format znacznika czasu',
                desc: 'Format używany do parsowania znaczników czasu w frontmatter. Zostaw puste aby użyć formatu ISO 8601',
                helpTooltip: 'Zobacz dokumentację formatu date-fns',
                help: "Popularne formaty:\nyyyy-MM-dd'T'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM"
            },
            supportDevelopment: {
                name: 'Wspieraj rozwój',
                desc: 'Jeśli uwielbiasz używać Notebook Navigator, rozważ wsparcie jego dalszego rozwoju.',
                buttonText: '❤️ Sponsoruj',
                coffeeButton: '☕️ Postaw kawę'
            },
            updateCheckOnStart: {
                name: 'Sprawdź nową wersję przy starcie',
                desc: 'Sprawdza nowe wersje wtyczki podczas uruchamiania i wyświetla powiadomienie, gdy dostępna jest aktualizacja. Każda wersja jest ogłaszana tylko raz, a sprawdzanie odbywa się co najwyżej raz dziennie.',
                status: 'New version available: {version}'
            },
            whatsNew: {
                name: 'Co nowego',
                desc: 'Zobacz ostatnie aktualizacje i ulepszenia',
                buttonText: 'Zobacz ostatnie aktualizacje'
            },
            cacheStatistics: {
                localCache: '(*) Lokalna pamięć podręczna',
                items: 'elementów',
                withTags: 'z tagami',
                withPreviewText: 'z tekstem podglądu',
                withFeatureImage: 'z obrazem wyróżniającym',
                withMetadata: 'z metadanymi'
            },
            metadataInfo: {
                successfullyParsed: 'Pomyślnie sparsowano',
                itemsWithName: 'elementów z nazwą',
                withCreatedDate: 'z datą utworzenia',
                withModifiedDate: 'z datą modyfikacji',
                withIcon: 'z ikoną',
                withColor: 'z kolorem',
                failedToParse: 'Nie udało się sparsować',
                createdDates: 'dat utworzenia',
                modifiedDates: 'dat modyfikacji',
                checkTimestampFormat: 'Sprawdź format znacznika czasu.',
                exportFailed: 'Eksportuj błędy'
            }
        }
    },
    whatsNew: {
        title: 'Co nowego w Notebook Navigator',
        supportMessage: 'Jeśli uważasz Notebook Navigator za pomocny, rozważ wsparcie jego rozwoju.',
        supportButton: 'Postaw mi kawę',
        thanksButton: 'Dzięki!'
    }
};
