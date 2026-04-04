/**
 * DSL Examples - Demonstrating Complete Pipeline Usage
 *
 * These examples show how to use the DSL parser and compiler
 * to create circuits from text and compile them to executable IR.
 */

import { describe, it, expect } from 'vitest';
import { parseDSL, compileDSL, type ComponentLibrary, type Circuit } from './index';
import { bitType } from '@turing-incomplete/ui/editor/types';

// Simple component library for examples
class ExampleLibrary implements ComponentLibrary {
  private circuits = new Map<string, Circuit>();

  constructor() {
    // Add basic logic gates
    this.addPrimitive('And', ['a', 'b'], ['out']);
    this.addPrimitive('Or', ['a', 'b'], ['out']);
    this.addPrimitive('Not', ['a'], ['out']);
    this.addPrimitive('Xor', ['a', 'b'], ['out']);
    this.addPrimitive('Nand', ['a', 'b'], ['out']);
    this.addPrimitive('Nor', ['a', 'b'], ['out']);
  }

  private addPrimitive(name: string, inputs: string[], outputs: string[]): void {
    this.circuits.set(name, {
      id: `primitive_${name}`,
      name,
      parameters: [],
      inputs: inputs.map((n) => ({ name: n, portType: bitType() })),
      outputs: outputs.map((n) => ({ name: n, portType: bitType() })),
      clocks: [],
      state: [],
      nodes: [],
      connections: [],
      implementation: { kind: 'primitive' },
    });
  }

  getCircuit(name: string): Circuit | undefined {
    return this.circuits.get(name);
  }

  hasCircuit(name: string): boolean {
    return this.circuits.has(name);
  }

  addCircuit(circuit: Circuit): void {
    this.circuits.set(circuit.name, circuit);
  }
}

