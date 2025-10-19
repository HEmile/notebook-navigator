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

import { App, Modal, setIcon } from 'obsidian';
import { strings } from '../i18n';
import { ItemType } from '../types';
import { ISettingsProvider } from '../interfaces/ISettingsProvider';

/**
 * Color palette for folder colors
 * Carefully selected to work well in both light and dark themes
 */
const COLOR_PALETTE = [
    { name: strings.modals.colorPicker.colors.red, value: '#ef4444' },
    { name: strings.modals.colorPicker.colors.orange, value: '#f97316' },
    { name: strings.modals.colorPicker.colors.amber, value: '#f59e0b' },
    { name: strings.modals.colorPicker.colors.yellow, value: '#eab308' },
    { name: strings.modals.colorPicker.colors.lime, value: '#84cc16' },
    { name: strings.modals.colorPicker.colors.green, value: '#22c55e' },
    { name: strings.modals.colorPicker.colors.emerald, value: '#10b981' },
    { name: strings.modals.colorPicker.colors.teal, value: '#14b8a6' },
    { name: strings.modals.colorPicker.colors.cyan, value: '#06b6d4' },
    { name: strings.modals.colorPicker.colors.sky, value: '#0ea5e9' },
    { name: strings.modals.colorPicker.colors.blue, value: '#3b82f6' },
    { name: strings.modals.colorPicker.colors.indigo, value: '#6366f1' },
    { name: strings.modals.colorPicker.colors.violet, value: '#8b5cf6' },
    { name: strings.modals.colorPicker.colors.purple, value: '#a855f7' },
    { name: strings.modals.colorPicker.colors.fuchsia, value: '#d946ef' },
    { name: strings.modals.colorPicker.colors.pink, value: '#ec4899' },
    { name: strings.modals.colorPicker.colors.rose, value: '#f43f5e' },
    { name: strings.modals.colorPicker.colors.gray, value: '#6b7280' },
    { name: strings.modals.colorPicker.colors.slate, value: '#64748b' },
    { name: strings.modals.colorPicker.colors.stone, value: '#78716c' }
];

const MAX_RECENT_COLORS = 10;
const DEFAULT_COLOR = '#3b82f6';

type ColorChannel = 'r' | 'g' | 'b' | 'a';

type RGBAValues = { r: number; g: number; b: number; a: number };

type ColorPickerMode = 'foreground' | 'background';

/**
 * Extended metadata service interface for color operations
 */
interface ColorMetadataService {
    setTagColor(path: string, color: string): Promise<void>;
    setFolderColor(path: string, color: string): Promise<void>;
    setFileColor(path: string, color: string): Promise<void>;
    removeTagColor(path: string): Promise<void>;
    removeFolderColor(path: string): Promise<void>;
    removeFileColor(path: string): Promise<void>;
    setTagBackgroundColor(path: string, color: string): Promise<void>;
    setFolderBackgroundColor(path: string, color: string): Promise<void>;
    removeTagBackgroundColor(path: string): Promise<void>;
    removeFolderBackgroundColor(path: string): Promise<void>;
    getTagColor(path: string): string | undefined;
    getFolderColor(path: string): string | undefined;
    getFileColor(path: string): string | undefined;
    getTagBackgroundColor(path: string): string | undefined;
    getFolderBackgroundColor(path: string): string | undefined;
    getSettingsProvider(): ISettingsProvider;
}

/**
 * Color picker modal with advanced features
 * - Hex input field
 * - RGB sliders
 * - Recently used colors
 * - Preset color palette
 * - Real-time preview
 */
export class ColorPickerModal extends Modal {
    private itemPath: string;
    private itemType: typeof ItemType.FOLDER | typeof ItemType.TAG | typeof ItemType.TOPIC | typeof ItemType.FILE;
    private metadataService: ColorMetadataService;
    private settingsProvider: ISettingsProvider;
    private currentColor: string | null = null;
    private selectedColor: string = DEFAULT_COLOR;
    private isBackgroundMode: boolean;
    private hexInput: HTMLInputElement;
    private previewCurrent: HTMLDivElement;
    private previewNew: HTMLDivElement;
    private channelSliders: Record<ColorChannel, HTMLInputElement>;
    private channelValues: Record<ColorChannel, HTMLSpanElement>;
    private recentColorsContainer: HTMLDivElement;
    private presetColorsContainer: HTMLDivElement;
    private isUpdating = false;
    private domDisposers: (() => void)[] = [];

