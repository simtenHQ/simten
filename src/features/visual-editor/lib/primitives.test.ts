/**
 * Primitive Component Tests
 *
 * Comprehensive test suite for primitive component definitions and evaluators.
 */

import { describe, it, expect } from 'vitest';
import {
  PRIMITIVE_EVALUATORS,
  PRIMITIVES,
  getPrimitives,
  getPrimitiveEvaluator,
  isPrimitive,
  createPrimitiveComponent,
} from './primitives';
import type { InputValue } from './primitive-interface';
import { bitType, busType } from '../types/ir-v0.1';

describe('Primitive Evaluators', () => {
  describe('Basic Logic Gates', () => {
    it('should evaluate AND gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.And;

      expect(evaluator.evaluate(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator.evaluate(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', false]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', true]]));
    });

    it('should evaluate OR gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Or;

      expect(evaluator.evaluate(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator.evaluate(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', true]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', true]]));
    });

    it('should evaluate NOT gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Not;

      expect(evaluator.evaluate(new Map([['in', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator.evaluate(new Map([['in', true]]))).toEqual(new Map([['out', false]]));
    });

    it('should evaluate NAND gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Nand;

      expect(evaluator.evaluate(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator.evaluate(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', true]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', false]]));
    });

    it('should evaluate NOR gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Nor;

      expect(evaluator.evaluate(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator.evaluate(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', false]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', false]]));
    });

    it('should evaluate XOR gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Xor;

      expect(evaluator.evaluate(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator.evaluate(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', true]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', false]]));
    });

    it('should evaluate XNOR gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Xnor;

      expect(evaluator.evaluate(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator.evaluate(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', false]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator.evaluate(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', true]]));
    });

    it('should evaluate Buffer correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Buffer;

      expect(evaluator.evaluate(new Map([['in', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator.evaluate(new Map([['in', true]]))).toEqual(new Map([['out', true]]));
    });
  });

  describe('I/O Components', () => {
    it('should have Switch evaluator', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Switch;
      expect(evaluator).toBeDefined();

      // Switch doesn't use inputs, but returns default value
      const result = evaluator.evaluate(new Map());
      expect(result.get('out')).toBe(false);
    });

    it('should have LED evaluator', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Led;
      expect(evaluator).toBeDefined();

      // LED has no outputs
      const result = evaluator.evaluate(new Map([['in', true]]));
      expect(result.size).toBe(0);
    });
  });

  describe('Bus Operations', () => {
    it('should evaluate BusAnd correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.BusAnd;

      expect(evaluator.evaluate(new Map([['a', 0b11110000], ['b', 0b10101010]]))).toEqual(
        new Map([['out', 0b10100000]])
      );
      expect(evaluator.evaluate(new Map([['a', 0xFF], ['b', 0x0F]]))).toEqual(
        new Map([['out', 0x0F]])
      );
    });

    it('should evaluate BusOr correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.BusOr;

      expect(evaluator.evaluate(new Map([['a', 0b11110000], ['b', 0b00001111]]))).toEqual(
        new Map([['out', 0b11111111]])
      );
      expect(evaluator.evaluate(new Map([['a', 0xF0], ['b', 0x0F]]))).toEqual(
        new Map([['out', 0xFF]])
      );
    });

    it('should evaluate BusNot correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.BusNot;

      // Note: JavaScript bitwise NOT on 0b10101010 gives negative numbers
      // The actual masking is handled by the simulator based on port width
      const result = evaluator.evaluate(new Map([['in', 0b10101010]]));
      expect(result.has('out')).toBe(true);
    });

    it('should evaluate BusXor correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.BusXor;

      expect(evaluator.evaluate(new Map([['a', 0b11110000], ['b', 0b10101010]]))).toEqual(
        new Map([['out', 0b01011010]])
      );
      expect(evaluator.evaluate(new Map([['a', 0xFF], ['b', 0xFF]]))).toEqual(
        new Map([['out', 0x00]])
      );
    });
  });
});

