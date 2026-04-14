/**
 * EditorWorkspace — the full /editor page shell.
 *
 * Combines Monaco code editor, CircuitCanvas, AI chat, clock controls,
 * Verilog export, MCP connection, and example picker.
 */

"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import {
  ReactFlowProvider,
  RightSidebar,
  ClockControls,
  SignalOutputPanel,
} from "@simten/ui/editor/components";
import { CircuitCanvas } from "@simten/ui/canvas";
import { useCircuitSimulator, builtFromIR } from "@simten/embed";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useCircuitStore, useCircuitPreviewStore, useCircuitLibraryStore } from "@simten/ui/editor/stores";
import type { Circuit } from "@simten/ui/editor/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TSEditor, type TSEditorRef } from "@/features/code-editor/TSEditor";
import { TestTube, Bot, Download } from "lucide-react";
import { exportVerilog } from "@simten/core/verilog";
/** Check if a circuit name is an auto-generated harness (autoHarness appends 'Demo') */
function isHarnessName(name: string): boolean {
  return name.endsWith('Demo') || name.endsWith('Harness');
}
import { ChatPanel, useChatStore, useLLMContext } from "@/features/chat";
import { useMCPConnection } from "@/hooks/useMCPConnection";
import { WaveformViewer } from "@simten/ui/waveform";
import { EXAMPLES, CATEGORY_COLORS, CATEGORY_LABELS, type Example } from "../examples";

const SCAN_CODES: Record<string, number> = {
  ArrowUp: 0x48, ArrowDown: 0x50, ArrowLeft: 0x4b, ArrowRight: 0x4d,
  Space: 0x39, Enter: 0x1c, Escape: 0x01,
  KeyA: 0x1e, KeyB: 0x30, KeyC: 0x2e, KeyD: 0x20, KeyE: 0x12,
  KeyF: 0x21, KeyG: 0x22, KeyH: 0x23, KeyI: 0x17, KeyJ: 0x24,
  KeyK: 0x25, KeyL: 0x26, KeyM: 0x32, KeyN: 0x31, KeyO: 0x18,
  KeyP: 0x19, KeyQ: 0x10, KeyR: 0x13, KeyS: 0x1f, KeyT: 0x14,
  KeyU: 0x16, KeyV: 0x2f, KeyW: 0x11, KeyX: 0x2d, KeyY: 0x15,
  KeyZ: 0x2c,
  Digit0: 0x0b, Digit1: 0x02, Digit2: 0x03, Digit3: 0x04,
  Digit4: 0x05, Digit5: 0x06, Digit6: 0x07, Digit7: 0x08,
  Digit8: 0x09, Digit9: 0x0a,
};

