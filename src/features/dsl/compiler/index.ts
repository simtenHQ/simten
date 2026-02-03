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
} from './ir-generator';

export type { ComponentLibrary } from './ir-generator';

export {
  compileTestbenchToIR,
  validateTestbenchAgainstDUT,
  TestbenchCompilerError,
  ComponentNotFoundError,
} from './testbench-compiler';

export type { ComponentLibraryInterface } from './testbench-compiler';
