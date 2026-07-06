import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { Container } from '@/components/Container';
import { Logo } from '@/components/Logo';

/**
 * Multi-column site footer used on every content page.
 *
 * Layout is the standard marketing footer: brand mark on the left, then four
 * link columns. Responsive collapse — 4 columns on desktop (lg), 2 on tablet
 * (sm), 1 stacked on mobile — with the brand stacking above the columns below
 * lg. A divider + © / legal row sits at the bottom. Tool routes (/circuit,
 * /cpu/rv32i) suppress this just like they suppress the default SiteHeader.
 */

const headingClass = 'text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground/70';
const linkClass =
  'text-base text-muted-foreground transition-colors hover:text-foreground sm:text-[15px]';

function Col({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className={headingClass}>{heading}</h3>
      <ul className="mt-5 space-y-3.5">{children}</ul>
    </div>
  );
}

/** External link with the trailing ↗ affordance. */
function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`group inline-flex items-center gap-1 ${linkClass}`}
      >
        {children}
        <ArrowUpRight
          className="size-3.5 text-muted-foreground/50 transition-colors group-hover:text-foreground"
          aria-hidden="true"
        />
      </a>
    </li>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-32 border-t border-border bg-background">
      <Container className="py-16">
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
          {/* Brand */}
          <div className="lg:w-60 lg:shrink-0">
            <Link
              to="/"
              aria-label="Simten — home"
              className="inline-flex items-center gap-2.5 text-foreground transition-colors hover:text-foreground/80"
            >
              <Logo size={28} />
              <span className="text-2xl font-semibold tracking-tight">Simten</span>
            </Link>
          </div>

          {/* Columns: 1 → 2 (sm) → 4 (lg) */}
          <div className="grid flex-1 grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            <Col heading="Platform">
              <li>
                <Link to="/circuit" className={linkClass}>
                  Circuit Editor
                </Link>
              </li>
              <li>
                <Link to="/cpu" className={linkClass}>
                  CPU Debuggers
                </Link>
              </li>
              <li>
                <Link to="/cpu/rv32i" className={linkClass}>
                  RV32I CPU
                </Link>
              </li>
              <li>
                <a href="/docs" className={linkClass}>
                  Documentation
                </a>
              </li>
            </Col>

            <Col heading="Learn">
              <li>
                <Link to="/learn" className={linkClass}>
                  Overview
                </Link>
              </li>
              <li>
                <Link to="/learn/adders" className={linkClass}>
                  Building Adders
                </Link>
              </li>
              <li>
                <Link to="/learn/abstraction" className={linkClass}>
                  Abstraction
                </Link>
              </li>
              <li>
                <Link to="/learn/registers" className={linkClass}>
                  Registers
                </Link>
              </li>
            </Col>

            <Col heading="Resources">
              <li>
                <Link to="/blog" className={linkClass}>
                  Blog
                </Link>
              </li>
              <li>
                <a href="/docs" className={linkClass}>
                  Docs
                </a>
              </li>
              <ExtLink href="https://github.com/simtenHQ/simten">GitHub</ExtLink>
              <ExtLink href="https://simten.dev">Live Demo</ExtLink>
            </Col>

            <Col heading="Packages">
              <ExtLink href="https://www.npmjs.com/package/@simten/core">@simten/core</ExtLink>
              <ExtLink href="https://www.npmjs.com/package/@simten/mcp">@simten/mcp</ExtLink>
              <ExtLink href="https://www.npmjs.com/package/@simten/embed">@simten/embed</ExtLink>
              <ExtLink href="https://www.npmjs.com/package/@simten/ui">@simten/ui</ExtLink>
            </Col>
          </div>
        </div>

        {/* Bottom: © / legal */}
        <div className="mt-16 flex flex-col gap-4 border-t border-border pt-8 text-[13px] text-muted-foreground/70 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} Simten · Open source, licensed under{' '}
            <a
              href="https://github.com/simtenHQ/simten/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              Apache-2.0
            </a>
          </p>
          <nav className="flex items-center gap-6">
            <Link to="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link to="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
          </nav>
        </div>
      </Container>
    </footer>
  );
}
