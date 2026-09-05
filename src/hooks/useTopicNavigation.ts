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

import { useCallback } from 'react';
import { useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';
import { useServices } from '../context/ServicesContext';
import { getTopicNote } from '../utils/topicNotes';
import { getTopicNameFromPath } from '../utils/topicGraph';

export function useTopicNavigation() {
    const selectionDispatch = useSelectionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();
    const { app } = useServices();

    const navigateToTopic = useCallback(
        (topicPath: string) => {
            if (!topicPath) {
                return;
            }

            selectionDispatch({ type: 'SET_SELECTED_TOPIC', topicPath: topicPath });

            // ACTIVATE_PANE sets the focused pane and the visible single-pane view together:
            // single pane reveals the file list, dual pane keeps focus in the navigation pane.
            uiDispatch({ type: 'ACTIVATE_PANE', target: uiState.singlePane ? 'files' : 'navigation' });

            // Open the topic note file in the editor if it exists
            const topicName = getTopicNameFromPath(topicPath);
            const topicFile = getTopicNote(topicName, app);
            if (topicFile) {
                const leaf = app.workspace.getLeaf(false);
                if (leaf) {
                    void leaf.openFile(topicFile, { active: false });
                }
            }
        },
        [selectionDispatch, uiState.singlePane, uiDispatch, app]
    );

    return { navigateToTopic };
}
