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

import { App, Modal } from 'obsidian';
import { getReleaseBannerUrl, SUPPORT_BUY_ME_A_COFFEE_URL } from '../constants/urls';
import { strings } from '../i18n';
import { ReleaseNote } from '../releaseNotes';
import { DateUtils } from '../utils/dateUtils';
import { addAsyncEventListener } from '../utils/domEventListeners';
import { getYoutubeThumbnailUrl, getYoutubeVideoId } from '../utils/youtubeUtils';

export class WhatsNewModal extends Modal {
    private releaseNotes: ReleaseNote[];
    private dateFormat: string;
    private thanksButton: HTMLButtonElement | null = null;
    private onCloseCallback?: () => void;
    private domDisposers: (() => void)[] = [];

    // Renders limited formatting into a container element.
    // Supports:
    // - **bold**
    // - ==text== (highlight as red + bold)
    // - [label](https://link)
    // - Auto-link bare http(s) URLs
    // - Line breaks: single \n becomes <br>
    private renderFormattedText(container: HTMLElement, text: string): void {
        const renderInline = (segment: string, dest: HTMLElement) => {
            const pattern = /==([\s\S]*?)==|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s]+)/g;
            let lastIndex = 0;
            let match: RegExpExecArray | null;

            const appendText = (t: string) => {
                if (t.length > 0) dest.appendText(t);
            };

            while ((match = pattern.exec(segment)) !== null) {
                appendText(segment.slice(lastIndex, match.index));

                if (match[1]) {
                    // ==highlight== -> highlight span, supports nested formatting inside
                    const highlight = dest.createSpan({ cls: 'nn-highlight' });
                    renderInline(match[1], highlight);
                } else if (match[2] && match[3]) {
                    // Markdown link [label](url)
                    const a = dest.createEl('a', { text: match[2] });
                    a.setAttr('href', match[3]);
                    a.setAttr('rel', 'noopener noreferrer');
                    a.setAttr('target', '_blank');
                } else if (match[4]) {
                    // **bold**
                    dest.createEl('strong', { text: match[4] });
                } else if (match[5]) {
                    // Bare URL - strip trailing punctuation that's likely not part of the URL
                    let url = match[5];
                    let trailing = '';
                    const trailingMatch = url.match(/[.,;:!?)]+$/);
                    if (trailingMatch) {
                        trailing = trailingMatch[0];
                        url = url.slice(0, -trailing.length);
                    }
                    const a = dest.createEl('a', { text: url });
                    a.setAttr('href', url);
                    a.setAttr('rel', 'noopener noreferrer');
                    a.setAttr('target', '_blank');
                    if (trailing) {
                        appendText(trailing);
                    }
                }

