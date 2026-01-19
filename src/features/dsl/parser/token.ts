/**
 * Token Types for DSL Lexer
 *
 * Tokens are the atomic units produced by the lexer from raw DSL text.
 * Each token has a type, value (if applicable), and location information.
 */

import { SourceLocation, SourceRange } from '../types/ast';

// ============================================================================
// Token Types
// ============================================================================

export enum TokenType {
  // Keywords
  CIRCUIT = 'CIRCUIT',
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT',
  CLOCK = 'CLOCK',
  NODE = 'NODE',
  CONNECT = 'CONNECT',
  STATE = 'STATE',
  IMPL = 'IMPL',
  ON = 'ON',
  RISING = 'RISING',
  FALLING = 'FALLING',
  IF = 'IF',
  ELSE = 'ELSE',

  // Built-in types
  BIT = 'BIT',
  BUS = 'BUS',
  WORD = 'WORD', // Alias for BUS
  ARRAY = 'ARRAY',

  // Operators
  ARROW = 'ARROW', // ->
  ASSIGN = 'ASSIGN', // =
  PLUS = 'PLUS', // +
  MINUS = 'MINUS', // -
  STAR = 'STAR', // *
  SLASH = 'SLASH', // /
  AMPERSAND = 'AMPERSAND', // &
  PIPE = 'PIPE', // |
  CARET = 'CARET', // ^
  TILDE = 'TILDE', // ~
  BANG = 'BANG', // !
  EQ = 'EQ', // ==
  NE = 'NE', // !=
  LT = 'LT', // <
  GT = 'GT', // >
  LE = 'LE', // <=
  GE = 'GE', // >=

  // Delimiters
  LBRACE = 'LBRACE', // {
  RBRACE = 'RBRACE', // }
  LPAREN = 'LPAREN', // (
  RPAREN = 'RPAREN', // )
  LBRACKET = 'LBRACKET', // [
  RBRACKET = 'RBRACKET', // ]
  COMMA = 'COMMA', // ,
  COLON = 'COLON', // :
  SEMICOLON = 'SEMICOLON', // ;
  DOT = 'DOT', // .

  // Literals
  NUMBER = 'NUMBER', // 123, 0x1A, 0b1010
  STRING = 'STRING', // "text"
  TRUE = 'TRUE', // true
  FALSE = 'FALSE', // false

  // Identifiers
  IDENTIFIER = 'IDENTIFIER', // variable names, component names

  // Comments (preserved for tooling)
  COMMENT = 'COMMENT', // // or /* */

  // Special
  NEWLINE = 'NEWLINE', // For tracking line endings
  EOF = 'EOF', // End of file
  INVALID = 'INVALID', // Invalid token (lexer error)
}

// ============================================================================
// Token
// ============================================================================

export interface Token {
  type: TokenType;
  value: string; // Raw lexeme
  location: SourceRange;

  // Parsed values (for convenience)
  numberValue?: number;
  stringValue?: string;
  boolValue?: boolean;
}

// ============================================================================
// Keywords Map
// ============================================================================

export const KEYWORDS: Record<string, TokenType> = {
  circuit: TokenType.CIRCUIT,
  input: TokenType.INPUT,
  output: TokenType.OUTPUT,
  clock: TokenType.CLOCK,
  node: TokenType.NODE,
  connect: TokenType.CONNECT,
  state: TokenType.STATE,
  impl: TokenType.IMPL,
  on: TokenType.ON,
  rising: TokenType.RISING,
  falling: TokenType.FALLING,
  if: TokenType.IF,
  else: TokenType.ELSE,
  Bit: TokenType.BIT,
  Bus: TokenType.BUS,
  Word: TokenType.WORD,
  Array: TokenType.ARRAY,
  true: TokenType.TRUE,
  false: TokenType.FALSE,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a token
 */
export function createToken(
  type: TokenType,
  value: string,
  location: SourceRange
): Token {
  return { type, value, location };
}

/**
 * Check if a string is a keyword
 */
export function isKeyword(text: string): boolean {
  return text in KEYWORDS;
}

/**
 * Get token type for a keyword, or IDENTIFIER if not a keyword
 */
export function getKeywordType(text: string): TokenType {
  return KEYWORDS[text] ?? TokenType.IDENTIFIER;
}

/**
 * Format a token for debugging
 */
export function formatToken(token: Token): string {
  const loc = `${token.location.start.line}:${token.location.start.column}`;
  if (token.type === TokenType.NUMBER && token.numberValue !== undefined) {
    return `${token.type}(${token.numberValue}) at ${loc}`;
  }
  if (token.type === TokenType.STRING && token.stringValue !== undefined) {
    return `${token.type}("${token.stringValue}") at ${loc}`;
  }
  return `${token.type}("${token.value}") at ${loc}`;
}

/**
 * Check if a token is a binary operator
 */
export function isBinaryOperator(type: TokenType): boolean {
  return [
    TokenType.PLUS,
    TokenType.MINUS,
    TokenType.STAR,
    TokenType.SLASH,
    TokenType.AMPERSAND,
    TokenType.PIPE,
    TokenType.CARET,
    TokenType.EQ,
    TokenType.NE,
    TokenType.LT,
    TokenType.GT,
    TokenType.LE,
    TokenType.GE,
  ].includes(type);
}

/**
 * Check if a token is a unary operator
 */
export function isUnaryOperator(type: TokenType): boolean {
  return [TokenType.BANG, TokenType.TILDE, TokenType.MINUS].includes(type);
}

/**
 * Get operator precedence (higher = tighter binding)
 */
export function getOperatorPrecedence(type: TokenType): number {
  switch (type) {
    case TokenType.STAR:
    case TokenType.SLASH:
      return 7;
    case TokenType.PLUS:
    case TokenType.MINUS:
      return 6;
    case TokenType.LT:
    case TokenType.GT:
    case TokenType.LE:
    case TokenType.GE:
      return 5;
    case TokenType.EQ:
    case TokenType.NE:
      return 4;
    case TokenType.AMPERSAND:
      return 3;
    case TokenType.CARET:
      return 2;
    case TokenType.PIPE:
      return 1;
    default:
      return 0;
  }
}

/**
 * Convert token type to operator string
 */
export function tokenTypeToOperator(type: TokenType): string | null {
  switch (type) {
    case TokenType.PLUS:
      return '+';
    case TokenType.MINUS:
      return '-';
    case TokenType.STAR:
      return '*';
    case TokenType.SLASH:
      return '/';
    case TokenType.AMPERSAND:
      return '&';
    case TokenType.PIPE:
      return '|';
    case TokenType.CARET:
      return '^';
    case TokenType.TILDE:
      return '~';
    case TokenType.BANG:
      return '!';
    case TokenType.EQ:
      return '==';
    case TokenType.NE:
      return '!=';
    case TokenType.LT:
      return '<';
    case TokenType.GT:
      return '>';
    case TokenType.LE:
      return '<=';
    case TokenType.GE:
      return '>=';
    default:
      return null;
  }
}
