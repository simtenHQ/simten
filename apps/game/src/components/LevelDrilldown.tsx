/**
 * The drilldown.
 *
 * Double-clicking the badge on a level opens its circuit in
 * `CompositeInspectorDialog`, the same inspector the canvas opens when you
 * double-click a composite component, so it arrives with a full-size canvas,
 * breadcrumbs and nested drill-down already working. It's a view of a
 * simulation of the circuit, harnessed as on the level page, with its inputs
 * at 0: the inspector shows values but has no switches.
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
import { CompositeInspectorDialog, type InspectorFrame, useDetectTheme } from '@simten/ui/canvas';
import { useSimulation } from '@simten/ui/sandbox';
import { useCallback, useEffect, useState } from 'react';
import { SOLUTIONS } from '../game/solutions';
import type { Level } from '../game/types';

interface LevelDrilldownProps {
  level: Level;
  /** The player's source for this level, when they have opened it. */
  draft?: string;
  /** Whether the inspector is open. False means this is only prefetching. */
  expanded?: boolean;
  onCloseExpanded?: () => void;
}

export function LevelDrilldown({ level, draft, expanded, onCloseExpanded }: LevelDrilldownProps) {
  const source = draft ?? SOLUTIONS[level.id];
  const theme = useDetectTheme();

  // `select` is a picker over the compiled circuits, not a name; the default
  // takes the last circuit defined. Same shape the level page uses.
  const select = useCallback(
    (circuits: CircuitIR[]) =>
      circuits.find((c) => c.name === level.target) ?? circuits[circuits.length - 1],
    [level.target],
  );

  const preview = useSimulation({ source, circuit: select }, { harness: true });
  const { state } = preview;
  const compileError = preview.compileError?.message ?? state.error;

  /**
   * The inspector's drill-down stack. Seeded with this level's circuit when
   * expanded, then owned by the dialog; pushing goes deeper into a composite,
   * popping comes back out, and an empty stack is what "closed" means to it.
   */
  const [stack, setStack] = useState<InspectorFrame[]>([]);

  // The harness wraps a circuit with ports as node `dut`, so that's the frame's
  // path in the session. A self-contained circuit (no ports) isn't wrapped:
  // it is the session's top level, path ''.
  const target = state.circuitName
    ? (state.definitions?.resolveCircuit(state.circuitName) ?? null)
    : null;
  const harnessed = state.circuit !== null && state.circuit.name !== state.circuitName;
  useEffect(() => {
    if (expanded && target) {
      setStack([
        {
          componentName: target.name,
          componentDef: target,
          nodeLabel: level.title,
          path: harnessed ? 'dut' : '',
        },
      ]);
    } else {
      setStack([]);
    }
  }, [expanded, target, harnessed, level.title]);

  const onPushLevel = useCallback((frame: InspectorFrame) => {
    setStack((s) => [...s, frame]);
  }, []);

  const onPopLevel = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const onNavigate = useCallback((index: number) => setStack((s) => s.slice(0, index + 1)), []);

  const onClose = useCallback(() => {
    setStack([]);
    onCloseExpanded?.();
  }, [onCloseExpanded]);

  // Reachable now that this draws drafts: a level left mid-thought does not
  // compile, and inspecting it is a perfectly reasonable thing to do. Says so
  // rather than opening to nothing, which is indistinguishable from a broken
  // double-click.
  if (expanded && compileError) {
    return (
      <div className="fixed inset-x-0 bottom-6 mx-auto w-fit rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
        {level.title} did not compile: {compileError}
      </div>
    );
  }

  if (!state.definitions) return null;

  return (
    <CompositeInspectorDialog
      stack={stack}
      definitions={state.definitions}
      simulation={preview}
      theme={theme}
      onClose={onClose}
      onPopLevel={onPopLevel}
      onPushLevel={onPushLevel}
      onNavigate={onNavigate}
    />
  );
}
