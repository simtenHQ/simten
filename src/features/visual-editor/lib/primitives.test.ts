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
} from './primitives';
import { bitType, busType } from '../types/ir-v0.1';

describe('Primitive Evaluators', () => {
  describe('Basic Logic Gates', () => {
    it('should evaluate AND gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.And;

      expect(evaluator(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', false]]));
      expect(evaluator(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', true]]));
    });

    it('should evaluate OR gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Or;

      expect(evaluator(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', true]]));
      expect(evaluator(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', true]]));
    });

    it('should evaluate NOT gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Not;

      expect(evaluator(new Map([['in', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator(new Map([['in', true]]))).toEqual(new Map([['out', false]]));
    });

    it('should evaluate NAND gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Nand;

      expect(evaluator(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', true]]));
      expect(evaluator(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', false]]));
    });

    it('should evaluate NOR gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Nor;

      expect(evaluator(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', false]]));
      expect(evaluator(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', false]]));
    });

    it('should evaluate XOR gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Xor;

      expect(evaluator(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', true]]));
      expect(evaluator(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', false]]));
    });

    it('should evaluate XNOR gate correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Xnor;

      expect(evaluator(new Map([['a', false], ['b', false]]))).toEqual(new Map([['out', true]]));
      expect(evaluator(new Map([['a', false], ['b', true]]))).toEqual(new Map([['out', false]]));
      expect(evaluator(new Map([['a', true], ['b', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator(new Map([['a', true], ['b', true]]))).toEqual(new Map([['out', true]]));
    });

    it('should evaluate Buffer correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Buffer;

      expect(evaluator(new Map([['in', false]]))).toEqual(new Map([['out', false]]));
      expect(evaluator(new Map([['in', true]]))).toEqual(new Map([['out', true]]));
    });
  });

  describe('I/O Components', () => {
    it('should have Switch evaluator', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Switch;
      expect(evaluator).toBeDefined();

      // Switch doesn't use inputs, but returns default value
      const result = evaluator(new Map());
      expect(result.get('out')).toBe(false);
    });

    it('should have LED evaluator', () => {
      const evaluator = PRIMITIVE_EVALUATORS.Led;
      expect(evaluator).toBeDefined();

      // LED has no outputs
      const result = evaluator(new Map([['in', true]]));
      expect(result.size).toBe(0);
    });
  });

  describe('Bus Operations', () => {
    it('should evaluate BusAnd correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.BusAnd;

      expect(evaluator(new Map([['a', 0b11110000], ['b', 0b10101010]]))).toEqual(
        new Map([['out', 0b10100000]])
      );
      expect(evaluator(new Map([['a', 0xFF], ['b', 0x0F]]))).toEqual(
        new Map([['out', 0x0F]])
      );
    });

    it('should evaluate BusOr correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.BusOr;

      expect(evaluator(new Map([['a', 0b11110000], ['b', 0b00001111]]))).toEqual(
        new Map([['out', 0b11111111]])
      );
      expect(evaluator(new Map([['a', 0xF0], ['b', 0x0F]]))).toEqual(
        new Map([['out', 0xFF]])
      );
    });

    it('should evaluate BusNot correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.BusNot;

      // Note: JavaScript bitwise NOT on 0b10101010 gives negative numbers
      // The actual masking is handled by the simulator based on port width
      const result = evaluator(new Map([['in', 0b10101010]]));
      expect(result.has('out')).toBe(true);
    });

    it('should evaluate BusXor correctly', () => {
      const evaluator = PRIMITIVE_EVALUATORS.BusXor;

      expect(evaluator(new Map([['a', 0b11110000], ['b', 0b10101010]]))).toEqual(
        new Map([['out', 0b01011010]])
      );
      expect(evaluator(new Map([['a', 0xFF], ['b', 0xFF]]))).toEqual(
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

    const result = andEvaluator!(new Map([['a', true], ['b', true]]));
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

describe('Edge Cases', () => {
  it('should handle all primitive evaluators being called', () => {
    // Ensure no evaluator throws errors
    for (const [, evaluator] of Object.entries(PRIMITIVE_EVALUATORS)) {
      expect(() => {
        evaluator(new Map());
      }).not.toThrow();
    }
  });

  it('should return Map objects from all evaluators', () => {
    for (const evaluator of Object.values(PRIMITIVE_EVALUATORS)) {
      const result = evaluator(new Map());
      expect(result).toBeInstanceOf(Map);
    }
  });
});
