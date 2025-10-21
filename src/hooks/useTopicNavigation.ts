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
import { useExpansionDispatch } from '../context/ExpansionContext';
import { useSelectionDispatch } from '../context/SelectionContext';
import { useUIState, useUIDispatch } from '../context/UIStateContext';

/**
 * Custom hook that provides topic navigation functionality.
 * Handles navigating to topics, expanding parent topics, and managing UI state.
 *
 * This hook encapsulates the topic navigation logic to make it reusable
 * across different components (NotebookNavigatorComponent, FileItem, etc).
 */
export function useTopicNavigation() {
    const selectionDispatch = useSelectionDispatch();
    const expansionDispatch = useExpansionDispatch();
    const uiState = useUIState();
    const uiDispatch = useUIDispatch();

    /**
     * Navigates to a topic, expanding parent topics if needed.
     *
     * @param topicName - The topic name to navigate to
     */
    const navigateToTopic = useCallback(
        (topicName: string) => {
            if (!topicName) {
                return;
            }

            // For topics, we might want to expand parent topics
            // This would require topic graph traversal to find parents
            // For now, topics don't have hierarchical expansion like tags with '/'
            // But we keep this structure for potential future enhancement

            selectionDispatch({ type: 'SET_SELECTED_TOPIC', topic: topicName });

            // Switch to files view in single-pane mode
            if (uiState.singlePane) {
                uiDispatch({ type: 'SET_SINGLE_PANE_VIEW', view: 'files' });
            }

            // Set focus to navigation pane to show the selected topic
            uiDispatch({ type: 'SET_FOCUSED_PANE', pane: 'navigation' });
        },
        [selectionDispatch, expansionDispatch, uiState.singlePane, uiDispatch]
    );

    return {
        navigateToTopic
    };
}

