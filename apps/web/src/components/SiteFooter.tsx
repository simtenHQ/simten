import { Link } from '@tanstack/react-router'
import { Logo } from '@/components/Logo'

/**
 * Edge-aligned site footer used on every content page.
 *
 * Mirrors SiteHeader's left/right structure: brand mark on the left,
 * nav links on the right, with a small © line below. Tool routes
 * (/editor, /cpu/rv32i) suppress this just like they suppress the
 * default SiteHeader.
 */
export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-32 border-t border-border bg-background/50">
      <div className="flex h-12 w-full items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Simten — home"
        >
          <Logo size={16} />
          <span className="text-[12px] font-medium tracking-tight">Simten</span>
        </Link>
        <nav className="flex items-center gap-5 text-[12px] text-muted-foreground">
          <Link to="/blog" className="transition-colors hover:text-foreground">
            Blog
          </Link>
          <Link to="/learn" className="transition-colors hover:text-foreground">
            Learn
          </Link>
          <a href="/docs" className="transition-colors hover:text-foreground">
            Docs
          </a>
          <a
            href="https://github.com/simtenHQ/simten"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
      <div className="px-4 pb-6 pt-1 text-[11px] text-muted-foreground/60">
        © {year} Simten
      </div>
    </footer>
  )
}
