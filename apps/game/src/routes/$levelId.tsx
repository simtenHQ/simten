/**
 * A level: brief, code and circuit side by side, laid out like simten.dev/circuit.
 */

import { type CircuitIR, elaborate } from '@simten/core/internal';
import { CircuitCanvas, ClockControls } from '@simten/react/canvas';
import { ErrorDisplay } from '@simten/react/embed';
import {
  buildGlobalsFor,
  preloadMonaco,
  registerSimtenThemes,
  SIMTEN_DARK,
  SimtenCodeEditor,
} from '@simten/react/monaco';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  usePanelRef,
} from '@simten/react/primitives/resizable';
import { useSandboxClient, useSimulation } from '@simten/react/sandbox';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { Network, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DesktopOnly, useIsDesktop } from '../components/DesktopOnly';
import { GitHubLink } from '../components/GitHubLink';
import { HeaderBar } from '../components/HeaderBar';
import { LevelComplete } from '../components/LevelComplete';
import { LevelIntro } from '../components/LevelIntro';
import { MobileNotice } from '../components/MobileNotice';
import { useOnboardingTour } from '../components/OnboardingTour';
import { SpecPanel } from '../components/SpecPanel';
import ThemeToggle from '../components/ThemeToggle';
import { forbiddenPrimitives, grade, permittedFor } from '../game/grade';
import { nameDiagnostics } from '../game/level-name';
import { LEVELS_BY_ID, nextLevel } from '../game/levels';
import { isSkeleton } from '../game/parts';
import { sandboxRuntime } from '../game/runtime';
import {
  clearDraft,
  isOnboarded,
  markIntroSeen,
  readDrafts,
  readSeenIntros,
  writeDraft,
  writeProgress,
} from '../game/storage';
import type { GradeResult, Level } from '../game/types';
import { useVictoryRun } from '../game/useVictoryRun';
import { SITE_URL } from './__root';

/** Pause after typing before the draft is saved. Flushed on unmount anyway. */
const DRAFT_DEBOUNCE_MS = 400;

const CLOCK_BAR_PX = 40;

/** Inline because react-resizable-panels sets `overflow: auto` inline. See the layout. */
const CLIP = { overflow: 'hidden' } as const;

/** After this, show whatever has loaded rather than keep waiting. */
const REVEAL_TIMEOUT_MS = 2500;

const fadeIn = (shown: boolean) =>
  `transition-opacity duration-150 ${shown ? 'opacity-100' : 'opacity-0'}`;

/**
 * Calls `done` once Monaco has painted in colour. Before the tokenizer loads,
 * every token is `mtk1`; every stub opens with a comment, so any other class
 * means the colours are in.
 */
function onFirstColour(dom: HTMLElement | null, done: () => void): () => void {
  if (!dom) {
    done();
    return () => {};
  }
  const coloured = () => dom.querySelector('.view-lines span[class^="mtk"]:not(.mtk1)') !== null;
  if (coloured()) {
    done();
    return () => {};
  }
  const observer = new MutationObserver(() => {
    if (!coloured()) return;
    observer.disconnect();
    done();
  });
  observer.observe(dom, { childList: true, subtree: true, attributes: true });
  return () => observer.disconnect();
}

export const Route = createFileRoute('/$levelId')({
  staticData: { skipDefaultChrome: true },
  loader: ({ params }) => {
    const level = LEVELS_BY_ID.get(params.levelId);
    if (!level) throw notFound();
    // Start Monaco downloading before the editor renders.
    preloadMonaco();
    return { level };
  },
  // Per-level title and share card. `noindex` because levels only make sense
  // in order; the map is the page that should rank.
  head: ({ loaderData }) => {
    const level = loaderData?.level;
    if (!level) return {};
    const title = `${level.title} | Simten`;
    const url = `${SITE_URL}/${level.id}`;
    return {
      meta: [
        { title },
        { name: 'robots', content: 'noindex, follow' },
        { name: 'description', content: level.tagline },
        { property: 'og:title', content: title },
        { property: 'og:description', content: level.tagline },
        { property: 'og:url', content: url },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: level.tagline },
      ],
      // No canonical: it contradicts `noindex`.
      // Monaco loads from jsDelivr as both classic scripts and modules.
      links: [
        { rel: 'preconnect', href: 'https://cdn.jsdelivr.net' },
        { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossOrigin: 'anonymous' },
      ],
    };
  },
  component: PlayLevelRoute,
  errorComponent: LevelError,
});

