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

import { elaborate } from '@simten/core';
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
import { Network, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DesktopOnly } from '../components/DesktopOnly';
import { LevelComplete } from '../components/LevelComplete';
import { Logo } from '../components/Logo';
import { MobileNotice } from '../components/MobileNotice';
import { SpecPanel } from '../components/SpecPanel';
import { forbiddenPrimitives, grade, permittedFor } from '../game/grade';
import { nameDiagnostics } from '../game/level-name';
import { LEVELS_BY_ID, nextLevel } from '../game/levels';
import { sandboxRuntime } from '../game/runtime';
import { clearDraft, readDrafts, writeDraft, writeProgress } from '../game/storage';
import type { GradeResult, Level } from '../game/types';
import { useVictoryRun } from '../game/useVictoryRun';
import { SITE_URL } from './__root';

/**
 * How long typing pauses before the draft is stored.
 *
 * Writing on every keystroke means a JSON parse, a spread and a serialise per
 * character, for a record that only matters when the tab goes away. Long enough
 * to coalesce a burst of typing, short enough that no realistic pause loses
 * work — and the pending write is flushed on unmount regardless, so leaving the
 * page mid-keystroke is safe.
 */
const DRAFT_DEBOUNCE_MS = 400;

export const Route = createFileRoute('/$levelId')({
  staticData: { skipDefaultChrome: true },
  loader: ({ params }) => {
    const level = LEVELS_BY_ID.get(params.levelId);
    if (!level) throw notFound();
    return { level };
  },
  /**
   * Per-level metadata, overriding the root's site-wide set.
   *
   * Every page used to ship the root's title, description and `og:url`, so the
   * eleven URLs were eleven duplicates as far as a crawler is concerned, and
   * sending someone a level produced a card naming the site and linking to its
   * front page rather than the level. The tagline is already a one-line
   * description written for a human, which is exactly what this needs.
   */
  head: ({ loaderData }) => {
    const level = loaderData?.level;
    if (!level) return {};
    const title = `${level.title} | Simten`;
    const url = `${SITE_URL}/${level.id}`;
    return {
      meta: [
        { title },
        { name: 'description', content: level.tagline },
        { property: 'og:title', content: title },
        { property: 'og:description', content: level.tagline },
        { property: 'og:url', content: url },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: level.tagline },
      ],
      // Levels are reachable whether or not you have unlocked them, so each one
      // is a real page and should say which page it is.
      links: [{ rel: 'canonical', href: url }],
    };
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
/**
 * The line the player's own work starts on, when the stub hands them a
 * finished component to build with — otherwise `null`.
 *
 * The full adder is given a half adder, and landing on that makes the level
 * look like it opens with someone else's code. But most stubs open with
 * comments that *are* the instructions, and scrolling past those would hide the
 * hint. So this keys off structure — is there a circuit defined above the
 * target? — rather than a flag somebody has to remember to set.
 */
export function givenPreambleEnd(lines: string[]): number | null {
  const target = lines.findIndex((l) => l.startsWith('export default circuit('));
  if (target <= 0) return null;
  if (!lines.slice(0, target).some((l) => l.includes('circuit('))) return null;
  return target + 1;
}

function PlayLevelRoute() {
  const { level } = Route.useLoaderData();
  return (
    <DesktopOnly fallback={<MobileNotice level={level} />}>
      <PlayLevel key={level.id} level={level} />
    </DesktopOnly>
  );
}

function PlayLevel({ level }: { level: Level }) {
  const sandbox = useSandboxContext();

  /**
   * Open on the player's own work, falling back to the stub.
   *
   * Read in the initialiser rather than an effect, which is normally the wrong
   * shape in a server-rendered app. It is safe here for a specific reason:
   * Monaco renders a placeholder on the server and never puts `source` in the
   * markup, so the server and client agree on the DOM whatever this returns.
   * Seeding after mount would instead hand the editor the stub first and swap
   * it, which flashes and — worse — makes the first change event carry the stub.
   *
   * The route remounts per level via `key`, so this runs again on every
   * navigation rather than sticking on the level it first mounted with.
   */
  const [source, setSource] = useState(() => readDrafts()[level.id] ?? level.stub);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [specOpen, setSpecOpen] = useState(true);
  // Closing the completion dialog must not immediately reopen it, but a fresh
  // submit should bring it back.
  const [completeDismissed, setCompleteDismissed] = useState(false);

  /**
   * Store the draft, a beat after typing stops.
   *
   * Driven from the editor's change event rather than an effect watching
   * `source`: an effect also fires on mount, which would write the stub over a
   * real draft in the moment between seeding and reading it. Only an edit is a
   * reason to save.
   */
  const pendingDraft = useRef<string | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback(
    (next: string) => {
      pendingDraft.current = next;
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => {
        draftTimer.current = null;
        pendingDraft.current = null;
        writeDraft(level.id, next);
      }, DRAFT_DEBOUNCE_MS);
    },
    [level.id],
  );

  // Leaving the page mid-debounce must not cost the last few keystrokes, and
  // clicking "Map" straight after typing is the obvious way to hit that.
  useEffect(
    () => () => {
      if (!draftTimer.current) return;
      clearTimeout(draftTimer.current);
      if (pendingDraft.current !== null) writeDraft(level.id, pendingDraft.current);
    },
    [level.id],
  );

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

  /**
   * Gates in the preview that this level forbids.
   *
   * The editor filter only removes the type declarations, so a disallowed gate
   * is a red squiggle and nothing more — the sandbox still executes it, and the
   * canvas happily drew a component the level bans. That left the diagram
   * looking like the authority while Submit disagreed.
   *
   * Checked here rather than in the sandbox, which has no business knowing a
   * level's rules: this is the grader's own function run against the preview,
   * so the canvas and the verdict cannot give different answers.
   */
  /**
   * The last circuit that used only permitted gates.
   *
   * While a forbidden gate is present the canvas shows this instead of the
   * current netlist, so a banned gate simply never appears — no banner, no
   * fanfare. The editor already squiggles it; the diagram just declines to
   * pretend it is real, and stops updating until the gate is gone.
   *
   * A ref rather than state — it is a cache of a render output, and setting
   * state from render to track it would just loop.
   */
  const lastPermitted = useRef<{
    circuit: typeof preview.circuit;
    library: typeof preview.componentLibrary;
  } | null>(null);

  const forbidden = useMemo(() => {
    if (!preview.circuit || !preview.componentLibrary) return [];
    try {
      return forbiddenPrimitives(
        elaborate(preview.circuit, preview.componentLibrary),
        level.allowed,
      );
    } catch {
      // Mid-keystroke the netlist is often unelaboratable. That is the compile
      // error's story to tell, not this one's.
      return [];
    }
  }, [preview.circuit, preview.componentLibrary, level.allowed]);

  if (forbidden.length === 0 && preview.circuit) {
    lastPermitted.current = { circuit: preview.circuit, library: preview.componentLibrary };
  }
  // Forbidden with a good circuit behind it → keep showing that one. Forbidden
  // with nothing behind it (a draft that arrived already broken) → show
  // nothing, because the only alternative is drawing the banned gate.
  const shown = forbidden.length > 0 ? lastPermitted.current : null;
  const canvasCircuit = shown ? shown.circuit : forbidden.length > 0 ? null : preview.circuit;
  const canvasLibrary = shown
    ? shown.library
    : forbidden.length > 0
      ? null
      : preview.componentLibrary;

  const onSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const verdict = await grade(sandboxRuntime(sandbox), level, source);
      setResult(verdict);
      setCompleteDismissed(false);
      // Submit is a request for a verdict, so show it — hidden, the spec sheet
      // swallowed both the failure message and the whole victory run.
      setSpecOpen(true);
      if (verdict.status === 'pass') {
        // The score, not the source. Nothing reads a passing snapshot yet, and
        // the map only needs to know this level is done and what it cost.
        writeProgress(level.id, { gates: verdict.gates });
        victory.start();
      } else victory.reset();
    } finally {
      setSubmitting(false);
    }
  }, [sandbox, level, source, victory]);

  /** Back to the level as it was handed over. The draft goes with it. */
  const onReset = useCallback(() => {
    if (draftTimer.current) {
      clearTimeout(draftTimer.current);
      draftTimer.current = null;
    }
    pendingDraft.current = null;
    clearDraft(level.id);
    setSource(level.stub);
    setResult(null);
    victory.reset();
  }, [level.id, level.stub, victory]);

  // Surfaced as a Monaco squiggle rather than a panel note: the problem is on
  // a specific line, and that is where someone is looking.
  const diagnostics = useMemo(() => nameDiagnostics(source, level.target), [source, level.target]);

  /**
   * Teach the editor only what this level permits, so a component you have not
   * earned yet does not autocomplete and does not compile. The rule stops being
   * something you discover by breaking it.
   *
   * `permittedFor` comes from the grader rather than a second list here: those are
   * the pieces that carry no logic and never count toward par, which is exactly
   * why they are absent from `allowed`. Filtering on `allowed` alone would leave
   * every level unable to declare a `Switch`.
   */
  const intellisense = useMemo(
    () => ({
      globals: false,
      extraLibs: {
        'file:///simten-globals.d.ts': buildGlobalsFor(permittedFor(level.allowed)),
      },
    }),
    [level.allowed],
  );

  const solved = result?.status === 'pass';
  const next = useMemo(() => nextLevel(level.id), [level.id]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 dark:bg-[#111113]">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        {/* Same brand lockup as apps/web's SiteHeader: mark, then wordmark. */}
        <Link
          to="/"
          aria-label="Simten — home"
          className="flex shrink-0 items-center gap-2 text-foreground no-underline transition-colors hover:text-foreground/80"
        >
          <Logo size={20} />
          <span className="text-sm font-semibold tracking-tight">Simten</span>
        </Link>
        <div className="h-5 w-px bg-border" />
        <span className="shrink-0 text-sm font-semibold text-foreground/80">{level.title}</span>
        {/* The brief is read once and then ignored, so it belongs here rather
            than occupying panel space for the rest of the level. */}
        {/* The tagline, not the brief. This truncates, and a truncated problem
            statement put a half-sentence of instructions in the first thing on
            screen. The full brief is in the spec panel, under "The problem". */}
        <p className="hidden truncate text-xs text-muted-foreground lg:block" title={level.tagline}>
          {level.tagline}
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
          {/* The wordmark also goes back, but that is a convention rather than
              a signpost — this one says where it leads. */}
          <Link
            to="/"
            title="Back to the map"
            aria-label="Back to the map"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs font-medium no-underline"
          >
            <Network className="h-3.5 w-3.5 -rotate-90" />
            Map
          </Link>
          {/* Drafts persist, so the stub is otherwise gone for good — and a
              player who deletes half of a given preamble has no way back to a
              level that compiles. Monaco keeps its undo stack across this, so
              a misclick is one ⌘Z rather than a lost solution. */}
          <button
            type="button"
            onClick={onReset}
            title="Restore this level's starting code"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs font-medium"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
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
                  const next = v ?? '';
                  setSource(next);
                  saveDraft(next);
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
                onMount={(ed) => {
                  const at = givenPreambleEnd(ed.getModel()?.getLinesContent() ?? []);
                  if (at !== null) ed.revealLineNearTop(at, 0);
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
              parse error mid-keystroke must not blank the diagram. A forbidden
              gate is the same class of message, so it lands here too: the
              canvas keeps showing the last circuit that compiled, which is
              what you want while you are still typing. */}
            {preview.compileError && <ErrorDisplay error={preview.compileError} />}
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={55} minSize={20} className="overflow-hidden">
            <CircuitCanvas
              circuit={canvasCircuit}
              componentLibrary={canvasLibrary ?? undefined}
              portValues={preview.portValues}
              theme="dark"
              showControls
              // The diagram has to answer "what is this port called", because
              // the code demands the exact name and nothing else on screen
              // supplies it. Unlabelled circles leave a beginner guessing at
              // `.out` and `.in` with the answer sitting right in front of
              // them. Always on here rather than a toggle: levels are three to
              // six nodes, so there is no clutter to trade against, and someone
              // stuck on a port name will not go hunting for a display option.
              showPortLabels
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
