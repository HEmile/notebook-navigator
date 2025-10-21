import { IconPackConfig, ProcessContext, checkMaterialIconsVersion, sortObject } from '../shared';

export const materialIcons: IconPackConfig = {
    id: 'material-icons',
    name: 'Google Material Icons',
    version: '145',

    files: {
        font: 'MaterialIcons-Regular.woff2',
        metadata: 'icons.json',
        mimeType: 'font/woff2'
    },

    urls: (version: string) => ({
        font: `https://fonts.gstatic.com/s/materialicons/v${version}/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2`,
        metadata: `https://raw.githubusercontent.com/google/material-design-icons/master/font/MaterialIcons-Regular.codepoints`,
        css: `https://fonts.googleapis.com/icon?family=Material+Icons`
    }),

    checkVersion: checkMaterialIconsVersion,

    processMetadata: async (context: ProcessContext): Promise<string> => {
        const metadataUrl = context.urls.metadata;
        if (!metadataUrl) throw new Error('Metadata URL not provided');

        console.log(`[material-icons] Downloading metadata from ${metadataUrl}`);
        const raw = await context.downloadText(metadataUrl);

        const entries = raw
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);

        const result: Record<string, { unicode: string; label: string; search: string[] }> = {};

        entries.forEach(line => {
            const [name, unicode] = line.split(/\s+/);

            if (!name || !unicode) {
                return;
            }

            result[name] = {
                unicode: unicode.toLowerCase(),
                label: name,
                search: [name]
            };
        });

        return JSON.stringify(sortObject(result), null, 2);
    }
};
