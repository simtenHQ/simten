/**
 * Test Runner - Executes test cases against circuits (IR v0.1)
 *
 * Updated for flat simulator:
 * - Works with Circuit instead of IRState
 * - Uses Node instead of Component
 * - Uses componentRef instead of type
 * - Elaborates circuit and uses flat simulator
 */

import type { Circuit, Node } from '../../types/circuit';
import type { TestCase, TestResult, OutputComparison } from '../../types/testing';
import { elaborate } from '../elaboration';
import { runFlatCombinationalSimulation } from '../flat-simulator';
import { useComponentLibraryStore } from '../../stores/component-library-store';

interface LabeledSwitch {
  nodeId: string;
  label: string;
}

interface LabeledLED {
  nodeId: string;
  label: string;
}

/**
 * Find a node by its label
 */
export function findNodeByLabel(
  circuit: Circuit,
  label: string
): Node | undefined {
  return circuit.nodes.find((node) => node.label === label);
}

/**
 * Get all labeled switches (potential test inputs)
 */
export function getLabeledSwitches(circuit: Circuit): LabeledSwitch[] {
  return circuit.nodes
    .filter((node) => node.componentRef === 'Switch' && !!node.label)
    .map((node) => ({
      nodeId: node.id,
      label: node.label!,
    }));
}

/**
 * Get all labeled LEDs (potential test outputs)
 */
export function getLabeledLEDs(circuit: Circuit): LabeledLED[] {
  return circuit.nodes
    .filter((node) => node.componentRef === 'Led' && !!node.label)
    .map((node) => ({
      nodeId: node.id,
      label: node.label!,
    }));
}

/**
 * Validate a test case against the current circuit
 * Returns error message if invalid, undefined if valid
 */
export function validateTestCase(
  testCase: TestCase,
  circuit: Circuit
): string | undefined {
  // Check all input labels exist and are switches
  for (const input of testCase.inputs) {
    const node = findNodeByLabel(circuit, input.label);

    if (!node) {
      return `Input component with label "${input.label}" not found`;
    }

    if (node.componentRef !== 'Switch') {
      return `Input component "${input.label}" is not a switch (found ${node.componentRef})`;
    }
  }

  // Check all output labels exist and are LEDs
  for (const output of testCase.outputs) {
    const node = findNodeByLabel(circuit, output.label);

    if (!node) {
      return `Output component with label "${output.label}" not found`;
    }

    if (node.componentRef !== 'Led') {
      return `Output component "${output.label}" is not an LED (found ${node.componentRef})`;
    }
  }

  return undefined;
}

/**
 * Run a single test case
 */
export function runTestCase(
  testCase: TestCase,
  circuit: Circuit
): TestResult {
  const startTime = performance.now();

  try {
    // Validate test case
    const validationError = validateTestCase(testCase, circuit);
    if (validationError) {
      return {
        testCaseId: testCase.id,
        status: 'error',
        errorMessage: validationError,
        executedAt: Date.now(),
        duration: performance.now() - startTime,
      };
    }

    // Clone circuit to avoid mutating original
    const testCircuit: Circuit = {
      ...circuit,
      nodes: circuit.nodes.map((node) => ({
        ...node,
        arguments: { ...node.arguments },
        inputs: [...node.inputs],
        outputs: [...node.outputs],
        clocks: [...node.clocks],
      })),
      connections: [...circuit.connections],
    };

    // Set input values (switches)
    for (const input of testCase.inputs) {
      const node = findNodeByLabel(testCircuit, input.label);
      if (node && node.componentRef === 'Switch') {
        // Update the switch's value argument
        node.arguments.value = input.value;
      }
    }

    // Elaborate and run flat simulation to propagate values
    const library = useComponentLibraryStore.getState();
    const flatCircuit = elaborate(testCircuit, library);
    const simulationResult = runFlatCombinationalSimulation(flatCircuit);

    // Compare output values (LEDs)
    const comparisons: OutputComparison[] = [];
    let allPassed = true;

    for (const expectedOutput of testCase.outputs) {
      const node = findNodeByLabel(testCircuit, expectedOutput.label);

      if (node && node.componentRef === 'Led') {
        // Read LED value from simulation portValues
        // LED has one input port named 'in'
        const ledInputPortKey = `${node.id}.in`;
        const actualValue = Boolean(simulationResult.portValues.get(ledInputPortKey) ?? false);
        const passed = actualValue === expectedOutput.value;

        comparisons.push({
          label: expectedOutput.label,
          expected: expectedOutput.value,
          actual: actualValue,
          passed,
        });

        if (!passed) {
          allPassed = false;
        }
      }
    }

    return {
      testCaseId: testCase.id,
      status: allPassed ? 'passed' : 'failed',
      comparisons,
      executedAt: Date.now(),
      duration: performance.now() - startTime,
    };

  } catch (error) {
    return {
      testCaseId: testCase.id,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      executedAt: Date.now(),
      duration: performance.now() - startTime,
    };
  }
}

/**
 * Run all enabled test cases
 */
export function runAllTests(
  testCases: TestCase[],
  circuit: Circuit
): TestResult[] {
  const enabledTests = testCases.filter(tc => tc.enabled);
  return enabledTests.map(tc => runTestCase(tc, circuit));
}
