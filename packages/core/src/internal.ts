/**
 * `@simten/core/internal`: what Simten's own packages (ui, embed, mcp, the
 * sandbox worker, the apps) need beyond the public API. No stability promise;
 * anything here can change in any release.
 */

export { autoHarness } from './circuit/auto-harness.js';
export type { BehaviorEntry } from './circuit/behavior-registry.js';
export {
  getAllCircuitBehaviors,
  getCircuitBehavior,
  registerCircuitBehavior,
} from './circuit/behavior-registry.js';
export { buildFromIR } from './circuit/build-from-ir.js';
export {
  type CircuitNameSite,
  circuitNameSites,
  firstCircuitName,
} from './circuit/circuit-names.js';
export { CircuitToSourceError, circuitToSource } from './circuit/circuit-to-source.js';
export {
  type ExecuteResult,
  executeCircuitCode,
  executeJsCode,
  stripTypes,
} from './circuit/execute.js';
export { isSequentialCircuit } from './circuit/is-sequential.js';
export * from './import/index.js';
export * from './ir/circuit-ir.js';
export * from './simulator/index.js';
export {
  compressTrace,
  detectSteadyState,
  type SignalMetrics,
  type SimulationTrace,
} from './simulator/trace-analysis.js';
export * from './tools/index.js';
