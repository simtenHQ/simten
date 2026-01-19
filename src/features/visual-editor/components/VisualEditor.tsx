/**
 * VisualEditor Component
 *
 * Main component that integrates all parts of the visual editor.
 * Combines ComponentPalette, Canvas, SimulationControls, and DSL Editor.
 */

'use client';

import React, { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './Canvas';
import { ComponentPalette } from './ComponentPalette';
import { SimulationControls } from './SimulationControls';
import { TestPanel } from './TestPanel';
import { TestCaseEditor } from './TestCaseEditor';
import { DSLEditor } from '@/features/dsl/components/DSLEditor';
import { ComponentLibrary } from '@/features/dsl/components/ComponentLibrary';
import { usePrimitivesInit } from '../hooks/usePrimitivesInit';

type TabType = 'visual' | 'dsl';

export function VisualEditor() {
  const [activeTab, setActiveTab] = useState<TabType>('visual');

  // Initialize primitive components library
  usePrimitivesInit();

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
          </div>

          {/* Simulation Controls (only in visual mode) */}
          {activeTab === 'visual' && <SimulationControls />}
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {activeTab === 'visual' ? (
            <>
              {/* Left: Component Palette */}
              <ComponentPalette />

              {/* Center: Canvas */}
              <div className="flex-1">
                <Canvas />
              </div>

              {/* Right: Test Panel */}
              <TestPanel />
            </>
          ) : (
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
        </div>

        {/* Test Case Editor Modal */}
        <TestCaseEditor />
      </div>
    </ReactFlowProvider>
  );
}
