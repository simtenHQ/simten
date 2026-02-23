/**
 * DSL Compiler Module Exports
 *
 * Compiles validated AST to executable IR
 */

export {
  IRGenerator,
  compileToIR,
  compileCircuitToIR,
  CompilerError,
} from './ir-generator.js';

export type { ComponentLibrary } from './ir-generator.js';

export {
  compileTestbenchToIR,
  compileAssertions,
  validateTestbenchAgainstDUT,
  validateAssertionSignals,
  TestbenchCompilerError,
  ComponentNotFoundError,
} from './testbench-compiler.js';

export type { ComponentLibraryInterface } from './testbench-compiler.js';
