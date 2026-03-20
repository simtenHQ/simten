/**
 * VisualEditor Component
 *
 * Main component that integrates all parts of the visual editor.
 * Combines ComponentPalette, Canvas, and DSL Editor.
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
  CompositeInspectorDialog,
} from "@turing-incomplete/ui/editor/components";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCircuitStore, useDSLPreviewStore, useComponentLibraryStore } from "@turing-incomplete/ui/editor/stores";
import { usePrimitivesInit } from "@turing-incomplete/ui/editor/hooks";
import { useSimulationController } from "@turing-incomplete/ui/editor";
import type { Circuit } from "@turing-incomplete/ui/editor/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DSLEditor, type DSLEditorRef } from "@/features/dsl/ui/DSLEditor";
import { Menu, TestTube, Bot } from "lucide-react";
import { ChatPanel, useChatStore, useNarrativeContext } from "@/features/chat";
import { useMCPConnection } from "@/hooks/useMCPConnection";

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
  const registerUser = useComponentLibraryStore((state) => state.registerUser);
  const circuit = useCircuitStore((state) => state.circuit);
  const resolveComponent = useComponentLibraryStore(
    (state) => state.resolveComponent,
  );

  // Drawer state
  const [componentPaletteOpen, setComponentPaletteOpen] = useState(false);
  const [testsPanelOpen, setTestsPanelOpen] = useState(false);

  // DSL Editor ref for ChatPanel integration
  const dslEditorRef = useRef<DSLEditorRef>(null);

  // Chat store
  const { setOpen: setChatOpen, toggle: toggleChat } = useChatStore();

  // Check if we need to show clock controls
  const showClockControls = hasSequentialComponents(circuit, resolveComponent);

  // Initialize primitive components library
  usePrimitivesInit();

  // Initialize simulation controller (THE ONLY PLACE THAT RUNS SIMULATION)
  const simulationController = useSimulationController();

  // Keep simulation controller in a ref so studio callbacks read fresh values
  const simRef = useRef(simulationController);
  simRef.current = simulationController;

  // Studio connection (WebSocket to MCP server)
  const { status: mcpStatus } = useMCPConnection({
    onDSL: useCallback((source: string) => {
      dslEditorRef.current?.setCode(source);
      setTimeout(() => dslEditorRef.current?.compile(), 100);
    }, []),
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
  const dslCode = dslEditorRef.current?.getCode() ?? "";
  const narrativeContext = useNarrativeContext(dslCode);

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

  // Handle DSL compilation in split mode
  const handleDSLCompile = useCallback(
    (circuits: Circuit[], dslCode: string) => {
      // Register all compiled circuits in the component library
      // so they can be referenced by testbenches and other circuits
      circuits.forEach((circuit) => {
        console.log(
          "[VisualEditor] Registering circuit in library:",
          circuit.name,
          "nodes:",
          circuit.nodes.length,
        );
        registerUser(circuit);
      });

      setCompiledCircuits(circuits, dslCode);
    },
    [setCompiledCircuits, registerUser],
  );

  // Empty state with chat CTA
  const renderEmptyState = useCallback(() => (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto flex flex-col items-center gap-4 rounded-xl border border-gray-200 dark:border-[#2a2a2e] bg-white dark:bg-[#1a1a1e] p-8 shadow-lg max-w-sm text-center">
        <Bot className="h-12 w-12 text-blue-500" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Build circuits with AI</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Describe what you want and watch it appear on canvas
          </p>
        </div>
        <Button onClick={() => setChatOpen(true)} className="gap-2">
          <Bot className="h-4 w-4" />
          Start building with AI
        </Button>
        <p className="text-xs text-gray-400">
          or press{' '}
          <kbd className="rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </p>
      </div>
    </div>
  ), [setChatOpen]);

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
          {/* Left: DSL Editor (40%) - Full Height */}
          <div className="w-[40%] border-r border-gray-200 dark:border-[#2a2a2e]">
            <DSLEditor
              ref={dslEditorRef}
              autoCompileEnabled={true}
              onCompileSuccess={handleDSLCompile}
              showHeader={false}
            />
          </div>

          {/* Right: Canvas (60%) - Full Height */}
          <div className="flex flex-1 flex-col">
            <div className="flex-1">
              <Canvas theme={theme} renderEmptyState={renderEmptyState} />
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
            <ClockControls />
            <div className="border-l border-gray-200 dark:border-[#2a2a2e] h-8" />
            <SignalOutputPanel />
          </div>
        )}

        {/* Composite Inspector Dialog */}
        <CompositeInspectorDialog />

        {/* AI Chat Panel */}
        <ChatPanel
          getCurrentCode={() => dslEditorRef.current?.getCode() ?? ""}
          setCode={(code) => {
            dslEditorRef.current?.setCode(code);
            // Trigger recompile after setting code
            setTimeout(() => dslEditorRef.current?.compile(), 100);
          }}
          setInput={(nodeName, value) => {
            // Read circuit from store at call time to avoid stale closures.
            const currentCircuit = useCircuitStore.getState().circuit;
            if (currentCircuit) {
              const node = currentCircuit.nodes.find(n =>
                n.id === nodeName ||
                n.id.includes(`_${nodeName}_`) ||
                n.id.endsWith(`_${nodeName}`)
              );
              if (node) {
                useCircuitStore.getState().updateNode(node.id, { arguments: { ...node.arguments, value } });
                simulationController.setInput(node.id, value);
              } else {
                console.warn('[setInput] Node not found:', nodeName, 'in circuit with', currentCircuit.nodes.length, 'nodes');
              }
            }
          }}
          runSimulation={async (cycles) => {
            for (let i = 0; i < cycles; i++) {
              simulationController.step();
            }
          }}
          insertNode={(componentRef, label) => {
            console.log("[Chat] Insert node:", componentRef, label);
          }}
          narrativeContext={narrativeContext.narrative}
          sourceCodeHash={narrativeContext.sourceCodeHash}
        />
      </div>
      </TooltipProvider>
    </ReactFlowProvider>
  );
}
