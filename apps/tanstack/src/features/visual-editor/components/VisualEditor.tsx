/**
 * VisualEditor Component
 *
 * Main component that integrates all parts of the visual editor.
 * Combines ComponentPalette, Canvas, and Code Editor.
 *
 * This is a thin shell — all editor components come from @turing-incomplete/ui.
 */

"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import {
  ReactFlowProvider,
  Canvas,
  ComponentPalette,
  RightSidebar,
  ClockControls,
  SignalOutputPanel,
} from "@turing-incomplete/ui/editor/components";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCircuitStore, useDSLPreviewStore } from "@turing-incomplete/ui/editor/stores";
import { usePrimitivesInit } from "@turing-incomplete/ui/editor/hooks";
import { useCircuitSession } from "@turing-incomplete/ui/canvas";
import type { Circuit } from "@turing-incomplete/ui/editor/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TSEditor, type TSEditorRef } from "@/features/code-editor/TSEditor";
import { Menu, TestTube, Bot, Download } from "lucide-react";
import { exportVerilog } from "@turing-incomplete/core/verilog";
/** Check if a circuit name is an auto-generated harness */
function isHarnessName(name: string): boolean {
  return name.endsWith('Harness');
}
import { ChatPanel, useChatStore, useLLMContext } from "@/features/chat";
import { useMCPConnection } from "@/hooks/useMCPConnection";
import { EXAMPLES, CATEGORY_COLORS, CATEGORY_LABELS, type Example } from "../examples";

// Helper to check if circuit has sequential components
function hasSequentialComponents(
  circuit: Circuit | null,
  resolveComponent: (name: string) => Circuit | undefined,
): boolean {
  if (!circuit) return false;

  for (const node of circuit.nodes) {
    const componentDef = resolveComponent(node.componentRef);
    if (!componentDef) continue;

    // Check if component has clocks or state (sequential indicators)
    if (componentDef.clocks.length > 0 || componentDef.state.length > 0) {
      return true;
    }

    // If this is a composite, recursively check inside it
    if (componentDef.implementation.kind === "composite") {
      if (hasSequentialComponents(componentDef, resolveComponent)) {
        return true;
      }
    }
  }
  return false;
}

interface VisualEditorProps {
  theme?: "light" | "dark";
}

export function VisualEditor({ theme = "light" }: VisualEditorProps) {
  const setCompiledCircuits = useDSLPreviewStore(
    (state) => state.setCompiledCircuits,
  );
  const circuit = useCircuitStore((state) => state.circuit);

  // Drawer state
  const [componentPaletteOpen, setComponentPaletteOpen] = useState(false);
  const [testsPanelOpen, setTestsPanelOpen] = useState(false);

  // Editor ref for ChatPanel integration
  const editorRef = useRef<TSEditorRef>(null);

  // Track whether we've loaded content so we can skip the first MCP cache replay
  const hasLoadedContentRef = useRef(false);

  // Chat store
  const { setOpen: setChatOpen, toggle: toggleChat, addAssistantMessage } = useChatStore();

  // Channel thinking state (separate from the API streaming system)
  const [channelThinking, setChannelThinking] = useState(false);

  // Initialize primitive components library
  usePrimitivesInit();

  // ── Compile library — set by editor on compile, used for simulation + export ──
  const [compileLibrary, setCompileLibrary] = useState<{ resolveComponent: (name: string) => Circuit | undefined; getAllPrimitiveNames: () => string[] } | null>(null);

  // Export to Verilog — uses compile library (no store)
  const handleExportVerilog = useCallback(() => {
    let currentCircuit = useCircuitStore.getState().circuit;
    if (!currentCircuit || !compileLibrary) return;

    // If this is an auto-generated harness, export the real circuit instead
    if (isHarnessName(currentCircuit.name)) {
      const baseName = currentCircuit.name.replace(/Harness$/, '');
      const realCircuit = compileLibrary.resolveComponent(baseName);
      if (realCircuit) currentCircuit = realCircuit;
    }

    try {
      const verilogCode = exportVerilog(currentCircuit, compileLibrary);
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
  }, [compileLibrary]);

  // ── Simulation — driven by compile result, no store dependency ──
  const sim = useCircuitSession(circuit, compileLibrary);
  const showClockControls = sim.isSequential;

  // Keep sim state in ref for MCP callbacks
  const simRef = useRef(sim);
  simRef.current = sim;

  // Studio connection (WebSocket to MCP server)
  const { status: mcpStatus, sendToClaudePrompt } = useMCPConnection({
    onDSL: useCallback((source: string) => {
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
  const dslCode = editorRef.current?.getCode() ?? "";
  const narrativeContext = useLLMContext(dslCode, sim.portValues ?? undefined);

  // Keyboard shortcuts for drawer toggles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+P / Ctrl+P - Toggle component palette
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setComponentPaletteOpen((prev) => !prev);
      }
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
    (circuits: Circuit[], code: string, library?: { resolveComponent: (name: string) => Circuit | undefined; getAllPrimitiveNames: () => string[] }) => {
      setCompiledCircuits(circuits, code);

      // Pass library to simulation and other consumers
      if (library) {
        setCompileLibrary(library);
      }
    },
    [setCompiledCircuits],
  );

  // Load an example into the editor
  const loadExample = useCallback((example: Example) => {
    editorRef.current?.setCode(example.dsl);
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
            onClick={() => setComponentPaletteOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2"
            title="Open Component Palette (Cmd+P)"
          >
            <Menu className="h-4 w-4" />
          </Button>

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
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Turing Incomplete</h1>

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

          {/* Right: Canvas (60%) - Full Height */}
          <div className="flex flex-1 flex-col">
            <div className="flex-1">
              <Canvas
                theme={theme}
                renderEmptyState={renderEmptyState}
                portValues={sim.portValues}
                sequentialState={sim.sequentialState}
                onToggleNode={(nodeId) => {
                  const pv = sim.portValues;
                  const outKey = `${nodeId}.out`;
                  const currentValue = pv.get(outKey);
                  sim.setInput(nodeId, !currentValue);
                  sim.runCombinational();
                }}
                onSetNodeValue={(nodeId, value) => {
                  sim.setInput(nodeId, value);
                  sim.runCombinational();
                }}
                onKeyboardInput={(nodeId, scanCode) => {
                  const engine = sim.session?.getEngine();
                  if (engine) engine.setInput(nodeId, scanCode);
                }}
                onLoadMemory={(nodeId, memData) => {
                  const engine = sim.session?.getEngine();
                  if (engine) {
                    engine.setNode(nodeId, memData);
                    sim.runCombinational();
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Left Drawer: Component Palette (non-modal for drag-and-drop) */}
        <Sheet
          modal={false}
          open={componentPaletteOpen}
          onOpenChange={setComponentPaletteOpen}
        >
          <SheetContent side="left" className="w-80 p-0">
            <SheetTitle className="sr-only">Component Palette</SheetTitle>
            <ComponentPalette />
          </SheetContent>
        </Sheet>

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
                if (sim.isRunning) {
                  sim.session?.setSpeed(speed);
                }
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
          setInput={(nodeName, value) => {
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
                sim.setInput(node.id, value);
              } else {
                console.warn('[setInput] Node not found:', nodeName, 'in circuit with', currentCircuit.nodes.length, 'nodes');
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
