/**
 * The drilldown panel.
 *
 * Hovering a level on the map opens its circuit here, live and clickable —
 * flip the switches, watch the lamp. It is the same `useCompiledCircuit` +
 * `CircuitCanvas` pair the level page uses, pointed at a finished solution
 * instead of the editor's buffer.
 *
 * Today it draws the reference answer, because nothing stores the player's
 * (see `solutions.ts`). That makes the interaction judgeable now and is the
 * wrong content long term: the point of the feature is seeing *your* circuit,
 * at *your* gate count, which is also what stops it being a spoiler. When
 * drafts persist, only the `source` line below changes.
 */

import { useCompiledCircuit } from '@simten/embed';
import { CircuitCanvas } from '@simten/ui/canvas';
import { useCallback } from 'react';
import { SOLUTIONS } from '../game/solutions';
import type { Level } from '../game/types';

export function LevelDrilldown({ level }: { level: Level }) {
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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Inside</p>
        <p className="font-medium">{level.title}</p>
      </div>
      <div className="min-h-0 flex-1">
        {preview.compileError ? (
          <div className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
            {preview.compileError}
          </div>
        ) : (
          <CircuitCanvas
            circuit={preview.circuit}
            componentLibrary={preview.componentLibrary ?? undefined}
            portValues={preview.portValues}
            theme="dark"
            autoLayout
            showControls={false}
            onToggleNode={preview.toggleNode}
            onSetNodeValue={preview.setNodeValue}
            renderEmptyState={() => (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                Compiling…
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
