/**
 * Integration Tests - Complete DSL Pipeline (Text → Tokens → AST → IR)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { tokenize } from './lexer';
import { parse } from './parser';
import { validate } from './validator';
import { compileToIR, ComponentLibrary } from '../compiler/ir-generator';
import { Circuit, bitType, busType } from '../../visual-editor/types/ir-v0.1';

// Mock component library for testing
class MockComponentLibrary implements ComponentLibrary {
  private circuits = new Map<string, Circuit>();

  constructor() {
    // Add primitive components
    this.addPrimitive('And', ['a', 'b'], ['out']);
    this.addPrimitive('Or', ['a', 'b'], ['out']);
    this.addPrimitive('Not', ['a'], ['out']);
    this.addPrimitive('Xor', ['a', 'b'], ['out']);
    this.addPrimitive('Nand', ['a', 'b'], ['out']);
  }

  addPrimitive(name: string, inputs: string[], outputs: string[]): void {
    const circuit: Circuit = {
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
    };
    this.circuits.set(name, circuit);
  }

  addCircuit(circuit: Circuit): void {
    this.circuits.set(circuit.name, circuit);
  }

  getCircuit(name: string): Circuit | undefined {
    return this.circuits.get(name);
  }

  hasCircuit(name: string): boolean {
    return this.circuits.has(name);
  }
}

describe('DSL Integration Tests', () => {
  let library: MockComponentLibrary;

  beforeEach(() => {
    library = new MockComponentLibrary();
  });

  describe('Complete Pipeline', () => {
    it('should compile simple circuit from DSL text to IR', () => {
      const source = `
        circuit Buffer {
          input a: Bit
          output out: Bit
        }
      `;

      // Tokenize
      const tokens = tokenize(source);
      expect(tokens.length).toBeGreaterThan(0);

      // Parse
      const ast = parse(tokens);
      expect(ast.circuits).toHaveLength(1);

      // Validate
      const errors = validate(ast);
      expect(errors).toHaveLength(0);

      // Compile to IR
      const circuits = compileToIR(ast, library);
      expect(circuits).toHaveLength(1);

      const circuit = circuits[0];
      expect(circuit.name).toBe('Buffer');
      expect(circuit.inputs).toHaveLength(1);
      expect(circuit.inputs[0].name).toBe('a');
      expect(circuit.outputs).toHaveLength(1);
      expect(circuit.outputs[0].name).toBe('out');
    });

    it('should compile HalfAdder from DSL to executable IR', () => {
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

      const tokens = tokenize(source);
      const ast = parse(tokens);
      const errors = validate(ast);
      expect(errors).toHaveLength(0);

      const circuits = compileToIR(ast, library);
      const halfAdder = circuits[0];

      // Check structure
      expect(halfAdder.name).toBe('HalfAdder');
      expect(halfAdder.inputs).toHaveLength(2);
      expect(halfAdder.outputs).toHaveLength(2);
      expect(halfAdder.implementation.kind).toBe('composite');

      // Check nodes
      expect(halfAdder.nodes).toHaveLength(2);
      expect(halfAdder.nodes.find((n) => n.label === 'xor1')).toBeDefined();
      expect(halfAdder.nodes.find((n) => n.label === 'and1')).toBeDefined();

      // Check connections
      expect(halfAdder.connections).toHaveLength(6);
    });

    it('should compile FullAdder using HalfAdder', () => {
      // First compile HalfAdder and add to library
      const halfAdderSource = `
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

      const halfAdderAst = parse(tokenize(halfAdderSource));
      const halfAdderCircuits = compileToIR(halfAdderAst, library);
      library.addCircuit(halfAdderCircuits[0]);

      // Now compile FullAdder
      const fullAdderSource = `
        circuit FullAdder {
          input a: Bit
          input b: Bit
          input cin: Bit
          output sum: Bit
          output cout: Bit

          impl {
            node ha1: HalfAdder
            node ha2: HalfAdder
            node or1: Or

            connect a -> ha1.a
            connect b -> ha1.b
            connect ha1.sum -> ha2.a
            connect cin -> ha2.b
            connect ha2.sum -> sum
            connect ha1.carry -> or1.a
            connect ha2.carry -> or1.b
            connect or1.out -> cout
          }
        }
      `;

      const fullAdderAst = parse(tokenize(fullAdderSource));
      const errors = validate(fullAdderAst);
      expect(errors).toHaveLength(0);

      const fullAdderCircuits = compileToIR(fullAdderAst, library);
      const fullAdder = fullAdderCircuits[0];

      expect(fullAdder.name).toBe('FullAdder');
      expect(fullAdder.nodes).toHaveLength(3);
      expect(fullAdder.connections).toHaveLength(8);
    });
  });

  describe('Error Detection Across Pipeline', () => {
    it('should catch undefined component reference', () => {
      const source = `
        circuit Test {
          impl {
            node n1: NonExistentComponent
          }
        }
      `;

      const tokens = tokenize(source);
      const ast = parse(tokens);
      const errors = validate(ast);
      // Validator doesn't check component existence (that's link-time)
      expect(errors).toHaveLength(0);

      // But compiler should catch it
      expect(() => compileToIR(ast, library)).toThrow();
    });

    it('should catch undefined port in connection', () => {
      const source = `
        circuit Test {
          input a: Bit
          impl {
            node and1: And
            connect nonexistent -> and1.a
          }
        }
      `;

      const tokens = tokenize(source);
      const ast = parse(tokens);
      const errors = validate(ast);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Undefined');
    });

    it('should catch duplicate node names', () => {
      const source = `
        circuit Test {
          impl {
            node n1: And
            node n1: Or
          }
        }
      `;

      const tokens = tokenize(source);
      const ast = parse(tokens);
      const errors = validate(ast);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Duplicate');
    });

    it('should catch undefined node in connection', () => {
      const source = `
        circuit Test {
          input a: Bit
          impl {
            node and1: And
            connect a -> nonexistent.a
          }
        }
      `;

      const tokens = tokenize(source);
      const ast = parse(tokens);
      const errors = validate(ast);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Undefined node');
    });
  });

  describe('Parameterized Circuits', () => {
    it('should compile parameterized circuit', () => {
      const source = `
        circuit Register(width: int = 8) {
          input d: Bus[width]
          output q: Bus[width]
        }
      `;

      const tokens = tokenize(source);
      const ast = parse(tokens);
      const errors = validate(ast);
      expect(errors).toHaveLength(0);

      const circuits = compileToIR(ast, library);
      const register = circuits[0];

      expect(register.parameters).toHaveLength(1);
      expect(register.parameters[0].name).toBe('width');
      expect(register.parameters[0].defaultValue).toBe(8);

      // Inputs should use the default width
      expect(register.inputs[0].portType.kind).toBe('bus');
      expect((register.inputs[0].portType as any).width).toBe(8);
    });
  });

  describe('Complex Circuits', () => {
    it('should compile multi-level hierarchy', () => {
      // Build from bottom up: primitives -> HalfAdder -> FullAdder -> Adder4

      // HalfAdder
      const halfAdderSource = `
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

      const halfAdderCircuits = compileToIR(parse(tokenize(halfAdderSource)), library);
      library.addCircuit(halfAdderCircuits[0]);

      // FullAdder
      const fullAdderSource = `
        circuit FullAdder {
          input a: Bit
          input b: Bit
          input cin: Bit
          output sum: Bit
          output cout: Bit
          impl {
            node ha1: HalfAdder
            node ha2: HalfAdder
            node or1: Or
            connect a -> ha1.a
            connect b -> ha1.b
            connect ha1.sum -> ha2.a
            connect cin -> ha2.b
            connect ha2.sum -> sum
            connect ha1.carry -> or1.a
            connect ha2.carry -> or1.b
            connect or1.out -> cout
          }
        }
      `;

      const fullAdderCircuits = compileToIR(parse(tokenize(fullAdderSource)), library);
      library.addCircuit(fullAdderCircuits[0]);

      // 4-bit Adder
      const adder4Source = `
        circuit Adder4 {
          input a: Bus[4]
          input b: Bus[4]
          output sum: Bus[4]
          output cout: Bit
          impl {
            node fa0: FullAdder
            node fa1: FullAdder
            node fa2: FullAdder
            node fa3: FullAdder
          }
        }
      `;

      const adder4Ast = parse(tokenize(adder4Source));
      const errors = validate(adder4Ast);
      expect(errors).toHaveLength(0);

      const adder4Circuits = compileToIR(adder4Ast, library);
      expect(adder4Circuits[0].nodes).toHaveLength(4);
    });
  });

  describe('Real-world Examples from Spec', () => {
    it('should compile all examples from DSL spec', () => {
      const examples = [
        // Primitive (no impl)
        `circuit And {
          input a: Bit
          input b: Bit
          output out: Bit
        }`,

        // Simple combinational
        `circuit HalfAdder {
          input a: Bit
          input b: Bit
          output sum: Bit
          output carry: Bit
          impl {
            node x1: Xor
            node a1: And
            connect a -> x1.a
            connect b -> x1.b
            connect x1.out -> sum
            connect a -> a1.a
            connect b -> a1.b
            connect a1.out -> carry
          }
        }`,
      ];

      for (const source of examples) {
        const tokens = tokenize(source);
        const ast = parse(tokens);
        const errors = validate(ast);
        expect(errors).toHaveLength(0);

        const circuits = compileToIR(ast, library);
        expect(circuits).toHaveLength(1);
      }
    });
  });
});
