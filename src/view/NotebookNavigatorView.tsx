import React from 'react';
import { Root, createRoot } from 'react-dom/client';
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

// src/view/NotebookNavigatorView.tsx
import { ItemView, WorkspaceLeaf, TFile, Platform } from 'obsidian';
import { NotebookNavigatorContainer } from '../components/NotebookNavigatorContainer';
import type { NotebookNavigatorHandle } from '../components/NotebookNavigatorComponent';
import type { RevealFileOptions } from '../hooks/useNavigatorReveal';
import { ExpansionProvider } from '../context/ExpansionContext';
import { SelectionProvider } from '../context/SelectionContext';
import { ServicesProvider } from '../context/ServicesContext';
import { SettingsProvider } from '../context/SettingsContext';
import { StorageProvider } from '../context/StorageContext';
import { UIStateProvider } from '../context/UIStateContext';
import { ShortcutsProvider } from '../context/ShortcutsContext';
import { RecentDataProvider } from '../context/RecentDataContext';
import { strings } from '../i18n';
import NotebookNavigatorPlugin from '../main';
import { NOTEBOOK_NAVIGATOR_VIEW } from '../types';

/**
 * Custom Obsidian view that hosts the React-based Notebook Navigator interface
 * Manages the lifecycle of the React application and provides integration between
 * Obsidian's view system and the React component tree
 */
export class NotebookNavigatorView extends ItemView {
    private componentRef = React.createRef<NotebookNavigatorHandle>();
    plugin: NotebookNavigatorPlugin;
    private root: Root | null = null;

    /**
     * Creates a new NotebookNavigatorView instance
     * @param leaf - The workspace leaf that contains this view
     * @param plugin - The plugin instance for accessing settings and methods
     */
    constructor(leaf: WorkspaceLeaf, plugin: NotebookNavigatorPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    /**
     * Returns the unique identifier for this view type
     * @returns The view type constant used by Obsidian to manage this view
     */
    getViewType() {
        return NOTEBOOK_NAVIGATOR_VIEW;
    }

    /**
     * Returns the display text shown in the view header
     * @returns The human-readable name of this view
     */
    getDisplayText() {
        return strings.plugin.viewName;
    }

    /**
     * Returns the icon identifier for this view
     * @returns The Obsidian icon name to display in tabs and headers
     */
    getIcon() {
        return 'notebook';
    }

    /**
     * Called when the view is opened/created
     * Initializes the React application within the Obsidian view container
     * Sets up the component hierarchy with necessary context providers
     */
    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty(); // Clear previous content
        container.classList.add('notebook-navigator');

        // Detect mobile environment and add mobile class
        const isMobile = Platform.isMobile;
        if (isMobile) {
            container.classList.add('notebook-navigator-mobile');

            // Add platform-specific classes
            if (Platform.isAndroidApp) {
                container.classList.add('notebook-navigator-android');
            } else if (Platform.isIosApp) {
                container.classList.add('notebook-navigator-ios');
            }
        }

        this.root = createRoot(container);
        this.root.render(
            <React.StrictMode>
                <SettingsProvider plugin={this.plugin}>
                    <RecentDataProvider plugin={this.plugin}>
                        <ServicesProvider plugin={this.plugin}>
                            <ShortcutsProvider>
                                <StorageProvider app={this.plugin.app} api={this.plugin.api}>
                                    <ExpansionProvider>
                                        <SelectionProvider
                                            app={this.plugin.app}
                                            api={this.plugin.api}
                                            tagTreeService={this.plugin.tagTreeService}
                                            topicService={this.plugin.topicService}
                                            onFileRename={this.plugin.registerFileRenameListener.bind(this.plugin)}
                                            onFileRenameUnsubscribe={this.plugin.unregisterFileRenameListener.bind(this.plugin)}
                                            isMobile={isMobile}
                                        >
                                            <UIStateProvider isMobile={isMobile}>
                                                <NotebookNavigatorContainer ref={this.componentRef} />
                                            </UIStateProvider>
                                        </SelectionProvider>
                                    </ExpansionProvider>
                                </StorageProvider>
                            </ShortcutsProvider>
                        </ServicesProvider>
                    </RecentDataProvider>
                </SettingsProvider>
            </React.StrictMode>
        );
    }

    /**
     * Called when the view is closed/destroyed
     * Properly unmounts the React application to prevent memory leaks
     * Cleans up any view-specific classes and resources
     */
    async onClose() {
        // Unmount the React app when the view is closed to prevent memory leaks
        const container = this.containerEl.children[1];
        container.classList.remove('notebook-navigator');
        // Also remove mobile/platform-specific classes added on open
        container.classList.remove('notebook-navigator-mobile');
        container.classList.remove('notebook-navigator-android');
        container.classList.remove('notebook-navigator-ios');
        this.root?.unmount();
        // Ensure container is cleared after unmount
        container.empty();
        this.root = null;
    }

