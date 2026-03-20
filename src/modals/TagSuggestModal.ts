/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2025-2026 Johan Sanneblad
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

import { App, FuzzyMatch } from 'obsidian';
import { strings } from '../i18n';
import { TagTreeNode } from '../types/storage';
import { BaseSuggestModal } from './BaseSuggestModal';
import NotebookNavigatorPlugin from '../main';
import { hasValidTagCharacters } from '../utils/tagUtils';
import { normalizeTagPathValue } from '../utils/tagPrefixMatcher';

export function hasExactTagSuggestionMatch(input: string, suggestions: readonly FuzzyMatch<TagTreeNode>[]): boolean {
    const normalizedInput = normalizeTagPathValue(input);
    if (!normalizedInput) {
        return false;
    }

    return suggestions.some(suggestion => suggestion.item.path === normalizedInput);
}

/**
 * Modal for selecting a tag to navigate to
 * Uses Obsidian's FuzzySuggestModal for fuzzy search and familiar UI
 */
export class TagSuggestModal extends BaseSuggestModal<TagTreeNode> {
    private allowTagCreation: boolean;
    private plugin: NotebookNavigatorPlugin;
    private currentInput: string = '';
    private createNewNode: TagTreeNode | null = null;

    /**
     * Creates a new TagSuggestModal
     * @param app - The Obsidian app instance
     * @param plugin - The NotebookNavigator plugin instance
     * @param onChooseTag - Callback when a tag is selected
     * @param placeholderText - Placeholder text for the search input
     * @param actionText - Action text for the enter key instruction
     * @param allowTagCreation - Whether to show the create-tag option for new inputs
     */
    constructor(
        app: App,
        plugin: NotebookNavigatorPlugin,
        onChooseTag: (tag: string) => void,
        placeholderText: string,
        actionText: string,
        allowTagCreation: boolean = true
    ) {
        // Pass tag node to base, but store the string callback separately
        super(
            app,
            (tagNode: TagTreeNode) => {
                // Handle special cases
                if (tagNode.path === '__create_new__' && this.currentInput) {
                    onChooseTag(this.currentInput);
                } else {
                    // Use displayPath to preserve canonical casing
                    onChooseTag(tagNode.displayPath);
                }
            },
            placeholderText,
            {
                navigate: strings.modals.tagSuggest.instructions.navigate,
                action: actionText,
                dismiss: strings.modals.tagSuggest.instructions.dismiss
            }
        );
        this.plugin = plugin;
        this.allowTagCreation = allowTagCreation;
    }

    /**
     * Override getSuggestions to add "Create new tag" option when appropriate
     */
    getSuggestions(query: string): FuzzyMatch<TagTreeNode>[] {
        this.currentInput = query.trim();

        // Get the default suggestions
        const suggestions = super.getSuggestions(query);

        // If query is empty or invalid, don't show create option
        if (!this.allowTagCreation || !hasValidTagCharacters(this.currentInput)) {
            return suggestions;
        }

        // Check if an exact match already exists (case-insensitive)
        if (hasExactTagSuggestionMatch(this.currentInput, suggestions)) {
            return suggestions;
        }

        // Create the "Create new tag" node
        this.createNewNode = {
            name: strings.modals.tagSuggest.createNewTag.replace('{tag}', this.currentInput),
            path: '__create_new__',
            displayPath: '__create_new__',
            children: new Map(),
            notesWithTag: new Set()
        };

        // Add it to the beginning of the list
        const createMatch: FuzzyMatch<TagTreeNode> = {
            item: this.createNewNode,
            match: {
                score: -1, // High priority
                matches: []
            }
        };

        return [createMatch, ...suggestions];
    }

    /**
     * Gets all tags in the vault as a flat list
     * @returns Array of tag nodes available for selection
     */
    getItems(): TagTreeNode[] {
        return [...(this.plugin.tagTreeService?.getFlattenedTagNodes() ?? [])];
    }

    /**
     * Gets the display text for a tag
     * Shows the full path with # prefix
     * @param tag - The tag node to get text for
     * @returns The display text
     */
    getItemText(tag: TagTreeNode): string {
        if (tag.path === '__create_new__') {
            return this.currentInput; // Return the input for fuzzy matching
        }
        // Return displayPath with # prefix for fuzzy matching
        return `#${tag.displayPath}`;
    }

    /**
     * Gets the display path for a tag
     * @param tag - The tag to get display path for
     * @returns The path to display
     */
    protected getDisplayPath(tag: TagTreeNode): string {
        if (tag.path === '__create_new__') {
            return tag.name; // Already contains the full text
        }
        // Show tag with # prefix using displayPath for correct casing
        return `#${tag.displayPath}`;
    }

    /**
     * Gets the CSS class for tag items
     * @returns The CSS class name
     */
    protected getItemClass(): string {
        return 'nn-tag-suggest-item';
    }

    private resolveTagNoteCount(tag: TagTreeNode): number | null {
        if (tag.path === '__create_new__') {
            return null;
        }

        return tag.notesWithTag.size;
    }

    /**
     * Renders additional content for a tag
     * @param tag - The tag being rendered
     * @param itemEl - The container element
     */
    protected renderAdditionalContent(tag: TagTreeNode, itemEl: HTMLElement): void {
        const noteCount = this.resolveTagNoteCount(tag);
        if (noteCount === null || noteCount <= 0) {
            return;
        }

        itemEl.createSpan({
            text: ` (${noteCount.toLocaleString()})`,
            cls: 'nn-tag-suggest-count'
        });
    }
}
