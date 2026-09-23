/**
 * What an unknown URL gets.
 *
 * The router's default is the string "Not Found" on a blank page, which reads
 * as a broken site rather than a wrong address. That matters more than usual
 * here: a level's id is its URL, so renaming one (`first-wire` became `nand`)
 * leaves the old address live in search results and in anything anyone has
 * shared, and the first Simten page those visitors see is this one.
 *
 * So it says where they are and offers the map, which is the one page that can
 * route them anywhere else.
 */

import { Link } from '@tanstack/react-router';
import { Logo } from './Logo';

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 px-6 py-12 text-center dark:bg-[#111113]">
      <main className="flex flex-1 flex-col items-center justify-center">
        <div className="max-w-sm">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 text-foreground no-underline transition-colors hover:text-foreground/80"
            aria-label="Simten home"
          >
            <Logo size={24} />
            <span className="text-lg font-semibold tracking-tight">Simten</span>
          </Link>

          <h1 className="mb-2 text-xl font-semibold tracking-tight">There is nothing here</h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            This address does not match a level. Some of them have been renamed, so an old link may
            point at one that has moved.
          </p>

          <div className="flex flex-col gap-2">
            <Link
              to="/"
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium no-underline transition-colors hover:bg-accent"
            >
              See the map
            </Link>
            <div className="mt-2 text-xs text-muted-foreground">
              Read more at{' '}
              <a
                href="https://simten.dev"
                className="text-foreground underline-offset-2 hover:underline"
              >
                simten.dev
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
