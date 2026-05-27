/**
 * Core API handlers
 *
 * Pure handler functions usable by both the MCP server and the webapp.
 */

export { getGrammarHandler } from './grammar.js';
export { getPrimitivesHandler } from './primitives.js';
export { checkCircuit, type CheckResult } from './check.js';
export { simulateCircuit, type SimulateResult, type SimulateError, type RLEValue } from './simulate.js';
// The verify harness moved to `@simten/core/verify` (run on the host via tsx).
export { exportVCD, type VCDExportParams } from './vcd.js';
export { getLibrary, createMutableLibrary } from './lib.js';
