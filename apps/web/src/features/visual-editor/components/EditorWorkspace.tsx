/**
 * EditorWorkspace — the full /editor page shell.
 *
 * Combines Monaco code editor, CircuitCanvas, clock controls,
 * Verilog export, MCP connection, and example picker.
 */

'use client';

import { exportVerilog } from '@simten/core/verilog';
import { builtFromIR, useCircuitCompiler, useCircuitSimulator } from '@simten/embed';
import { CircuitCanvas } from '@simten/ui/canvas';
import { ClockControls, ReactFlowProvider, SignalOutputPanel } from '@simten/ui/editor/components';

import {
  useCircuitLibraryStore,
  useCircuitPreviewStore,
  useCircuitStore,
} from '@simten/ui/editor/stores';
import type { Circuit } from '@simten/ui/editor/types';
import {
  registerSimtenThemes,
  SIMTEN_DARK,
  SIMTEN_LIGHT,
  SimtenCodeEditor,
  type SimtenCodeEditorHandle,
} from '@simten/ui/monaco';
import { encodeSourceForUrl, shouldUseShortLink } from '@simten/ui/share';
import { Download, Loader2, Share2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorDisplay } from '@/features/code-editor';

/** Check if a circuit name is an auto-generated harness (autoHarness appends 'Demo') */
function isHarnessName(name: string): boolean {
  return name.endsWith('Demo') || name.endsWith('Harness');
}

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@simten/ui/primitives/resizable';
import { WaveformViewer } from '@simten/ui/waveform';
import { useMCPConnection } from '@/hooks/useMCPConnection';
import { CATEGORY_COLORS, CATEGORY_LABELS, EXAMPLES, type Example } from '../examples';
import { VerilogImportSheet } from './VerilogImportSheet';

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
  circuit: Circuit | null,
  onKeyboardInput: (nodeId: string, scanCode: number) => void,
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
        .forEach((node) => onKeyboardInput(node.id, scanCode));

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
   * not a route on simten.dev). In this mode there's no server, so Share — which
   * POSTs to a server function — is omitted, and the brand links out to the
   * marketing site rather than through the (absent) router.
   */
  standalone?: boolean;
}

