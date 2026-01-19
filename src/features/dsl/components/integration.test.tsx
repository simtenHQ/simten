/**
 * DSL Editor Integration Tests
 *
 * Tests the full flow: DSL text → Compile → Component Library
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useComponentLibraryStore } from '@/features/visual-editor/stores/component-library-store';
import { compileDSL } from '../index';
import { getPrimitives } from '@/features/visual-editor/lib/primitives';

describe('DSL Editor Integration', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useComponentLibraryStore.getState();
    store.clearAll();

    // Register primitives
    const primitives = getPrimitives();
    store.registerPrimitives(primitives);
  });

  it('should compile a simple AND gate and register it', () => {
    const dslCode = `
      component MyAnd {
        input a: bit
        input b: bit
        output out: bit

        gate And(a, b) -> out
      }
    `;

    const store = useComponentLibraryStore.getState();

    // Create component library for compiler
    const library = {
      getCircuit: (name: string) => store.resolveComponent(name),
      hasCircuit: (name: string) => store.resolveComponent(name) !== undefined,
    };

    // Compile
    const result = compileDSL(dslCode, library, 'test.dsl');

    // Should have no errors
    expect(result.errors).toHaveLength(0);
    expect(result.circuits).toHaveLength(1);

    // Register in library
    const circuit = result.circuits[0];
    store.registerUser(circuit);

    // Should be able to retrieve it
    const retrieved = store.getUser('MyAnd');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('MyAnd');
    expect(retrieved?.inputs).toHaveLength(2);
    expect(retrieved?.outputs).toHaveLength(1);
  });

  it('should compile a composite component using primitives', () => {
    const dslCode = `
      component HalfAdder {
        input a: bit
        input b: bit
        output sum: bit
        output carry: bit

        gate Xor(a, b) -> sum
        gate And(a, b) -> carry
      }
    `;

    const store = useComponentLibraryStore.getState();

    const library = {
      getCircuit: (name: string) => store.resolveComponent(name),
      hasCircuit: (name: string) => store.resolveComponent(name) !== undefined,
    };

    const result = compileDSL(dslCode, library, 'test.dsl');

    expect(result.errors).toHaveLength(0);
    expect(result.circuits).toHaveLength(1);

    const circuit = result.circuits[0];
    expect(circuit.name).toBe('HalfAdder');
    expect(circuit.nodes).toHaveLength(2); // Two gate instances
    expect(circuit.connections).toHaveLength(4); // 2 inputs to each gate
  });

  it('should detect errors in invalid DSL code', () => {
    const dslCode = `
      component Invalid {
        input a: bit
        output out: bit

        gate NonExistentGate(a) -> out
      }
    `;

    const store = useComponentLibraryStore.getState();

    const library = {
      getCircuit: (name: string) => store.resolveComponent(name),
      hasCircuit: (name: string) => store.resolveComponent(name) !== undefined,
    };

    const result = compileDSL(dslCode, library, 'test.dsl');

    // Should have compilation errors
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.circuits).toHaveLength(0);
  });

  it('should handle multiple components in one DSL file', () => {
    const dslCode = `
      component FirstComponent {
        input a: bit
        output out: bit
        gate Buffer(a) -> out
      }

      component SecondComponent {
        input x: bit
        output y: bit
        gate Not(x) -> y
      }
    `;

    const store = useComponentLibraryStore.getState();

    const library = {
      getCircuit: (name: string) => store.resolveComponent(name),
      hasCircuit: (name: string) => store.resolveComponent(name) !== undefined,
    };

    const result = compileDSL(dslCode, library, 'test.dsl');

    expect(result.errors).toHaveLength(0);
    expect(result.circuits).toHaveLength(2);

    // Register both
    result.circuits.forEach((circuit) => store.registerUser(circuit));

    expect(store.getUser('FirstComponent')).toBeDefined();
    expect(store.getUser('SecondComponent')).toBeDefined();
  });

  it('should allow using user-defined components in other components', () => {
    const store = useComponentLibraryStore.getState();

    // First, define and register a half adder
    const halfAdderCode = `
      component HalfAdder {
        input a: bit
        input b: bit
        output sum: bit
        output carry: bit
        gate Xor(a, b) -> sum
        gate And(a, b) -> carry
      }
    `;

    const library = {
      getCircuit: (name: string) => store.resolveComponent(name),
      hasCircuit: (name: string) => store.resolveComponent(name) !== undefined,
    };

    const result1 = compileDSL(halfAdderCode, library, 'test1.dsl');
    expect(result1.errors).toHaveLength(0);
    result1.circuits.forEach((c) => store.registerUser(c));

    // Now use HalfAdder in a FullAdder
    const fullAdderCode = `
      component FullAdder {
        input a: bit
        input b: bit
        input cin: bit
        output sum: bit
        output cout: bit

        instance HalfAdder ha1
        instance HalfAdder ha2
        instance Or orGate

        connect a -> ha1.a
        connect b -> ha1.b
        connect ha1.sum -> ha2.a
        connect cin -> ha2.b
        connect ha2.sum -> sum
        connect ha1.carry -> orGate.a
        connect ha2.carry -> orGate.b
        connect orGate.out -> cout
      }
    `;

    const result2 = compileDSL(fullAdderCode, library, 'test2.dsl');
    expect(result2.errors).toHaveLength(0);
    expect(result2.circuits).toHaveLength(1);

    const fullAdder = result2.circuits[0];
    expect(fullAdder.nodes).toHaveLength(3); // 2 HalfAdders + 1 Or
  });
});
