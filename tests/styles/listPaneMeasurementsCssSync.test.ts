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

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { getListPaneMeasurements } from '../../src/utils/listPaneMeasurements';

function readTextFile(path: string): string {
    return readFileSync(path, 'utf8');
}

function extractRuleBlock(css: string, selector: string): string {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm');
    const match = css.match(pattern);
    if (!match?.[1]) {
        throw new Error(`Missing CSS rule for selector ${selector}`);
    }
    return match[1];
}

function extractPxVariableValue(css: string, variableName: string): number {
    const pattern = new RegExp(`--${variableName}:\\s*([0-9]+)px\\s*;`);
    const match = css.match(pattern);
    if (!match?.[1]) {
        throw new Error(`Missing CSS variable --${variableName}`);
    }
    return Number.parseInt(match[1], 10);
}

function extractCalcAddPx(css: string, variableName: string, baseVariableName: string): number {
    const escapedBase = baseVariableName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const pattern = new RegExp(`--${variableName}:\\s*calc\\(var\\(--${escapedBase}\\)\\s*\\+\\s*([0-9]+)px\\)\\s*;`);
    const match = css.match(pattern);
    if (!match?.[1]) {
        throw new Error(`Missing calc override --${variableName} based on --${baseVariableName}`);
    }
    return Number.parseInt(match[1], 10);
}

describe('List pane measurements stay in sync with CSS', () => {
    test('desktop measurements match core variables', () => {
        const coreVars = readTextFile('src/styles/sections/core-variables.css');
        const desktop = getListPaneMeasurements(false);

        const paddingVertical = extractPxVariableValue(coreVars, 'nn-file-padding-vertical');
        const paddingTotal = paddingVertical * 2;
        expect(desktop.basePadding).toBe(paddingTotal);

        expect(desktop.titleLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-title-line-height'));
        expect(desktop.singleTextLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-single-text-line-height'));
        expect(desktop.multilineTextLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-multiline-text-line-height'));

        const tagRowHeight = extractPxVariableValue(coreVars, 'nn-file-tag-row-height-base');
        const tagRowGap = extractPxVariableValue(coreVars, 'nn-file-tag-row-gap-base');
        expect(desktop.tagRowHeight).toBe(tagRowHeight + tagRowGap);

        expect(desktop.featureImageHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-thumbnail-min-size'));

        expect(desktop.firstHeader).toBe(extractPxVariableValue(coreVars, 'nn-date-header-height'));
        expect(desktop.subsequentHeader).toBe(extractPxVariableValue(coreVars, 'nn-date-header-height-subsequent'));

        expect(desktop.fileIconSize).toBe(extractPxVariableValue(coreVars, 'nn-file-icon-size'));
    });

    test('mobile measurements match core variables + mobile overrides', () => {
        const coreVars = readTextFile('src/styles/sections/core-variables.css');
        const mobileVars = readTextFile('src/styles/sections/mobile-variables.css');
        const mobile = getListPaneMeasurements(true);

        const paddingVertical = extractPxVariableValue(coreVars, 'nn-file-padding-vertical');
        const paddingMobileIncrement = extractCalcAddPx(mobileVars, 'nn-file-padding-vertical-mobile', 'nn-file-padding-vertical');
        const paddingTotal = (paddingVertical + paddingMobileIncrement) * 2;
        expect(mobile.basePadding).toBe(paddingTotal);

        expect(mobile.titleLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-title-line-height-mobile'));
        expect(mobile.singleTextLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-single-text-line-height-mobile'));
        expect(mobile.multilineTextLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-multiline-text-line-height-mobile'));

        const tagRowHeight = extractPxVariableValue(coreVars, 'nn-file-tag-row-height-base');
        const tagRowGap = extractPxVariableValue(coreVars, 'nn-file-tag-row-gap-base');
        expect(mobile.tagRowHeight).toBe(tagRowHeight + tagRowGap);

        expect(mobile.featureImageHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-thumbnail-min-size'));

        const headerIncrement = extractCalcAddPx(mobileVars, 'nn-date-header-height-mobile', 'nn-date-header-height');
        const subsequentHeaderIncrement = extractCalcAddPx(
            mobileVars,
            'nn-date-header-height-subsequent-mobile',
            'nn-date-header-height-subsequent'
        );
        expect(mobile.firstHeader).toBe(extractPxVariableValue(coreVars, 'nn-date-header-height') + headerIncrement);
        expect(mobile.subsequentHeader).toBe(
            extractPxVariableValue(coreVars, 'nn-date-header-height-subsequent') + subsequentHeaderIncrement
        );

        const iconSize = extractPxVariableValue(coreVars, 'nn-file-icon-size');
        const iconSizeIncrement = extractCalcAddPx(mobileVars, 'nn-file-icon-size-mobile', 'nn-file-icon-size');
        expect(mobile.fileIconSize).toBe(iconSize + iconSizeIncrement);

        expect(mobileVars).not.toMatch(/--nn-file-tag-row-height\\s*:/);
        expect(mobileVars).not.toMatch(/--nn-file-tag-row-gap\\s*:/);
    });

    test('android text zoom caps title and preview rows without forcing fixed heights', () => {
        const androidCss = readTextFile('src/styles/sections/android-textzoom.css');
        const titleRule = extractRuleBlock(androidCss, '.notebook-navigator-android .nn-file-name');
        const previewRule = extractRuleBlock(
            androidCss,
            '.notebook-navigator-android .nn-file-preview:not(.nn-file-second-line .nn-file-preview)'
        );

        expect(titleRule).toMatch(
            /max-height:\s*calc\(var\(--nn-file-title-line-height\)\s*\*\s*var\(--filename-rows, 1\)\s*\*\s*var\(--nn-android-font-scale, 1\)\)/
        );
        expect(previewRule).toMatch(
            /max-height:\s*calc\(var\(--nn-file-multiline-text-line-height\)\s*\*\s*var\(--preview-rows, 1\)\s*\*\s*var\(--nn-android-font-scale, 1\)\)/
        );

        expect(titleRule).not.toMatch(/(^|\n)\s*min-height\s*:/m);
        expect(titleRule).not.toMatch(/(^|\n)\s*height\s*:/m);
        expect(previewRule).not.toMatch(/(^|\n)\s*min-height\s*:/m);
        expect(previewRule).not.toMatch(/(^|\n)\s*height\s*:/m);
    });
});
