/**
 * TestbenchLoader Component
 *
 * UI for loading and compiling testbenches.
 *
 * Features:
 * - Text area for testbench DSL input
 * - Parse and compile button
 * - Error display
 * - Load testbench into execution
 */

'use client';

import React, { useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTestbenchStore } from '../stores/testbench-store';
import { useComponentLibraryStore } from '../stores';
import { useCircuitStore } from '../stores/circuit-store';
import { parseDSL } from '../../dsl/parser';
import { compileTestbenchToIR, ComponentNotFoundError } from '../../dsl/compiler';
import type { TestbenchDef } from '../../dsl/types/testbench-ast';

export function TestbenchLoader() {
  const [dslInput, setDslInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadTestbench = useTestbenchStore((state) => state.loadTestbench);
  const componentLibrary = useComponentLibraryStore();
  const setCircuit = useCircuitStore((state) => state.setCircuit);

  const handleLoad = () => {
    setError(null);
    setIsLoading(true);

    try {
      // Step 1: Parse DSL
      const { ast, errors } = parseDSL(dslInput, 'testbench.dsl');

      if (errors.length > 0) {
        const errorMessages = errors
          .map((e) => `${e.severity.toUpperCase()}: ${e.message} at line ${e.location.start.line}`)
          .join('\n');
        setError(`Parse errors:\n${errorMessages}`);
        setIsLoading(false);
        return;
      }

      // Step 2: Extract testbench definition
      if (!ast.testbenches || ast.testbenches.length === 0) {
        setError('No testbench found in DSL. Make sure to use "testbench" keyword.');
        setIsLoading(false);
        return;
      }

      const testbenchAst = ast.testbenches[0] as TestbenchDef;

      // Step 3: Compile testbench to IR
      try {
        const testbenchIR = compileTestbenchToIR(testbenchAst, {
          resolveComponent: componentLibrary.resolveComponent,
          getAllPrimitiveNames: componentLibrary.getAllPrimitiveNames,
          getAllStandardNames: componentLibrary.getAllStandardNames,
          getAllUserNames: componentLibrary.getAllUserNames,
          registerUser: componentLibrary.registerUser,
        });

        // Step 4: Load into testbench store
        loadTestbench(testbenchIR);

        // Step 5: Load the testbench circuit into the visual editor
        setCircuit(testbenchIR.circuit);

        // Clear input on success
        setDslInput('');
        setError(null);
      } catch (compileError) {
        if (compileError instanceof ComponentNotFoundError) {
          setError(compileError.message);
        } else if (compileError instanceof Error) {
          setError(`Compilation error: ${compileError.message}`);
        } else {
          setError('Unknown compilation error');
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(`Error: ${err.message}`);
      } else {
        setError('Unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Testbench DSL:</label>
        <textarea
          value={dslInput}
          onChange={(e) => setDslInput(e.target.value)}
          placeholder={`testbench CounterTest {
  use circuit Counter as dut
  clock clk

  input reset: Bit
  input enable: Bit
  output count: Bus[4]

  impl {
    stimulus on clk {
      at 0: reset = 1
      at 1: reset = 0, enable = 1
      at 2..10: enable = 1
    }

    capture {
      signals: [reset, enable, count]
      format: vcd
      filename: "counter_test.vcd"
    }
  }
}`}
          className="w-full h-64 font-mono text-xs p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-red-700 text-sm">Error</div>
            <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap font-mono">
              {error}
            </pre>
          </div>
        </div>
      )}

      {/* Load Button */}
      <Button
        onClick={handleLoad}
        disabled={!dslInput.trim() || isLoading}
        className="w-full gap-2"
      >
        <Upload className="h-4 w-4" />
        {isLoading ? 'Loading...' : 'Load Testbench'}
      </Button>

      {/* Usage Instructions */}
      <div className="text-xs text-gray-500 space-y-1">
        <div className="font-medium">How to use:</div>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li>Load the circuit (e.g., Counter.dsl) first</li>
          <li>Paste testbench DSL above</li>
          <li>Click "Load Testbench"</li>
          <li>Use clock controls to run the test</li>
          <li>Download VCD when complete</li>
        </ol>
      </div>
    </div>
  );
}
