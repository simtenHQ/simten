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
import {
  buildGlobalsFor,
  registerSimtenThemes,
  SIMTEN_DARK,
  SimtenCodeEditor,
} from '@simten/ui/monaco';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@simten/ui/primitives/resizable';
import { Sheet, SheetContent, SheetTitle } from '@simten/ui/primitives/sheet';
import { useSandboxContext } from '@simten/ui/sandbox';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { LevelComplete } from '../components/LevelComplete';
import { SpecPanel } from '../components/SpecPanel';
import { grade, STRUCTURAL } from '../game/grade';
import { nameDiagnostics } from '../game/level-name';
import { LEVELS_BY_ID, nextLevel } from '../game/levels';
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
  const [specOpen, setSpecOpen] = useState(true);
  // Closing the completion dialog must not immediately reopen it, but a fresh
  // submit should bring it back.
  const [completeDismissed, setCompleteDismissed] = useState(false);

  // Preview the circuit the source describes. Pinned to the level's target by
  // name — the default picks the last circuit defined, which would follow a
  // player's helper instead of their answer. Same reason the grader does it.
  const select = useCallback(
    (circuits: { name: string }[]) =>
      // Fall back to the last circuit defined when nothing carries the target
      // name. Only grading depends on the name; taking away the diagram as
      // well turned a rule into a punishment, with no explanation until Submit.
      circuits.find((c) => c.name === level.target) ?? circuits[circuits.length - 1],
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
      setCompleteDismissed(false);
      // Submit is a request for a verdict, so show it — hidden, the spec sheet
      // swallowed both the failure message and the whole victory run.
      setSpecOpen(true);
      if (verdict.status === 'pass') victory.start();
      else victory.reset();
    } finally {
      setSubmitting(false);
    }
  }, [sandbox, level, source, victory]);

  // Surfaced as a Monaco squiggle rather than a panel note: the problem is on
  // a specific line, and that is where someone is looking.
  const diagnostics = useMemo(() => nameDiagnostics(source, level.target), [source, level.target]);

  /**
   * Teach the editor only what this level permits, so a component you have not
   * earned yet does not autocomplete and does not compile. The rule stops being
   * something you discover by breaking it.
   *
   * `STRUCTURAL` comes from the grader rather than a second list here: those are
   * the pieces that carry no logic and never count toward par, which is exactly
   * why they are absent from `allowed`. Filtering on `allowed` alone would leave
   * every level unable to declare a `Switch`.
   */
  const intellisense = useMemo(
    () => ({
      globals: false,
      extraLibs: {
        'file:///simten-globals.d.ts': buildGlobalsFor([...level.allowed, ...STRUCTURAL]),
      },
    }),
    [level.allowed],
  );

  const solved = result?.status === 'pass';
  const next = useMemo(() => nextLevel(level.id), [level.id]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 dark:bg-[#111113]">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        {/* Back to the map — the only way out of a level, and the only way in. */}
        <Link to="/" className="text-sm font-semibold tracking-tight no-underline">
          Simten
        </Link>
        <div className="h-5 w-px bg-border" />
        <span className="shrink-0 text-sm font-semibold text-foreground/80">{level.title}</span>
        {/* The brief is read once and then ignored, so it belongs here rather
            than occupying panel space for the rest of the level. */}
        <p className="hidden truncate text-xs text-muted-foreground lg:block" title={level.brief}>
          {level.brief}
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {solved && victory.complete && (
            <button
              type="button"
              onClick={() => setCompleteDismissed(false)}
              className="whitespace-nowrap rounded-md border border-emerald-500/50 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
            >
              Solved · {result?.status === 'pass' ? result.gates : 0}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSpecOpen((v) => !v)}
            className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs font-medium"
          >
            {specOpen ? 'Hide spec' : 'Show spec'}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="whitespace-nowrap rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Checking…' : 'Submit'}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup>
          <ResizablePanel defaultSize={45} minSize={20} className="flex flex-col overflow-hidden">
            <div className="min-h-0 flex-1">
              <SimtenCodeEditor
                value={source}
                onChange={(v) => {
                  setSource(v ?? '');
                  // A verdict describes the source that produced it, so an
                  // edit retires both the verdict and any victory run still
                  // sweeping.
                  if (result) {
                    setResult(null);
                    victory.reset();
                  }
                }}
                diagnostics={diagnostics}
                intellisense={intellisense}
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

          <ResizablePanel defaultSize={55} minSize={20} className="overflow-hidden">
            <CircuitCanvas
              circuit={preview.circuit}
              componentLibrary={preview.componentLibrary ?? undefined}
              portValues={preview.portValues}
              theme="dark"
              showControls
              // Re-lay out on every change. The default only re-runs the
              // layout when nodes appear or disappear, so adding the last
              // wire — which changes no nodes — left the lamp where it had
              // been while unconnected.
              autoLayout
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

      {/* Non-modal so the editor and canvas keep working behind it, and the
          overlay is off — it is `fixed inset-0` and would swallow every click
          whatever the modal setting says. Outside interaction does not dismiss
          it either: clicking a switch is not a request to close the spec.
          Focus stays where it was, so opening this never interrupts typing. */}
      {result?.status === 'pass' && (
        <LevelComplete
          // Held back until the victory run has finished demonstrating the
          // circuit — the run is the proof, this is the receipt.
          open={victory.complete && !completeDismissed}
          onOpenChange={(o) => setCompleteDismissed(!o)}
          level={level}
          next={next}
        />
      )}

      <Sheet modal={false} open={specOpen} onOpenChange={setSpecOpen}>
        <SheetContent
          side="bottom"
          showOverlay={false}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-h-[45vh] gap-0 overflow-y-auto"
        >
          <SheetTitle className="sr-only">Level spec</SheetTitle>
          <SpecPanel
            level={level}
            result={result}
            activeRow={victory.active}
            provenRows={victory.proven}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
