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

import { describe, expect, it } from 'vitest';
import {
    getFileItemLayoutState,
    isListPaneCompactMode,
    shouldShowFeatureImageArea,
    shouldShowFileItemParentFolderLine
} from '../../src/utils/listPaneMeasurements';
import { createTestTFile } from './createTestTFile';

describe('listPaneMeasurements layout helpers', () => {
    it('detects compact mode from hidden date, preview, and image sections', () => {
        expect(
            isListPaneCompactMode({
                showDate: false,
                showPreview: false,
                showImage: false
            })
        ).toBe(true);

        expect(
            isListPaneCompactMode({
                showDate: true,
                showPreview: false,
                showImage: false
            })
        ).toBe(false);
    });

    it('reserves multiline preview rows when the feature image area is visible', () => {
        expect(
            getFileItemLayoutState({
                showDate: true,
                showPreview: true,
                showImage: true,
                previewRows: 3,
                optimizeNoteHeight: true,
                isPinned: false,
                hasPreviewContent: false,
                showFeatureImageArea: true,
                hasVisiblePillRows: false
            })
        ).toMatchObject({
            isCompactMode: false,
            shouldUseMultiLinePreviewLayout: true,
            shouldCollapseEmptyPreviewSpace: false,
            shouldAlwaysReservePreviewSpace: true,
            shouldSuppressEmptyPreviewLines: false,
            multilinePreviewRowCount: 3
        });
    });

    it('collapses empty preview space when pills are visible and no image is shown', () => {
        expect(
            getFileItemLayoutState({
                showDate: true,
                showPreview: true,
                showImage: false,
                previewRows: 3,
                optimizeNoteHeight: true,
                isPinned: false,
                hasPreviewContent: false,
                showFeatureImageArea: false,
                hasVisiblePillRows: true
            })
        ).toMatchObject({
            shouldUseMultiLinePreviewLayout: true,
            shouldCollapseEmptyPreviewSpace: true,
            shouldAlwaysReservePreviewSpace: false,
            shouldSuppressEmptyPreviewLines: true,
            multilinePreviewRowCount: 0
        });
    });

    it('matches the parent folder line rules for tag and descendant views', () => {
        expect(
            shouldShowFileItemParentFolderLine({
                showParentFolder: true,
                pinnedItemShouldUseCompactLayout: false,
                selectionType: 'tag',
                includeDescendantNotes: false,
                parentFolder: 'Projects',
                fileParentPath: 'Projects/Archive'
            })
        ).toBe(true);

        expect(
            shouldShowFileItemParentFolderLine({
                showParentFolder: true,
                pinnedItemShouldUseCompactLayout: false,
                selectionType: 'folder',
                includeDescendantNotes: true,
                parentFolder: 'Projects',
                fileParentPath: 'Projects/Archive'
            })
        ).toBe(true);

        expect(
            shouldShowFileItemParentFolderLine({
                showParentFolder: true,
                pinnedItemShouldUseCompactLayout: false,
                selectionType: 'folder',
                includeDescendantNotes: true,
                parentFolder: 'Projects',
                fileParentPath: 'Projects'
            })
        ).toBe(false);

        expect(
            shouldShowFileItemParentFolderLine({
                showParentFolder: true,
                pinnedItemShouldUseCompactLayout: false,
                selectionType: 'tag',
                includeDescendantNotes: false,
                parentFolder: null,
                fileParentPath: '/'
            })
        ).toBe(false);
    });

    it('keeps feature image visibility aligned for image files and cached thumbnails', () => {
        const markdownFile = createTestTFile('Notes/Daily.md');
        const imageFile = createTestTFile('Images/Cover.png');

        expect(
            shouldShowFeatureImageArea({
                showImage: true,
                file: markdownFile,
                featureImageStatus: 'has'
            })
        ).toBe(true);

        expect(
            shouldShowFeatureImageArea({
                showImage: true,
                file: imageFile,
                featureImageStatus: 'unprocessed'
            })
        ).toBe(true);
    });
});
