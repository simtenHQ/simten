/**
 * Standard Library — I/O Components
 */

import { circuit } from '../circuit/circuit.js';
import { bit, bus } from '../circuit/bit-bus.js';

export const Switch = circuit('Switch', {
  out: { out: bit },
  meta: { category: 'input-output', icon: '⚡', description: 'User-controllable 1-bit toggle' },
});

export const Button = circuit('Button', {
  out: { out: bit },
  meta: { category: 'input-output', icon: '🔘', description: 'Push button input (momentary)' },
});

export const Led = circuit('Led', {
  in: { in: bit },
  meta: { category: 'input-output', icon: '💡', description: 'Visual output LED indicator' },
});

export const Input = circuit('Input', {
  out: { out: bus(8) },
  meta: { category: 'input-output', icon: '🔢', description: 'Multi-bit numeric input' },
});

export const Output = circuit('Output', {
  in: { in: bus(8) },
  meta: { category: 'input-output', icon: '📤', description: 'Multi-bit output sink' },
});

export const Constant = circuit('Constant', {
  out: { out: bit },
  meta: { category: 'utilities', icon: 'K', description: 'Fixed value source' },
});
