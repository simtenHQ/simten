/**
 * RightSidebar Component
 *
 * Combined sidebar with tabs for Tests and Testbench
 */

'use client';

import React, { useState } from 'react';
import { TestPanel } from './TestPanel';
import { TestbenchPanel } from './TestbenchPanel';
import { TestbenchLoader } from './TestbenchLoader';
import { useTestbenchStore } from '../stores/testbench-store';

type SidebarTab = 'tests' | 'testbench';

export function RightSidebar() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('tests');
  const testbench = useTestbenchStore((state) => state.testbench);

  return (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setActiveTab('tests')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'tests'
              ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          Tests
        </button>
        <button
          onClick={() => setActiveTab('testbench')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'testbench'
              ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          Testbench {testbench && <span className="ml-1 text-xs">●</span>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* Tests Tab - Render TestPanel content directly */}
        {activeTab === 'tests' && (
          <div className="h-full overflow-auto">
            <TestPanel />
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
