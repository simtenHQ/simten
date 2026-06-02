import { Link } from '@tanstack/react-router'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'

/**
 * Edge-aligned site header used on every page.
 *
 * Brand mark + "Simten" wordmark always at the top-left edge, linking home.
 * Theme toggle always at the far right (every page has it). The `right` slot
 * sits between them and is page-determined: nav links on content pages, tool
 * controls on /editor and /cpu/rv32i.
 *
 * `brandHref` makes the brand a plain external `<a>` instead of a router
 * `<Link>` — used by the standalone local MCP viewer, which has no router.
 */
export function SiteHeader({
  right,
  sticky = true,
  brandHref,
}: {
  right?: React.ReactNode
  sticky?: boolean
  brandHref?: string
}) {
  const brandClassName =
    'flex items-center gap-2 text-foreground transition-colors hover:text-foreground/80'
  const brand = (
    <>
      <Logo size={26} />
      <span className="text-lg font-semibold tracking-tight">Simten</span>
    </>
  )
  return (
    <header
      className={`${sticky ? 'sticky top-0 z-40' : ''} flex h-14 w-full shrink-0 items-center justify-between gap-3 bg-background/90 px-4 backdrop-blur`}
    >
      {brandHref ? (
        <a href={brandHref} className={brandClassName} aria-label="Simten — home">
          {brand}
        </a>
      ) : (
        <Link to="/" className={brandClassName} aria-label="Simten — home">
          {brand}
        </Link>
      )}
      <div className="flex flex-1 items-center justify-end gap-3">
        {right}
        <ThemeToggle />
      </div>
    </header>
  )
}
