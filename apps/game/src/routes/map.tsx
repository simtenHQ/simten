/**
 * The campaign map page.
 *
 * Full-bleed under a thin header: the canvas needs the room, and a map that
 * scrolls inside a narrow column is a list with extra steps.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { LevelMap } from '../components/LevelMap';

export const Route = createFileRoute('/map')({
  component: MapPage,
  staticData: { skipDefaultChrome: true },
});

function MapPage() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-border px-4 py-2">
        <Link to="/play" className="font-semibold">
          Simten
        </Link>
        <span className="text-sm text-muted-foreground">The campaign</span>
        <Link to="/play" className="ml-auto text-sm text-muted-foreground hover:text-foreground">
          List view
        </Link>
      </header>
      <main className="min-h-0 flex-1">
        <LevelMap />
      </main>
    </div>
  );
}