describe('Primitive Definitions', () => {
  it('should have all basic logic gate definitions', () => {
    const gateNames = ['And', 'Or', 'Not', 'Nand', 'Nor', 'Xor', 'Xnor', 'Buffer'];

    for (const name of gateNames) {
      const circuit = PRIMITIVES.find(p => p.name === name);
      expect(circuit).toBeDefined();
      expect(circuit?.implementation.kind).toBe('primitive');
    }
  });

  it('should have I/O component definitions', () => {
    const ioNames = ['Switch', 'Led'];

    for (const name of ioNames) {
      const circuit = PRIMITIVES.find(p => p.name === name);
      expect(circuit).toBeDefined();
      expect(circuit?.implementation.kind).toBe('primitive');
    }
  });

  it('should have bus operation definitions', () => {
    const busNames = ['BusAnd', 'BusOr', 'BusNot', 'BusXor'];

    for (const name of busNames) {
      const circuit = PRIMITIVES.find(p => p.name === name);
      expect(circuit).toBeDefined();
      expect(circuit?.implementation.kind).toBe('primitive');
    }
  });

  it('should have correct port types for AND gate', () => {
    const andGate = PRIMITIVES.find(p => p.name === 'And');

    expect(andGate?.inputs).toHaveLength(2);
    expect(andGate?.inputs[0].name).toBe('a');
    expect(andGate?.inputs[0].portType).toEqual(bitType());
    expect(andGate?.inputs[1].name).toBe('b');
    expect(andGate?.inputs[1].portType).toEqual(bitType());

    expect(andGate?.outputs).toHaveLength(1);
    expect(andGate?.outputs[0].name).toBe('out');
    expect(andGate?.outputs[0].portType).toEqual(bitType());
  });

  it('should have correct port types for BusAnd', () => {
    const busAnd = PRIMITIVES.find(p => p.name === 'BusAnd');

    expect(busAnd?.inputs).toHaveLength(2);
    expect(busAnd?.inputs[0].name).toBe('a');
    expect(busAnd?.inputs[0].portType).toEqual(busType(8));
    expect(busAnd?.inputs[1].name).toBe('b');
    expect(busAnd?.inputs[1].portType).toEqual(busType(8));

    expect(busAnd?.outputs).toHaveLength(1);
    expect(busAnd?.outputs[0].name).toBe('out');
    expect(busAnd?.outputs[0].portType).toEqual(busType(8));
  });

  it('should have metadata descriptions', () => {
    const andGate = PRIMITIVES.find(p => p.name === 'And');
    expect(andGate?.metadata?.description).toBeDefined();
    expect(andGate?.metadata?.description).toContain('AND');
  });
});

describe('Primitive Registry Functions', () => {
  it('should get all primitives', () => {
    const primitives = getPrimitives();
    expect(primitives).toHaveLength(PRIMITIVES.length);
    expect(primitives).toEqual(PRIMITIVES);
  });

  it('should get primitive evaluator by name', () => {
    const andEvaluator = getPrimitiveEvaluator('And');
    expect(andEvaluator).toBeDefined();
    expect(andEvaluator).toBe(PRIMITIVE_EVALUATORS.And);

    const result = andEvaluator!.evaluate(new Map([['a', true], ['b', true]]));
    expect(result.get('out')).toBe(true);
  });

  it('should return undefined for non-existent evaluator', () => {
    const evaluator = getPrimitiveEvaluator('NonExistent');
    expect(evaluator).toBeUndefined();
  });

  it('should check if component is primitive', () => {
    expect(isPrimitive('And')).toBe(true);
    expect(isPrimitive('Or')).toBe(true);
    expect(isPrimitive('Led')).toBe(true);
    expect(isPrimitive('NonExistent')).toBe(false);
    expect(isPrimitive('HalfAdder')).toBe(false);
  });
});

describe('Primitive Circuit Structure', () => {
  it('should have unique IDs', () => {
    const ids = PRIMITIVES.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have no parameters', () => {
    // Primitives typically don't have parameters
    for (const primitive of PRIMITIVES) {
      expect(primitive.parameters).toEqual([]);
    }
  });

  it('should have no internal nodes', () => {
    // Primitives are atomic, no internal structure
    for (const primitive of PRIMITIVES) {
      expect(primitive.nodes).toEqual([]);
      expect(primitive.connections).toEqual([]);
    }
  });

  it('should have no clocks for combinational primitives', () => {
    const combinational = ['And', 'Or', 'Not', 'Nand', 'Nor', 'Xor', 'Xnor', 'Buffer'];

    for (const name of combinational) {
      const circuit = PRIMITIVES.find(p => p.name === name);
      expect(circuit?.clocks).toEqual([]);
    }
  });

  it('should have no state for combinational primitives', () => {
    const combinational = ['And', 'Or', 'Not', 'Nand', 'Nor', 'Xor', 'Xnor', 'Buffer'];

    for (const name of combinational) {
      const circuit = PRIMITIVES.find(p => p.name === name);
      expect(circuit?.state).toEqual([]);
    }
  });
});

