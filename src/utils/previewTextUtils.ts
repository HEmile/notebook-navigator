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

import { FrontMatterCache } from 'obsidian';
import { NotebookNavigatorSettings } from '../settings';

// Maximum number of characters for preview text
const MAX_PREVIEW_TEXT_LENGTH = 500;

// Base patterns used in both regex versions
const BASE_PATTERNS = [
    // Group 0: Code blocks - remove entirely
    // Example: ```javascript\nconst x = 1;\n``` → (removed)
    /```[\s\S]*?```/.source,
    // Group 1: Obsidian comments - remove entirely (both inline and block)
    // Example: %%comment%% → (removed), %%\nmultiline\n%% → (removed)
    /%%[\s\S]*?%%/.source,
    // Group 2: Inline code - remove backticks but keep text
    // Example: `console.log()` → console.log()
    /`[^`]+`/.source,
    // Group 3: Images and embeds - remove entirely
    // Example: ![alt](image.png) → (removed)
    /!\[.*?\]\([^)]+\)/.source,
    // Group 4: Wiki embeds - remove entirely
    // Example: ![[image.png]] or ![[_resources/Pasted image.png]] → (removed)
    /!\[\[.*?\]\]/.source,
    // Group 5: Tags - remove entirely
    // Example: #tag, #parent/child → (removed)
    // Must be followed by whitespace or end of line to avoid matching things like #1 in issue numbers
    /#[\w\-/]+(?=\s|$)/.source,
    // Group 6: Escape characters
    // Example: \* → *
    /\\([*_~`])/.source,
    // Group 7: Bold italic stars (must come before bold/italic)
    // Example: ***important*** → important
    /\*\*\*((?:(?!\*\*\*).)+)\*\*\*/.source,
    // Group 8: Bold italic underscores (must come before bold/italic)
    // Example: ___important___ → important
    /___((?:(?!___).)+)___/.source,
    // Group 9: Bold italic nested - bold stars with italic underscores
    // Example: **_important_** → important
    /\*\*_((?:(?!_\*\*).)+)_\*\*/.source,
    // Group 10: Bold italic nested - bold underscores with italic stars
    // Example: __*important*__ → important
    /__\*((?:(?!\*__).)+)\*__/.source,
    // Group 11: Bold stars with highlight
    // Example: **==important==** → important
    /\*\*==((?:(?!==\*\*).)+)==\*\*/.source,
    // Group 12: Highlight with bold stars
    // Example: ==**important**== → important
    /==\*\*((?:(?!\*\*==).)+)\*\*==/.source,
    // Group 13: Bold underscores with highlight
    // Example: __==important==__ → important
    /__==((?:(?!==__).)+)==__/.source,
    // Group 14: Highlight with bold underscores
    // Example: ==__important__== → important
    /==__((?:(?!__==).)+)__==/.source,
    // Group 15: Bold stars
    // Example: **bold** → bold
    /\*\*((?:(?!\*\*).)+)\*\*/.source,
    // Group 16: Bold underscores
    // Example: __bold__ → bold
    /__((?:(?!__).)+)__/.source,
    // Group 17: Italic stars (iOS compatible - no lookbehind)
    // Example: *italic* → italic (but not 5*6*7)
    // Captures: [17] = prefix, [18] = content
    /(^|[^*\d])\*([^*\n]+)\*(?![*\d])/.source,
    // Group 18: Italic underscores (iOS compatible - no lookbehind)
    // Example: _italic_ → italic (but not variable_name_here)
    // Captures: [18] = prefix, [19] = content
    /(^|[^_a-zA-Z0-9])_([^_\n]+)_(?![_a-zA-Z0-9])/.source,
    // Group 19: Strikethrough
    // Example: ~~deleted~~ → deleted
    /~~((?:(?!~~).)+)~~/.source,
    // Group 20: Highlight
    // Example: ==highlighted== → highlighted
    /==((?:(?!==).)+)==/.source,
    // Group 21: Links
    // Example: [Google](https://google.com) → Google
    /\[([^\]]+)\]\([^)]+\)/.source,
    // Group 22: Wiki links with display
    // Example: [[Some Page|Display Text]] → Display Text
    /\[\[[^\]|]+\|([^\]]+)\]\]/.source,
    // Group 23: Wiki links
    // Example: [[Some Page]] → Some Page
    /\[\[([^\]]+)\]\]/.source,
    // Group 24: Callout titles (supports [!...] and [!...]+/-)
    // Examples:
    // [!info] Optional title → (removed)
    // [!info]+ Optional title → (removed)
    // [!info]- Optional title → (removed)
    /\[![\w-]+\][+-]?(?:\s+[^\n]*)?/.source,
    // Group 25: List markers - remove marker prefix while keeping text
    // Example: - List item → List item, 1. Item → Item
    /^(?:[-*+]\s+|\d+\.\s+)/.source,
    // Group 26: Blockquotes - remove entire line
    // Example: > Quote → (removed), >Quote → (removed)
    /^>\s?.*$/m.source,
    // Group 27: Heading markers (always strip the # symbols, keep the text)
    // Example: # Title → Title, ## Section → Section
    /^(#+)\s+(.*)$/m.source,
    // Group 28: Markdown tables - matches table rows (lines with pipes)
    // Example: | Header | Another | → (removed)
    // This captures lines that start with optional whitespace, then |, and contain at least one more |
    /^\s*\|.*\|.*$/m.source,
    // Group 29: Inline footnotes
    // Example: text ^[detail] → text
    /\^\[[^\]]*?]/.source,
    // Group 30: Footnote references
    // Example: reference[^1] → reference
    /\[\^[^\]]+]/.source,
    // Group 31: Footnote definitions
    // Example: [^1]: Footnote text → (removed)
    /^\s*\[\^[^\]]+]:.*$/m.source
];

