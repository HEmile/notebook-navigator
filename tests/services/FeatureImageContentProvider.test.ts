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
import { describe, expect, it, vi } from 'vitest';
import { App, TFile, parseYaml, type CachedMetadata, type FrontMatterCache } from 'obsidian';
import { MarkdownPipelineContentProvider } from '../../src/services/content/MarkdownPipelineContentProvider';
import { findFeatureImageReference, type FeatureImageReference } from '../../src/services/content/featureImageReferenceResolver';
import { DEFAULT_SETTINGS } from '../../src/settings/defaultSettings';
import type { NotebookNavigatorSettings } from '../../src/settings/types';
import type { FileData } from '../../src/storage/IndexedDBStorage';
import { deriveFileMetadata } from '../utils/pathMetadata';

class TestFeatureImageContentProvider extends MarkdownPipelineContentProvider {
    async runProcessFile(file: TFile, settings: NotebookNavigatorSettings) {
        const result = await this.processFile({ file, path: file.path }, null, settings);
        return result.update;
    }

    async runProcessFileWithData(file: TFile, fileData: FileData | null, settings: NotebookNavigatorSettings) {
        const result = await this.processFile({ file, path: file.path }, fileData, settings);
        return result.update;
    }

    buildKey(reference: FeatureImageReference): string {
        return this.getFeatureImageKey(reference);
    }
}

function createSettings(overrides?: Partial<NotebookNavigatorSettings>): NotebookNavigatorSettings {
    return {
        ...DEFAULT_SETTINGS,
        showFilePreview: false,
        notePropertyType: 'none',
        featureImageProperties: ['thumbnail'],
        downloadExternalFeatureImages: true,
        ...overrides
    };
}

function createApp() {
    const app = new App();
    const resolvedFiles = new Map<string, TFile>();
    const cachedMetadataByPath = new Map<string, CachedMetadata>();

    app.metadataCache.getFileCache = (file: TFile) => cachedMetadataByPath.get(file.path) ?? null;
    const getFirstLinkpathDest = vi.fn<(path: string, sourcePath: string) => TFile | null>(
        (path: string) => resolvedFiles.get(path) ?? null
    );
    app.metadataCache.getFirstLinkpathDest = getFirstLinkpathDest;
    app.vault.getFolderByPath = () => null;
    app.vault.getAbstractFileByPath = (path: string) => resolvedFiles.get(path) ?? null;
    app.vault.cachedRead = async (_file: TFile) => '';
    app.vault.adapter.readBinary = async () => new ArrayBuffer(0);

    return { app, cachedMetadataByPath, resolvedFiles, getFirstLinkpathDest };
}

function createFile(path: string): TFile {
    const file = new TFile();
    const metadata = deriveFileMetadata(path);
    file.path = path;
    file.name = metadata.name;
    file.basename = metadata.basename;
    file.extension = metadata.extension;
    return file;
}

type FrontmatterBlock = {
    yamlText: string;
    bodyStartIndex: number;
};

function extractFrontmatterBlock(content: string): FrontmatterBlock | null {
    const firstLineEnd = content.indexOf('\n');
    const firstLine = firstLineEnd === -1 ? content : content.slice(0, firstLineEnd);
    const normalizedFirstLine = firstLine.charCodeAt(0) === 0xfeff ? firstLine.slice(1) : firstLine;

    if (normalizedFirstLine.trim() !== '---' || firstLineEnd === -1) {
        return null;
    }

    const yamlStart = firstLineEnd + 1;
    let lineStart = yamlStart;
    while (lineStart <= content.length) {
        const nextLineEnd = content.indexOf('\n', lineStart);
        const lineEnd = nextLineEnd === -1 ? content.length : nextLineEnd;
        const line = content.slice(lineStart, lineEnd);
        const trimmed = line.trim();

        if (trimmed === '---' || trimmed === '...') {
            const yamlText = content.slice(yamlStart, lineStart);
            const bodyStartIndex = nextLineEnd === -1 ? content.length : lineEnd + 1;
            return { yamlText, bodyStartIndex };
        }

        if (nextLineEnd === -1) {
            break;
        }

        lineStart = lineEnd + 1;
    }

    return null;
}