describe('Arithmetic Operations', () => {
  it('should evaluate Adder correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.Adder;

    // Simple addition: 5 + 3 = 8, no carry
    let result = evaluator.evaluate(new Map<string, boolean | number>([['a', 5], ['b', 3], ['carry_in', false], ['__width', 8]]));
    expect(result.get('sum')).toBe(8);
    expect(result.get('carry_out')).toBe(false);

    // Addition with carry: 255 + 1 = 0 with carry out (8-bit)
    result = evaluator.evaluate(new Map<string, boolean | number>([['a', 255], ['b', 1], ['carry_in', false], ['__width', 8]]));
    expect(result.get('sum')).toBe(0);
    expect(result.get('carry_out')).toBe(true);

    // Addition with carry in: 10 + 20 + 1 = 31
    result = evaluator.evaluate(new Map<string, boolean | number>([['a', 10], ['b', 20], ['carry_in', true], ['__width', 8]]));
    expect(result.get('sum')).toBe(31);
    expect(result.get('carry_out')).toBe(false);

    // Maximum value: 255 + 255 + 1 = 511 = 0xFF (carry out = true)
    result = evaluator.evaluate(new Map<string, boolean | number>([['a', 255], ['b', 255], ['carry_in', true], ['__width', 8]]));
    expect(result.get('sum')).toBe(255);
    expect(result.get('carry_out')).toBe(true);
  });

  it('should evaluate Multiplier correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.Multiplier;

    // Simple multiplication: 5 × 3 = 15
    let result = evaluator.evaluate(new Map([['a', 5], ['b', 3], ['__width', 8]]));
    expect(result.get('product')).toBe(15);

    // Larger values: 10 × 20 = 200
    result = evaluator.evaluate(new Map([['a', 10], ['b', 20], ['__width', 8]]));
    expect(result.get('product')).toBe(200);

    // Maximum 8-bit: 15 × 15 = 225
    result = evaluator.evaluate(new Map([['a', 15], ['b', 15], ['__width', 8]]));
    expect(result.get('product')).toBe(225);

    // Edge case: multiplication by zero
    result = evaluator.evaluate(new Map([['a', 100], ['b', 0], ['__width', 8]]));
    expect(result.get('product')).toBe(0);
  });

  it('should evaluate Comparator correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.Comparator;

    // Equal values
    let result = evaluator.evaluate(new Map([['a', 42], ['b', 42]]));
    expect(result.get('eq')).toBe(true);
    expect(result.get('lt')).toBe(false);
    expect(result.get('gt')).toBe(false);

    // Less than
    result = evaluator.evaluate(new Map([['a', 10], ['b', 20]]));
    expect(result.get('eq')).toBe(false);
    expect(result.get('lt')).toBe(true);
    expect(result.get('gt')).toBe(false);

    // Greater than
    result = evaluator.evaluate(new Map([['a', 100], ['b', 50]]));
    expect(result.get('eq')).toBe(false);
    expect(result.get('lt')).toBe(false);
    expect(result.get('gt')).toBe(true);

    // Zero comparisons
    result = evaluator.evaluate(new Map([['a', 0], ['b', 0]]));
    expect(result.get('eq')).toBe(true);
    expect(result.get('lt')).toBe(false);
    expect(result.get('gt')).toBe(false);
  });
});

describe('Plexers', () => {
  it('should evaluate 2-input Mux correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.Mux;

    // Select input 0
    let result = evaluator.evaluate(new Map<string, boolean | number>([['in0', true], ['in1', false], ['sel', 0], ['__input_count', 2], ['__width', 1]]));
    expect(result.get('out')).toBe(true);

    // Select input 1
    result = evaluator.evaluate(new Map<string, boolean | number>([['in0', true], ['in1', false], ['sel', 1], ['__input_count', 2], ['__width', 1]]));
    expect(result.get('out')).toBe(false);

    // Multi-bit bus
    result = evaluator.evaluate(new Map<string, boolean | number>([['in0', 42], ['in1', 99], ['sel', 0], ['__input_count', 2], ['__width', 8]]));
    expect(result.get('out')).toBe(42);

    result = evaluator.evaluate(new Map<string, boolean | number>([['in0', 42], ['in1', 99], ['sel', 1], ['__input_count', 2], ['__width', 8]]));
    expect(result.get('out')).toBe(99);
  });

  it('should evaluate 4-input Mux correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.Mux;

    const inputs = new Map([
      ['in0', 10],
      ['in1', 20],
      ['in2', 30],
      ['in3', 40],
      ['__input_count', 4],
      ['__width', 8],
    ]);

    let result = evaluator.evaluate(new Map([...inputs, ['sel', 0]]));
    expect(result.get('out')).toBe(10);

    result = evaluator.evaluate(new Map([...inputs, ['sel', 1]]));
    expect(result.get('out')).toBe(20);

    result = evaluator.evaluate(new Map([...inputs, ['sel', 2]]));
    expect(result.get('out')).toBe(30);

    result = evaluator.evaluate(new Map([...inputs, ['sel', 3]]));
    expect(result.get('out')).toBe(40);
  });

  it('should evaluate Decoder correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.Decoder;

    // 2-to-4 decoder
    let result = evaluator.evaluate(new Map([['in', 0], ['__input_width', 2]]));
    expect(result.get('out0')).toBe(true);
    expect(result.get('out1')).toBe(false);
    expect(result.get('out2')).toBe(false);
    expect(result.get('out3')).toBe(false);

    result = evaluator.evaluate(new Map([['in', 1], ['__input_width', 2]]));
    expect(result.get('out0')).toBe(false);
    expect(result.get('out1')).toBe(true);
    expect(result.get('out2')).toBe(false);
    expect(result.get('out3')).toBe(false);

    result = evaluator.evaluate(new Map([['in', 2], ['__input_width', 2]]));
    expect(result.get('out0')).toBe(false);
    expect(result.get('out1')).toBe(false);
    expect(result.get('out2')).toBe(true);
    expect(result.get('out3')).toBe(false);

    result = evaluator.evaluate(new Map([['in', 3], ['__input_width', 2]]));
    expect(result.get('out0')).toBe(false);
    expect(result.get('out1')).toBe(false);
    expect(result.get('out2')).toBe(false);
    expect(result.get('out3')).toBe(true);
  });
});

