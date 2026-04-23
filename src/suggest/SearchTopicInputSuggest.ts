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

import { AbstractInputSuggest, App, prepareFuzzySearch, renderMatches, SearchResult } from 'obsidian';
import { naturalCompare } from '../utils/sortUtils';
import type { TopicNode } from '../types/storage';

interface TopicSuggestionItem {
    name: string;
    match: SearchResult | null;
}

interface ActiveTopicRange {
    start: number; // index of the opening quote
    end: number;   // index just after the closing fragment
    query: string; // text inside the quotes so far
}

interface SearchTopicInputSuggestOptions {
    getTopics: () => readonly TopicNode[];
    onApply: (nextValue: string, cursor: number) => void;
    isMobile: boolean;
}

// Matches the `topic:"` prefix (with optional `!` for exclusion) anywhere in the string
const TOPIC_TRIGGER = /(!)?topic:\s*"/gi;
const TOPIC_LIMIT = 50;

/**
 * Provides inline topic suggestions when typing `topic:"` in the search input.
 * Shows all topics fuzzy-matched against what's been typed after the opening quote.
 * Selecting a suggestion completes the quoted topic name and closes the popup.
 */
export class SearchTopicInputSuggest extends AbstractInputSuggest<TopicSuggestionItem> {
    declare containerEl: HTMLElement;
    private readonly getTopics: SearchTopicInputSuggestOptions['getTopics'];
    private readonly applySuggestion: SearchTopicInputSuggestOptions['onApply'];
    private readonly searchInputEl: HTMLInputElement;
    private readonly isMobile: boolean;
    private activeRange: ActiveTopicRange | null = null;

    constructor(app: App, inputEl: HTMLInputElement, options: SearchTopicInputSuggestOptions) {
        super(app, inputEl);
        this.getTopics = options.getTopics;
        this.applySuggestion = options.onApply;
        this.searchInputEl = inputEl;
        this.limit = TOPIC_LIMIT;
        this.isMobile = options.isMobile;
    }

    getSuggestions(_input: string): TopicSuggestionItem[] {
        const range = this.resolveActiveRange();
        if (!range) {
            this.activeRange = null;
            return [];
        }

        this.activeRange = range;
        const topics = this.getTopics();
        if (topics.length === 0) return [];

        if (range.query.length === 0) {
            return topics.slice(0, this.limit).map(t => ({ name: t.name, match: null }));
        }

        const search = prepareFuzzySearch(range.query);
        const matches: TopicSuggestionItem[] = [];
        for (const topic of topics) {
            const result = search(topic.name);
            if (result) matches.push({ name: topic.name, match: result });
        }

        matches.sort((a, b) => {
            const scoreA = a.match?.score ?? Number.POSITIVE_INFINITY;
            const scoreB = b.match?.score ?? Number.POSITIVE_INFINITY;
            if (scoreA === scoreB) return naturalCompare(a.name, b.name);
            return scoreA - scoreB;
        });

        return matches.slice(0, this.limit);
    }

    renderSuggestion(item: TopicSuggestionItem, el: HTMLElement): void {
        el.addClass('nn-search-tag-suggestion');
        const container = el.createDiv({ cls: 'nn-search-tag-suggestion__label' });
        container.createSpan({ cls: 'nn-search-tag-suggestion__prefix', text: 'topic:' });
        const textEl = container.createSpan({ cls: 'nn-search-tag-suggestion__text' });

        if (item.match && item.match.matches.length > 0) {
            renderMatches(textEl, item.name, item.match.matches);
        } else {
            textEl.setText(item.name);
        }
    }

    selectSuggestion(item: TopicSuggestionItem): void {
        if (!this.activeRange) {
            this.close();
            return;
        }

        const { start, end } = this.activeRange;
        const currentValue = this.searchInputEl.value;
        // start points to the opening quote; replace from there through end
        const before = currentValue.substring(0, start);
        const after = currentValue.substring(end);
        const replacement = `"${item.name}"`;
        const nextValue = `${before}${replacement}${after}`;
        const cursor = start + replacement.length;

        this.applySuggestion(nextValue, cursor);
        this.close();
    }

    dispose(): void {
        this.close();
    }

    onOpen(): void {
        if (!this.isMobile || !this.containerEl) return;
        this.containerEl.addClass('nn-mobile');
    }

    /**
     * Finds the innermost `topic:"...` span that the cursor is inside.
     * Returns the range covering the open-quote through the cursor (and any trailing non-quote chars).
     */
    private resolveActiveRange(): ActiveTopicRange | null {
        const inputEl = this.searchInputEl;
        const value = inputEl.value;
        if (!value) return null;

        const cursor = inputEl.selectionStart ?? value.length;
        const selectionEnd = inputEl.selectionEnd ?? cursor;
        if (cursor !== selectionEnd) return null;

        // Find the last `topic:"` occurrence before the cursor
        TOPIC_TRIGGER.lastIndex = 0;
        let triggerMatch: RegExpExecArray | null;
        let lastMatch: RegExpExecArray | null = null;
        while ((triggerMatch = TOPIC_TRIGGER.exec(value)) !== null) {
            const triggerEnd = triggerMatch.index + triggerMatch[0].length; // position just after `"`
            if (triggerEnd <= cursor) {
                lastMatch = triggerMatch;
            }
        }

        if (!lastMatch) return null;

        const openQuoteIndex = lastMatch.index + lastMatch[0].length - 1; // index of the `"`
        const contentStart = openQuoteIndex + 1; // first char inside the quotes

        // If there's a closing quote before the cursor, we're outside the token
        const closingQuoteIndex = value.indexOf('"', contentStart);
        if (closingQuoteIndex !== -1 && closingQuoteIndex < cursor) return null;

        // Query is everything from after the open-quote up to the cursor
        const query = value.slice(contentStart, cursor);

        // End extends to include any trailing non-quote characters after the cursor
        let endIndex = cursor;
        while (endIndex < value.length && value[endIndex] !== '"') {
            endIndex++;
        }
        // Include the closing quote if present
        if (endIndex < value.length && value[endIndex] === '"') {
            endIndex++;
        }

        return { start: openQuoteIndex, end: endIndex, query };
    }
}
