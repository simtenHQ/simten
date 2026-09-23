/**
 * What a phone gets instead of a level.
 *
 * A level is three resizable panels around a code editor, which a small
 * touchscreen cannot usefully show and cannot comfortably type into. Without
 * this the page still rendered: a cramped, unusable editor and no explanation,
 * which reads as broken rather than as not-for-this-device.
 *
 * The map still works on mobile, so this offers it rather than a dead end.
 */

import { Link } from '@tanstack/react-router';
import { Logo } from './Logo';

export function MobileNotice() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 px-6 py-12 text-center dark:bg-[#111113]">
      <main className="flex flex-1 flex-col items-center justify-center">
        <div className="max-w-sm">
          {/* The brand rather than a monitor icon: this is the whole page for
              anyone arriving on a phone, so it has to say whose site it is.
              The heading already carries the "not on this device" part, and
              two icons above it read as clutter. Same lockup as `NotFound`. */}
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 text-foreground no-underline transition-colors hover:text-foreground/80"
            aria-label="Simten home"
          >
            <Logo size={24} />
            <span className="text-lg font-semibold tracking-tight">Simten</span>
          </Link>

          <h1 className="mb-2 text-xl font-semibold tracking-tight">This game needs a desktop</h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            You play by writing code, next to a circuit diagram wide enough to read. Neither fits on
            a phone yet.
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
