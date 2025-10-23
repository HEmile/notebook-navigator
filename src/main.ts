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

import { Plugin, TFile, FileView } from 'obsidian';
import { NotebookNavigatorSettings, DEFAULT_SETTINGS, NotebookNavigatorSettingTab } from './settings';
import { LocalStorageKeys, NOTEBOOK_NAVIGATOR_VIEW, STORAGE_KEYS } from './types';
import { ISettingsProvider } from './interfaces/ISettingsProvider';
import { MetadataService, type MetadataCleanupSummary } from './services/MetadataService';
import { TagOperations } from './services/TagOperations';
import { TagTreeService } from './services/TagTreeService';
import { CommandQueueService } from './services/CommandQueueService';
import { OmnisearchService } from './services/OmnisearchService';
import { FileSystemOperations } from './services/FileSystemService';
import { getIconService } from './services/icons';
import { RecentNotesService } from './services/RecentNotesService';
import RecentDataManager from './services/recent/RecentDataManager';
import { ExternalIconProviderController } from './services/icons/external/ExternalIconProviderController';
import { ExternalIconProviderId } from './services/icons/external/providerRegistry';
import ReleaseCheckService, { type ReleaseUpdateNotice } from './services/ReleaseCheckService';
import { NotebookNavigatorView } from './view/NotebookNavigatorView';
import { getDefaultDateFormat, getDefaultTimeFormat } from './i18n';
import { localStorage, LOCALSTORAGE_VERSION } from './utils/localStorage';
import { NotebookNavigatorAPI } from './api/NotebookNavigatorAPI';
import { initializeDatabase, shutdownDatabase } from './storage/fileOperations';
import { ExtendedApp } from './types/obsidian-extended';
import { getLeafSplitLocation } from './utils/workspaceSplit';
import { sanitizeKeyboardShortcuts } from './utils/keyboardShortcuts';
import WorkspaceCoordinator from './services/workspace/WorkspaceCoordinator';
import HomepageController from './services/workspace/HomepageController';
import registerNavigatorCommands from './services/commands/registerNavigatorCommands';
import registerWorkspaceEvents from './services/workspace/registerWorkspaceEvents';
import type { RevealFileOptions } from './hooks/useNavigatorReveal';
import { TopicService } from './services/TopicGraphService';

/**
 * Main plugin class for Notebook Navigator
 * Provides a Notes-style file explorer for Obsidian with two-pane layout
 * Manages plugin lifecycle, settings, and view registration
 */
export default class NotebookNavigatorPlugin extends Plugin implements ISettingsProvider {
    settings: NotebookNavigatorSettings;
    ribbonIconEl: HTMLElement | undefined = undefined;
    metadataService: MetadataService | null = null;
    tagOperations: TagOperations | null = null;
    tagTreeService: TagTreeService | null = null;
    topicService: TopicService | null = null;
    commandQueue: CommandQueueService | null = null;
    fileSystemOps: FileSystemOperations | null = null;
    omnisearchService: OmnisearchService | null = null;
    externalIconController: ExternalIconProviderController | null = null;
    api: NotebookNavigatorAPI | null = null;
    recentNotesService: RecentNotesService | null = null;
    releaseCheckService: ReleaseCheckService | null = null;
    // Map of callbacks to notify open React views when settings change
    private settingsUpdateListeners = new Map<string, () => void>();
    // Map of callbacks to notify open React views when files are renamed
    private fileRenameListeners = new Map<string, (oldPath: string, newPath: string) => void>();
    private recentDataListeners = new Map<string, () => void>();
    private updateNoticeListeners = new Map<string, (notice: ReleaseUpdateNotice | null) => void>();
    // Flag indicating plugin is being unloaded to prevent operations during shutdown
    private isUnloading = false;
    // User preference for dual-pane mode (persisted in localStorage, not settings)
    private dualPanePreference = true;
    // Manages recent notes and icons data persistence
    private recentDataManager: RecentDataManager | null = null;
    // Coordinates workspace interactions with the navigator view
    private workspaceCoordinator: WorkspaceCoordinator | null = null;
    // Handles homepage file opening and startup behavior
    private homepageController: HomepageController | null = null;
    private pendingUpdateNotice: ReleaseUpdateNotice | null = null;

    // Keys used for persisting UI state in browser localStorage
    keys: LocalStorageKeys = STORAGE_KEYS;

