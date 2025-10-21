import { IconPackConfig, ProcessContext, checkGitHubVersion, sortObject, titleCaseFromSlug } from '../shared';

export const fontAwesome: IconPackConfig = {
    id: 'fontawesome',
    name: 'FontAwesome',
    version: '7.1.0',
    githubRepo: 'FortAwesome/Font-Awesome',

    files: {
        font: 'fa-solid-900.woff2',
        metadata: 'icons-solid.json',
        mimeType: 'font/woff2'
    },

    urls: (version: string) => {
        // FontAwesome 7.x and later only
        const major = parseInt(version.split('.')[0]);
        const branch = `${major}.x`;

        return {
            font: `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@${version}/webfonts/fa-solid-900.woff2`,
            metadata: `https://raw.githubusercontent.com/FortAwesome/Font-Awesome/${branch}/metadata/icons.json`,
            css: `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@${version}/css/all.min.css`
        };
    },

    checkVersion: async () => checkGitHubVersion('FortAwesome/Font-Awesome'),

    processMetadata: async (context: ProcessContext): Promise<string> => {
        const metadataUrl = context.urls.metadata;
        if (!metadataUrl) throw new Error('Metadata URL not provided');

        console.log(`[fontawesome] Downloading metadata from ${metadataUrl}`);
        const raw = await context.downloadText(metadataUrl);

        const parsed = JSON.parse(raw) as Record<
            string,
            {
                unicode?: string;
                label?: string;
                styles?: string[];
                search?: { terms?: string[] };
                aliases?: {
                    names?: string[];
                    unicodes?: { secondary?: string[] };
                };
            }
        >;

        const filtered: Record<string, { unicode: string; label: string; search: string[] }> = {};

        Object.entries(parsed).forEach(([key, value]) => {
            if (!value || !value.unicode) {
                return;
            }

            if (!value.styles || !value.styles.includes('solid')) {
                return;
            }

            const terms = new Set<string>();
            terms.add(key);

            if (value.label) {
                terms.add(value.label);
            }

            value.search?.terms?.forEach(term => terms.add(term));
            value.aliases?.names?.forEach(alias => terms.add(alias));
            value.aliases?.unicodes?.secondary?.forEach(aliasUnicode => terms.add(aliasUnicode));

            filtered[key] = {
                unicode: value.unicode,
                label: value.label ?? titleCaseFromSlug(key),
                search: Array.from(terms)
            };
        });

        return JSON.stringify(sortObject(filtered), null, 2);
    }
};