                lastIndex = pattern.lastIndex;
            }

            appendText(segment.slice(lastIndex));
        };

        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            renderInline(lines[i], container);
            if (i < lines.length - 1) {
                container.createEl('br');
            }
        }
    }

    private renderReleaseBanner(container: HTMLElement, imageUrl: string): void {
        const banner = container.createDiv({ cls: 'nn-whats-new-banner' });
        const image = banner.createEl('img', { cls: 'nn-whats-new-banner-image' });
        image.setAttr('alt', '');
        image.setAttr('loading', 'lazy');
        image.setAttr('decoding', 'async');

        image.addEventListener('error', () => {
            banner.remove();
        });

        image.src = imageUrl;
    }

    private renderYoutubeLink(container: HTMLElement, youtubeUrl: string): void {
        const link = container.createEl('a', { cls: 'nn-whats-new-youtube-link' });
        link.setAttr('href', youtubeUrl);
        link.setAttr('rel', 'noopener noreferrer');
        link.setAttr('target', '_blank');
        link.setAttr('aria-label', strings.modals.welcome.openVideoButton);

        const thumbnail = link.createDiv({ cls: 'nn-whats-new-youtube-thumbnail' });

        const videoId = getYoutubeVideoId(youtubeUrl);
        if (videoId) {
            const image = thumbnail.createEl('img', { cls: 'nn-whats-new-youtube-image' });
            image.setAttr('alt', strings.modals.welcome.openVideoButton);
            image.setAttr('loading', 'lazy');

            const primaryUrl = getYoutubeThumbnailUrl(videoId, 'maxresdefault.jpg');
            const fallbackUrl = getYoutubeThumbnailUrl(videoId, 'hqdefault.jpg');

            let usedFallback = false;
            image.addEventListener('error', () => {
                if (usedFallback) {
                    return;
                }
                usedFallback = true;
                image.src = fallbackUrl;
            });

            image.src = primaryUrl;
        } else {
            thumbnail.createDiv({ cls: 'nn-whats-new-youtube-placeholder', text: strings.modals.welcome.openVideoButton });
        }

        thumbnail.createDiv({ cls: 'nn-whats-new-youtube-play' }).setAttr('aria-hidden', 'true');
    }

    constructor(app: App, releaseNotes: ReleaseNote[], dateFormat: string, onCloseCallback?: () => void) {
        super(app);
        this.releaseNotes = releaseNotes;
        this.dateFormat = dateFormat;
        this.onCloseCallback = onCloseCallback;
    }

    onOpen(): void {
        const { contentEl } = this;

        contentEl.empty();
        this.modalEl.addClass('nn-whats-new-modal');
        this.titleEl.setText(strings.whatsNew.title);

        this.attachCloseButtonHandler();

        const scrollContainer = contentEl.createDiv('nn-whats-new-scroll');

        this.releaseNotes.forEach(note => {
            const versionContainer = scrollContainer.createDiv('nn-whats-new-version');

            versionContainer.createEl('h3', {
                text: `Version ${note.version}`
            });

            // Parse the date string and format according to user preference
            const parsedDate = new Date(note.date);
            const formattedDate = DateUtils.formatDate(parsedDate.getTime(), this.dateFormat);

            versionContainer.createEl('small', {
                text: formattedDate,
                cls: 'nn-whats-new-date'
            });

            const bannerUrl = getReleaseBannerUrl(note.bannerUrl, note.version);
            if (bannerUrl) {
                this.renderReleaseBanner(versionContainer, bannerUrl);
            }

            if (note.youtubeUrl) {
                this.renderYoutubeLink(versionContainer, note.youtubeUrl);
            }

            // Show info text first if present (supports paragraphs and line breaks)
            if (note.info) {
                const paragraphs = note.info.split(/\n\s*\n/);
                paragraphs.forEach(para => {
                    const p = versionContainer.createEl('p', { cls: 'nn-whats-new-info' });
                    this.renderFormattedText(p, para);
                });
            }

            const categories = [
                { key: 'new', label: 'New' },
                { key: 'improved', label: 'Improved' },
                { key: 'changed', label: 'Changed' },
                { key: 'fixed', label: 'Fixed' }
            ];

            categories.forEach(category => {
                const items = note[category.key as keyof ReleaseNote] as string[] | undefined;
                if (items && items.length > 0) {
                    // Create category header
                    versionContainer.createEl('h4', {
                        text: category.label,
                        cls: 'nn-whats-new-category'
                    });

                    // Create list for this category
                    const categoryList = versionContainer.createEl('ul', {
                        cls: 'nn-whats-new-features'
                    });

                    items.forEach(item => {
                        const li = categoryList.createEl('li');
                        this.renderFormattedText(li, item);
                    });
                }
            });
        });

        // Add divider line right after scroll container
        contentEl.createDiv('nn-whats-new-divider');

        const supportContainer = contentEl.createDiv('nn-whats-new-support');

        supportContainer.createEl('p', {
            text: strings.whatsNew.supportMessage,
            cls: 'nn-whats-new-support-text'
        });

        const buttonContainer = contentEl.createDiv('nn-whats-new-buttons');

        // Create buttons directly without Setting wrapper
        const supportButton = buttonContainer.createEl('button', {
            cls: 'nn-support-button-small'
        });
        supportButton.setAttr('type', 'button');

        const supportIcon = supportButton.createSpan({ cls: 'nn-support-button-icon' });
        supportIcon.setAttr('aria-hidden', 'true');
        supportIcon.setText('☕');

        supportButton.createSpan({
            cls: 'nn-support-button-label',
            text: strings.whatsNew.supportButton
        });
        this.domDisposers.push(
            addAsyncEventListener(supportButton, 'click', () => {
                window.open(SUPPORT_BUY_ME_A_COFFEE_URL);
            })
        );

        const thanksButton = buttonContainer.createEl('button', {
            text: strings.whatsNew.thanksButton,
            cls: 'mod-cta'
        });
        this.domDisposers.push(
            addAsyncEventListener(thanksButton, 'click', () => {
                this.close();
            })
        );

        // Store reference to thanks button
        this.thanksButton = thanksButton;
    }

    open(): void {
        super.open();
        // Focus the thanks button after the modal is fully opened
        if (this.thanksButton) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                this.thanksButton?.focus();
            });
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.removeClass('nn-whats-new-modal');
        if (this.domDisposers.length) {
            this.domDisposers.forEach(dispose => {
                try {
                    dispose();
                } catch (e) {
                    console.error("Error disposing what's new modal listener:", e);
                }
            });
            this.domDisposers = [];
        }

        // Call the callback when modal is closed
        if (this.onCloseCallback) {
            this.onCloseCallback();
        }
    }

    // Attaches event handlers to the modal close button to ensure proper modal closure
    private attachCloseButtonHandler(): void {
        const closeButton = this.modalEl.querySelector<HTMLElement>('.modal-close-button');
        if (!closeButton) {
            return;
        }

        const handleClose = (event: Event) => {
            event.preventDefault();
            this.close();
        };

        // Close modal on click or pointer down
        this.domDisposers.push(addAsyncEventListener(closeButton, 'click', handleClose));
        this.domDisposers.push(addAsyncEventListener(closeButton, 'pointerdown', handleClose));
    }
}
