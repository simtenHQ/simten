import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Standard nav rendered on the right of SiteHeader for content pages.
 *
 * Desktop (sm+): inline links — Blog | Learn | Docs | [GitHub icon].
 * Mobile (< sm): a hamburger button that opens a dropdown panel with the same
 * links, so they don't get squished against the ThemeToggle on narrow screens.
 *
 * The panel is portalled to <body>: SiteHeader uses `backdrop-blur`, which
 * makes the header a containing block for `position: fixed`, so a fixed overlay
 * rendered inside it would be clipped to the header box. The portal escapes that.
 */

const GitHubMark = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const mobileItem =
  'flex items-center justify-between rounded-md px-2 py-2.5 text-base text-foreground/80 transition-colors hover:bg-muted hover:text-foreground';

export function SiteNavLinks() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // While open: close on Escape and lock background scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      {/* Desktop inline links. sm:mr-3 + the header's gap-3 = 24px to the
          ThemeToggle, matching the gap-6 rhythm between the links themselves
          (so the GitHub icon doesn't look stuck to the toggle). */}
      <nav className="hidden items-center gap-6 text-[15px] text-foreground/70 sm:mr-3 sm:flex">
        {/* Own subdomain, so a plain anchor rather than a router Link. Same tab:
            it is the same product, not somewhere you send people away to. */}
        <a href="https://play.simten.dev" className="transition-colors hover:text-foreground">
          Play
        </a>
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
          aria-label="GitHub"
          className="transition-colors hover:text-foreground"
        >
          <GitHubMark />
        </a>
      </nav>

      {/* Mobile hamburger. order-last pushes it past the ThemeToggle (rendered
          after {right} in SiteHeader) so it sits on the far-right edge — the
          conventional, thumb-reachable spot. Hidden on desktop, so order is moot
          there. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        className="order-last inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/70 transition-colors hover:text-foreground sm:hidden"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Mobile dropdown — portalled to body, sits just below the h-14 header */}
      {mounted &&
        open &&
        createPortal(
          <div className="sm:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              className="fixed inset-x-0 bottom-0 top-14 z-40 bg-background/60 backdrop-blur-sm"
            />
            <nav className="fixed inset-x-0 top-14 z-50 flex flex-col gap-1 border-b border-border bg-background px-4 pb-4 pt-2">
              <a href="https://play.simten.dev" onClick={close} className={mobileItem}>
                Play
              </a>
              <Link to="/blog" onClick={close} className={mobileItem}>
                Blog
              </Link>
              <Link to="/learn" onClick={close} className={mobileItem}>
                Learn
              </Link>
              <a href="/docs" onClick={close} className={mobileItem}>
                Docs
              </a>
              <a
                href="https://github.com/simtenHQ/simten"
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className={mobileItem}
              >
                <span className="inline-flex items-center gap-2">
                  <GitHubMark />
                  GitHub
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground/60" aria-hidden="true" />
              </a>
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
}
