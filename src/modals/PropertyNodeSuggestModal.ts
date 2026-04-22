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

import { App } from 'obsidian';
import { strings } from '../i18n';
import type { PropertyTreeNode } from '../types/storage';
import { type MaybePromise } from '../utils/async';
import { getDirectPropertyKeyNoteCount } from '../utils/propertyTree';
import { naturalCompare } from '../utils/sortUtils';
import type { PropertySelectionNodeId } from '../utils/propertyTree';
import { BaseSuggestModal } from './BaseSuggestModal';

export interface PropertyNodeSuggestion {
    nodeId: PropertySelectionNodeId;
    label: string;
    searchText: string;
    noteCount: number;
}

export function buildPropertyNodeSuggestions(propertyTree: ReadonlyMap<string, PropertyTreeNode>): PropertyNodeSuggestion[] {
    const suggestions: PropertyNodeSuggestion[] = [];
    const keyNodes = Array.from(propertyTree.values()).sort((a, b) => naturalCompare(a.displayPath, b.displayPath));

    keyNodes.forEach(keyNode => {
        suggestions.push({
            nodeId: keyNode.id,
            label: keyNode.displayPath,
            searchText: keyNode.displayPath,
            noteCount: getDirectPropertyKeyNoteCount(keyNode)
        });

        const valueNodes = Array.from(keyNode.children.values()).sort((a, b) => naturalCompare(a.displayPath, b.displayPath));
        valueNodes.forEach(valueNode => {
            suggestions.push({
                nodeId: valueNode.id,
                label: `${keyNode.displayPath}: ${valueNode.displayPath}`,
                searchText: `${keyNode.displayPath} ${valueNode.displayPath}`,
                noteCount: valueNode.notesWithValue.size
            });
        });
    });

    return suggestions;
}

export class PropertyNodeSuggestModal extends BaseSuggestModal<PropertyNodeSuggestion> {
    constructor(
        app: App,
        private suggestions: readonly PropertyNodeSuggestion[],
        onChoosePropertyNodeId: (nodeId: PropertySelectionNodeId) => MaybePromise,
        placeholderText: string,
        actionText: string
    ) {
        super(app, suggestion => onChoosePropertyNodeId(suggestion.nodeId), placeholderText, {
            navigate: strings.modals.propertySuggest.instructions.navigate,
            action: actionText,
            dismiss: strings.modals.propertySuggest.instructions.dismiss
        });
    }

    getItems(): PropertyNodeSuggestion[] {
        return [...this.suggestions];
    }

    getItemText(item: PropertyNodeSuggestion): string {
        return item.searchText;
    }

    protected getDisplayPath(item: PropertyNodeSuggestion): string {
        return item.label;
    }

    protected getItemClass(): string {
        return 'nn-property-suggest-item';
    }

    protected renderAdditionalContent(item: PropertyNodeSuggestion, itemEl: HTMLElement): void {
        if (item.noteCount <= 0) {
            return;
        }

        itemEl.createSpan({
            text: ` (${item.noteCount.toLocaleString()})`,
            cls: 'nn-tag-suggest-count'
        });
    }
}
