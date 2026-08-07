/**
 * The campaign map — the front door and the only way in.
 *
 * Full-bleed under a thin header: the canvas needs the room, and a map that
 * scrolls inside a narrow column is a list with extra steps. There is no list
 * view; the map replaced it, so the campaign has one shape rather than two that
 * can disagree.
 *
 * Looking inside a level is a modal rather than a docked panel. A panel wide
 * enough to read a circuit in takes a third of the map, and one narrow enough
 * to be affordable renders the circuit too small to be worth opening.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { IntroDialog } from '../components/IntroDialog';
import { LevelDrilldown } from '../components/LevelDrilldown';
import { LevelMap } from '../components/LevelMap';
import ThemeToggle from '../components/ThemeToggle';
import { LEVELS_BY_ID } from '../game/levels';

export const Route = createFileRoute('/')({
  component: MapPage,
  staticData: { skipDefaultChrome: true },
});

function MapPage() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const onHoverLevel = useCallback((levelId: string) => setHovered(levelId), []);
  const onExpandLevel = useCallback((levelId: string) => setExpanded(levelId), []);
  const onCloseExpanded = useCallback(() => setExpanded(null), []);

  // While the inspector is open it wins, so sweeping the pointer across other
  // levels behind the modal cannot swap what is being inspected. Otherwise the
  // hovered level is mounted to warm its compile before it is asked for.
  const activeId = expanded ?? hovered;
  const level = activeId ? LEVELS_BY_ID.get(activeId) : undefined;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <img src="/favicon.svg" alt="" width={20} height={20} />
        <span className="font-semibold">Simten</span>
        <span className="text-sm text-muted-foreground">Build a computer</span>
        <div className="ml-auto flex items-center gap-3">
          <a
            href="https://simten.dev"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            What is this?
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <LevelMap onHoverLevel={onHoverLevel} onExpandLevel={onExpandLevel} />
      </main>

      {level && (
        // Keyed so switching levels remounts rather than reusing the previous
        // circuit's compile slot and simulation state.
        <LevelDrilldown
          key={level.id}
          level={level}
          expanded={expanded === level.id}
          onCloseExpanded={onCloseExpanded}
        />
      )}

      <IntroDialog />
    </div>
  );
}
