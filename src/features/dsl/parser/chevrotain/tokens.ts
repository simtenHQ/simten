/**
 * Chevrotain Lexer Token Definitions
 *
 * This file defines all tokens for the DSL lexer using Chevrotain's createToken API.
 * Token definitions follow the same structure as the hand-written lexer in token.ts.
 */

import { createToken, Lexer } from 'chevrotain';

// ============================================================================
// Token Categories (for grouping and operator precedence)
// ============================================================================

// Base category for whitespace
export const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

// Comments (skipped but could be preserved for tooling)
export const SingleLineComment = createToken({
  name: 'SingleLineComment',
  pattern: /\/\/[^\n]*/,
  group: Lexer.SKIPPED,
});

export const MultiLineComment = createToken({
  name: 'MultiLineComment',
  pattern: /\/\*[\s\S]*?\*\//,
  group: Lexer.SKIPPED,
});

// ============================================================================
// Keywords - Circuit
// All keywords use negative lookahead (?![a-zA-Z0-9_]) to avoid matching
// when they appear as prefixes of identifiers (e.g., 'input' vs 'inputs')
// ============================================================================

export const Circuit = createToken({ name: 'Circuit', pattern: /circuit(?![a-zA-Z0-9_])/ });
export const Input = createToken({ name: 'Input', pattern: /input(?![a-zA-Z0-9_])/ });
export const Output = createToken({ name: 'Output', pattern: /output(?![a-zA-Z0-9_])/ });
export const Clock = createToken({ name: 'Clock', pattern: /clock(?![a-zA-Z0-9_])/ });
export const Node = createToken({ name: 'Node', pattern: /node(?![a-zA-Z0-9_])/ });
export const Connect = createToken({ name: 'Connect', pattern: /connect(?![a-zA-Z0-9_])/ });
export const State = createToken({ name: 'State', pattern: /state(?![a-zA-Z0-9_])/ });
export const Impl = createToken({ name: 'Impl', pattern: /impl(?![a-zA-Z0-9_])/ });
export const On = createToken({ name: 'On', pattern: /on(?![a-zA-Z0-9_])/ });
export const Rising = createToken({ name: 'Rising', pattern: /rising(?![a-zA-Z0-9_])/ });
export const Falling = createToken({ name: 'Falling', pattern: /falling(?![a-zA-Z0-9_])/ });
export const If = createToken({ name: 'If', pattern: /if(?![a-zA-Z0-9_])/ });
export const Else = createToken({ name: 'Else', pattern: /else(?![a-zA-Z0-9_])/ });

// ============================================================================
// Keywords - Testbench
// ============================================================================

export const Testbench = createToken({ name: 'Testbench', pattern: /testbench(?![a-zA-Z0-9_])/ });
export const Use = createToken({ name: 'Use', pattern: /use(?![a-zA-Z0-9_])/ });
export const As = createToken({ name: 'As', pattern: /as(?![a-zA-Z0-9_])/ });
export const Stimulus = createToken({ name: 'Stimulus', pattern: /stimulus(?![a-zA-Z0-9_])/ });
export const Capture = createToken({ name: 'Capture', pattern: /capture(?![a-zA-Z0-9_])/ });
export const Assert = createToken({ name: 'Assert', pattern: /assert(?![a-zA-Z0-9_])/ });
export const At = createToken({ name: 'At', pattern: /at(?![a-zA-Z0-9_])/ });
export const Step = createToken({ name: 'Step', pattern: /step(?![a-zA-Z0-9_])/ });
export const Helpers = createToken({ name: 'Helpers', pattern: /helpers(?![a-zA-Z0-9_])/ });
export const Function = createToken({ name: 'Function', pattern: /function(?![a-zA-Z0-9_])/ });
export const Tick = createToken({ name: 'Tick', pattern: /tick(?![a-zA-Z0-9_])/ });
export const For = createToken({ name: 'For', pattern: /for(?![a-zA-Z0-9_])/ });
export const In = createToken({ name: 'In', pattern: /in(?![a-zA-Z0-9_])/ });
export const Signals = createToken({ name: 'Signals', pattern: /signals(?![a-zA-Z0-9_])/ });
export const Format = createToken({ name: 'Format', pattern: /format(?![a-zA-Z0-9_])/ });
export const Filename = createToken({ name: 'Filename', pattern: /filename(?![a-zA-Z0-9_])/ });

// ============================================================================
// Type Keywords (case-insensitive for LLM-friendliness)
// ============================================================================

export const Bit = createToken({ name: 'Bit', pattern: /[Bb]it(?![a-zA-Z0-9_])/ });
export const Bus = createToken({ name: 'Bus', pattern: /[Bb]us(?![a-zA-Z0-9_])/ });
export const Word = createToken({ name: 'Word', pattern: /[Ww]ord(?![a-zA-Z0-9_])/ });
export const ArrayKw = createToken({ name: 'Array', pattern: /[Aa]rray(?![a-zA-Z0-9_])/ });
export const True = createToken({ name: 'True', pattern: /true(?![a-zA-Z0-9_])/ });
export const False = createToken({ name: 'False', pattern: /false(?![a-zA-Z0-9_])/ });

// ============================================================================
// Operators (multi-char first, then single char)
// ============================================================================

