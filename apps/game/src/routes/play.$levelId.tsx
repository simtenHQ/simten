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
import type { GradeResult } from '../game/types';
import { useVictoryRun } from '../game/useVictoryRun';

export const Route = createFileRoute('/play/$levelId')({
  staticData: { skipDefaultChrome: true },
  loader: ({ params }) => {
    const level = LEVELS_BY_ID.get(params.levelId);
    if (!level) throw notFound();
    return { level };
  },
  component: PlayLevel,
});

function PlayLevel() {
  const { level } = Route.useLoaderData();
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

              <div className="text-xs">
                <span className="text-muted-foreground">Available: </span>
                <span className="font-mono">{level.allowed.join(', ')}</span>
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
              // The harness switches are clickable, so the player can drive
              // their own circuit and see it light up before submitting.
              onToggleNode={preview.toggleNode}
              onSetNodeValue={preview.setNodeValue}
              renderEmptyState={() => (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  Your circuit appears here as you write it.
                </div>
              )}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