describe('Memory and Utility', () => {
  it('should evaluate ROM correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.ROM;

    // Initialize ROM with some data
    const memory = new Map<number, number>([
      [0, 0x42],
      [1, 0x99],
      [10, 0xFF],
    ]);

    // Read from initialized addresses
    let result = evaluator.evaluate(new Map([['addr', 0]]), memory);
    expect(result.get('data_out')).toBe(0x42);

    result = evaluator.evaluate(new Map([['addr', 1]]), memory);
    expect(result.get('data_out')).toBe(0x99);

    result = evaluator.evaluate(new Map([['addr', 10]]), memory);
    expect(result.get('data_out')).toBe(0xFF);

    // Read from uninitialized address (should return 0)
    result = evaluator.evaluate(new Map([['addr', 5]]), memory);
    expect(result.get('data_out')).toBe(0);
  });

  it('should evaluate Constant correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.Constant;

    // Boolean constant
    let result = evaluator.evaluate(new Map([['__value', true]]));
    expect(result.get('out')).toBe(true);

    result = evaluator.evaluate(new Map([['__value', false]]));
    expect(result.get('out')).toBe(false);

    // Number constant
    result = evaluator.evaluate(new Map([['__value', 42]]));
    expect(result.get('out')).toBe(42);

    result = evaluator.evaluate(new Map([['__value', 0xFF]]));
    expect(result.get('out')).toBe(0xFF);

    // Default (no value specified)
    result = evaluator.evaluate(new Map());
    expect(result.get('out')).toBe(0);
  });

  it('should evaluate Splitter correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.Splitter;

    // Split 8-bit value into two 4-bit values
    // Input: 0xAB (10101011) -> out0: 0xB (1011), out1: 0xA (1010)
    const widths2x4: number[] = [4, 4];
    const inputs1 = new Map<string, InputValue>([['in', 0xAB], ['__widths_out', widths2x4]]);
    let result = evaluator.evaluate(inputs1);
    expect(result.get('out0')).toBe(0xB); // Lower 4 bits
    expect(result.get('out1')).toBe(0xA); // Upper 4 bits

    // Split 8-bit value into 8 single bits
    const widths8x1: number[] = [1, 1, 1, 1, 1, 1, 1, 1];
    const inputs2 = new Map<string, InputValue>([['in', 0b10110010], ['__widths_out', widths8x1]]);
    result = evaluator.evaluate(inputs2);
    expect(result.get('out0')).toBe(false); // Bit 0 = 0
    expect(result.get('out1')).toBe(true);  // Bit 1 = 1
    expect(result.get('out2')).toBe(false); // Bit 2 = 0
    expect(result.get('out3')).toBe(false); // Bit 3 = 0
    expect(result.get('out4')).toBe(true);  // Bit 4 = 1
    expect(result.get('out5')).toBe(true);  // Bit 5 = 1
    expect(result.get('out6')).toBe(false); // Bit 6 = 0
    expect(result.get('out7')).toBe(true);  // Bit 7 = 1

    // Split into unequal widths: 16-bit -> [3-bit, 5-bit, 8-bit]
    // Input: 0b1010101100110011 = 0xAB33
    // Bits 0-2:   0b011 = 3
    // Bits 3-7:   0b00110 = 6
    // Bits 8-15:  0b10101011 = 171
    result = evaluator.evaluate(new Map<string, number | number[]>([['in', 0b1010101100110011], ['__widths_out', [3, 5, 8]]]));
    expect(result.get('out0')).toBe(0b011);      // Bits 0-2
    expect(result.get('out1')).toBe(0b00110);    // Bits 3-7
    expect(result.get('out2')).toBe(0b10101011); // Bits 8-15
  });

  it('should evaluate Splitter8to8 correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.Splitter8to8;

    // Test with alternating bits: 0b10101010 = 170
    // bit0=0, bit1=1, bit2=0, bit3=1, bit4=0, bit5=1, bit6=0, bit7=1
    let result = evaluator.evaluate(new Map([['in', 0b10101010]]));
    expect(result.get('bit0')).toBe(false); // Bit 0 = 0
    expect(result.get('bit1')).toBe(true);  // Bit 1 = 1
    expect(result.get('bit2')).toBe(false); // Bit 2 = 0
    expect(result.get('bit3')).toBe(true);  // Bit 3 = 1
    expect(result.get('bit4')).toBe(false); // Bit 4 = 0
    expect(result.get('bit5')).toBe(true);  // Bit 5 = 1
    expect(result.get('bit6')).toBe(false); // Bit 6 = 0
    expect(result.get('bit7')).toBe(true);  // Bit 7 = 1

    // Test with all zeros
    result = evaluator.evaluate(new Map([['in', 0b00000000]]));
    expect(result.get('bit0')).toBe(false);
    expect(result.get('bit1')).toBe(false);
    expect(result.get('bit2')).toBe(false);
    expect(result.get('bit3')).toBe(false);
    expect(result.get('bit4')).toBe(false);
    expect(result.get('bit5')).toBe(false);
    expect(result.get('bit6')).toBe(false);
    expect(result.get('bit7')).toBe(false);

    // Test with all ones: 0xFF = 255
    result = evaluator.evaluate(new Map([['in', 0xFF]]));
    expect(result.get('bit0')).toBe(true);
    expect(result.get('bit1')).toBe(true);
    expect(result.get('bit2')).toBe(true);
    expect(result.get('bit3')).toBe(true);
    expect(result.get('bit4')).toBe(true);
    expect(result.get('bit5')).toBe(true);
    expect(result.get('bit6')).toBe(true);
    expect(result.get('bit7')).toBe(true);

    // Test with specific pattern: 0b11000011 = 195
    result = evaluator.evaluate(new Map([['in', 0b11000011]]));
    expect(result.get('bit0')).toBe(true);  // Bit 0 = 1
    expect(result.get('bit1')).toBe(true);  // Bit 1 = 1
    expect(result.get('bit2')).toBe(false); // Bit 2 = 0
    expect(result.get('bit3')).toBe(false); // Bit 3 = 0
    expect(result.get('bit4')).toBe(false); // Bit 4 = 0
    expect(result.get('bit5')).toBe(false); // Bit 5 = 0
    expect(result.get('bit6')).toBe(true);  // Bit 6 = 1
    expect(result.get('bit7')).toBe(true);  // Bit 7 = 1

    // Test with decimal value: 42 = 0b00101010
    result = evaluator.evaluate(new Map([['in', 42]]));
    expect(result.get('bit0')).toBe(false); // Bit 0 = 0
    expect(result.get('bit1')).toBe(true);  // Bit 1 = 1
    expect(result.get('bit2')).toBe(false); // Bit 2 = 0
    expect(result.get('bit3')).toBe(true);  // Bit 3 = 1
    expect(result.get('bit4')).toBe(false); // Bit 4 = 0
    expect(result.get('bit5')).toBe(true);  // Bit 5 = 1
    expect(result.get('bit6')).toBe(false); // Bit 6 = 0
    expect(result.get('bit7')).toBe(false); // Bit 7 = 0
  });

  it('should evaluate Probe correctly', () => {
    const evaluator = PRIMITIVE_EVALUATORS.Probe;

    // Probe passes through boolean values
    let result = evaluator.evaluate(new Map([['in', true]]));
    expect(result.get('out')).toBe(true);

    result = evaluator.evaluate(new Map([['in', false]]));
    expect(result.get('out')).toBe(false);

    // Probe passes through number values
    result = evaluator.evaluate(new Map([['in', 42]]));
    expect(result.get('out')).toBe(42);

    result = evaluator.evaluate(new Map([['in', 0xFF]]));
    expect(result.get('out')).toBe(0xFF);
  });
});

