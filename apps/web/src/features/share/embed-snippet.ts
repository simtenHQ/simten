/**
 * The `<iframe>` snippet the Share dialog's Embed tab copies, and the embed
 * page URL inside it. The page itself is `apps/embed-page`.
 */

/**
 * Where embed pages are served. `VITE_EMBED_ORIGIN` points the editor at
 * another one, e.g. a local build under test.
 */
const env = import.meta.env as { VITE_EMBED_ORIGIN?: string; DEV?: boolean };
const EMBED_ORIGIN: string =
  env.VITE_EMBED_ORIGIN || (env.DEV ? 'http://localhost:3004' : 'https://embed.simten.dev');

export type EmbedTheme = 'auto' | 'light' | 'dark';

/** The sizes offered: a CSS aspect ratio, or a fixed height in pixels. */
export const EMBED_SIZES = {
  '4:3': { aspectRatio: '4/3' },
  '16:9': { aspectRatio: '16/9' },
  '1:1': { aspectRatio: '1/1' },
  '400px tall': { height: 400 },
  '600px tall': { height: 600 },
} as const satisfies Record<string, { aspectRatio: string } | { height: number }>;

export type EmbedSize = keyof typeof EMBED_SIZES;

interface EmbedOptions {
  hash: string;
  theme: EmbedTheme;
  controls: boolean;
  size: EmbedSize;
  /** The circuit's name, for the iframe's accessible title. */
  name: string | null;
  origin?: string;
}

/** The embed page URL. Defaults are left out, except `theme`, kept so the option is visible. */
export function embedUrl({
  hash,
  theme,
  controls,
  origin = EMBED_ORIGIN,
}: Pick<EmbedOptions, 'hash' | 'theme' | 'controls' | 'origin'>): string {
  const params = new URLSearchParams({ theme });
  if (!controls) params.set('controls', '0');
  return `${origin}/s/${hash}?${params}`;
}

/** The inline style that sizes the iframe. */
export function embedStyle(size: EmbedSize): string {
  const spec: { aspectRatio: string } | { height: number } = EMBED_SIZES[size];
  const sizing =
    'aspectRatio' in spec ? `aspect-ratio:${spec.aspectRatio}` : `height:${spec.height}px`;
  return `width:100%; ${sizing}; border:0`;
}

/** The snippet to paste into a page. */
export function embedSnippet(options: EmbedOptions): string {
  const title = options.name ? `${options.name} (Simten)` : 'Simten circuit';
  return [
    `<iframe src="${escapeAttribute(embedUrl(options))}"`,
    `        style="${embedStyle(options.size)}"`,
    `        title="${escapeAttribute(title)}" loading="lazy"></iframe>`,
  ].join('\n');
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
