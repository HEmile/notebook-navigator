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

type ExternalLinkConfig = Readonly<{
    href: string;
    text: string;
}>;

type ExternalLinkSettingDescriptionParams = Readonly<{
    text: string;
    link: ExternalLinkConfig;
}>;

type InlineExternalLinkTextParams = Readonly<{
    prefix: string;
    link: ExternalLinkConfig;
    suffix: string;
}>;

type InlineActionLinkTextParams = Readonly<{
    prefix: string;
    linkText: string;
    suffix: string;
    onClick: () => void;
}>;

function createExternalLinkElement({ href, text }: ExternalLinkConfig): HTMLAnchorElement {
    const linkEl = document.createElement('a');
    linkEl.textContent = text;
    linkEl.href = href;
    linkEl.rel = 'noopener noreferrer';
    linkEl.target = '_blank';
    return linkEl;
}

export function createSettingDescriptionWithExternalLink(params: ExternalLinkSettingDescriptionParams): DocumentFragment {
    const fragment = document.createDocumentFragment();
    fragment.append(params.text, document.createElement('br'), createExternalLinkElement(params.link));

    return fragment;
}

export function createInlineExternalLinkText(params: InlineExternalLinkTextParams): DocumentFragment {
    const fragment = document.createDocumentFragment();
    fragment.append(params.prefix, createExternalLinkElement(params.link), params.suffix);
    return fragment;
}

export function createInlineActionLinkText(params: InlineActionLinkTextParams): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const linkEl = document.createElement('a');
    linkEl.textContent = params.linkText;
    linkEl.href = '#';
    linkEl.addEventListener('click', event => {
        event.preventDefault();
        params.onClick();
    });
    fragment.append(params.prefix, linkEl, params.suffix);
    return fragment;
}
