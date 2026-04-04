/**
 * DSL Editor Integration Tests
 *
 * Tests the full flow: DSL text → Compile → Component Library
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useComponentLibraryStore } from '@turing-incomplete/ui/editor/stores';
import { PRIMITIVES } from '@turing-incomplete/ui/editor/lib';
import { compileDSL } from '../index';

describe('DSL Editor Integration', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useComponentLibraryStore.getState();
    store.clearAll();

    // Register primitives
    const primitives = PRIMITIVES as any[];
    store.registerPrimitives(primitives);
  });

  it('should compile a simple AND gate and register it', () => {
    const dslCode = `
const MyAnd = component('MyAnd')
  .in('a', bit)
  .in('b', bit)
  .out('out', bit)
  .node('and1', And)
  .connect(({ in: inp, out, and1 }) => [
    inp.a.to(and1.a),
    inp.b.to(and1.b),
    and1.out.to(out.out),
  ])
  .build()
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
const HalfAdder = component('HalfAdder')
  .in('a', bit)
  .in('b', bit)
  .out('sum', bit)
  .out('carry', bit)
  .node('xor1', Xor)
  .node('and1', And)
  .connect(({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ])
  .build()
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
    expect(circuit.connections).toHaveLength(6); // 2 inputs to each gate + 2 outputs
  });

  it('should detect errors in invalid DSL code', () => {
    const dslCode = `
      circuit Invalid {
        input a: Bit
        output out: Bit

        impl {
          node ng1: NonExistentGate
          connect a -> ng1.a
          connect ng1.out -> out
        }
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
const FirstComponent = component('FirstComponent')
  .in('a', bit)
  .out('out', bit)
  .node('buf1', Buffer)
  .connect(({ in: inp, out, buf1 }) => [
    inp.a.to(buf1.in),
    buf1.out.to(out.out),
  ])
  .build()

const SecondComponent = component('SecondComponent')
  .in('x', bit)
  .out('y', bit)
  .node('not1', Not)
  .connect(({ in: inp, out, not1 }) => [
    inp.x.to(not1.in),
    not1.out.to(out.y),
  ])
  .build()
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
const HalfAdder = component('HalfAdder')
  .in('a', bit)
  .in('b', bit)
  .out('sum', bit)
  .out('carry', bit)
  .node('xor1', Xor)
  .node('and1', And)
  .connect(({ in: inp, out, xor1, and1 }) => [
    inp.a.to(xor1.a, and1.a),
    inp.b.to(xor1.b, and1.b),
    xor1.out.to(out.sum),
    and1.out.to(out.carry),
  ])
  .build()
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
      circuit FullAdder {
        input a: Bit
        input b: Bit
        input cin: Bit
        output sum: Bit
        output cout: Bit

        impl {
          node ha1: HalfAdder
          node ha2: HalfAdder
          node orGate: Or

          connect a -> ha1.a
          connect b -> ha1.b
          connect ha1.sum -> ha2.a
          connect cin -> ha2.b
          connect ha2.sum -> sum
          connect ha1.carry -> orGate.a
          connect ha2.carry -> orGate.b
          connect orGate.out -> cout
        }
      }
    `;

    const result2 = compileDSL(fullAdderCode, library, 'test2.dsl');
    expect(result2.errors).toHaveLength(0);
    expect(result2.circuits).toHaveLength(1);

    const fullAdder = result2.circuits[0];
    expect(fullAdder.nodes).toHaveLength(3); // 2 HalfAdders + 1 Or
  });
});
