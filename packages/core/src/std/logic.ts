/**
 * Standard Library — Logic Gates
 *
 * Defined using circuit() for full TypeScript type inference.
 * The simulation engine uses hand-written fast evaluators (EVALUATORS table)
 * for these — the eval functions here are fallbacks and documentation.
 */

import { circuit } from '../circuit/circuit.js';
import { bit } from '../circuit/bit-bus.js';

export const And = circuit('And', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '&', description: 'Logical AND gate' },
  eval: ({ a, b }) => ({ out: (a && b) ? 1 : 0 }),
});

export const Or = circuit('Or', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '≥1', description: 'Logical OR gate' },
  eval: ({ a, b }) => ({ out: (a || b) ? 1 : 0 }),
});

export const Not = circuit('Not', {
  inputs: { in: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '¬', description: 'Logical NOT gate' },
  eval: ({ in: a }) => ({ out: a ? 0 : 1 }),
});

export const Nand = circuit('Nand', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '⊼', description: 'Logical NAND gate' },
  eval: ({ a, b }) => ({ out: (a && b) ? 0 : 1 }),
});

export const Nor = circuit('Nor', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '⊽', description: 'Logical NOR gate' },
  eval: ({ a, b }) => ({ out: (a || b) ? 0 : 1 }),
});

export const Xor = circuit('Xor', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '⊕', description: 'Logical XOR gate' },
  eval: ({ a, b }) => ({ out: (a !== b) ? 1 : 0 }),
});

export const Xnor = circuit('Xnor', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '⊙', description: 'Logical XNOR gate' },
  eval: ({ a, b }) => ({ out: (a === b) ? 1 : 0 }),
});

export const Buffer = circuit('Buffer', {
  inputs: { in: bit },
  outputs: { out: bit },
  meta: { category: 'logic-gates', icon: '▷', description: 'Buffer — passes input through unchanged' },
  eval: ({ in: a }) => ({ out: a }),
});
