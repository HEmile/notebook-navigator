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

import { LISTPANE_MEASUREMENTS } from '../types';

export interface CompactListMetrics {
    fontSize: number;
    mobileFontSize: number;
    desktopPadding: number;
    desktopPaddingTotal: number;
    mobilePadding: number;
    mobilePaddingTotal: number;
}

interface CompactListMetricsInput {
    compactItemHeight: number;
    scaleText: boolean;
    titleLineHeight: number;
}

/**
 * Calculates compact list typography and spacing based on height settings.
 * Keeps CSS custom properties and virtualization estimates in sync.
 */
export function calculateCompactListMetrics({
    compactItemHeight,
    scaleText,
    titleLineHeight
}: CompactListMetricsInput): CompactListMetrics {
    const {
        defaultCompactItemHeight,
        defaultCompactFontSize,
        mobileHeightIncrement,
        mobileFontSizeIncrement,
        minCompactPaddingVerticalMobile
    } = LISTPANE_MEASUREMENTS;

    // Calculate desktop padding to center title line within item height
    const desktopPadding = Math.max((compactItemHeight - titleLineHeight) / 2, 0);
    const desktopPaddingTotal = Math.max(compactItemHeight - titleLineHeight, 0);

    // Reduce font size for shorter items when text scaling is enabled
    let fontSize = defaultCompactFontSize;
    if (scaleText) {
        if (compactItemHeight <= defaultCompactItemHeight - 6) {
            fontSize = defaultCompactFontSize - 2;
        } else if (compactItemHeight <= defaultCompactItemHeight - 4) {
            fontSize = defaultCompactFontSize - 1;
        }
    }

    // Mobile height uses same scaling logic as navigation items with fixed increment
    const mobileItemHeight = compactItemHeight + mobileHeightIncrement;

    // Calculate mobile padding using mobile-adjusted item height
    const mobilePaddingRaw = Math.max((mobileItemHeight - titleLineHeight) / 2, 0);
    const mobilePadding = Math.max(minCompactPaddingVerticalMobile, mobilePaddingRaw);
    const mobilePaddingTotal = mobilePadding * 2;

    // Apply same font scaling delta as navigation items
    const mobileFontSize = fontSize + mobileFontSizeIncrement;

    return {
        fontSize,
        mobileFontSize,
        desktopPadding,
        desktopPaddingTotal,
        mobilePadding,
        mobilePaddingTotal
    };
}
