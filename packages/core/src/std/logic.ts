/**
 * Standard Library — Logic Gates
 *
 * Defined using component() for full TypeScript type inference.
 * The simulation engine uses hand-written fast evaluators (EVALUATORS table)
 * for these — the eval functions here are fallbacks and documentation.
 */

import { component } from '../builder/component.js';
import { bit } from '../builder/bit-bus.js';

export const And = component('And', {
  in: { a: bit, b: bit },
  out: { out: bit },
  meta: { category: 'logic-gates', icon: '&', description: 'Logical AND gate' },
  eval: ({ a, b }) => ({ out: (a && b) ? 1 : 0 }),
});

export const Or = component('Or', {
  in: { a: bit, b: bit },
  out: { out: bit },
  meta: { category: 'logic-gates', icon: '≥1', description: 'Logical OR gate' },
  eval: ({ a, b }) => ({ out: (a || b) ? 1 : 0 }),
});

export const Not = component('Not', {
  in: { in: bit },
  out: { out: bit },
  meta: { category: 'logic-gates', icon: '¬', description: 'Logical NOT gate' },
  eval: ({ in: a }) => ({ out: a ? 0 : 1 }),
});

export const Nand = component('Nand', {
  in: { a: bit, b: bit },
  out: { out: bit },
  meta: { category: 'logic-gates', icon: '⊼', description: 'Logical NAND gate' },
  eval: ({ a, b }) => ({ out: (a && b) ? 0 : 1 }),
});

export const Nor = component('Nor', {
  in: { a: bit, b: bit },
  out: { out: bit },
  meta: { category: 'logic-gates', icon: '⊽', description: 'Logical NOR gate' },
  eval: ({ a, b }) => ({ out: (a || b) ? 0 : 1 }),
});

export const Xor = component('Xor', {
  in: { a: bit, b: bit },
  out: { out: bit },
  meta: { category: 'logic-gates', icon: '⊕', description: 'Logical XOR gate' },
  eval: ({ a, b }) => ({ out: (a !== b) ? 1 : 0 }),
});

export const Xnor = component('Xnor', {
  in: { a: bit, b: bit },
  out: { out: bit },
  meta: { category: 'logic-gates', icon: '⊙', description: 'Logical XNOR gate' },
  eval: ({ a, b }) => ({ out: (a === b) ? 1 : 0 }),
});

export const Buffer = component('Buffer', {
  in: { in: bit },
  out: { out: bit },
  meta: { category: 'logic-gates', icon: '▷', description: 'Buffer — passes input through unchanged' },
  eval: ({ in: a }) => ({ out: a }),
});