/**
 * The line the player's own work starts on, or `null` to open at the top.
 * Skips past given parts (the full adder's half adder) but not past
 * instructions in comments.
 */
export function givenPreambleEnd(lines: string[]): number | null {
  const target = lines.findIndex((l) => l.startsWith('export default circuit('));
  if (target <= 0) return null;
  if (!lines.slice(0, target).some((l) => l.includes('circuit('))) return null;
  // A part left for the player to finish sits above the target; open on that.
  for (let start = 0; start < target; start++) {
    if (!/^const \w+ = circuit\(/.test(lines[start])) continue;
    const end = lines.findIndex((l, i) => i > start && l.startsWith('});'));
    if (isSkeleton(lines.slice(start, end + 1).join('\n'))) return start + 1;
  }
  return target + 1;
}

function PlayLevelRoute() {
  const { level } = Route.useLoaderData();
  // Phones never mount the editor. The CSS gate handles what is visible.
  const isDesktop = useIsDesktop();
  return (
    <DesktopOnly fallback={<MobileNotice />}>
      {/* Keyed so each level starts fresh; TanStack otherwise reuses the instance. */}
      {isDesktop ? <PlayLevel key={level.id} level={level} /> : null}
    </DesktopOnly>
  );
}

/** Replaces TanStack's "Something went wrong!", which Google indexed. */
function LevelError() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold tracking-tight">This level did not load</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        Reloading usually fixes it. Your work is saved in this browser, so nothing is lost.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          Reload
        </button>
        <Link
          to="/"
          className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          See the map
        </Link>
      </div>
    </div>
  );
}

