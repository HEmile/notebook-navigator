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

import { App, Modal } from 'obsidian';
import * as emojilib from 'emojilib';
import { strings } from '../i18n';
import { getIconService, IconDefinition, IconProvider, RECENT_ICONS_PER_PROVIDER_LIMIT } from '../services/icons';
import { MetadataService } from '../services/MetadataService';
import { ItemType } from '../types';
import { TIMEOUTS } from '../types/obsidian-extended';
import { ISettingsProvider } from '../interfaces/ISettingsProvider';

// Constants
const GRID_COLUMNS = 5;
const MAX_SEARCH_RESULTS = 50;

/**
 * Enhanced icon picker modal that supports multiple icon providers
 * Features tabs for different providers (Lucide, Emoji, etc.)
 */
export class IconPickerModal extends Modal {
    private currentProvider: string = 'lucide';
    private static lastUsedProvider: string | null = null; // Shared session default
    private iconService = getIconService();
    private itemPath: string;
    private itemType: typeof ItemType.FOLDER | typeof ItemType.TAG | typeof ItemType.TOPIC | typeof ItemType.FILE;
    private metadataService: MetadataService;
    private settingsProvider: ISettingsProvider;
    /** Callback function invoked when an icon is selected */
    public onChooseIcon: (iconId: string | null) => void;
    private resultsContainer: HTMLDivElement;
    private searchDebounceTimer: number | null = null;
    private searchInput: HTMLInputElement;

    private tabContainer: HTMLDivElement;
    private domDisposers: (() => void)[] = [];
    private providerTabs: HTMLElement[] = [];
    private currentIcon: string | undefined;
    private removeButton: HTMLButtonElement | null = null;

    public static getLastUsedProvider(): string | null {
        return IconPickerModal.lastUsedProvider;
    }

    public static setLastUsedProvider(providerId: string | null): void {
        IconPickerModal.lastUsedProvider = providerId;
    }

    private addDomListener(
        el: HTMLElement,
        type: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        el.addEventListener(type, handler, options);
        this.domDisposers.push(() => el.removeEventListener(type, handler, options));
    }

