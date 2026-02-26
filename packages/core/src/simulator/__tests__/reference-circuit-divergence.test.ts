/**
 * Reference Circuit Divergence Test
 *
 * Validates that each primitive's reference circuit produces the same outputs
 * as its behavioral evaluator. This catches drift if someone edits an evaluator
 * but forgets to update the reference circuit (or vice versa).
 *
 * For each primitive with a referenceCircuit:
 * 1. Compile the reference circuit DSL
 * 2. Feed random input vectors to both the behavioral evaluator and the compiled circuit
 * 3. Assert outputs match (by position, since DSL port names may differ due to keywords)
 */

import { describe, it, expect } from 'vitest';
import {
  PRIMITIVE_DEFINITIONS,
  createComponentLibrary,
  generatePrimitives,
  createSimulatorFromCircuit,
  TOP_LEVEL_NODE,
} from '../index.js';
import { compileDSL } from '../../dsl/index.js';
import type { ComponentLibrary as DSLComponentLibrary } from '../../dsl/index.js';
import type { BitValue, BusValue } from '../../types/circuit.js';

// Build a component library from all primitives.
// Additional circuits (helpers from multi-circuit reference DSLs) are
// added dynamically via addCircuit during compilation.
const primitiveCircuits = generatePrimitives(PRIMITIVE_DEFINITIONS);
const allCircuits = [...primitiveCircuits];
const library = createComponentLibrary(primitiveCircuits);

const dslLibrary: DSLComponentLibrary = {
  getCircuit: (name: string) => library.resolveComponent(name),
  hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
  addCircuit: (circuit) => {
    allCircuits.push(circuit);
    // Rebuild library so subsequent circuits and simulation can resolve it
    const rebuilt = createComponentLibrary(allCircuits);
    dslLibrary.getCircuit = (name: string) => rebuilt.resolveComponent(name);
    dslLibrary.hasCircuit = (name: string) => rebuilt.resolveComponent(name) !== undefined;
  },
};

function randomBitValue(): boolean {
  return Math.random() > 0.5;
}

function randomBusValue(width: number): number {
  const max = width >= 32 ? 0xFFFFFFFF : (1 << width) - 1;
  return Math.floor(Math.random() * (max + 1));
}

/** Normalize a value to a number for comparison (true→1, false→0) */
function normalize(v: BitValue | BusValue | undefined): number {
  if (v === undefined) return -999;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}

describe('Reference Circuit Divergence', () => {
  for (const [name, def] of Object.entries(PRIMITIVE_DEFINITIONS)) {
    if (!def.referenceCircuit) continue;

    it(`${name}: reference circuit compiles without errors`, () => {
      const source = typeof def.referenceCircuit!.source === 'function'
        ? def.referenceCircuit!.source({})
        : def.referenceCircuit!.source;
      const { circuits, errors } = compileDSL(source, dslLibrary);
      expect(errors).toEqual([]);
      expect(circuits.length).toBeGreaterThan(0);
    });

    it(`${name}: reference circuit matches behavioral evaluator`, () => {
      // Compile the reference circuit
      const source = typeof def.referenceCircuit!.source === 'function'
        ? def.referenceCircuit!.source({})
        : def.referenceCircuit!.source;
      const { circuits, errors } = compileDSL(source, dslLibrary);
      if (errors.length > 0) {
        throw new Error(`Compilation failed: ${errors.map(e => e.message).join(', ')}`);
      }

      const refCircuit = circuits[circuits.length - 1];

      // Build library with the reference circuit included
      const allCircuits = [...primitiveCircuits, ...circuits];
      const testLibrary = createComponentLibrary(allCircuits);

      // The reference circuit may use different port names than the primitive
      // (e.g., 'data' instead of 'in' because 'in' is a DSL keyword).
      // Map by position: primitive inputs[i] ↔ refCircuit inputs[i]
      const inputMapping: Array<{ primName: string; refName: string; portType: { kind: string; width?: number } }> = [];
      for (let i = 0; i < def.inputs.length; i++) {
        inputMapping.push({
          primName: def.inputs[i].name,
          refName: refCircuit.inputs[i].name,
          portType: def.inputs[i].portType,
        });
      }
      const outputMapping: Array<{ primName: string; refName: string }> = [];
      for (let i = 0; i < def.outputs.length; i++) {
        outputMapping.push({
          primName: def.outputs[i].name,
          refName: refCircuit.outputs[i].name,
        });
      }

      // Run N random test vectors
      const NUM_TESTS = 50;
      for (let i = 0; i < NUM_TESTS; i++) {
        // Generate random inputs matching the primitive's port types
        const evalInputs = new Map<string, BitValue | BusValue>();
        const simInputValues = new Map<string, BitValue | BusValue>();

        for (const mapping of inputMapping) {
          let value: BitValue | BusValue;
          if (mapping.portType.kind === 'bit') {
            value = randomBitValue();
          } else {
            value = randomBusValue((mapping.portType as { kind: 'bus'; width: number }).width);
          }
          evalInputs.set(mapping.primName, value);
          simInputValues.set(mapping.refName, value);
        }

        // Add parameter defaults as __param entries for behavioral evaluator
        if (def.parameters) {
          for (const param of def.parameters) {
            evalInputs.set(`__${param.name}`, param.defaultValue as BitValue | BusValue);
          }
        }

        const evalResult = def.evaluator.evaluate(evalInputs);

        // Create a fresh simulator and set inputs
        const sim = createSimulatorFromCircuit(refCircuit, testLibrary);
        for (const [inputName, value] of simInputValues) {
          sim.setInput(inputName, value);
        }

        // Run combinational propagation
        const simResult = sim.runCombinational();

        // Compare outputs by position
        for (const mapping of outputMapping) {
          const evalValue = evalResult.get(mapping.primName);
          const simValue = simResult.portValues.get(`${TOP_LEVEL_NODE}.${mapping.refName}`);

          const ne = normalize(evalValue);
          const ns = normalize(simValue);

          if (ns !== ne) {
            throw new Error(
              `${name} output "${mapping.primName}" mismatch at test ${i}: ` +
              `eval=${ne}, sim=${ns}, ` +
              `inputs=${JSON.stringify(Object.fromEntries(evalInputs))}`
            );
          }
        }
      }
    });
  }
});
