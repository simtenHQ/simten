/**
 * A level.
 *
 * Laid out like simten.dev/circuit on purpose — full viewport, its own top bar,
 * resizable panels — because it is the same product and should not read as a
 * different site. Three panels rather than the editor's two: the brief, the
 * code, and the circuit that code describes.
 *
 * That third panel is the point of the game being code-first. You write a
 * netlist and watch it become hardware you can click.
 */

import { ErrorDisplay, useCompiledCircuit } from '@simten/embed';
import { CircuitCanvas } from '@simten/ui/canvas';
import { registerSimtenThemes, SIMTEN_DARK, SimtenCodeEditor } from '@simten/ui/monaco';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@simten/ui/primitives/resizable';
import { useSandboxContext } from '@simten/ui/sandbox';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { GradeReport } from '../components/GradeReport';
import { TruthTable } from '../components/TruthTable';
import { grade } from '../game/grade';
import { LEVELS, LEVELS_BY_ID, levelIndex, nextLevel } from '../game/levels';
import { sandboxRuntime } from '../game/runtime';
import type { GradeResult, Level } from '../game/types';
import { useVictoryRun } from '../game/useVictoryRun';

export const Route = createFileRoute('/play/$levelId')({
  staticData: { skipDefaultChrome: true },
  loader: ({ params }) => {
    const level = LEVELS_BY_ID.get(params.levelId);
    if (!level) throw notFound();
    return { level };
  },
  component: PlayLevelRoute,
});

/**
 * Remount the level on every id change.
 *
 * TanStack reuses one component instance across `$levelId`, and almost all of
 * this screen's state is seeded from the level — `useState(level.stub)` runs
 * its initialiser only on mount. Without the key, clicking "Next" swapped the
 * title, brief and truth table while leaving the previous level's solution in
 * the editor, its circuit on the canvas, and its SOLVED verdict in the panel.
 *
 * A key is the right tool here rather than an effect that resets four pieces of
 * state: every one of them is derived from the level, so the whole component
 * should simply start again.
 */
function PlayLevelRoute() {
  const { level } = Route.useLoaderData();
  return <PlayLevel key={level.id} level={level} />;
}

