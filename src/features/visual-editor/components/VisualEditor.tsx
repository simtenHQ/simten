/**
 * VisualEditor Component
 *
 * Main component that integrates all parts of the visual editor.
 * Combines ComponentPalette, Canvas, and SimulationControls.
 */

'use client';

import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './Canvas';
import { ComponentPalette } from './ComponentPalette';
import { SimulationControls } from './SimulationControls';

export function VisualEditor() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50">
        {/* Top Control Bar */}
        <SimulationControls />

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Component Palette */}
          <ComponentPalette />

          {/* Center: Canvas */}
          <div className="flex-1">
            <Canvas />
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}
