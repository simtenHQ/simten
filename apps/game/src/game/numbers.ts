/**
 * Reading a column of the truth table back as numbers.
 *
 * Kept out of the component so the arithmetic is testable without a DOM.
 */

import type { Level, Vector } from './types';

/** The signals in a group, most significant first: `a` gives `a3 a2 a1 a0`. */
function groupSignals(level: Level, prefix: string): string[] {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  return [...level.inputs, ...level.outputs]
    .filter((name) => pattern.test(name))
    .sort((x, y) => Number(y.slice(prefix.length)) - Number(x.slice(prefix.length)));
}

/**
 * "a = 5, b = 3, s = 8" for one vector, or `null` when the level reads no
 * groups as numbers.
 */
export function readNumbers(level: Level, vector: Vector): string | null {
  if (!level.numbers) return null;
  const bitOf = (name: string) => vector.inputs[name] ?? vector.expect[name] ?? 0;

  const parts = Object.entries(level.numbers).map(([prefix, kind]) => {
    const signals = groupSignals(level, prefix);
    const value = signals.reduce((acc, name) => acc * 2 + bitOf(name), 0);
    const range = 2 ** signals.length;
    const negative = kind === 'signed' && value >= range / 2;
    return negative ? `${prefix} = ${value} (${value - range})` : `${prefix} = ${value}`;
  });
  return parts.join(', ');
}
