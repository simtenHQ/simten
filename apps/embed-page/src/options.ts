/** What an embed page URL asks for: `/s/<id>?theme=light|dark|auto&controls=0|1`. */

type ThemeOption = 'light' | 'dark' | 'auto';

interface EmbedRequest {
  /** The share id, or null when the path isn't `/s/<id>`. */
  id: string | null;
  theme: ThemeOption;
  controls: boolean;
}

const SHARE_PATH = /^\/s\/([^/]+)\/?$/;
const THEMES: readonly string[] = ['light', 'dark', 'auto'];

export function parseEmbedRequest(url: URL): EmbedRequest {
  const theme = url.searchParams.get('theme') ?? 'auto';
  return {
    id: url.pathname.match(SHARE_PATH)?.[1] ?? null,
    theme: THEMES.includes(theme) ? (theme as ThemeOption) : 'auto',
    controls: url.searchParams.get('controls') !== '0',
  };
}

/** `auto` follows the viewer's system setting. */
export function resolveTheme(theme: ThemeOption, prefersDark: boolean): 'light' | 'dark' {
  if (theme === 'auto') return prefersDark ? 'dark' : 'light';
  return theme;
}
