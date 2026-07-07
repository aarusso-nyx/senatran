import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/**
 * Docusaurus configuration for the SENATRAN mock documentation site.
 *
 * The docs live under `docs/` at the repo root (one level up from this site
 * directory), so `docs/start/` is the content root. This site is the DEVAI
 * docs-governance publishing substrate; it is optional to build locally.
 */
const config: Config = {
  title: 'SENATRAN Mock',
  tagline: 'Dev-only mock of the SERPRO WSDenatran public API',
  favicon: 'img/favicon.ico',
  url: 'https://aarusso-nyx.github.io',
  baseUrl: '/senatran/',
  organizationName: 'aarusso-nyx',
  projectName: 'senatran',
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'pt-BR', locales: ['pt-BR'] },
  presets: [
    [
      'classic',
      {
        docs: { path: '../start', routeBasePath: '/', sidebarPath: './sidebars.ts' },
        blog: false,
        theme: {},
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    navbar: { title: 'SENATRAN Mock', items: [] },
  } satisfies Preset.ThemeConfig,
};

export default config;
