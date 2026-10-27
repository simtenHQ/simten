/**
 * Hand-written Verilog for std primitives, by primitive type name. Each
 * family's file exports its emitters; this is the one table that collects
 * them.
 */

import { arithmeticEmitters } from './arithmetic.js';
import type { Emitter } from './helpers.js';
import { ioEmitters } from './io.js';
import { logicEmitters } from './logic.js';
import { memoryEmitters } from './memory.js';
import { rv32iEmitters } from './rv32i.js';
import { perWidthEmitter, wiringEmitters } from './wiring.js';

const EMITTERS: ReadonlyMap<string, Emitter> = new Map(
  [
    logicEmitters,
    arithmeticEmitters,
    wiringEmitters,
    memoryEmitters,
    ioEmitters,
    rv32iEmitters,
  ].flatMap((family) => Object.entries(family)),
);

/** The hand-written emitter for a primitive type, or undefined if it has none. */
export function emitterFor(primitiveType: string): Emitter | undefined {
  return perWidthEmitter(primitiveType) ?? EMITTERS.get(primitiveType);
}
