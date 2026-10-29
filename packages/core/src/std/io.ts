/**
 * Standard Library — I/O Components
 */

import { bit, bus } from '../circuit/bit-bus.js';
import type { Circuit, Control } from '../circuit/builder-types.js';
import { circuit } from '../circuit/circuit.js';

/**
 * Marks a component, or a factory's result, as one `set` can write by path.
 * Type-level only: the value is returned unchanged.
 */
function asControl<C extends Circuit>(component: C): Control<C>;
function asControl<A extends unknown[], C extends Circuit>(
  factory: (...args: A) => C,
): (...args: A) => Control<C>;
function asControl(component: unknown): unknown {
  return component;
}

/**
 * User-controllable 1-bit toggle. Stays in the chosen state until clicked
 * again. The initial value is controlled via the `value` node argument and
 * the canvas UI.
 *
 * **Output:** `out` — `bit`
 *
 * **Example:** a switched LED
 * ```ts
 * circuit('SwitchedLed', {
 *   nodes: { sw: Switch, led: Led },
 *   connect: ({ nodes: { sw, led } }) => [
 *     sw.out.to(led.in),
 *   ],
 * })
 * ```
 *
 * Stateless parameterized: `value` flows through `node.arguments` to the
 * simulator (via `interactiveArg: 'value'` in eval-bridge), so the factory
 * destructure here is purely for the typed call signature — the body
 * doesn't need to reference it.
 */
export const Switch = asControl(
  circuit('Switch', {
    outputs: { out: bit },
    eval: ({ value }) => ({ out: value ? 1 : 0 }),
    meta: {
      category: 'input-output',
      icon: '⚡',
      description: 'User-controllable 1-bit toggle',
      interactiveArg: 'value',
    },
  }),
);

/**
 * Visual output LED indicator. Lights up on the canvas when its input is 1.
 * A passive observer — has no output, just reads the wire.
 *
 * **Input:** `in` — `bit`
 *
 * **Example:**
 * ```ts
 * circuit('ShowAnd', {
 *   inputs:  { a: bit, b: bit },
 *   nodes:   { g: And, led: Led },
 *   connect: ({ inputs, nodes: { g, led } }) => [
 *     inputs.a.to(g.a),
 *     inputs.b.to(g.b),
 *     g.out.to(led.in),
 *   ],
 * })
 * ```
 */
export const Led = circuit('Led', {
  inputs: { in: bit },
  eval: () => ({}),
  meta: { category: 'input-output', icon: '💡', description: 'Visual output LED indicator' },
});

/**
 * Multi-bit numeric input. An 8-bit value source driven by the canvas
 * inspector — useful for feeding test values into a bus without wiring up
 * eight individual switches.
 *
 * **Output:** `out` — `bus(width)`, default `bus(8)`. Pass `width` to drive a
 * wider datapath; a 32-bit value in a default input keeps only its low byte.
 *
 * **Example:**
 * ```ts
 * circuit('Show', {
 *   nodes:  { input: Input(), output: Output },
 *   connect: ({ nodes: { input, output } }) => [
 *     input.out.to(output.in),
 *   ],
 * })
 * ```
 */
export const Input = asControl(
  circuit('Input', ({ width = 8 }: { value?: number; width?: number } = {}) => ({
    outputs: { out: bus(width) },
    eval: ({ value }) => ({ out: typeof value === 'number' ? value : 0 }),
    meta: {
      category: 'input-output',
      icon: '🔢',
      description: 'Multi-bit numeric input',
      interactiveArg: 'value',
    },
  })),
);

/**
 * Multi-bit output sink. Passive observer for an 8-bit bus — the canvas
 * shows the current decimal/hex value.
 *
 * **Input:** `in` — `bus(8)`
 *
 * **Example:** display the sum of two inputs
 * ```ts
 * circuit('AddAndShow', {
 *   inputs:  { x: bus(8), y: bus(8) },
 *   nodes:   { add: Adder, out: Output, zero: Constant },
 *   connect: ({ inputs, nodes: { add, out, zero } }) => [
 *     zero.out.to(add.carry_in),
 *     inputs.x.to(add.a),
 *     inputs.y.to(add.b),
 *     add.sum.to(out.in),
 *   ],
 * })
 * ```
 */
export const Output = circuit('Output', {
  inputs: { in: bus(8) },
  eval: () => ({}),
  meta: { category: 'input-output', icon: '📤', description: 'Multi-bit output sink' },
});

/**
 * A Constant's port is as wide as its `width`, and the simulator masks every
 * value to its port, so `Constant({ value: 255 })` would quietly output 1.
 * Refuse it instead, saying how wide it needs to be. Negative values are
 * accepted down to the two's-complement minimum for the width.
 */
function checkConstantFits(value: number | undefined, width: number): void {
  if (typeof value !== 'number' || width >= 32) return;
  if (value <= 2 ** width - 1 && value >= -(2 ** (width - 1))) return;
  const needed = value < 0 ? Math.ceil(Math.log2(-value)) + 1 : Math.ceil(Math.log2(value + 1));
  throw new Error(
    `Constant value ${value} does not fit in ${width} bit${width === 1 ? '' : 's'}; ` +
      `give it a width, e.g. Constant({ value: ${value}, width: ${needed} })`,
  );
}

/**
 * Fixed value source. Outputs a single bit (configurable per instance).
 * Use when a sub-circuit needs a hardcoded 0 or 1 — e.g. tying a
 * `carry_in` low on the bottom Adder of a chain.
 *
 * **Output:** `out` — `bit`
 *
 * **Example:**
 * ```ts
 * circuit('ForceHigh', {
 *   outputs: { signal: bit },
 *   nodes:   { one: Constant },
 *   connect: ({ outputs, nodes: { one } }) => [
 *     one.out.to(outputs.signal),
 *   ],
 * })
 * ```
 */
export const Constant = circuit(
  'Constant',
  ({ width = 1, value }: { value?: number; width?: number } = {}) => {
    checkConstantFits(value, width);
    return {
      outputs: { out: width === 1 ? bit : bus(width) },
      eval: ({ value }) => ({ out: typeof value === 'number' ? value : 0 }),
      meta: {
        category: 'utilities',
        icon: 'K',
        description: 'Fixed value source',
        interactiveArg: 'value',
      },
    };
  },
);
