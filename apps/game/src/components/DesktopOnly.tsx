import { type ReactNode, useSyncExternalStore } from 'react';

/** Tailwind's `md`, the breakpoint `DesktopOnly` switches on. */
const DESKTOP_QUERY = '(min-width: 768px)';

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(DESKTOP_QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

/**
 * Whether this viewport is desktop, false until the client has measured.
 *
 * `DesktopOnly` hides the desktop branch but still mounts it, so a phone boots
 * Monaco and the sandbox iframe for an editor it will never show. Wasteful on
 * its own, and worse than wasteful when something in there throws: the whole
 * route is replaced by the router's error boundary, which is what Google
 * indexed for `/first-wire` instead of the level.
 *
 * Gate the expensive child on this and a phone never mounts it. It pairs with
 * `DesktopOnly` rather than replacing it: the CSS keeps deciding what is
 * *visible*, so desktop never flashes the mobile notice during hydration,
 * while this decides what is mounted at all.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/**
 * Renders `children` on desktop (md and up) and `fallback` on smaller viewports.
 *
 * CSS-gated, not JS-gated: both branches are present in the SSR markup and the
 * browser picks which to display via Tailwind's `md:` breakpoint. No hydration
 * flicker, and it works before JS arrives, which matters here, because the
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
