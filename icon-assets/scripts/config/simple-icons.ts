import { IconPackConfig, ProcessContext, checkGitHubVersion, sortObject } from '../shared';

export const simpleIcons: IconPackConfig = {
    id: 'simple-icons',
    name: 'Simple Icons',
    version: '15.17.0',
    githubRepo: 'simple-icons/simple-icons',

    files: {
        font: 'SimpleIcons.woff2',
        metadata: 'simple-icons.json',
        mimeType: 'font/woff2'
    },

    urls: (version: string) => ({
        font: `https://cdn.jsdelivr.net/npm/simple-icons-font@${version}/font/SimpleIcons.woff2`,
        metadata: `https://cdn.jsdelivr.net/npm/simple-icons-font@${version}/font/simple-icons.json`,
        css: `https://cdn.jsdelivr.net/npm/simple-icons-font@${version}/font/simple-icons.min.css`
    }),

    checkVersion: async () => checkGitHubVersion('simple-icons/simple-icons'),

    processMetadata: async (context: ProcessContext): Promise<string> => {
        const cssUrl = context.urls.css;
        const metadataUrl = context.urls.metadata;

        if (!cssUrl || !metadataUrl) {
            throw new Error('CSS and metadata URLs required');
        }

        console.log(`[simple-icons] Downloading CSS mapping from ${cssUrl}`);
        const css = await context.downloadText(cssUrl);
        console.log(`[simple-icons] Downloading metadata from ${metadataUrl}`);
        const metadataRaw = await context.downloadText(metadataUrl);

        const glyphMap = new Map<string, string>();
        const cssPattern = /\.si-([a-z0-9-]+)::?before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)";?\s*}/g;
        let cssMatch: RegExpExecArray | null;

        while ((cssMatch = cssPattern.exec(css)) !== null) {
            const slug = cssMatch[1];
            const unicode = cssMatch[2].toLowerCase();
            glyphMap.set(slug, unicode);
        }

        const parsed = JSON.parse(metadataRaw) as Array<{
            title: string;
            slug: string;
            aliases?: { aka?: string[]; dup?: string[] };
        }>;

        const result: Record<string, { unicode: string; label: string; search: string[] }> = {};

        parsed.forEach(entry => {
            if (!entry || !entry.slug) {
                return;
            }

            const unicode = glyphMap.get(entry.slug);

            if (!unicode) {
                return;
            }

            const searchTerms = new Set<string>();
            searchTerms.add(entry.slug);
            searchTerms.add(entry.title);
            entry.aliases?.aka?.forEach(alias => searchTerms.add(alias));
            entry.aliases?.dup?.forEach(alias => searchTerms.add(alias));

            result[entry.slug] = {
                unicode,
                label: entry.title,
                search: Array.from(searchTerms)
            };
        });

        if (Object.keys(result).length === 0) {
            throw new Error(`[simple-icons] No icons matched between CSS and metadata sources`);
        }

        return JSON.stringify(sortObject(result), null, 2);
    }
};
