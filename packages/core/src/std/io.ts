/**
 * Standard Library — I/O Components
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

export const Switch = circuit('Switch', {
  outputs: { out: bit },
  eval: ({ value }) => ({ out: value ? 1 : 0 }),
  meta: { category: 'input-output', icon: '⚡', description: 'User-controllable 1-bit toggle', interactiveArg: 'value' },
});

export const Button = circuit('Button', {
  outputs: { out: bit },
  eval: ({ value }) => ({ out: value ? 1 : 0 }),
  meta: { category: 'input-output', icon: '🔘', description: 'Push button input (momentary)', interactiveArg: 'value' },
});

export const Led = circuit('Led', {
  inputs: { in: bit },
  eval: () => ({}),
  meta: { category: 'input-output', icon: '💡', description: 'Visual output LED indicator' },
});

export const Input = circuit('Input', {
  outputs: { out: bus(8) },
  eval: ({ value }) => ({ out: typeof value === 'number' ? value : 0 }),
  meta: { category: 'input-output', icon: '🔢', description: 'Multi-bit numeric input', interactiveArg: 'value' },
});

export const Output = circuit('Output', {
  inputs: { in: bus(8) },
  eval: () => ({}),
  meta: { category: 'input-output', icon: '📤', description: 'Multi-bit output sink' },
});

export const Constant = circuit('Constant', {
  outputs: { out: bit },
  eval: ({ value }) => ({ out: typeof value === 'number' ? value : 0 }),
  meta: { category: 'utilities', icon: 'K', description: 'Fixed value source', interactiveArg: 'value' },
});
