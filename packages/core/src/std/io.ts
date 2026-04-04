/**
 * Standard Library — I/O Components
 */

import { component } from '../builder/component.js';
import { bit, bus } from '../builder/bit-bus.js';

export const Switch = component('Switch', {
  out: { out: bit },
  meta: { category: 'input-output', icon: '⚡', description: 'User-controllable 1-bit toggle' },
});

export const Button = component('Button', {
  out: { out: bit },
  meta: { category: 'input-output', icon: '🔘', description: 'Push button input (momentary)' },
});

export const Led = component('Led', {
  in: { in: bit },
  meta: { category: 'input-output', icon: '💡', description: 'Visual output LED indicator' },
});

export const Input = component('Input', {
  out: { out: bus(8) },
  meta: { category: 'input-output', icon: '🔢', description: 'Multi-bit numeric input' },
});

export const Output = component('Output', {
  in: { in: bus(8) },
  meta: { category: 'input-output', icon: '📤', description: 'Multi-bit output sink' },
});

export const Constant = component('Constant', {
  out: { out: bit },
  meta: { category: 'utilities', icon: 'K', description: 'Fixed value source' },
});
