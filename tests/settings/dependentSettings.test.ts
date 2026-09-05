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

import type { Setting } from 'obsidian';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDependentSettingsSection, setElementVisible } from '../../src/settings/dependentSettings';

const SETTING_HIDDEN_CLASS = 'nn-setting-hidden';

class FakeClassList {
    private readonly classes = new Set<string>();

    add(className: string): void {
        this.classes.add(className);
    }

    contains(className: string): boolean {
        return this.classes.has(className);
    }

    toggle(className: string, force?: boolean): boolean {
        const shouldHaveClass = force ?? !this.classes.has(className);
        if (shouldHaveClass) {
            this.classes.add(className);
        } else {
            this.classes.delete(className);
        }
        return shouldHaveClass;
    }
}

class FakeNode {
    parentNode: FakeNode | null = null;
    readonly childNodes: FakeNode[] = [];

    constructor(readonly label: string) {}

    get nextSibling(): FakeNode | null {
        if (!this.parentNode) {
            return null;
        }

        const siblingIndex = this.parentNode.childNodes.indexOf(this);
        return this.parentNode.childNodes[siblingIndex + 1] ?? null;
    }

    after(node: FakeNode): void {
        if (!this.parentNode) {
            throw new Error('Cannot insert after a detached node');
        }

        node.detach();
        const siblingIndex = this.parentNode.childNodes.indexOf(this);
        this.parentNode.childNodes.splice(siblingIndex + 1, 0, node);
        node.parentNode = this.parentNode;
    }

    appendChild<T extends FakeNode>(node: T): T {
        node.detach();
        this.childNodes.push(node);
        node.parentNode = this;
        return node;
    }

    insertBefore<T extends FakeNode>(node: T, child: FakeNode | null = null): T {
        if (!child) {
            return this.appendChild(node);
        }

        node.detach();
        const childIndex = this.childNodes.indexOf(child);
        if (childIndex === -1) {
            throw new Error('Cannot insert before a node from another parent');
        }

        this.childNodes.splice(childIndex, 0, node);
        node.parentNode = this;
        return node;
    }

    private detach(): void {
        if (!this.parentNode) {
            return;
        }

        const siblingIndex = this.parentNode.childNodes.indexOf(this);
        if (siblingIndex !== -1) {
            this.parentNode.childNodes.splice(siblingIndex, 1);
        }
        this.parentNode = null;
    }
}

class FakeDocument {
    private markerCount = 0;

    createElement(tagName: string): FakeHTMLElement {
        this.markerCount += 1;
        return new FakeHTMLElement(this, `${tagName}-marker-${this.markerCount}`);
    }
}

class FakeHTMLElement extends FakeNode {
    readonly classList = new FakeClassList();
    readonly ownerDocument: Document;
    readonly win: Window;
    hidden = false;

    constructor(ownerDocument: FakeDocument, label: string) {
        super(label);
        this.ownerDocument = ownerDocument as unknown as Document;
        this.win = {
            createDiv: () => ownerDocument.createElement('div') as unknown as HTMLDivElement
        } as unknown as Window;
    }

    addClass(className: string): void {
        this.classList.add(className);
    }

    setAttr(): void {}
}

const originalNode = Reflect.get(window, 'Node');
const originalHTMLElement = Reflect.get(window, 'HTMLElement');
const hadNode = Reflect.has(window, 'Node');
const hadHTMLElement = Reflect.has(window, 'HTMLElement');

function installFakeDom(): void {
    Object.defineProperty(window, 'Node', {
        configurable: true,
        value: FakeNode
    });
    Object.defineProperty(window, 'HTMLElement', {
        configurable: true,
        value: FakeHTMLElement
    });
}

function restoreGlobalProperty(propertyName: 'Node' | 'HTMLElement', hadProperty: boolean, originalValue: unknown): void {
    if (hadProperty) {
        Object.defineProperty(window, propertyName, {
            configurable: true,
            value: originalValue
        });
        return;
    }

    Reflect.deleteProperty(window, propertyName);
}

function createSetting(settingEl: FakeHTMLElement): Setting {
    return { settingEl } as unknown as Setting;
}

function createRow(document: FakeDocument, label: string): FakeHTMLElement {
    return new FakeHTMLElement(document, label);
}

function appendDependentRow(section: HTMLElement, row: FakeHTMLElement): FakeHTMLElement {
    section.appendChild(row as unknown as Node);
    return row;
}

function getChildLabels(element: FakeHTMLElement): string[] {
    return element.childNodes.filter((node): node is FakeHTMLElement => node instanceof FakeHTMLElement).map(node => node.label);
}

function isHidden(element: FakeHTMLElement): boolean {
    return element.classList.contains(SETTING_HIDDEN_CLASS);
}

describe('dependent settings sections', () => {
    beforeEach(() => {
        installFakeDom();
    });

    afterEach(() => {
        restoreGlobalProperty('Node', hadNode, originalNode);
        restoreGlobalProperty('HTMLElement', hadHTMLElement, originalHTMLElement);
    });

    it('keeps nested dependent rows inside plain containers below their controller row', () => {
        const document = new FakeDocument();
        const root = createRow(document, 'root');
        const parentRow = root.appendChild(createRow(document, 'show file icons'));
        const parentSection = createDependentSettingsSection(createSetting(parentRow));

        const filenameRow = appendDependentRow(parentSection, createRow(document, 'show filename match icons'));
        const filenameMapSection = createDependentSettingsSection(createSetting(filenameRow));
        appendDependentRow(filenameMapSection, createRow(document, 'filename icon map'));

        appendDependentRow(parentSection, createRow(document, 'show category icons'));

        expect(getChildLabels(root)).toEqual(['show file icons', 'div-marker-1']);
        expect(getChildLabels(parentSection as unknown as FakeHTMLElement)).toEqual([
            'show filename match icons',
            'div-marker-2',
            'show category icons'
        ]);
        expect(getChildLabels(filenameMapSection as unknown as FakeHTMLElement)).toEqual(['filename icon map']);
    });

    it('preserves row-specific hidden state when a parent section is toggled', () => {
        const document = new FakeDocument();
        const root = createRow(document, 'root');
        const parentRow = root.appendChild(createRow(document, 'show preview'));
        const parentSection = createDependentSettingsSection(createSetting(parentRow));
        const fallbackRow = appendDependentRow(parentSection, createRow(document, 'preview fallback'));

        setElementVisible(fallbackRow as unknown as HTMLElement, false);
        setElementVisible(parentSection, false);
        setElementVisible(parentSection, true);

        expect(isHidden(fallbackRow)).toBe(true);

        setElementVisible(fallbackRow as unknown as HTMLElement, true);

        expect(isHidden(fallbackRow)).toBe(false);
    });
});
