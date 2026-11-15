/*
 * Notebook Navigator - Plugin for Obsidian
 * Copyright (c) 2026 Emile van Krieken
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
import { App, FuzzySuggestModal } from 'obsidian';
import { strings } from '../i18n';

/** Fork: fuzzy picker over topic names, used by the Navigate to topic command */
export class TopicSuggestModal extends FuzzySuggestModal<string> {
    constructor(
        app: App,
        private readonly topicNames: string[],
        private readonly onChooseTopic: (topicName: string) => void
    ) {
        super(app);
        this.setPlaceholder(strings.commands.navigateToTopicPlaceholder);
        this.setInstructions([
            { command: '↑↓', purpose: strings.modals.tagSuggest.instructions.navigate },
            { command: '↵', purpose: strings.modals.tagSuggest.instructions.select },
            { command: 'esc', purpose: strings.modals.tagSuggest.instructions.dismiss }
        ]);
    }

    getItems(): string[] {
        return this.topicNames;
    }

    getItemText(topicName: string): string {
        return topicName;
    }

    onChooseItem(topicName: string): void {
        this.onChooseTopic(topicName);
    }
}
