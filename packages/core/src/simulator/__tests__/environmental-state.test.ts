/**
 * Environmental State Tests
 *
 * Tests captureEnvironmentalState / restoreEnvironmentalState
 * for time-travel debugging.
 */

import { describe, it, expect } from 'vitest';
import {
  captureEnvironmentalState,
  restoreEnvironmentalState,
  type EnvironmentalStateValue,
  PRIMITIVES,
} from '../index.js';
import { compileDSL } from '../../dsl/index.js';
import type { Circuit, Node } from '../../types/circuit.js';

function createMutableLibrary() {
  const circuitMap = new Map<string, Circuit>();
  for (const c of PRIMITIVES as Circuit[]) circuitMap.set(c.name, c);
  return {
    resolveCircuit: (name: string) => circuitMap.get(name),
    getAllPrimitiveNames: () => Array.from(circuitMap.entries())
      .filter(([, c]) => c.implementation.kind === 'primitive').map(([n]) => n),
    getCircuit: (name: string) => circuitMap.get(name),
    hasCircuit: (name: string) => circuitMap.has(name),
    addCircuit: (circuit: Circuit) => { circuitMap.set(circuit.name, circuit); },
  };
}

describe('Environmental State', () => {
  it('captures switch and input values', () => {
    const lib = createMutableLibrary();
    const result = compileDSL(`
      circuit Demo {
        impl {
          node sw: Switch
          node inp: Input(value=42)
          node led: Led
          connect sw.out -> led.in
        }
      }
    `, lib, 'test.dsl');

    const circuit = result.circuits[0];
    const state = captureEnvironmentalState(circuit);

    // Input(value=42) has value=42.
    // Switch without explicit value has value=undefined (not yet toggled).
    // Both are captured because their primitive def has environmentalState='value'.
    expect(state.size).toBeGreaterThanOrEqual(1);
    let inpValue: EnvironmentalStateValue | undefined;
    for (const [id, val] of state) {
      if (id.includes('inp')) inpValue = val;
    }
    expect(inpValue).toBe(42);
  });

  it('does not capture non-environmental nodes', () => {
    const lib = createMutableLibrary();
    const result = compileDSL(`
      circuit Demo {
        impl {
          node and1: And
          node led: Led
          connect and1.out -> led.in
        }
      }
    `, lib, 'test.dsl');

    const circuit = result.circuits[0];
    const state = captureEnvironmentalState(circuit);

    // And and Led have no environmental state
    expect(state.size).toBe(0);
  });

  it('restore round-trips correctly', () => {
    const lib = createMutableLibrary();
    const result = compileDSL(`
      circuit Demo {
        impl {
          node sw: Switch
          node inp: Input(value=10)
          node led: Led
          connect sw.out -> led.in
        }
      }
    `, lib, 'test.dsl');

    const circuit = result.circuits[0];

    // Capture initial state
    const captured = captureEnvironmentalState(circuit);

    // Modify the circuit (simulate user toggling switch)
    const swNode = circuit.nodes.find(n => n.componentRef === 'Switch')!;
    swNode.arguments.value = true;
    const inpNode = circuit.nodes.find(n => n.componentRef === 'Input')!;
    inpNode.arguments.value = 99;

    // Verify modified
    expect(swNode.arguments.value).toBe(true);
    expect(inpNode.arguments.value).toBe(99);

    // Restore original state
    const updates: Array<{ nodeId: string; args: Record<string, unknown> }> = [];
    restoreEnvironmentalState(circuit, captured, (nodeId, update) => {
      updates.push({ nodeId, args: (update as { arguments: Record<string, unknown> }).arguments });
    });

    // Verify restore was called — at least the Input with value=10
    const inpUpdate = updates.find(u => u.nodeId.includes('inp'));
    expect(inpUpdate).toBeDefined();
    expect(inpUpdate?.args.value).toBe(10);
  });

  it('captured state is cloned (mutation-safe)', () => {
    const lib = createMutableLibrary();
    const result = compileDSL(`
      circuit Demo {
        impl {
          node sw: Switch
          node led: Led
          connect sw.out -> led.in
        }
      }
    `, lib, 'test.dsl');

    const circuit = result.circuits[0];
    const state1 = captureEnvironmentalState(circuit);

    // Modify original circuit
    const swNode = circuit.nodes.find(n => n.componentRef === 'Switch')!;
    swNode.arguments.value = true;

    // Re-capture
    const state2 = captureEnvironmentalState(circuit);

    // Use Input instead — it has a concrete initial value
    const lib2 = createMutableLibrary();
    const result2 = compileDSL(`
      circuit Demo2 {
        impl {
          node inp: Input(value=10)
          node led: Led
          connect inp.out -> led.in
        }
      }
    `, lib2, 'test2.dsl');
    const circuit2 = result2.circuits[0];
    const s1 = captureEnvironmentalState(circuit2);

    // Modify
    circuit2.nodes.find(n => n.componentRef === 'Input')!.arguments.value = 99;
    const s2 = captureEnvironmentalState(circuit2);

    // s1 should still have 10 (cloned), s2 should have 99
    for (const [, val] of s1) expect(val).toBe(10);
    for (const [, val] of s2) expect(val).toBe(99);
  });
});
