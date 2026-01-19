/**
 * Primitive Component Definitions
 *
 * Defines all primitive (kernel-implemented) components.
 * These are the building blocks for all circuits.
 */

import type { Circuit, BitValue, BusValue } from '../types/ir-v0.1';
import { bitType, busType } from '../types/ir-v0.1';

/**
 * Primitive evaluation function type
 */
export type PrimitiveEvaluator = (
  inputs: Map<string, BitValue | BusValue>
) => Map<string, BitValue | BusValue>;

/**
 * Registry of primitive evaluation functions
 */
export const PRIMITIVE_EVALUATORS: Record<string, PrimitiveEvaluator> = {
  // ============================================================================
  // Basic Logic Gates
  // ============================================================================

  And: (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a && b]]);
  },

  Or: (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a || b]]);
  },

  Not: (inputs) => {
    const a = inputs.get('in') as boolean;
    return new Map([['out', !a]]);
  },

  Nand: (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', !(a && b)]]);
  },

  Nor: (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', !(a || b)]]);
  },

  Xor: (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a !== b]]);
  },

  Xnor: (inputs) => {
    const a = inputs.get('a') as boolean;
    const b = inputs.get('b') as boolean;
    return new Map([['out', a === b]]);
  },

  Buffer: (inputs) => {
    const a = inputs.get('in') as boolean;
    return new Map([['out', a]]);
  },

  // ============================================================================
  // I/O Components
  // ============================================================================

  Switch: (_inputs) => {
    // Switch output is controlled externally, not evaluated
    // This evaluator is just for consistency
    return new Map([['out', false]]);
  },

  Led: (_inputs) => {
    // LED is an output component, no outputs
    // This evaluator is just for consistency
    return new Map();
  },

  // ============================================================================
  // Bus Operations (Multi-bit)
  // ============================================================================

  BusAnd: (inputs) => {
    const a = inputs.get('a') as number;
    const b = inputs.get('b') as number;
    return new Map([['out', a & b]]);
  },

  BusOr: (inputs) => {
    const a = inputs.get('a') as number;
    const b = inputs.get('b') as number;
    return new Map([['out', a | b]]);
  },

  BusNot: (inputs) => {
    const a = inputs.get('in') as number;
    // Note: Need to mask to the appropriate width
    // This is handled by the simulator based on port type
    return new Map([['out', ~a]]);
  },

  BusXor: (inputs) => {
    const a = inputs.get('a') as number;
    const b = inputs.get('b') as number;
    return new Map([['out', a ^ b]]);
  },
};

/**
 * Create primitive circuit definitions
 */

function createPrimitiveCircuit(
  name: string,
  inputs: Array<{ name: string; portType: { kind: 'bit' } | { kind: 'bus'; width: number } }>,
  outputs: Array<{ name: string; portType: { kind: 'bit' } | { kind: 'bus'; width: number } }>,
  description?: string
): Circuit {
  return {
    id: `primitive:${name}`,
    name,
    parameters: [],
    inputs,
    outputs,
    clocks: [],
    state: [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' },
    metadata: {
      description,
    },
  };
}

/**
 * All primitive component definitions
 */
export const PRIMITIVES: Circuit[] = [
  // ============================================================================
  // Basic Logic Gates
  // ============================================================================

  createPrimitiveCircuit(
    'And',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical AND gate - outputs true when both inputs are true'
  ),

  createPrimitiveCircuit(
    'Or',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical OR gate - outputs true when at least one input is true'
  ),

  createPrimitiveCircuit(
    'Not',
    [{ name: 'in', portType: bitType() }],
    [{ name: 'out', portType: bitType() }],
    'Logical NOT gate - inverts the input'
  ),

  createPrimitiveCircuit(
    'Nand',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical NAND gate - outputs false only when both inputs are true'
  ),

  createPrimitiveCircuit(
    'Nor',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical NOR gate - outputs true only when both inputs are false'
  ),

  createPrimitiveCircuit(
    'Xor',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical XOR gate - outputs true when inputs are different'
  ),

  createPrimitiveCircuit(
    'Xnor',
    [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    [{ name: 'out', portType: bitType() }],
    'Logical XNOR gate - outputs true when inputs are the same'
  ),

  createPrimitiveCircuit(
    'Buffer',
    [{ name: 'in', portType: bitType() }],
    [{ name: 'out', portType: bitType() }],
    'Buffer - passes the input through unchanged'
  ),

  // ============================================================================
  // I/O Components
  // ============================================================================

  createPrimitiveCircuit(
    'Switch',
    [],
    [{ name: 'out', portType: bitType() }],
    'User-controllable input switch'
  ),

  createPrimitiveCircuit(
    'Led',
    [{ name: 'in', portType: bitType() }],
    [],
    'Visual output LED indicator'
  ),

  // ============================================================================
  // Bus Operations (8-bit examples)
  // ============================================================================

  createPrimitiveCircuit(
    'BusAnd',
    [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    [{ name: 'out', portType: busType(8) }],
    'Bitwise AND operation on 8-bit buses'
  ),

  createPrimitiveCircuit(
    'BusOr',
    [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    [{ name: 'out', portType: busType(8) }],
    'Bitwise OR operation on 8-bit buses'
  ),

  createPrimitiveCircuit(
    'BusNot',
    [{ name: 'in', portType: busType(8) }],
    [{ name: 'out', portType: busType(8) }],
    'Bitwise NOT operation on 8-bit bus'
  ),

  createPrimitiveCircuit(
    'BusXor',
    [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    [{ name: 'out', portType: busType(8) }],
    'Bitwise XOR operation on 8-bit buses'
  ),
];

/**
 * Get all primitive circuits
 */
export function getPrimitives(): Circuit[] {
  return PRIMITIVES;
}

/**
 * Get primitive evaluator by name
 */
export function getPrimitiveEvaluator(name: string): PrimitiveEvaluator | undefined {
  return PRIMITIVE_EVALUATORS[name];
}

/**
 * Check if a component is a primitive
 */
export function isPrimitive(name: string): boolean {
  return PRIMITIVES.some((p) => p.name === name);
}
