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

import type { FrontMatterCache } from 'obsidian';
import type { NotebookNavigatorSettings } from '../settings';
import {
    decodeHtmlEntitiesPreservingCode,
    stripHtmlTagsPreservingCode,
    type CodeRangeContext,
    type HtmlStripOptions
} from './previewText/codeAwareTransforms';
import { extractCodeBlockContent, stripMarkdownSyntax } from './previewText/markdownSanitizer';
import { extractPreviewText, isExcalidrawFile, normalizeExcerpt } from './previewText/previewPipeline';

/**
 * Preview text extraction utilities.
 *
 * The public API stays on `PreviewTextUtils`; implementation lives in `src/utils/previewText/*`.
 */
export class PreviewTextUtils {
    static isExcalidrawFile(fileName: string, frontmatter?: FrontMatterCache): boolean {
        return isExcalidrawFile(fileName, frontmatter);
    }

    static stripMarkdownSyntax(
        text: string,
        skipHeadings: boolean = false,
        skipCodeBlocks: boolean = true,
        codeRangeContext?: CodeRangeContext
    ): string {
        return stripMarkdownSyntax(text, skipHeadings, skipCodeBlocks, codeRangeContext);
    }

    static stripHtmlTagsPreservingCode(text: string, options?: HtmlStripOptions): string {
        return stripHtmlTagsPreservingCode(text, options);
    }

    static decodeHtmlEntitiesPreservingCode(text: string, options?: HtmlStripOptions): string {
        return decodeHtmlEntitiesPreservingCode(text, options);
    }

    static normalizeExcerpt(excerpt: string, options?: { stripHtml?: boolean }): string | undefined {
        return normalizeExcerpt(excerpt, options);
    }

    static extractCodeBlockContent(block: string): string {
        return extractCodeBlockContent(block);
    }

    static extractPreviewText(content: string, settings: NotebookNavigatorSettings, frontmatter?: FrontMatterCache): string {
        return extractPreviewText(content, settings, frontmatter);
    }
}