function PlayLevel({ level }: { level: Level }) {
  // The grader compiles and opens its own sessions; it doesn't simulate the preview.
  const sandbox = useSandboxClient();

  // Safe to read storage during render: Monaco never server-renders `source`.
  const [source, setSource] = useState(() => readDrafts()[level.id] ?? level.stub);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [specOpen, setSpecOpen] = useState(true);
  const specPanel = usePanelRef();
  useEffect(() => {
    const panel = specPanel.current;
    if (!panel) return;
    if (specOpen && panel.isCollapsed()) panel.expand();
    if (!specOpen && !panel.isCollapsed()) panel.collapse();
  }, [specOpen, specPanel]);
  const [completeDismissed, setCompleteDismissed] = useState(false);

  // Opened in an effect, not during render, to avoid a hydration mismatch.
  const [introOpen, setIntroOpen] = useState(false);

  // Bumped by "What is this?" and by arriving on `#tour` to replay the tour.
  const [tourReplays, setTourReplays] = useState(0);

  // The editor and canvas each stay hidden until finished (coloured code, first
  // simulated values), then fade in. These only ever go false → true.
  const [editorReady, setEditorReady] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), REVEAL_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const stopWatchingColour = useRef<() => void>(() => {});
  useEffect(() => () => stopWatchingColour.current(), []);
  useEffect(() => {
    if (window.location.hash !== '#tour') return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setTourReplays((n) => n + 1);
  }, []);
  const editorShown = editorReady || timedOut;
  const canvasShown = canvasReady || timedOut;
  const revealed = editorShown && canvasShown;
  const touring = useOnboardingTour(revealed && !introOpen, tourReplays);

  // The level intro waits until the tour is over.
  useEffect(() => {
    if (!revealed || touring || !isOnboarded()) return;
    if (level.intro && !readSeenIntros().includes(level.id)) setIntroOpen(true);
  }, [level.id, level.intro, revealed, touring]);

  const dismissIntro = useCallback(() => {
    markIntroSeen(level.id);
    setIntroOpen(false);
  }, [level.id]);

  // Saved from the change event, not an effect on `source`, so mounting never
  // writes the stub over a real draft.
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

  // Flush a pending draft on leave, e.g. clicking "Map" straight after typing.
  useEffect(
    () => () => {
      if (!draftTimer.current) return;
      clearTimeout(draftTimer.current);
      if (pendingDraft.current !== null) writeDraft(level.id, pendingDraft.current);
    },
    [level.id],
  );

  // Preview the level's target circuit, not a helper defined after it. Falls
  // back to the last circuit so a misnamed target still draws.
  const select = useCallback(
    (circuits: CircuitIR[]) =>
      circuits.find((c) => c.name === level.target) ?? circuits[circuits.length - 1],
    [level.target],
  );

  // The harness adds clickable switches and LEDs for the circuit's ports.
  const preview = useSimulation({ source, circuit: select }, { harness: true });
  const { state, history, actions } = preview;
  // A compile error, or the session failing to open.
  const previewError = preview.compileError?.message ?? state.error;

  // A compile error counts as finished too.
  const simulated = (state.portValues?.size ?? 0) > 0 || previewError !== null;
  useEffect(() => {
    if (simulated) setCanvasReady(true);
  }, [simulated]);

  const victory = useVictoryRun(level.vectors, actions.setInput, actions.tick);

  // The sandbox runs banned gates anyway, so the canvas keeps showing the last
  // circuit without one. Same check as the grader, so the two never disagree.
  const lastPermitted = useRef<{
    circuit: CircuitIR | null;
    definitions: typeof state.definitions;
  } | null>(null);

  const forbidden = useMemo(() => {
    if (!state.circuit || !state.definitions) return [];
    try {
      return forbiddenPrimitives(elaborate(state.circuit, state.definitions), level.allowed);
    } catch {
      // Half-typed netlists often fail to elaborate; the compile error covers it.
      return [];
    }
  }, [state.circuit, state.definitions, level.allowed]);

  if (forbidden.length === 0 && state.circuit) {
    lastPermitted.current = { circuit: state.circuit, definitions: state.definitions };
  }
  // With no earlier good circuit, show nothing rather than the banned gate.
  const shown = forbidden.length > 0 ? lastPermitted.current : null;
  const canvasCircuit = shown ? shown.circuit : forbidden.length > 0 ? null : state.circuit;
  const canvasDefinitions = shown
    ? shown.definitions
    : forbidden.length > 0
      ? null
      : state.definitions;

  const onSubmit = useCallback(async () => {
    // Null only before the sandbox has mounted.
    if (!sandbox) return;
    setSubmitting(true);
    try {
      const verdict = await grade(sandboxRuntime(sandbox), level, source);
      setResult(verdict);
      setCompleteDismissed(false);
      // The verdict shows in the spec panel.
      setSpecOpen(true);
      if (verdict.status === 'pass') {
        writeProgress(level.id, { gates: verdict.gates });
        victory.start();
      } else victory.reset();
    } finally {
      setSubmitting(false);
    }
  }, [sandbox, level, source, victory]);

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

  const diagnostics = useMemo(() => nameDiagnostics(source, level.target), [source, level.target]);

  // Autocomplete only what this level allows. `permittedFor` adds the parts
  // that are always free, like `Switch`.
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
      <HeaderBar linkHome>
        <div className="h-5 w-px bg-border" />
        <span className="shrink-0 text-sm font-semibold text-foreground/80">{level.title}</span>
        {/* The tagline, since this truncates. The full brief is in the spec panel. */}
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
          <button
            type="button"
            onClick={() => setTourReplays((n) => n + 1)}
            className="whitespace-nowrap px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            What is this?
          </button>
          <Link
            to="/"
            title="Back to the map"
            aria-label="Back to the map"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs font-medium no-underline"
          >
            <Network className="h-3.5 w-3.5 -rotate-90" />
            Map
          </Link>
          {/* Monaco keeps its undo stack, so a misclick is one ⌘Z. */}
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
            // Fixed width so the label change doesn't shift the buttons beside it.
            className="min-w-[5.5rem] whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs font-medium"
          >
            {specOpen ? 'Hide spec' : 'Show spec'}
          </button>
          <button
            type="button"
            data-tour="submit"
            onClick={onSubmit}
            disabled={submitting}
            className="whitespace-nowrap rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? 'Checking…' : 'Submit'}
          </button>
          <GitHubLink />
          <ThemeToggle />
        </div>
      </HeaderBar>

      <div className="min-h-0 flex-1">
        {/* Panels clip via `style={CLIP}`: the library's inline `overflow: auto`
            flashed scrollbars while Monaco and the canvas caught up on resize. */}
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel minSize="120px" style={CLIP}>
            <ResizablePanelGroup>
              <ResizablePanel defaultSize={45} minSize={20} className="flex flex-col" style={CLIP}>
                <div data-tour="editor" className={`min-h-0 flex-1 ${fadeIn(editorShown)}`}>
                  <SimtenCodeEditor
                    value={source}
                    onChange={(v) => {
                      const next = v ?? '';
                      setSource(next);
                      saveDraft(next);
                      // An edit invalidates the verdict.
                      if (result) {
                        setResult(null);
                        victory.reset();
                      }
                    }}
                    diagnostics={diagnostics}
                    intellisense={intellisense}
                    onMount={(ed) => {
                      stopWatchingColour.current = onFirstColour(ed.getDomNode(), () =>
                        setEditorReady(true),
                      );
                      const at = givenPreambleEnd(ed.getModel()?.getLinesContent() ?? []);
                      const reveal = () => {
                        if (at !== null) ed.revealLineNearTop(at, 0);
                      };
                      // Fold the given parts (`#region`). Monaco finds regions
                      // after mount, so wait for the first decorations pass.
                      const fold = ed.getAction('editor.foldAllMarkerRegions');
                      const folds = ed.getModel()?.getValue().includes('// #region') ?? false;
                      if (!fold || !folds) {
                        reveal();
                        return;
                      }
                      let done = false;
                      const run = () => {
                        if (done) return;
                        done = true;
                        listener.dispose();
                        void fold.run();
                      };
                      const listener = ed.onDidChangeModelDecorations(run);
                      setTimeout(run, 400);
                    }}
                    beforeMount={registerSimtenThemes}
                    theme={SIMTEN_DARK}
                  />
                </div>
                {/* Errors go here, not over the canvas, so the diagram survives typos. */}
                {previewError && <ErrorDisplay error={previewError} />}
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={55} minSize={20} style={CLIP}>
                <div data-tour="canvas" className={`h-full ${fadeIn(canvasShown)}`}>
                  <CircuitCanvas
                    circuit={canvasCircuit}
                    definitions={canvasDefinitions ?? undefined}
                    portValues={state.portValues}
                    simulation={preview}
                    showControls
                    // The default only re-lays out when nodes change, not wires.
                    autoLayout
                    onToggleNode={actions.toggleNode}
                    onSetNodeValue={actions.setInput}
                    renderEmptyState={() => (
                      <div className="grid h-full place-items-center text-sm text-muted-foreground">
                        Your circuit appears here as you write it.
                      </div>
                    )}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            panelRef={specPanel}
            defaultSize="170px"
            minSize="96px"
            maxSize="50%"
            collapsible
            groupResizeBehavior="preserve-pixel-size"
            // Dragging it shut keeps the header button's label in sync.
            onResize={(size) => setSpecOpen(size.inPixels > 0)}
            style={CLIP}
          >
            <section aria-label="Level spec" className="h-full bg-background">
              <SpecPanel
                level={level}
                result={result}
                activeRow={victory.active}
                provenRows={victory.proven}
                checking={submitting || (result?.status === 'pass' && !victory.complete)}
              />
            </section>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Keyed off the circuit on screen, not the level, so an early flip-flop
          gets controls and a blank sequential stub doesn't. */}
      {state.isSequential && (
        <div
          className="flex shrink-0 items-center border-t border-border bg-card/95 px-3"
          style={{ height: CLOCK_BAR_PX }}
        >
          <ClockControls
            cycle={state.cycle}
            historyLength={history.length}
            historyIndex={history.index}
            isRunning={state.isRunning}
            isViewingPast={history.isViewingPast}
            speed={state.speed}
            onStep={() => void actions.tick()}
            onRun={() => void actions.run()}
            onPause={() => void actions.pause()}
            onReset={() => void actions.reset()}
            onStepBack={() => void actions.stepBack()}
            onStepForward={() => void actions.stepForward()}
            onSeek={(i) => void actions.seek(i)}
            onSpeedChange={actions.setSpeed}
            showScrubber={history.length > 1}
            chromeless
          />
        </div>
      )}

      <LevelIntro level={level} open={introOpen} onDismiss={dismissIntro} />

      {result?.status === 'pass' && (
        <LevelComplete
          // Waits for the victory run to finish.
          open={victory.complete && !completeDismissed}
          onOpenChange={(o) => setCompleteDismissed(!o)}
          level={level}
          next={next}
        />
      )}
    </div>
  );
}
