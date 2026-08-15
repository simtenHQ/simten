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
import type { Level } from '../game/types';

export function MobileNotice({ level }: { level: Level }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 px-6 py-12 text-center dark:bg-[#111113]">
      <main className="flex flex-1 flex-col items-center justify-center">
        <div className="max-w-sm">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
            <svg
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path strokeLinecap="round" d="M8 20h8M12 16v4" />
            </svg>
          </div>

          <h1 className="mb-2 text-xl font-semibold tracking-tight">
            {level.title} needs a desktop
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            You solve these by writing code, next to a circuit diagram wide enough to read. Neither
            fits on a phone yet. Open this on a laptop and it will be waiting.
          </p>

          <div className="flex flex-col gap-2">
            <Link
              to="/"
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium no-underline transition-colors hover:bg-accent"
            >
              See the map
            </Link>
            <div className="mt-2 text-xs text-muted-foreground">
              Or read what this is about at{' '}
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
