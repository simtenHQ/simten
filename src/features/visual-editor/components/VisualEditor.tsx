/**
 * VisualEditor Component
 *
 * Main component that integrates all parts of the visual editor.
 * Combines ComponentPalette, Canvas, SimulationControls, and DSL Editor.
 */

"use client";

import React, { useCallback, useState, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "./Canvas";
import { ComponentPalette } from "./ComponentPalette";
import { SimulationControls } from "./SimulationControls";
import { RightSidebar } from "./RightSidebar";
import { TestCaseEditor } from "./TestCaseEditor";
import { ClockControls } from "./ClockControls";
import { DSLEditor } from "@/features/dsl/ui/DSLEditor";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Menu, TestTube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCircuitStore } from "../stores/circuit-store";
import { usePrimitivesInit } from "../hooks/usePrimitivesInit";
import { useDSLPreviewStore } from "../stores/dsl-preview-store";
import { useComponentLibraryStore } from "../stores/component-library-store";
import { useSimulationController } from "../simulation/use-simulation-controller";
import type { Circuit } from "../types/circuit";

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

export function VisualEditor() {
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

  // Check if we need to show clock controls
  const showClockControls = hasSequentialComponents(circuit, resolveComponent);

  // Initialize primitive components library
  usePrimitivesInit();

  // Initialize simulation controller (THE ONLY PLACE THAT RUNS SIMULATION)
  useSimulationController();

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
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50">
        {/* Top Control Bar with Drawer Toggle Buttons */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-2 shadow-sm">
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

          <div className="border-l border-gray-200 h-8"></div>

          {/* App Title */}
          <h1 className="text-lg font-bold text-gray-900">Turing Incomplete</h1>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Main Controls from SimulationControls (inline) */}
          <SimulationControls />
        </div>

        {/* Main Content Area - Unified Workspace */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: DSL Editor (40%) - Full Height */}
          <div className="w-[40%] border-r border-gray-200">
            <DSLEditor
              autoCompileEnabled={true}
              onCompileSuccess={handleDSLCompile}
              showHeader={false}
            />
          </div>

          {/* Right: Canvas (60%) - Full Height */}
          <div className="flex-1">
            <Canvas />
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
          <div className="border-t border-gray-200 bg-white px-6 py-3 shadow-sm">
            <ClockControls />
          </div>
        )}

        {/* Test Case Editor Modal */}
        <TestCaseEditor />
      </div>
    </ReactFlowProvider>
  );
}
