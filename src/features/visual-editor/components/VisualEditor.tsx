/**
 * VisualEditor Component
 *
 * Main component that integrates all parts of the visual editor.
 * Combines ComponentPalette, Canvas, SimulationControls, and DSL Editor.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './Canvas';
import { ComponentPalette } from './ComponentPalette';
import { SimulationControls } from './SimulationControls';
import { RightSidebar } from './RightSidebar';
import { TestCaseEditor } from './TestCaseEditor';
import { CircuitSelector } from './CircuitSelector';
import { DSLEditor } from '@/features/dsl/components/DSLEditor';
import { ComponentLibrary } from '@/features/dsl/components/ComponentLibrary';
import { usePrimitivesInit } from '../hooks/usePrimitivesInit';
import { useDSLPreviewStore } from '../stores/dsl-preview-store';
import { useComponentLibraryStore } from '../stores/component-library-store';
import type { Circuit } from '../types/ir-v0.1';

type TabType = 'visual' | 'dsl' | 'split';

export function VisualEditor() {
  const [activeTab, setActiveTab] = useState<TabType>('visual');
  const setCompiledCircuits = useDSLPreviewStore((state) => state.setCompiledCircuits);
  const registerUser = useComponentLibraryStore((state) => state.registerUser);

  // Initialize primitive components library
  usePrimitivesInit();

  // Handle DSL compilation in split mode
  const handleDSLCompile = useCallback(
    (circuits: Circuit[], dslCode: string) => {
      // Register all compiled circuits in the component library
      // so they can be referenced by testbenches and other circuits
      circuits.forEach((circuit) => {
        console.log('[VisualEditor] Registering circuit in library:', circuit.name, 'nodes:', circuit.nodes.length);
        registerUser(circuit);
      });

      setCompiledCircuits(circuits, dslCode);
    },
    [setCompiledCircuits, registerUser]
  );

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50">
        {/* Top Control Bar with Tabs */}
        <div className="flex flex-col border-b border-gray-200 bg-white">
          {/* Tab Buttons */}
          <div className="flex items-center gap-4 px-4 pt-4">
            <button
              onClick={() => setActiveTab('visual')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'visual'
                  ? 'bg-gray-50 text-blue-600 border-t-2 border-x-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              Visual Editor
            </button>
            <button
              onClick={() => setActiveTab('dsl')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'dsl'
                  ? 'bg-gray-50 text-blue-600 border-t-2 border-x-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              DSL Editor
            </button>
            <button
              onClick={() => setActiveTab('split')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'split'
                  ? 'bg-gray-50 text-blue-600 border-t-2 border-x-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              Split Mode
            </button>
          </div>

          {/* Simulation Controls (in visual and split modes) */}
          {(activeTab === 'visual' || activeTab === 'split') && <SimulationControls />}
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {activeTab === 'visual' && (
            <>
              {/* Left: Component Palette */}
              <ComponentPalette />

              {/* Center: Canvas */}
              <div className="flex-1">
                <Canvas />
              </div>

              {/* Right: Sidebar (Tests + Testbench) */}
              <RightSidebar />
            </>
          )}

          {activeTab === 'dsl' && (
            <>
              {/* Left: DSL Editor */}
              <div className="flex-1">
                <DSLEditor />
              </div>

              {/* Right: Component Library */}
              <div className="w-80">
                <ComponentLibrary />
              </div>
            </>
          )}

          {activeTab === 'split' && (
            <>
              {/* Left: DSL Editor (with auto-compile) */}
              <div className="flex-1 border-r border-gray-200">
                <DSLEditor autoCompileEnabled={true} onCompileSuccess={handleDSLCompile} />
              </div>

              {/* Right: Canvas with CircuitSelector */}
              <div className="flex-1 flex flex-col">
                <CircuitSelector />
                <div className="flex-1">
                  <Canvas />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Test Case Editor Modal */}
        <TestCaseEditor />
      </div>
    </ReactFlowProvider>
  );
}
