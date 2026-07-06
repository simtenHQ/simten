export { exportVerilog, exportVerilogFlat } from './exporter.js';
export { generateTestbench, generateExhaustiveVectors } from './testbench-gen.js';
export {
  emitPrimitive,
  isIOPrimitive,
  isSinkPrimitive,
  isSequentialPrimitive,
} from './primitive-map.js';
export { checkSynthesizable, tryEmitFromEval } from './eval-synth.js';
export type { SynthValidation, ParsedEval } from './eval-synth.js';
export type {
  VerilogExportOptions,
  VerilogTestbenchOptions,
  TestVector,
  VerilogLintResult,
  VerificationResult,
  VerificationTestResult,
  VerificationCycle,
} from './types.js';