describe('I/O Components (New)', () => {
  it('should have Button evaluator', () => {
    const evaluator = PRIMITIVE_EVALUATORS.Button;
    expect(evaluator).toBeDefined();

    // Button returns default value (controlled externally)
    const result = evaluator.evaluate(new Map());
    expect(result.get('out')).toBe(false);
  });

  describe('Input Primitive', () => {
    it('should output default value of 0', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Input;
      expect(evaluator).toBeDefined();

      // Test with no __value parameter
      const result = evaluator.evaluate(new Map());
      expect(result.get('out')).toBe(0);
    });

    it('should output configured value', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Input;

      // Test with __value = 42
      const result = evaluator.evaluate(new Map([['__value', 42]]));
      expect(result.get('out')).toBe(42);
    });

    it('should support different bit widths', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Input;

      // Test 8-bit value
      const result8 = evaluator.evaluate(new Map([['__value', 255]]));
      expect(result8.get('out')).toBe(255);

      // Test 16-bit value
      const result16 = evaluator.evaluate(new Map([['__value', 65535]]));
      expect(result16.get('out')).toBe(65535);

      // Test 32-bit value (max safe integer for JS)
      const result32 = evaluator.evaluate(new Map([['__value', 0xFFFFFFFF]]));
      expect(result32.get('out')).toBe(0xFFFFFFFF);
    });

    it('should handle max value for bit width', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Input;

      // Test 8-bit max = 255
      const result = evaluator.evaluate(new Map([['__value', 255]]));
      expect(result.get('out')).toBe(255);
    });

    it('should handle zero value', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Input;

      const result = evaluator.evaluate(new Map([['__value', 0]]));
      expect(result.get('out')).toBe(0);
    });

    it('should handle arbitrary numeric values', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Input;

      const testValues = [1, 10, 100, 128, 256, 1024];
      for (const value of testValues) {
        const result = evaluator.evaluate(new Map([['__value', value]]));
        expect(result.get('out')).toBe(value);
      }
    });
  });

  it('should have SevenSegment evaluator', () => {
    const evaluator = PRIMITIVE_EVALUATORS.SevenSegment;
    expect(evaluator).toBeDefined();

    // Display component - no outputs
    const result = evaluator.evaluate(new Map([['in', 0xA]]));
    expect(result.size).toBe(0);
  });

  it('should have HexDisplay evaluator', () => {
    const evaluator = PRIMITIVE_EVALUATORS.HexDisplay;
    expect(evaluator).toBeDefined();

    // Display component - no outputs
    const result = evaluator.evaluate(new Map([['in', 0x42]]));
    expect(result.size).toBe(0);
  });
});