function PlayLevel({ level }: { level: Level }) {
  const sandbox = useSandboxContext();

  const [source, setSource] = useState(level.stub);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Preview the circuit the source describes. Pinned to the level's target by
  // name — the default picks the last circuit defined, which would follow a
  // player's helper instead of their answer. Same reason the grader does it.
  const select = useCallback(
    (circuits: { name: string }[]) => circuits.find((c) => c.name === level.target),
    [level.target],
  );

  // autoHarness wraps top-level ports in Switch/Led nodes, so the preview is
  // playable — click a switch, watch the LED — before ever pressing Submit.
  // Without it there is nothing to click and nothing to see: the canvas
  // projection only walks `circuit.nodes`, so a level's inputs and outputs are
  // not drawn at all and a one-gate answer renders as a gate with no wires.
  //
  // It is not a commitment. `autoHarness` returns the circuit untouched when it
  // declares no top-level ports (auto-harness.ts:23), so a level that wants the
  // raw internals shown just authors a self-contained circuit — no flag to flip.
  //
  // The trade it does make: a circuit WITH ports renders as one `dut` box, so
  // the player's own gates sit one level down. The canvas already supports
  // getting there — the node reads "double-click to inspect".
  const preview = useCompiledCircuit(source, {
    slot: 'preview',
    select: select as never,
    autoHarness: true,
  });

  // On a solve, drive the player's own circuit through the truth table so the
  // switches flip and the LED lights. The proof is the machine running.
  const victory = useVictoryRun(level.vectors, preview.setNodeValue);

  const onSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const verdict = await grade(sandboxRuntime(sandbox), level, source);
      setResult(verdict);
      if (verdict.status === 'pass') victory.start();
      else victory.reset();
    } finally {
      setSubmitting(false);
    }
  }, [sandbox, level, source, victory]);

  // Circuit names the source defines right now — used to explain an empty
  // canvas rather than leaving the player staring at one.
  const defined = useMemo(
    () =>
      [...(source.matchAll(/circuit\(\s*['"]([^'"]+)['"]/g) as Iterable<RegExpMatchArray>)].map(
        (m) => m[1],
      ),
    [source],
  );

  const solved = result?.status === 'pass';
  const next = useMemo(() => nextLevel(level.id), [level.id]);
  const position = levelIndex(level.id) + 1;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 dark:bg-[#111113]">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        <Link to="/play" className="text-sm font-semibold tracking-tight no-underline">
          Simten
        </Link>
        <div className="h-5 w-px bg-border" />
        <span className="text-sm font-semibold text-foreground/80">{level.title}</span>
        <span className="text-xs text-muted-foreground">
          {position} / {LEVELS.length}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {solved && victory.complete && next && (
            <Link
              to="/play/$levelId"
              params={{ levelId: next.id }}
              onClick={() => setResult(null)}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium no-underline"
            >
              Next: {next.title} →
            </Link>
          )}
          {solved && victory.complete && !next && (
            <span className="text-xs text-muted-foreground">
              That is the last one for now — more coming.
            </span>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Checking…' : 'Submit'}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup>
          <ResizablePanel defaultSize={22} minSize={15} className="overflow-y-auto">
            <div className="flex flex-col gap-5 p-4">
              <p className="text-sm leading-relaxed text-muted-foreground">{level.brief}</p>

              <div>
                <h2 className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Must produce
                </h2>
                <TruthTable level={level} active={victory.active} proven={victory.proven} />
              </div>

              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Available: </span>
                  <span className="font-mono">{level.allowed.join(', ')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Must define: </span>
                  <span className="font-mono">{level.target}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Signals: </span>
                  <span className="font-mono">
                    {[...level.inputs, ...level.outputs].join(', ')}
                  </span>
                </div>
              </div>

              {result && <GradeReport result={result} level={level} revealed={victory.complete} />}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={36} minSize={20} className="flex flex-col overflow-hidden">
            <div className="min-h-0 flex-1">
              <SimtenCodeEditor
                value={source}
                onChange={(v) => {
                  setSource(v ?? '');
                  // A verdict describes the source that produced it, so an edit
                  // retires both the verdict and any victory run still sweeping.
                  if (result) {
                    setResult(null);
                    victory.reset();
                  }
                }}
                beforeMount={registerSimtenThemes}
                theme={SIMTEN_DARK}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                  fixedOverflowWidgets: true,
                }}
              />
            </div>
            {/* Diagnostics live under the editor, never over the canvas — a
                parse error mid-keystroke must not blank the diagram. */}
            {preview.compileError && <ErrorDisplay error={preview.compileError} />}
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={42} minSize={20} className="overflow-hidden">
            <CircuitCanvas
              circuit={preview.circuit}
              componentLibrary={preview.componentLibrary ?? undefined}
              portValues={preview.portValues}
              theme="dark"
              showControls
              // Re-lay out on every change. The default only re-runs the
              // layout when nodes appear or disappear, so adding the last wire
              // — which changes no nodes — left the lamp sitting where it had
              // been while unconnected, with the new edge detouring to reach
              // it. A level's diagram should always read as the circuit is now.
              autoLayout
              // The harness switches are clickable, so the player can drive
              // their own circuit and see it light up before submitting.
              onToggleNode={preview.toggleNode}
              onSetNodeValue={preview.setNodeValue}
              renderEmptyState={() => (
                <div className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
                  {/* The preview is pinned to the level's target by name, so a
                      correct circuit under a different name renders nothing.
                      Saying which name is missing beats an empty canvas that
                      looks like the code is broken. */}
                  {defined.length > 0 ? (
                    <span>
                      Nothing here is called <span className="font-mono">{level.target}</span>.
                      {' This level previews and grades that name — found '}
                      <span className="font-mono">{defined.join(', ')}</span>.
                    </span>
                  ) : (
                    'Your circuit appears here as you write it.'
                  )}
                </div>
              )}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