    private addDomListener(
        el: HTMLElement,
        type: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        el.addEventListener(type, handler, options);
        this.domDisposers.push(() => el.removeEventListener(type, handler, options));
    }

    /** Callback function invoked when a color is selected */
    public onChooseColor: (color: string | null) => void;

    /**
     * Creates a new color picker modal
     * @param app - The Obsidian app instance
     * @param metadataService - The metadata service for managing folder/tag colors
     * @param itemPath - Path of the folder or tag to set color for
     * @param itemType - Whether this is for a folder or tag
     */
    constructor(
        app: App,
        metadataService: ColorMetadataService,
        itemPath: string,
        itemType: typeof ItemType.FOLDER | typeof ItemType.TAG | typeof ItemType.TOPIC | typeof ItemType.FILE = ItemType.FOLDER,
        colorMode: ColorPickerMode = 'foreground'
    ) {
        super(app);
        this.metadataService = metadataService;
        this.itemPath = itemPath;
        this.itemType = itemType;
        this.isBackgroundMode = itemType !== ItemType.FILE && colorMode === 'background';

        // Access settings through the service (used for recent colors storage)
        this.settingsProvider = metadataService.getSettingsProvider();

        const initialColor = this.resolveInitialColor();
        if (initialColor) {
            this.currentColor = initialColor;
            const parsedInitial = this.parseColorString(initialColor);
            if (parsedInitial) {
                this.selectedColor = this.rgbaToHex(parsedInitial);
                return;
            }
        }

        // Default starting color when no stored value is found or parsing failed
        this.selectedColor = DEFAULT_COLOR;
    }

    /**
     * Retrieves the current stored color for the item based on type and mode
     */
    private resolveInitialColor(): string | null {
        if (this.isBackgroundMode) {
            if (this.isTag()) {
                return this.metadataService.getTagBackgroundColor(this.itemPath) ?? null;
            }
            return this.metadataService.getFolderBackgroundColor(this.itemPath) ?? null;
        }

        if (this.isTag()) {
            return this.metadataService.getTagColor(this.itemPath) ?? null;
        }

        if (this.isFile()) {
            return this.metadataService.getFileColor(this.itemPath) ?? null;
        }

        return this.metadataService.getFolderColor(this.itemPath) ?? null;
    }

    /**
     * Called when the modal is opened
     */
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.addClass('nn-color-picker-modal');

        // Header showing the folder/tag name
        const header = contentEl.createDiv('nn-color-picker-header');
        const headerText = this.isTag() ? `#${this.itemPath}` : this.itemPath.split('/').pop() || this.itemPath;
        header.createEl('h3', { text: headerText });

        this.attachCloseButtonHandler();

        // Two-column layout
        const mainContent = contentEl.createDiv('nn-color-picker-content');

        // Left column
        const leftColumn = mainContent.createDiv('nn-color-picker-left');

        // Color preview section
        const previewSection = leftColumn.createDiv('nn-color-preview-section');
        const previewContainer = previewSection.createDiv('nn-color-preview-container');

        const currentSection = previewContainer.createDiv('nn-preview-current');
        currentSection.createEl('span', { text: strings.modals.colorPicker.currentColor, cls: 'nn-preview-label' });
        this.previewCurrent = currentSection.createDiv('nn-preview-color');
        if (this.currentColor) {
            this.applySwatchColor(this.previewCurrent, this.currentColor);
        } else {
            this.previewCurrent.addClass('nn-no-color');
        }

        const arrow = previewContainer.createDiv('nn-preview-arrow');
        setIcon(arrow, 'lucide-arrow-right');

        const newSection = previewContainer.createDiv('nn-preview-new');
        newSection.createEl('span', { text: strings.modals.colorPicker.newColor, cls: 'nn-preview-label' });
        this.previewNew = newSection.createDiv('nn-preview-color nn-show-checkerboard');
        this.applySwatchColor(this.previewNew, this.selectedColor);

