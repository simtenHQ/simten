/**
 * TestResultDisplay Component
 *
 * Displays a single test case with its result status.
 */

'use client';

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { TestCase, TestResult } from '../types/testing';
import { useTestStore } from '../stores/test-store';

interface TestResultDisplayProps {
  testCase: TestCase;
  result?: TestResult;
}

export function TestResultDisplay({ testCase, result }: TestResultDisplayProps) {
  const removeTestCase = useTestStore((state) => state.removeTestCase);
  const toggleTestCase = useTestStore((state) => state.toggleTestCase);
  const duplicateTestCase = useTestStore((state) => state.duplicateTestCase);
  const setEditingTestId = useTestStore((state) => state.setEditingTestId);

  const status = result?.status || 'pending';

  // Determine border color and status icon based on result
  const borderColor = {
    passed: 'border-green-500',
    failed: 'border-red-500',
    error: 'border-orange-500',
    running: 'border-blue-500',
    pending: 'border-gray-300',
  }[status];

  const bgColor = {
    passed: 'bg-green-50',
    failed: 'bg-red-50',
    error: 'bg-orange-50',
    running: 'bg-blue-50',
    pending: 'bg-white',
  }[status];

  const statusIcon = {
    passed: '✓',
    failed: '✗',
    error: '⚠',
    running: '⟳',
    pending: '○',
  }[status];

  const statusColor = {
    passed: 'text-green-600',
    failed: 'text-red-600',
    error: 'text-orange-600',
    running: 'text-blue-600',
    pending: 'text-gray-400',
  }[status];

  const handleEdit = useCallback(() => {
    setEditingTestId(testCase.id);
  }, [testCase.id, setEditingTestId]);

  const handleDuplicate = useCallback(() => {
    duplicateTestCase(testCase.id);
  }, [testCase.id, duplicateTestCase]);

  const handleToggle = useCallback(() => {
    toggleTestCase(testCase.id);
  }, [testCase.id, toggleTestCase]);

  const handleDelete = useCallback(() => {
    if (confirm(`Delete test "${testCase.name}"?`)) {
      removeTestCase(testCase.id);
    }
  }, [testCase.id, testCase.name, removeTestCase]);

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-3 transition-all',
        borderColor,
        bgColor,
        !testCase.enabled && 'opacity-60'
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className={cn('text-lg font-bold', statusColor)}>
            {statusIcon}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 truncate">
              {testCase.name}
            </h3>
            {testCase.description && (
              <p className="text-xs text-gray-600 line-clamp-2">
                {testCase.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Test Values */}
      <div className="mb-2 space-y-1 text-xs">
        {/* Inputs */}
        {testCase.inputs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="font-medium text-gray-600">In:</span>
            {testCase.inputs.map((input, idx) => (
              <span key={idx} className="rounded bg-gray-200 px-1.5 py-0.5 font-mono">
                {input.label}={input.value ? '1' : '0'}
              </span>
            ))}
          </div>
        )}

        {/* Outputs */}
        {testCase.outputs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="font-medium text-gray-600">Out:</span>
            {testCase.outputs.map((output, idx) => (
              <span key={idx} className="rounded bg-gray-200 px-1.5 py-0.5 font-mono">
                {output.label}={output.value ? '1' : '0'}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Failure Details */}
      {result && result.status === 'failed' && result.comparisons && (
        <div className="mb-2 rounded border border-red-300 bg-red-50 p-2">
          <p className="mb-1 text-xs font-medium text-red-800">Failed outputs:</p>
          <div className="space-y-0.5">
            {result.comparisons
              .filter(comp => !comp.passed)
              .map((comp, idx) => (
                <div key={idx} className="text-xs text-red-700">
                  <span className="font-mono font-semibold">{comp.label}</span>:
                  expected <span className="font-mono">{comp.expected ? '1' : '0'}</span>,
                  got <span className="font-mono">{comp.actual ? '1' : '0'}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {result && result.status === 'error' && result.errorMessage && (
        <div className="mb-2 rounded border border-orange-300 bg-orange-50 p-2">
          <p className="text-xs font-medium text-orange-800">Error:</p>
          <p className="text-xs text-orange-700">{result.errorMessage}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1">
        <button
          onClick={handleEdit}
          className="rounded px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
          title="Edit"
        >
          Edit
        </button>
        <button
          onClick={handleDuplicate}
          className="rounded px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
          title="Duplicate"
        >
          Duplicate
        </button>
        <button
          onClick={handleToggle}
          className="rounded px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
          title={testCase.enabled ? 'Disable' : 'Enable'}
        >
          {testCase.enabled ? 'Disable' : 'Enable'}
        </button>
        <button
          onClick={handleDelete}
          className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
          title="Delete"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