describe('New Primitive Definitions', () => {
  it('should have all new arithmetic primitives', () => {
    const names = ['Adder', 'Multiplier', 'Comparator'];

    for (const name of names) {
      const circuit = PRIMITIVES.find(p => p.name === name);
      expect(circuit).toBeDefined();
      expect(circuit?.implementation.kind).toBe('primitive');
    }
  });

  it('should have all new plexer primitives', () => {
    const names = ['Mux', 'Decoder'];

    for (const name of names) {
      const circuit = PRIMITIVES.find(p => p.name === name);
      expect(circuit).toBeDefined();
      expect(circuit?.implementation.kind).toBe('primitive');
    }
  });

  it('should have all new utility primitives', () => {
    const names = ['ROM', 'Constant', 'Splitter', 'Splitter8to8', 'Probe', 'Button', 'SevenSegment', 'HexDisplay'];

    for (const name of names) {
      const circuit = PRIMITIVES.find(p => p.name === name);
      expect(circuit).toBeDefined();
      expect(circuit?.implementation.kind).toBe('primitive');
    }
  });

  it('should have correct port configuration for Adder', () => {
    const adder = PRIMITIVES.find(p => p.name === 'Adder');

    expect(adder?.inputs).toHaveLength(3);
    expect(adder?.inputs[0].name).toBe('a');
    expect(adder?.inputs[1].name).toBe('b');
    expect(adder?.inputs[2].name).toBe('carry_in');

    expect(adder?.outputs).toHaveLength(2);
    expect(adder?.outputs[0].name).toBe('sum');
    expect(adder?.outputs[1].name).toBe('carry_out');
  });

  it('should have correct port configuration for Splitter', () => {
    const splitter = PRIMITIVES.find(p => p.name === 'Splitter');

    expect(splitter?.inputs).toHaveLength(1);
    expect(splitter?.inputs[0].name).toBe('in');
    expect(splitter?.inputs[0].portType).toEqual(busType(8));

    expect(splitter?.outputs).toHaveLength(2);
    expect(splitter?.outputs[0].name).toBe('out0');
    expect(splitter?.outputs[1].name).toBe('out1');
  });

  it('should have correct port configuration for Splitter8to8', () => {
    const splitter8to8 = PRIMITIVES.find(p => p.name === 'Splitter8to8');

    expect(splitter8to8?.inputs).toHaveLength(1);
    expect(splitter8to8?.inputs[0].name).toBe('in');
    expect(splitter8to8?.inputs[0].portType).toEqual(busType(8));

    expect(splitter8to8?.outputs).toHaveLength(8);
    expect(splitter8to8?.outputs[0].name).toBe('bit0');
    expect(splitter8to8?.outputs[0].portType).toEqual(bitType());
    expect(splitter8to8?.outputs[1].name).toBe('bit1');
    expect(splitter8to8?.outputs[1].portType).toEqual(bitType());
    expect(splitter8to8?.outputs[2].name).toBe('bit2');
    expect(splitter8to8?.outputs[2].portType).toEqual(bitType());
    expect(splitter8to8?.outputs[3].name).toBe('bit3');
    expect(splitter8to8?.outputs[3].portType).toEqual(bitType());
    expect(splitter8to8?.outputs[4].name).toBe('bit4');
    expect(splitter8to8?.outputs[4].portType).toEqual(bitType());
    expect(splitter8to8?.outputs[5].name).toBe('bit5');
    expect(splitter8to8?.outputs[5].portType).toEqual(bitType());
    expect(splitter8to8?.outputs[6].name).toBe('bit6');
    expect(splitter8to8?.outputs[6].portType).toEqual(bitType());
    expect(splitter8to8?.outputs[7].name).toBe('bit7');
    expect(splitter8to8?.outputs[7].portType).toEqual(bitType());
  });
});

