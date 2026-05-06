import { Link } from '@tanstack/react-router'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'

/**
 * Edge-aligned site header used on every page.
 *
 * Brand mark + "Simten" wordmark always at the top-left edge, linking home.
 * Theme toggle always at the far right (every page has it). The `right` slot
 * sits between them and is page-determined: nav links on content pages, tool
 * controls on /editor and /learn/rv32i-cpu.
 */
export function SiteHeader({ right, sticky = true }: { right?: React.ReactNode; sticky?: boolean }) {
  return (
    <header
      className={`${sticky ? 'sticky top-0 z-40' : ''} flex h-12 w-full shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur`}
    >
      <Link
        to="/"
        className="flex items-center gap-2 text-foreground transition-colors hover:text-foreground/80"
        aria-label="Simten — home"
      >
        <Logo size={26} />
        <span className="text-lg font-semibold tracking-tight">Simten</span>
      </Link>
      <div className="flex flex-1 items-center justify-end gap-3">
        {right}
        <ThemeToggle />
      </div>
    </header>
  )
}
