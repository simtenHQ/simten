/**
 * Checking and converting memory contents (`MemoryContents`, a plain
 * `{ address: value }` object). The builder checks contents when a circuit is
 * compiled; the simulator converts them to the `Map` its memories run on.
 */

import type { MemoryContents } from './circuit-ir.js';

/** Past this many problems in one memory, the rest are counted, not listed. */
const MAX_LISTED = 5;

const DENSE_HINT =
  'build dense contents with romFromBytes(bytes) or romFromWords(words, width) from @simten/core/std';

/**
 * Why `contents` is not a plain object, or `undefined` if it is. Arrays and
 * Maps get a message pointing at the format and the helpers that build it.
 */
export function memoryContentsShapeError(contents: unknown): string | undefined {
  if (Array.isArray(contents)) {
    return `memory contents must be a plain object { address: value }, got an array; ${DENSE_HINT}`;
  }
  if (contents instanceof Map) {
    return `memory contents must be a plain object { address: value }, got a Map; use Object.fromEntries(map), or ${DENSE_HINT}`;
  }
  if (contents === null || typeof contents !== 'object') {
    const got = contents === null ? 'null' : typeof contents;
    return `memory contents must be a plain object { address: value }, got ${got}`;
  }
  return undefined;
}

/**
 * Every problem with `contents` for a memory of `depth` words of `width` bits:
 * a non-object, an address that is not an integer in `0..depth-1`, or a value
 * that is not an integer in `0..2**width-1`. Empty when the contents are valid.
 */
export function checkMemoryContents(contents: unknown, depth: number, width: number): string[] {
  const shape = memoryContentsShapeError(contents);
  if (shape) return [shape];

  const max = 2 ** width - 1;
  const problems: string[] = [];
  for (const [key, value] of Object.entries(contents as Record<string, unknown>)) {
    const addr = Number(key);
    if (!/^(0|[1-9]\d*)$/.test(key)) {
      problems.push(`address '${key}' is not a non-negative integer`);
    } else if (addr >= depth) {
      problems.push(
        `address ${addr} is out of range: the memory has ${depth} words (addresses 0 to ${depth - 1})`,
      );
    } else if (typeof value !== 'number' || !Number.isInteger(value)) {
      problems.push(`value ${JSON.stringify(value)} at address ${addr} is not an integer`);
    } else if (value < 0 || value > max) {
      problems.push(
        `value ${value} at address ${addr} does not fit in ${width} bits (0 to ${max})`,
      );
    }
  }
  if (problems.length > MAX_LISTED) {
    const rest = problems.length - MAX_LISTED;
    return [...problems.slice(0, MAX_LISTED), `${rest} more problems not listed`];
  }
  return problems;
}

/** The `Map` the simulator's memories run on, from `{ address: value }` contents. */
export function memoryContentsToMap(contents: MemoryContents): Map<number, number> {
  const memory = new Map<number, number>();
  for (const [key, value] of Object.entries(contents)) {
    memory.set(Number(key), value);
  }
  return memory;
}
