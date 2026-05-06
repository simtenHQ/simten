import type { ReactNode } from 'react'

/**
 * Renders `children` on desktop (md and up) and `fallback` on smaller viewports.
 *
 * CSS-gated, not JS-gated: both branches are present in the SSR markup; the
 * browser picks which to display via Tailwind's `md:` breakpoint. No hydration
 * flicker, works without JS.
 */
export function DesktopOnly({
  children,
  fallback,
}: {
  children: ReactNode
  fallback: ReactNode
}) {
  return (
    <>
      <div className="hidden md:contents">{children}</div>
      <div className="contents md:hidden">{fallback}</div>
    </>
  )
}
