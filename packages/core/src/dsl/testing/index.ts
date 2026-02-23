export {
  compileStimulus,
  validateStimulus,
  formatStimulusSchedule,
  StimulusCompilerError,
} from './stimulus-compiler.js';

export {
  generateVCD,
  parseVCDHeader,
} from './vcd-generator.js';
export type { VCDSignalInfo } from './vcd-generator.js';

export {
  runTestbench,
} from './testbench-runner.js';
export type { TestbenchRunResult, TestbenchRunOptions } from './testbench-runner.js';

export type { AssertionSummary, AssertionEvalResult } from '../harness/assertion-evaluator.js';
export { formatAssertionSummary } from '../harness/assertion-evaluator.js';
