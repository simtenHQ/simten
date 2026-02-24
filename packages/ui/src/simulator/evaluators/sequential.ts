/**
 * Sequential Evaluators for Fast Simulation
 *
 * Numeric evaluators for sequential primitives (output evaluation only).
 * State updates are handled separately by updateSequentialStates().
 *
 * All evaluators read inputs directly via typed arrays - no Map allocations.
 */

import type { EvalContext } from './types';
import { writeOutput } from './types';

/**
 * DFlipFlop: D Flip-Flop (output evaluation)
 * Outputs depend only on current state, not inputs.
 * Inputs: d
 * Outputs: q, q_bar
 */
export function evalDFlipFlop(ctx: EvalContext): void {
  // Read current state (boolean stored as 0/1 or boolean)
  const currentState = ctx.state?.currentState[ctx.nodeIndex];
  const q = currentState ? 1 : 0;

  writeOutput(ctx, 0, q);      // q
  writeOutput(ctx, 1, q ? 0 : 1); // q_bar
}

/**
 * Register: N-bit register (output evaluation)
 * Outputs depend only on current state, not inputs.
 * Inputs: data, we
 * Outputs: q
 */
export function evalRegister(ctx: EvalContext): void {
  // Read current state (number)
  const currentState = ctx.state?.currentState[ctx.nodeIndex];
  const q = typeof currentState === 'number' ? currentState : 0;

  writeOutput(ctx, 0, q);
}

/**
 * Console: Memory-mapped console (output evaluation)
 * Outputs a dummy value - actual text is in state.
 * Inputs: data, we
 * Outputs: text (dummy)
 */
export function evalConsole(ctx: EvalContext): void {
  writeOutput(ctx, 0, 0);
}

/**
 * RasterDisplay: Hardware-accurate raster display (output evaluation)
 * Outputs: addrB, scanX, scanY, hblank, vblank
 */
export function evalRasterDisplay(ctx: EvalContext): void {
  const currentState = ctx.state?.currentState[ctx.nodeIndex];
  const state = (currentState ?? new Map()) as Map<number, number>;

  const scanX = state.get(-1) ?? 0;
  const scanY = state.get(-2) ?? 0;

  const addr = scanY < 8 && scanX < 8 ? scanY * 8 + scanX : 0;
  const hblank = scanX >= 8 ? 1 : 0;
  const vblank = scanY >= 8 ? 1 : 0;

  writeOutput(ctx, 0, addr);    // addrB
  writeOutput(ctx, 1, scanX);   // scanX
  writeOutput(ctx, 2, scanY);   // scanY
  writeOutput(ctx, 3, hblank);  // hblank
  writeOutput(ctx, 4, vblank);  // vblank
}

/**
 * Screen: Simple 8x8 pixel display (output evaluation)
 * Outputs: addrB (dummy value)
 */
export function evalScreen(ctx: EvalContext): void {
  writeOutput(ctx, 0, 0);
}