    /**
     * Called when external changes to settings are detected (e.g., from sync)
     * This method is called automatically by Obsidian when the data.json file
     * is modified externally while the plugin is running
     */
    async onExternalSettingsChange() {
        if (!this.isUnloading) {
            await this.loadSettings();
            this.initializeRecentDataManager();
            this.onSettingsUpdate();
        }
    }

    /**
     * Loads plugin settings from Obsidian's data storage
     * Returns true if this is the first launch (no saved data)
     */
    async loadSettings(): Promise<boolean> {
        const data = await this.loadData();
        const isFirstLaunch = !data; // No saved data means first launch

        // Start with default settings
        this.settings = { ...DEFAULT_SETTINGS, ...(data || {}) };
        // Validate and normalize keyboard shortcuts to use standard modifier names
        this.settings.keyboardShortcuts = sanitizeKeyboardShortcuts(this.settings.keyboardShortcuts);

        // Remove deprecated fields from settings object
        const mutableSettings = this.settings as unknown as Record<string, unknown>;
        delete mutableSettings.recentNotes;
        delete mutableSettings.recentIcons;

        const legacyColorFileTags = mutableSettings['applyTagColorsToFileTags'];
        if (typeof legacyColorFileTags === 'boolean') {
            this.settings.colorFileTags = legacyColorFileTags;
        }
        delete mutableSettings['applyTagColorsToFileTags'];

        // Migrate legacy navigationBannerPath field to navigationBanner
        const legacyBanner = data && typeof data === 'object' ? (data as Record<string, unknown>).navigationBannerPath : undefined;
        if (!this.settings.navigationBanner && typeof legacyBanner === 'string' && legacyBanner.length > 0) {
            this.settings.navigationBanner = legacyBanner;
        }
        delete mutableSettings.navigationBannerPath;

        // Set language-specific date/time formats if not already set
        if (!this.settings.dateFormat) {
            this.settings.dateFormat = getDefaultDateFormat();
        }
        if (!this.settings.timeFormat) {
            this.settings.timeFormat = getDefaultTimeFormat();
        }

        if (typeof this.settings.recentNotesCount !== 'number' || this.settings.recentNotesCount <= 0) {
            this.settings.recentNotesCount = DEFAULT_SETTINGS.recentNotesCount;
        }

        if (!Array.isArray(this.settings.rootFolderOrder)) {
            this.settings.rootFolderOrder = [];
        }

        if (!Array.isArray(this.settings.rootTagOrder)) {
            this.settings.rootTagOrder = [];
        }

        // Initialize update check setting with default value for existing users
        if (typeof this.settings.checkForUpdatesOnStart !== 'boolean') {
            this.settings.checkForUpdatesOnStart = true;
        }

        return isFirstLaunch;
    }

    /**
     * Sets up the recent data manager and loads persisted data.
     */
    private initializeRecentDataManager(): void {
        // Create manager instance on first call
        if (!this.recentDataManager) {
            this.recentDataManager = new RecentDataManager({
                settings: this.settings,
                keys: this.keys,
                onRecentDataChange: () => this.notifyRecentDataUpdate()
            });
        }

        // Load recent notes and icons from local storage
        this.recentDataManager.initialize();
    }

    /**
     * Returns the list of recent note paths from local storage
     */
    public getRecentNotes(): string[] {
        return this.recentDataManager?.getRecentNotes() ?? [];
    }

    /**
     * Stores the list of recent note paths to local storage
     */
    public setRecentNotes(recentNotes: string[]): void {
        this.recentDataManager?.setRecentNotes(recentNotes);
    }

    /**
     * Trims the recent notes list to the configured maximum count
     */
    public applyRecentNotesLimit(): void {
        this.recentDataManager?.applyRecentNotesLimit();
    }

    /**
     * Registers a listener to be notified when recent data changes
     */
    public registerRecentDataListener(id: string, callback: () => void): void {
        this.recentDataListeners.set(id, callback);
    }

    /**
     * Unregisters a recent data change listener
     */
    public unregisterRecentDataListener(id: string): void {
        this.recentDataListeners.delete(id);
    }

    /**
     * Registers a listener that will be notified when release update notices change.
     */
    public registerUpdateNoticeListener(id: string, callback: (notice: ReleaseUpdateNotice | null) => void): void {
        this.updateNoticeListeners.set(id, callback);
    }

    /**
     * Removes an update notice listener.
     */
    public unregisterUpdateNoticeListener(id: string): void {
        this.updateNoticeListeners.delete(id);
    }

