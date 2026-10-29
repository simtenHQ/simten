/**
 * `@simten/core/internal`: what Simten's own packages (ui, embed, mcp, the
 * sandbox worker, the apps) need beyond the public API. No stability promise;
 * anything here can change in any release.
 */

export { autoHarness } from './circuit/auto-harness.js';
export {
  addToLibrary,
  type Behavior,
  type BehaviorFn,
  type BehaviorTable,
  type BehaviorValues,
  createDefinitions,
  emptyLibrary,
  type Library,
  libraryOf,
  type MutableLibrary,
} from './circuit/behavior.js';
export { buildFromIR } from './circuit/build-from-ir.js';
export { type CircuitInternals, internalsOf, isCircuit } from './circuit/internals.js';
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
export {
  type CircuitNameSite,
  circuitNameSites,
  firstCircuitName,
} from './source/circuit-names.js';
export { CircuitToSourceError, circuitToSource } from './source/circuit-to-source.js';
export {
  type ExecuteResult,
  executeCircuitCode,
  executeJsCode,
  stripTypes,
} from './source/execute.js';
export { getStdLibrary } from './std/library.js';
export { slugify } from './verify/test-name.js';
export { exportVerilogFromIR } from './verilog/exporter.js';
