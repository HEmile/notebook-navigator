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
export const STRINGS_ES = {
    // Common UI elements
    common: {
        cancel: 'Cancelar', // Button text for canceling dialogs and operations (English: Cancel)
        delete: 'Eliminar', // Button text for delete operations in dialogs (English: Delete)
        remove: 'Eliminar', // Button text for remove operations in dialogs (English: Remove)
        submit: 'Enviar', // Button text for submitting forms and dialogs (English: Submit)
        noSelection: 'Sin selección', // Placeholder text when no folder or tag is selected (English: No selection)
        untagged: 'Sin etiquetas', // Label for notes without any tags (English: Untagged)
        untitled: 'Sin título', // Default name for notes without a title (English: Untitled)
        featureImageAlt: 'Imagen destacada', // Alt text for thumbnail/preview images (English: Feature image)
        unknownError: 'Error desconocido', // Generic fallback when an error has no message (English: Unknown error)
        updateBannerTitle: 'Actualización de Notebook Navigator disponible',
        updateBannerInstruction: 'Actualiza en Ajustes -> Complementos de la comunidad'
    },

    // List pane
    listPane: {
        emptyStateNoSelection: 'Selecciona una carpeta o etiqueta para ver las notas', // Message shown when no folder or tag is selected (English: Select a folder or tag to view notes)
        emptyStateNoNotes: 'Sin notas', // Message shown when a folder/tag has no notes (English: No notes)
        pinnedSection: '📌 Fijadas', // Header for the pinned notes section at the top of file list (English: 📌 Pinned)
        notesSection: 'Notas', // Header shown between pinned and regular items when showing documents only (English: Notes)
        filesSection: 'Archivos' // Header shown between pinned and regular items when showing supported or all files (English: Files)
    },

    // Tag list
    tagList: {
        untaggedLabel: 'Sin etiquetas', // Label for the special item showing notes without tags (English: Untagged)
        hiddenTags: 'Etiquetas ocultas', // Label for the hidden tags virtual folder (English: Hidden tags)
        tags: 'Etiquetas' // Label for the tags virtual folder (English: Tags)
    },

    navigationPane: {
        shortcutsHeader: 'Accesos directos',
        recentNotesHeader: 'Notas recientes',
        recentFilesHeader: 'Archivos recientes',
        reorderRootFoldersTitle: 'Reordenar secciones de navegación',
        reorderRootFoldersHint: 'Arrastra encabezados o elementos para cambiar el orden',
        vaultRootLabel: 'Bóveda',
        resetRootToAlpha: 'Restablecer orden alfabético',
        resetRootToFrequency: 'Restablecer al orden por frecuencia',
        dragHandleLabel: 'Arrastrar para reordenar',
        pinShortcuts: 'Fijar accesos directos',
        unpinShortcuts: 'Desfijar accesos directos'
    },

    shortcuts: {
        folderExists: 'La carpeta ya está en los atajos',
        noteExists: 'La nota ya está en los atajos',
        tagExists: 'La etiqueta ya está en los atajos',
        topicExists: 'El tema ya está en los atajos',
        searchExists: 'El atajo de búsqueda ya existe',
        emptySearchQuery: 'Ingresa una consulta de búsqueda antes de guardarla',
        emptySearchName: 'Ingresa un nombre antes de guardar la búsqueda',
        add: 'Agregar a accesos directos',
        remove: 'Quitar de accesos directos',
        moveUp: 'Mover arriba',
        moveDown: 'Mover abajo'
    },

    // Pane header
    paneHeader: {
        collapseAllFolders: 'Contraer elementos', // Tooltip for button that collapses expanded items (English: Collapse items)
        expandAllFolders: 'Expandir todos los elementos', // Tooltip for button that expands all items (English: Expand all items)
        scrollToTop: 'Desplazarse arriba',
        newFolder: 'Nueva carpeta', // Tooltip for create new folder button (English: New folder)
        newNote: 'Nueva nota', // Tooltip for create new note button (English: New note)
        mobileBackToNavigation: 'Volver a navegación', // Mobile-only back button text to return to navigation pane (English: Back to navigation)
        changeSortOrder: 'Cambiar orden de clasificación', // Tooltip for the sort order toggle button (English: Change sort order)
        defaultSort: 'Predeterminado', // Label for default sorting mode (English: Default)
        customSort: 'Personalizado', // Label for custom sorting mode (English: Custom)
        showFolders: 'Mostrar navegación', // Tooltip for button to show the navigation pane (English: Show navigation)
        hideFolders: 'Ocultar navegación', // Tooltip for button to hide the navigation pane (English: Hide navigation)
        reorderRootFolders: 'Reordenar carpetas raíz y etiquetas',
        finishRootFolderReorder: 'Finalizar reordenación',
        toggleDescendantNotes: 'Mostrar notas de subcarpetas / descendientes', // Tooltip for button to toggle showing notes from descendants (English: Show notes from subfolders / descendants)
        autoExpandFoldersTags: 'Expandir carpetas y etiquetas automáticamente', // Tooltip for button to toggle auto-expanding folders and tags when selected (English: Auto-expand folders and tags)
        showExcludedItems: 'Mostrar elementos ocultos', // Tooltip for button to show hidden items (English: Show hidden items)
        hideExcludedItems: 'Ocultar elementos ocultos', // Tooltip for button to hide hidden items (English: Hide hidden items)
        showDualPane: 'Mostrar paneles dobles', // Tooltip for button to show dual-pane layout (English: Show dual panes)
        showSinglePane: 'Mostrar panel único', // Tooltip for button to show single-pane layout (English: Show single pane)
        changeAppearance: 'Cambiar apariencia', // Tooltip for button to change folder appearance settings (English: Change appearance)
        search: 'Buscar' // Tooltip for search button (English: Search)
    },
    // Search input
    searchInput: {
        placeholder: 'Buscar...', // Placeholder text for search input (English: Search...)
        placeholderOmnisearch: 'Omnisearch...', // Placeholder text when Omnisearch provider is active (English: Omnisearch...)
        clearSearch: 'Borrar búsqueda', // Tooltip for clear search button (English: Clear search)
        saveSearchShortcut: 'Guardar búsqueda en accesos directos',
        removeSearchShortcut: 'Eliminar búsqueda de accesos directos',
        shortcutModalTitle: 'Guardar búsqueda',
        shortcutNameLabel: 'Nombre del acceso directo',
        shortcutNamePlaceholder: 'Introduce el nombre'
    },

    // Context menus
    contextMenu: {
        file: {
            openInNewTab: 'Abrir en nueva pestaña',
            openToRight: 'Abrir a la derecha',
            openInNewWindow: 'Abrir en nueva ventana',
            openMultipleInNewTabs: 'Abrir {count} notas en nuevas pestañas',
            openMultipleToRight: 'Abrir {count} notas a la derecha',
            openMultipleInNewWindows: 'Abrir {count} notas en nuevas ventanas',
            pinNote: 'Fijar nota',
            unpinNote: 'Desfijar nota',
            pinMultipleNotes: 'Fijar {count} notas',
            unpinMultipleNotes: 'Desfijar {count} notas',
            duplicateNote: 'Duplicar nota',
            duplicateMultipleNotes: 'Duplicar {count} notas',
            openVersionHistory: 'Abrir historial de versiones',
            revealInFolder: 'Mostrar en carpeta',
            revealInFinder: 'Mostrar en Finder',
            showInExplorer: 'Mostrar en el explorador del sistema',
            copyDeepLink: 'Copiar URL de Obsidian',
            copyPath: 'Copiar ruta',
            copyRelativePath: 'Copiar ruta relativa',
            renameNote: 'Renombrar nota',
            deleteNote: 'Eliminar nota',
            deleteMultipleNotes: 'Eliminar {count} notas',
            moveToFolder: 'Mover a...',
            moveMultipleToFolder: 'Mover {count} archivos a...',
            addTag: 'Añadir etiqueta',
            removeTag: 'Eliminar etiqueta',
            removeAllTags: 'Eliminar todas las etiquetas',
            changeIcon: 'Cambiar icono',
            changeColor: 'Cambiar color',
            // File-specific context menu items (non-markdown files)
            openMultipleFilesInNewTabs: 'Abrir {count} archivos en nuevas pestañas',
            openMultipleFilesToRight: 'Abrir {count} archivos a la derecha',
            openMultipleFilesInNewWindows: 'Abrir {count} archivos en nuevas ventanas',
            pinFile: 'Fijar archivo',
            unpinFile: 'Desfijar archivo',
            pinMultipleFiles: 'Fijar {count} archivos',
            unpinMultipleFiles: 'Desfijar {count} archivos',
            duplicateFile: 'Duplicar archivo',
            duplicateMultipleFiles: 'Duplicar {count} archivos',
            renameFile: 'Renombrar archivo',
            deleteFile: 'Eliminar archivo',
            deleteMultipleFiles: 'Eliminar {count} archivos'
        },
        folder: {
            newNote: 'Nueva nota',
            newFolder: 'Nueva carpeta',
            newCanvas: 'Nuevo lienzo',
            newBase: 'Nueva base de datos',
            newDrawing: 'Nuevo dibujo',
            duplicateFolder: 'Duplicar carpeta',
            searchInFolder: 'Buscar en carpeta',
            createFolderNote: 'Crear nota de carpeta',
            deleteFolderNote: 'Eliminar nota de carpeta',
            changeIcon: 'Cambiar icono',
            changeColor: 'Cambiar color',
            changeBackground: 'Cambiar fondo',
            excludeFolder: 'Ocultar carpeta',
            moveFolder: 'Mover a...',
            renameFolder: 'Renombrar carpeta',
            deleteFolder: 'Eliminar carpeta'
        },
        tag: {
            changeIcon: 'Cambiar icono',
            changeColor: 'Cambiar color',
            changeBackground: 'Cambiar fondo',
            showTag: 'Mostrar etiqueta',
            hideTag: 'Ocultar etiqueta'
        }
    },

    // Folder appearance menu
    folderAppearance: {
        defaultPreset: 'Apariencia predeterminada',
        slimPreset: 'Compacto (sin fecha/vista previa/imagen)',
        titleRows: 'Filas de título',
        previewRows: 'Filas de vista previa',
        defaultOption: (rows: number) => `Predeterminado (${rows})`,
        defaultTitleOption: (rows: number) => `Filas de título predeterminadas (${rows})`,
        defaultPreviewOption: (rows: number) => `Filas de vista previa predeterminadas (${rows})`,
        titleRowOption: (rows: number) => `${rows} fila${rows === 1 ? '' : 's'} de título`,
        previewRowOption: (rows: number) => `${rows} fila${rows === 1 ? '' : 's'} de vista previa`
    },

    // Modal dialogs
    modals: {
        iconPicker: {
            searchPlaceholder: 'Buscar iconos...',
            recentlyUsedHeader: 'Usados recientemente',
            emptyStateSearch: 'Empieza a escribir para buscar iconos',
            emptyStateNoResults: 'No se encontraron iconos',
            showingResultsInfo: 'Mostrando 50 de {count} resultados. Escribe más para filtrar.',
            emojiInstructions: 'Escribe o pega cualquier emoji para usarlo como icono',
            removeIcon: 'Quitar icono'
        },
        colorPicker: {
            currentColor: 'Actual',
            newColor: 'Nuevo',
            presetColors: 'Colores predefinidos',
            recentColors: 'Colores recientes',
            clearRecentColors: 'Limpiar colores recientes',
            removeRecentColor: 'Eliminar color',
            removeColor: 'Quitar color',
            apply: 'Aplicar',
            hexLabel: 'HEX',
            rgbLabel: 'RGBA',
            colors: {
                red: 'Rojo',
                orange: 'Naranja',
                amber: 'Ámbar',
                yellow: 'Amarillo',
                lime: 'Lima',
                green: 'Verde',
                emerald: 'Esmeralda',
                teal: 'Verde azulado',
                cyan: 'Cian',
                sky: 'Cielo',
                blue: 'Azul',
                indigo: 'Índigo',
                violet: 'Violeta',
                purple: 'Púrpura',
                fuchsia: 'Fucsia',
                pink: 'Rosa',
                rose: 'Rosa claro',
                gray: 'Gris',
                slate: 'Pizarra',
                stone: 'Piedra'
            }
        },
        tagOperation: {
            renameTitle: 'Renombrar etiqueta',
            deleteTitle: 'Eliminar etiqueta',
            newTagPrompt: 'Introduce el nuevo nombre de la etiqueta:',
            newTagPlaceholder: 'nuevo-nombre',
            renameWarning: 'Esto renombrará la etiqueta en todas las notas afectadas.',
            deleteWarning: 'Esto eliminará la etiqueta de todas las notas afectadas.',
            modificationWarning: 'Modificación de etiqueta',
            affectedFiles: '{count} archivo(s) afectado(s)',
            andMore: 'y {count} más...',
            confirmRename: 'Renombrar etiqueta',
            confirmDelete: 'Eliminar etiqueta',
            file: 'archivo',
            files: 'archivos'
        },
        fileSystem: {
            newFolderTitle: 'Nueva carpeta',
            renameFolderTitle: 'Renombrar carpeta',
            renameFileTitle: 'Renombrar archivo',
            deleteFolderTitle: "¿Eliminar '{name}'?",
            deleteFileTitle: "¿Eliminar '{name}'?",
            folderNamePrompt: 'Introduce el nombre de la carpeta:',
            renamePrompt: 'Introduce el nuevo nombre:',
            renameVaultTitle: 'Cambiar nombre de visualización del vault',
            renameVaultPrompt: 'Introduce un nombre de visualización personalizado (deja vacío para usar el predeterminado):',
            deleteFolderConfirm: '¿Estás seguro de que quieres eliminar esta carpeta y todo su contenido?',
            deleteFileConfirm: '¿Estás seguro de que quieres eliminar este archivo?',
            removeAllTagsTitle: 'Eliminar todas las etiquetas',
            removeAllTagsFromNote: '¿Estás seguro de que quieres eliminar todas las etiquetas de esta nota?',
            removeAllTagsFromNotes: '¿Estás seguro de que quieres eliminar todas las etiquetas de {count} notas?'
        },
        folderSuggest: {
            placeholder: 'Mover a carpeta...',
            navigatePlaceholder: 'Navegar a carpeta...',
            instructions: {
                navigate: 'para navegar',
                move: 'para mover',
                select: 'para seleccionar',
                dismiss: 'para cancelar'
            }
        },
        homepage: {
            placeholder: 'Buscar archivos...',
            instructions: {
                navigate: 'para navegar',
                select: 'para definir página de inicio',
                dismiss: 'para cancelar'
            }
        },
        navigationBanner: {
            placeholder: 'Buscar imágenes...',
            instructions: {
                navigate: 'para navegar',
                select: 'para establecer banner',
                dismiss: 'para cancelar'
            }
        },
        tagSuggest: {
            placeholder: 'Buscar etiquetas...',
            navigatePlaceholder: 'Navegar a etiqueta...',
            addPlaceholder: 'Buscar etiqueta para añadir...',
            removePlaceholder: 'Seleccionar etiqueta para eliminar...',
            createNewTag: 'Crear nueva etiqueta: #{tag}',
            instructions: {
                navigate: 'para navegar',
                select: 'para seleccionar',
                dismiss: 'para cancelar',
                add: 'para añadir etiqueta',
                remove: 'para eliminar etiqueta'
            }
        }
    },

    // File system operations
    fileSystem: {
        errors: {
            createFolder: 'Error al crear la carpeta: {error}',
            createFile: 'Error al crear el archivo: {error}',
            renameFolder: 'Error al renombrar la carpeta: {error}',
            renameFolderNoteConflict: 'No se puede renombrar: "{name}" ya existe en esta carpeta',
            renameFile: 'Error al renombrar el archivo: {error}',
            deleteFolder: 'Error al eliminar la carpeta: {error}',
            deleteFile: 'Error al eliminar el archivo: {error}',
            duplicateNote: 'Error al duplicar la nota: {error}',
            createCanvas: 'Error al crear el lienzo: {error}',
            createDatabase: 'Error al crear la base de datos: {error}',
            duplicateFolder: 'Error al duplicar la carpeta: {error}',
            openVersionHistory: 'Error al abrir el historial de versiones: {error}',
            versionHistoryNotFound: 'Comando de historial de versiones no encontrado. Asegúrate de que Obsidian Sync esté habilitado.',
            revealInExplorer: 'Error al mostrar el archivo en el explorador del sistema: {error}',
            folderNoteAlreadyExists: 'La nota de carpeta ya existe',
            folderAlreadyExists: 'La carpeta "{name}" ya existe',
            folderNotesDisabled: 'Habilite las notas de carpeta en la configuración para convertir archivos',
            folderNoteAlreadyLinked: 'Este archivo ya funciona como una nota de carpeta',
            folderNoteUnsupportedExtension: 'Extensión de archivo no compatible: {extension}',
            folderNoteMoveFailed: 'No se pudo mover el archivo durante la conversión: {error}',
            folderNoteRenameConflict: 'Ya existe un archivo llamado "{name}" en la carpeta',
            folderNoteConversionFailed: 'No se pudo convertir el archivo en nota de carpeta',
            folderNoteConversionFailedWithReason: 'No se pudo convertir el archivo en nota de carpeta: {error}',
            folderNoteOpenFailed: 'Archivo convertido pero no se pudo abrir la nota de carpeta: {error}',
            failedToDeleteFile: 'Error al eliminar {name}: {error}',
            failedToDeleteMultipleFiles: 'Error al eliminar {count} archivos',
            versionHistoryNotAvailable: 'Servicio de historial de versiones no disponible',
            drawingAlreadyExists: 'Ya existe un dibujo con este nombre',
            failedToCreateDrawing: 'Error al crear el dibujo',
            noFolderSelected: 'No hay ninguna carpeta seleccionada en Notebook Navigator',
            noFileSelected: 'No hay archivo seleccionado'
        },
        notices: {
            excludedFolder: 'Carpeta excluida: {name}'
        },
        notifications: {
            deletedMultipleFiles: '{count} archivos eliminados',
            movedMultipleFiles: '{count} archivos movidos a {folder}',
            folderNoteConversionSuccess: 'Archivo convertido en nota de carpeta en "{name}"',
            folderMoved: 'Carpeta "{name}" movida',
            deepLinkCopied: 'URL de Obsidian copiada al portapapeles',
            pathCopied: 'Ruta copiada al portapapeles',
            relativePathCopied: 'Ruta relativa copiada al portapapeles',
            tagAddedToNote: 'Etiqueta añadida a 1 nota',
            tagAddedToNotes: 'Etiqueta añadida a {count} notas',
            tagRemovedFromNote: 'Etiqueta eliminada de 1 nota',
            tagRemovedFromNotes: 'Etiqueta eliminada de {count} notas',
            tagsClearedFromNote: 'Todas las etiquetas eliminadas de 1 nota',
            tagsClearedFromNotes: 'Todas las etiquetas eliminadas de {count} notas',
            noTagsToRemove: 'No hay etiquetas para eliminar',
            noFilesSelected: 'No hay archivos seleccionados',
            tagOperationsNotAvailable: 'Operaciones de etiquetas no disponibles',
            tagsRequireMarkdown: 'Las etiquetas solo son compatibles con notas Markdown',
            iconPackDownloaded: '{provider} descargado',
            iconPackUpdated: '{provider} actualizado ({version})',
            iconPackRemoved: '{provider} eliminado',
            iconPackLoadFailed: 'No se pudo cargar {provider}'
        },
        confirmations: {
            deleteMultipleFiles: '¿Está seguro de que desea eliminar {count} archivos?',
            deleteConfirmation: 'Esta acción no se puede deshacer.'
        },
        defaultNames: {
            untitled: 'Sin título',
            untitledNumber: 'Sin título {number}'
        }
    },

    // Drag and drop operations
    dragDrop: {
        errors: {
            cannotMoveIntoSelf: 'No se puede mover una carpeta dentro de sí misma o una subcarpeta.',
            itemAlreadyExists: 'Ya existe un elemento llamado "{name}" en esta ubicación.',
            failedToMove: 'Error al mover: {error}',
            failedToAddTag: 'Error al agregar la etiqueta "{tag}"',
            failedToClearTags: 'Error al eliminar las etiquetas',
            failedToMoveFolder: 'Error al mover la carpeta "{name}"',
            failedToImportFiles: 'Failed to import: {names}'
        },
        notifications: {
            filesAlreadyExist: '{count} archivos ya existen en el destino',
            addedTag: 'Etiqueta "{tag}" agregada a {count} archivos',
            filesAlreadyHaveTag: '{count} archivos ya tienen esta etiqueta o una más específica',
            clearedTags: 'Se eliminaron todas las etiquetas de {count} archivos',
            noTagsToClear: 'No hay etiquetas para eliminar',
            fileImported: 'Imported 1 file',
            filesImported: 'Imported {count} files'
        }
    },

    // Date grouping
    dateGroups: {
        today: 'Hoy',
        yesterday: 'Ayer',
        previous7Days: 'Últimos 7 días',
        previous30Days: 'Últimos 30 días'
    },

    // Weekdays
    weekdays: {
        sunday: 'Domingo',
        monday: 'Lunes',
        tuesday: 'Martes',
        wednesday: 'Miércoles',
        thursday: 'Jueves',
        friday: 'Viernes',
        saturday: 'Sábado'
    },

    // Plugin commands
    commands: {
        open: 'Abrir', // Command palette: Opens the Notebook Navigator view (English: Open)
        openHomepage: 'Abrir página de inicio', // Command palette: Opens the Notebook Navigator view and loads the homepage file (English: Open homepage)
        revealFile: 'Revelar archivo', // Command palette: Reveals and selects the currently active file in the navigator (English: Reveal file)
        search: 'Buscar', // Command palette: Toggle search in the file list (English: Search)
        toggleDualPane: 'Alternar diseño de doble panel', // Command palette: Toggles between single-pane and dual-pane layout (English: Toggle dual pane layout)
        deleteFile: 'Eliminar archivos', // Command palette: Deletes the currently active file (English: Delete file)
        createNewNote: 'Crear nueva nota', // Command palette: Creates a new note in the currently selected folder (English: Create new note)
        moveFiles: 'Mover archivos', // Command palette: Move selected files to another folder (English: Move files)
        convertToFolderNote: 'Convertir en nota de carpeta', // Command palette: Converts the active file into a folder note with a new folder (English: Convert to folder note)
        navigateToFolder: 'Navegar a carpeta', // Command palette: Navigate to a folder using fuzzy search (English: Navigate to folder)
        navigateToTag: 'Navegar a etiqueta', // Command palette: Navigate to a tag using fuzzy search (English: Navigate to tag)
        addShortcut: 'Agregar a accesos directos', // Command palette: Adds the current file, folder, or tag to shortcuts (English: Add to shortcuts)
        toggleDescendants: 'Alternar descendientes', // Command palette: Toggles showing notes from descendants (English: Toggle descendants)
        toggleHidden: 'Alternar elementos ocultos', // Command palette: Toggles showing hidden items (English: Toggle hidden items)
        collapseExpand: 'Contraer / expandir todos los elementos', // Command palette: Collapse or expand all folders and tags (English: Collapse / expand all items)
        addTag: 'Añadir etiqueta a archivos seleccionados', // Command palette: Opens a dialog to add a tag to selected files (English: Add tag to selected files)
        removeTag: 'Eliminar etiqueta de archivos seleccionados', // Command palette: Opens a dialog to remove a tag from selected files (English: Remove tag from selected files)
        removeAllTags: 'Eliminar todas las etiquetas de archivos seleccionados', // Command palette: Removes all tags from selected files (English: Remove all tags from selected files)
        rebuildCache: 'Reconstruir caché' // Command palette: Rebuilds the local Notebook Navigator cache (English: Rebuild cache)
    },

    // Plugin UI
    plugin: {
        viewName: 'Navegador de Cuadernos', // Name shown in the view header/tab (English: Notebook Navigator)
        ribbonTooltip: 'Navegador de Cuadernos', // Tooltip for the ribbon icon in the left sidebar (English: Notebook Navigator)
        revealInNavigator: 'Mostrar en el Navegador de Cuadernos' // Context menu item to reveal a file in the navigator (English: Reveal in Notebook Navigator)
    },

    // Tooltips
    tooltips: {
        lastModifiedAt: 'Última modificación',
        createdAt: 'Creado el',
        file: 'archivo',
        files: 'archivos',
        folder: 'carpeta',
        folders: 'carpetas'
    },

    // Settings
    settings: {
        metadataReport: {
            exportSuccess: 'Informe de metadatos fallidos exportado a: {filename}',
            exportFailed: 'Error al exportar el informe de metadatos'
        },
        sections: {
            general: 'General',
            notes: 'Visualización de notas',
            navigationPane: 'Visualización de carpetas',
            icons: 'Paquetes de iconos',
            tags: 'Visualización de etiquetas',
            folders: 'Notas de carpeta',
            search: 'Buscar',
            listPane: 'Panel de lista',
            hotkeys: 'Atajos de teclado',
            advanced: 'Avanzado'
        },
        groups: {
            general: {
                view: 'Apariencia',
                behavior: 'Comportamiento',
                filtering: 'Filtrado',
                formatting: 'Formato'
            },
            navigation: {
                behavior: 'Comportamiento',
                appearance: 'Apariencia'
            },
            list: {
                display: 'Apariencia',
                quickActions: 'Acciones rápidas'
            },
            notes: {
                frontmatter: 'Frontmatter',
                display: 'Apariencia'
            }
        },
        items: {
            searchProvider: {
                name: 'Proveedor de búsqueda',
                desc: 'Elija entre búsqueda rápida de nombres de archivo o búsqueda de texto completo con el plugin Omnisearch.',
                options: {
                    internal: 'Búsqueda por filtro',
                    omnisearch: 'Omnisearch (texto completo)'
                },
                info: {
                    filterSearch: {
                        title: 'Búsqueda por filtro (predeterminado):',
                        description:
                            'Búsqueda rápida y ligera que filtra archivos por nombre y etiquetas dentro de la carpeta actual y subcarpetas. Admite filtrado de etiquetas con prefijo # (ej. #proyecto), exclusión con prefijo ! (ej. !borrador, !#archivado), y búsqueda de notas sin etiquetas con !#. Ideal para navegación rápida dentro de su contexto actual.'
                    },
                    omnisearch: {
                        title: 'Omnisearch:',
                        description:
                            'Búsqueda de texto completo que busca en toda su bóveda, luego filtra los resultados para mostrar solo archivos de la carpeta actual, subcarpetas o etiquetas seleccionadas. Requiere que el plugin Omnisearch esté instalado - si no está disponible, la búsqueda volverá automáticamente a la búsqueda por filtro.',
                        warningNotInstalled: 'El plugin Omnisearch no está instalado. Se usa la búsqueda por filtro.',
                        limitations: {
                            title: 'Limitaciones conocidas:',
                            performance: 'Rendimiento: Puede ser lento, especialmente al buscar menos de 3 caracteres en bóvedas grandes',
                            pathBug:
                                'Error de ruta: No puede buscar en rutas con caracteres no ASCII y no busca correctamente en subrutas, afectando qué archivos aparecen en los resultados de búsqueda',
                            limitedResults:
                                'Resultados limitados: Como Omnisearch busca en toda la bóveda y devuelve un número limitado de resultados antes del filtrado, los archivos relevantes de su carpeta actual pueden no aparecer si existen demasiadas coincidencias en otro lugar de la bóveda',
                            previewText:
                                'Texto de vista previa: Las vistas previas de notas se reemplazan con extractos de resultados de Omnisearch, que pueden no mostrar el resaltado real de la coincidencia de búsqueda si aparece en otro lugar del archivo'
                        }
                    }
                }
            },
            listPaneTitle: {
                name: 'Título del panel de lista',
                desc: 'Elige dónde se muestra el título del panel de lista.',
                options: {
                    header: 'Mostrar en el encabezado',
                    list: 'Mostrar en el panel de lista',
                    hidden: 'No mostrar'
                }
            },
            sortNotesBy: {
                name: 'Ordenar notas por',
                desc: 'Elige cómo se ordenan las notas en la lista de notas.',
                options: {
                    'modified-desc': 'Fecha de edición (más reciente arriba)',
                    'modified-asc': 'Fecha de edición (más antigua arriba)',
                    'created-desc': 'Fecha de creación (más reciente arriba)',
                    'created-asc': 'Fecha de creación (más antigua arriba)',
                    'title-asc': 'Título (A arriba)',
                    'title-desc': 'Título (Z arriba)'
                }
            },
            includeDescendantNotes: {
                name: 'Mostrar notas de subcarpetas / descendientes',
                desc: 'Incluir notas de subcarpetas y descendientes de etiquetas al ver una carpeta o etiqueta.'
            },
            separateNoteCounts: {
                name: 'Mostrar conteos actuales y descendientes por separado',
                desc: 'Muestra el conteo de notas como formato "actual ▾ descendientes" en carpetas y etiquetas.'
            },
            groupByDate: {
                name: 'Agrupar notas por fecha',
                desc: 'Cuando se ordena por fecha, agrupa las notas bajo encabezados de fecha.'
            },
            optimizeNoteHeight: {
                name: 'Optimizar altura de notas',
                desc: 'Reducir altura para notas ancladas y notas sin texto de vista previa.'
            },
            showParentFolderNames: {
                name: 'Mostrar nombres de carpetas principales',
                desc: 'Muestra el nombre de la carpeta principal para las notas en subcarpetas o etiquetas.'
            },
            showQuickActions: {
                name: 'Mostrar acciones rápidas (solo escritorio)',
                desc: 'Mostrar acciones al pasar el cursor sobre los elementos de archivo.'
            },
            quickActionsRevealInFolder: {
                name: 'Revelar en carpeta',
                desc: 'Acción rápida: Revelar nota en su carpeta principal. Solo visible al ver notas de subcarpetas o en etiquetas (no se muestra en la carpeta real de la nota).'
            },
            quickActionsPinNote: {
                name: 'Fijar nota',
                desc: 'Acción rápida: Fijar o desfijar nota en la parte superior de la lista.'
            },
            quickActionsOpenInNewTab: {
                name: 'Abrir en nueva pestaña',
                desc: 'Acción rápida: Abrir nota en nueva pestaña.'
            },
            dualPane: {
                name: 'Diseño de doble panel (solo escritorio, no sincronizado)',
                desc: 'Mostrar panel de navegación y panel de lista lado a lado en escritorio.'
            },
            startView: {
                name: 'Vista de inicio predeterminada',
                desc: 'Elige qué panel mostrar al abrir Notebook Navigator. El panel de navegación muestra los accesos directos, las notas recientes y la estructura de carpetas. El panel de lista muestra la lista de notas en pantalla.',
                options: {
                    navigation: 'Panel de navegación',
                    files: 'Panel de lista'
                }
            },
            autoRevealActiveNote: {
                name: 'Mostrar automáticamente la nota activa',
                desc: 'Muestra automáticamente las notas cuando se abren desde el Conmutador rápido, enlaces o búsqueda.'
            },
            autoRevealIgnoreRightSidebar: {
                name: 'Ignorar eventos de la barra lateral derecha',
                desc: 'No cambiar la nota activa al hacer clic o cambiar notas en la barra lateral derecha.'
            },
            autoSelectFirstFileOnFocusChange: {
                name: 'Seleccionar automáticamente la primera nota (solo escritorio)',
                desc: 'Abre automáticamente la primera nota al cambiar de carpeta o etiqueta.'
            },
            autoExpandFoldersTags: {
                name: 'Expandir carpetas y etiquetas automáticamente',
                desc: 'Expandir automáticamente carpetas y etiquetas cuando se seleccionan.'
            },
            navigationBanner: {
                name: 'Banner de navegación',
                desc: 'Mostrar una imagen encima del panel de navegación.',
                current: 'Banner actual: {path}',
                chooseButton: 'Elegir imagen',
                clearButton: 'Limpiar'
            },
            showShortcuts: {
                name: 'Mostrar accesos directos',
                desc: 'Mostrar la sección de accesos directos en el panel de navegación.'
            },
            showRecentNotes: {
                name: 'Mostrar notas recientes',
                desc: 'Mostrar la sección de notas recientes en el panel de navegación.'
            },
            recentNotesCount: {
                name: 'Cantidad de notas recientes',
                desc: 'Número de notas recientes a mostrar.'
            },
            showTooltips: {
                name: 'Mostrar tooltips (solo escritorio)',
                desc: 'Muestra tooltips con información adicional para notas y carpetas al pasar el cursor.'
            },
            showTooltipPath: {
                name: 'Mostrar ruta',
                desc: 'Muestra la ruta de la carpeta debajo del nombre de las notas en los tooltips.'
            },
            multiSelectModifier: {
                name: 'Modificador de selección múltiple',
                desc: 'Elige qué tecla modificadora activa la selección múltiple. Cuando se selecciona Option/Alt, Cmd/Ctrl clic abre notas en una nueva pestaña.',
                options: {
                    cmdCtrl: 'Cmd/Ctrl clic',
                    optionAlt: 'Option/Alt clic'
                }
            },
            excludedNotes: {
                name: 'Ocultar notas',
                desc: 'Lista de propiedades del frontmatter separadas por comas. Las notas que contengan cualquiera de estas propiedades se ocultarán (ej.: draft, private, archived).',
                placeholder: 'draft, private'
            },
            excludedFolders: {
                name: 'Ocultar carpetas',
                desc: 'Lista de carpetas a ocultar separadas por comas. Patrones de nombre: assets* (carpetas que comienzan con assets), *_temp (terminan con _temp). Patrones de ruta: /archive (solo archivo raíz), /res* (carpetas raíz que comienzan con res), /*/temp (carpetas temp un nivel abajo), /projects/* (todas las carpetas dentro de projects).',
                placeholder: 'templates, assets*, /archive, /res*'
            },
            fileVisibility: {
                name: 'Mostrar tipos de archivo',
                desc: 'Filtre qué tipos de archivo se muestran en el navegador. Los tipos de archivo no soportados por Obsidian pueden abrirse en aplicaciones externas.',
                options: {
                    documents: 'Documentos (.md, .canvas, .base)',
                    supported: 'Soportados (abre en Obsidian)',
                    all: 'Todos (puede abrir externamente)'
                }
            },
            homepage: {
                name: 'Página de inicio',
                desc: 'Selecciona el archivo que Notebook Navigator abre automáticamente, como un panel.',
                current: 'Actual: {path}',
                currentMobile: 'Móvil: {path}',
                chooseButton: 'Elegir archivo',
                clearButton: 'Limpiar',
                separateMobile: {
                    name: 'Página de inicio móvil separada',
                    desc: 'Usar una página de inicio diferente en dispositivos móviles.'
                }
            },
            showFileDate: {
                name: 'Mostrar fecha',
                desc: 'Muestra la fecha debajo de los nombres de las notas.'
            },
            showFileTags: {
                name: 'Mostrar etiquetas de archivo',
                desc: 'Muestra etiquetas clicables en los elementos de archivo. Use colores de etiquetas para distinguir visualmente diferentes tipos de etiquetas.'
            },
            showFileTagAncestors: {
                name: 'Mostrar etiquetas padre',
                desc: 'Mostrar segmentos padre antes del nombre de la etiqueta.'
            },
            colorFileTags: {
                name: 'Colorear etiquetas de archivo',
                desc: 'Aplicar colores de etiquetas a las insignias de etiquetas en elementos de archivo.'
            },
            showFileTagsInSlimMode: {
                name: 'Mostrar etiquetas de archivo en modo compacto',
                desc: 'Mostrar etiquetas cuando la fecha, vista previa e imagen están ocultas.'
            },
            dateFormat: {
                name: 'Formato de fecha',
                desc: 'Formato para mostrar fechas (usa formato date-fns).',
                placeholder: "d 'de' MMMM 'de' yyyy",
                help: "Formatos comunes:\nd 'de' MMMM 'de' yyyy = 25 de mayo de 2022\ndd/MM/yyyy = 25/05/2022\nyyyy-MM-dd = 2022-05-25\n\nTokens:\nyyyy/yy = año\nMMMM/MMM/MM = mes\ndd/d = día\nEEEE/EEE = día de la semana",
                helpTooltip: 'Clic para referencia de formato'
            },
            timeFormat: {
                name: 'Formato de hora',
                desc: 'Formato para mostrar horas (usa formato date-fns).',
                placeholder: 'HH:mm',
                help: 'Formatos comunes:\nHH:mm = 14:30 (24 horas)\nh:mm a = 2:30 PM (12 horas)\nHH:mm:ss = 14:30:45\nh:mm:ss a = 2:30:45 PM\n\nTokens:\nHH/H = 24 horas\nhh/h = 12 horas\nmm = minutos\nss = segundos\na = AM/PM',
                helpTooltip: 'Clic para referencia de formato'
            },
            showFilePreview: {
                name: 'Mostrar vista previa de nota (*)',
                desc: 'Muestra texto de vista previa debajo de los nombres de las notas.'
            },
            skipHeadingsInPreview: {
                name: 'Omitir encabezados en vista previa',
                desc: 'Omite las líneas de encabezado al generar el texto de vista previa.'
            },
            skipCodeBlocksInPreview: {
                name: 'Omitir bloques de código en vista previa',
                desc: 'Omite los bloques de código al generar el texto de vista previa.'
            },
            previewProperties: {
                name: 'Propiedades de vista previa',
                desc: 'Lista separada por comas de propiedades de frontmatter para buscar texto de vista previa. Se usará la primera propiedad con texto.',
                placeholder: 'resumen, descripción, abstracto',
                info: 'Si no se encuentra texto de vista previa en las propiedades especificadas, la vista previa se generará a partir del contenido de la nota.'
            },
            previewRows: {
                name: 'Filas de vista previa',
                desc: 'Número de filas a mostrar para el texto de vista previa.',
                options: {
                    '1': '1 fila',
                    '2': '2 filas',
                    '3': '3 filas',
                    '4': '4 filas',
                    '5': '5 filas'
                }
            },
            fileNameRows: {
                name: 'Filas de título',
                desc: 'Número de filas a mostrar para los títulos de las notas.',
                options: {
                    '1': '1 fila',
                    '2': '2 filas'
                }
            },
            showFeatureImage: {
                name: 'Mostrar imagen destacada (*)',
                desc: 'Muestra imágenes en miniatura desde el frontmatter. Consejo: Usa el plugin "Featured Image" para establecer automáticamente imágenes destacadas para todos tus documentos.'
            },
            forceSquareFeatureImage: {
                name: 'Forzar imagen destacada cuadrada',
                desc: 'Renderizar imágenes destacadas como miniaturas cuadradas.'
            },
            featureImageProperties: {
                name: 'Propiedades de imagen',
                desc: 'Lista separada por comas de propiedades del frontmatter para imágenes en miniatura. Se usará la primera propiedad con una imagen. Si está vacía y la configuración de respaldo está habilitada, se usará la primera imagen incrustada.',
                placeholder: 'thumbnail, featureResized, feature'
            },
            useEmbeddedImageFallback: {
                name: 'Usar imagen incrustada como alternativa',
                desc: 'Usa la primera imagen incrustada en el documento como alternativa cuando no se encuentre ninguna miniatura en las propiedades del frontmatter (requiere Obsidian 1.9.4+). Desactívalo para verificar que las miniaturas estén configuradas correctamente.'
            },
            showRootFolder: {
                name: 'Mostrar carpeta raíz',
                desc: 'Muestra el nombre de la carpeta raíz en el árbol.'
            },
            inheritFolderColors: {
                name: 'Heredar colores de carpeta',
                desc: 'Las subcarpetas heredan el color de las carpetas principales.'
            },
            showNoteCount: {
                name: 'Mostrar conteo de notas',
                desc: 'Muestra el número de notas junto a cada carpeta y etiqueta.'
            },
            showIcons: {
                name: 'Mostrar iconos',
                desc: 'Muestra iconos para carpetas, etiquetas y notas.'
            },
            showIconsColorOnly: {
                name: 'Aplicar color solo a los iconos',
                desc: 'Cuando está habilitado, los colores personalizados se aplican solo a los iconos. Cuando está deshabilitado, los colores se aplican tanto a los iconos como a las etiquetas de texto.'
            },
            collapseBehavior: {
                name: 'Contraer elementos',
                desc: 'Elige qué afecta el botón de expandir/contraer todo.',
                options: {
                    all: 'Todas las carpetas y etiquetas',
                    foldersOnly: 'Solo carpetas',
                    tagsOnly: 'Solo etiquetas'
                }
            },
            smartCollapse: {
                name: 'Mantener elemento seleccionado expandido',
                desc: 'Al contraer, mantiene la carpeta o etiqueta seleccionada actualmente y sus elementos principales expandidos.'
            },
            navIndent: {
                name: 'Sangría del árbol',
                desc: 'Ajustar el ancho de sangría para carpetas y etiquetas anidadas.'
            },
            navItemHeight: {
                name: 'Altura de línea',
                desc: 'Ajustar la altura de las carpetas y etiquetas en el panel de navegación.'
            },
            navItemHeightScaleText: {
                name: 'Escalar texto con la altura de línea',
                desc: 'Reduce el texto de navegación cuando la altura de línea se disminuye.'
            },
            showTags: {
                name: 'Mostrar etiquetas (*)',
                desc: 'Muestra la sección de etiquetas debajo de las carpetas en el navegador.'
            },
            tagSortOrder: {
                name: 'Orden de etiquetas',
                desc: 'Elige cómo se ordenan las etiquetas en el panel de navegación.',
                options: {
                    alphaAsc: 'A a Z',
                    alphaDesc: 'Z a A',
                    frequencyAsc: 'Frecuencia (baja a alta)',
                    frequencyDesc: 'Frecuencia (alta a baja)'
                }
            },
            showAllTagsFolder: {
                name: 'Mostrar carpeta de etiquetas',
                desc: 'Muestra "Etiquetas" como una carpeta plegable.'
            },
            showUntagged: {
                name: 'Mostrar notas sin etiquetas',
                desc: 'Muestra el elemento "Sin etiquetas" para notas sin ninguna etiqueta.'
            },
            hiddenTags: {
                name: 'Etiquetas ocultas',
                desc: 'Lista separada por comas de prefijos de etiquetas o comodines de nombre. Usa `tag*` o `*tag` para coincidir con nombres de etiquetas. Ocultar una etiqueta también oculta todas sus sub-etiquetas (ej. "archivo" oculta "archivo/2024/docs").',
                placeholder: 'interno, temp/borradores, archivo/2024'
            },
            enableFolderNotes: {
                name: 'Habilitar notas de carpeta',
                desc: 'Cuando está habilitado, las carpetas con notas asociadas se muestran como enlaces clicables.'
            },
            folderNoteType: {
                name: 'Tipo predeterminado de nota de carpeta',
                desc: 'Tipo de nota de carpeta creado desde el menú contextual.',
                options: {
                    markdown: 'Markdown',
                    canvas: 'Canvas',
                    base: 'Base'
                }
            },
            folderNoteName: {
                name: 'Nombre de la nota de carpeta',
                desc: 'Nombre de la nota de carpeta. Dejar vacío para usar el mismo nombre que la carpeta.',
                placeholder: 'Dejar vacío para el nombre de la carpeta'
            },
            folderNoteProperties: {
                name: 'Propiedades de nota de carpeta',
                desc: 'Propiedades frontmatter para agregar a las notas de carpeta recién creadas (separadas por comas).',
                placeholder: 'foldernote, darktheme'
            },
            hideFolderNoteInList: {
                name: 'Ocultar notas de carpeta en la lista',
                desc: 'Ocultar la nota de carpeta para que no aparezca en la lista de notas de la carpeta.'
            },
            pinCreatedFolderNote: {
                name: 'Anclar notas de carpeta creadas',
                desc: 'Anclar automáticamente las notas de carpeta cuando se crean desde el menú contextual.'
            },
            confirmBeforeDelete: {
                name: 'Confirmar antes de eliminar',
                desc: 'Muestra un diálogo de confirmación al eliminar notas o carpetas'
            },
            metadataCleanup: {
                name: 'Limpiar metadatos',
                desc: 'Elimina metadatos huérfanos dejados cuando archivos, carpetas o etiquetas son eliminados, movidos o renombrados fuera de Obsidian. Esto solo afecta el archivo de configuración de Notebook Navigator.',
                buttonText: 'Limpiar metadatos',
                error: 'Falló la limpieza de configuración',
                loading: 'Verificando metadatos...',
                statusClean: 'No hay metadatos para limpiar',
                statusCounts: 'Elementos huérfanos: {folders} carpetas, {tags} etiquetas, {files} archivos, {pinned} fijados'
            },
            rebuildCache: {
                name: 'Reconstruir caché',
                desc: 'Úselo si faltan etiquetas, las vistas previas son incorrectas o faltan imágenes. Esto puede ocurrir después de conflictos de sincronización o cierres inesperados.',
                buttonText: 'Reconstruir caché',
                success: 'Caché reconstruido',
                error: 'Error al reconstruir caché'
            },
            hotkeys: {
                intro: 'Edita <plugin folder>/notebook-navigator/data.json para personalizar los atajos de Notebook Navigator. Abre el archivo y busca la sección "keyboardShortcuts". Cada entrada usa esta estructura:',
                example: '"pane:move-up": [ { "key": "ArrowUp", "modifiers": [] }, { "key": "K", "modifiers": [] } ]',
                modifierList: [
                    '"Mod" = Cmd (macOS) / Ctrl (Win/Linux)',
                    '"Alt" = Alt/Opción',
                    '"Shift" = Mayús',
                    '"Ctrl" = Control (prefiere "Mod" para multiplataforma)'
                ],
                guidance:
                    'Añade varias asignaciones para admitir teclas alternativas como ArrowUp y K mostradas arriba. Combina modificadores en una misma entrada indicando cada valor, por ejemplo "modifiers": ["Mod", "Shift"]. Las secuencias de teclado como "gg" o "dd" no están disponibles. Recarga Obsidian después de editar el archivo.'
            },
            externalIcons: {
                downloadButton: 'Descargar',
                downloadingLabel: 'Descargando...',
                removeButton: 'Eliminar',
                statusInstalled: 'Descargado (versión {version})',
                statusNotInstalled: 'No descargado',
                versionUnknown: 'desconocida',
                downloadFailed: 'Error al descargar {name}. Verifica tu conexión e intenta nuevamente.',
                removeFailed: 'Error al eliminar {name}.',
                infoNote:
                    'Los paquetes de iconos descargados sincronizan el estado de instalación entre dispositivos. Los paquetes de iconos permanecen en la base de datos local en cada dispositivo; la sincronización solo rastrea si deben descargarse o eliminarse. Los paquetes de iconos se descargan del repositorio de Notebook Navigator (https://github.com/johansan/notebook-navigator/tree/main/icon-assets).',
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
                name: 'Leer metadatos del frontmatter (*)',
                desc: 'Leer nombres de notas, marcas de tiempo, iconos y colores del frontmatter cuando estén disponibles, usando valores del sistema o ajustes como respaldo'
            },
            frontmatterNameField: {
                name: 'Campo de nombre',
                desc: 'Campo del frontmatter para usar como nombre de la nota. Dejar vacío para usar el nombre del archivo.',
                placeholder: 'título'
            },
            frontmatterIconField: {
                name: 'Campo de icono',
                desc: 'Campo del frontmatter para iconos de archivo. Dejar vacío para usar iconos guardados en los ajustes.',
                placeholder: 'icon'
            },
            frontmatterColorField: {
                name: 'Campo de color',
                desc: 'Campo del frontmatter para colores de archivo. Dejar vacío para usar colores guardados en los ajustes.',
                placeholder: 'color'
            },
            frontmatterSaveMetadata: {
                name: 'Guardar iconos y colores en el frontmatter',
                desc: 'Escribe automáticamente los iconos y colores de archivo en el frontmatter usando los campos configurados arriba.'
            },
            frontmatterIconizeFormat: {
                name: 'Guardar en formato Iconize',
                desc: 'Guarda iconos usando el formato Iconize (ej. LiHome, FasUser, SiGithub) en lugar del formato del plugin (ej. home, fontawesome-solid:user, simple-icons:github).'
            },
            frontmatterMigration: {
                name: 'Migrar iconos y colores desde los ajustes',
                desc: 'Guardado en los ajustes: {icons} iconos, {colors} colores.',
                button: 'Migrar',
                buttonWorking: 'Migrando...',
                noticeNone: 'No hay iconos ni colores de archivo almacenados en los ajustes.',
                noticeDone: 'Migrados {migratedIcons}/{icons} iconos, {migratedColors}/{colors} colores.',
                noticeFailures: 'Entradas con errores: {failures}.',
                noticeError: 'Migración fallida. Revisa la consola para más detalles.'
            },
            frontmatterCreatedField: {
                name: 'Campo de marca de tiempo de creación',
                desc: 'Nombre del campo del frontmatter para la marca de tiempo de creación. Dejar vacío para usar solo la fecha del sistema.',
                placeholder: 'creado'
            },
            frontmatterModifiedField: {
                name: 'Campo de marca de tiempo de modificación',
                desc: 'Nombre del campo del frontmatter para la marca de tiempo de modificación. Dejar vacío para usar solo la fecha del sistema.',
                placeholder: 'modificado'
            },
            frontmatterDateFormat: {
                name: 'Formato de marca de tiempo',
                desc: 'Formato utilizado para analizar marcas de tiempo en el frontmatter. Dejar vacío para usar formato ISO 8601',
                helpTooltip: 'Ver documentación de formato date-fns',
                help: "Formatos comunes:\nyyyy-MM-dd'T'HH:mm:ss → 2025-01-04T14:30:45\ndd/MM/yyyy HH:mm:ss → 04/01/2025 14:30:45\nMM/dd/yyyy h:mm:ss a → 01/04/2025 2:30:45 PM"
            },
            supportDevelopment: {
                name: 'Apoyar el desarrollo',
                desc: 'Si te encanta usar el Navegador de Cuadernos, considera apoyar su desarrollo continuo.',
                buttonText: '❤️ Patrocinar',
                coffeeButton: '☕️ Invítame un café'
            },
            updateCheckOnStart: {
                name: 'Buscar nueva versión al iniciar',
                desc: 'Busca nuevas versiones del complemento al iniciar y muestra una notificación cuando hay una actualización disponible. Cada versión se anuncia solo una vez, y las comprobaciones se realizan como máximo una vez al día.',
                status: 'New version available: {version}'
            },
            whatsNew: {
                name: 'Novedades',
                desc: 'Ver actualizaciones y mejoras recientes',
                buttonText: 'Ver actualizaciones recientes'
            },
            cacheStatistics: {
                localCache: '(*) Caché local',
                items: 'elementos',
                withTags: 'con etiquetas',
                withPreviewText: 'con texto de vista previa',
                withFeatureImage: 'con imagen destacada',
                withMetadata: 'con metadatos'
            },
            metadataInfo: {
                successfullyParsed: 'Analizados correctamente',
                itemsWithName: 'elementos con nombre',
                withCreatedDate: 'con fecha de creación',
                withModifiedDate: 'con fecha de modificación',
                withIcon: 'con icono',
                withColor: 'con color',
                failedToParse: 'Error al analizar',
                createdDates: 'fechas de creación',
                modifiedDates: 'fechas de modificación',
                checkTimestampFormat: 'Verifica el formato de marca de tiempo.',
                exportFailed: 'Exportar errores'
            }
        }
    },
    whatsNew: {
        title: 'Novedades en Notebook Navigator',
        supportMessage: 'Si encuentras útil Notebook Navigator, considera apoyar su desarrollo.',
        supportButton: 'Invítame a un café',
        thanksButton: '¡Gracias!'
    }
};