    /**
     * Returns the current pending update notice, if any.
     */
    public getPendingUpdateNotice(): ReleaseUpdateNotice | null {
        return this.pendingUpdateNotice;
    }

    /**
     * Marks the update notice as shown so it will not display again.
     */
    public async markUpdateNoticeAsDisplayed(version: string): Promise<void> {
        if (this.settings.lastAnnouncedRelease === version) {
            return;
        }

        this.settings.lastAnnouncedRelease = version;

        if (this.pendingUpdateNotice && this.pendingUpdateNotice.version === version) {
            this.setPendingUpdateNotice(null);
        }

        await this.saveSettingsAndUpdate();
    }

    /**
     * Returns the map of recent icon IDs per provider from local storage
     */
    public getRecentIcons(): Record<string, string[]> {
        return this.recentDataManager?.getRecentIcons() ?? {};
    }

    /**
     * Stores the map of recent icon IDs per provider to local storage
     */
    public setRecentIcons(recentIcons: Record<string, string[]>): void {
        this.recentDataManager?.setRecentIcons(recentIcons);
    }

    /**
     * Checks if the given file is open in the right sidebar
     */
    public isFileInRightSidebar(file: TFile): boolean {
        if (!this.settings.autoRevealIgnoreRightSidebar) {
            return false;
        }

        const view = this.app.workspace.getActiveViewOfType(FileView);
        if (!view?.file || view.file.path !== file.path) {
            return false;
        }

        const split = getLeafSplitLocation(this.app, view.leaf ?? null);
        return split === 'right-sidebar';
    }

    /**
     * Plugin initialization - called when plugin is enabled
     */
    async onload() {
        // Initialize localStorage before database so version checks work
        localStorage.init(this.app);

        // Initialize database early for StorageContext consumers
        try {
            const appId = (this.app as ExtendedApp).appId || '';
            await initializeDatabase(appId);
        } catch (e) {
            console.error('Failed to initialize database during plugin load:', e);
            // Fail fast: abort plugin load if database cannot initialize
            throw e instanceof Error ? e : new Error(String(e));
        }

        // Load settings and check if this is first launch
        const isFirstLaunch = await this.loadSettings();
        const storedDualPane = localStorage.get<unknown>(this.keys.dualPaneKey);
        const parsedDualPane = this.parseDualPanePreference(storedDualPane);
        this.dualPanePreference = parsedDualPane ?? true;

        const storedLocalStorageVersion = localStorage.get<number>(STORAGE_KEYS.localStorageVersionKey);

        // Handle first launch initialization
        if (isFirstLaunch) {
            // Normalize all tag settings to lowercase
            this.normalizeTagSettings();

            // Clear all localStorage data (if plugin was reinstalled)
            this.clearAllLocalStorage();

            // Reset dual-pane preference to default on fresh install
            this.dualPanePreference = true;

            // Ensure root folder is expanded on first launch (default is enabled)
            if (this.settings.showRootFolder) {
                const expandedFolders = ['/'];
                localStorage.set(STORAGE_KEYS.expandedFoldersKey, expandedFolders);
            }

            // Set localStorage version
            localStorage.set(STORAGE_KEYS.localStorageVersionKey, LOCALSTORAGE_VERSION);
        } else {
            // Check localStorage version for potential migrations
            const versionNumber =
                typeof storedLocalStorageVersion === 'number' ? storedLocalStorageVersion : Number(storedLocalStorageVersion ?? Number.NaN);
            if (!versionNumber || versionNumber !== LOCALSTORAGE_VERSION) {
                // Future localStorage migration logic can go here
                localStorage.set(STORAGE_KEYS.localStorageVersionKey, LOCALSTORAGE_VERSION);
            }
        }

        // Initialize recent data management
        this.initializeRecentDataManager();

        this.recentNotesService = new RecentNotesService(this);

        // Initialize workspace and homepage coordination
        this.workspaceCoordinator = new WorkspaceCoordinator(this);
        this.homepageController = new HomepageController(this, this.workspaceCoordinator);

        // Initialize services
        this.metadataService = new MetadataService(this.app, this, () => this.tagTreeService);
        this.tagOperations = new TagOperations(this.app);
        this.tagTreeService = new TagTreeService();
        this.topicService = new TopicService();
        this.commandQueue = new CommandQueueService(this.app);
        this.fileSystemOps = new FileSystemOperations(
            this.app,
            () => this.tagTreeService,
            () => this.topicService,
            () => this.commandQueue
        );
        this.omnisearchService = new OmnisearchService(this.app);
        this.api = new NotebookNavigatorAPI(this, this.app);
        this.releaseCheckService = new ReleaseCheckService(this);

        const iconService = getIconService();
        this.externalIconController = new ExternalIconProviderController(this.app, iconService, this);
        await this.externalIconController.initialize();
        void this.externalIconController.syncWithSettings();

        this.registerSettingsUpdateListener('external-icon-controller', () => {
            void this.externalIconController?.syncWithSettings();
        });

        // Register view
        this.registerView(NOTEBOOK_NAVIGATOR_VIEW, leaf => {
            return new NotebookNavigatorView(leaf, this);
        });

        // Register commands
        registerNavigatorCommands(this);

        // ==== Settings tab ====
        this.addSettingTab(new NotebookNavigatorSettingTab(this.app, this));

        // Register editor context menu
        registerWorkspaceEvents(this);

        // Post-layout initialization
        // Only auto-create the navigator view on first launch; upgrades restore existing leaves themselves
        const shouldActivateOnStartup = isFirstLaunch;

        this.app.workspace.onLayoutReady(async () => {
            if (this.isUnloading) {
                return;
            }

            await this.homepageController?.handleWorkspaceReady({ shouldActivateOnStartup });

            // Check for version updates
            await this.checkForVersionUpdate();

            // Trigger Style Settings plugin to parse our settings
            this.app.workspace.trigger('parse-style-settings');

            // Check for new GitHub releases if enabled
            if (this.settings.checkForUpdatesOnStart) {
                void this.runReleaseUpdateCheck();
            }
        });
    }