// Regex without heading removal
const REGEX_STRIP_MARKDOWN = new RegExp(BASE_PATTERNS.join('|'), 'gm');

// Both regexes are now the same since heading handling is in the replacement logic
const REGEX_STRIP_MARKDOWN_WITH_HEADINGS = REGEX_STRIP_MARKDOWN;

export class PreviewTextUtils {
    /**
     * Checks if a file is an Excalidraw drawing
     * @param fileName The name of the file
     * @param frontmatter Optional frontmatter object to check
     * @returns True if the file is an Excalidraw drawing
     */
    static isExcalidrawFile(fileName: string, frontmatter?: FrontMatterCache): boolean {
        // Check filename pattern
        if (fileName.endsWith('.excalidraw.md')) {
            return true;
        }

        // Check frontmatter for excalidraw-plugin property
        if (frontmatter?.['excalidraw-plugin']) {
            return true;
        }

        return false;
    }

    /**
     * Strips markdown syntax from text to create clean preview text
     * @param text The text to strip markdown from
     * @param skipHeadings Whether to remove headings
     * @param skipCodeBlocks Whether to remove fenced code blocks
     * @returns The text with markdown syntax removed
     */
    static stripMarkdownSyntax(text: string, skipHeadings: boolean = false, skipCodeBlocks: boolean = true): string {
        const regex = skipHeadings ? REGEX_STRIP_MARKDOWN_WITH_HEADINGS : REGEX_STRIP_MARKDOWN;

        return text.replace(regex, (match, ...groups) => {
            // Check for specific patterns to remove entirely
            // Code blocks
            if (match.startsWith('```')) {
                if (skipCodeBlocks) {
                    return '';
                }
                return PreviewTextUtils.extractCodeBlockContent(match);
            }

            // Obsidian comments
            if (match.startsWith('%%') && match.endsWith('%%')) {
                return '';
            }

            // Callout titles
            if (match.match(/\[![\w-]+\]/)) {
                return '';
            }

            // Inline code
            if (match.startsWith('`') && match.endsWith('`')) {
                return match.slice(1, -1);
            }

            // Images and embeds
            if (match.startsWith('!')) {
                return '';
            }

            // Tags
            if (match.match(/#[\w\-/]+(?=\s|$)/)) {
                return '';
            }

            // Footnote inline syntax and references
            const trimmedFootnoteMatch = match.trimStart();
            if (trimmedFootnoteMatch.startsWith('^[') || trimmedFootnoteMatch.startsWith('[^')) {
                return '';
            }

            // Blockquotes (entire line already matched)
            if (match.startsWith('>')) {
                return match.replace(/^>(?:\s?>)*\s?/, '').trimStart();
            }

            // Italic with stars - preserve prefix and content
            const italicStarMatch = match.match(/(^|[^*\d])\*([^*\n]+)\*(?![*\d])/);
            if (italicStarMatch) {
                return `${italicStarMatch[1]}${italicStarMatch[2]}`;
            }

            // Italic with underscores - preserve prefix and content
            const italicUnderscoreMatch = match.match(/(^|[^_a-zA-Z0-9])_([^_\n]+)_(?![_a-zA-Z0-9])/);
            if (italicUnderscoreMatch) {
                return `${italicUnderscoreMatch[1]}${italicUnderscoreMatch[2]}`;
            }

            // Headings - always strip # symbols
            if (match.match(/^#+\s+/)) {
                // If skipHeadings is true, remove entire heading
                if (skipHeadings) {
                    return '';
                }
                // Otherwise, return just the heading text without # symbols
                // The heading text is in the last captured group before offset/string
                const headingTextIndex = groups.length - 3; // -2 for offset/string, -1 for heading text position
                return groups[headingTextIndex] || '';
            }

            // List markers
            if (match.match(/^[-+\d]/) || match.match(/^\*\s+/)) {
                return '';
            }

            // Markdown tables
            if (match.match(/^\s*\|.*\|/)) {
                return '';
            }

            // Find first defined capture group - that's our content to keep
            for (let i = 0; i < groups.length - 2; i++) {
                // -2 for offset and string
                if (groups[i] !== undefined) {
                    return groups[i];
                }
            }

            return match;
        });
    }

    private static extractCodeBlockContent(block: string): string {
        const withoutOpeningFence = block.replace(/^```[^\n\r]*\r?\n?/, '');
        const withoutClosingFence = withoutOpeningFence.replace(/\r?\n?```(?:\s*)$/, '');
        return withoutClosingFence;
    }

    /**
     * Extracts preview text from markdown content
     * Simple one-pass implementation with fixed character limit
     * @param content The full markdown content
     * @param settings The plugin settings
     * @param frontmatter Optional frontmatter object to check for preview properties
     * @returns The preview text (max characters defined by MAX_PREVIEW_TEXT_LENGTH) or empty string
     */
    static extractPreviewText(content: string, settings: NotebookNavigatorSettings, frontmatter?: FrontMatterCache): string {
        // Check preview properties first if frontmatter is provided
        if (frontmatter && settings.previewProperties && settings.previewProperties.length > 0) {
            for (const property of settings.previewProperties) {
                if (frontmatter[property]) {
                    const propertyValue = String(frontmatter[property]).trim();
                    if (propertyValue) {
                        // Apply same character limit to property values
                        const maxChars = MAX_PREVIEW_TEXT_LENGTH;
                        if (propertyValue.length > maxChars) {
                            return `${propertyValue.substring(0, maxChars - 1)}…`;
                        }
                        return propertyValue;
                    }
                }
            }
        }

        // Fallback to extracting from content
        if (!content) return '';

        // Remove frontmatter in one shot
        const contentWithoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');
        if (!contentWithoutFrontmatter.trim()) return '';

        // Strip all markdown at once with appropriate regex
        const stripped = this.stripMarkdownSyntax(
            contentWithoutFrontmatter,
            settings.skipHeadingsInPreview,
            settings.skipCodeBlocksInPreview
        );

        // Remove leading task checkbox markers while keeping task text
        const withoutTaskCheckboxes = stripped.replace(/^\s*(?:[-*+]\s+|\d+\.\s+)?\[(?: |x|X|\/|-)?\]\]?\s*/gm, '');

        // Remove lines that only contain dashes (like -, ---, ----- etc.)
        const withoutDashLines = withoutTaskCheckboxes.replace(/^-+$/gm, '');

        // Clean up extra whitespace and truncate
        const preview = withoutDashLines
            .split(/\s+/) // Split on any whitespace
            .filter(word => word) // Remove empty strings
            .join(' ') // Join with single spaces
            .trim();

        if (!preview) return '';

        // Fixed character limit with ellipsis
        const maxChars = MAX_PREVIEW_TEXT_LENGTH;
        if (preview.length > maxChars) {
            return `${preview.substring(0, maxChars - 1)}…`;
        }

        return preview;
    }
}
