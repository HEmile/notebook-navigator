import { describe, expect, it, vi } from 'vitest';
import { PreviewTextUtils } from '../../src/utils/previewTextUtils';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { NotebookNavigatorSettings } from '../../src/settings/types';

vi.mock('obsidian', () => ({}));

function createSettings(overrides: Partial<NotebookNavigatorSettings> = {}): NotebookNavigatorSettings {
    return {
        ...DEFAULT_SETTINGS,
        ...overrides
    };
}

describe('PreviewTextUtils.extractPreviewText', () => {
    const skipCodeSettings = createSettings({ skipHeadingsInPreview: false, skipCodeBlocksInPreview: true });
    const includeCodeSettings = createSettings({ skipHeadingsInPreview: false, skipCodeBlocksInPreview: false });

    it('keeps italic content wrapped with asterisks', () => {
        const preview = PreviewTextUtils.extractPreviewText('*Italicized* text', skipCodeSettings);
        expect(preview).toBe('Italicized text');
    });

    it('keeps italic content wrapped with underscores', () => {
        const preview = PreviewTextUtils.extractPreviewText('Value with _italic_ content', skipCodeSettings);
        expect(preview).toBe('Value with italic content');
    });

    it('keeps inline code content while removing backticks when code blocks are included', () => {
        const preview = PreviewTextUtils.extractPreviewText('Example `inline` snippet', includeCodeSettings);
        expect(preview).toBe('Example inline snippet');
    });

    it('keeps inline code when code blocks are skipped', () => {
        const preview = PreviewTextUtils.extractPreviewText('Example `inline` snippet', skipCodeSettings);
        expect(preview).toBe('Example inline snippet');
    });

    it('keeps blockquote text without trailing space', () => {
        const preview = PreviewTextUtils.extractPreviewText('>Quote without space', skipCodeSettings);
        expect(preview).toBe('Quote without space');
    });

    it('keeps blockquote text with trailing space', () => {
        const preview = PreviewTextUtils.extractPreviewText('> Johan', skipCodeSettings);
        expect(preview).toBe('Johan');
    });

    it('strips checkbox syntax while keeping list text', () => {
        const preview = PreviewTextUtils.extractPreviewText('- [ ] Draft task\n- Note item', skipCodeSettings);
        expect(preview).toBe('Draft task Note item');
    });

    it('strips checkbox syntax from indented tasks', () => {
        const preview = PreviewTextUtils.extractPreviewText('    - [ ] Nested task', skipCodeSettings);
        expect(preview).toBe('Nested task');
    });

    it('strips alternate task states while keeping text', () => {
        const content = '+ [x] Done task\n* [/] In progress task\n1. [-] Skipped task';
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Done task In progress task Skipped task');
    });

    it('removes inline footnotes from preview text', () => {
        const preview = PreviewTextUtils.extractPreviewText('Sentence ^[footnote content] continues', skipCodeSettings);
        expect(preview).toBe('Sentence continues');
    });

    it('removes footnote references and definitions', () => {
        const content = 'Reference[^1] continues.\n\n[^1]: Footnote details';
        const preview = PreviewTextUtils.extractPreviewText(content, skipCodeSettings);
        expect(preview).toBe('Reference continues.');
    });
});
