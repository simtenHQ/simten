/**
 * Memory Evaluators for Fast Simulation
 *
 * Numeric evaluators for memory primitives (ROM, RAM, DualPortRAM).
 * Memory state uses Map for sparse storage - only accessed cells are stored.
 *
 * All evaluators read inputs directly via typed arrays - no Map allocations
 * except for reading the memory state Map.
 */

import type { EvalContext } from './types';
import { readInput, writeOutput } from './types';

/**
 * ROM: Read-only memory
 * Inputs: addr
 * Outputs: data_out
 */
export function evalROM(ctx: EvalContext): void {
  const addr = readInput(ctx, 0);

  const node = ctx.circuit.flatCircuit.nodes[ctx.nodeIndex];
  const baseAddress = (node.arguments.baseAddress as number) ?? 0;
  const internalAddr = (addr - baseAddress) & 0xFFFF;

  // Read from memory state (Map-based for sparse storage)
  const memory = (ctx.state?.currentState[ctx.nodeIndex] ?? new Map()) as Map<number, number>;
  const data = memory.get(internalAddr) ?? 0;

  writeOutput(ctx, 0, data);
}

/**
 * RAM: Random access memory
 * Inputs: addr, data_in, we
 * Outputs: data_out
 */
export function evalRAM(ctx: EvalContext): void {
  const addr = readInput(ctx, 0);

  // Read from memory state (Map-based for sparse storage)
  const memory = (ctx.state?.currentState[ctx.nodeIndex] ?? new Map()) as Map<number, number>;
  const data = memory.get(addr) ?? 0;

  writeOutput(ctx, 0, data);
}

/**
 * DualPortRAM: Dual-port RAM with separate read/write ports
 * Inputs: addrA, dataA, weA, addrB
 * Outputs: dataA (read from A), dataB (read from B)
 */
export function evalDualPortRAM(ctx: EvalContext): void {
  const addrA = readInput(ctx, 0);
  const addrB = readInput(ctx, 3);

  // Read from memory state (Map-based for sparse storage)
  const memory = (ctx.state?.currentState[ctx.nodeIndex] ?? new Map()) as Map<number, number>;
  const dataA = memory.get(addrA) ?? 0;
  const dataB = memory.get(addrB) ?? 0;

  writeOutput(ctx, 0, dataA);
  writeOutput(ctx, 1, dataB);
}