export const Arrow = createToken({ name: 'Arrow', pattern: /->/ });
export const DotDot = createToken({ name: 'DotDot', pattern: /\.\./ });
export const Eq = createToken({ name: 'Eq', pattern: /==/ });
export const Ne = createToken({ name: 'Ne', pattern: /!=/ });
export const Le = createToken({ name: 'Le', pattern: /<=/ });
export const Ge = createToken({ name: 'Ge', pattern: />=/ });
export const Assign = createToken({ name: 'Assign', pattern: /=/ });
export const Lt = createToken({ name: 'Lt', pattern: /</ });
export const Gt = createToken({ name: 'Gt', pattern: />/ });
export const Plus = createToken({ name: 'Plus', pattern: /\+/ });
export const Minus = createToken({ name: 'Minus', pattern: /-/ });
export const Star = createToken({ name: 'Star', pattern: /\*/ });
export const Slash = createToken({ name: 'Slash', pattern: /\// });
export const Ampersand = createToken({ name: 'Ampersand', pattern: /&/ });
export const Pipe = createToken({ name: 'Pipe', pattern: /\|/ });
export const Caret = createToken({ name: 'Caret', pattern: /\^/ });
export const Tilde = createToken({ name: 'Tilde', pattern: /~/ });
export const Bang = createToken({ name: 'Bang', pattern: /!/ });

// ============================================================================
// Delimiters
// ============================================================================

export const LBrace = createToken({ name: 'LBrace', pattern: /\{/ });
export const RBrace = createToken({ name: 'RBrace', pattern: /\}/ });
export const LParen = createToken({ name: 'LParen', pattern: /\(/ });
export const RParen = createToken({ name: 'RParen', pattern: /\)/ });
export const LBracket = createToken({ name: 'LBracket', pattern: /\[/ });
export const RBracket = createToken({ name: 'RBracket', pattern: /\]/ });
export const Comma = createToken({ name: 'Comma', pattern: /,/ });
export const Colon = createToken({ name: 'Colon', pattern: /:/ });
export const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });
export const Dot = createToken({ name: 'Dot', pattern: /\./ });
export const AtSign = createToken({ name: 'AtSign', pattern: /@/ });

// ============================================================================
// Literals
// ============================================================================

// Number: decimal, hex (0x), binary (0b)
export const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /0x[0-9a-fA-F]+|0b[01]+|[0-9]+/,
});

// String: double-quoted with escape sequences
export const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(?:[^"\\]|\\.)*"/,
});

// ============================================================================
// Identifier (must come after all keywords to avoid matching keywords)
// ============================================================================

export const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
});

// ============================================================================
// Token Order (IMPORTANT: order matters for lexer matching)
// ============================================================================

// Keywords and type keywords must come BEFORE Identifier
// Multi-character operators must come BEFORE single-character operators
export const allTokens = [
  // Whitespace and comments (skipped)
  WhiteSpace,
  SingleLineComment,
  MultiLineComment,

  // Multi-character operators (before single char)
  Arrow,
  DotDot,
  Eq,
  Ne,
  Le,
  Ge,

  // Keywords - Circuit (before Identifier)
  Circuit,
  Input,
  Output,
  Clock,
  Node,
  Connect,
  State,
  Impl,
  On,
  Rising,
  Falling,
  If,
  Else,

  // Keywords - Testbench (longer keywords before shorter ones that are prefixes)
  Testbench,
  Use,
  Assert,  // Must come before As
  As,
  Stimulus,
  Capture,
  At,
  Step,
  Helpers,
  Function,
  Tick,
  Format,  // Must come before For
  Filename,
  For,
  In,
  Signals,

  // Type keywords
  Bit,
  Bus,
  Word,
  ArrayKw,
  True,
  False,

  // Single-character operators
  Assign,
  Lt,
  Gt,
  Plus,
  Minus,
  Star,
  Slash,
  Ampersand,
  Pipe,
  Caret,
  Tilde,
  Bang,

  // Delimiters
  LBrace,
  RBrace,
  LParen,
  RParen,
  LBracket,
  RBracket,
  Comma,
  Colon,
  Semicolon,
  Dot,
  AtSign,

  // Literals
  NumberLiteral,
  StringLiteral,

  // Identifier (MUST be last to not match keywords)
  Identifier,
];

// ============================================================================
// Lexer Instance
// ============================================================================

export const DSLLexer = new Lexer(allTokens);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a number literal token value
 */
export function parseNumberLiteral(value: string): number {
  if (value.startsWith('0x') || value.startsWith('0X')) {
    return parseInt(value.slice(2), 16);
  }
  if (value.startsWith('0b') || value.startsWith('0B')) {
    return parseInt(value.slice(2), 2);
  }
  return parseInt(value, 10);
}

/**
 * Parse a string literal token value (remove quotes and process escapes)
 */
export function parseStringLiteral(value: string): string {
  // Remove surrounding quotes
  const inner = value.slice(1, -1);
  // Process escape sequences
  return inner
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"');
}

/**
 * Get operator precedence (higher = tighter binding)
 */
export function getOperatorPrecedence(tokenType: string): number {
  switch (tokenType) {
    case 'Star':
    case 'Slash':
      return 7;
    case 'Plus':
    case 'Minus':
      return 6;
    case 'Lt':
    case 'Gt':
    case 'Le':
    case 'Ge':
      return 5;
    case 'Eq':
    case 'Ne':
      return 4;
    case 'Ampersand':
      return 3;
    case 'Caret':
      return 2;
    case 'Pipe':
      return 1;
    default:
      return 0;
  }
}

/**
 * Convert token type to operator string
 */
export function tokenTypeToOperator(tokenType: string): string | null {
  const mapping: Record<string, string> = {
    Plus: '+',
    Minus: '-',
    Star: '*',
    Slash: '/',
    Ampersand: '&',
    Pipe: '|',
    Caret: '^',
    Tilde: '~',
    Bang: '!',
    Eq: '==',
    Ne: '!=',
    Lt: '<',
    Gt: '>',
    Le: '<=',
    Ge: '>=',
  };
  return mapping[tokenType] ?? null;
}
