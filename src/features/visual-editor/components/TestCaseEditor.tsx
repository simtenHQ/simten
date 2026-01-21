/**
 * TestCaseEditor Component (IR v0.1)
 *
 * Modal for creating and editing test cases.
 *
 * Updated for IR v0.1:
 * - Uses CircuitStore instead of useIRStore
 * - Uses Circuit instead of components/connections
 * - Uses getLabeledSwitches/getLabeledLEDs with Circuit
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTestStore } from '../stores/test-store';
import { useCircuitStore } from '../stores/circuit-store';
import { getLabeledSwitches, getLabeledLEDs } from '../lib/test-runner';
import type { TestValue } from '../types/testing';

export function TestCaseEditor() {
  const editingTestId = useTestStore((state) => state.editingTestId);
  const testCases = useTestStore((state) => state.testCases);
  const addTestCase = useTestStore((state) => state.addTestCase);
  const updateTestCase = useTestStore((state) => state.updateTestCase);
  const setEditingTestId = useTestStore((state) => state.setEditingTestId);
  const circuit = useCircuitStore((state) => state.circuit);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inputs, setInputs] = useState<TestValue[]>([]);
  const [outputs, setOutputs] = useState<TestValue[]>([]);

  const isOpen = editingTestId !== null;
  const isNewTest = editingTestId === 'new';
  const editingTest = !isNewTest && editingTestId ? testCases[editingTestId] : null;

  // Initialize form when opening
  useEffect(() => {
    if (!isOpen || !circuit) {
      return;
    }

    if (isNewTest) {
      // New test - auto-populate from labeled components
      const labeledSwitches = getLabeledSwitches(circuit);
      const labeledLEDs = getLabeledLEDs(circuit);

      setName('');
      setDescription('');
      setInputs(labeledSwitches.map(sw => ({
        label: sw.label,
        value: false,
      })));
      setOutputs(labeledLEDs.map(led => ({
        label: led.label,
        value: false,
      })));
    } else if (editingTest) {
      // Editing existing test
      setName(editingTest.name);
      setDescription(editingTest.description || '');
      setInputs([...editingTest.inputs]);
      setOutputs([...editingTest.outputs]);
    }
  }, [isOpen, isNewTest, editingTest, circuit]);

  const handleClose = useCallback(() => {
    setEditingTestId(null);
  }, [setEditingTestId]);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      alert('Please enter a test name');
      return;
    }

    if (inputs.length === 0 && outputs.length === 0) {
      alert('Please add at least one input or output');
      return;
    }

    if (isNewTest) {
      addTestCase({
        name: name.trim(),
        description: description.trim() || undefined,
        enabled: true,
        inputs,
        outputs,
      });
    } else if (editingTestId) {
      updateTestCase(editingTestId, {
        name: name.trim(),
        description: description.trim() || undefined,
        inputs,
        outputs,
      });
    }

    handleClose();
  }, [name, description, inputs, outputs, isNewTest, editingTestId, addTestCase, updateTestCase, handleClose]);

  const toggleInputValue = useCallback((index: number) => {
    setInputs(prev => prev.map((input, idx) =>
      idx === index ? { ...input, value: !input.value } : input
    ));
  }, []);

  const toggleOutputValue = useCallback((index: number) => {
    setOutputs(prev => prev.map((output, idx) =>
      idx === index ? { ...output, value: !output.value } : output
    ));
  }, []);

  if (!isOpen) {
    return null;
  }

  const hasNoLabeledComponents = inputs.length === 0 && outputs.length === 0;

  return (
    <>
      {/* Modal Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        {/* Modal Content */}
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-gray-200 p-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {isNewTest ? 'New Test Case' : 'Edit Test Case'}
            </h2>
            <p className="text-sm text-gray-500">
              Define input values and expected outputs
            </p>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Warning for no labeled components */}
            {hasNoLabeledComponents && (
              <div className="rounded-lg border border-orange-300 bg-orange-50 p-3">
                <p className="text-sm font-medium text-orange-800">
                  ⚠ No labeled components found
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  Please double-click switches and LEDs in the circuit to add labels before creating tests.
                </p>
              </div>
            )}

            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Test: 0 + 0 = 0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Description Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this test verifies..."
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Inputs Section */}
            {inputs.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Input Values
                </label>
                <div className="space-y-2">
                  {inputs.map((input, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
                      <span className="text-sm font-medium text-gray-900">
                        {input.label}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleInputValue(idx)}
                          className={cn(
                            'h-8 w-12 rounded font-mono text-sm font-bold transition-colors',
                            !input.value
                              ? 'bg-gray-700 text-white'
                              : 'bg-gray-300 text-gray-600'
                          )}
                        >
                          0
                        </button>
                        <button
                          onClick={() => toggleInputValue(idx)}
                          className={cn(
                            'h-8 w-12 rounded font-mono text-sm font-bold transition-colors',
                            input.value
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-300 text-gray-600'
                          )}
                        >
                          1
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outputs Section */}
            {outputs.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Outputs
                </label>
                <div className="space-y-2">
                  {outputs.map((output, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
                      <span className="text-sm font-medium text-gray-900">
                        {output.label}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleOutputValue(idx)}
                          className={cn(
                            'h-8 w-12 rounded font-mono text-sm font-bold transition-colors',
                            !output.value
                              ? 'bg-gray-700 text-white'
                              : 'bg-gray-300 text-gray-600'
                          )}
                        >
                          0
                        </button>
                        <button
                          onClick={() => toggleOutputValue(idx)}
                          className={cn(
                            'h-8 w-12 rounded font-mono text-sm font-bold transition-colors',
                            output.value
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-300 text-gray-600'
                          )}
                        >
                          1
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4 flex justify-end gap-2">
            <button
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={hasNoLabeledComponents}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium text-white',
                hasNoLabeledComponents
                  ? 'cursor-not-allowed bg-gray-400'
                  : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {isNewTest ? 'Create Test' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
