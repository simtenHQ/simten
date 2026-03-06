/**
 * RightSidebar Component
 *
 * Combined sidebar with tabs for Testbench and Diagnostics
 */

'use client';

import React, { useState } from 'react';
import { TestbenchPanel } from './TestbenchPanel';
import { TestbenchLoader } from './TestbenchLoader';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { useTestbenchStore } from '../stores/testbench-store';
import { useAnalysisStore } from '../stores/analysis-store';

type SidebarTab = 'testbench' | 'diagnostics';

export function RightSidebar() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('diagnostics');
  const testbench = useTestbenchStore((state) => state.testbench);
  const validationResult = useAnalysisStore((state) => state.validationResult);

  // Count errors for the tab badge
  const errorCount = validationResult?.diagnostics.filter(
    (d) => d.severity === 'error'
  ).length ?? 0;

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'diagnostics'
              ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          Diagnostics
          {errorCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {errorCount}
            </span>
          )}
          {validationResult && errorCount === 0 && (
            <span className="ml-1 text-green-500">{'\u2713'}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('testbench')}
          className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
            activeTab === 'testbench'
              ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          Testbench {testbench && <span className="ml-1 text-xs">{'\u25cf'}</span>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* Diagnostics Tab */}
        {activeTab === 'diagnostics' && (
          <div className="h-full overflow-auto">
            <DiagnosticsPanel />
          </div>
        )}

        {/* Testbench Tab */}
        {activeTab === 'testbench' && (
          <div className="h-full overflow-auto p-4 space-y-4">
            {/* Show TestbenchLoader when no testbench loaded */}
            {!testbench && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Load Testbench</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Load a testbench to run stimulus-driven tests
                </p>
                <TestbenchLoader />
              </div>
            )}

            {/* Show TestbenchPanel when testbench loaded */}
            {testbench && <TestbenchPanel />}
          </div>
        )}
      </div>
    </div>
  );
}
