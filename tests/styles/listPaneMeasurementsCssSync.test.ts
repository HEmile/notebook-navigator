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
        expect(desktop.basePadding / 2).toBe(paddingVertical);

        expect(desktop.titleLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-title-line-height'));
        expect(desktop.singleTextLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-single-text-line-height'));
        expect(desktop.multilineTextLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-multiline-text-line-height'));

        const tagRowHeight = extractPxVariableValue(coreVars, 'nn-file-tag-row-height-base');
        const tagRowGap = extractPxVariableValue(coreVars, 'nn-file-tag-row-gap-base');
        expect(desktop.tagRowHeight).toBe(tagRowHeight + tagRowGap);

        expect(desktop.featureImageMinHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-thumbnail-min-size'));

        expect(desktop.groupHeaderHeight).toBe(extractPxVariableValue(coreVars, 'nn-list-group-header-height'));
        expect(desktop.groupHeaderSpacerBefore).toBe(extractPxVariableValue(coreVars, 'nn-list-group-header-spacer-before'));

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
        expect(mobile.basePadding / 2).toBe(paddingVertical + paddingMobileIncrement);

        expect(mobile.titleLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-title-line-height-mobile'));
        expect(mobile.singleTextLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-single-text-line-height-mobile'));
        expect(mobile.multilineTextLineHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-multiline-text-line-height-mobile'));

        const tagRowHeight = extractPxVariableValue(coreVars, 'nn-file-tag-row-height-base');
        const tagRowGap = extractPxVariableValue(coreVars, 'nn-file-tag-row-gap-base');
        expect(mobile.tagRowHeight).toBe(tagRowHeight + tagRowGap);

        expect(mobile.featureImageMinHeight).toBe(extractPxVariableValue(coreVars, 'nn-file-thumbnail-min-size'));

        const headerIncrement = extractCalcAddPx(mobileVars, 'nn-list-group-header-height-mobile', 'nn-list-group-header-height');
        expect(mobile.groupHeaderHeight).toBe(extractPxVariableValue(coreVars, 'nn-list-group-header-height') + headerIncrement);
        expect(mobile.groupHeaderSpacerBefore).toBe(extractPxVariableValue(coreVars, 'nn-list-group-header-spacer-before'));

        const iconSize = extractPxVariableValue(coreVars, 'nn-file-icon-size');
        const iconSizeIncrement = extractCalcAddPx(mobileVars, 'nn-file-icon-size-mobile', 'nn-file-icon-size');
        expect(mobile.fileIconSize).toBe(iconSize + iconSizeIncrement);

        expect(mobileVars).not.toMatch(/--nn-file-tag-row-height\\s*:/);
        expect(mobileVars).not.toMatch(/--nn-file-tag-row-gap\\s*:/);
    });

    test('android text zoom keeps title and preview clamps in sync', () => {
        const androidCss = readTextFile('src/styles/sections/android-textzoom.css');
        const titleRule = extractRuleBlock(androidCss, '.notebook-navigator-android .nn-file-name');
        const previewRule = extractRuleBlock(androidCss, '.notebook-navigator-android .nn-file-preview');

        expect(titleRule).toMatch(
            /max-height:\s*calc\(var\(--nn-file-title-line-height\)\s*\*\s*var\(--filename-rows, 1\)\s*\*\s*var\(--nn-android-font-scale, 1\)\)/
        );
        expect(titleRule).not.toMatch(/(^|\n)\s*min-height:\s*/m);
        expect(titleRule).not.toMatch(/(^|\n)\s*height:\s*/m);
        expect(previewRule).toMatch(
            /max-height:\s*calc\(var\(--nn-file-multiline-text-line-height\)\s*\*\s*var\(--preview-rows, 1\)\s*\*\s*var\(--nn-android-font-scale, 1\)\)/
        );
        expect(previewRule).not.toMatch(/(^|\n)\s*min-height:\s*/m);
        expect(previewRule).not.toMatch(/(^|\n)\s*height:\s*/m);
    });

    test('thumbnail sizing uses the same content box height as file text', () => {
        const listThumbnailsCss = readTextFile('src/styles/sections/list-file-thumbnails.css');
        const thumbnailRule = extractRuleBlock(listThumbnailsCss, '.nn-virtual-file-item .nn-file-thumbnail');
        const extensionBadgeRule = extractRuleBlock(listThumbnailsCss, '.nn-virtual-file-item .nn-file-thumbnail--extension-badge');

        expect(thumbnailRule).toMatch(
            /calc\(var\(--item-height\)\s*-\s*var\(--nn-file-padding-total-mobile,\s*var\(--nn-file-padding-total\)\)\)/
        );
        expect(thumbnailRule).not.toMatch(/--nn-file-padding-vertical-mobile/);

        expect(extensionBadgeRule).toMatch(/width:\s*var\(--nn-file-thumbnail-min-size\)/);
        expect(extensionBadgeRule).toMatch(/height:\s*var\(--nn-file-thumbnail-min-size\)/);
        expect(extensionBadgeRule).not.toMatch(/--image-size/);
    });

    test('pill height uses the fixed row height as border-box height', () => {
        const listTagsCss = readTextFile('src/styles/sections/list-tags.css');
        const pillRule = listTagsCss.match(/(^|\n)\.nn-file-tag\s*\{([^}]*)\}/)?.[2];
        if (!pillRule) {
            throw new Error('Missing CSS rule for selector .nn-file-tag');
        }

        expect(pillRule).toMatch(/(^|\n)\s*box-sizing:\s*border-box\s*;/m);
        expect(pillRule).toMatch(/(^|\n)\s*height:\s*var\(--nn-file-tag-row-height\)\s*;/m);
    });

    test('file text stack top-aligns inside fixed virtual file rows', () => {
        const listFilesCss = readTextFile('src/styles/sections/list-files.css');
        const virtualListCss = readTextFile('src/styles/sections/layout-virtual-list.css');
        const virtualFileItemRule = extractRuleBlock(virtualListCss, '.nn-virtual-file-item');
        const fileRule = extractRuleBlock(listFilesCss, '.nn-file');
        const fileContentRule = extractRuleBlock(listFilesCss, '.nn-file-content');
        const fileInnerContentRule = extractRuleBlock(listFilesCss, '.nn-file-inner-content');
        const fileTextContentRule = extractRuleBlock(listFilesCss, '.nn-file-text-content');
        const fileNameRule = extractRuleBlock(listFilesCss, '.nn-file-name');
        const previewRule = extractRuleBlock(listFilesCss, '.nn-file-preview');

        expect(virtualFileItemRule).toMatch(/(^|\n)\s*height:\s*var\(--item-height\)\s*;/m);
        expect(fileRule).toMatch(/(^|\n)\s*height:\s*100%\s*;/m);
        expect(fileContentRule).toMatch(/(^|\n)\s*height:\s*100%\s*;/m);
        expect(fileContentRule).toMatch(/(^|\n)\s*box-sizing:\s*border-box\s*;/m);
        expect(fileInnerContentRule).toMatch(/(^|\n)\s*height:\s*100%\s*;/m);
        expect(fileTextContentRule).toMatch(/(^|\n)\s*height:\s*100%\s*;/m);
        expect(fileTextContentRule).toMatch(/(^|\n)\s*justify-content:\s*flex-start\s*;/m);
        expect(fileNameRule).toMatch(
            /(^|\n)\s*max-height:\s*calc\(var\(--nn-file-title-line-height\)\s*\*\s*var\(--filename-rows, 1\)\)\s*;/m
        );
        expect(previewRule).toMatch(
            /(^|\n)\s*max-height:\s*calc\(var\(--nn-file-multiline-text-line-height\)\s*\*\s*var\(--preview-rows, 1\)\)\s*;/m
        );
        expect(previewRule).not.toMatch(/(^|\n)\s*flex:\s*1\s*;/m);
        expect(previewRule).not.toMatch(/(^|\n)\s*min-height:\s*/m);
        expect(previewRule).not.toMatch(/(^|\n)\s*height:\s*/m);
    });

    test('parent folder background stays inside the fixed metadata line height', () => {
        const listFilesCss = readTextFile('src/styles/sections/list-files.css');
        const parentFolderBackgroundRule = extractRuleBlock(listFilesCss, ".nn-parent-folder-content[data-has-background='true']");

        expect(parentFolderBackgroundRule).toMatch(/(^|\n)\s*box-sizing:\s*border-box\s*;/m);
        expect(parentFolderBackgroundRule).toMatch(/(^|\n)\s*height:\s*var\(--nn-file-single-text-line-height\)\s*;/m);
        expect(parentFolderBackgroundRule).toMatch(
            /(^|\n)\s*line-height:\s*calc\(var\(--nn-file-single-text-line-height\)\s*-\s*2px\)\s*;/m
        );
        expect(parentFolderBackgroundRule).toMatch(/(^|\n)\s*padding:\s*1px 4px\s*;/m);
    });
});
