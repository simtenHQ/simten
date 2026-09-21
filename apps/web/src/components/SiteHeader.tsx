import { Link } from '@tanstack/react-router';
import { Container } from '@/components/Container';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * Site header used on every page.
 *
 * Brand mark + "Simten" wordmark at the top-left, linking home. Theme toggle
 * always at the far right (every page has it). The `right` slot sits between
 * them and is page-determined: nav links on content pages, tool controls on
 * /editor and /cpu/rv32i.
 *
 * `contained` lines the row up with <Container> content instead of the
 * viewport edges, so the brand sits directly above the page heading. Content
 * pages pass it; tool pages do not, because an editor filling the viewport
 * looks wrong with an inset toolbar above it.
 *
 * `brandHref` makes the brand a plain external `<a>` instead of a router
 * `<Link>`, used by the standalone local MCP viewer, which has no router.
 */
export function SiteHeader({
  right,
  sticky = true,
  brandHref,
  contained = false,
}: {
  right?: React.ReactNode;
  sticky?: boolean;
  brandHref?: string;
  contained?: boolean;
}) {
  const brandClassName =
    'flex items-center gap-2 text-foreground transition-colors hover:text-foreground/80';
  const brand = (
    <>
      <Logo size={26} />
      <span className="text-lg font-semibold tracking-tight">Simten</span>
    </>
  );
  const row = (
    <>
      {brandHref ? (
        <a href={brandHref} className={brandClassName} aria-label="Simten home">
          {brand}
        </a>
      ) : (
        <Link to="/" className={brandClassName} aria-label="Simten home">
          {brand}
        </Link>
      )}
      <div className="flex flex-1 items-center justify-end gap-3">
        {right}
        <ThemeToggle />
      </div>
    </>
  );

  return (
    <header
      className={`${sticky ? 'sticky top-0 z-40' : ''} h-14 w-full shrink-0 bg-background/90 backdrop-blur ${
        contained ? '' : 'flex items-center justify-between gap-3 px-4'
      }`}
    >
      {contained ? (
        <Container className="flex h-full items-center justify-between gap-3">{row}</Container>
      ) : (
        row
      )}
    </header>
  );
}
