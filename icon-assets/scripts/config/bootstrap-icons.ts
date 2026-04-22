import { IconPackConfig, checkGitHubVersion } from '../shared';

export const bootstrapIcons: IconPackConfig = {
    id: 'bootstrap-icons',
    name: 'Bootstrap Icons',
    version: '1.13.1',
    githubRepo: 'twbs/icons',

    files: {
        font: 'bootstrap-icons.woff2',
        metadata: 'bootstrap-icons.json',
        mimeType: 'font/woff2'
    },

    urls: (version: string) => ({
        font: `https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/${version}/font/fonts/bootstrap-icons.woff2`,
        metadata: `https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/${version}/font/bootstrap-icons.json`,
        css: `https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/${version}/font/bootstrap-icons.min.css`
    }),

    checkVersion: async () => checkGitHubVersion('twbs/icons')
};