        // Preset colors section
        const presetSection = leftColumn.createDiv('nn-preset-section');
        presetSection.createEl('div', { text: strings.modals.colorPicker.presetColors, cls: 'nn-section-label' });
        this.presetColorsContainer = presetSection.createDiv('nn-preset-colors');

        // Right column
        const rightColumn = mainContent.createDiv('nn-color-picker-right');

        // Hex input section
        const hexSection = rightColumn.createDiv('nn-hex-section');
        hexSection.createEl('label', { text: strings.modals.colorPicker.hexLabel, cls: 'nn-hex-title' });
        const hexContainer = hexSection.createDiv('nn-hex-container');
        hexContainer.createEl('span', { text: '#', cls: 'nn-hex-label' });
        this.hexInput = hexContainer.createEl('input', {
            type: 'text',
            cls: 'nn-hex-input',
            value: this.selectedColor.substring(1),
            attr: {
                'aria-label': 'Hex color value',
                maxlength: '8',
                placeholder: 'RRGGBB or RRGGBBAA'
            }
        });
        this.hexInput.setAttribute('enterkeyhint', 'done');

        // RGB sliders section
        const rgbSection = rightColumn.createDiv('nn-rgb-section');
        rgbSection.createEl('div', { text: strings.modals.colorPicker.rgbLabel, cls: 'nn-rgb-title' });
        this.channelSliders = {} as Record<ColorChannel, HTMLInputElement>;
        this.channelValues = {} as Record<ColorChannel, HTMLSpanElement>;

        (['r', 'g', 'b', 'a'] as const).forEach(channel => {
            const sliderRow = rgbSection.createDiv('nn-rgb-row');
            sliderRow.createEl('span', {
                text: channel.toUpperCase(),
                cls: 'nn-rgb-label'
            });

            const slider = sliderRow.createEl('input', {
                type: 'range',
                cls: 'nn-rgb-slider',
                attr: {
                    'aria-label': `${channel.toUpperCase()} value`,
                    min: '0',
                    max: '255'
                }
            });
            slider.classList.add(`nn-rgb-slider-${channel}`);

            const value = sliderRow.createEl('span', {
                cls: 'nn-rgb-value',
                text: '0'
            });

            this.channelSliders[channel] = slider;
            this.channelValues[channel] = value;
        });

        // Recent colors section
        const recentSection = rightColumn.createDiv('nn-recent-section');
        const recentHeader = recentSection.createDiv('nn-recent-header');
        recentHeader.createEl('div', { text: strings.modals.colorPicker.recentColors, cls: 'nn-section-label' });

        // Clear button
        const clearButton = recentHeader.createEl('button', {
            text: '×',
            cls: 'nn-clear-recent',
            title: strings.modals.colorPicker.clearRecentColors
        });
        this.addDomListener(clearButton, 'click', () => {
            this.clearRecentColors();
        });

        this.recentColorsContainer = recentSection.createDiv('nn-recent-colors');

        // Action buttons
        const buttonContainer = contentEl.createDiv('nn-color-button-container');

        // Cancel/Remove button
        const removeColorText = strings.modals.colorPicker.removeColor;
        const cancelRemoveButton = buttonContainer.createEl('button', {
            text: this.currentColor ? removeColorText : strings.common.cancel
        });
        this.addDomListener(cancelRemoveButton, 'click', () => {
            if (this.currentColor) {
                this.removeColor();
            } else {
                this.close();
            }
        });

        // Apply color button
        const applyButton = buttonContainer.createEl('button', {
            text: strings.modals.colorPicker.apply,
            cls: 'mod-cta'
        });
        this.addDomListener(applyButton, 'click', async () => {
            await this.applyColor();
        });

        // Set up event handlers
        this.setupEventHandlers();
        this.registerKeyboardShortcuts();
        this.loadRecentColors();
        this.loadPresetColors();
        this.updateFromHex(this.selectedColor);

