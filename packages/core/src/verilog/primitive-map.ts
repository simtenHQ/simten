/**
 * Verilog primitive mapping.
 *
 * Maps each circuit primitive to its Verilog equivalent.
 * Returns an array of Verilog statements (assign, always, etc.).
 *
 * Convention:
 * - Combinational → `assign` statements
 * - Sequential → `always @(posedge clk)` with non-blocking `<=`
 * - I/O → module ports (emitted by the exporter, not here)
 * - Sinks → stub comments
 *
 * All operations are unsigned. Signed tracking is a future enhancement.
 */

import type { BehaviorTable } from '../circuit/behavior.js';
import { isStdBehavior } from '../std/library.js';
import { type Emitted, type PrimitiveContext, sanitizeId } from './emitters/helpers.js';
import { emitterFor } from './emitters/index.js';
import { synthesizeBehavior } from './eval-synth.js';
import { Unsupported } from './eval-values.js';

/**
 * Sentinel emitted in place of logic when a primitive has no Verilog mapping.
 *
 * Kept as a constant because two places depend on the exact text: the emit
 * site below and the exporter, which scans for it to report
 * `ExportResult.unsupported`. A silent divergence here would mean broken Verilog
 * exporting as if it were clean.
 */
export const UNSUPPORTED_MARKER = 'WARNING: Unsupported primitive';

/**
 * Whether the hand-written mapping for this node's name describes it: only
 * when the node is std's own primitive of that name. A user circuit that takes
 * a std name (its own `Adder`) does something else, so it is translated from
 * its own behavior or reported as unsupported.
 */
export function usesStdMapping(primitiveType: string, behaviors: BehaviorTable): boolean {
  return isStdBehavior(primitiveType, behaviors.get(primitiveType));
}

/** A primitive with no hand-written mapping: translate its behavior, or say why not. */
function emitFromBehavior(ctx: PrimitiveContext): Emitted {
  try {
    return synthesizeBehavior(ctx, ctx.behaviors.get(ctx.primitiveType));
  } catch (e) {
    if (!(e instanceof Unsupported)) throw e;
    const reason = e.message.replace(/\s+/g, ' ');
    return {
      lines: [
        `// ${UNSUPPORTED_MARKER} "${ctx.primitiveType}" (${sanitizeId(ctx.nodeId)}): ${reason}`,
      ],
      declarations: [],
      unsupported: reason,
    };
  }
}

/**
 * Emit Verilog for a single primitive instance.
 * Returns { lines: string[], declarations: string[] }
 * - lines: assign/always statements
 * - declarations: reg/wire declarations needed for this primitive
 *
 * A std primitive takes its family's hand-written emitter (emitters/); any
 * other primitive, and a std one without an emitter, has its behavior
 * translated.
 */
export function emitPrimitive(ctx: PrimitiveContext): Emitted {
  if (!usesStdMapping(ctx.primitiveType, ctx.behaviors)) return emitFromBehavior(ctx);
  const emit = emitterFor(ctx.primitiveType);
  return emit ? emit(ctx) : emitFromBehavior(ctx);
}

/**
 * Check if a primitive type is an I/O component (becomes a module port).
 */
export function isIOPrimitive(primitiveType: string): boolean {
  return ['Switch', 'Input', 'Led', 'Output', 'HexDisplay', 'SevenSegment'].includes(primitiveType);
}

/**
 * Check if a primitive type is a sink (no Verilog output).
 */
export function isSinkPrimitive(primitiveType: string): boolean {
  return ['Screen', 'RasterDisplay', 'Console', 'UART_TX'].includes(primitiveType);
}

/**
 * Check if a primitive type is sequential (needs a clock).
 */
export function isSequentialPrimitive(primitiveType: string): boolean {
  // Anything that emits a `posedge clk` always-block in primitive-map
  // OR that the eval-synth path can wrap in clocked logic belongs here.
  // The exporter uses this to decide whether the module header needs a
  // `clk` port. Missing entries cause iverilog "port `clk' is not a
  // port of dut" errors when the testbench tries to drive a clock.
  return [
    'DFlipFlop',
    'Register',
    'RAM',
    'ROM',
    'DualPortRAM',
    'Console',
    'UART_TX',
    'RV32I_RegisterFile',
    'RV32I_InstrMem',
    'RV32I_DataMem',
  ].includes(primitiveType);
}
