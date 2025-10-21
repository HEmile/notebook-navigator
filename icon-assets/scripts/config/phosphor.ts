import { IconPackConfig, ProcessContext, checkGitHubVersion } from '../shared';

export const phosphor: IconPackConfig = {
    id: 'phosphor',
    name: 'Phosphor Icons',
    version: '2.1.2',
    githubRepo: 'phosphor-icons/web',

    files: {
        font: 'phosphor-regular.woff2',
        metadata: 'icons.json',
        mimeType: 'font/woff2'
    },

    urls: (version: string) => ({
        font: `https://cdn.jsdelivr.net/npm/@phosphor-icons/web@${version}/src/regular/Phosphor.woff2`,
        css: `https://unpkg.com/@phosphor-icons/web@${version}/src/regular/style.css`
    }),

    checkVersion: async () => checkGitHubVersion('phosphor-icons/web'),

    processMetadata: async (context: ProcessContext): Promise<string> => {
        const cssUrl = context.urls.css;
        if (!cssUrl) throw new Error('CSS URL not provided');

        console.log(`[phosphor] Downloading CSS metadata from ${cssUrl}`);
        const css = await context.downloadText(cssUrl);

        const entries: Array<{
            id: string;
            name: string;
            unicode: string;
            keywords: string[];
            categories: string[];
        }> = [];

        const idPattern = /\.ph-([a-z0-9-]+)::?before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)";?\s*}/g;
        const seen = new Set<string>();

        let match: RegExpExecArray | null;
        while ((match = idPattern.exec(css)) !== null) {
            const slug = match[1];
            const unicode = match[2].toLowerCase();
            const id = `ph-${slug}`;

            if (seen.has(id)) {
                continue;
            }

            seen.add(id);

            const tokens = slug.split('-').filter(Boolean);
            const displayName = tokens.map(token => token.charAt(0).toUpperCase() + token.slice(1)).join(' ');
            const keywords = new Set<string>();
            keywords.add(id);
            tokens.forEach(token => keywords.add(token));
            keywords.add(displayName.toLowerCase());

            entries.push({
                id,
                name: displayName,
                unicode,
                keywords: Array.from(keywords),
                categories: []
            });
        }

        entries.sort((a, b) => a.id.localeCompare(b.id));

        if (entries.length === 0) {
            throw new Error(`[phosphor] No icons parsed from CSS stylesheet ${cssUrl}`);
        }

        return JSON.stringify(entries, null, 2);
    }
};
