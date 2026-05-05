import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

/**
 * Fumadocs layout config used by /docs/*.
 *
 * The site-wide SiteHeader (rendered in __root.tsx) sits above DocsLayout, so
 * we disable fumadocs's own nav. We tell fumadocs the height of our header
 * via `--fd-nav-height: 48px` in styles.css so its sidebar/content offset
 * correctly underneath.
 */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: { enabled: false },
    links: [],
    themeSwitch: { enabled: false },
  };
}
