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
import { useCallback, useEffect, useState } from 'react';
import { HeaderBar } from '../components/HeaderBar';
import { IntroDialog } from '../components/IntroDialog';
import { LevelDrilldown } from '../components/LevelDrilldown';
import { LevelMap } from '../components/LevelMap';
import ThemeToggle from '../components/ThemeToggle';
import { LEVELS_BY_ID } from '../game/levels';
import { type Drafts, INTRO_SEEN_KEY, readDrafts, readProgress, readStored } from '../game/storage';

export const Route = createFileRoute('/')({
  component: MapPage,
  staticData: { skipDefaultChrome: true },
});

/** Stable identity, so the first render does not invalidate the map's memos. */
const NOTHING_SOLVED: ReadonlySet<string> = new Set();
const NO_DRAFTS: Drafts = {};

function MapPage() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  /**
   * Saved state, read after mount rather than during render.
   *
   * This page server-renders, and unlike the editor its storage-derived state
   * is visible DOM — a solved level is a green card and a live wire. Reading in
   * an initialiser would render one thing on the server and another on the
   * client and lose the hydration argument. The map is honest for one frame
   * instead: nothing solved, everything available.
   *
   * Both records are read here so the drilldown gets its source without going
   * to storage itself. It mounts on hover, long after this, so the draft is
   * already in hand and it compiles the right circuit the first time rather
   * than compiling the reference answer and then replacing it.
   */
  const [solved, setSolved] = useState(NOTHING_SOLVED);
  const [drafts, setDrafts] = useState(NO_DRAFTS);

  /**
   * Owned here rather than inside the dialog, so the header can reopen it.
   * Starts closed and opens after mount for the same reason as the rest of this
   * state: reading storage during render would either mismatch hydration or
   * flash the dialog at someone who has already dismissed it.
   */
  const [introOpen, setIntroOpen] = useState(false);

  useEffect(() => {
    setSolved(new Set(Object.keys(readProgress())));
    setDrafts(readDrafts());
    if (!readStored(INTRO_SEEN_KEY, false)) setIntroOpen(true);
  }, []);

  const onHoverLevel = useCallback((levelId: string) => setHovered(levelId), []);
  const onExpandLevel = useCallback((levelId: string) => setExpanded(levelId), []);
  const onCloseExpanded = useCallback(() => setExpanded(null), []);

  // While the inspector is open it wins, so sweeping the pointer across other
  // levels behind the modal cannot swap what is being inspected. Otherwise the
  // hovered level is mounted to warm its compile before it is asked for.
  // Solved levels only. The drilldown falls back to the reference answer when
  // the player has no draft, so mounting it for an unattempted level would
  // compile the solution and hand it over on a double-click. LevelMap hides the
  // badge for the same reason; this makes it structural rather than cosmetic,
  // and stops a hover compiling an answer nobody asked for.
  const activeId = expanded ?? hovered;
  const candidate = activeId ? LEVELS_BY_ID.get(activeId) : undefined;
  const level = candidate && solved.has(candidate.id) ? candidate : undefined;

  return (
    <div className="flex h-screen flex-col">
      <HeaderBar>
        <span className="text-sm text-muted-foreground">Build a computer</span>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIntroOpen(true)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            What is this?
          </button>
          <ThemeToggle />
        </div>
      </HeaderBar>

      <main className="min-h-0 flex-1">
        <LevelMap solved={solved} onHoverLevel={onHoverLevel} onExpandLevel={onExpandLevel} />
      </main>

      {level && (
        // Keyed so switching levels remounts rather than reusing the previous
        // circuit's compile slot and simulation state.
        <LevelDrilldown
          key={level.id}
          level={level}
          draft={drafts[level.id]}
          expanded={expanded === level.id}
          onCloseExpanded={onCloseExpanded}
        />
      )}

      <IntroDialog open={introOpen} onOpenChange={setIntroOpen} />
    </div>
  );
}
