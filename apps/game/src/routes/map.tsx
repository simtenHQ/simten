/**
 * The campaign map page.
 *
 * Full-bleed under a thin header: the canvas needs the room, and a map that
 * scrolls inside a narrow column is a list with extra steps.
 *
 * Hovering a level opens its circuit in the panel on the right. The panel keeps
 * showing the last level you hovered rather than clearing on mouse-out — a
 * panel that empties as soon as you move the pointer flickers while you sweep
 * across the map, and there is nothing useful to show in its place.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { LevelDrilldown } from '../components/LevelDrilldown';
import { LevelMap } from '../components/LevelMap';
import { LEVELS_BY_ID } from '../game/levels';

export const Route = createFileRoute('/map')({
  component: MapPage,
  staticData: { skipDefaultChrome: true },
});

function MapPage() {
  const [hovered, setHovered] = useState<string | null>(null);
  const onHoverLevel = useCallback((levelId: string) => setHovered(levelId), []);
  const level = hovered ? LEVELS_BY_ID.get(hovered) : undefined;

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

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1">
          <LevelMap onHoverLevel={onHoverLevel} />
        </main>

        <aside className="hidden w-[380px] shrink-0 border-l border-border lg:block">
          {level ? (
            // Keyed so switching levels remounts rather than reusing the
            // previous circuit's compile slot and simulation state.
            <LevelDrilldown key={level.id} level={level} />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
              Hover a level to look inside it.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
