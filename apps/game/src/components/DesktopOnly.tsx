import type { ReactNode } from 'react';

/**
 * Renders `children` on desktop (md and up) and `fallback` on smaller viewports.
 *
 * CSS-gated, not JS-gated: both branches are present in the SSR markup and the
 * browser picks which to display via Tailwind's `md:` breakpoint. No hydration
 * flicker, and it works before JS arrives — which matters here, because the
 * thing being gated is a code editor that will not load on the device anyway.
 *
 * Deliberately a copy of the web app's component rather than a shared one. It
 * is eight lines, the two apps deploy separately, and a `@simten/ui` export
 * would put a layout primitive in a package whose job is circuit UI.
 */
export function DesktopOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return (
    <>
      <div className="hidden md:contents">{children}</div>
      <div className="contents md:hidden">{fallback}</div>
    </>
  );
}
