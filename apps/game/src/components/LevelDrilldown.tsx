/**
 * The drilldown.
 *
 * Double-clicking the badge on a level opens its circuit in a dialog of its
 * own: a full-size `CircuitCanvas` of a simulation of the circuit, drawn as on
 * the level page, with its switches live. Double-clicking a component inside
 * opens the canvas's own drill-down, with breadcrumbs, as anywhere else.
 *
 * The component renders nothing until then. It is mounted on hover rather than
 * on open purely to warm the compile: you have to hover a badge before you can
 * double-click it, so by the time the dialog is asked for, the circuit is ready
 * and it opens instantly instead of flashing empty while the sandbox works.
 *
 * It draws the player's own circuit, which is the point of the feature: your
 * work, at your gate count, rather than a spoiler. The draft is the right
 * source rather than a passing snapshot; the drilldown *shows* your circuit,
 * it does not depend on it, so a solved level you have since edited should
 * appear as you left it. Levels never opened fall back to the reference answer,
 * because a map where most cards inspect to nothing is worse than one that
 * shows what the shape of an answer looks like.
 */

import type { CircuitIR } from '@simten/core/internal';
import { CircuitCanvas, ClockControls, useSimulation } from '@simten/react';
import { XIcon } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { SOLUTIONS } from '../game/solutions';
import type { Level } from '../game/types';

interface LevelDrilldownProps {
  level: Level;
  /** The player's source for this level, when they have opened it. */
  draft?: string;
  /** Whether the dialog is open. False means this is only prefetching. */
  expanded?: boolean;
  onCloseExpanded?: () => void;
}

/**
 * Whether the canvas's own drill-down is open over this dialog. It closes
 * itself on Escape, a level at a time, so the key isn't this dialog's then.
 */
const canvasInspectorOpen = () =>
  document.querySelector('button[aria-label="Close inspector"]') !== null;

export function LevelDrilldown({ level, draft, expanded, onCloseExpanded }: LevelDrilldownProps) {
  const source = draft ?? SOLUTIONS[level.id];

  // `select` is a picker over the compiled circuits, not a name; the default
  // takes the last circuit defined. Same shape the level page uses.
  const select = useCallback(
    (circuits: CircuitIR[]) =>
      circuits.find((c) => c.name === level.target) ?? circuits[circuits.length - 1],
    [level.target],
  );

  const preview = useSimulation({ source, circuit: select });
  const { state } = preview;
  const compileError = state.compileError?.message ?? state.error;

  const onClose = useCallback(() => onCloseExpanded?.(), [onCloseExpanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !canvasInspectorOpen()) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expanded, onClose]);

  if (!expanded) return null;

  // Reachable now that this draws drafts: a level left mid-thought does not
  // compile, and inspecting it is a perfectly reasonable thing to do. Says so
  // rather than opening to nothing, which is indistinguishable from a broken
  // double-click.
  if (compileError) {
    return (
      <div className="fixed inset-x-0 bottom-6 mx-auto w-fit rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
        {level.title} did not compile: {compileError}
      </div>
    );
  }

  if (!state.ready) return null;

  return (
    <>
      {/* Backdrop: clicking outside the panel closes it. Out of the tab order,
          because the close button and Escape cover the keyboard. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="fixed inset-0 z-50 cursor-default bg-black/50 animate-in fade-in-0 duration-250"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-label={level.title}
          className="pointer-events-auto flex h-[88vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl animate-in fade-in-0 duration-150"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">{level.title}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <CircuitCanvas simulation={preview} />
            <ClockControls simulation={preview} floating showScrubber />
          </div>
        </div>
      </div>
    </>
  );
}