export function EditorWorkspace({
  theme = 'light',
  initialSource,
  standalone = false,
}: EditorWorkspaceProps) {
  const setCompiledCircuits = useCircuitPreviewStore((state) => state.setCompiledCircuits);
  const circuit = useCircuitStore((state) => state.circuit);
  const { resolvedTheme } = useTheme();

  // Editor source — lifted here from the (now-deleted) TSEditor so the compile
  // hook and the store-wiring effects can read it.
  const [code, setCode] = useState(initialSource ?? '');
  const codeRef = useRef(code);
  codeRef.current = code;

  // Compile mechanics live in @simten/embed; we own only what to do with the
  // result (the store-wiring effects below). 'editor-main' slot + 500ms debounce
  // preserve the previous TSEditor behaviour.
  const compiler = useCircuitCompiler(code, {
    autoCompile: true,
    debounceMs: 500,
    slot: 'editor-main',
  });

  // Track whether the editor source is effectively empty so we only show the
  // "Load an example" picker when the user has actually cleared their code —
  // not during the boot window between mount and first compile.
  const [codeEmpty, setCodeEmpty] = useState((initialSource ?? '').trim() === '');
  // Don't render the picker during the boot window — the resizable panels and
  // Monaco haven't laid out yet so the picker would render at near-zero width
  // (squished column on the left).
  const [bootDone, setBootDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Build a BuiltCircuit-like object from the compile result for useCircuitSimulator.
  // When the editor's source was compiled via sandbox.compile(), evals are already
  // registered in the sandbox — no need to transfer them via evalSources.
  const editorBuiltCircuit = useMemo<import('@simten/core/circuit').BuiltCircuit | null>(() => {
    if (!compiler.result || !circuit) return null;
    return builtFromIR(circuit, [...compiler.result.libraryCircuits, ...compiler.result.circuits]);
  }, [compiler.result, circuit]);

  // Share button state
  const [shareStatus, setShareStatus] = useState<
    { kind: 'idle' } | { kind: 'sharing' } | { kind: 'copied' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  // Drawer state
  const [waveformData, setWaveformData] = useState<{
    vcd: string;
    circuit: string;
    ticks: number;
    steadyStateAt?: number;
  } | null>(null);

  // Editor handle for imperative get/set of the Monaco source.
  const editorRef = useRef<SimtenCodeEditorHandle>(null);
  // requestId of an in-flight show_circuit render-ack (set in onSource, cleared
  // when the resulting compile succeeds/fails — see handleCompile / handleCompileError).
  const pendingRenderRef = useRef<string | null>(null);

  // Track whether we've loaded content so we can skip the first MCP cache replay
  const hasLoadedContentRef = useRef(false);

  // Export to Verilog — uses library store
  const handleExportVerilog = useCallback(() => {
    const lib = useCircuitLibraryStore.getState();
    let currentCircuit = useCircuitStore.getState().circuit;
    if (!currentCircuit || !lib.library) return;

    // If this is an auto-generated harness, export the real circuit instead
    if (isHarnessName(currentCircuit.name)) {
      const baseName = currentCircuit.name.replace(/(Demo|Harness)$/, '');
      const realCircuit = lib.resolveCircuit(baseName);
      if (realCircuit) currentCircuit = realCircuit;
    }

    try {
      const { verilog, files } = exportVerilog(currentCircuit, lib);

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

      download(`${currentCircuit.name}.v`, verilog);
      for (const [name, contents] of Object.entries(files)) {
        download(name, contents);
      }
    } catch (e) {
      console.error('Verilog export failed:', e);
    }
  }, []);

  // ── Share button ──
  const handleShare = useCallback(async () => {
    const source = editorRef.current?.getValue() ?? '';
    if (!source.trim()) {
      setShareStatus({ kind: 'error', message: 'Nothing to share' });
      setTimeout(() => setShareStatus({ kind: 'idle' }), 2000);
      return;
    }
    const encoded = encodeSourceForUrl(source);
    let url: string;
    if (!shouldUseShortLink(encoded)) {
      url = `${window.location.origin}/circuit/${encoded}`;
    } else {
      setShareStatus({ kind: 'sharing' });
      try {
        // Dynamic import keeps the `cloudflare:workers`-backed server fn out of
        // the standalone client-only viewer build's module graph.
        const { shareCircuit } = await import('@/features/share/server');
        const { hash } = await shareCircuit({ data: { source } });
        url = `${window.location.origin}/circuit/s/${hash}`;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sharing failed';
        setShareStatus({ kind: 'error', message });
        setTimeout(() => setShareStatus({ kind: 'idle' }), 2500);
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus({ kind: 'copied' });
      setTimeout(() => setShareStatus({ kind: 'idle' }), 2000);
    } catch {
      setShareStatus({ kind: 'error', message: 'Clipboard blocked' });
      setTimeout(() => setShareStatus({ kind: 'idle' }), 2500);
    }
  }, []);

  // ── Simulation — uses same sandbox-backed hook as embeds ──
  // The editor already compiled source via sandbox.compile(), so evals exist in the sandbox.
  // useCircuitSimulator sends the harnessed Circuit IR to the sandbox via compileIR.
  // Cast needed because useCircuitSimulator requires a BuiltCircuit; we always
  // provide one once the editor has compiled (see editorBuiltCircuit guard).
  const sim = useCircuitSimulator(editorBuiltCircuit, { autoHarness: false });
  const showClockControls = sim.isSequential;

  // Keyboard scan code input for Input nodes (e.g. keyboard-driven CPU demos)
  useKeyboardInput(
    circuit,
    useCallback(
      (nodeId: string, scanCode: number) => {
        sim.setNode(nodeId, scanCode);
      },
      [sim.setNode],
    ),
  );

  // Build library interface for CircuitCanvas from store
  const resolveCircuit = useCircuitLibraryStore((s) => s.resolveCircuit);
  const getAllPrimitiveNames = useCircuitLibraryStore((s) => s.getAllPrimitiveNames);
  const componentLibrary = useMemo(
    () => ({
      resolveCircuit,
      getAllPrimitiveNames,
    }),
    [resolveCircuit, getAllPrimitiveNames],
  );

  // Keep sim state in ref for MCP callbacks and stable canvas callbacks
  const simRef = useRef(sim);
  simRef.current = sim;

  // Stable canvas callbacks — read sim via ref so they never change reference.
  // Without this, inline lambdas here cause projectedNodes to recompute on every
  // sim tick (portValues changes → EditorWorkspace re-renders → new fn refs →
  // projectedNodes recomputes → setNodes → ReactFlow churns).
  const onToggleNode = useCallback((nodeId: string) => {
    const pv = simRef.current.portValues;
    const outKey = `${nodeId}.out`;
    const currentValue = pv?.get(outKey);
    simRef.current.setNode(nodeId, !currentValue);
    simRef.current.runCombinational();
  }, []);
  const onSetNodeValue = useCallback((nodeId: string, value: number) => {
    simRef.current.setNode(nodeId, value);
    simRef.current.runCombinational();
  }, []);
  const onLoadMemory = useCallback((nodeId: string, memData: Map<number, number>) => {
    simRef.current.setNodeValue(nodeId, memData);
  }, []);

  // Studio connection (WebSocket to MCP server)
  const { status: mcpStatus, sendRenderResult } = useMCPConnection({
    onTraces: useCallback((data: unknown) => {
      const payload = data as {
        vcd: string;
        circuit: string;
        ticks: number;
        steadyStateAt?: number;
      };
      if (payload?.vcd) setWaveformData(payload);
    }, []),
    onSource: useCallback(
      (source: string, requestId?: string) => {
        pendingRenderRef.current = requestId ?? null;
        editorRef.current?.setValue(source);
        setTimeout(() => void compiler.compile(), 100);
      },
      [compiler.compile],
    ),
    getCircuitState: useCallback(() => {
      const currentCircuit = useCircuitStore.getState().circuit;
      const sim = simRef.current;
      return {
        cycleCount: sim.cycleCount,
        inputs: {},
        outputs: {},
        isSequential: sim.isSequential,
        circuitName: currentCircuit?.name ?? null,
        timestamp: Date.now(),
      };
    }, []),
  });

  // On each successful compile, push the result into the selection stores. Set
  // the library FIRST — applyToCanvas fires inside setCompiledCircuits and needs
  // the full library (including user circuits) before adding harness components.
  // Also acknowledges an in-flight show_circuit render request (success).
  useEffect(() => {
    const result = compiler.result;
    if (!result) return;
    if (compiler.library) {
      useCircuitLibraryStore.getState().setLibrary(compiler.library);
    }
    setCompiledCircuits(result.circuits, codeRef.current);
    if (pendingRenderRef.current) {
      const reqId = pendingRenderRef.current;
      pendingRenderRef.current = null;
      const name =
        useCircuitStore.getState().circuit?.name ??
        result.circuits[result.circuits.length - 1]?.name ??
        null;
      sendRenderResult(reqId, { ok: true, circuitName: name });
    }
  }, [compiler.result, compiler.library, setCompiledCircuits, sendRenderResult]);

  // On a compile failure, acknowledge an in-flight show_circuit render request.
  useEffect(() => {
    if (compiler.diagnostics.length === 0) return;
    if (pendingRenderRef.current) {
      const reqId = pendingRenderRef.current;
      pendingRenderRef.current = null;
      sendRenderResult(reqId, { ok: false, error: compiler.diagnostics[0].message });
    }
  }, [compiler.diagnostics, sendRenderResult]);

  // Load an example into the editor
  const loadExample = useCallback(
    (example: Example) => {
      editorRef.current?.setValue(example.code);
      hasLoadedContentRef.current = true;
      setTimeout(() => void compiler.compile(), 100);
    },
    [compiler.compile],
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
  const markRunPulseSeen = useCallback(() => {
    setRunPulseSeen(true);
    try {
      localStorage.setItem(RUN_PULSE_KEY, '1');
    } catch {
      /* private mode */
    }
  }, []);

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

  return (
    <ReactFlowProvider>
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
                      onClick={handleShare}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      title="Copy a shareable link to this circuit"
                      disabled={shareStatus.kind === 'sharing'}
                    >
                      <Share2 className="h-4 w-4" />
                      <span className="hidden sm:inline text-xs">
                        {shareStatus.kind === 'sharing'
                          ? 'Sharing…'
                          : shareStatus.kind === 'copied'
                            ? 'Copied!'
                            : shareStatus.kind === 'error'
                              ? shareStatus.message
                              : 'Share'}
                      </span>
                    </Button>
                  </>
                )}

                <VerilogImportSheet
                  onImport={(source) => {
                    editorRef.current?.setValue(source);
                    hasLoadedContentRef.current = true;
                    setTimeout(() => void compiler.compile(), 100);
                  }}
                />

                <Button
                  onClick={handleExportVerilog}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  title="Export circuit to Verilog (.v)"
                  disabled={!circuit}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">Verilog</span>
                </Button>

                {/* Sandbox indicator — when MCP-linked, the file is the source of truth */}
                {mcpStatus === 'connected' && (
                  <span
                    className="hidden md:inline text-[11px] leading-tight text-muted-foreground pl-2"
                    title="This editor is a sandbox view. The file Claude edits (from the terminal) is the source of truth; edits here are local experiments — ask Claude to save them, or use Share."
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
            <ResizablePanelGroup orientation="horizontal">
              {/* Left: Code Editor */}
              <ResizablePanel defaultSize={40} minSize={20} className="overflow-hidden">
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1">
                    <SimtenCodeEditor
                      ref={editorRef}
                      value={code}
                      onChange={(value) => {
                        const v = value ?? '';
                        setCode(v);
                        setCodeEmpty(v.trim() === '');
                      }}
                      theme={resolvedTheme === 'dark' ? SIMTEN_DARK : SIMTEN_LIGHT}
                      diagnostics={compiler.diagnostics}
                      beforeMount={(m) => registerSimtenThemes(m, { lightBackground: '#faf9f4' })}
                      options={{
                        lineNumbers: 'on',
                        wordWrap: 'on',
                        tabSize: 2,
                        'semanticHighlighting.enabled': true,
                        fixedOverflowWidgets: true,
                      }}
                    />
                  </div>
                  {compiler.diagnostics.length > 0 && (
                    <ErrorDisplay errors={compiler.diagnostics} />
                  )}
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              {/* Right: Circuit Canvas, optionally split with Waveform below */}
              <ResizablePanel defaultSize={60} minSize={30} className="overflow-hidden">
                {waveformData ? (
                  <ResizablePanelGroup orientation="vertical">
                    <ResizablePanel defaultSize={65} minSize={20} className="overflow-hidden">
                      <CircuitCanvas
                        circuit={circuit}
                        componentLibrary={componentLibrary}
                        theme={theme}
                        showControls
                        renderEmptyState={bootDone && codeEmpty ? renderEmptyState : undefined}
                        portValues={sim.portValues}
                        sequentialState={sim.sequentialState}
                        onToggleNode={onToggleNode}
                        onSetNodeValue={onSetNodeValue}
                        onLoadMemory={onLoadMemory}
                      />
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel
                      defaultSize={35}
                      minSize={10}
                      className="flex flex-col overflow-hidden"
                    >
                      <WaveformViewer
                        vcd={waveformData.vcd}
                        circuit={waveformData.circuit}
                        steadyStateAt={waveformData.steadyStateAt}
                        onLoadVCD={(vcd) =>
                          setWaveformData((prev) => (prev ? { ...prev, vcd } : null))
                        }
                        onClose={() => setWaveformData(null)}
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : (
                  <CircuitCanvas
                    circuit={circuit}
                    componentLibrary={componentLibrary}
                    theme={theme}
                    showControls
                    renderEmptyState={bootDone && codeEmpty ? renderEmptyState : undefined}
                    portValues={sim.portValues}
                    sequentialState={sim.sequentialState}
                    onToggleNode={onToggleNode}
                    onSetNodeValue={onSetNodeValue}
                    onLoadMemory={onLoadMemory}
                  />
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          {/* Conditional Bottom Bar: Clock Controls (only for sequential circuits) */}
          {bootDone && showClockControls && (
            <div className="flex items-center gap-4 border-t border-border bg-card/95 px-6 py-1.5">
              <ClockControls
                cycle={sim.cycleCount}
                historyLength={sim.history.length}
                historyIndex={sim.historyIndex}
                isRunning={sim.isRunning}
                isViewingPast={sim.isViewingPast}
                speed={sim.speed || 15}
                maxSpeed={1000}
                onStep={sim.tick}
                onRun={() => {
                  markRunPulseSeen();
                  sim.startAutoRun(sim.speed || 15, { displayRate: 30 });
                }}
                onPause={() => sim.stopAutoRun()}
                pulseRun={!runPulseSeen && !sim.isRunning}
                onReset={sim.reset}
                onStepBack={() => sim.stepBack()}
                onStepForward={() => sim.stepForward()}
                onSeek={(i) => sim.seek(i)}
                onSpeedChange={(speed) => {
                  sim.setSpeed(speed);
                }}
                showScrubber={sim.history.length > 1}
                chromeless
              />
              <div className="border-l border-border h-8" />
              <SignalOutputPanel portValues={sim.portValues ?? undefined} />
            </div>
          )}
        </div>
      </TooltipProvider>
    </ReactFlowProvider>
  );
}