    /**
     * Register a callback to be notified when settings are updated
     * Used by React views to trigger re-renders
     */
    public registerSettingsUpdateListener(id: string, callback: () => void): void {
        this.settingsUpdateListeners.set(id, callback);
    }

    /**
     * Returns whether dual-pane mode is enabled
     */
    public useDualPane(): boolean {
        return this.dualPanePreference;
    }

    public isShuttingDown(): boolean {
        return this.isUnloading;
    }

    /**
     * Updates the dual-pane preference and persists to local storage
     */
    public setDualPanePreference(enabled: boolean): void {
        if (this.dualPanePreference === enabled) {
            return;
        }

        this.dualPanePreference = enabled;
        localStorage.set(this.keys.dualPaneKey, enabled ? '1' : '0');
        this.notifySettingsUpdate();
    }

    /**
     * Toggles the dual-pane preference between enabled and disabled
     */
    public toggleDualPanePreference(): void {
        this.setDualPanePreference(!this.dualPanePreference);
    }

    /**
     * Parses dual-pane preference from local storage string value
     */
    private parseDualPanePreference(raw: unknown): boolean | null {
        if (typeof raw === 'string') {
            return raw === '1';
        }

        return false;
    }

    /**
     * Unregister a settings update callback
     * Called when React views unmount to prevent memory leaks
     */
    public unregisterSettingsUpdateListener(id: string): void {
        this.settingsUpdateListeners.delete(id);
    }

    /**
     * Rebuilds the entire Notebook Navigator cache.
     * Activates the view if needed and delegates to the view's rebuild method.
     * Throws if plugin is unloading or view is not available.
     */
    public async rebuildCache(): Promise<void> {
        // Prevent rebuild if plugin is being unloaded
        if (this.isUnloading) {
            throw new Error('Plugin is unloading');
        }

        // Ensure the Navigator view is active before rebuilding
        await this.activateView();

        // Find the Navigator view leaf in the workspace
        const leaf = this.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW)[0];
        if (!leaf) {
            throw new Error('Notebook Navigator view not available');
        }

        // Get the view instance and delegate the rebuild operation
        const { view } = leaf;
        if (!(view instanceof NotebookNavigatorView)) {
            throw new Error('Notebook Navigator view not found');
        }