function useKeyboardInput(circuit: Circuit | null, onKeyboardInput: (nodeId: string, scanCode: number) => void) {
  useEffect(() => {
    if (!circuit) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      const scanCode = SCAN_CODES[e.code];
      if (scanCode == null) return;

      circuit.nodes
        .filter((node) => node.componentRef === "Input" && (node.label?.toLowerCase().includes("keyboard") || node.id.toLowerCase().includes("keyboard")))
        .forEach((node) => onKeyboardInput(node.id, scanCode));

      if (e.code.startsWith("Arrow")) e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [circuit, onKeyboardInput]);
}

interface EditorWorkspaceProps {
  theme?: "light" | "dark";
}

export function EditorWorkspace({ theme = "light" }: EditorWorkspaceProps) {
  const setCompiledCircuits = useCircuitPreviewStore(
    (state) => state.setCompiledCircuits,
  );
  const circuit = useCircuitStore((state) => state.circuit);

  // Sandbox-based simulation — uses same hook as embeds
  const [compileResult, setCompileResult] = useState<import("@simten/ui/sandbox").CompileResult | null>(null);

  // Build a BuiltCircuit-like object from the compile result for useCircuitSimulator.
  // When the editor's source was compiled via sandbox.compile(), evals are already
  // registered in the sandbox — no need to transfer them via evalSources.
  const editorBuiltCircuit = useMemo<import("@simten/core/circuit").BuiltCircuit | null>(() => {
    if (!compileResult || !circuit) return null;
    return builtFromIR(circuit, [...compileResult.libraryCircuits, ...compileResult.circuits]);
  }, [compileResult, circuit]);

  // Drawer state
  const [testsPanelOpen, setTestsPanelOpen] = useState(false);
  const [waveformData, setWaveformData] = useState<{ vcd: string; circuit: string; ticks: number; steadyStateAt?: number } | null>(null);

  // Editor ref for ChatPanel integration
  const editorRef = useRef<TSEditorRef>(null);

  // Track whether we've loaded content so we can skip the first MCP cache replay
  const hasLoadedContentRef = useRef(false);

  // Chat store
  const { setOpen: setChatOpen, toggle: toggleChat, addAssistantMessage } = useChatStore();

  // Channel thinking state (separate from the API streaming system)
  const [channelThinking, setChannelThinking] = useState(false);

  // Library from the last successful compile (stored in Zustand)
  const library = useCircuitLibraryStore((s) => s.library);

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
      const verilogCode = exportVerilog(currentCircuit, lib);
      const blob = new Blob([verilogCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentCircuit.name}.v`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Verilog export failed:', e);
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
  useKeyboardInput(circuit, useCallback((nodeId: string, scanCode: number) => {
    sim.setNode(nodeId, scanCode);
  }, [sim.setNode]));

  // Build library interface for CircuitCanvas from store
  const resolveCircuit = useCircuitLibraryStore((s) => s.resolveCircuit);
  const getAllPrimitiveNames = useCircuitLibraryStore((s) => s.getAllPrimitiveNames);
  const componentLibrary = useMemo(() => ({
    resolveCircuit,
    getAllPrimitiveNames,
  }), [resolveCircuit, getAllPrimitiveNames]);

  // Keep sim state in ref for MCP callbacks
  const simRef = useRef(sim);
  simRef.current = sim;

  // Studio connection (WebSocket to MCP server)
  const { status: mcpStatus, sendToClaudePrompt } = useMCPConnection({
    onTraces: useCallback((data: unknown) => {
      const payload = data as { vcd: string; circuit: string; ticks: number; steadyStateAt?: number };
      if (payload?.vcd) setWaveformData(payload);
    }, []),
    onSource: useCallback((source: string) => {
      editorRef.current?.setCode(source);
      setTimeout(() => editorRef.current?.compile(), 100);
    }, []),
    onChatMessage: useCallback((text: string) => {
      addAssistantMessage(text);
      setChannelThinking(false);
      setChatOpen(true);
    }, [addAssistantMessage, setChatOpen]),
    getCircuitState: useCallback(() => {
      const currentCircuit = useCircuitStore.getState().circuit;
      const sim = simRef.current;
      return {
        cycleCount: sim.cycle,
        inputs: {},
        outputs: {},
        isSequential: sim.isSequential,
        circuitName: currentCircuit?.name ?? null,
        timestamp: Date.now(),
      };
    }, []),
  });

  // Narrative context for chat
  const code = editorRef.current?.getCode() ?? "";
  const narrativeContext = useLLMContext(code, sim.portValues ?? undefined);

  // Keyboard shortcuts for drawer toggles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+T / Ctrl+T - Toggle tests panel
      if ((e.metaKey || e.ctrlKey) && e.key === "t") {
        e.preventDefault();
        setTestsPanelOpen((prev) => !prev);
      }
      // Cmd+K / Ctrl+K - Toggle chat panel
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleChat();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleChat]);

  // Handle compilation in split mode
  const handleCompile = useCallback(
    (circuits: Circuit[], code: string, library?: { resolveCircuit(name: string): Circuit | undefined; getAllPrimitiveNames(): string[]; getAllCircuitNames(): string[] }, sandboxResult?: { circuits: Circuit[]; libraryCircuits: Circuit[]; portValues: Record<string, number | boolean> }) => {
      // Set library FIRST — applyToCanvas fires inside setCompiledCircuits and needs
      // the full library (including user circuits) before adding harness components.
      if (library) {
        useCircuitLibraryStore.getState().setLibrary(library);
      }

      setCompiledCircuits(circuits, code);

      // Feed sandbox compile result to simulation session (no double compile)
      if (sandboxResult) {
        setCompileResult(sandboxResult);
      }
    },
    [setCompiledCircuits],
  );

  // Load an example into the editor
  const loadExample = useCallback((example: Example) => {
    editorRef.current?.setCode(example.code);
    hasLoadedContentRef.current = true;
    setTimeout(() => editorRef.current?.compile(), 100);
  }, []);

  // Empty state with example picker
  const renderEmptyState = useCallback(() => (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto rounded-xl border border-gray-200 dark:border-[#2a2a2e] bg-white dark:bg-[#1a1a1e] p-6 shadow-lg max-w-md w-full">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Load an example</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Pick a circuit to explore, or write your own on the left.
        </p>
        <div className="space-y-1.5 max-h-[340px] overflow-y-auto">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              onClick={() => loadExample(ex)}
              className="w-full text-left rounded-lg border border-gray-200 dark:border-[#2a2a2e] hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-[#161618] hover:bg-blue-50 dark:hover:bg-blue-950/20 px-4 py-2.5 transition-colors group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {ex.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                    {ex.description}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[ex.category]}`}>
                    {CATEGORY_LABELS[ex.category]}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">{ex.nodes}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            or press{' '}
            <kbd className="rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
            {' '}to build with AI
          </p>
          <Button onClick={() => setChatOpen(true)} variant="outline" size="sm" className="gap-1.5 text-xs">
            <Bot className="h-3.5 w-3.5" />
            AI Chat
          </Button>
        </div>
      </div>
    </div>
  ), [setChatOpen, loadExample]);

  return (
    <ReactFlowProvider>
      <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 dark:bg-[#111113]">
        {/* Top Control Bar with Drawer Toggle Buttons */}
        <div className="flex items-center gap-3 border-b border-gray-200 dark:border-[#2a2a2e] bg-white dark:bg-[#1a1a1e] px-6 py-2 shadow-sm">
          {/* Left: Drawer Toggle Buttons */}

          <Button
            onClick={() => setTestsPanelOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2"
            title="Open Tests Panel (Cmd+T)"
          >
            <TestTube className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => setChatOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2"
            title="Open AI Assistant (Cmd+K)"
          >
            <Bot className="h-4 w-4" />
          </Button>

          <div className="border-l border-gray-200 dark:border-[#2a2a2e] h-8"></div>

          {/* Export Verilog */}
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

          <div className="border-l border-gray-200 dark:border-[#2a2a2e] h-8"></div>

          {/* App Title */}
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Simten</h1>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Studio Connection Status */}
          {mcpStatus === 'connected' && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Connected</span>
            </div>
          )}
          {mcpStatus === 'reconnecting' && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <span>Reconnecting...</span>
            </div>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>

        {/* Main Content Area - Unified Workspace */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Code Editor (40%) - Full Height */}
          <div className="w-[40%] border-r border-gray-200 dark:border-[#2a2a2e]">
            <TSEditor
              ref={editorRef}
              storageKey={null}
              initialCode=""
              autoCompileEnabled={true}
              onCompileSuccess={handleCompile}
              showHeader={false}
            />
          </div>

          {/* Right: Circuit Canvas (60%) - Full Height */}
          <div className="flex flex-1 flex-col">
            <div className="flex-1">
              <CircuitCanvas
                circuit={circuit}
                componentLibrary={componentLibrary}
                theme={theme}
                showControls
                renderEmptyState={renderEmptyState}
                portValues={sim.portValues}
                sequentialState={sim.sequentialState}
                onToggleNode={(nodeId) => {
                  const pv = sim.portValues;
                  const outKey = `${nodeId}.out`;
                  const currentValue = pv.get(outKey);
                  sim.setNode(nodeId, !currentValue);
                  sim.runCombinational();
                }}
                onSetNodeValue={(nodeId, value) => {
                  sim.setNode(nodeId, value);
                  sim.runCombinational();
                }}
                onLoadMemory={(nodeId, memData) => {
                  sim.setNode(nodeId, memData);
                }}
              />
            </div>
          </div>
        </div>


        {/* Waveform viewer — shown when traces arrive via MCP */}
        {waveformData && (
          <WaveformViewer
            vcd={waveformData.vcd}
            circuit={waveformData.circuit}
            steadyStateAt={waveformData.steadyStateAt}
            onLoadVCD={(vcd) => setWaveformData((prev) => prev ? { ...prev, vcd } : null)}
          />
        )}

        {/* Right Drawer: Tests + Testbench */}
        <Sheet open={testsPanelOpen} onOpenChange={setTestsPanelOpen}>
          <SheetContent side="right" className="w-96 p-0">
            <SheetTitle className="sr-only">Tests and Testbench</SheetTitle>
            <RightSidebar />
          </SheetContent>
        </Sheet>

        {/* Conditional Bottom Bar: Clock Controls (only for sequential circuits) */}
        {showClockControls && (
          <div className="flex items-center gap-4 border-t border-gray-200 dark:border-[#2a2a2e] bg-white dark:bg-[#1a1a1e] px-6 py-3 shadow-sm">
            <ClockControls
              cycle={sim.cycle}
              historyLength={sim.history.length}
              historyIndex={sim.historyIndex}
              isRunning={sim.isRunning}
              isViewingPast={sim.isViewingPast}
              speed={sim.speed || 5}
              maxSpeed={1000}
              onStep={sim.tick}
              onRun={() => sim.startAutoRun(sim.speed || 5, { displayRate: 30 })}
              onPause={() => sim.stopAutoRun()}
              onReset={sim.reset}
              onStepBack={() => sim.stepBack()}
              onStepForward={() => sim.stepForward()}
              onSeek={(i) => sim.seek(i)}
              onSpeedChange={(speed) => {
                sim.setSpeed(speed);
              }}
              showScrubber={sim.history.length > 1}
            />
            <div className="border-l border-gray-200 dark:border-[#2a2a2e] h-8" />
            <SignalOutputPanel portValues={sim.portValues ?? undefined} />
          </div>
        )}

        {/* AI Chat Panel */}
        <ChatPanel
          getCurrentCode={() => editorRef.current?.getCode() ?? ""}
          setCode={(code) => {
            editorRef.current?.setCode(code);
            // Trigger recompile after setting code
            setTimeout(() => editorRef.current?.compile(), 100);
          }}
          setNode={(nodeName, value) => {
            // Read circuit from store at call time to avoid stale closures.
            const currentCircuit = useCircuitStore.getState().circuit;
            if (currentCircuit) {
              const node = currentCircuit.nodes.find(n =>
                n.id === nodeName ||
                n.label === nodeName ||
                n.id.includes(`_${nodeName}_`) ||
                n.id.endsWith(`_${nodeName}`)
              );
              if (node) {
                useCircuitStore.getState().updateNode(node.id, { arguments: { ...node.arguments, value } });
                sim.setNode(node.id, value);
              } else {
                console.warn('[setNode] Node not found:', nodeName, 'in circuit with', currentCircuit.nodes.length, 'nodes');
              }
            }
          }}
          runSimulation={async (cycles) => {
            for (let i = 0; i < cycles; i++) {
              sim.tick();
            }
          }}
          insertNode={(componentRef, label) => {
            console.log("[Chat] Insert node:", componentRef, label);
          }}
          narrativeContext={narrativeContext.narrative}
          sourceCodeHash={narrativeContext.sourceCodeHash}
          onSendToChannel={mcpStatus === 'connected' ? sendToClaudePrompt : undefined}
          channelThinking={channelThinking}
          setChannelThinking={setChannelThinking}
        />
      </div>
      </TooltipProvider>
    </ReactFlowProvider>
  );
}
