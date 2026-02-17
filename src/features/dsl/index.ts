/**
 * DSL Module - Main Entry Point
 *
 * Complete DSL pipeline: Text → Tokens → AST → Validated AST → IR
 */

// Parser pipeline (Text → AST)
export {
  parse,
  parseOrThrow,
  validate,
  validateOrThrow,
  parseDSL,
  parseDSLOrThrow,
  ValidationException,
  DSLLexer,
  DSLParser,
} from './parser';

export type { ParseError, ValidationError, ChevrotainParseResult } from './parser';

// Compiler (AST → IR)
export { compileToIR, compileCircuitToIR, CompilerError } from './compiler';
export type { ComponentLibrary } from './compiler';

// Preprocessor
export {
  preprocessDSL,
  createMapFileResolver,
  createNodeFileResolver,
} from './preprocessor';
export type { FileResolver, PreprocessResult } from './preprocessor';

// Types
export * from './types';

// Convenience: Complete pipeline function
import { parseDSL } from './parser';
import { compileToIR, ComponentLibrary } from './compiler';
import { Circuit } from './types';

/**
 * Interface for store-like objects that have resolveComponent.
 * This matches the ComponentLibraryStore interface from visual-editor.
 */
interface StoreWithResolveComponent {
  resolveComponent(name: string): Circuit | undefined;
}

/**
 * Adapt a store-like object (with resolveComponent) to the DSL compiler's
 * ComponentLibrary interface (with getCircuit/hasCircuit).
 *
 * This allows tests and UI code to pass ComponentLibraryStore directly
 * to DSL compilation functions.
 */
export function adaptStoreToCompilerLibrary(
  store: StoreWithResolveComponent
): ComponentLibrary {
  return {
    getCircuit: (name: string) => store.resolveComponent(name),
    hasCircuit: (name: string) => store.resolveComponent(name) !== undefined,
    addCircuit: () => {}, // No-op for read-only usage
  };
}

/**
 * Complete DSL compilation pipeline: source text → executable IR
 */
export function compileDSL(
  source: string,
  library: ComponentLibrary,
  sourceName?: string
): {
  circuits: Circuit[];
  errors: Array<{ message: string; line: number; column: number }>;
} {
  const { ast, errors } = parseDSL(source, sourceName);

  if (errors.length > 0) {
    return {
      circuits: [],
      errors: errors.map((e) => ({
        message: e.message,
        line: e.location.start.line,
        column: e.location.start.column,
      })),
    };
  }

  try {
    const circuits = compileToIR(ast, library);
    return { circuits, errors: [] };
  } catch (error) {
    return {
      circuits: [],
      errors: [
        {
          message: error instanceof Error ? error.message : String(error),
          line: 0,
          column: 0,
        },
      ],
    };
  }
}
