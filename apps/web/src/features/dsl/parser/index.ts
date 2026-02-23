/**
 * DSL Parser Module Exports
 *
 * Complete pipeline: Text → Tokens → AST → Validated AST
 *
 * Uses Chevrotain parser with multi-error recovery.
 */

// Chevrotain Parser
export {
  parse,
  parseOrThrow,
  DSLLexer,
  DSLParser,
  CstToAstVisitor,
} from './chevrotain';
export type { ParseError, ChevrotainParseResult } from './chevrotain';

// Validator
export { Validator, validate, validateOrThrow, ValidationException } from './validator';
export type { ValidationError, DiagnosticCategory, ValidateOptions } from './validator';

// Convenience function for the complete parsing pipeline
import { parse } from './chevrotain';
import { validate } from './validator';
import type { Program } from '../types/ast';
import type { ValidationError, ValidateOptions } from './validator';
import type { ComponentLibrary } from '../../../core/simulator/types';

/**
 * Options for parseDSL.
 * For IDE use, pass componentLibrary to enable component existence checking.
 */
export interface ParseDSLOptions {
  /** Optional source file name for error messages */
  sourceName?: string;
  /** Optional component library for checking component existence (IDE feature) */
  componentLibrary?: ComponentLibrary;
}

/**
 * Parse DSL source code into a validated AST.
 *
 * Uses an IDE-grade diagnostics pipeline that reports ALL errors at once:
 * - Syntax errors from Chevrotain parser
 * - Semantic errors from validator (runs even when syntax errors exist)
 *
 * The parser produces a best-effort AST with incomplete nodes marked,
 * and the validator defensively skips broken nodes.
 *
 * @param source - DSL source code
 * @param options - Optional parse options (sourceName, componentLibrary)
 * @returns Object with AST and merged diagnostics
 */
export function parseDSL(
  source: string,
  options?: ParseDSLOptions | string  // string for backwards compat (sourceName)
): { ast: Program; errors: ValidationError[] } {
  // Handle backwards compatibility: options can be string (sourceName) or object
  const opts: ParseDSLOptions = typeof options === 'string'
    ? { sourceName: options }
    : (options ?? {});

  const result = parse(source, opts.sourceName);

  // Convert Chevrotain errors to ValidationError format with syntax category
  const syntaxErrors: ValidationError[] = result.errors.map((e) => ({
    message: e.message,
    location: e.location,
    severity: 'error' as const,
    category: 'syntax' as const,
  }));

  // Create default empty AST if none was produced
  const ast = result.ast ?? {
    circuits: [],
    location: {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    },
  };

  // Build validation options
  const validateOpts: ValidateOptions = {};
  if (opts.componentLibrary) {
    validateOpts.componentLibrary = opts.componentLibrary;
  }

  // Always run validation - the validator is defensive and handles incomplete nodes
  const semanticErrors = validate(ast, validateOpts);

  // Filter semantic errors on lines with syntax errors to prevent "error storms"
  const syntaxErrorLines = new Set(
    syntaxErrors.map((e) => e.location.start.line)
  );

  const filteredSemanticErrors = semanticErrors.filter(
    (e) => !syntaxErrorLines.has(e.location.start.line)
  );

  // Merge all diagnostics
  const errors = [...syntaxErrors, ...filteredSemanticErrors];

  return { ast, errors };
}

/**
 * Parse DSL and throw on errors.
 *
 * @param source - DSL source code
 * @param options - Optional parse options (sourceName, componentLibrary)
 * @returns Validated AST
 * @throws Error if parsing or validation fails
 */
export function parseDSLOrThrow(source: string, options?: ParseDSLOptions | string): Program {
  const { ast, errors } = parseDSL(source, options);

  if (errors.length > 0) {
    const errorMessages = errors
      .map(
        (e) =>
          `${e.severity.toUpperCase()}: ${e.message} at line ${e.location.start.line}, column ${e.location.start.column}`
      )
      .join('\n');
    throw new Error(`Parse failed:\n${errorMessages}`);
  }

  return ast;
}
