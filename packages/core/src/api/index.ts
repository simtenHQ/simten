/**
 * Core API handlers
 *
 * Pure handler functions usable by both the MCP server and the webapp.
 */

export { type CheckResult, checkCircuit } from './check.js';
export { getGrammarHandler } from './grammar.js';
export { createMutableLibrary, getLibrary } from './lib.js';
export { getPrimitivesHandler } from './primitives.js';
export {
  type RLEValue,
  type SimulateError,
  type SimulateResult,
  simulateCircuit,
} from './simulate.js';
// The verify harness moved to `@simten/core/verify` (run on the host via tsx).
export { exportVCD, type VCDExportParams } from './vcd.js';
