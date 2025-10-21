import { App, setIcon } from 'obsidian';
import { ItemType } from '../types';
import { getDBInstance } from '../storage/fileOperations';
import { getIconService } from '../services/icons';

/**
 * Supported item types for drag ghost visualization
 */
export type DragGhostItemType = (typeof ItemType)[keyof typeof ItemType] | 'search';

/**
 * Configuration options for creating a drag ghost
 */
export interface DragGhostOptions {
    itemType: DragGhostItemType | null;
    path?: string;
    itemCount?: number;
    icon?: string;
    iconColor?: string;
}

/**
 * Interface for managing drag ghost display during drag operations
 */
export interface DragGhostManager {
    showGhost: (event: DragEvent, options: DragGhostOptions) => void;
    hideGhost: () => void;
    hideNativePreview: (event: DragEvent) => void;
    hasGhost: () => boolean;
}

/**
 * Creates a drag ghost manager that displays custom drag previews.
 * Shows icons, images, or badges depending on the dragged content.
 */
export function createDragGhostManager(app: App): DragGhostManager {
    let dragGhostElement: HTMLElement | null = null;
    let windowDragEndHandler: ((event: DragEvent) => void) | null = null;
    let windowDropHandler: ((event: DragEvent) => void) | null = null;

    /**
     * Updates the ghost element position to follow the cursor
     */
    const updateDragGhostPosition = (event: MouseEvent | DragEvent) => {
        if (!dragGhostElement) {
            return;
        }
        dragGhostElement.style.left = `${event.clientX + 10}px`;
        dragGhostElement.style.top = `${event.clientY + 10}px`;
    };
    // Options for mousemove event listener to mark as passive for better performance
    const mouseMoveListenerOptions: AddEventListenerOptions = { passive: true };
    // Capture phase flag for dragover event listener to intercept events early
    const dragOverListenerCapture = true;

    /**
     * Removes the ghost element and cleans up event listeners
     */
    const hideGhost = () => {
        if (dragGhostElement) {
            document.removeEventListener('mousemove', updateDragGhostPosition, mouseMoveListenerOptions);
            document.removeEventListener('dragover', updateDragGhostPosition, dragOverListenerCapture);
            dragGhostElement.remove();
            dragGhostElement = null;
        }
        if (windowDragEndHandler) {
            window.removeEventListener('dragend', windowDragEndHandler);
            windowDragEndHandler = null;
        }
        if (windowDropHandler) {
            window.removeEventListener('drop', windowDropHandler);
            windowDropHandler = null;
        }
    };

    /**
     * Determines the appropriate icon based on item type
     */
    const resolveIcon = (options: DragGhostOptions): string | null => {
        if (options.icon) {
            return options.icon;
        }
        if (options.itemType === ItemType.FOLDER) {
            return 'lucide-folder-closed';
        }
        if (options.itemType === ItemType.TAG) {
            return 'lucide-tags';
        }
        if (options.itemType === 'search') {
            return 'lucide-search';
        }
        if (options.itemType !== ItemType.FILE) {
            return null;
        }
        return 'lucide-file';
    };

    /**
     * Checks if an icon ID is an emoji and returns it
     */
    const asEmoji = (iconId: string): string | null => {
        if (iconId.startsWith('emoji:')) {
            return iconId.slice('emoji:'.length);
        }
        const emojiRegex = /\p{Extended_Pictographic}/u;
        return emojiRegex.test(iconId) ? iconId : null;
    };

    /**
     * Creates and displays a custom drag ghost element.
     * Shows either a badge for multiple items or an icon/image for single items.
     */
    const showGhost = (event: DragEvent, options: DragGhostOptions) => {
        hideGhost();

        const ghost = document.createElement('div');
        ghost.className = 'nn-drag-ghost';
        ghost.style.left = `${event.clientX + 10}px`;
        ghost.style.top = `${event.clientY + 10}px`;

        const iconService = getIconService();

        if (options.itemCount && options.itemCount > 1) {
            const info = document.createElement('div');
            info.className = 'nn-drag-ghost-badge';
            info.textContent = `${options.itemCount}`;
            ghost.appendChild(info);
        } else {
            const iconWrapper = document.createElement('div');
            iconWrapper.className = 'nn-drag-ghost-icon';
            const iconColor = options.iconColor ?? '#ffffff';
            iconWrapper.style.color = iconColor;
            iconWrapper.style.setProperty('--icon-color', iconColor);
            iconWrapper.style.fill = iconColor;
            iconWrapper.style.stroke = iconColor;

            if (options.itemType === ItemType.FILE && options.path) {
                let featureImagePath = '';
                try {
                    featureImagePath = getDBInstance().getCachedFeatureImageUrl(options.path);
                } catch (error) {
                    void error;
                    // Ignore cache errors and fall back to icon rendering
                }
                let imageLoaded = false;
                if (featureImagePath) {
                    const imageFile = app.vault.getFileByPath(featureImagePath);
                    if (imageFile) {
                        try {
                            const resourceUrl = app.vault.getResourcePath(imageFile);
                            iconWrapper.className = 'nn-drag-ghost-icon nn-drag-ghost-featured-image';
                            const img = document.createElement('img');
                            img.src = resourceUrl;
                            iconWrapper.appendChild(img);
                            imageLoaded = true;
                        } catch (error) {
                            imageLoaded = false;
                            void error;
                        }
                    }
                }

                if (!imageLoaded) {
                    /**
                     * Attempts to render an icon using various methods (icon service, emoji, or setIcon).
                     * Returns true if successfully rendered, false otherwise.
                     */
                    const renderIcon = (iconId: string | null | undefined): boolean => {
                        if (!iconId) {
                            return false;
                        }
                        iconWrapper.innerHTML = '';
                        try {
                            iconService.renderIcon(iconWrapper, iconId);
                            if (iconWrapper.childNodes.length > 0 || iconWrapper.innerHTML.trim() !== '') {
                                return true;
                            }
                        } catch (error) {
                            void error;
                        }
                        const emoji = asEmoji(iconId);
                        if (emoji) {
                            iconWrapper.textContent = emoji;
                            return true;
                        }
                        try {
                            setIcon(iconWrapper, iconId);
                            return iconWrapper.childNodes.length > 0;
                        } catch (error) {
                            void error;
                        }
                        return false;
                    };

                    const resolvedIcon = resolveIcon(options);
                    if (!renderIcon(options.icon) && !renderIcon(resolvedIcon)) {
                        iconWrapper.innerHTML = '';
                    }
                }
            } else {
                /**
                 * Attempts to render an icon using various methods (icon service, emoji, or setIcon).
                 * Returns true if successfully rendered, false otherwise.
                 */
                const renderIcon = (iconId: string | null | undefined): boolean => {
                    if (!iconId) {
                        return false;
                    }
                    iconWrapper.innerHTML = '';
                    try {
                        iconService.renderIcon(iconWrapper, iconId);
                        if (iconWrapper.childNodes.length > 0 || iconWrapper.innerHTML.trim() !== '') {
                            return true;
                        }
                    } catch (error) {
                        void error;
                    }
                    const emoji = asEmoji(iconId);
                    if (emoji) {
                        iconWrapper.textContent = emoji;
                        return true;
                    }
                    try {
                        setIcon(iconWrapper, iconId);
                        return iconWrapper.childNodes.length > 0;
                    } catch (error) {
                        void error;
                    }
                    return false;
                };

                const resolvedIcon = resolveIcon(options);
                if (!renderIcon(options.icon) && !renderIcon(resolvedIcon)) {
                    iconWrapper.innerHTML = '';
                }
            }

            ghost.appendChild(iconWrapper);
        }

        document.body.appendChild(ghost);
        dragGhostElement = ghost;

        document.addEventListener('mousemove', updateDragGhostPosition, mouseMoveListenerOptions);
        document.addEventListener('dragover', updateDragGhostPosition, dragOverListenerCapture);

        const onGlobalEnd = () => hideGhost();
        windowDragEndHandler = onGlobalEnd;
        windowDropHandler = onGlobalEnd;
        window.addEventListener('dragend', onGlobalEnd, { once: true });
        window.addEventListener('drop', onGlobalEnd, { once: true });
    };

    /**
     * Hides the native browser drag preview by setting an empty element as the drag image.
     * This allows the custom ghost to be the only visible drag indicator.
     */
    const hideNativePreview = (event: DragEvent) => {
        const empty = document.createElement('div');
        empty.className = 'nn-drag-empty-placeholder';
        document.body.appendChild(empty);
        try {
            event.dataTransfer?.setDragImage(empty, 0, 0);
        } catch (error) {
            void error;
        }
        setTimeout(() => empty.remove(), 0);
    };

    return {
        showGhost,
        hideGhost,
        hideNativePreview,
        hasGhost: () => dragGhostElement !== null
    };
}
