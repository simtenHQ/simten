/**
 * EditorWorkspace: the full /editor page shell.
 *
 * Combines Monaco code editor, CircuitCanvas, clock controls,
 * Verilog export, MCP connection, and example picker.
 */

'use client';

import type { CircuitIR, MemoryContents } from '@simten/core/internal';
import { CircuitCanvas, ClockControls, useSimulation, WaveformViewer } from '@simten/react';
import {
  CodeEditor,
  type CodeEditorHandle,
  registerSimtenThemes,
  SIMTEN_DARK,
  SIMTEN_LIGHT,
} from '@simten/react/code-editor';
import { Button } from '@simten/shared/primitives/button';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@simten/shared/primitives/resizable';
import { TooltipProvider } from '@simten/shared/primitives/tooltip';
import { Download, Loader2, Share2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { useTheme } from '@/components/ThemeProvider';
import { ErrorDisplay } from '@/features/code-editor';
import { ShareDialog } from '@/features/share/ShareDialog';
import { type MCPRunStart, useMCPConnection } from '@/hooks/useMCPConnection';
import { CATEGORY_COLORS, CATEGORY_LABELS, EXAMPLES, type Example } from '../examples';
import { VerilogImportSheet } from './VerilogImportSheet';

/** Why the panels clip with an inline style: see the panel layout below. */
const CLIP = { overflow: 'hidden' } as const;

/** The canvas's dot grid (React Flow's `Background`: 1px dots every 20px), behind the example picker. */
const EMPTY_CANVAS_DOTS = {
  backgroundImage: 'radial-gradient(circle, var(--embed-dot-color) 0.5px, transparent 1px)',
  backgroundSize: '20px 20px',
} as const;

/** No programs loaded. One object, so clearing twice doesn't reopen the session. */
const NO_MEMORY: Record<string, MemoryContents> = {};

const SCAN_CODES: Record<string, number> = {
  ArrowUp: 0x48,
  ArrowDown: 0x50,
  ArrowLeft: 0x4b,
  ArrowRight: 0x4d,
  Space: 0x39,
  Enter: 0x1c,
  Escape: 0x01,
  KeyA: 0x1e,
  KeyB: 0x30,
  KeyC: 0x2e,
  KeyD: 0x20,
  KeyE: 0x12,
  KeyF: 0x21,
  KeyG: 0x22,
  KeyH: 0x23,
  KeyI: 0x17,
  KeyJ: 0x24,
  KeyK: 0x25,
  KeyL: 0x26,
  KeyM: 0x32,
  KeyN: 0x31,
  KeyO: 0x18,
  KeyP: 0x19,
  KeyQ: 0x10,
  KeyR: 0x13,
  KeyS: 0x1f,
  KeyT: 0x14,
  KeyU: 0x16,
  KeyV: 0x2f,
  KeyW: 0x11,
  KeyX: 0x2d,
  KeyY: 0x15,
  KeyZ: 0x2c,
  Digit0: 0x0b,
  Digit1: 0x02,
  Digit2: 0x03,
  Digit3: 0x04,
  Digit4: 0x05,
  Digit5: 0x06,
  Digit6: 0x07,
  Digit7: 0x08,
  Digit8: 0x09,
  Digit9: 0x0a,
};

function useKeyboardInput(
  circuit: CircuitIR | null,
  onKeyboardInput: (values: Record<string, number>) => void,
) {
  useEffect(() => {
    if (!circuit) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      )
        return;
      const scanCode = SCAN_CODES[e.code];
      if (scanCode == null) return;

      circuit.nodes
        .filter(
          (node) =>
            node.componentRef === 'Input' &&
            (node.label?.toLowerCase().includes('keyboard') ||
              node.id.toLowerCase().includes('keyboard')),
        )
        .forEach((node) => onKeyboardInput({ [node.id]: scanCode }));

      if (e.code.startsWith('Arrow')) e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [circuit, onKeyboardInput]);
}

interface EditorWorkspaceProps {
  theme?: 'light' | 'dark';
  /**
   * Source to pre-load into the editor (e.g. from a shared `/circuit/<encoded>` URL).
   * When set, the editor runs in ephemeral mode (no localStorage read/write) so a
   * shared link doesn't clobber the user's saved work.
   */
  initialSource?: string;
  /**
   * Running as the standalone local MCP viewer (a separate client-only build,
   * not a route on simten.dev). In this mode there's no server, so Share (which
   * POSTs to a server function) is omitted, and the brand links out to the
   * marketing site rather than through the (absent) router.
   */
  standalone?: boolean;
}

export function EditorWorkspace({
  theme = 'light',
  initialSource,
  standalone = false,
}: EditorWorkspaceProps) {
  const { resolvedTheme } = useTheme();

  // Editor source. Typing recompiles 50ms after it stops.
  const [code, setCode] = useState(initialSource ?? '');

  /**
   * Programs loaded into memory nodes on the canvas, by node path. A memory's
   * contents are part of what a session is built from, so a new program (or
   * clearing one) opens a new session from cycle 0, as reloading a program
   * does on real hardware.
   */
  const [memory, setMemory] = useState(NO_MEMORY);

  /**
   * Where show_circuit's `inputs` put the pushed circuit's inputs at power-on:
   * port names and Switch or Input paths, as `set` takes them. Kept until the
   * next push or an edit, so a reset or a new program keeps them.
   */
  const [pushedInputs, setPushedInputs] = useState<Record<string, number> | undefined>();

  // Compiles the source and simulates its last circuit in the sandbox. The
  // canvas draws switches and displays for its ports.
  const simulation = useSimulation({ source: code }, { memory, initialInputs: pushedInputs });
  const { state, actions } = simulation;
  const { compileError } = state;
  const circuit = state.circuit;
  const diagnostics = useMemo(() => (compileError ? [compileError] : []), [compileError]);

  const codeEmpty = code.trim() === '';
  // Don't render the picker during the boot window; the resizable panels and
  // Monaco haven't laid out yet so the picker would render at near-zero width
  // (squished column on the left).
  const [bootDone, setBootDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Verilog export button state. Export used to fail into
  // a bare console.error, which was survivable when the only failure was a throw
  // but not now that it can also succeed with holes in it (see below).
  const [exportStatus, setExportStatus] = useState<
    { kind: 'idle' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  // The waveform panel, opened when the MCP pushes traces. It records this
  // simulation, the same circuit the MCP pushed with them.
  const [waveformOpen, setWaveformOpen] = useState(false);

  // Editor handle for imperative get/set of the Monaco source.
  const editorRef = useRef<CodeEditorHandle>(null);
  // requestId of an in-flight show_circuit render-ack, cleared when the
  // resulting session opens or the compile fails (see the effects below).
  const pendingRenderRef = useRef<string | null>(null);

  // Export to Verilog, in the sandbox, with the compile's own behavior: the
  // circuit the session was opened on.
  const circuitName = state.circuitName;
  const handleExportVerilog = useCallback(async () => {
    if (!circuitName) return;
    try {
      const { verilog, files, unsupported } = await actions.exportVerilog();

      // An export with unmapped primitives is the dangerous case: it parses,
      // it synthesizes, and it does not do what the circuit does. Yosys will
      // happily read it and an equivalence check finds counterexamples. Imported
      // designs hit this routinely (Slice/ZeroExtend/Pmux have no mapping), so
      // downloading it would hand someone a file that looks finished and lies.
      if (unsupported) {
        const names = Object.keys(unsupported);
        const count = Object.values(unsupported).flat().length;
        setExportStatus({
          kind: 'error',
          message: `Can't export: ${count} unsupported ${count === 1 ? 'node' : 'nodes'} (${names.slice(0, 3).join(', ')})`,
        });
        console.error('Verilog export blocked, unsupported primitives:', unsupported);
        return;
      }
      setExportStatus({ kind: 'idle' });

      // Trigger a download for each file produced by the exporter: the main
      // `.v` plus any sidecar `.hex` files referenced by `$readmemh` for
      // large preloaded memories. The Verilog won't compile without the
      // hex files sitting next to it, so we ship them in one go.
      const download = (name: string, contents: string) => {
        const blob = new Blob([contents], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      };

      download(`${circuitName}.v`, verilog);
      for (const [name, contents] of Object.entries(files)) {
        download(name, contents);
      }
    } catch (e) {
      setExportStatus({
        kind: 'error',
        message: e instanceof Error ? e.message.slice(0, 60) : 'Export failed',
      });
      console.error('Verilog export failed:', e);
    }
  }, [actions, circuitName]);

  // ── Share button ──
  // The dialog creates the share link when it opens: always a short link
  // (#368), since the editor only runs on simten.dev where the server function
  // exists. `/circuit/<encoded>` keeps resolving so links from before then live.
  const [shareOpen, setShareOpen] = useState(false);
  const getShareSource = useCallback(() => editorRef.current?.getValue() ?? '', []);

  const showClockControls = state.isSequential;

  // Keyboard scan code input for Input nodes (e.g. keyboard-driven CPU demos)
  useKeyboardInput(circuit, actions.set);

  // A program loaded on an RV32I_InstrMem or DualPortROM node, or cleared
  // (an empty map). Node ids on the canvas are paths in the session.
  const onLoadMemory = useCallback((nodeId: string, data: Map<number, number>) => {
    setMemory((current) => {
      const { [nodeId]: _old, ...rest } = current;
      if (data.size === 0) return rest;
      const contents: MemoryContents = {};
      for (const [address, value] of data) contents[address] = value;
      return { ...rest, [nodeId]: contents };
    });
  }, []);

  // Studio connection (WebSocket to MCP server)
  const { status: mcpStatus, sendRenderResult } = useMCPConnection({
    onTraces: useCallback(() => setWaveformOpen(true), []),
    onSource: useCallback(
      (source: string, requestId: string | undefined, run: MCPRunStart) => {
        pendingRenderRef.current = requestId ?? null;
        // setValue runs the editor's onChange, which clears memory and pushed
        // inputs as for an edit; the push's own run start replaces them after.
        editorRef.current?.setValue(source);
        setMemory(run.memory ?? NO_MEMORY);
        setPushedInputs(run.inputs);
        setTimeout(() => void actions.recompile(), 100);
      },
      [actions],
    ),
    // useMCPConnection keeps its callbacks in a ref, so this reads the
    // latest state without needing a stable identity.
    getCircuitState: () => ({
      cycleCount: state.cycle,
      inputs: {},
      outputs: {},
      isSequential: state.isSequential,
      circuitName: circuit?.name ?? null,
      timestamp: Date.now(),
    }),
  });

  // A show_circuit render request is answered once its session opens, or
  // when its compile or open fails.
  useEffect(() => {
    const reqId = pendingRenderRef.current;
    if (!reqId || !circuit) return;
    pendingRenderRef.current = null;
    sendRenderResult(reqId, { ok: true, circuitName: circuit.name });
  }, [circuit, sendRenderResult]);

  // Keyed on the error object, not its text: every failed compile makes a new
  // one, so a second broken source with the same message is answered too.
  const openError = state.error;
  useEffect(() => {
    const reqId = pendingRenderRef.current;
    const failure = compileError?.message ?? openError;
    if (!reqId || !failure) return;
    pendingRenderRef.current = null;
    sendRenderResult(reqId, { ok: false, error: failure });
  }, [compileError, openError, sendRenderResult]);

  // Load an example into the editor
  const loadExample = useCallback(
    (example: Example) => {
      editorRef.current?.setValue(example.code);
      setTimeout(() => void actions.recompile(), 100);
    },
    [actions],
  );

  // First-run hint: pulse the Run button so a new user knows to press it to
  // start the clock. The clock bar only renders for sequential circuits, so a
  // combinational first circuit (e.g. a half adder) never shows it and never
  // burns the hint. Default to "seen" (no pulse) for SSR, then read the flag on
  // the client; mark it seen the first time the user actually runs.
  const RUN_PULSE_KEY = 'simten:seen-run-pulse';
  const [runPulseSeen, setRunPulseSeen] = useState(true);
  useEffect(() => {
    if (localStorage.getItem(RUN_PULSE_KEY) !== '1') setRunPulseSeen(false);
  }, []);
  useEffect(() => {
    if (!state.isRunning || runPulseSeen) return;
    setRunPulseSeen(true);
    try {
      localStorage.setItem(RUN_PULSE_KEY, '1');
    } catch {
      /* private mode */
    }
  }, [state.isRunning, runPulseSeen]);

  // Empty state with example picker
  const renderEmptyState = useCallback(
    () => (
      <div className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto rounded-xl border border-gray-200 dark:border-[#2a2a2e] bg-white dark:bg-[#1a1a1e] p-6 shadow-lg max-w-2xl w-full">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Load an example
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Pick a circuit to explore, or write your own on the left.
          </p>
          <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                onClick={() => loadExample(ex)}
                className="w-full text-left cursor-pointer rounded-lg border border-gray-200 dark:border-[#2a2a2e] hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-[#161618] hover:bg-blue-50 dark:hover:bg-blue-950/20 px-4 py-2.5 transition-colors group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {ex.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {ex.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[ex.category]}`}
                    >
                      {CATEGORY_LABELS[ex.category]}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    ),
    [loadExample],
  );

  // With no code there's nothing to compile, so the example picker stands in.
  const canvas =
    codeEmpty && !state.ready ? (
      <div className="relative h-full bg-[var(--embed-bg-primary)]" style={EMPTY_CANVAS_DOTS}>
        {bootDone && renderEmptyState()}
      </div>
    ) : (
      <CircuitCanvas simulation={simulation} theme={theme} onLoadMemory={onLoadMemory} />
    );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 dark:bg-[#111113]">
        {/* SiteHeader (brand on left) + editor controls on the right */}
        <SiteHeader
          sticky={false}
          brandHref={standalone ? 'https://simten.dev' : undefined}
          right={
            <div className="flex flex-1 items-center gap-2 justify-end pl-3">
              <span className="text-sm font-semibold text-foreground/80 mr-auto pl-2 border-l border-border">
                Editor
              </span>

              {!standalone && (
                <>
                  <div className="h-5 w-px bg-border" />

                  <Button
                    onClick={() => setShareOpen(true)}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    title="Share a link to this circuit, or embed it in another site"
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs">Share</span>
                  </Button>
                  <ShareDialog
                    open={shareOpen}
                    onOpenChange={setShareOpen}
                    getSource={getShareSource}
                  />
                </>
              )}

              <VerilogImportSheet
                onImport={(source) => {
                  editorRef.current?.setValue(source);
                  setTimeout(() => void actions.recompile(), 100);
                }}
              />

              <Button
                onClick={handleExportVerilog}
                variant="outline"
                size="sm"
                className="gap-2"
                title={
                  exportStatus.kind === 'error'
                    ? exportStatus.message
                    : 'Export circuit to Verilog (.v)'
                }
                disabled={!circuit}
              >
                <Download className="h-4 w-4" />
                <span
                  className={`hidden sm:inline text-xs${exportStatus.kind === 'error' ? ' text-destructive' : ''}`}
                >
                  {exportStatus.kind === 'error' ? "Can't export" : 'Verilog'}
                </span>
              </Button>

              {/* Sandbox indicator: when MCP-linked, the file is the source of truth */}
              {mcpStatus === 'connected' && (
                <span
                  className="hidden md:inline text-[11px] leading-tight text-muted-foreground pl-2"
                  title="This editor is a sandbox view. The file Claude edits (from the terminal) is the source of truth; edits here are local experiments; ask Claude to save them, or use Share."
                >
                  Sandbox · file is source of truth
                </span>
              )}

              {/* Studio Connection Status */}
              {mcpStatus === 'connected' && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>Connected</span>
                </div>
              )}
              {mcpStatus === 'reconnecting' && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2">
                  <div className="h-2 w-2 rounded-full bg-amber-400" />
                  <span>Reconnecting...</span>
                </div>
              )}
            </div>
          }
        />

        {/* Main Content Area - Unified Workspace */}
        <div className="relative flex flex-1 overflow-hidden">
          {!bootDone && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {/*
              Every panel here clips with `style`, not a class. react-resizable-
              panels wraps each panel's content in a div whose inline style says
              `overflow: auto`, which a class cannot beat. Left scrollable, that
              div flashed scrollbars whenever a pane shrank: Monaco and the canvas
              relayout a frame after their box changes size, and for that frame
              they overflow it.
            */}
          <ResizablePanelGroup orientation="horizontal">
            {/* Left: Code Editor */}
            <ResizablePanel defaultSize={40} minSize={20} style={CLIP}>
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1">
                  <CodeEditor
                    ref={editorRef}
                    value={code}
                    onChange={(value) => {
                      setCode(value ?? '');
                      // An edit starts a new run of the new circuit, without
                      // the programs loaded into the old one or the inputs a
                      // push set on it.
                      setMemory(NO_MEMORY);
                      setPushedInputs(undefined);
                    }}
                    theme={resolvedTheme === 'dark' ? SIMTEN_DARK : SIMTEN_LIGHT}
                    diagnostics={diagnostics}
                    beforeMount={(m) => registerSimtenThemes(m, { lightBackground: '#faf9f4' })}
                    options={{ 'semanticHighlighting.enabled': true }}
                  />
                </div>
                {diagnostics.length > 0 && <ErrorDisplay errors={diagnostics} />}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            {/* Right: Circuit Canvas, optionally split with Waveform below */}
            <ResizablePanel defaultSize={60} minSize={30} style={CLIP}>
              {waveformOpen ? (
                <ResizablePanelGroup orientation="vertical">
                  <ResizablePanel defaultSize={65} minSize={20} style={CLIP}>
                    {canvas}
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    defaultSize={35}
                    minSize={10}
                    className="flex flex-col"
                    style={CLIP}
                  >
                    <WaveformViewer
                      simulation={simulation}
                      onClose={() => setWaveformOpen(false)}
                    />
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                canvas
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Conditional Bottom Bar: Clock Controls (only for sequential circuits) */}
        {bootDone && showClockControls && (
          <div className="flex items-center gap-4 border-t border-border bg-card/95 px-6 py-1.5">
            <ClockControls
              simulation={simulation}
              showSpeed
              showScrubber
              chromeless
              pulseRun={!runPulseSeen && !state.isRunning}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
