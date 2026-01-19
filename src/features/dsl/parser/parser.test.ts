/**
 * Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parse, ParseError } from './parser';
import { tokenize } from './lexer';
import { Program, CircuitDef } from '../types/ast';

function parseSource(source: string): Program {
  const tokens = tokenize(source);
  return parse(tokens);
}

describe('Parser', () => {
  describe('Circuit Definition', () => {
    it('should parse minimal circuit', () => {
      const source = `
        circuit Empty {
        }
      `;

      const program = parseSource(source);
      expect(program.circuits).toHaveLength(1);
      expect(program.circuits[0].name).toBe('Empty');
      expect(program.circuits[0].inputs).toHaveLength(0);
      expect(program.circuits[0].outputs).toHaveLength(0);
    });

    it('should parse circuit with ports', () => {
      const source = `
        circuit Buffer {
          input a: Bit
          output out: Bit
        }
      `;

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.name).toBe('Buffer');
      expect(circuit.inputs).toHaveLength(1);
      expect(circuit.inputs[0].name).toBe('a');
      expect(circuit.inputs[0].portType.kind).toBe('bit');

      expect(circuit.outputs).toHaveLength(1);
      expect(circuit.outputs[0].name).toBe('out');
      expect(circuit.outputs[0].portType.kind).toBe('bit');
    });

    it('should parse circuit with bus types', () => {
      const source = `
        circuit Register8 {
          input d: Bus[8]
          output q: Bus[8]
        }
      `;

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.inputs[0].portType.kind).toBe('bus');
      if (circuit.inputs[0].portType.kind === 'bus') {
        expect(circuit.inputs[0].portType.width).toBe(8);
      }
      expect(circuit.outputs[0].portType.kind).toBe('bus');
      if (circuit.outputs[0].portType.kind === 'bus') {
        expect(circuit.outputs[0].portType.width).toBe(8);
      }
    });

    it('should parse circuit with clock', () => {
      const source = `
        circuit Register {
          input d: Bit
          clock clk
          output q: Bit
        }
      `;

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.clocks).toHaveLength(1);
      expect(circuit.clocks[0].name).toBe('clk');
    });

    it('should parse circuit with state', () => {
      const source = `
        circuit Counter {
          clock clk
          output count: Bus[8]
          state value: Bus[8] = 0
        }
      `;

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.state).toHaveLength(1);
      expect(circuit.state[0].name).toBe('value');
      expect(circuit.state[0].stateType.kind).toBe('bus');
      expect(circuit.state[0].initialValue).toBe(0);
    });
  });

  describe('Parameters', () => {
    it('should parse parameterized circuit', () => {
      const source = `
        circuit Adder(width: int) {
          input a: Bus[width]
          input b: Bus[width]
          output sum: Bus[width]
        }
      `;

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.parameters).toHaveLength(1);
      expect(circuit.parameters[0].name).toBe('width');
      expect(circuit.parameters[0].paramType).toBe('int');
    });

    it('should parse parameter with default value', () => {
      const source = `
        circuit Adder(width: int = 8) {
          input a: Bus[width]
        }
      `;

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.parameters[0].defaultValue).toBe(8);
    });

    it('should parse multiple parameters', () => {
      const source = `
        circuit RAM(addr_width: int, data_width: int) {
          input addr: Bus[addr_width]
          input data: Bus[data_width]
        }
      `;

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.parameters).toHaveLength(2);
      expect(circuit.parameters[0].name).toBe('addr_width');
      expect(circuit.parameters[1].name).toBe('data_width');
    });
  });

  describe('Implementation Block', () => {
    it('should parse impl block with nodes', () => {
      const source = `
        circuit HalfAdder {
          input a: Bit
          input b: Bit
          output sum: Bit
          output carry: Bit

          impl {
            node x1: Xor
            node a1: And
          }
        }
      `;

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.impl).toBeDefined();
      expect(circuit.impl!.nodes).toHaveLength(2);
      expect(circuit.impl!.nodes[0].instanceName).toBe('x1');
      expect(circuit.impl!.nodes[0].componentType).toBe('Xor');
      expect(circuit.impl!.nodes[1].instanceName).toBe('a1');
      expect(circuit.impl!.nodes[1].componentType).toBe('And');
    });

    it('should parse impl block with connections', () => {
      const source = `
        circuit HalfAdder {
          input a: Bit
          input b: Bit
          output sum: Bit

          impl {
            node x1: Xor
            connect a -> x1.a
            connect b -> x1.b
            connect x1.out -> sum
          }
        }
      `;

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.impl!.connections).toHaveLength(3);

      const conn1 = circuit.impl!.connections[0];
      expect(conn1.source.nodeId).toBeNull(); // circuit port
      expect(conn1.source.portName).toBe('a');
      expect(conn1.target.nodeId).toBe('x1');
      expect(conn1.target.portName).toBe('a');
    });

    it('should parse node with arguments', () => {
      const source = `
        circuit Example {
          impl {
            node adder: Adder(width = 8)
          }
        }
      `;

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.impl!.nodes[0].arguments).toHaveLength(1);
      expect(circuit.impl!.nodes[0].arguments[0].name).toBe('width');
      expect(circuit.impl!.nodes[0].arguments[0].value).toBe(8);
    });

    it('should parse node with multiple arguments', () => {
      const source = `
        circuit Example {
          impl {
            node ram: RAM(addr_width = 8, data_width = 16)
          }
        }
      `;

      const program = parseSource(source);
      const node = program.circuits[0].impl!.nodes[0];

      expect(node.arguments).toHaveLength(2);
      expect(node.arguments[0].name).toBe('addr_width');
      expect(node.arguments[0].value).toBe(8);
      expect(node.arguments[1].name).toBe('data_width');
      expect(node.arguments[1].value).toBe(16);
    });
  });

  describe('Complete Examples', () => {
    it('should parse HalfAdder circuit', () => {
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

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.name).toBe('HalfAdder');
      expect(circuit.inputs).toHaveLength(2);
      expect(circuit.outputs).toHaveLength(2);
      expect(circuit.impl!.nodes).toHaveLength(2);
      expect(circuit.impl!.connections).toHaveLength(6);
    });

    it('should parse FullAdder circuit', () => {
      const source = `
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

      const program = parseSource(source);
      const circuit = program.circuits[0];

      expect(circuit.name).toBe('FullAdder');
      expect(circuit.inputs).toHaveLength(3);
      expect(circuit.outputs).toHaveLength(2);
      expect(circuit.impl!.nodes).toHaveLength(3);
      expect(circuit.impl!.connections).toHaveLength(8);
    });
  });

  describe('Multiple Circuits', () => {
    it('should parse multiple circuit definitions', () => {
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

        circuit Not {
          input a: Bit
          output out: Bit
        }
      `;

      const program = parseSource(source);
      expect(program.circuits).toHaveLength(3);
      expect(program.circuits[0].name).toBe('And');
      expect(program.circuits[1].name).toBe('Or');
      expect(program.circuits[2].name).toBe('Not');
    });
  });

  describe('Error Handling', () => {
    it('should error on missing circuit name', () => {
      const source = 'circuit { }';
      expect(() => parseSource(source)).toThrow(ParseError);
    });

    it('should error on missing opening brace', () => {
      const source = 'circuit Foo }';
      expect(() => parseSource(source)).toThrow(ParseError);
    });

    it('should error on missing closing brace', () => {
      const source = 'circuit Foo {';
      expect(() => parseSource(source)).toThrow(ParseError);
    });

    it('should error on missing port type', () => {
      const source = `
        circuit Foo {
          input a
        }
      `;
      expect(() => parseSource(source)).toThrow(ParseError);
    });

    it('should error on missing arrow in connection', () => {
      const source = `
        circuit Foo {
          impl {
            connect a b
          }
        }
      `;
      expect(() => parseSource(source)).toThrow(ParseError);
    });

    it('should allow parameter reference as bus width', () => {
      // This is actually valid - "hello" could be a parameter reference
      const source = `
        circuit Foo {
          input a: Bus[hello]
        }
      `;
      const program = parseSource(source);
      const circuit = program.circuits[0];
      const portType = circuit.inputs[0].portType;
      expect(portType.kind).toBe('bus');
      // Width is a parameter reference
      if (portType.kind === 'bus') {
        expect(typeof portType.width).toBe('object');
      }
    });
  });

  describe('Comments Handling', () => {
    it('should ignore comments in circuit', () => {
      const source = `
        // This is a HalfAdder circuit
        circuit HalfAdder {
          // Inputs
          input a: Bit  // First input
          input b: Bit  // Second input

          /* Outputs */
          output sum: Bit
          output carry: Bit
        }
      `;

      const program = parseSource(source);
      expect(program.circuits).toHaveLength(1);
      expect(program.circuits[0].name).toBe('HalfAdder');
    });
  });

  describe('Whitespace Tolerance', () => {
    it('should handle various whitespace styles', () => {
      const source1 = 'circuit Foo{input a:Bit output b:Bit}';
      const source2 = `
        circuit Foo {
          input a: Bit
          output b: Bit
        }
      `;

      const program1 = parseSource(source1);
      const program2 = parseSource(source2);

      expect(program1.circuits[0].name).toBe(program2.circuits[0].name);
      expect(program1.circuits[0].inputs.length).toBe(program2.circuits[0].inputs.length);
    });
  });
});