describe('Edge Cases', () => {
  it('should handle all primitive evaluators being called', () => {
    // Ensure no evaluator throws errors
    for (const [, evaluator] of Object.entries(PRIMITIVE_EVALUATORS)) {
      expect(() => {
        evaluator.evaluate(new Map());
      }).not.toThrow();
    }
  });

  it('should return Map objects from all evaluators', () => {
    for (const evaluator of Object.values(PRIMITIVE_EVALUATORS)) {
      const result = evaluator.evaluate(new Map());
      expect(result).toBeInstanceOf(Map);
    }
  });
});

describe('createPrimitiveComponent', () => {
  // This is the critical function that replaced the hacky switch statement
  // It should handle ALL primitive types dynamically

  describe('Input/Output Components', () => {
    it('should create Switch with correct initial state', () => {
      const component = createPrimitiveComponent('test-id', 'Switch');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Switch',
        value: false,
      });
    });

    it('should create Switch with custom initial value', () => {
      const component = createPrimitiveComponent('test-id', 'Switch', true);
      expect(component).toEqual({
        id: 'test-id',
        type: 'Switch',
        value: true,
      });
    });

    it('should create Led with correct initial state', () => {
      const component = createPrimitiveComponent('test-id', 'Led');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Led',
        value: false,
      });
    });

    it('should create Input with correct initial state', () => {
      const component = createPrimitiveComponent('test-id', 'Input');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Input',
        value: 0,
        width: 8,
      });
    });

    it('should create Input with custom initial value', () => {
      const component = createPrimitiveComponent('test-id', 'Input', 42);
      expect(component).toEqual({
        id: 'test-id',
        type: 'Input',
        value: 42,
        width: 8,
      });
    });

    it('should create Button with correct initial state', () => {
      const component = createPrimitiveComponent('test-id', 'Button');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Button',
        value: false,
      });
    });
  });

  describe('Display Components (Previously Hacky)', () => {
    // These were the problematic ones that required hacky if statements

    it('should create HexDisplay with correct initial state', () => {
      const component = createPrimitiveComponent('test-id', 'HexDisplay');
      expect(component).toEqual({
        id: 'test-id',
        type: 'HexDisplay',
        value: 0,
        width: 8,
      });
    });

    it('should create SevenSegment with correct initial state', () => {
      const component = createPrimitiveComponent('test-id', 'SevenSegment');
      expect(component).toEqual({
        id: 'test-id',
        type: 'SevenSegment',
        value: 0,
      });
    });
  });

  describe('Sequential Components', () => {
    it('should create DFlipFlop with correct initial state', () => {
      const component = createPrimitiveComponent('test-id', 'DFlipFlop');
      expect(component).toEqual({
        id: 'test-id',
        type: 'DFlipFlop',
        state: false,
      });
    });

    it('should create Register with correct initial state', () => {
      const component = createPrimitiveComponent('test-id', 'Register');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Register',
        width: 8,
        state: 0,
      });
    });

    it('should create RAM with correct initial state', () => {
      const component = createPrimitiveComponent('test-id', 'RAM');
      expect(component).not.toBeNull();
      expect(component?.id).toBe('test-id');
      expect(component?.type).toBe('RAM');
      // Type guard: RAM components have addressWidth, dataWidth, and memory properties
      if (component && 'addressWidth' in component) {
        expect(component.addressWidth).toBe(8);
        expect(component.dataWidth).toBe(8);
        expect(component.memory).toBeInstanceOf(Map);
        expect(component.memory.size).toBe(0);
      } else {
        throw new Error('RAM component missing required properties');
      }
    });

    it('should create ROM with correct initial state', () => {
      const component = createPrimitiveComponent('test-id', 'ROM');
      expect(component).not.toBeNull();
      expect(component?.id).toBe('test-id');
      expect(component?.type).toBe('ROM');
      // Type guard: ROM components have addressWidth, dataWidth, and memory properties
      if (component && 'addressWidth' in component) {
        expect(component.addressWidth).toBe(8);
        expect(component.dataWidth).toBe(8);
        expect(component.memory).toBeInstanceOf(Map);
      } else {
        throw new Error('ROM component missing required properties');
      }
    });
  });

  describe('Combinational Logic Gates', () => {
    it('should create And gate with minimal state', () => {
      const component = createPrimitiveComponent('test-id', 'And');
      expect(component).toEqual({
        id: 'test-id',
        type: 'And',
      });
    });

    it('should create Or gate with minimal state', () => {
      const component = createPrimitiveComponent('test-id', 'Or');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Or',
      });
    });

    it('should create Not gate with minimal state', () => {
      const component = createPrimitiveComponent('test-id', 'Not');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Not',
      });
    });
  });

  describe('Arithmetic Components', () => {
    it('should create Adder with minimal state', () => {
      const component = createPrimitiveComponent('test-id', 'Adder');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Adder',
      });
    });

    it('should create Multiplier with minimal state', () => {
      const component = createPrimitiveComponent('test-id', 'Multiplier');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Multiplier',
      });
    });

    it('should create Comparator with minimal state', () => {
      const component = createPrimitiveComponent('test-id', 'Comparator');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Comparator',
      });
    });
  });

  describe('Utility Components', () => {
    it('should create Constant with correct initial state', () => {
      const component = createPrimitiveComponent('test-id', 'Constant', 42);
      expect(component).toEqual({
        id: 'test-id',
        type: 'Constant',
        value: 42,
      });
    });

    it('should create Splitter with minimal state', () => {
      const component = createPrimitiveComponent('test-id', 'Splitter');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Splitter',
      });
    });

    it('should create Splitter8to8 with minimal state', () => {
      const component = createPrimitiveComponent('test-id', 'Splitter8to8');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Splitter8to8',
      });
    });

    it('should create Probe with minimal state', () => {
      const component = createPrimitiveComponent('test-id', 'Probe');
      expect(component).toEqual({
        id: 'test-id',
        type: 'Probe',
      });
    });
  });

  describe('Error Handling', () => {
    it('should return null for unknown component type', () => {
      const component = createPrimitiveComponent('test-id', 'UnknownType');
      expect(component).toBeNull();
    });

    it('should return null for user-defined component type', () => {
      const component = createPrimitiveComponent('test-id', 'MyCustomComponent');
      expect(component).toBeNull();
    });

    it('should return null for empty string type', () => {
      const component = createPrimitiveComponent('test-id', '');
      expect(component).toBeNull();
    });
  });

  describe('Comprehensive Coverage', () => {
    it('should handle ALL primitives without errors', () => {
      // Verify that every primitive in PRIMITIVES can be created
      const primitiveNames = PRIMITIVES.map(p => p.name);

      for (const name of primitiveNames) {
        const component = createPrimitiveComponent('test-id', name);
        expect(component).not.toBeNull();
        expect(component?.id).toBe('test-id');
        expect(component?.type).toBe(name);
      }
    });

    it('should create all 31+ primitives successfully', () => {
      // This test ensures we don't have any missing cases
      const primitiveNames = PRIMITIVES.map(p => p.name);
      expect(primitiveNames.length).toBeGreaterThanOrEqual(31);

      let successCount = 0;
      for (const name of primitiveNames) {
        const component = createPrimitiveComponent('test-id', name);
        if (component !== null) {
          successCount++;
        }
      }

      // All primitives should be creatable
      expect(successCount).toBe(primitiveNames.length);
    });
  });
});
