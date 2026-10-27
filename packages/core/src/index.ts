/**
 * @simten/core
 *
 * Build circuits in TypeScript and simulate them. Works in Node.js, Bun, Deno
 * and bundlers, with no browser dependencies.
 *
 *   import { circuit, bit, bus, simulate } from '@simten/core';
 *   import { And, Xor } from '@simten/core/std';
 *
 * Other entry points: `@simten/core/std` (the standard library),
 * `@simten/core/verify` (testbenches), `@simten/core/verilog` (Verilog export)
 * and `@simten/core/examples`.
 */

export * from './circuit/index.js';
export type { BitType, BitValue, BusType, BusValue, PortType } from './ir/circuit-ir.js';
export { type SimulationHandle, type Snapshot, simulate } from './simulator/simulate.js';
