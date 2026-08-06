/**
 * The drilldown.
 *
 * Double-clicking the badge on a level opens its circuit in
 * `CompositeInspectorDialog` — the same inspector the canvas opens when you
 * double-click a composite component, so it arrives with a full-size canvas,
 * its own simulation engine, breadcrumbs and nested drill-down already working.
 *
 * The component renders nothing until then. It is mounted on hover rather than
 * on open purely to warm the compile: you have to hover a badge before you can
 * double-click it, so by the time the dialog is asked for, the circuit is ready
 * and it opens instantly instead of flashing empty while the sandbox works.
 *
 * Today it draws the reference answer, because nothing stores the player's
 * (see `solutions.ts`). That makes the interaction judgeable now and is the
 * wrong content long term: the point of the feature is seeing *your* circuit,
 * at *your* gate count, which is also what stops it being a spoiler. When
 * drafts persist, only the `source` line below changes.
 */

import type { Circuit } from '@simten/core';
import { useCompiledCircuit } from '@simten/embed';
import { CompositeInspectorDialog, type InspectorFrame } from '@simten/ui/canvas';
import { useCallback, useEffect, useState } from 'react';
import { SOLUTIONS } from '../game/solutions';
import type { Level } from '../game/types';

export interface LevelDrilldownProps {
  level: Level;
  /** Whether the inspector is open. False means this is only prefetching. */
  expanded?: boolean;
  onCloseExpanded?: () => void;
}

export function LevelDrilldown({ level, expanded, onCloseExpanded }: LevelDrilldownProps) {
  const source = SOLUTIONS[level.id];

  // `select` is a picker over the compiled circuits, not a name — the default
  // takes the last circuit defined. Same shape the level page uses.
  const select = useCallback(
    (circuits: { name: string }[]) =>
      circuits.find((c) => c.name === level.target) ?? circuits[circuits.length - 1],
    [level.target],
  );

  const preview = useCompiledCircuit(source, {
    slot: `map:${level.id}`,
    select: select as never,
    autoHarness: true,
  });

  /**
   * The inspector's drill-down stack. Seeded with this level's circuit when
   * expanded, then owned by the dialog — pushing goes deeper into a composite,
   * popping comes back out, and an empty stack is what "closed" means to it.
   */
  const [stack, setStack] = useState<InspectorFrame[]>([]);

  useEffect(() => {
    if (expanded && preview.circuit) {
      setStack([
        {
          componentName: preview.circuit.name,
          componentDef: preview.circuit,
          nodeLabel: level.title,
        },
      ]);
    } else {
      setStack([]);
    }
  }, [expanded, preview.circuit, level.title]);

  const onPushLevel = useCallback((componentName: string, def: Circuit, nodeLabel: string) => {
    setStack((s) => [...s, { componentName, componentDef: def, nodeLabel }]);
  }, []);

  const onPopLevel = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const onNavigate = useCallback((index: number) => setStack((s) => s.slice(0, index + 1)), []);

  const onClose = useCallback(() => {
    setStack([]);
    onCloseExpanded?.();
  }, [onCloseExpanded]);

  // These are our own reference solutions and the suite proves they compile, so
  // this should be unreachable — but a drilldown that opens to nothing at all
  // would be indistinguishable from a broken double-click.
  if (expanded && preview.compileError) {
    return (
      <div className="fixed inset-x-0 bottom-6 mx-auto w-fit rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
        {level.title} did not compile: {preview.compileError}
      </div>
    );
  }

  if (!preview.componentLibrary) return null;

  return (
    <CompositeInspectorDialog
      stack={stack}
      componentLibrary={preview.componentLibrary}
      theme="dark"
      onClose={onClose}
      onPopLevel={onPopLevel}
      onPushLevel={onPushLevel}
      onNavigate={onNavigate}
    />
  );
}
