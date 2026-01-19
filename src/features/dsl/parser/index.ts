/**
 * DSL Parser Module Exports
 *
 * Complete pipeline: Text → Tokens → AST → Validated AST
 */

// Lexer
export { Lexer, tokenize, LexerError } from './lexer';
export type { Token } from './token';
export { TokenType } from './token';

// Parser
export { Parser, parse, ParseError } from './parser';

// Validator
export { Validator, validate, validateOrThrow, ValidationException } from './validator';
export type { ValidationError } from './validator';

// Convenience function for the complete parsing pipeline
import { tokenize } from './lexer';
import { parse } from './parser';
import { validate } from './validator';
import type { Program } from '../types/ast';
import type { ValidationError } from './validator';

/**
 * Parse DSL source code into a validated AST
 */
export function parseDSL(
  source: string,
  sourceName?: string
): { ast: Program; errors: ValidationError[] } {
  const tokens = tokenize(source, sourceName);
  const ast = parse(tokens);
  const errors = validate(ast);
  return { ast, errors };
}

/**
 * Parse DSL and throw on errors
 */
export function parseDSLOrThrow(source: string, sourceName?: string): Program {
  const { ast, errors } = parseDSL(source, sourceName);

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
