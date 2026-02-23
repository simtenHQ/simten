/**
 * DSL Generator Tests - Roundtrip Testing
 *
 * Tests the Circuit IR → DSL code generation.
 * Verifies roundtrip: DSL → Circuit → DSL → Circuit
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { generateDSL, generateDSLMultiple } from './dsl-generator.js';
import { compileDSL } from '../index.js';
import { ComponentLibrary, Circuit } from '../types/index.js';
import { bitType, type Parameter } from '../../types/circuit.js';

// Test component library
class TestLibrary implements ComponentLibrary {
  private circuits = new Map<string, Circuit>();

  constructor() {
    // Add primitive logic gates
    this.addPrimitive('And', ['a', 'b'], ['out']);
    this.addPrimitive('Or', ['a', 'b'], ['out']);
    this.addPrimitive('Not', ['a'], ['out']);
    this.addPrimitive('Xor', ['a', 'b'], ['out']);
    this.addPrimitive('Nand', ['a', 'b'], ['out']);

    // Add components with parameters
    this.addPrimitive('Register', ['data', 'we'], ['q'], ['clk'], [
      { name: 'width', paramType: 'int', defaultValue: 8 }
    ]);
    this.addPrimitive('Incrementer', ['in'], ['out']);
  }

  private addPrimitive(
    name: string,
    inputs: string[],
    outputs: string[],
    clocks: string[] = [],
    parameters: Parameter[] = []
  ): void {
    this.circuits.set(name, {
      id: `primitive_${name}`,
      name,
      parameters,
      inputs: inputs.map((n) => ({ name: n, portType: bitType() })),
      outputs: outputs.map((n) => ({ name: n, portType: bitType() })),
      clocks: clocks.map((n) => ({ name: n })),
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

describe('DSL Generator', () => {
  let library: TestLibrary;

  beforeEach(() => {
    library = new TestLibrary();
  });

  describe('Simple Circuits', () => {
    it('should generate DSL for a primitive circuit', () => {
      const source = `
        circuit Buffer {
          input a: Bit
          output out: Bit
        }
      `;

      const { circuits } = compileDSL(source, library);
      expect(circuits).toHaveLength(1);

      const generated = generateDSL(circuits[0]);

      expect(generated).toContain('circuit Buffer');
      expect(generated).toContain('input a: Bit');
      expect(generated).toContain('output out: Bit');
    });

    it('should generate DSL for a composite circuit', () => {
      const source = `
        circuit Not {
          input a: Bit
          output out: Bit

          impl {
            node nand1: Nand
            connect a -> nand1.a
            connect a -> nand1.b
            connect nand1.out -> out
          }
        }
      `;

      const { circuits, errors } = compileDSL(source, library);
      expect(errors).toHaveLength(0);
      expect(circuits).toHaveLength(1);

      const generated = generateDSL(circuits[0]);

      expect(generated).toContain('circuit Not');
      expect(generated).toContain('input a: Bit');
      expect(generated).toContain('output out: Bit');
      expect(generated).toContain('impl {');
      expect(generated).toContain('node nand1: Nand');
      expect(generated).toContain('connect a -> nand1.a');
      expect(generated).toContain('connect a -> nand1.b');
      expect(generated).toContain('connect nand1.out -> out');
    });

    it('should generate DSL for HalfAdder', () => {
      const source = `
        circuit HalfAdder {
          input a: Bit
          input b: Bit
          output sum: Bit
          output carry: Bit

          impl {
            node xor1: Xor
            connect a -> xor1.a
            connect b -> xor1.b
            connect xor1.out -> sum

            node and1: And
            connect a -> and1.a
            connect b -> and1.b
            connect and1.out -> carry
          }
        }
      `;

      const { circuits, errors } = compileDSL(source, library);
      expect(errors).toHaveLength(0);

      const generated = generateDSL(circuits[0]);

      expect(generated).toContain('circuit HalfAdder');
      expect(generated).toContain('node xor1: Xor');
      expect(generated).toContain('node and1: And');
      expect(generated).toContain('connect a -> xor1.a');
      expect(generated).toContain('connect and1.out -> carry');
    });
  });

  describe('Roundtrip Testing', () => {
    it('should preserve circuit structure through roundtrip', () => {
      const source = `
        circuit HalfAdder {
          input a: Bit
          input b: Bit
          output sum: Bit
          output carry: Bit

          impl {
            node xor1: Xor
            node and1: And

            connect a -> xor1.a
            connect b -> xor1.b
            connect xor1.out -> sum
            connect a -> and1.a
            connect b -> and1.b
            connect and1.out -> carry
          }
        }
      `;

      // First compilation
      const { circuits: circuits1, errors: errors1 } = compileDSL(source, library);
      expect(errors1).toHaveLength(0);
      expect(circuits1).toHaveLength(1);

      // Generate DSL
      const generatedDSL = generateDSL(circuits1[0]);

      // Second compilation
      const { circuits: circuits2, errors: errors2 } = compileDSL(generatedDSL, library);
      expect(errors2).toHaveLength(0);
      expect(circuits2).toHaveLength(1);

      // Compare circuits
      const circuit1 = circuits1[0];
      const circuit2 = circuits2[0];

      expect(circuit2.name).toBe(circuit1.name);
      expect(circuit2.inputs.length).toBe(circuit1.inputs.length);
      expect(circuit2.outputs.length).toBe(circuit1.outputs.length);
      expect(circuit2.nodes.length).toBe(circuit1.nodes.length);
      expect(circuit2.connections.length).toBe(circuit1.connections.length);

      // Verify node types match
      circuit1.nodes.forEach((node1, i) => {
        const node2 = circuit2.nodes[i];
        expect(node2.componentRef).toBe(node1.componentRef);
      });
    });

    it('should handle multiple roundtrips', () => {
      const source = `
        circuit Not {
          input a: Bit
          output out: Bit

          impl {
            node nand1: Nand
            connect a -> nand1.a
            connect a -> nand1.b
            connect nand1.out -> out
          }
        }
      `;

      let currentSource = source;
      let prevCircuit: Circuit | null = null;

      // Perform 3 roundtrips
      for (let i = 0; i < 3; i++) {
        const { circuits, errors } = compileDSL(currentSource, library);
        expect(errors).toHaveLength(0);
        expect(circuits).toHaveLength(1);

        const circuit = circuits[0];

        // After first iteration, compare with previous
        if (prevCircuit) {
          expect(circuit.name).toBe(prevCircuit.name);
          expect(circuit.nodes.length).toBe(prevCircuit.nodes.length);
          expect(circuit.connections.length).toBe(prevCircuit.connections.length);
        }

        prevCircuit = circuit;
        currentSource = generateDSL(circuit);
      }
    });
  });

  describe('Multiple Circuits', () => {
    it('should generate DSL for multiple circuits', () => {
      const source = `
        circuit Buffer {
          input a: Bit
          output out: Bit
        }

        circuit Not {
          input a: Bit
          output out: Bit

          impl {
            node nand1: Nand
            connect a -> nand1.a
            connect a -> nand1.b
            connect nand1.out -> out
          }
        }
      `;

      const { circuits, errors } = compileDSL(source, library);
      expect(errors).toHaveLength(0);
      expect(circuits).toHaveLength(2);

      const generated = generateDSLMultiple(circuits);

      expect(generated).toContain('circuit Buffer');
      expect(generated).toContain('circuit Not');
      expect(generated).toContain('node nand1: Nand');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty impl blocks', () => {
      const source = `
        circuit Empty {
          input a: Bit
          output out: Bit

          impl {
          }
        }
      `;

      const { circuits, errors } = compileDSL(source, library);
      expect(errors).toHaveLength(0);

      const generated = generateDSL(circuits[0]);

      expect(generated).toContain('circuit Empty');
      expect(generated).toContain('input a: Bit');
    });

    it('should handle circuits with no connections', () => {
      const source = `
        circuit NoConnections {
          input a: Bit
          output out: Bit

          impl {
            node and1: And
          }
        }
      `;

      const { circuits, errors } = compileDSL(source, library);
      expect(errors).toHaveLength(0);

      const generated = generateDSL(circuits[0]);

      expect(generated).toContain('circuit NoConnections');
      expect(generated).toContain('node and1: And');
    });
  });
});
