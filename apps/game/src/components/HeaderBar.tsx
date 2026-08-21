/**
 * The bar across the top of every page in the game.
 *
 * Owns two things the map and a level kept getting slightly wrong between
 * them: the bar's height, and the brand at its left edge.
 *
 * Height is fixed here rather than left to padding and whatever is inside. Both
 * pages had identical padding and still came out two pixels apart, because a
 * header sizes itself to its tallest child and one of them holds buttons while
 * the other holds text. Navigating between them nudged the whole page.
 *
 * The brand is rendered here for the same reason. It was written out twice, and
 * the two copies drifted: a 22px mark beside 16px text on the map, a 20px mark
 * beside 14px text on a level.
 *
 * A component rather than a shared class string, so neither can be edited
 * without the other.
 */

import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Logo } from './Logo';

export function HeaderBar({
  children,
  /**
   * Link the brand back to the map. Off on the map itself, where it would be a
   * link to the page you are already looking at.
   */
  linkHome = false,
}: {
  children: ReactNode;
  linkHome?: boolean;
}) {
  const brand = (
    <>
      <Logo size={20} />
      <span className="text-sm font-semibold tracking-tight">Simten</span>
    </>
  );

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
      {linkHome ? (
        <Link
          to="/"
          aria-label="Simten — home"
          className="flex shrink-0 items-center gap-2 text-foreground no-underline transition-colors hover:text-foreground/80"
        >
          {brand}
        </Link>
      ) : (
        <span className="flex shrink-0 items-center gap-2 text-foreground">{brand}</span>
      )}
      {children}
    </header>
  );
}
