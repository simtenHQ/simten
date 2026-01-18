/**
 * Test Runner - Executes test cases against circuits
 */

import type { IRState, Component, SwitchComponent, LEDComponent } from '../types';
import type { TestCase, TestResult, OutputComparison } from '../types/testing';
import { runSimulationStep } from '../utils/simulator';

/**
 * Find a component by its label
 */
export function findComponentByLabel(
  ir: IRState,
  label: string
): Component | undefined {
  return Object.values(ir.components).find(
    (comp) => comp.label === label
  );
}

/**
 * Get all labeled switches (potential test inputs)
 */
export function getLabeledSwitches(ir: IRState): SwitchComponent[] {
  return Object.values(ir.components).filter(
    (comp): comp is SwitchComponent =>
      comp.type === 'SWITCH' && !!comp.label
  );
}

/**
 * Get all labeled LEDs (potential test outputs)
 */
export function getLabeledLEDs(ir: IRState): LEDComponent[] {
  return Object.values(ir.components).filter(
    (comp): comp is LEDComponent =>
      comp.type === 'LED' && !!comp.label
  );
}

/**
 * Validate a test case against the current circuit
 * Returns error message if invalid, undefined if valid
 */
export function validateTestCase(
  testCase: TestCase,
  ir: IRState
): string | undefined {
  // Check all input labels exist and are switches
  for (const input of testCase.inputs) {
    const component = findComponentByLabel(ir, input.label);

    if (!component) {
      return `Input component with label "${input.label}" not found`;
    }

    if (component.type !== 'SWITCH') {
      return `Input component "${input.label}" is not a switch (found ${component.type})`;
    }
  }

  // Check all output labels exist and are LEDs
  for (const output of testCase.outputs) {
    const component = findComponentByLabel(ir, output.label);

    if (!component) {
      return `Output component with label "${output.label}" not found`;
    }

    if (component.type !== 'LED') {
      return `Output component "${output.label}" is not an LED (found ${component.type})`;
    }
  }

  return undefined;
}

/**
 * Run a single test case
 */
export function runTestCase(
  testCase: TestCase,
  ir: IRState
): TestResult {
  const startTime = performance.now();

  try {
    // Validate test case
    const validationError = validateTestCase(testCase, ir);
    if (validationError) {
      return {
        testCaseId: testCase.id,
        status: 'error',
        errorMessage: validationError,
        executedAt: Date.now(),
        duration: performance.now() - startTime,
      };
    }

    // Clone IR state to avoid mutating original
    const testIR: IRState = {
      components: {},
      connections: { ...ir.connections },
    };

    // Deep clone components
    for (const [id, component] of Object.entries(ir.components)) {
      testIR.components[id] = { ...component } as Component;
    }

    // Set input values (switches)
    for (const input of testCase.inputs) {
      const component = findComponentByLabel(testIR, input.label);
      if (component && component.type === 'SWITCH') {
        (component as SwitchComponent).value = input.value;
      }
    }

    // Run simulation to propagate values
    const simulatedIR = runSimulationStep(testIR);

    // Compare output values (LEDs)
    const comparisons: OutputComparison[] = [];
    let allPassed = true;

    for (const expectedOutput of testCase.outputs) {
      const component = findComponentByLabel(simulatedIR, expectedOutput.label);

      if (component && component.type === 'LED') {
        const actualValue = (component as LEDComponent).value;
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
  ir: IRState
): TestResult[] {
  const enabledTests = testCases.filter(tc => tc.enabled);
  return enabledTests.map(tc => runTestCase(tc, ir));
}
