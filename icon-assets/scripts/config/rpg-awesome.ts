import { IconPackConfig, ProcessContext } from '../shared';

export const rpgAwesome: IconPackConfig = {
    id: 'rpg-awesome',
    name: 'RPG Awesome',
    version: '0.2.0',

    files: {
        font: 'rpgawesome-webfont.woff',
        metadata: 'icons.json',
        mimeType: 'font/woff'
    },

    urls: (_version: string) => ({
        // RPG-Awesome is stuck at 0.2.0 on cdnjs despite newer GitHub releases
        font: `https://cdnjs.cloudflare.com/ajax/libs/rpg-awesome/0.2.0/fonts/rpgawesome-webfont.woff`,
        css: `https://cdnjs.cloudflare.com/ajax/libs/rpg-awesome/0.2.0/css/rpg-awesome.min.css`
    }),

    checkVersion: async () => '0.2.0', // Fixed version for now

    processMetadata: async (context: ProcessContext): Promise<string> => {
        const cssUrl = context.urls.css;
        if (!cssUrl) throw new Error('CSS URL not provided');

        console.log(`[rpg-awesome] Downloading CSS metadata from ${cssUrl}`);
        const css = await context.downloadText(cssUrl);

        const entries: Array<{
            id: string;
            name: string;
            unicode: string;
            keywords: string[];
            categories: string[];
        }> = [];

        // Pattern to match both escaped sequences and direct Unicode characters
        const idPattern = /\.ra-([a-z0-9-]+)::?before\s*\{\s*content:\s*["'](.+?)["'];?\s*}/g;
        const seen = new Set<string>();

        let match: RegExpExecArray | null;
        while ((match = idPattern.exec(css)) !== null) {
            const slug = match[1];
            const contentValue = match[2];
            const id = `ra-${slug}`;

            if (seen.has(id)) {
                continue;
            }

            seen.add(id);

            // Handle both escaped sequences and direct Unicode characters
            let unicode: string;
            if (contentValue.startsWith('\\')) {
                // Handle escape sequences like \e900
                const hexMatch = contentValue.match(/\\([0-9a-fA-F]+)/);
                if (hexMatch) {
                    unicode = hexMatch[1].toLowerCase();
                } else {
                    continue;
                }
            } else if (contentValue.length === 1) {
                // Direct Unicode character - convert to hex
                unicode = contentValue.charCodeAt(0).toString(16).toLowerCase();
            } else {
                continue;
            }

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
            throw new Error(`[rpg-awesome] No icons parsed from CSS stylesheet ${cssUrl}`);
        }

        return JSON.stringify(entries, null, 2);
    }
};
