/**
 * Standard Library — Arithmetic Operations
 */

import { component } from '../builder/component.js';
import { bit, bus } from '../builder/bit-bus.js';

export const Incrementer = component('Incrementer', {
  in: { in: bus(8) },
  out: { out: bus(8) },
  meta: { category: 'arithmetic', icon: '+1', description: 'Adds 1 to the input' },
  eval: ({ in: a }) => ({ out: (a + 1) & 0xFF }),
});

export const Adder = component('Adder', {
  in: { a: bus(8), b: bus(8), carry_in: bit },
  out: { sum: bus(8), carry_out: bit },
  meta: { category: 'arithmetic', icon: '+', description: 'N-bit adder with carry' },
  eval: ({ a, b, carry_in }) => {
    const result = a + b + carry_in;
    return { sum: result & 0xFF, carry_out: (result >> 8) & 1 };
  },
});

export const Subtractor = component('Subtractor', {
  in: { a: bus(8), b: bus(8), borrow_in: bit },
  out: { difference: bus(8), borrow_out: bit },
  meta: { category: 'arithmetic', icon: '−', description: 'N-bit subtractor with borrow' },
  eval: ({ a, b, borrow_in }) => {
    const result = a - b - borrow_in;
    return { difference: result & 0xFF, borrow_out: result < 0 ? 1 : 0 };
  },
});

export const Multiplier = component('Multiplier', {
  in: { a: bus(8), b: bus(8) },
  out: { product: bus(16) },
  meta: { category: 'arithmetic', icon: '×', description: 'N-bit multiplier' },
  eval: ({ a, b }) => ({ product: (a * b) & 0xFFFF }),
});

export const Comparator = component('Comparator', {
  in: { a: bus(8), b: bus(8) },
  out: { eq: bit, lt: bit, gt: bit },
  meta: { category: 'arithmetic', icon: '⋚', description: 'Unsigned comparator' },
  eval: ({ a, b }) => ({ eq: a === b ? 1 : 0, lt: a < b ? 1 : 0, gt: a > b ? 1 : 0 }),
});

export const LeftShifter = component('LeftShifter', {
  in: { value: bus(8), shift: bus(8) },
  out: { result: bus(8) },
  meta: { category: 'arithmetic', icon: '≪', description: 'Left bit shifter' },
  eval: ({ value, shift }) => ({ result: (value << shift) & 0xFF }),
});

export const RightShifter = component('RightShifter', {
  in: { value: bus(8), shift: bus(8) },
  out: { result: bus(8) },
  meta: { category: 'arithmetic', icon: '≫', description: 'Right bit shifter' },
  eval: ({ value, shift }) => ({ result: (value >>> shift) & 0xFF }),
});

export const SignedAdder = component('SignedAdder', {
  in: { a: bus(8), b: bus(8), carry_in: bit },
  out: { sum: bus(8), overflow: bit, carry_out: bit },
  meta: { category: 'arithmetic', icon: '±+', description: 'Signed adder with overflow detection' },
  eval: ({ a, b, carry_in }) => {
    const result = a + b + carry_in;
    return { sum: result & 0xFF, carry_out: (result >> 8) & 1, overflow: 0 };
  },
});

export const SignedComparator = component('SignedComparator', {
  in: { a: bus(8), b: bus(8) },
  out: { eq: bit, lt: bit, gt: bit, lte: bit, gte: bit },
  meta: { category: 'arithmetic', icon: '±⋚', description: 'Signed comparator' },
  eval: ({ a, b }) => ({ eq: a === b ? 1 : 0, lt: a < b ? 1 : 0, gt: a > b ? 1 : 0, lte: a <= b ? 1 : 0, gte: a >= b ? 1 : 0 }),
});

export const SignedMultiplier = component('SignedMultiplier', {
  in: { a: bus(8), b: bus(8) },
  out: { product: bus(16) },
  meta: { category: 'arithmetic', icon: '±×', description: 'Signed multiplier' },
  eval: ({ a, b }) => ({ product: (a * b) & 0xFFFF }),
});

// Bus operations
export const BusAnd = component('BusAnd', {
  in: { a: bus(8), b: bus(8) },
  out: { out: bus(8) },
  meta: { category: 'bus-operations', icon: '&8', description: 'Bitwise AND on buses' },
  eval: ({ a, b }) => ({ out: a & b }),
});

export const BusOr = component('BusOr', {
  in: { a: bus(8), b: bus(8) },
  out: { out: bus(8) },
  meta: { category: 'bus-operations', icon: '|8', description: 'Bitwise OR on buses' },
  eval: ({ a, b }) => ({ out: a | b }),
});

export const BusNot = component('BusNot', {
  in: { in: bus(8) },
  out: { out: bus(8) },
  meta: { category: 'bus-operations', icon: '¬8', description: 'Bitwise NOT on bus' },
  eval: ({ in: a }) => ({ out: (~a) & 0xFF }),
});

export const BusXor = component('BusXor', {
  in: { a: bus(8), b: bus(8) },
  out: { out: bus(8) },
  meta: { category: 'bus-operations', icon: '⊕8', description: 'Bitwise XOR on buses' },
  eval: ({ a, b }) => ({ out: a ^ b }),
});