    /**
     * Stops all background content processing (providers) within this view's React tree
     */
    stopContentProcessing() {
        this.componentRef.current?.stopContentProcessing();
    }

    /**
     * Triggers a complete cache rebuild through the component hierarchy.
     * Clears and rebuilds all cached data from the current vault state.
     */
    async rebuildCache(): Promise<void> {
        // Delegate to the main component which handles the actual rebuild
        const handle = this.componentRef.current;
        if (!handle) {
            throw new Error('Navigator not ready');
        }
        await handle.rebuildCache();
    }

    /**
     * Navigates to a file by revealing it in its actual parent folder
     */
    navigateToFile(file: TFile, options?: RevealFileOptions) {
        this.componentRef.current?.navigateToFile(file, options);
    }

    /**
     * Reveals a file while attempting to preserve the current navigation context
     */
    revealFileInNearestFolder(file: TFile, options?: RevealFileOptions) {
        this.componentRef.current?.revealFileInNearestFolder(file, options);
    }

    /**
     * Reveals a topic in the navigation pane
     * Expands parent topics and scrolls to make the topic visible
     */
    revealTopic(topicName: string) {
        this.componentRef.current?.revealTopic(topicName);
    }

    /**
     * Reveals a topic by expanding all paths to root nodes
     * This is useful when a topic appears in multiple places in the hierarchy
     */
    revealTopicAllPaths(topicName: string) {
        this.componentRef.current?.revealTopicAllPaths(topicName);
    }

    /**
     * Moves focus to the visible pane without forcing a view switch
     */
    focusVisiblePane() {
        this.componentRef.current?.focusVisiblePane();
    }

    /**
     * Refreshes the UI by triggering a settings version update
     */
    refresh() {
        this.componentRef.current?.refresh();
    }

    /**
     * Deletes the currently active file using smart selection
     */
    deleteActiveFile() {
        this.componentRef.current?.deleteActiveFile();
    }

    /**
     * Creates a new note in the currently selected folder
     */
    async createNoteInSelectedFolder(): Promise<void> {
        await this.componentRef.current?.createNoteInSelectedFolder();
    }

    /**
     * Moves selected files to another folder using the folder suggest modal
     */
    async moveSelectedFiles(): Promise<void> {
        await this.componentRef.current?.moveSelectedFiles();
    }

    /**
     * Adds the current navigator selection or active file to shortcuts
     */
    async addShortcutForCurrentSelection(): Promise<void> {
        await this.componentRef.current?.addShortcutForCurrentSelection();
    }

    /**
     * Navigate to a folder by showing the folder suggest modal
     */
    async navigateToFolderWithModal(): Promise<void> {
        this.componentRef.current?.navigateToFolderWithModal();
    }

    /**
     * Navigate to a tag by showing the tag suggest modal
     */
    async navigateToTagWithModal(): Promise<void> {
        this.componentRef.current?.navigateToTagWithModal();
    }

    /**
     * Add a tag to the currently selected files
     */
    async addTagToSelectedFiles(): Promise<void> {
        await this.componentRef.current?.addTagToSelectedFiles();
    }

    /**
     * Remove a tag from the currently selected files
     */
    async removeTagFromSelectedFiles(): Promise<void> {
        await this.componentRef.current?.removeTagFromSelectedFiles();
    }

    /**
     * Remove all tags from the currently selected files
     */
    async removeAllTagsFromSelectedFiles(): Promise<void> {
        await this.componentRef.current?.removeAllTagsFromSelectedFiles();
    }

    /**
     * Toggle search in the file list
     */
    toggleSearch(): void {
        this.componentRef.current?.toggleSearch();
    }

    /**
     * Trigger collapse/expand all
     */
    triggerCollapse(): void {
        this.componentRef.current?.triggerCollapse();
    }

    /**
     * Called when view is resized
     * Triggered when the view dimensions change, including:
     * - Mobile drawer animations (swipe to show/hide)
     * - Desktop pane resizing
     * - Window size changes
     *
     * Mobile visibility detection:
     * On mobile, when the plugin drawer is hidden (display: none), dimensions are 0x0.
     * When the drawer becomes visible again, dimensions become > 0.
     * We use this as a visibility lifecycle event (similar to iOS/Android's viewDidAppear)
     * to trigger auto-scroll to the selected file, ensuring users see their current file
     * when returning to the navigator after it was hidden.
     *
     * This solves the issue where users:
     * 1. Have the navigator open with a file selected
     * 2. Swipe away to edit files in the editor
     * 3. Open different files while navigator is hidden
     * 4. Swipe back to the navigator
     * 5. Expect to see the currently active file (but without this, the virtualizer wouldn't scroll at all
     *    because the file selection changed while the component was hidden/display:none)
     */
    onResize() {
        if (!Platform.isMobile) return;

        const rect = this.containerEl.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
            window.dispatchEvent(new CustomEvent('notebook-navigator-visible'));
        }
    }
}
