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
 * Dutch language strings for Notebook Navigator
 * Organized by feature/component for easy maintenance
 */
export const STRINGS_NL = {
    // Common UI elements
    common: {
        cancel: 'Annuleren',
        delete: 'Verwijderen',
        remove: 'Verwijderen',
        submit: 'Verzenden',
        noSelection: 'Geen selectie',
        untagged: 'Zonder tags',
        untitled: 'Zonder titel',
        featureImageAlt: 'Uitgelichte afbeelding',
        unknownError: 'Onbekende fout',
        updateBannerTitle: 'Notebook Navigator update beschikbaar',
        updateBannerInstruction: 'Werk bij in Instellingen -> Community plugins',
        updateIndicatorLabel: 'Nieuwe versie beschikbaar'
    },

    // List pane
    listPane: {
        emptyStateNoSelection: 'Selecteer een map of tag om notities te bekijken',
        emptyStateNoNotes: 'Geen notities',
        pinnedSection: '📌 Vastgepind',
        notesSection: 'Notities',
        filesSection: 'Bestanden',
        hiddenItemAriaLabel: '{name} (verborgen)'
    },

    // Tag list
    tagList: {
        untaggedLabel: 'Zonder tags',
        hiddenTags: 'Verborgen tags',
        tags: 'Tags'
    },

    // Navigation pane
    navigationPane: {
        shortcutsHeader: 'Snelkoppelingen',
        recentNotesHeader: 'Recente notities',
        recentFilesHeader: 'Recente bestanden',
        reorderRootFoldersTitle: 'Navigatiesecties herschikken',
        reorderRootFoldersHint: 'Sleep koppen of items om de volgorde te wijzigen',
        vaultRootLabel: 'Kluis',
        resetRootToAlpha: 'Terugzetten naar alfabetische volgorde',
        resetRootToFrequency: 'Terugzetten naar frequentievolgorde',
        dragHandleLabel: 'Sleep om te herschikken',
        pinShortcuts: 'Snelkoppelingen vastpinnen',
        unpinShortcuts: 'Snelkoppelingen losmaken'
    },

    shortcuts: {
        folderExists: 'Map staat al in snelkoppelingen',
        noteExists: 'Notitie staat al in snelkoppelingen',
        tagExists: 'Tag staat al in snelkoppelingen',
        searchExists: 'Zoeksnelkoppeling bestaat al',
        emptySearchQuery: 'Voer een zoekopdracht in voordat u deze opslaat',
        emptySearchName: 'Voer een naam in voordat u de zoekopdracht opslaat',
        add: 'Toevoegen aan snelkoppelingen',
        remove: 'Verwijderen uit snelkoppelingen',
        moveUp: 'Omhoog verplaatsen',
        moveDown: 'Omlaag verplaatsen',
        folderNotesPinned: '{count} mapnotities vastgepind'
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Items inklappen',
        expandAllFolders: 'Alle items uitklappen',
        scrollToTop: 'Naar boven scrollen',
        newFolder: 'Nieuwe map',
        newNote: 'Nieuwe notitie',
        mobileBackToNavigation: 'Terug naar navigatie',
        changeSortOrder: 'Sorteervolgorde wijzigen',
        defaultSort: 'Standaard',
        customSort: 'Aangepast',
        showFolders: 'Navigatie tonen',
        hideFolders: 'Navigatie verbergen',
        reorderRootFolders: 'Hoofdmappen en tags herschikken',
        finishRootFolderReorder: 'Herschikken voltooien',
        toggleDescendantNotes: 'Notities uit submappen / afstammelingen tonen',
        autoExpandFoldersTags: 'Mappen en tags automatisch uitklappen',
        showExcludedItems: 'Verborgen mappen, tags en notities tonen',
        hideExcludedItems: 'Verborgen mappen, tags en notities verbergen',
        showDualPane: 'Dubbel paneel tonen',
        showSinglePane: 'Enkel paneel tonen',
        changeAppearance: 'Uiterlijk wijzigen',
        search: 'Zoeken'
    },

    // Search input
    searchInput: {
        placeholder: 'Zoeken...',
        placeholderOmnisearch: 'Omnisearch...',
        clearSearch: 'Zoekopdracht wissen',
        saveSearchShortcut: 'Zoeksnelkoppeling opslaan',
        removeSearchShortcut: 'Zoeksnelkoppeling verwijderen',
        shortcutModalTitle: 'Zoeksnelkoppeling opslaan',
        shortcutNameLabel: 'Naam snelkoppeling',
        shortcutNamePlaceholder: 'Voer naam snelkoppeling in'
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'Openen in nieuw tabblad',
            openToRight: 'Openen aan de rechterkant',
            openInNewWindow: 'Openen in nieuw venster',
            openMultipleInNewTabs: '{count} notities openen in nieuwe tabbladen',
            openMultipleFilesInNewTabs: '{count} bestanden openen in nieuwe tabbladen',
            openMultipleToRight: '{count} notities openen aan de rechterkant',
            openMultipleFilesToRight: '{count} bestanden openen aan de rechterkant',
            openMultipleInNewWindows: '{count} notities openen in nieuwe vensters',
            openMultipleFilesInNewWindows: '{count} bestanden openen in nieuwe vensters',
            pinNote: 'Notitie vastpinnen',
            pinFile: 'Bestand vastpinnen',
            unpinNote: 'Notitie losmaken',
            unpinFile: 'Bestand losmaken',
            pinMultipleNotes: '{count} notities vastpinnen',
            pinMultipleFiles: '{count} bestanden vastpinnen',
            unpinMultipleNotes: '{count} notities losmaken',
            unpinMultipleFiles: '{count} bestanden losmaken',
            duplicateNote: 'Notitie dupliceren',
            duplicateFile: 'Bestand dupliceren',
            duplicateMultipleNotes: '{count} notities dupliceren',
            duplicateMultipleFiles: '{count} bestanden dupliceren',
            openVersionHistory: 'Versiegeschiedenis openen',
            revealInFolder: 'Tonen in map',
            revealInFinder: 'Tonen in Finder',
            showInExplorer: 'Tonen in systeemverkenner',
            copyDeepLink: 'Obsidian URL kopiëren',
            copyPath: 'Pad kopiëren',
            copyRelativePath: 'Relatief pad kopiëren',
            renameNote: 'Notitie hernoemen',
            renameFile: 'Bestand hernoemen',
            deleteNote: 'Notitie verwijderen',
            deleteFile: 'Bestand verwijderen',
            deleteMultipleNotes: '{count} notities verwijderen',
            deleteMultipleFiles: '{count} bestanden verwijderen',
            moveToFolder: 'Verplaatsen naar...',
            moveMultipleToFolder: '{count} bestanden verplaatsen naar...',
            addTag: 'Tag toevoegen',
            removeTag: 'Tag verwijderen',
            removeAllTags: 'Alle tags verwijderen',
            changeIcon: 'Pictogram wijzigen',
            changeColor: 'Kleur wijzigen'
        },
        folder: {
            newNote: 'Nieuwe notitie',
            newFolder: 'Nieuwe map',
            newCanvas: 'Nieuw canvas',
            newBase: 'Nieuwe base',
            newDrawing: 'Nieuwe tekening',
            duplicateFolder: 'Map dupliceren',
            searchInFolder: 'Zoeken in map',
            createFolderNote: 'Mapnotitie maken',
            deleteFolderNote: 'Mapnotitie verwijderen',
            changeIcon: 'Pictogram wijzigen',
            changeColor: 'Kleur wijzigen',
            changeBackground: 'Achtergrond wijzigen',
            excludeFolder: 'Map verbergen',
            unhideFolder: 'Map zichtbaar maken',
            moveFolder: 'Verplaatsen naar...',
            renameFolder: 'Map hernoemen',
            deleteFolder: 'Map verwijderen'
        },
        tag: {
            changeIcon: 'Pictogram wijzigen',
            changeColor: 'Kleur wijzigen',
            changeBackground: 'Achtergrond wijzigen',
            showTag: 'Tag tonen',
            hideTag: 'Tag verbergen'
        }
    },

    // Folder appearance menu
    folderAppearance: {
        defaultPreset: 'Standaard uiterlijk',
        slimPreset: 'Compact (geen datum/voorbeeld/afbeelding)',
        titleRows: 'Titelrijen',
        previewRows: 'Voorbeeldrijen',
        groupBy: 'Groeperen op',
        defaultOption: (rows: number) => `Standaard (${rows})`,
        defaultTitleOption: (rows: number) => `Standaard titelrijen (${rows})`,
        defaultPreviewOption: (rows: number) => `Standaard voorbeeldrijen (${rows})`,
        defaultGroupOption: (groupLabel: string) => `Standaardgroepering (${groupLabel})`,
        titleRowOption: (rows: number) => `${rows} titelrij${rows === 1 ? '' : 'en'}`,
        previewRowOption: (rows: number) => `${rows} voorbeeldrij${rows === 1 ? '' : 'en'}`
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Pictogrammen zoeken...',
            recentlyUsedHeader: 'Recent gebruikt',
            emptyStateSearch: 'Begin met typen om pictogrammen te zoeken',
            emptyStateNoResults: 'Geen pictogrammen gevonden',
            showingResultsInfo: '50 van {count} resultaten weergegeven. Typ meer om te verfijnen.',
            emojiInstructions: 'Typ of plak een emoji om deze als pictogram te gebruiken',
            removeIcon: 'Pictogram verwijderen'
        },
        colorPicker: {
            currentColor: 'Huidig',
            newColor: 'Nieuw',
            presetColors: 'Vooraf ingestelde kleuren',
            recentColors: 'Recente kleuren',
            clearRecentColors: 'Recente kleuren wissen',
            removeRecentColor: 'Kleur verwijderen',
            removeColor: 'Kleur verwijderen',
            apply: 'Toepassen',
            hexLabel: 'HEX',
            rgbLabel: 'RGBA',
            colors: {
                red: 'Rood',
                orange: 'Oranje',
                amber: 'Amber',
                yellow: 'Geel',
                lime: 'Limoen',
                green: 'Groen',
                emerald: 'Smaragd',
                teal: 'Blauwgroen',
                cyan: 'Cyaan',
                sky: 'Hemelsblauw',
                blue: 'Blauw',
                indigo: 'Indigo',
                violet: 'Violet',
                purple: 'Paars',
                fuchsia: 'Fuchsia',
                pink: 'Roze',
                rose: 'Rozé',
                gray: 'Grijs',
                slate: 'Leisteen',
                stone: 'Steen'
            }
        },
        tagOperation: {
            renameTitle: 'Tag {tag} hernoemen',
            deleteTitle: 'Tag {tag} verwijderen',
            newTagPrompt: 'Nieuwe tagnaam',
            newTagPlaceholder: 'Voer nieuwe tagnaam in',
            renameWarning: 'Het hernoemen van tag {oldTag} wijzigt {count} {files}.',
            deleteWarning: 'Het verwijderen van tag {tag} wijzigt {count} {files}.',
            modificationWarning: 'Dit werkt de wijzigingsdatums van bestanden bij.',
            affectedFiles: 'Betreffende bestanden:',
            andMore: '...en {count} meer',
            confirmRename: 'Tag hernoemen',
            confirmDelete: 'Tag verwijderen',
            file: 'bestand',
            files: 'bestanden'
        },
        fileSystem: {
            newFolderTitle: 'Nieuwe map',
            renameFolderTitle: 'Map hernoemen',
            renameFileTitle: 'Bestand hernoemen',
            deleteFolderTitle: "'{name}' verwijderen?",
            deleteFileTitle: "'{name}' verwijderen?",
            folderNamePrompt: 'Voer mapnaam in:',
            renamePrompt: 'Voer nieuwe naam in:',
            renameVaultTitle: 'Weergavenaam kluis wijzigen',
            renameVaultPrompt: 'Voer aangepaste weergavenaam in (laat leeg voor standaard):',
            deleteFolderConfirm: 'Weet u zeker dat u deze map en alle inhoud wilt verwijderen?',
            deleteFileConfirm: 'Weet u zeker dat u dit bestand wilt verwijderen?',
            removeAllTagsTitle: 'Alle tags verwijderen',
            removeAllTagsFromNote: 'Weet u zeker dat u alle tags van deze notitie wilt verwijderen?',
            removeAllTagsFromNotes: 'Weet u zeker dat u alle tags van {count} notities wilt verwijderen?'
        },
        folderNoteType: {
            title: 'Selecteer type mapnotitie',
            folderLabel: 'Map: {name}'
        },
        folderSuggest: {
            placeholder: 'Verplaatsen naar map...',
            navigatePlaceholder: 'Navigeren naar map...',
            instructions: {
                navigate: 'om te navigeren',
                move: 'om te verplaatsen',
                select: 'om te selecteren',
                dismiss: 'om te sluiten'
            }
        },
        homepage: {
            placeholder: 'Bestanden zoeken...',
            instructions: {
                navigate: 'om te navigeren',
                select: 'om startpagina in te stellen',
                dismiss: 'om te sluiten'
            }
        },
        navigationBanner: {
            placeholder: 'Afbeeldingen zoeken...',
            instructions: {
                navigate: 'om te navigeren',
                select: 'om banner in te stellen',
                dismiss: 'om te sluiten'
            }
        },
        tagSuggest: {
            placeholder: 'Tags zoeken...',
            navigatePlaceholder: 'Navigeren naar tag...',
            addPlaceholder: 'Zoeken naar tag om toe te voegen...',
            removePlaceholder: 'Selecteer tag om te verwijderen...',
            createNewTag: 'Nieuwe tag maken: #{tag}',
            instructions: {
                navigate: 'om te navigeren',
                select: 'om te selecteren',
                dismiss: 'om te sluiten',
                add: 'om tag toe te voegen',
                remove: 'om tag te verwijderen'
            }
        }
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'Kan map niet maken: {error}',
            createFile: 'Kan bestand niet maken: {error}',
            renameFolder: 'Kan map niet hernoemen: {error}',
            renameFolderNoteConflict: 'Kan niet hernoemen: "{name}" bestaat al in deze map',
            renameFile: 'Kan bestand niet hernoemen: {error}',
            deleteFolder: 'Kan map niet verwijderen: {error}',
            deleteFile: 'Kan bestand niet verwijderen: {error}',
            duplicateNote: 'Kan notitie niet dupliceren: {error}',
            createCanvas: 'Kan canvas niet maken: {error}',
            createDatabase: 'Kan database niet maken: {error}',
            duplicateFolder: 'Kan map niet dupliceren: {error}',
            openVersionHistory: 'Kan versiegeschiedenis niet openen: {error}',
            versionHistoryNotFound: 'Versiegeschiedenis commando niet gevonden. Zorg dat Obsidian Sync is ingeschakeld.',
            revealInExplorer: 'Kan bestand niet tonen in systeemverkenner: {error}',
            folderNoteAlreadyExists: 'Mapnotitie bestaat al',
            folderAlreadyExists: 'Map "{name}" bestaat al',
            folderNotesDisabled: 'Schakel mapnotities in via instellingen om bestanden te converteren',
            folderNoteAlreadyLinked: 'Dit bestand fungeert al als mapnotitie',
            folderNoteUnsupportedExtension: 'Niet-ondersteunde bestandsextensie: {extension}',
            folderNoteMoveFailed: 'Kan bestand niet verplaatsen tijdens conversie: {error}',
            folderNoteRenameConflict: 'Een bestand met de naam "{name}" bestaat al in de map',
            folderNoteConversionFailed: 'Kan bestand niet converteren naar mapnotitie',
            folderNoteConversionFailedWithReason: 'Kan bestand niet converteren naar mapnotitie: {error}',
            folderNoteOpenFailed: 'Bestand geconverteerd maar kan mapnotitie niet openen: {error}',
            failedToDeleteFile: 'Kan {name} niet verwijderen: {error}',
            failedToDeleteMultipleFiles: 'Kan {count} bestanden niet verwijderen',
            versionHistoryNotAvailable: 'Versiegeschiedenis niet beschikbaar',
            drawingAlreadyExists: 'Een tekening met deze naam bestaat al',
            failedToCreateDrawing: 'Kan tekening niet maken',
            noFolderSelected: 'Geen map geselecteerd in Notebook Navigator',
            noFileSelected: 'Geen bestand geselecteerd'
        },
        notices: {
            hideFolder: 'Map verborgen: {name}',
            showFolder: 'Map zichtbaar: {name}'
        },
        notifications: {
            deletedMultipleFiles: '{count} bestanden verwijderd',
            movedMultipleFiles: '{count} bestanden verplaatst naar {folder}',
            folderNoteConversionSuccess: 'Bestand geconverteerd naar mapnotitie in "{name}"',
            folderMoved: 'Map "{name}" verplaatst',
            deepLinkCopied: 'Obsidian URL gekopieerd naar klembord',
            pathCopied: 'Pad gekopieerd naar klembord',
            relativePathCopied: 'Relatief pad gekopieerd naar klembord',
            tagAddedToNote: 'Tag toegevoegd aan 1 notitie',
            tagAddedToNotes: 'Tag toegevoegd aan {count} notities',
            tagRemovedFromNote: 'Tag verwijderd van 1 notitie',
            tagRemovedFromNotes: 'Tag verwijderd van {count} notities',
            tagsClearedFromNote: 'Alle tags verwijderd van 1 notitie',
            tagsClearedFromNotes: 'Alle tags verwijderd van {count} notities',
            noTagsToRemove: 'Geen tags om te verwijderen',
            noFilesSelected: 'Geen bestanden geselecteerd',
            tagOperationsNotAvailable: 'Tagbewerkingen niet beschikbaar',
            tagsRequireMarkdown: 'Tags worden alleen ondersteund op Markdown-notities',
            iconPackDownloaded: '{provider} gedownload',
            iconPackUpdated: '{provider} bijgewerkt ({version})',
            iconPackRemoved: '{provider} verwijderd',
            iconPackLoadFailed: 'Kan {provider} niet laden',
            hiddenFileReveal: 'Bestand is verborgen. Schakel "Verborgen items tonen" in om het weer te geven'
        },
        confirmations: {
            deleteMultipleFiles: 'Weet u zeker dat u {count} bestanden wilt verwijderen?',
            deleteConfirmation: 'Deze actie kan niet ongedaan worden gemaakt.'
        },
        defaultNames: {
            untitled: 'Zonder titel',
            untitledNumber: 'Zonder titel {number}'
        }
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'Kan een map niet in zichzelf of een submap verplaatsen.',
            itemAlreadyExists: 'Een item met de naam "{name}" bestaat al op deze locatie.',
            failedToMove: 'Verplaatsen mislukt: {error}',
            failedToAddTag: 'Kan tag "{tag}" niet toevoegen',
            failedToClearTags: 'Kan tags niet wissen',
            failedToMoveFolder: 'Kan map "{name}" niet verplaatsen',
            failedToImportFiles: 'Importeren mislukt: {names}'
        },
        notifications: {
            filesAlreadyExist: '{count} bestanden bestaan al op de bestemming',
            addedTag: 'Tag "{tag}" toegevoegd aan {count} bestanden',
            filesAlreadyHaveTag: '{count} bestanden hebben deze tag of een specifiekere al',
            clearedTags: 'Alle tags verwijderd van {count} bestanden',
            noTagsToClear: 'Geen tags om te wissen',
            fileImported: '1 bestand geïmporteerd',
            filesImported: '{count} bestanden geïmporteerd'
        }
    },

    // Date grouping
    dateGroups: {
        today: 'Vandaag',
        yesterday: 'Gisteren',
        previous7Days: 'Afgelopen 7 dagen',
        previous30Days: 'Afgelopen 30 dagen'
    },

    // Weekdays
    weekdays: {
        sunday: 'Zondag',
        monday: 'Maandag',
        tuesday: 'Dinsdag',
        wednesday: 'Woensdag',
        thursday: 'Donderdag',
        friday: 'Vrijdag',
        saturday: 'Zaterdag'
    },

    // Plugin commands
    commands: {
        open: 'Openen',
        openHomepage: 'Startpagina openen',
        revealFile: 'Bestand tonen',
        search: 'Zoeken',
        toggleDualPane: 'Dubbel paneel in-/uitschakelen',
        deleteFile: 'Bestanden verwijderen',
        createNewNote: 'Nieuwe notitie maken',
        moveFiles: 'Bestanden verplaatsen',
        convertToFolderNote: 'Converteren naar mapnotitie',
        pinAllFolderNotes: 'Alle mapnotities vastpinnen',
        navigateToFolder: 'Navigeren naar map',
        navigateToTag: 'Navigeren naar tag',
        addShortcut: 'Toevoegen aan snelkoppelingen',
        toggleDescendants: 'Afstammelingen in-/uitschakelen',
        toggleHidden: 'Verborgen mappen, tags en notities in-/uitschakelen',
        toggleTagSort: 'Tag sorteervolgorde in-/uitschakelen',
        collapseExpand: 'Alle items in-/uitklappen',
        addTag: 'Tag toevoegen aan geselecteerde bestanden',
        removeTag: 'Tag verwijderen van geselecteerde bestanden',
        removeAllTags: 'Alle tags verwijderen van geselecteerde bestanden',
        rebuildCache: 'Cache opnieuw opbouwen'
    },

    // Plugin UI
    plugin: {
        viewName: 'Notebook Navigator',
        ribbonTooltip: 'Notebook Navigator',
        revealInNavigator: 'Tonen in Notebook Navigator'
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: 'Laatst gewijzigd op',
        createdAt: 'Gemaakt op',
        file: 'bestand',
        files: 'bestanden',
        folder: 'map',
        folders: 'mappen'
    },

    // Settings
    settings: {
        metadataReport: {
            exportSuccess: 'Metadatarapport met fouten geëxporteerd naar: {filename}',
            exportFailed: 'Kan metadatarapport niet exporteren'
        },
        sections: {
            general: 'Algemeen',
            navigationPane: 'Navigatiepaneel',
            icons: 'Pictogrampakketten',
            folders: 'Mappen',
            tags: 'Tags',
            search: 'Zoeken',
            listPane: 'Lijstpaneel',
            notes: 'Notities',
            hotkeys: 'Sneltoetsen',
            advanced: 'Geavanceerd'
        },
        groups: {
            general: {
                filtering: 'Filteren',
                behavior: 'Gedrag',
                view: 'Uiterlijk',
                desktopAppearance: 'Desktop-uiterlijk',
                mobileAppearance: 'Mobiel uiterlijk',
                formatting: 'Opmaak'
            },
            navigation: {
                behavior: 'Gedrag',
                appearance: 'Uiterlijk'
            },
            list: {
                display: 'Uiterlijk',
                quickActions: 'Snelle acties'
            },
            notes: {
                frontmatter: 'Frontmatter',
                display: 'Uiterlijk'
            }
        },
        items: {
            searchProvider: {
                name: 'Zoekprovider',
                desc: 'Kies tussen snelle bestandsnaamzoekfunctie of volledige tekstzoekfunctie met Omnisearch plugin.',
                options: {
                    internal: 'Filter zoeken',
                    omnisearch: 'Omnisearch (volledige tekst)'
                },
                info: {
                    filterSearch: {
                        title: 'Filter zoeken (standaard):',
                        description:
                            'Snelle, lichtgewicht zoekfunctie die bestanden filtert op naam en tags binnen de huidige map en submappen. Ondersteunt tagfiltering met # prefix (bijv. #project), uitsluiting met ! prefix (bijv. !draft, !#archived), en het vinden van notities zonder tags met !#. Ideaal voor snelle navigatie binnen uw huidige context.'
                    },
                    omnisearch: {
                        title: 'Omnisearch:',
                        description:
                            'Volledige tekstzoekfunctie die uw hele kluis doorzoekt en vervolgens de resultaten filtert om alleen bestanden uit de huidige map, submappen of geselecteerde tags te tonen. Vereist dat de Omnisearch plugin is geïnstalleerd - indien niet beschikbaar, valt de zoekopdracht automatisch terug naar Filter zoeken.',
                        warningNotInstalled: 'Omnisearch plugin niet geïnstalleerd. Filter zoeken wordt gebruikt.',
                        limitations: {
                            title: 'Bekende beperkingen:',
                            performance: 'Prestaties: Kan traag zijn, vooral bij zoeken naar minder dan 3 tekens in grote kluizen',
                            pathBug:
                                'Padfout: Kan niet zoeken in paden met niet-ASCII-tekens en doorzoekt subpaden niet correct, wat invloed heeft op welke bestanden in zoekresultaten verschijnen',
                            limitedResults:
                                'Beperkte resultaten: Omdat Omnisearch de hele kluis doorzoekt en een beperkt aantal resultaten retourneert voordat er wordt gefilterd, kunnen relevante bestanden uit uw huidige map mogelijk niet verschijnen als er te veel overeenkomsten elders in de kluis bestaan',
                            previewText:
                                'Voorbeeldtekst: Notitievoorbeelden worden vervangen door Omnisearch-resultaatfragmenten, die mogelijk niet de daadwerkelijke zoekresultaatmarkering tonen als deze elders in het bestand verschijnt'
                        }
                    }
                }
            },
            listPaneTitle: {
                name: 'Titel lijstpaneel',
                desc: 'Kies waar de titel van het lijstpaneel wordt weergegeven.',
                options: {
                    header: 'Tonen in koptekst',
                    list: 'Tonen in lijstpaneel',
                    hidden: 'Niet tonen'
                }
            },
            sortNotesBy: {
                name: 'Notities sorteren op',
                desc: 'Kies hoe notities worden gesorteerd in de notitielijst.',
                options: {
                    'modified-desc': 'Datum bewerkt (nieuwste bovenaan)',
                    'modified-asc': 'Datum bewerkt (oudste bovenaan)',
                    'created-desc': 'Datum gemaakt (nieuwste bovenaan)',
                    'created-asc': 'Datum gemaakt (oudste bovenaan)',
                    'title-asc': 'Titel (A bovenaan)',
                    'title-desc': 'Titel (Z bovenaan)'
                }
            },
            includeDescendantNotes: {
                name: 'Notities uit submappen / afstammelingen tonen',
                desc: 'Notities uit geneste submappen en tag-afstammelingen opnemen bij het bekijken van een map of tag.'
            },
            limitPinnedToCurrentFolder: {
                name: 'Vastgepinde notities alleen in bovenliggende map tonen',
                desc: 'Vastgepinde notities verschijnen alleen bij het bekijken van hun map'
            },
            separateNoteCounts: {
                name: 'Huidige en afstammeling-tellingen apart tonen',
                desc: 'Notitietelingen weergeven in "huidig ▾ afstammelingen" formaat in mappen en tags.'
            },
            groupNotes: {
                name: 'Notities groeperen',
                desc: 'Koppen tussen notities weergeven gegroepeerd op datum of map. Tagweergaven gebruiken datumgroepen wanneer mapgroepering is ingeschakeld.',
                options: {
                    none: 'Niet groeperen',
                    date: 'Groeperen op datum',
                    folder: 'Groeperen op map'
                }
            },
            showPinnedGroupHeader: {
                name: 'Vastgepinde groepskop tonen',
                desc: 'De vastgepinde sectiekop boven vastgepinde notities weergeven.'
            },
            optimizeNoteHeight: {
                name: 'Notitiehoogte optimaliseren',
                desc: 'Hoogte verminderen voor vastgepinde notities en notities zonder voorbeeldtekst.'
            },
            slimItemHeight: {
                name: 'Compacte itemhoogte',
                desc: 'Stel de hoogte van compacte lijstitems in op desktop en mobiel.',
                resetTooltip: 'Herstellen naar standaard (28px)'
            },
            slimItemHeightScaleText: {
                name: 'Tekst schalen met compacte itemhoogte',
                desc: 'Compacte lijsttekst schalen wanneer de itemhoogte wordt verminderd.'
            },
            showParentFolderNames: {
                name: 'Bovenliggende mapnamen tonen',
                desc: 'De naam van de bovenliggende map weergeven voor notities in submappen of tags.'
            },
            showParentFolderColors: {
                name: 'Bovenliggende mapkleuren tonen',
                desc: 'Mapkleuren gebruiken voor labels van bovenliggende mappen.'
            },
            showQuickActions: {
                name: 'Snelle acties tonen (alleen desktop)',
                desc: 'Zweefacties op bestandsitems tonen.'
            },
            quickActionsRevealInFolder: {
                name: 'Tonen in map',
                desc: 'Snelle actie: Notitie tonen in bovenliggende map. Alleen zichtbaar bij het bekijken van notities uit submappen of in tags (niet weergegeven in de werkelijke map van de notitie).'
            },
            quickActionsPinNote: {
                name: 'Notitie vastpinnen',
                desc: 'Snelle actie: Notitie vastpinnen of losmaken bovenaan de lijst.'
            },
            quickActionsOpenInNewTab: {
                name: 'Openen in nieuw tabblad',
                desc: 'Snelle actie: Notitie openen in nieuw tabblad.'
            },
            dualPane: {
                name: 'Dubbel paneellay-out (niet gesynchroniseerd)',
                desc: 'Navigatiepaneel en lijstpaneel naast elkaar tonen op desktop.'
            },
            dualPaneOrientation: {
                name: 'Dubbel paneel oriëntatie (niet gesynchroniseerd)',
                desc: 'Kies horizontale of verticale lay-out wanneer dubbel paneel actief is.',
                options: {
                    horizontal: 'Horizontale splitsing',
                    vertical: 'Verticale splitsing'
                }
            },
            appearanceBackground: {
                name: 'Achtergrondkleur',
                desc: 'Kies achtergrondkleuren voor navigatie- en lijstpanelen.',
                options: {
                    separate: 'Afzonderlijke achtergronden',
                    primary: 'Gebruik lijstachtergrond',
                    secondary: 'Gebruik navigatieachtergrond'
                }
            },
            appearanceScale: {
                name: 'Zoomniveau',
                desc: 'Regelt het algemene zoomniveau van Notebook Navigator.'
            },
            startView: {
                name: 'Standaard opstartweergave',
                desc: 'Kies welk paneel wordt weergegeven bij het openen van Notebook Navigator. Navigatiepaneel toont snelkoppelingen, recente notities en mappenstructuur. Lijstpaneel toont direct de notitielijst.',
                options: {
                    navigation: 'Navigatiepaneel',
                    files: 'Lijstpaneel'
                }
            },
            autoRevealActiveNote: {
                name: 'Actieve notitie automatisch tonen',
                desc: 'Notities automatisch tonen wanneer geopend vanuit Snelle Wisselaar, links of zoeken.'
            },
            autoRevealIgnoreRightSidebar: {
                name: 'Gebeurtenissen van rechter zijbalk negeren',
                desc: 'Actieve notitie niet wijzigen bij klikken of wijzigen van notities in de rechter zijbalk.'
            },
            autoSelectFirstFileOnFocusChange: {
                name: 'Eerste notitie automatisch selecteren (alleen desktop)',
                desc: 'Automatisch de eerste notitie openen bij het wisselen van mappen of tags.'
            },
            skipAutoScroll: {
                name: 'Automatisch scrollen voor snelkoppelingen uitschakelen',
                desc: 'Het navigatiepaneel niet scrollen bij klikken op items in snelkoppelingen.'
            },
            autoExpandFoldersTags: {
                name: 'Mappen en tags automatisch uitklappen',
                desc: 'Mappen en tags automatisch uitklappen wanneer ze worden geselecteerd.'
            },
            navigationBanner: {
                name: 'Navigatiebanner',
                desc: 'Een afbeelding weergeven boven het navigatiepaneel.',
                current: 'Huidige banner: {path}',
                chooseButton: 'Afbeelding kiezen',
                clearButton: 'Wissen'
            },
            showShortcuts: {
                name: 'Snelkoppelingen tonen',
                desc: 'De sectie snelkoppelingen weergeven in het navigatiepaneel.'
            },
            showRecentNotes: {
                name: 'Recente notities tonen',
                desc: 'De sectie recente notities weergeven in het navigatiepaneel.'
            },
            recentNotesCount: {
                name: 'Aantal recente notities',
                desc: 'Aantal weer te geven recente notities.'
            },
            showTooltips: {
                name: 'Tooltips tonen',
                desc: 'Zweeftips met extra informatie weergeven voor notities en mappen.'
            },
            showTooltipPath: {
                name: 'Pad tonen',
                desc: 'Het mappad onder notitienamen in tooltips weergeven.'
            },
            resetPaneSeparator: {
                name: 'Paneelscheidingspositie resetten',
                desc: 'De versleepbare scheiding tussen navigatiepaneel en lijstpaneel resetten naar standaardpositie.',
                buttonText: 'Scheiding resetten',
                notice: 'Scheidingspositie gereset. Herstart Obsidian of heropen Notebook Navigator om toe te passen.'
            },
            multiSelectModifier: {
                name: 'Meervoudige selectie modifier',
                desc: 'Kies welke modificatortoets meervoudige selectie in-/uitschakelt. Wanneer Option/Alt is geselecteerd, opent Cmd/Ctrl klik notities in een nieuw tabblad.',
                options: {
                    cmdCtrl: 'Cmd/Ctrl klik',
                    optionAlt: 'Option/Alt klik'
                }
            },
            fileVisibility: {
                name: 'Bestandstypes tonen',
                desc: 'Filter welke bestandstypes worden weergegeven in de navigator. Bestandstypes die niet door Obsidian worden ondersteund, kunnen in externe applicaties worden geopend.',
                options: {
                    documents: 'Documenten (.md, .canvas, .base)',
                    supported: 'Ondersteund (opent in Obsidian)',
                    all: 'Alle (kan extern openen)'
                }
            },
            homepage: {
                name: 'Startpagina',
                desc: 'Kies het bestand dat Notebook Navigator automatisch opent, zoals een dashboard.',
                current: 'Huidig: {path}',
                currentMobile: 'Mobiel: {path}',
                chooseButton: 'Bestand kiezen',
                clearButton: 'Wissen',
                separateMobile: {
                    name: 'Aparte mobiele startpagina',
                    desc: 'Een andere startpagina gebruiken voor mobiele apparaten.'
                }
            },
            excludedNotes: {
                name: 'Notities verbergen',
                desc: 'Kommagescheiden lijst van frontmatter-eigenschappen. Notities met een van deze eigenschappen worden verborgen (bijv. draft, private, archived).',
                placeholder: 'draft, private'
            },
            excludedFolders: {
                name: 'Mappen verbergen',
                desc: 'Kommagescheiden lijst van te verbergen mappen. Naampatronen: assets* (mappen beginnend met assets), *_temp (eindigend met _temp). Padpatronen: /archive (alleen root archive), /res* (root mappen beginnend met res), /*/temp (temp mappen één niveau diep), /projects/* (alle mappen binnen projects).',
                placeholder: 'templates, assets*, /archive, /res*'
            },
            showFileDate: {
                name: 'Datum tonen',
                desc: 'De datum onder notitienamen weergeven.'
            },
            alphabeticalDateMode: {
                name: 'Bij sorteren op naam',
                desc: 'Weer te geven datum wanneer notities alfabetisch zijn gesorteerd.',
                options: {
                    created: 'Aanmaakdatum',
                    modified: 'Wijzigingsdatum'
                }
            },
            showFileTags: {
                name: 'Bestandstags tonen',
                desc: 'Klikbare tags weergeven in bestandsitems.'
            },
            showFileTagAncestors: {
                name: 'Bovenliggende tags tonen',
                desc: 'Bovenliggende segmenten weergeven vóór de tagnaam.'
            },
            colorFileTags: {
                name: 'Bestandstags kleuren',
                desc: 'Tagkleuren toepassen op tagbadges op bestandsitems.'
            },
            showFileTagsInSlimMode: {
                name: 'Bestandstags tonen in compacte modus',
                desc: 'Tags weergeven wanneer datum, voorbeeld en afbeelding verborgen zijn.'
            },
            dateFormat: {
                name: 'Datumformaat',
                desc: 'Formaat voor het weergeven van datums (gebruikt date-fns formaat).',
                placeholder: 'd MMM yyyy',
                help: 'Veelvoorkomende formaten:\nd MMM yyyy = 25 mei 2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\nTokens:\nyyyy/yy = jaar\nMMMM/MMM/MM = maand\ndd/d = dag\nEEEE/EEE = weekdag',
                helpTooltip: 'Klik voor formaatverwijzing'
            },
            timeFormat: {
                name: 'Tijdformaat',
                desc: 'Formaat voor het weergeven van tijden (gebruikt date-fns formaat).',
                placeholder: 'HH:mm',
                help: 'Veelvoorkomende formaten:\nHH:mm = 14:30 (24-uurs)\nh:mm a = 2:30 PM (12-uurs)\nHH:mm:ss = 14:30:45\nh:mm:ss a = 2:30:45 PM\n\nTokens:\nHH/H = 24-uurs\nhh/h = 12-uurs\nmm = minuten\nss = seconden\na = AM/PM',
                helpTooltip: 'Klik voor formaatverwijzing'
            },
            showFilePreview: {
                name: 'Notitievoorbeeld tonen',
                desc: 'Voorbeeldtekst onder notitienamen weergeven.'
            },
            skipHeadingsInPreview: {
                name: 'Koppen overslaan in voorbeeld',
                desc: 'Kopregels overslaan bij het genereren van voorbeeldtekst.'
            },
            skipCodeBlocksInPreview: {
                name: 'Codeblokken overslaan in voorbeeld',
                desc: 'Codeblokken overslaan bij het genereren van voorbeeldtekst.'
            },
            previewProperties: {
                name: 'Voorbeeldeigenschappen',
                desc: 'Kommagescheiden lijst van frontmatter-eigenschappen om te controleren op voorbeeldtekst. De eerste eigenschap met tekst wordt gebruikt.',
                placeholder: 'summary, description, abstract',
                info: 'Als er geen voorbeeldtekst wordt gevonden in de opgegeven eigenschappen, wordt het voorbeeld gegenereerd uit de notitie-inhoud.'
            },
            previewRows: {
                name: 'Voorbeeldrijen',
                desc: 'Aantal weer te geven rijen voor voorbeeldtekst.',
                options: {
                    '1': '1 rij',
                    '2': '2 rijen',
                    '3': '3 rijen',
                    '4': '4 rijen',
                    '5': '5 rijen'
                }
            },
            fileNameRows: {
                name: 'Titelrijen',
                desc: 'Aantal weer te geven rijen voor notitietitels.',
                options: {
                    '1': '1 rij',
                    '2': '2 rijen'
                }
            },
            showFeatureImage: {
                name: 'Uitgelichte afbeelding tonen',
                desc: 'Miniatuurafbeeldingen uit frontmatter weergeven. Tip: Gebruik de "Featured Image" plugin om automatisch uitgelichte afbeeldingen in te stellen voor al uw documenten.'
            },
            forceSquareFeatureImage: {
                name: 'Vierkante uitgelichte afbeelding afdwingen',
                desc: 'Uitgelichte afbeeldingen weergeven als vierkante miniaturen.'
            },
            featureImageProperties: {
                name: 'Afbeeldingseigenschappen',
                desc: 'Kommagescheiden lijst van frontmatter-eigenschappen om te controleren op miniatuurafbeeldingen. De eerste eigenschap met een afbeelding wordt gebruikt. Indien leeg en de fallback-instelling is ingeschakeld, wordt de eerste ingesloten afbeelding gebruikt.',
                placeholder: 'thumbnail, featureResized, feature'
            },
            useEmbeddedImageFallback: {
                name: 'Ingesloten afbeelding als fallback gebruiken',
                desc: 'De eerste ingesloten afbeelding in het document als fallback gebruiken wanneer geen miniatuur wordt gevonden in frontmatter-eigenschappen (vereist Obsidian 1.9.4+). Schakel dit uit om te verifiëren dat miniaturen correct zijn geconfigureerd.'
            },
            showRootFolder: {
                name: 'Hoofdmap tonen',
                desc: 'De kluisnaam als hoofdmap in de structuur weergeven.'
            },
            inheritFolderColors: {
                name: 'Mapkleuren overerven',
                desc: 'Submappen erven kleur van bovenliggende mappen.'
            },
            showNoteCount: {
                name: 'Notitietelling tonen',
                desc: 'Het aantal notities naast elke map en tag weergeven.'
            },
            showIcons: {
                name: 'Pictogrammen tonen',
                desc: 'Pictogrammen weergeven voor mappen, tags en notities.'
            },
            showIconsColorOnly: {
                name: 'Kleur alleen op pictogrammen toepassen',
                desc: 'Indien ingeschakeld, worden aangepaste kleuren alleen op pictogrammen toegepast. Indien uitgeschakeld, worden kleuren toegepast op zowel pictogrammen als tekstlabels.'
            },
            collapseBehavior: {
                name: 'Items inklappen',
                desc: 'Kies wat de uitklappen/inklappen alle knop beïnvloedt.',
                options: {
                    all: 'Alle mappen en tags',
                    foldersOnly: 'Alleen mappen',
                    tagsOnly: 'Alleen tags'
                }
            },
            smartCollapse: {
                name: 'Geselecteerd item uitgeklapt houden',
                desc: 'Bij het inklappen de momenteel geselecteerde map of tag en de bovenliggende items uitgeklapt houden.'
            },
            navIndent: {
                name: 'Structuurinspringing',
                desc: 'De inspringbreedte aanpassen voor geneste mappen en tags.'
            },
            navItemHeight: {
                name: 'Itemhoogte',
                desc: 'De hoogte van mappen en tags in het navigatiepaneel aanpassen.'
            },
            navItemHeightScaleText: {
                name: 'Tekst schalen met itemhoogte',
                desc: 'Navigatietekstgrootte verminderen wanneer itemhoogte wordt verminderd.'
            },
            navRootSpacing: {
                name: 'Hoofditem-afstand',
                desc: 'Afstand tussen mappen en tags op hoofdniveau.'
            },
            showTags: {
                name: 'Tags tonen',
                desc: 'Tagsectie onder mappen in de navigator weergeven.'
            },
            tagSortOrder: {
                name: 'Tag sorteervolgorde',
                desc: 'Kies hoe tags worden geordend in het navigatiepaneel.',
                options: {
                    alphaAsc: 'A tot Z',
                    alphaDesc: 'Z tot A',
                    frequencyAsc: 'Frequentie (laag naar hoog)',
                    frequencyDesc: 'Frequentie (hoog naar laag)'
                }
            },
            showAllTagsFolder: {
                name: 'Tags-map tonen',
                desc: '"Tags" weergeven als inklapbare map.'
            },
            showUntagged: {
                name: 'Notities zonder tags tonen',
                desc: '"Zonder tags" item weergeven voor notities zonder tags.'
            },
            keepEmptyTagsProperty: {
                name: 'Tags-eigenschap behouden na verwijderen laatste tag',
                desc: 'De tags frontmatter-eigenschap behouden wanneer alle tags worden verwijderd. Indien uitgeschakeld, wordt de tags-eigenschap verwijderd uit frontmatter.'
            },
            hiddenTags: {
                name: 'Verborgen tags',
                desc: 'Kommagescheiden lijst van tag-prefixen of naam-wildcards. Gebruik tag* of *tag om tagnamen te matchen. Het verbergen van een tag verbergt ook al zijn subtags (bijv. "archive" verbergt "archive/2024/docs").',
                placeholder: 'internal, temp/drafts, archive/2024'
            },
            enableFolderNotes: {
                name: 'Mapnotities inschakelen',
                desc: 'Indien ingeschakeld, worden mappen met gekoppelde notities weergegeven als klikbare links.'
            },
            folderNoteType: {
                name: 'Standaard mapnotitie-type',
                desc: 'Mapnotitie-type aangemaakt vanuit het contextmenu.',
                options: {
                    ask: 'Vragen bij aanmaken',
                    markdown: 'Markdown',
                    canvas: 'Canvas',
                    base: 'Base'
                }
            },
            folderNoteName: {
                name: 'Mapnotitienaam',
                desc: 'Naam van de mapnotitie zonder extensie. Laat leeg om dezelfde naam als de map te gebruiken.',
                placeholder: 'index'
            },
            folderNoteProperties: {
                name: 'Mapnotitie-eigenschappen',
                desc: 'YAML frontmatter toegevoegd aan nieuwe mapnotities. --- markers worden automatisch toegevoegd.',
                placeholder: 'theme: dark\nfoldernote: true'
            },
            hideFolderNoteInList: {
                name: 'Mapnotities in lijst verbergen',
                desc: 'De mapnotitie verbergen in de notitielijst van de map.'
            },
            pinCreatedFolderNote: {
                name: 'Aangemaakte mapnotities vastpinnen',
                desc: 'Mapnotities automatisch vastpinnen wanneer aangemaakt vanuit het contextmenu.'
            },
            confirmBeforeDelete: {
                name: 'Bevestigen voor verwijderen',
                desc: 'Bevestigingsdialoog tonen bij het verwijderen van notities of mappen'
            },
            metadataCleanup: {
                name: 'Metadata opschonen',
                desc: 'Verwijdert verweesde metadata die achterblijft wanneer bestanden, mappen of tags worden verwijderd, verplaatst of hernoemd buiten Obsidian. Dit beïnvloedt alleen het Notebook Navigator-instellingenbestand.',
                buttonText: 'Metadata opschonen',
                error: 'Opschonen van instellingen mislukt',
                loading: 'Metadata controleren...',
                statusClean: 'Geen metadata om op te schonen',
                statusCounts: 'Verweesde items: {folders} mappen, {tags} tags, {files} bestanden, {pinned} pins'
            },
            rebuildCache: {
                name: 'Cache opnieuw opbouwen',
                desc: 'Gebruik dit als u ontbrekende tags, onjuiste voorbeelden of ontbrekende uitgelichte afbeeldingen ervaart. Dit kan gebeuren na synchronisatieconflicten of onverwachte afsluitingen.',
                buttonText: 'Cache opnieuw opbouwen',
                success: 'Cache opnieuw opgebouwd',
                error: 'Kan cache niet opnieuw opbouwen'
            },
            hotkeys: {
                intro: 'Bewerk <plugin folder>/notebook-navigator/data.json om Notebook Navigator sneltoetsen aan te passen. Open het bestand en zoek de sectie "keyboardShortcuts". Elke invoer gebruikt deze structuur:',
                example: '"pane:move-up": [ { "key": "ArrowUp", "modifiers": [] }, { "key": "K", "modifiers": [] } ]',
                modifierList: [
                    '"Mod" = Cmd (macOS) / Ctrl (Win/Linux)',
                    '"Alt" = Alt/Option',
                    '"Shift" = Shift',
                    '"Ctrl" = Control (gebruik bij voorkeur "Mod" voor cross-platform)'
                ],
                guidance:
                    'Voeg meerdere toewijzingen toe om alternatieve toetsen te ondersteunen, zoals de ArrowUp en K bindingen hierboven. Combineer modifiers in één invoer door elke waarde te vermelden, bijvoorbeeld "modifiers": ["Mod", "Shift"]. Toetsenbordreeksen zoals "gg" of "dd" worden niet ondersteund. Herlaad Obsidian na het bewerken van het bestand.'
            },
            externalIcons: {
                downloadButton: 'Downloaden',
                downloadingLabel: 'Downloaden...',
                removeButton: 'Verwijderen',
                statusInstalled: 'Gedownload (versie {version})',
                statusNotInstalled: 'Niet gedownload',
                versionUnknown: 'onbekend',
                downloadFailed: 'Kan {name} niet downloaden. Controleer uw verbinding en probeer opnieuw.',
                removeFailed: 'Kan {name} niet verwijderen.',
                infoNote:
                    'Gedownloade pictogrampakketten synchroniseren installatiestatus tussen apparaten. Pictogrampakketten blijven in de lokale database op elk apparaat; synchronisatie houdt alleen bij of ze moeten worden gedownload of verwijderd. Pictogrampakketten downloaden van de Notebook Navigator repository (https://github.com/johansan/notebook-navigator/tree/main/icon-assets).',
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
                name: 'Metadata uit frontmatter lezen',
                desc: 'Notitienamen, tijdstempels, pictogrammen en kleuren uit frontmatter lezen wanneer beschikbaar, met terugval naar bestandssysteemwaarden of instellingen'
            },
            frontmatterIconField: {
                name: 'Pictogramveld',
                desc: 'Frontmatter-veld voor bestandspictogrammen. Laat leeg om pictogrammen te gebruiken die zijn opgeslagen in instellingen.',
                placeholder: 'icon'
            },
            frontmatterColorField: {
                name: 'Kleurveld',
                desc: 'Frontmatter-veld voor bestandskleuren. Laat leeg om kleuren te gebruiken die zijn opgeslagen in instellingen.',
                placeholder: 'color'
            },
            frontmatterSaveMetadata: {
                name: 'Pictogrammen en kleuren opslaan in frontmatter',
                desc: 'Bestandspictogrammen en -kleuren automatisch naar frontmatter schrijven met behulp van de hierboven geconfigureerde velden.'
            },
            frontmatterIconizeFormat: {
                name: 'Opslaan in Iconize-formaat',
                desc: 'Pictogrammen opslaan met Iconize-formaat (bijv. LiHome, FasUser, SiGithub) in plaats van plugin-formaat (bijv. home, fontawesome-solid:user, simple-icons:github).'
            },
            frontmatterMigration: {
                name: 'Pictogrammen en kleuren migreren vanuit instellingen',
                desc: 'Opgeslagen in instellingen: {icons} pictogrammen, {colors} kleuren.',
                button: 'Migreren',
                buttonWorking: 'Migreren...',
                noticeNone: 'Geen bestandspictogrammen of kleuren opgeslagen in instellingen.',
                noticeDone: '{migratedIcons}/{icons} pictogrammen, {migratedColors}/{colors} kleuren gemigreerd.',
                noticeFailures: 'Mislukte vermeldingen: {failures}.',
                noticeError: 'Migratie mislukt. Controleer console voor details.'
            },
            frontmatterNameField: {
                name: 'Naamveld',
                desc: 'Frontmatter-veld om te gebruiken als weergavenaam voor de notitie. Laat leeg om de bestandsnaam te gebruiken.',
                placeholder: 'title'
            },
            frontmatterCreatedField: {
                name: 'Aangemaakt tijdstempelveld',
                desc: 'Frontmatter-veldnaam voor de aangemaakt tijdstempel. Laat leeg om alleen bestandssysteemdatum te gebruiken.',
                placeholder: 'created'
            },
            frontmatterModifiedField: {
                name: 'Gewijzigd tijdstempelveld',
                desc: 'Frontmatter-veldnaam voor de gewijzigd tijdstempel. Laat leeg om alleen bestandssysteemdatum te gebruiken.',
                placeholder: 'modified'
            },
            frontmatterDateFormat: {
                name: 'Tijdstempelformaat',
                desc: 'Formaat gebruikt om tijdstempels in frontmatter te parseren. Laat leeg om ISO 8601 formaat te gebruiken',
                helpTooltip: 'Zie date-fns formaatdocumentatie',
                help: "Veelvoorkomende formaten:\nyyyy-MM-dd'T'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM"
            },
            supportDevelopment: {
                name: 'Ontwikkeling ondersteunen',
                desc: 'Als u graag Notebook Navigator gebruikt, overweeg dan om de voortdurende ontwikkeling te ondersteunen.',
                buttonText: '❤️ Sponsor',
                coffeeButton: '☕️ Koop me een koffie'
            },
            updateCheckOnStart: {
                name: 'Controleren op nieuwe versie bij opstarten',
                desc: 'Controleert bij het opstarten op nieuwe plugin-releases en toont een melding wanneer een update beschikbaar is. Elke versie wordt slechts één keer aangekondigd en controles vinden hooguit één keer per dag plaats.',
                status: 'Nieuwe versie beschikbaar: {version}'
            },
            whatsNew: {
                name: 'Wat is er nieuw',
                desc: 'Bekijk recente updates en verbeteringen',
                buttonText: 'Bekijk recente updates'
            },
            cacheStatistics: {
                localCache: 'Lokale cache',
                items: 'items',
                withTags: 'met tags',
                withPreviewText: 'met voorbeeldtekst',
                withFeatureImage: 'met uitgelichte afbeelding',
                withMetadata: 'met metadata'
            },
            metadataInfo: {
                successfullyParsed: 'Succesvol geparsed',
                itemsWithName: 'items met naam',
                withCreatedDate: 'met aanmaakdatum',
                withModifiedDate: 'met wijzigingsdatum',
                withIcon: 'met pictogram',
                withColor: 'met kleur',
                failedToParse: 'Parseren mislukt',
                createdDates: 'aanmaakdatums',
                modifiedDates: 'wijzigingsdatums',
                checkTimestampFormat: 'Controleer uw tijdstempelformaat.',
                exportFailed: 'Exportfouten'
            }
        }
    },
    whatsNew: {
        title: 'Wat is er nieuw in Notebook Navigator',
        supportMessage: 'Als u Notebook Navigator nuttig vindt, overweeg dan om de ontwikkeling te ondersteunen.',
        supportButton: 'Koop me een koffie',
        thanksButton: 'Bedankt!'
    }
};
