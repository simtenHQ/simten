/**
 * Chevrotain Parser Module
 *
 * This module exports the Chevrotain-based DSL parser with multi-error recovery.
 *
 * Key features:
 * - Multi-error reporting (continues parsing after errors)
 * - Skip-to-boundary recovery (skips to next } or statement)
 * - Source location tracking for all errors
 * - Produces same AST types as the hand-written parser
 */

import { IRecognitionException, ILexingError } from 'chevrotain';
import { Program, SourceRange } from '../../types/ast.js';
import { DSLLexer } from './tokens.js';
import { parserInstance } from './parser.js';
import { visitor } from './visitor.js';

// ============================================================================
// Error Types
// ============================================================================

export interface ParseError {
  message: string;
  location: SourceRange;
}

// ============================================================================
// Parse Result
// ============================================================================

export interface ChevrotainParseResult {
  ast: Program | null;
  errors: ParseError[];
}

// ============================================================================
// Error Conversion
// ============================================================================

function lexErrorToParseError(error: ILexingError): ParseError {
  const line = error.line ?? 1;
  const column = error.column ?? 1;
  const offset = error.offset ?? 0;
  const length = error.length ?? 1;

  return {
    message: error.message,
    location: {
      start: { line, column, offset },
      end: { line, column: column + length, offset: offset + length },
    },
  };
}

function parseExceptionToError(exception: IRecognitionException): ParseError {
  const token = exception.token;
  const line = token.startLine ?? 1;
  const column = token.startColumn ?? 1;
  const endLine = token.endLine ?? line;
  const endColumn = (token.endColumn ?? column) + 1;

  return {
    message: exception.message,
    location: {
      start: { line, column, offset: token.startOffset },
      end: { line: endLine, column: endColumn, offset: (token.endOffset ?? token.startOffset) + 1 },
    },
  };
}

// ============================================================================
// Main Parse Function
// ============================================================================

/**
 * Parse DSL source code into an AST using Chevrotain.
 *
 * This function:
 * 1. Tokenizes the input using Chevrotain's lexer
 * 2. Parses tokens with error recovery enabled
 * 3. Converts the CST to our AST types
 * 4. Returns both the AST and any errors encountered
 *
 * Unlike the hand-written parser, this can report multiple errors
 * because Chevrotain attempts to recover and continue parsing.
 *
 * @param source - DSL source code
 * @param _sourceName - Optional source file name for error messages
 * @returns Parse result with AST (may be partial) and errors
 */
export function parse(source: string, _sourceName?: string): ChevrotainParseResult {
  const errors: ParseError[] = [];

  // Step 1: Lexing
  const lexResult = DSLLexer.tokenize(source);

  // Collect lexer errors
  for (const error of lexResult.errors) {
    errors.push(lexErrorToParseError(error));
  }

  // Step 2: Parsing
  parserInstance.input = lexResult.tokens;
  const cst = parserInstance.program();

  // Collect parser errors
  for (const error of parserInstance.errors) {
    errors.push(parseExceptionToError(error));
  }

  // Step 3: CST to AST conversion
  // Only convert if we have a valid CST (even partial)
  let ast: Program | null = null;
  if (cst) {
    try {
      ast = visitor.visitProgram(cst);
    } catch (e) {
      // If AST conversion fails, add the error
      errors.push({
        message: e instanceof Error ? e.message : String(e),
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 1, offset: 0 },
        },
      });
    }
  }

  return { ast, errors };
}

/**
 * Parse DSL and throw if there are any errors.
 *
 * @param source - DSL source code
 * @param sourceName - Optional source file name for error messages
 * @returns Validated AST
 * @throws Error if parsing fails
 */
export function parseOrThrow(source: string, sourceName?: string): Program {
  const result = parse(source, sourceName);

  if (result.errors.length > 0) {
    const errorMessages = result.errors
      .map(
        (e) =>
          `${e.message} at line ${e.location.start.line}, column ${e.location.start.column}`
      )
      .join('\n');
    throw new Error(`Parse failed:\n${errorMessages}`);
  }

  if (!result.ast) {
    throw new Error('Parse failed: no AST produced');
  }

  return result.ast;
}

// ============================================================================
// Re-exports
// ============================================================================

export { DSLLexer } from './tokens.js';
export { parserInstance as DSLParser } from './parser.js';
export { visitor as CstToAstVisitor } from './visitor.js';