        // Hex input real-time update
        this.addDomListener(this.hexInput, 'input', () => {
            const sanitized = this.sanitizeHexInput(this.hexInput.value);
            if (sanitized !== this.hexInput.value) {
                this.hexInput.value = sanitized;
            }

            if (sanitized.length === 6 || sanitized.length === 8) {
                this.updateFromHex(`#${sanitized.toLowerCase()}`, { syncInput: false });
            }
        });
    }

    /**
     * Called when the modal is closed
     */
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.removeClass('nn-color-picker-modal');
        // Cleanup DOM listeners
        if (this.domDisposers.length) {
            this.domDisposers.forEach(dispose => {
                try {
                    dispose();
                } catch (e) {
                    console.error('Error disposing color picker listener:', e);
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

    /**
     * Set up event handlers for sliders
     */
    private setupEventHandlers() {
        // RGB slider handlers
        (Object.keys(this.channelSliders) as ColorChannel[]).forEach(channel => {
            const slider = this.channelSliders[channel];
            this.addDomListener(slider, 'input', () => {
                if (!this.isUpdating) {
                    this.updateFromRGB();
                }
            });
        });
    }

    /**
     * Register keyboard shortcuts for the modal
     */
    private registerKeyboardShortcuts() {
        this.scope.register([], 'Enter', event => {
            if (document.activeElement === this.hexInput) {
                event.preventDefault();
                window.setTimeout(() => {
                    this.hexInput.blur();
                });
            }
        });
    }

    /**
     * Load and display recently used colors
     */
    private loadRecentColors() {
        const recentColors = this.settingsProvider.settings.recentColors || [];
        this.recentColorsContainer.empty();

        recentColors.forEach((color, index) => {
            const dot = this.recentColorsContainer.createDiv('nn-color-dot nn-recent-color nn-show-checkerboard');
            this.applySwatchColor(dot, color);
            dot.setAttribute('data-color', color);
            this.addDomListener(dot, 'click', () => {
                this.applyColorAndClose(color, false);
            });

            const removeButton = dot.createEl('button', {
                cls: 'nn-recent-remove-button',
                attr: {
                    type: 'button',
                    'aria-label': strings.modals.colorPicker.removeRecentColor,
                    title: strings.modals.colorPicker.removeRecentColor
                }
            });
            removeButton.createSpan({ text: '×', cls: 'nn-recent-remove-glyph', attr: { 'aria-hidden': 'true' } });
            this.addDomListener(removeButton, 'click', event => {
                event.stopPropagation();
                event.preventDefault();
                this.removeRecentColor(index);
            });
        });

        // Fill empty slots
        for (let i = recentColors.length; i < MAX_RECENT_COLORS; i++) {
            this.recentColorsContainer.createDiv('nn-color-dot nn-color-empty');
        }
    }

    /**
     * Clear all recently used colors
     */
    private clearRecentColors() {
        this.settingsProvider.settings.recentColors = [];
        this.settingsProvider.saveSettingsAndUpdate();
        this.loadRecentColors();
    }

    /**
     * Remove a single recently used color by index
     */
    private removeRecentColor(index: number) {
        const recentColors = this.settingsProvider.settings.recentColors;
        if (!recentColors || index < 0 || index >= recentColors.length) {
            return;
        }

        recentColors.splice(index, 1);
        this.settingsProvider.saveSettingsAndUpdate();
        this.loadRecentColors();
    }

    /**
     * Load preset color palette
     */
    private loadPresetColors() {
        this.presetColorsContainer.empty();

        COLOR_PALETTE.forEach(color => {
            const dot = this.presetColorsContainer.createDiv('nn-color-dot');
            this.applySwatchColor(dot, color.value);
            dot.setAttribute('data-color', color.value);
            dot.setAttribute('title', color.name);
            this.addDomListener(dot, 'click', () => {
                this.applyColorAndClose(color.value, false);
            });
        });
    }

    /**
     * Apply swatch background and transparency indicator
     */
    private applySwatchColor(element: HTMLElement, color: string): void {
        element.classList.remove('nn-no-color');
        const wantsCheckerboard = element.hasClass('nn-show-checkerboard');

        element.addClass('nn-color-swatch');
        element.style.setProperty('--nn-color-swatch-color', color);

        if (wantsCheckerboard) {
            element.addClass('nn-checkerboard');
        } else {
            element.removeClass('nn-checkerboard');
        }
    }

    /**
     * Update all controls from hex value
     */
    private updateFromHex(hex: string, { syncInput = true }: { syncInput?: boolean } = {}) {
        this.isUpdating = true;
        const rgba = this.hexToRgba(hex);
        if (rgba) {
            const normalizedHex = this.rgbaToHex(rgba);
            this.selectedColor = normalizedHex;
            this.applySwatchColor(this.previewNew, normalizedHex);
            if (syncInput) {
                this.hexInput.value = normalizedHex.substring(1);
            }

            this.channelSliders.r.value = rgba.r.toString();
            this.channelSliders.g.value = rgba.g.toString();
            this.channelSliders.b.value = rgba.b.toString();
            this.channelSliders.a.value = rgba.a.toString();
            this.channelValues.r.setText(rgba.r.toString());
            this.channelValues.g.setText(rgba.g.toString());
            this.channelValues.b.setText(rgba.b.toString());
            this.channelValues.a.setText(rgba.a.toString());
        }

        this.isUpdating = false;
    }

    /**
     * Update from RGB slider values
     */
    private updateFromRGB() {
        const r = parseInt(this.channelSliders.r.value, 10) || 0;
        const g = parseInt(this.channelSliders.g.value, 10) || 0;
        const b = parseInt(this.channelSliders.b.value, 10) || 0;
        const a = parseInt(this.channelSliders.a.value, 10) || 0;

        // Update value displays
        this.channelValues.r.setText(r.toString());
        this.channelValues.g.setText(g.toString());
        this.channelValues.b.setText(b.toString());
        this.channelValues.a.setText(a.toString());

        const rgba: RGBAValues = { r, g, b, a };
        const hex = this.rgbaToHex(rgba);
        this.selectedColor = hex;

        // Update preview and hex input
        this.applySwatchColor(this.previewNew, hex);
        this.hexInput.value = hex.substring(1);
    }

    /**
     * Convert hex to RGBA
     */
    private hexToRgba(hex: string): RGBAValues | null {
        const normalized = hex.startsWith('#') ? hex.slice(1) : hex;

        if (normalized.length !== 3 && normalized.length !== 4 && normalized.length !== 6 && normalized.length !== 8) {
            return null;
        }

        if (normalized.length === 3 || normalized.length === 4) {
            const [rChar, gChar, bChar, aChar] = normalized.split('');
            const rHex = (rChar ?? '0').repeat(2);
            const gHex = (gChar ?? '0').repeat(2);
            const bHex = (bChar ?? '0').repeat(2);
            const aHex = normalized.length === 4 ? (aChar ?? 'f').repeat(2) : 'ff';

            const r = parseInt(rHex, 16);
            const g = parseInt(gHex, 16);
            const b = parseInt(bHex, 16);
            const a = parseInt(aHex, 16);

            if ([r, g, b, a].some(value => Number.isNaN(value))) {
                return null;
            }

            return { r, g, b, a };
        }

        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);
        const a = normalized.length === 8 ? parseInt(normalized.slice(6, 8), 16) : 255;

        if ([r, g, b, a].some(value => Number.isNaN(value))) {
            return null;
        }

        return { r, g, b, a };
    }

    /**
     * Convert RGBA to hex, collapsing alpha when fully opaque
     */
    private rgbaToHex({ r, g, b, a }: RGBAValues): string {
        const base = [r, g, b].map(value => value.toString(16).padStart(2, '0')).join('');
        if (a >= 255) {
            return `#${base}`;
        }

        const alpha = a.toString(16).padStart(2, '0');
        return `#${base}${alpha}`;
    }

    /**
     * Parses common CSS color formats into RGBA values
     */
    private parseColorString(color: string): RGBAValues | null {
        if (!color) {
            return null;
        }

        const hex = this.hexToRgba(color);
        if (hex) {
            return hex;
        }

        const rgbMatch = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
        if (rgbMatch) {
            const [r, g, b] = rgbMatch.slice(1, 4).map(value => this.clampColorComponent(parseInt(value, 10)));
            return { r, g, b, a: 255 };
        }

        const rgbaMatch = color.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i);
        if (rgbaMatch) {
            const [r, g, b] = rgbaMatch.slice(1, 4).map(value => this.clampColorComponent(parseInt(value, 10)));
            const alphaFloat = parseFloat(rgbaMatch[4]);
            if (Number.isNaN(alphaFloat)) {
                return null;
            }
            const clampedAlpha = Math.max(0, Math.min(1, alphaFloat));
            return { r, g, b, a: Math.round(clampedAlpha * 255) };
        }

        return null;
    }

    private clampColorComponent(value: number): number {
        if (Number.isNaN(value)) {
            return 0;
        }
        return Math.max(0, Math.min(255, value));
    }

    /**
     * Validate and format hex input
     */
    private sanitizeHexInput(input: string): string {
        return input.replace(/[^0-9A-Fa-f]/g, '').slice(0, 8);
    }

    /**
     * Save color to recent colors
     */
    private async saveToRecentColors(color: string) {
        // Don't add preset colors to recent
        const isPresetColor = COLOR_PALETTE.some(preset => preset.value === color);
        if (isPresetColor) {
            return;
        }

        const settings = this.settingsProvider.settings;
        let recentColors = settings.recentColors || [];

        // Remove if already exists
        recentColors = recentColors.filter(c => c !== color);

        // Add to front
        recentColors.unshift(color);

        // Limit to max
        recentColors = recentColors.slice(0, MAX_RECENT_COLORS);

        // Update settings
        settings.recentColors = recentColors;
        await this.settingsProvider.saveSettingsAndUpdate();
    }

    /**
     * Apply the selected color and close
     */
    private async applyColor() {
        // Save the color
        await this.saveColor();
        // Close the modal
        this.close();
    }

    /**
     * Remove the color and close
     */
    private async removeColor() {
        await this.updateMetadataColor(null);

        // Notify callback with null
        this.onChooseColor?.(null);

        // Close the modal
        this.close();
    }

    /**
     * Save the selected color
     */
    private async saveColor() {
        // Save to recent colors
        await this.saveToRecentColors(this.selectedColor);

        await this.updateMetadataColor(this.selectedColor);

        // Notify callback
        this.onChooseColor?.(this.selectedColor);
    }

    /**
     * Helper to check if this is for a tag or topic
     */
    private isTag(): boolean {
        return this.itemType === ItemType.TAG || this.itemType === ItemType.TOPIC;
    }

    private isFile(): boolean {
        return this.itemType === ItemType.FILE;
    }

    /**
     * Apply color and close modal
     * Used by both preset and recent color clicks
     */
    private async applyColorAndClose(color: string, saveToRecent: boolean = true) {
        this.updateFromHex(color);

        // Save to recent if requested
        const normalized = this.selectedColor;

        if (saveToRecent) {
            await this.saveToRecentColors(normalized);
        }

        await this.updateMetadataColor(normalized);

        // Notify callback
        this.onChooseColor?.(normalized);

        // Close the modal
        this.close();
    }

    /**
     * Update metadata for the current mode and item type
     */
    private async updateMetadataColor(color: string | null): Promise<void> {
        const isTag = this.isTag();
        const isFile = this.isFile();

        if (color === null) {
            if (isTag) {
                if (this.isBackgroundMode) {
                    await this.metadataService.removeTagBackgroundColor(this.itemPath);
                } else {
                    await this.metadataService.removeTagColor(this.itemPath);
                }
            } else if (isFile) {
                await this.metadataService.removeFileColor(this.itemPath);
            } else if (this.isBackgroundMode) {
                await this.metadataService.removeFolderBackgroundColor(this.itemPath);
            } else {
                await this.metadataService.removeFolderColor(this.itemPath);
            }
            return;
        }

        if (isTag) {
            if (this.isBackgroundMode) {
                await this.metadataService.setTagBackgroundColor(this.itemPath, color);
            } else {
                await this.metadataService.setTagColor(this.itemPath, color);
            }
        } else if (isFile) {
            await this.metadataService.setFileColor(this.itemPath, color);
        } else if (this.isBackgroundMode) {
            await this.metadataService.setFolderBackgroundColor(this.itemPath, color);
        } else {
            await this.metadataService.setFolderColor(this.itemPath, color);
        }
    }
}