function createFrontmatterPosition(bodyStartIndex: number): CachedMetadata['frontmatterPosition'] {
    return {
        start: { line: 0, col: 0, offset: 0 },
        end: { line: 0, col: 0, offset: bodyStartIndex }
    };
}

function isFrontMatterCache(value: unknown): value is FrontMatterCache {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deriveFrontmatterAndBodyStartIndex(content: string): { frontmatter: FrontMatterCache | null; bodyStartIndex: number } {
    const block = extractFrontmatterBlock(content);
    if (!block) {
        return { frontmatter: null, bodyStartIndex: 0 };
    }

    const yamlText = block.yamlText.trim();
    if (yamlText.length === 0) {
        return { frontmatter: null, bodyStartIndex: block.bodyStartIndex };
    }

    const parsed: unknown = parseYaml(yamlText);
    if (!isFrontMatterCache(parsed) || Object.keys(parsed).length === 0) {
        return { frontmatter: null, bodyStartIndex: block.bodyStartIndex };
    }

    return { frontmatter: parsed, bodyStartIndex: block.bodyStartIndex };
}

function resolveReference(app: App, file: TFile, content: string, settings: NotebookNavigatorSettings) {
    const { frontmatter, bodyStartIndex } = deriveFrontmatterAndBodyStartIndex(content);
    return findFeatureImageReference({ app, file, content, settings, frontmatter, bodyStartIndex });
}

function setMarkdownContent(
    context: ReturnType<typeof createApp>,
    file: TFile,
    content: string,
    options?: { overrideRead?: boolean }
): void {
    if (options?.overrideRead !== false) {
        context.app.vault.cachedRead = async (target: TFile) => {
            return target.path === file.path ? content : '';
        };
    }

    const { frontmatter, bodyStartIndex } = deriveFrontmatterAndBodyStartIndex(content);
    const metadata: CachedMetadata = {};

    if (frontmatter) {
        metadata.frontmatter = frontmatter;
    }

    if (bodyStartIndex > 0) {
        metadata.frontmatterPosition = createFrontmatterPosition(bodyStartIndex);
    }

    context.cachedMetadataByPath.set(file.path, metadata);
}

describe('FeatureImageContentProvider scanning', () => {
    it('treats featureImagePixelSize as a markdown regeneration setting', () => {
        const { app } = createApp();
        const provider = new TestFeatureImageContentProvider(app);

        expect(provider.getRelevantSettings()).toContain('featureImagePixelSize');
        expect(
            provider.shouldRegenerate(
                { ...DEFAULT_SETTINGS, featureImagePixelSize: '256' },
                { ...DEFAULT_SETTINGS, featureImagePixelSize: '384' }
            )
        ).toBe(true);
    });

    it('uses the first embedded YouTube link in the document', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings({ downloadExternalFeatureImages: true });
        const noteFile = createFile('notes/note.md');

        const imageFile = createFile('images/cover.png');
        resolvedFiles.set('image', imageFile);
        resolvedFiles.set(imageFile.path, imageFile);

        const content = `![](https://youtu.be/abc123)\n![[image]]`;
        const result = resolveReference(app, noteFile, content, settings);

        expect(result?.kind).toBe('youtube');
        if (result?.kind === 'youtube') {
            expect(result.videoId).toBe('abc123');
        }
    });

    it('resolves extensionless wiki embeds to local images', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const imageFile = createFile('images/hero.png');
        resolvedFiles.set('hero', imageFile);
        resolvedFiles.set(imageFile.path, imageFile);

        const result = resolveReference(app, noteFile, '![[hero]]', settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(imageFile.path);
        }
    });

    it('resolves wiki embeds that contain brackets in the path', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const target = '_resources/[1762422974956].jpg';
        const imageFile = createFile(`attachments/${target}`);
        resolvedFiles.set(target, imageFile);
        resolvedFiles.set(imageFile.path, imageFile);

        const result = resolveReference(app, noteFile, `![[${target}]]`, settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(imageFile.path);
        }
    });

    it('resolves extensionless markdown embeds to local images', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const imageFile = createFile('images/hero.png');
        resolvedFiles.set('hero', imageFile);
        resolvedFiles.set(imageFile.path, imageFile);

        const result = resolveReference(app, noteFile, '![](hero)', settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(imageFile.path);
        }
    });

    it('skips external images when downloads are disabled and continues scanning', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings({ downloadExternalFeatureImages: false });
        const noteFile = createFile('notes/note.md');

        const imageFile = createFile('images/hero.png');
        resolvedFiles.set('hero', imageFile);
        resolvedFiles.set(imageFile.path, imageFile);

        const content = `![](https://example.com/cover.jpg)\n![[hero]]`;
        const result = resolveReference(app, noteFile, content, settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(imageFile.path);
        }
    });

    it('ignores frontmatter content when scanning the document body', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const imageFile = createFile('images/hero.png');
        resolvedFiles.set('hero', imageFile);
        resolvedFiles.set(imageFile.path, imageFile);

        const content = `---\ncover: ![](https://youtu.be/frontmatter)\n---\n![[hero]]`;
        const result = resolveReference(app, noteFile, content, settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(imageFile.path);
        }
    });

    it('ignores CRLF frontmatter content when scanning the document body', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const imageFile = createFile('images/hero.png');
        resolvedFiles.set('hero', imageFile);
        resolvedFiles.set(imageFile.path, imageFile);

        const content = `---\r\ncover: ![](https://youtu.be/frontmatter)\r\n---\r\n![[hero]]`;
        const result = resolveReference(app, noteFile, content, settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(imageFile.path);
        }
    });

    it('skips non-image wiki embeds with extensions before resolving and continues scanning', () => {
        const { app, resolvedFiles, getFirstLinkpathDest } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const imageFile = createFile('images/hero.png');
        resolvedFiles.set('hero', imageFile);
        resolvedFiles.set(imageFile.path, imageFile);

        const content = `![[note.md]]\n![[hero]]`;
        const result = resolveReference(app, noteFile, content, settings);

        expect(result?.kind).toBe('local');
        expect(getFirstLinkpathDest.mock.calls.some(call => call[0] === 'note.md')).toBe(false);
    });

    it('skips non-image markdown embeds with extensions before resolving and continues scanning', () => {
        const { app, resolvedFiles, getFirstLinkpathDest } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const imageFile = createFile('images/hero.png');
        resolvedFiles.set('hero', imageFile);
        resolvedFiles.set(imageFile.path, imageFile);

        const content = `![](doc.docx)\n![[hero]]`;
        const result = resolveReference(app, noteFile, content, settings);

        expect(result?.kind).toBe('local');
        expect(getFirstLinkpathDest.mock.calls.some(call => call[0] === 'doc.docx')).toBe(false);
    });

    it('resolves PDF markdown embeds to local files', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const pdfFile = createFile('resources/doc.pdf');
        resolvedFiles.set('doc.pdf', pdfFile);
        resolvedFiles.set(pdfFile.path, pdfFile);

        const result = resolveReference(app, noteFile, '![](doc.pdf)', settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(pdfFile.path);
        }
    });

    it('resolves PDF markdown embeds with fragments to local files', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const pdfFile = createFile('resources/doc.pdf');
        resolvedFiles.set('doc.pdf', pdfFile);
        resolvedFiles.set(pdfFile.path, pdfFile);

        const result = resolveReference(app, noteFile, '![](doc.pdf#page=2)', settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(pdfFile.path);
        }
    });

    it('resolves PDF markdown embeds with query strings to local files', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const pdfFile = createFile('resources/doc.pdf');
        resolvedFiles.set('doc.pdf', pdfFile);
        resolvedFiles.set(pdfFile.path, pdfFile);

        const result = resolveReference(app, noteFile, '![](doc.pdf?page=2)', settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(pdfFile.path);
        }
    });

    it('resolves PDF wiki embeds to local files', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const pdfFile = createFile('resources/hero.pdf');
        resolvedFiles.set('hero.pdf', pdfFile);
        resolvedFiles.set(pdfFile.path, pdfFile);

        const result = resolveReference(app, noteFile, '![[hero.pdf]]', settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(pdfFile.path);
        }
    });

    it('resolves PDF wiki embeds with fragments to local files', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const pdfFile = createFile('resources/hero.pdf');
        resolvedFiles.set('hero.pdf', pdfFile);
        resolvedFiles.set(pdfFile.path, pdfFile);

        const result = resolveReference(app, noteFile, '![[hero.pdf#page=2]]', settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(pdfFile.path);
        }
    });

    it('resolves PDF wiki embeds with query strings to local files', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const pdfFile = createFile('resources/hero.pdf');
        resolvedFiles.set('hero.pdf', pdfFile);
        resolvedFiles.set(pdfFile.path, pdfFile);

        const result = resolveReference(app, noteFile, '![[hero.pdf?page=2]]', settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(pdfFile.path);
        }
    });

    it('continues scanning when PDF embed cannot be resolved', () => {
        const { app, resolvedFiles, getFirstLinkpathDest } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const imageFile = createFile('images/hero.png');
        resolvedFiles.set('hero', imageFile);
        resolvedFiles.set(imageFile.path, imageFile);

        const content = `![](doc.pdf)\n![[hero]]`;
        const result = resolveReference(app, noteFile, content, settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(imageFile.path);
        }
        expect(getFirstLinkpathDest.mock.calls.some(call => call[0] === 'doc.pdf')).toBe(true);
    });

    it('resolves frontmatter properties to local images', () => {
        const { app, resolvedFiles } = createApp();
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');

        const imageFile = createFile('images/hero.png');
        resolvedFiles.set('hero', imageFile);
        resolvedFiles.set(imageFile.path, imageFile);

        const content = `---\nthumbnail: ![[hero]]\n---`;
        const result = resolveReference(app, noteFile, content, settings);

        expect(result?.kind).toBe('local');
        if (result?.kind === 'local') {
            expect(result.file.path).toBe(imageFile.path);
        }
    });

    it('preserves query params in frontmatter external URLs while stripping the hash', () => {
        const { app } = createApp();
        const settings = createSettings({ downloadExternalFeatureImages: true });
        const noteFile = createFile('notes/note.md');

        const content = `---\nthumbnail: https://example.com/cover.jpg?width=800&sig=%2Babc#frag\n---`;
        const result = resolveReference(app, noteFile, content, settings);

        expect(result?.kind).toBe('external');
        if (result?.kind === 'external') {
            expect(result.url).toBe('https://example.com/cover.jpg?width=800&sig=%2Babc');
        }
    });

    it('preserves encoded query params in markdown external URLs while stripping the hash', () => {
        const { app } = createApp();
        const settings = createSettings({ downloadExternalFeatureImages: true });
        const noteFile = createFile('notes/note.md');

        const content = '![](https://example.com/cover.jpg?width=800&sig=%2Babc#frag)';
        const result = resolveReference(app, noteFile, content, settings);

        expect(result?.kind).toBe('external');
        if (result?.kind === 'external') {
            expect(result.url).toBe('https://example.com/cover.jpg?width=800&sig=%2Babc');
        }
    });

    it('includes source mtime in local image cache keys', () => {
        const { app } = createApp();
        const provider = new TestFeatureImageContentProvider(app);
        const imageFile = createFile('images/hero.png');
        imageFile.stat.mtime = 12345;

        const key = provider.buildKey({ kind: 'local', file: imageFile });

        expect(key).toBe(`f:${imageFile.path}@${imageFile.stat.mtime}`);
    });

    it('skips regeneration when featureImageKey matches even without a blob', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');
        setMarkdownContent(context, noteFile, '');

        // Existing data already recorded the same feature image key.
        const fileData: FileData = {
            mtime: noteFile.stat.mtime,
            markdownPipelineMtime: noteFile.stat.mtime,
            tagsMtime: noteFile.stat.mtime,
            metadataMtime: noteFile.stat.mtime,
            fileThumbnailsMtime: noteFile.stat.mtime,
            tags: null,
            wordCount: null,
            taskTotal: 0,
            taskUnfinished: 0,
            properties: null,
            previewStatus: 'unprocessed',
            featureImage: null,
            featureImageStatus: 'none',
            featureImageKey: 'e:https://example.com/cover.jpg',
            metadata: null
        };

        // No feature image update is emitted when the key matches, but word count is still stored.
        const result = await provider.runProcessFileWithData(noteFile, fileData, settings);
        expect(result).toEqual({ path: noteFile.path, wordCount: 0 });
    });

    it('acknowledges mtime mismatch when featureImageKey matches and a thumbnail exists', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings();
        const noteFile = createFile('notes/note.md');
        noteFile.stat.mtime = 200;

        const content = `---\nthumbnail: https://example.com/cover.jpg\n---\n`;
        setMarkdownContent(context, noteFile, content);

        const fileData: FileData = {
            mtime: noteFile.stat.mtime,
            markdownPipelineMtime: 100,
            tagsMtime: 100,
            metadataMtime: 100,
            fileThumbnailsMtime: 100,
            tags: null,
            wordCount: null,
            taskTotal: 0,
            taskUnfinished: 0,
            properties: null,
            previewStatus: 'unprocessed',
            featureImage: null,
            featureImageStatus: 'has',
            featureImageKey: 'e:https://example.com/cover.jpg',
            metadata: null
        };

        const result = await provider.runProcessFileWithData(noteFile, fileData, settings);

        expect(result).toEqual({ path: noteFile.path, wordCount: 0 });
    });

    it('retries external downloads when the file changed but the featureImageKey did not', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings({ downloadExternalFeatureImages: true });
        const noteFile = createFile('notes/note.md');
        noteFile.stat.mtime = 200;

        const content = `---\nthumbnail: https://example.com/cover.jpg\n---\n`;
        setMarkdownContent(context, noteFile, content);

        const fileData: FileData = {
            mtime: noteFile.stat.mtime,
            markdownPipelineMtime: 100,
            tagsMtime: 100,
            metadataMtime: 100,
            fileThumbnailsMtime: 100,
            tags: null,
            wordCount: null,
            taskTotal: 0,
            taskUnfinished: 0,
            properties: null,
            previewStatus: 'unprocessed',
            featureImage: null,
            featureImageStatus: 'none',
            featureImageKey: 'e:https://example.com/cover.jpg',
            metadata: null
        };

        const result = await provider.runProcessFileWithData(noteFile, fileData, settings);

        expect(result).not.toBeNull();
        expect(result?.featureImageKey).toBe('e:https://example.com/cover.jpg');
        expect(result?.featureImage).toBeInstanceOf(Blob);
        expect(result?.featureImage?.size).toBe(0);
    });

    it('retries YouTube thumbnails when the file changed but the featureImageKey did not', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings({ downloadExternalFeatureImages: true });
        const noteFile = createFile('notes/note.md');
        noteFile.stat.mtime = 200;

        const content = `---\nthumbnail: https://youtu.be/abc123\n---\n`;
        setMarkdownContent(context, noteFile, content);

        const fileData: FileData = {
            mtime: noteFile.stat.mtime,
            markdownPipelineMtime: 100,
            tagsMtime: 100,
            metadataMtime: 100,
            fileThumbnailsMtime: 100,
            tags: null,
            wordCount: null,
            taskTotal: 0,
            taskUnfinished: 0,
            properties: null,
            previewStatus: 'unprocessed',
            featureImage: null,
            featureImageStatus: 'none',
            featureImageKey: 'y:abc123',
            metadata: null
        };

        const result = await provider.runProcessFileWithData(noteFile, fileData, settings);

        expect(result).not.toBeNull();
        expect(result?.featureImageKey).toBe('y:abc123');
        expect(result?.featureImage).toBeInstanceOf(Blob);
        expect(result?.featureImage?.size).toBe(0);
    });

    it('skips feature image storage when note contains an excluded property', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings({ featureImageExcludeProperties: ['private'] });
        const noteFile = createFile('notes/note.md');

        const content = `---\nprivate: true\nthumbnail: https://example.com/cover.jpg\n---\n`;
        setMarkdownContent(context, noteFile, content);

        const result = await provider.runProcessFile(noteFile, settings);

        expect(result).not.toBeNull();
        expect(result?.featureImageKey).toBe('');
        expect(result?.featureImage).toBeInstanceOf(Blob);
        expect(result?.featureImage?.size).toBe(0);
    });

    it('does not read note content when excluded property only affects feature images', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings({ featureImageExcludeProperties: ['private'] });
        const noteFile = createFile('notes/note.md');

        const content = `---\nprivate: true\n---\n`;
        setMarkdownContent(context, noteFile, content, { overrideRead: false });

        const cachedRead = vi.fn<() => Promise<string>>(async () => content);
        app.vault.cachedRead = cachedRead;

        const fileData: FileData = {
            mtime: noteFile.stat.mtime,
            markdownPipelineMtime: noteFile.stat.mtime,
            tagsMtime: noteFile.stat.mtime,
            metadataMtime: noteFile.stat.mtime,
            fileThumbnailsMtime: noteFile.stat.mtime,
            tags: null,
            wordCount: 0,
            taskTotal: 0,
            taskUnfinished: 0,
            properties: null,
            previewStatus: 'none',
            featureImage: null,
            featureImageStatus: 'unprocessed',
            featureImageKey: null,
            metadata: null
        };

        const result = await provider.runProcessFileWithData(noteFile, fileData, settings);

        expect(cachedRead).not.toHaveBeenCalled();
        expect(result).not.toBeNull();
        expect(result?.featureImageKey).toBe('');
        expect(result?.featureImage).toBeInstanceOf(Blob);
        expect(result?.featureImage?.size).toBe(0);
    });

    it('stores empty blob when external download fails', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings({ downloadExternalFeatureImages: true });
        const noteFile = createFile('notes/note.md');

        // Provide a document with an external image reference.
        const content = '![](https://example.com/cover.jpg)';
        setMarkdownContent(context, noteFile, content);

        const result = await provider.runProcessFile(noteFile, settings);

        // An empty blob is written alongside the key when no thumbnail is produced.
        expect(result).not.toBeNull();
        expect(result?.featureImageKey).toBe('e:https://example.com/cover.jpg');
        expect(result?.featureImage).toBeInstanceOf(Blob);
        expect(result?.featureImage?.size).toBe(0);
    });

    it('generates Excalidraw feature images via ExcalidrawAutomate', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings();
        const excalidrawFile = createFile('drawings/sketch.excalidraw.md');
        excalidrawFile.stat.mtime = 123;
        setMarkdownContent(context, excalidrawFile, '');

        const destroy = vi.fn<() => void>();
        const createPng = vi.fn<
            (
                view: undefined,
                scale: number,
                exportSettings: object,
                embeddedFilesLoader: object,
                theme: undefined,
                padding: number
            ) => Promise<Blob | null>
        >(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));

        Reflect.set(globalThis, 'ExcalidrawAutomate', {
            getAPI: () => ({
                getSceneFromFile: async () => ({ elements: [{ x: 0, y: 0, width: 100, height: 80 }] }),
                copyViewElementsToEAforEditing: async () => {},
                getEmbeddedFilesLoader: () => ({}),
                getExportSettings: () => ({}),
                createPNG: createPng,
                destroy
            })
        });

        try {
            const result = await provider.runProcessFile(excalidrawFile, settings);

            expect(result?.featureImageKey).toBe(`x:${excalidrawFile.path}@${excalidrawFile.stat.mtime}`);
            expect(result?.featureImage).toBeInstanceOf(Blob);
            expect(result?.featureImage?.size).toBeGreaterThan(0);
            expect(result?.featureImage?.type).toBe('image/png');
            expect(createPng).toHaveBeenCalledWith(undefined, expect.any(Number), expect.any(Object), expect.any(Object), undefined, 0);
            expect(createPng.mock.calls[0]?.[1]).toBeLessThanOrEqual(1);
            expect(createPng.mock.calls[0]?.[1]).toBeGreaterThan(0);
            expect(destroy).toHaveBeenCalledTimes(1);
        } finally {
            Reflect.deleteProperty(globalThis, 'ExcalidrawAutomate');
        }
    });

    it('generates Excalidraw feature images when excalidraw-plugin frontmatter is set', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings();
        const excalidrawFile = createFile('drawings/sketch.md');
        excalidrawFile.stat.mtime = 321;

        const content = `---\nexcalidraw-plugin: parsed\n---\n`;
        setMarkdownContent(context, excalidrawFile, content);

        const destroy = vi.fn<() => void>();
        const createPng = vi.fn<
            (
                view: undefined,
                scale: number,
                exportSettings: object,
                embeddedFilesLoader: object,
                theme: undefined,
                padding: number
            ) => Promise<Blob | null>
        >(async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));

        Reflect.set(globalThis, 'ExcalidrawAutomate', {
            getAPI: () => ({
                getSceneFromFile: async () => ({ elements: [{ x: 0, y: 0, width: 100, height: 80 }] }),
                copyViewElementsToEAforEditing: async () => {},
                getEmbeddedFilesLoader: () => ({}),
                getExportSettings: () => ({}),
                createPNG: createPng,
                destroy
            })
        });

        try {
            const result = await provider.runProcessFile(excalidrawFile, settings);

            expect(result?.featureImageKey).toBe(`x:${excalidrawFile.path}@${excalidrawFile.stat.mtime}`);
            expect(result?.featureImage).toBeInstanceOf(Blob);
            expect(result?.featureImage?.size).toBeGreaterThan(0);
            expect(result?.featureImage?.type).toBe('image/png');
            expect(createPng).toHaveBeenCalledWith(undefined, expect.any(Number), expect.any(Object), expect.any(Object), undefined, 0);
            expect(createPng.mock.calls[0]?.[1]).toBeLessThanOrEqual(1);
            expect(createPng.mock.calls[0]?.[1]).toBeGreaterThan(0);
            expect(destroy).toHaveBeenCalledTimes(1);
        } finally {
            Reflect.deleteProperty(globalThis, 'ExcalidrawAutomate');
        }
    });

    it('skips Excalidraw regeneration when featureImageKey matches', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings();
        const excalidrawFile = createFile('drawings/sketch.excalidraw.md');
        excalidrawFile.stat.mtime = 456;
        setMarkdownContent(context, excalidrawFile, '');

        const createPng = vi.fn(async () => new Blob([new Uint8Array([1])], { type: 'image/png' }));

        Reflect.set(globalThis, 'ExcalidrawAutomate', {
            getAPI: () => ({
                getSceneFromFile: async () => ({ elements: [{ x: 0, y: 0, width: 100, height: 80 }] }),
                copyViewElementsToEAforEditing: async () => {},
                getEmbeddedFilesLoader: () => ({}),
                getExportSettings: () => ({}),
                createPNG: createPng,
                destroy: () => {}
            })
        });

        try {
            const fileData: FileData = {
                mtime: excalidrawFile.stat.mtime,
                markdownPipelineMtime: excalidrawFile.stat.mtime,
                tagsMtime: excalidrawFile.stat.mtime,
                metadataMtime: excalidrawFile.stat.mtime,
                fileThumbnailsMtime: excalidrawFile.stat.mtime,
                tags: null,
                wordCount: 0,
                taskTotal: 0,
                taskUnfinished: 0,
                properties: null,
                previewStatus: 'unprocessed',
                featureImage: null,
                featureImageStatus: 'has',
                featureImageKey: `x:${excalidrawFile.path}@${excalidrawFile.stat.mtime}`,
                metadata: null
            };

            const result = await provider.runProcessFileWithData(excalidrawFile, fileData, settings);
            expect(result).toBeNull();
            expect(createPng).not.toHaveBeenCalled();
        } finally {
            Reflect.deleteProperty(globalThis, 'ExcalidrawAutomate');
        }
    });

    it('destroys ExcalidrawAutomate API when getSceneFromFile throws', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings();
        const excalidrawFile = createFile('drawings/broken.excalidraw.md');
        excalidrawFile.stat.mtime = 777;
        setMarkdownContent(context, excalidrawFile, '');

        const destroy = vi.fn<() => void>();

        Reflect.set(globalThis, 'ExcalidrawAutomate', {
            getAPI: () => ({
                getSceneFromFile: async () => {
                    throw new Error('boom');
                },
                copyViewElementsToEAforEditing: async () => {},
                getEmbeddedFilesLoader: () => ({}),
                getExportSettings: () => ({}),
                createPNG: async () => null,
                destroy
            })
        });

        try {
            const result = await provider.runProcessFile(excalidrawFile, settings);

            expect(result?.featureImageKey).toBe(`x:${excalidrawFile.path}@${excalidrawFile.stat.mtime}`);
            expect(result?.featureImage).toBeInstanceOf(Blob);
            expect(result?.featureImage?.size).toBe(0);
            expect(destroy).toHaveBeenCalledTimes(1);
        } finally {
            Reflect.deleteProperty(globalThis, 'ExcalidrawAutomate');
        }
    });

    it('falls back to copyViewElementsToEAforEditing without embedded files', async () => {
        const context = createApp();
        const { app } = context;
        const excalidrawFile = createFile('drawings/embedded.excalidraw.md');
        excalidrawFile.stat.mtime = 888;
        setMarkdownContent(context, excalidrawFile, '');

        Reflect.set(app as object, 'workspace', {
            iterateAllLeaves: (cb: (leaf: object) => void) => {
                cb({ view: { file: { path: excalidrawFile.path } } });
            }
        });

        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings();

        const destroy = vi.fn<() => void>();
        const copyViewElementsToEAforEditing = vi.fn<(_elements: object[], includeFiles: boolean) => Promise<void>>(
            async (_elements, includeFiles) => {
                if (includeFiles) {
                    throw new Error('includeFiles unsupported');
                }
            }
        );
        const setView = vi.fn<(_view: object) => void>();

        Reflect.set(globalThis, 'ExcalidrawAutomate', {
            getAPI: () => ({
                setView,
                getSceneFromFile: async () => ({ elements: [{ x: 0, y: 0, width: 100, height: 80 }] }),
                copyViewElementsToEAforEditing,
                getEmbeddedFilesLoader: () => ({}),
                getExportSettings: () => ({}),
                createPNG: async () => new Blob([new Uint8Array([9])], { type: 'image/png' }),
                destroy
            })
        });

        try {
            const result = await provider.runProcessFile(excalidrawFile, settings);

            expect(result?.featureImageKey).toBe(`x:${excalidrawFile.path}@${excalidrawFile.stat.mtime}`);
            expect(result?.featureImage?.size).toBeGreaterThan(0);
            expect(copyViewElementsToEAforEditing).toHaveBeenCalledTimes(2);
            expect(copyViewElementsToEAforEditing).toHaveBeenNthCalledWith(1, expect.any(Array), true);
            expect(copyViewElementsToEAforEditing).toHaveBeenNthCalledWith(2, expect.any(Array), false);
            expect(setView).toHaveBeenCalledTimes(1);
            expect(destroy).toHaveBeenCalledTimes(1);
        } finally {
            Reflect.deleteProperty(globalThis, 'ExcalidrawAutomate');
        }
    });

    it('destroys ExcalidrawAutomate API when createPNG throws', async () => {
        const context = createApp();
        const { app } = context;
        const provider = new TestFeatureImageContentProvider(app);
        const settings = createSettings();
        const excalidrawFile = createFile('drawings/throw.excalidraw.md');
        excalidrawFile.stat.mtime = 999;
        setMarkdownContent(context, excalidrawFile, '');

        const destroy = vi.fn<() => void>();

        Reflect.set(globalThis, 'ExcalidrawAutomate', {
            getAPI: () => ({
                getSceneFromFile: async () => ({ elements: [{ x: 0, y: 0, width: 100, height: 80 }] }),
                copyViewElementsToEAforEditing: async () => {},
                getEmbeddedFilesLoader: () => ({}),
                getExportSettings: () => ({}),
                createPNG: async () => {
                    throw new Error('png failed');
                },
                destroy
            })
        });

        try {
            const result = await provider.runProcessFile(excalidrawFile, settings);

            expect(result?.featureImageKey).toBe(`x:${excalidrawFile.path}@${excalidrawFile.stat.mtime}`);
            expect(result?.featureImage).toBeInstanceOf(Blob);
            expect(result?.featureImage?.size).toBe(0);
            expect(destroy).toHaveBeenCalledTimes(1);
        } finally {
            Reflect.deleteProperty(globalThis, 'ExcalidrawAutomate');
        }
    });
});