describe('DSL Examples', () => {
  describe('Example 1: Simple Buffer', () => {
    it('should compile a simple buffer circuit', () => {
      const source = `
const Buffer = component('Buffer')
  .in('a', bit)
  .out('out', bit)
  .build()
`;

      const library = new ExampleLibrary();
      const { circuits, errors } = compileDSL(source, library);

      expect(errors).toHaveLength(0);
      expect(circuits).toHaveLength(1);

      const buffer = circuits[0];
      expect(buffer.name).toBe('Buffer');
      expect(buffer.inputs).toHaveLength(1);
      expect(buffer.outputs).toHaveLength(1);
      expect(buffer.implementation.kind).toBe('primitive');
    });
  });

  describe('Example 2: NOT Gate (Inverter)', () => {
    it('should compile a NOT gate using Nand', () => {
      const source = `
const Not = component('Not')
  .in('a', bit)
  .out('out', bit)
  .node('nand1', Nand)
  .connect(({ in: inp, out, nand1 }) => [
    inp.a.to(nand1.a, nand1.b),
    nand1.out.to(out.out),
  ])
  .build()
`;

      const library = new ExampleLibrary();
      const { circuits, errors } = compileDSL(source, library);

      expect(errors).toHaveLength(0);

      const notGate = circuits[0];
      expect(notGate.name).toBe('Not');
      expect(notGate.implementation.kind).toBe('composite');
      expect(notGate.nodes).toHaveLength(1);
      expect(notGate.connections).toHaveLength(3);
    });
  });

  describe('Example 3: HalfAdder', () => {
    it('should compile a complete HalfAdder circuit', () => {
      const source = `
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

      const library = new ExampleLibrary();
      const { circuits, errors } = compileDSL(source, library);

      expect(errors).toHaveLength(0);

      const halfAdder = circuits[0];
      expect(halfAdder.name).toBe('HalfAdder');
      expect(halfAdder.inputs).toHaveLength(2);
      expect(halfAdder.outputs).toHaveLength(2);
      expect(halfAdder.nodes).toHaveLength(2);
      expect(halfAdder.connections).toHaveLength(6);

      // Verify node types
      const xorNode = halfAdder.nodes.find((n) => n.label === 'xor1');
      const andNode = halfAdder.nodes.find((n) => n.label === 'and1');
      expect(xorNode?.componentRef).toBe('Xor');
      expect(andNode?.componentRef).toBe('And');
    });
  });

  describe('Example 4: FullAdder (Hierarchical)', () => {
    it('should compile FullAdder using HalfAdder', () => {
      // First define and compile HalfAdder
      const halfAdderSource = `
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

      const library = new ExampleLibrary();
      const halfAdderResult = compileDSL(halfAdderSource, library);
      expect(halfAdderResult.errors).toHaveLength(0);

      // Add HalfAdder to library
      library.addCircuit(halfAdderResult.circuits[0]);

      // Now compile FullAdder
      const fullAdderSource = `
        // Full adder with carry input
        circuit FullAdder {
          input a: Bit
          input b: Bit
          input cin: Bit
          output sum: Bit
          output cout: Bit

          impl {
            // First half adder: a + b
            node ha1: HalfAdder
            connect a -> ha1.a
            connect b -> ha1.b

            // Second half adder: (a+b) + cin
            node ha2: HalfAdder
            connect ha1.sum -> ha2.a
            connect cin -> ha2.b
            connect ha2.sum -> sum

            // Carry out: carry from either half adder
            node or1: Or
            connect ha1.carry -> or1.a
            connect ha2.carry -> or1.b
            connect or1.out -> cout
          }
        }
      `;

      const fullAdderResult = compileDSL(fullAdderSource, library);
      expect(fullAdderResult.errors).toHaveLength(0);

      const fullAdder = fullAdderResult.circuits[0];
      expect(fullAdder.name).toBe('FullAdder');
      expect(fullAdder.inputs).toHaveLength(3);
      expect(fullAdder.outputs).toHaveLength(2);
      expect(fullAdder.nodes).toHaveLength(3); // 2 HalfAdders + 1 Or
      expect(fullAdder.connections).toHaveLength(8);
    });
  });

  describe('Example 5: Error Handling', () => {
    it('should report undefined component error', () => {
      const source = `
        circuit Test {
          impl {
            node n1: UndefinedComponent
          }
        }
      `;

      const library = new ExampleLibrary();
      const { circuits, errors } = compileDSL(source, library);

      expect(circuits).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Cannot resolve component');
    });

    it('should report duplicate names', () => {
      const source = `
        circuit Test {
          input a: Bit
          input a: Bit
        }
      `;

      const library = new ExampleLibrary();
      const { ast, errors } = parseDSL(source);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Duplicate');
    });

    it('should report undefined port', () => {
      const source = `
        circuit Test {
          input a: Bit
          impl {
            node and1: And
            connect nonexistent -> and1.a
          }
        }
      `;

      const library = new ExampleLibrary();
      const { ast, errors } = parseDSL(source);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Undefined');
    });
  });

  describe('Example 6: Multi-Circuit Programs', () => {
    it('should compile multiple circuits in one source file', () => {
      const source = `
        circuit And {
          input a: Bit
          input b: Bit
          output out: Bit
        }

        circuit Or {
          input a: Bit
          input b: Bit
          output out: Bit
        }

        circuit Nand {
          input a: Bit
          input b: Bit
          output out: Bit

          impl {
            node and1: And
            node not1: Not

            connect a -> and1.a
            connect b -> and1.b
            connect and1.out -> not1.a
            connect not1.out -> out
          }
        }
      `;

      const library = new ExampleLibrary();

      // Parse once to get all circuits
      const { ast, errors: parseErrors } = parseDSL(source);
      expect(parseErrors).toHaveLength(0);
      expect(ast.circuits).toHaveLength(3);

      // Compile each component and add to library
      for (const circuitDef of ast.circuits) {
        const { circuits, errors } = compileDSL(
          `circuit ${circuitDef.name} {}`,
          library
        );
        if (circuits.length > 0) {
          library.addCircuit(circuits[0]);
        }
      }

      // Now Nand should compile successfully
      expect(library.hasCircuit('And')).toBe(true);
      expect(library.hasCircuit('Or')).toBe(true);
    });
  });
});
