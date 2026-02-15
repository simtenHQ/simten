/**
 * TestPanel Component (IR v0.1)
 *
 * Right sidebar for managing and running test cases.
 *
 * Updated for IR v0.1:
 * - Uses CircuitStore instead of useIRStore
 * - Uses Circuit instead of components/connections
 */

'use client';

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useTestStore } from '../stores/test-store';
import { useCircuitStore } from '../stores/circuit-store';
import { runAllTests } from '../lib/testing/test-runner';
import { TestResultDisplay } from './TestResultDisplay';

export function TestPanel() {
  const testCases = useTestStore((state) => state.testCases);
  const results = useTestStore((state) => state.results);
  const isRunning = useTestStore((state) => state.isRunning);
  const setIsRunning = useTestStore((state) => state.setIsRunning);
  const setTestResult = useTestStore((state) => state.setTestResult);
  const setEditingTestId = useTestStore((state) => state.setEditingTestId);
  const clearResults = useTestStore((state) => state.clearResults);
  const circuit = useCircuitStore((state) => state.circuit);

  const testCasesList = Object.values(testCases);
  const enabledTests = testCasesList.filter(tc => tc.enabled);

  // Calculate stats
  const totalTests = testCasesList.length;
  const passedTests = Object.values(results).filter(r => r.status === 'passed').length;
  const failedTests = Object.values(results).filter(r => r.status === 'failed').length;
  const errorTests = Object.values(results).filter(r => r.status === 'error').length;

  const handleRunTests = useCallback(async () => {
    if (isRunning || !circuit) return;

    setIsRunning(true);
    clearResults();

    // Small delay to show running state
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const testResults = runAllTests(testCasesList, circuit);

      // Update results in store
      for (const result of testResults) {
        setTestResult(result.testCaseId, result);
      }
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, testCasesList, circuit, setIsRunning, clearResults, setTestResult]);

  const handleNewTest = useCallback(() => {
    setEditingTestId('new');
  }, [setEditingTestId]);

  return (
    <div className="flex h-full w-64 flex-col border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900">Circuit Tests</h2>
        <p className="text-xs text-gray-500">
          Verify circuit behavior with test cases
        </p>
      </div>

      {/* Summary Section */}
      {totalTests > 0 && (
        <div className="border-b border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">Summary</span>
            <div className="flex gap-2">
              <span className={cn(
                "font-semibold",
                passedTests > 0 ? "text-green-600" : "text-gray-400"
              )}>
                ✓ {passedTests}
              </span>
              <span className={cn(
                "font-semibold",
                failedTests > 0 ? "text-red-600" : "text-gray-400"
              )}>
                ✗ {failedTests}
              </span>
              {errorTests > 0 && (
                <span className="font-semibold text-orange-600">
                  ⚠ {errorTests}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Run Tests Button */}
      {enabledTests.length > 0 && (
        <div className="border-b border-gray-200 p-3">
          <button
            onClick={handleRunTests}
            disabled={isRunning}
            className={cn(
              'w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              isRunning
                ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            )}
          >
            {isRunning ? 'Running Tests...' : `Run ${enabledTests.length} Test${enabledTests.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Test List */}
      <div className="flex-1 overflow-y-auto p-4">
        {testCasesList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 text-4xl text-gray-300">🧪</div>
            <p className="mb-1 text-sm font-medium text-gray-600">No tests yet</p>
            <p className="text-xs text-gray-500">
              Create a test case to verify your circuit
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {testCasesList.map((testCase) => (
              <TestResultDisplay
                key={testCase.id}
                testCase={testCase}
                result={results[testCase.id]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer - New Test Button */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={handleNewTest}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
        >
          + New Test Case
        </button>
      </div>
    </div>
  );
}