        await view.rebuildCache();
    }

    public isExternalIconProviderInstalled(providerId: ExternalIconProviderId): boolean {
        return this.externalIconController?.isProviderInstalled(providerId) ?? false;
    }

    public isExternalIconProviderDownloading(providerId: ExternalIconProviderId): boolean {
        return this.externalIconController?.isProviderDownloading(providerId) ?? false;
    }

    public getExternalIconProviderVersion(providerId: ExternalIconProviderId): string | null {
        return this.externalIconController?.getProviderVersion(providerId) ?? null;
    }

    public async downloadExternalIconProvider(providerId: ExternalIconProviderId): Promise<void> {
        if (!this.externalIconController) {
            throw new Error('External icon controller not initialized');
        }
        await this.externalIconController.installProvider(providerId);
    }

    public async removeExternalIconProvider(providerId: ExternalIconProviderId): Promise<void> {
        if (!this.externalIconController) {
            throw new Error('External icon controller not initialized');
        }
        await this.externalIconController.removeProvider(providerId);
    }

    /**
     * Register a callback to be notified when files are renamed
     * Used by React views to update selection state
     */
    public registerFileRenameListener(id: string, callback: (oldPath: string, newPath: string) => void): void {
        this.fileRenameListeners.set(id, callback);
    }

    /**
     * Unregister a file rename callback
     * Called when React views unmount to prevent memory leaks
     */
    public unregisterFileRenameListener(id: string): void {
        this.fileRenameListeners.delete(id);
    }

    public notifyFileRenameListeners(oldPath: string, newPath: string): void {
        this.fileRenameListeners.forEach(callback => {
            try {
                callback(oldPath, newPath);
            } catch (error) {
                console.error('Error in file rename listener:', error);
            }
        });
    }

    /**
     * Plugin cleanup - called when plugin is disabled or updated
     * Removes ribbon icon but preserves open views to maintain user workspace
     * Per Obsidian guidelines: leaves should not be detached in onunload
     */
    onunload() {
        // Set unloading flag to prevent any new operations
        this.isUnloading = true;

        this.recentDataManager?.dispose();

        // Clear all listeners first to prevent any callbacks during cleanup
        this.settingsUpdateListeners.clear();
        this.fileRenameListeners.clear();
        this.recentDataListeners.clear();

        if (this.externalIconController) {
            this.externalIconController.dispose();
            this.externalIconController = null;
        }

        // Clean up the metadata service
        if (this.metadataService) {
            // Clear the reference to break circular dependencies
            this.metadataService = null;
        }

        // Clean up the tag operations service
        if (this.tagOperations) {
            this.tagOperations = null;
        }

        // Clean up the command queue service
        if (this.commandQueue) {
            this.commandQueue.clearAllOperations();
            this.commandQueue = null;
        }

        // First, stop any background content processing in all navigator views
        try {
            const leaves = this.app.workspace.getLeavesOfType(NOTEBOOK_NAVIGATOR_VIEW);
            for (const leaf of leaves) {
                const view = leaf.view;
                if (view instanceof NotebookNavigatorView) {
                    view.stopContentProcessing();
                }
            }
        } catch (e) {
            console.error('Failed stopping content processing during unload:', e);
        }

        // Clean up the ribbon icon
        this.ribbonIconEl?.remove();
        this.ribbonIconEl = undefined;

        this.omnisearchService = null;
        this.recentDataManager = null;

        // Shutdown database after all processing is stopped
        shutdownDatabase();
    }

    /**
     * Clears all localStorage data for the plugin
     * Called on fresh install to ensure a clean start
     */
    private clearAllLocalStorage() {
        // Clear all known localStorage keys
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.remove(key);
        });
    }

    /**
     * Normalizes tag-related settings to use lowercase keys
     * Ensures consistency regardless of manual edits or external changes
     * Preserves values while standardizing keys to lowercase
     */
    private normalizeTagSettings() {
        const normalizeRecord = <T>(record: Record<string, T> | undefined): Record<string, T> => {
            if (!record) return {};

            const normalized: Record<string, T> = {};
            for (const [key, value] of Object.entries(record)) {
                const lowerKey = key.toLowerCase();
                // If there's a conflict (e.g., both "TODO" and "todo"), last one wins
                normalized[lowerKey] = value;
            }
            return normalized;
        };

        const normalizeArray = (array: string[] | undefined): string[] => {
            if (!array) return [];
            // Use Set to deduplicate in case of "TODO" and "todo" both present
            return [...new Set(array.map(s => s.toLowerCase()))];
        };

        if (this.settings.tagColors) {
            this.settings.tagColors = normalizeRecord(this.settings.tagColors);
        }

        if (this.settings.tagBackgroundColors) {
            this.settings.tagBackgroundColors = normalizeRecord(this.settings.tagBackgroundColors);
        }

        if (this.settings.tagIcons) {
            this.settings.tagIcons = normalizeRecord(this.settings.tagIcons);
        }

        if (this.settings.tagSortOverrides) {
            this.settings.tagSortOverrides = normalizeRecord(this.settings.tagSortOverrides);
        }

        if (this.settings.tagAppearances) {
            this.settings.tagAppearances = normalizeRecord(this.settings.tagAppearances);
        }

        if (this.settings.hiddenTags) {
            this.settings.hiddenTags = normalizeArray(this.settings.hiddenTags);
        }
    }

    /**
     * Saves current plugin settings to Obsidian's data storage and notifies listeners
     * Persists user preferences between sessions and triggers UI updates
     * Called whenever settings are modified
     */
    async saveSettingsAndUpdate() {
        await this.saveData(this.settings);
        // Notify all listeners that settings have been updated
        this.onSettingsUpdate();
    }

    /**
     * Notifies all registered listeners that settings have changed
     */
    public notifySettingsUpdate(): void {
        this.onSettingsUpdate();
    }

    /**
     * Removes unused metadata entries from settings and saves
     */
    public async runMetadataCleanup(): Promise<boolean> {
        if (!this.metadataService || this.isUnloading) {
            return false;
        }

        const changesMade = await this.metadataService.cleanupAllMetadata();
        if (changesMade) {
            await this.saveSettingsAndUpdate();
        }

        return changesMade;
    }

    /**
     * Returns a summary of how many unused metadata entries exist
     */
    public async getMetadataCleanupSummary(): Promise<MetadataCleanupSummary> {
        if (!this.metadataService || this.isUnloading) {
            return { folders: 0, tags: 0, files: 0, pinnedNotes: 0, total: 0 };
        }

        return this.metadataService.getCleanupSummary();
    }

    /**
     * Notifies all running views that the settings have been updated.
     * This triggers a re-render in the React components.
     */
    public onSettingsUpdate() {
        if (this.isUnloading) return;

        // Update API caches with new settings
        if (this.api) {
            if (this.api.metadata) {
                this.api.metadata.updateFromSettings(this.settings);
            }
        }

        // Create a copy of listeners to avoid issues if a callback modifies the map
        const listeners = Array.from(this.settingsUpdateListeners.values());
        listeners.forEach(callback => {
            try {
                callback();
            } catch {
                // Silently ignore errors from settings update callbacks
            }
        });
    }

    /**
     * Notifies all registered listeners about recent data changes
     */
    private notifyRecentDataUpdate(): void {
        if (this.isUnloading) {
            return;
        }

        // Call each registered listener callback
        const listeners = Array.from(this.recentDataListeners.values());
        listeners.forEach(callback => {
            try {
                callback();
            } catch {
                // Silently ignore errors from recent data callbacks
            }
        });
    }

    /**
     * Sets the visibility of hidden items (folders and/or tags)
     * @param value - The new value for showHiddenItems setting
     */
    public async showHiddenItems(value: boolean) {
        this.settings.showHiddenItems = value;
        await this.saveSettingsAndUpdate();
    }

    /**
     * Activates or creates the Notebook Navigator view
     * Reuses existing view if available, otherwise creates new one in left sidebar
     * Always reveals the view to ensure it's visible
     * @returns The workspace leaf containing the view, or null if creation failed
     */
    async activateView() {
        return this.workspaceCoordinator?.activateNavigatorView() ?? null;
    }

    /**
     * Navigates to a specific file in the navigator
     * Expands parent folders and scrolls to make the file visible
     * Note: This does NOT activate/show the view - callers must do that if needed
     * @param file - The file to navigate to in the navigator
     */
    async revealFileInActualFolder(file: TFile, options?: RevealFileOptions) {
        this.workspaceCoordinator?.revealFileInActualFolder(file, options);
    }

    /**
     * Reveals a file while preserving the nearest visible folder/tag context
     * @param file - File to surface in the navigator
     * @param options - Reveal behavior options
     */
    async revealFileInNearestFolder(file: TFile, options?: RevealFileOptions) {
        this.workspaceCoordinator?.revealFileInNearestFolder(file, options);
    }

    /**
     * Reveals a topic in the navigation pane
     * Expands parent topics and scrolls to make the topic visible
     * @param topicName - The name of the topic to reveal
     */
    async revealTopic(topicName: string) {
        this.workspaceCoordinator?.revealTopic(topicName);
    }

    /**
     * Reveals a topic in the navigation pane by expanding ALL paths to root nodes
     * This is useful when a topic appears in multiple places in the hierarchy
     * @param topicName - The name of the topic to reveal
     */
    async revealTopicAllPaths(topicName: string) {
        this.workspaceCoordinator?.revealTopicAllPaths(topicName);
    }

    public resolveHomepageFile(): TFile | null {
        return this.homepageController?.resolveHomepageFile() ?? null;
    }

    public async openHomepage(trigger: 'startup' | 'command'): Promise<boolean> {
        return this.homepageController?.open(trigger) ?? false;
    }

    /**
     * Checks for new GitHub releases and updates the pending notice if a newer version is found.
     * @param force - If true, bypasses the minimum check interval
     */
    public async runReleaseUpdateCheck(force = false): Promise<void> {
        await this.evaluateReleaseUpdates(force);
    }

    /**
     * Clears the pending update notice without marking it as displayed.
     */
    public dismissPendingUpdateNotice(): void {
        this.setPendingUpdateNotice(null);
    }

    /**
     * Performs the actual release check and updates the pending notice.
     */
    private async evaluateReleaseUpdates(force = false): Promise<void> {
        if (!this.releaseCheckService || this.isUnloading) {
            return;
        }

        if (!this.settings.checkForUpdatesOnStart && !force) {
            return;
        }

        try {
            const notice = await this.releaseCheckService.checkForUpdates(force);
            this.setPendingUpdateNotice(notice ?? null);
        } catch {
            // Ignore release check failures silently
        }
    }

    /**
     * Updates the pending notice and notifies all listeners.
     * Skips notification if the notice hasn't actually changed.
     */
    private setPendingUpdateNotice(notice: ReleaseUpdateNotice | null): void {
        const currentVersion = this.pendingUpdateNotice?.version ?? null;
        const incomingVersion = notice?.version ?? null;
        const hasNotice = !!notice;
        const hadNotice = !!this.pendingUpdateNotice;

        // Skip if notice hasn't changed
        if (currentVersion === incomingVersion && hasNotice === hadNotice) {
            return;
        }

        this.pendingUpdateNotice = notice;

        if (!notice) {
            this.releaseCheckService?.clearPendingNotice();
        }

        this.notifyUpdateNoticeListeners();
    }

    /**
     * Notifies all registered listeners about the current update notice state.
     */
    private notifyUpdateNoticeListeners(): void {
        if (this.isUnloading) {
            return;
        }

        const listeners = Array.from(this.updateNoticeListeners.values());
        listeners.forEach(callback => {
            try {
                callback(this.pendingUpdateNotice);
            } catch {
                // Ignore listener errors to avoid breaking notification flow
            }
        });
    }

    /**
     * Check if the plugin has been updated and show release notes if needed
     */
    private async checkForVersionUpdate(): Promise<void> {
        // Get current version from manifest
        const currentVersion = this.manifest.version;

        // Get last shown version from settings
        const lastShownVersion = this.settings.lastShownVersion;

        // Don't show on first install (when lastShownVersion is empty)
        if (!lastShownVersion) {
            return;
        }

        // Check if version has changed
        if (lastShownVersion !== currentVersion) {
            // Import release notes helpers dynamically
            const { getReleaseNotesBetweenVersions, getLatestReleaseNotes, compareVersions, isReleaseAutoDisplayEnabled } = await import(
                './releaseNotes'
            );

            if (!isReleaseAutoDisplayEnabled(currentVersion)) {
                return;
            }

            const { WhatsNewModal } = await import('./modals/WhatsNewModal');

            // Get release notes between versions
            let releaseNotes;
            if (compareVersions(currentVersion, lastShownVersion) > 0) {
                // Show notes from last shown to current
                releaseNotes = getReleaseNotesBetweenVersions(lastShownVersion, currentVersion);
            } else {
                // Downgraded or same version - just show latest 5 releases
                releaseNotes = getLatestReleaseNotes();
            }

            // Show the info modal when version changes
            new WhatsNewModal(this.app, releaseNotes, this.settings.dateFormat, () => {
                // Save version after 1 second delay when user closes the modal
                setTimeout(async () => {
                    this.settings.lastShownVersion = currentVersion;
                    await this.saveSettingsAndUpdate();
                }, 1000);
            }).open();
        }
    }
}
