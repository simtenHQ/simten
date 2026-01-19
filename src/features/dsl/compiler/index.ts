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
