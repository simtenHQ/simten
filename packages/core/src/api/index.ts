/**
 * Core API handlers
 *
 * Pure handler functions usable by both the MCP server and the webapp.
 */

export { getGrammarHandler } from './grammar.js';
export { getPrimitivesHandler } from './primitives.js';
export { checkCircuit, type CheckResult } from './check.js';
export { simulateCircuit, type SimulateResult, type SimulateError, type RLEValue } from './simulate.js';
export {
  verifyCircuit,
  type VerifyParams,
  type VerifyResult,
  type VerifyError,
  type VerifyFailure,
  type VerifyCounterexample,
  type CheckSummary,
  type OracleDecl,
  type OracleTier,
} from './verify.js';
export { exportVCD, type VCDExportParams } from './vcd.js';
export { getLibrary, createMutableLibrary } from './lib.js';