    constructor(
        app: App,
        metadataService: MetadataService,
        itemPath: string,
        itemType: typeof ItemType.FOLDER | typeof ItemType.TAG | typeof ItemType.TOPIC | typeof ItemType.FILE = ItemType.FOLDER
    ) {
        super(app);
        this.metadataService = metadataService;
        this.settingsProvider = metadataService.getSettingsProvider();
        this.itemPath = itemPath;
        this.itemType = itemType;
        this.currentIcon = this.getCurrentIconForItem();
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.addClass('nn-icon-picker-modal');

        // Header showing the folder/tag name
        const header = contentEl.createDiv('nn-icon-picker-header');
        const headerText = this.itemType === ItemType.TAG ? `#${this.itemPath}` : this.itemPath.split('/').pop() || this.itemPath;
        header.createEl('h3', { text: headerText });

        // Create tabs for providers
        this.createProviderTabs();

        // Create search input
        const searchContainer = contentEl.createDiv('nn-icon-search-container');
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: strings.modals.iconPicker.searchPlaceholder,
            cls: 'nn-icon-search-input'
        });
        this.searchInput.setAttribute('enterkeyhint', 'done');

        this.attachCloseButtonHandler();

        // Create results container
        this.resultsContainer = contentEl.createDiv('nn-icon-results-container');

        const buttonContainer = contentEl.createDiv('nn-icon-button-container');
        const removeButton = buttonContainer.createEl('button');
        const removeButtonLabel = strings.modals.iconPicker.removeIcon;
        removeButton.setText(removeButtonLabel);
        if (removeButton instanceof HTMLButtonElement) {
            this.removeButton = removeButton;
            if (!this.currentIcon) {
                removeButton.disabled = true;
            }
        }
        this.addDomListener(removeButton, 'click', async () => {
            await this.removeIcon();
        });

        // Set up search functionality with debouncing
        this.addDomListener(this.searchInput, 'input', () => {
            if (this.searchDebounceTimer) {
                window.clearTimeout(this.searchDebounceTimer);
            }
            this.searchDebounceTimer = window.setTimeout(() => {
                this.updateResults();
            }, TIMEOUTS.DEBOUNCE_KEYBOARD);
        });

        // Set up keyboard navigation
        this.setupKeyboardNavigation();

        // Focus search input
        this.searchInput.focus();
        if (typeof window !== 'undefined') {
            window.requestAnimationFrame(() => {
                this.searchInput.focus();
            });
        }

        // Show initial results
        this.updateResults();
    }

    private createProviderTabs() {
        this.tabContainer = this.contentEl.createDiv('nn-icon-provider-tabs');
        this.tabContainer.setAttribute('role', 'tablist');
        this.providerTabs = [];

        const providers = this.sortProvidersForDisplay(this.iconService.getAllProviders().slice());
        const resolvedProviderId = this.resolveInitialProvider(providers);
        this.currentProvider = resolvedProviderId;
        IconPickerModal.setLastUsedProvider(resolvedProviderId);

        providers.forEach(provider => {
            const tab = this.tabContainer.createDiv({
                cls: 'nn-icon-provider-tab',
                text: provider.name
            });
            tab.setAttribute('role', 'tab');
            tab.setAttribute('tabindex', '-1');
            tab.dataset.providerId = provider.id;
            this.providerTabs.push(tab);

            this.addDomListener(tab, 'click', () => {
                this.setActiveProviderTab(provider.id);
                this.currentProvider = provider.id;
                IconPickerModal.setLastUsedProvider(provider.id);
                this.updateResults();
                this.resetResultsScroll();
            });
        });

        this.setActiveProviderTab(resolvedProviderId);
    }

    /**
     * Sorts icon providers for display in the UI, prioritizing certain providers
     * @param providers - Array of icon providers to sort
     * @returns Sorted array with pinned providers first, then alphabetically
     */
    private sortProvidersForDisplay(providers: IconProvider[]): IconProvider[] {
        // Define providers that should appear first in the UI
        const pinnedOrder = ['lucide', 'emoji'];
        return providers.sort((a, b) => {
            const aPinnedIndex = pinnedOrder.indexOf(a.id);
            const bPinnedIndex = pinnedOrder.indexOf(b.id);

            // Both providers are pinned - sort by their pinned order
            if (aPinnedIndex !== -1 && bPinnedIndex !== -1) {
                return aPinnedIndex - bPinnedIndex;
            }

            // Provider a is pinned - it comes first
            if (aPinnedIndex !== -1) {
                return -1;
            }

            // Provider b is pinned - it comes first
            if (bPinnedIndex !== -1) {
                return 1;
            }

            // Neither provider is pinned - sort alphabetically by name
            return a.name.localeCompare(b.name);
        });
    }

    private resolveInitialProvider(providers: IconProvider[]): string {
        if (!providers.length) {
            return 'lucide';
        }

        const providerIds = new Set(providers.map(provider => provider.id));
        const fallbackProvider = providers.find(provider => provider.id === 'lucide')?.id ?? providers[0].id;
        const candidates = [IconPickerModal.getLastUsedProvider(), this.currentProvider]; // Prefer stored selection

        for (const candidate of candidates) {
            if (candidate && providerIds.has(candidate)) {
                return candidate;
            }
        }

        return fallbackProvider;
    }

    private updateResults() {
        this.resultsContainer.empty();

        const searchTerm = this.searchInput.value.toLowerCase().trim();
        const provider = this.iconService.getProvider(this.currentProvider);

        if (searchTerm === '') {
            const hasRecents = this.renderRecentIcons();

            if (!hasRecents) {
                if (this.currentProvider === 'emoji') {
                    const emptyMessage = this.resultsContainer.createDiv('nn-icon-empty-message');
                    emptyMessage.setText(strings.modals.iconPicker.emojiInstructions);
                } else {
                    this.showEmptyState();
                }
            }
            return;
        }

        const results = this.iconService.search(searchTerm, this.currentProvider);

        if (results.length > 0 && provider) {
            const grid = this.resultsContainer.createDiv('nn-icon-grid');

            results.slice(0, MAX_SEARCH_RESULTS).forEach(iconDef => {
                this.createIconItem(iconDef, grid, provider);
            });

            if (results.length > MAX_SEARCH_RESULTS) {
                const moreMessage = this.resultsContainer.createDiv('nn-icon-more-message');
                moreMessage.setText(strings.modals.iconPicker.showingResultsInfo.replace('{count}', results.length.toString()));
            }
            return;
        }

        this.showEmptyState(true);
    }

    /**
     * Renders recently used icons for the current provider
     * @returns true if any icons were rendered, false otherwise
     */
    private renderRecentIcons(): boolean {
        const recentIconsMap = this.settingsProvider.getRecentIcons();
        const recentIcons = recentIconsMap[this.currentProvider] || [];

        if (!recentIcons.length) {
            return false;
        }

        const header = this.resultsContainer.createDiv('nn-icon-section-header');
        header.setText(strings.modals.iconPicker.recentlyUsedHeader);
        const grid = this.resultsContainer.createDiv('nn-icon-grid');

        let rendered = 0;
        // Cache provider icons to avoid multiple getAll() calls
        const providerCache = new Map<string, IconDefinition[]>();

        recentIcons.forEach(iconId => {
            const parsed = this.iconService.parseIconId(iconId);
            const provider = this.iconService.getProvider(parsed.provider);
            if (!provider) {
                return;
            }

            // Special handling for emoji provider - create icon definition on the fly
            if (provider.id === 'emoji') {
                let displayName = '';
                // Look up emoji keywords from emojilib
                for (const [emoji, keywords] of Object.entries(emojilib)) {
                    if (emoji === parsed.identifier && Array.isArray(keywords)) {
                        displayName = keywords[0] || '';
                        break;
                    }
                }

                const iconDef = {
                    id: parsed.identifier,
                    displayName,
                    preview: parsed.identifier
                };
                this.createIconItem(iconDef, grid, provider);
                rendered += 1;
                return;
            }

            // For non-emoji providers, look up icon from cached provider data
            let icons = providerCache.get(provider.id);
            if (!icons) {
                icons = provider.getAll();
                providerCache.set(provider.id, icons);
            }

            const iconDef = icons.find(icon => icon.id === parsed.identifier);
            if (!iconDef) {
                return;
            }

            this.createIconItem(iconDef, grid, provider);
            rendered += 1;
        });

        // Clean up UI if no icons were actually rendered
        if (rendered === 0) {
            header.remove();
            grid.remove();
            return false;
        }

        return true;
    }

    /**
     * Resets the scroll position of the results container to top
     * Called when switching between provider tabs
     */
    private resetResultsScroll(): void {
        if (!this.resultsContainer) {
            return;
        }
        this.resultsContainer.scrollTop = 0;
    }

    private showEmptyState(isSearch: boolean = false) {
        const emptyMessage = this.resultsContainer.createDiv('nn-icon-empty-message');
        emptyMessage.setText(isSearch ? strings.modals.iconPicker.emptyStateNoResults : strings.modals.iconPicker.emptyStateSearch);
    }

    private createIconItem(iconDef: IconDefinition, container: HTMLElement, provider: IconProvider) {
        const iconItem = container.createDiv('nn-icon-item');
        const fullIconId = this.iconService.formatIconId(provider.id, iconDef.id);
        iconItem.setAttribute('data-icon-id', fullIconId);

        // Icon preview
        const iconPreview = iconItem.createDiv('nn-icon-item-preview');
        this.iconService.renderIcon(iconPreview, fullIconId);

        // For emojis, also show the emoji as preview text if available
        if (provider.id === 'emoji' && iconDef.preview) {
            iconPreview.addClass('nn-emoji-preview');
        }

        // Icon name
        const iconName = iconItem.createDiv('nn-icon-item-name');
        iconName.setText(iconDef.displayName);

        // Click handler
        this.addDomListener(iconItem, 'click', () => {
            this.selectIcon(fullIconId);
        });

        // Make focusable
        iconItem.setAttribute('tabindex', '0');
    }

    /**
     * Adds icon to the recent icons list for its provider
     */
    private saveToRecentIcons(iconId: string) {
        // Parse icon ID to get provider
        const parsed = this.iconService.parseIconId(iconId);
        const providerId = parsed.provider;

        // Get current recent icons and copy provider's list
        const recentIconsMap = this.settingsProvider.getRecentIcons();
        const providerIcons = [...(recentIconsMap[providerId] ?? [])];
        const index = providerIcons.indexOf(iconId);

        // Remove if already exists to avoid duplicates
        if (index > -1) {
            providerIcons.splice(index, 1);
        }

        // Add to front of list
        providerIcons.unshift(iconId);

        // Trim to maximum allowed recent icons per provider
        if (providerIcons.length > RECENT_ICONS_PER_PROVIDER_LIMIT) {
            providerIcons.length = RECENT_ICONS_PER_PROVIDER_LIMIT;
        }

        // Update and persist recent icons to local storage
        recentIconsMap[providerId] = providerIcons;
        this.settingsProvider.setRecentIcons(recentIconsMap);
    }

    private async selectIcon(iconId: string) {
        // Save to recent icons
        this.saveToRecentIcons(iconId);

        // Set the icon based on item type
        if (this.itemType === ItemType.TAG || this.itemType === ItemType.TOPIC) {
            await this.metadataService.setTagIcon(this.itemPath, iconId);
        } else if (this.itemType === ItemType.FILE) {
            await this.metadataService.setFileIcon(this.itemPath, iconId);
        } else {
            await this.metadataService.setFolderIcon(this.itemPath, iconId);
        }

        // Notify callback and close
        this.onChooseIcon?.(iconId);
        this.currentIcon = iconId;
        this.close();
    }

    private getCurrentIconForItem(): string | undefined {
        if (this.itemType === ItemType.TAG || this.itemType === ItemType.TOPIC) {
            return this.metadataService.getTagIcon(this.itemPath);
        }
        if (this.itemType === ItemType.FILE) {
            return this.metadataService.getFileIcon(this.itemPath);
        }
        return this.metadataService.getFolderIcon(this.itemPath);
    }

    private async removeIcon(): Promise<void> {
        const existingIcon = this.getCurrentIconForItem();
        if (!existingIcon) {
            this.close();
            return;
        }

        if (this.itemType === ItemType.TAG || this.itemType === ItemType.TOPIC) {
            await this.metadataService.removeTagIcon(this.itemPath);
        } else if (this.itemType === ItemType.FILE) {
            await this.metadataService.removeFileIcon(this.itemPath);
        } else {
            await this.metadataService.removeFolderIcon(this.itemPath);
        }

        this.onChooseIcon?.(null);
        this.currentIcon = undefined;
        if (this.removeButton) {
            this.removeButton.disabled = true;
        }
        this.close();
    }

    /**
     * Sets up keyboard navigation for the icon picker modal
     * Handles Tab/Shift+Tab cycling, arrow key navigation, and Enter selection
     */
    private setupKeyboardNavigation() {
        // Shift+Tab -> focus search input or provider tabs based on current focus
        this.scope.register(['Shift'], 'Tab', evt => {
            const currentFocused = document.activeElement as HTMLElement | null;

            // Prevent default tab cycling when on provider tabs
            if (currentFocused?.classList.contains('nn-icon-provider-tab')) {
                evt.preventDefault();
                return;
            }

            evt.preventDefault();
            const activeTab = this.getActiveProviderTab();

            // From icon grid -> back to search input
            if (currentFocused?.classList.contains('nn-icon-item')) {
                this.searchInput.focus();
                return;
            }

            // From search input -> to provider tabs
            if (currentFocused === this.searchInput) {
                activeTab?.focus();
                return;
            }

            this.searchInput.focus();
        });

        // Tab -> focus first icon if not in grid
        this.scope.register([], 'Tab', evt => {
            const currentFocused = document.activeElement as HTMLElement;
            if (currentFocused?.classList.contains('nn-icon-provider-tab')) {
                evt.preventDefault();
                this.searchInput.focus();
                return;
            }
            const isInGrid = currentFocused?.classList.contains('nn-icon-item');

            if (!isInGrid) {
                evt.preventDefault();
                const firstIcon = this.resultsContainer.querySelector<HTMLElement>('.nn-icon-item');
                if (firstIcon) firstIcon.focus();
            }
        });

        // Arrow keys and Enter for grid navigation
        this.scope.register([], 'ArrowLeft', evt => this.handleArrowKey(evt, -1, 0));
        this.scope.register([], 'ArrowRight', evt => this.handleArrowKey(evt, 1, 0));
        this.scope.register([], 'ArrowUp', evt => this.handleArrowKey(evt, 0, -1));
        this.scope.register([], 'ArrowDown', evt => this.handleArrowKey(evt, 0, 1));

        this.scope.register([], 'Enter', evt => {
            const currentFocused = document.activeElement as HTMLElement | null;
            if (currentFocused === this.searchInput) {
                evt.preventDefault();
                window.setTimeout(() => {
                    this.searchInput.blur();
                });
                return;
            }

            if (currentFocused?.classList.contains('nn-icon-item')) {
                evt.preventDefault();
                const iconId = currentFocused.getAttribute('data-icon-id');
                if (iconId) {
                    this.selectIcon(iconId);
                }
            }
        });
    }

    /**
     * Handles arrow key navigation in the icon grid and provider tabs
     * @param evt - The keyboard event
     * @param deltaX - Horizontal movement (-1 for left, 1 for right)
     * @param deltaY - Vertical movement (-1 for up, 1 for down)
     */
    private handleArrowKey(evt: KeyboardEvent, deltaX: number, deltaY: number) {
        const currentFocused = document.activeElement as HTMLElement;
        // Handle horizontal navigation between provider tabs
        if (currentFocused?.classList.contains('nn-icon-provider-tab')) {
            if (deltaX === 0) {
                return; // Ignore vertical arrows on tabs
            }
            evt.preventDefault();
            this.focusAdjacentTab(currentFocused, deltaX);
            return;
        }
        if (!currentFocused?.classList.contains('nn-icon-item')) return;

        evt.preventDefault();
        const iconItems = Array.from(this.resultsContainer.querySelectorAll<HTMLElement>('.nn-icon-item'));
        const currentIndex = iconItems.indexOf(currentFocused);

        let newIndex = currentIndex;
        if (deltaX !== 0) {
            newIndex = currentIndex + deltaX;
        } else {
            newIndex = currentIndex + deltaY * GRID_COLUMNS;
        }

        if (newIndex >= 0 && newIndex < iconItems.length) {
            iconItems[newIndex].focus();
            this.ensureIconVisible(iconItems[newIndex]);
        }
    }

    /**
     * Focuses the adjacent provider tab when using arrow keys
     * @param currentTab - The currently focused tab
     * @param deltaX - Direction to move (-1 for left, 1 for right)
     */
    private focusAdjacentTab(currentTab: HTMLElement, deltaX: number) {
        const currentIndex = this.providerTabs.indexOf(currentTab);
        if (currentIndex === -1) {
            return;
        }

        const nextIndex = currentIndex + (deltaX < 0 ? -1 : 1);
        if (nextIndex < 0 || nextIndex >= this.providerTabs.length) {
            return;
        }

        const nextTab = this.providerTabs[nextIndex];
        const providerId = nextTab.dataset.providerId;
        if (!providerId) {
            return;
        }

        // Update active tab and trigger click to switch provider
        this.setActiveProviderTab(providerId);
        nextTab.focus();
        nextTab.click();
    }

    private ensureIconVisible(iconElement: HTMLElement) {
        const container = this.resultsContainer;
        const containerRect = container.getBoundingClientRect();
        const elementRect = iconElement.getBoundingClientRect();

        const padding = 8;

        if (elementRect.top < containerRect.top + padding) {
            container.scrollTop -= containerRect.top - elementRect.top + padding;
        }

        if (elementRect.bottom > containerRect.bottom - padding) {
            container.scrollTop += elementRect.bottom - containerRect.bottom + padding;
        }
    }

    /**
     * Sets the active provider tab and updates ARIA attributes
     * @param providerId - The ID of the provider to activate
     */
    private setActiveProviderTab(providerId: string) {
        this.providerTabs.forEach(tab => {
            const isActive = tab.dataset.providerId === providerId;
            if (isActive) {
                tab.addClass('nn-active');
                tab.setAttribute('tabindex', '0'); // Make tab focusable
            } else {
                tab.removeClass('nn-active');
                tab.setAttribute('tabindex', '-1'); // Remove from tab order
            }
        });
    }

    /**
     * Gets the currently active provider tab element
     * @returns The active tab element or null if not found
     */
    private getActiveProviderTab(): HTMLElement | null {
        return this.providerTabs.find(tab => tab.dataset.providerId === this.currentProvider) ?? null;
    }

    onClose() {
        if (this.searchDebounceTimer) {
            window.clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }

        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.removeClass('nn-icon-picker-modal');
        this.removeButton = null;
        // Cleanup DOM listeners
        if (this.domDisposers.length) {
            this.domDisposers.forEach(dispose => {
                try {
                    dispose();
                } catch (e) {
                    console.error('Error disposing icon picker listener:', e);
                }
            });
            this.domDisposers = [];
        }
    }

    // Attaches event handlers to the modal close button to ensure proper modal closure
    private attachCloseButtonHandler() {
        const closeButton = this.modalEl.querySelector<HTMLElement>('.modal-close-button');
        if (!closeButton) {
            return;
        }

        const handleClose = (event: Event) => {
            event.preventDefault();
            this.close();
        };

        this.addDomListener(closeButton, 'click', handleClose);
        this.addDomListener(closeButton, 'pointerdown', handleClose);
    }
}
