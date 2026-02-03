/**
 * DSL Lexer (Tokenizer)
 *
 * Converts raw DSL text into a stream of tokens.
 *
 * Features:
 * - Recognizes all DSL keywords, operators, and literals
 * - Tracks source locations for error reporting
 * - Handles comments (both single-line and multi-line)
 * - Supports multiple number formats (decimal, hex, binary)
 * - Provides helpful error messages for invalid tokens
 */

import { createLocation, createRange, SourceLocation, SourceRange } from '../types/ast';
import { Token, TokenType, createToken, getKeywordType } from './token';

// ============================================================================
// Lexer Error
// ============================================================================

export class LexerError extends Error {
  constructor(
    message: string,
    public location: SourceLocation,
    public source?: string
  ) {
    super(message);
    this.name = 'LexerError';
  }
}

// ============================================================================
// Lexer
// ============================================================================

export class Lexer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private source?: string;

  constructor(input: string, source?: string) {
    this.input = input;
    this.source = source;
  }

  /**
   * Tokenize the entire input
   */
  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      const token = this.nextToken();
      // Skip newlines and comments in the token stream
      // (they can be preserved if needed for formatting tools)
      if (
        token.type !== TokenType.NEWLINE &&
        token.type !== TokenType.COMMENT
      ) {
        tokens.push(token);
      }
    }

    // Add EOF token
    tokens.push(
      createToken(
        TokenType.EOF,
        '',
        this.createRange(this.currentLocation(), this.currentLocation())
      )
    );

    return tokens;
  }

  /**
   * Get the next token
   */
  private nextToken(): Token {
    this.skipWhitespace();

    if (this.isAtEnd()) {
      return createToken(
        TokenType.EOF,
        '',
        this.createRange(this.currentLocation(), this.currentLocation())
      );
    }

    const start = this.currentLocation();
    const char = this.peek();

    // Comments
    if (char === '/' && this.peekNext() === '/') {
      return this.scanSingleLineComment(start);
    }
    if (char === '/' && this.peekNext() === '*') {
      return this.scanMultiLineComment(start);
    }

    // Numbers
    if (this.isDigit(char)) {
      return this.scanNumber(start);
    }

    // Strings
    if (char === '"') {
      return this.scanString(start);
    }

    // Identifiers and keywords
    if (this.isAlpha(char) || char === '_') {
      return this.scanIdentifier(start);
    }

    // Operators and delimiters
    return this.scanOperatorOrDelimiter(start);
  }

  /**
   * Skip whitespace (but track newlines)
   */
  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else if (char === '\n') {
        this.advance();
        this.line++;
        this.column = 1;
      } else {
        break;
      }
    }
  }

  /**
   * Scan a single-line comment
   */
  private scanSingleLineComment(start: SourceLocation): Token {
    this.advance(); // /
    this.advance(); // /

    const valueStart = this.position;
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }

    const value = this.input.substring(valueStart, this.position);
    return createToken(TokenType.COMMENT, value, this.createRange(start, this.currentLocation()));
  }

  /**
   * Scan a multi-line comment
   */
  private scanMultiLineComment(start: SourceLocation): Token {
    this.advance(); // /
    this.advance(); // *

    const valueStart = this.position;
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        const value = this.input.substring(valueStart, this.position);
        this.advance(); // *
        this.advance(); // /
        return createToken(TokenType.COMMENT, value, this.createRange(start, this.currentLocation()));
      }
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      this.advance();
    }

    throw new LexerError('Unterminated multi-line comment', start, this.source);
  }

  /**
   * Scan a number (decimal, hex, or binary)
   */
  private scanNumber(start: SourceLocation): Token {
    let value = '';
    let base = 10;

    // Check for hex (0x) or binary (0b)
    if (this.peek() === '0' && (this.peekNext() === 'x' || this.peekNext() === 'X')) {
      base = 16;
      this.advance(); // 0
      this.advance(); // x
      while (!this.isAtEnd() && this.isHexDigit(this.peek())) {
        value += this.advance();
      }
    } else if (this.peek() === '0' && (this.peekNext() === 'b' || this.peekNext() === 'B')) {
      base = 2;
      this.advance(); // 0
      this.advance(); // b
      while (!this.isAtEnd() && this.isBinaryDigit(this.peek())) {
        value += this.advance();
      }
    } else {
      // Decimal
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    if (value === '') {
      throw new LexerError('Invalid number literal', start, this.source);
    }

    const numberValue = parseInt(value, base);
    const token = createToken(
      TokenType.NUMBER,
      value,
      this.createRange(start, this.currentLocation())
    );
    token.numberValue = numberValue;
    return token;
  }

  /**
   * Scan a string literal
   */
  private scanString(start: SourceLocation): Token {
    this.advance(); // opening "

    let value = '';
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.advance();
        if (this.isAtEnd()) {
          throw new LexerError('Unterminated string literal', start, this.source);
        }
        // Handle escape sequences
        const escaped = this.advance();
        switch (escaped) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '\\':
            value += '\\';
            break;
          case '"':
            value += '"';
            break;
          default:
            value += escaped;
        }
      } else {
        if (this.peek() === '\n') {
          this.line++;
          this.column = 1;
        }
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new LexerError('Unterminated string literal', start, this.source);
    }

    this.advance(); // closing "

    const token = createToken(
      TokenType.STRING,
      value,
      this.createRange(start, this.currentLocation())
    );
    token.stringValue = value;
    return token;
  }

  /**
   * Scan an identifier or keyword
   */
  private scanIdentifier(start: SourceLocation): Token {
    let value = '';
    while (!this.isAtEnd() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_')) {
      value += this.advance();
    }

    const type = getKeywordType(value);
    const token = createToken(type, value, this.createRange(start, this.currentLocation()));

    // Set boolean value for true/false
    if (type === TokenType.TRUE) {
      token.boolValue = true;
    } else if (type === TokenType.FALSE) {
      token.boolValue = false;
    }

    return token;
  }

  /**
   * Scan an operator or delimiter
   */
  private scanOperatorOrDelimiter(start: SourceLocation): Token {
    const char = this.advance();

    switch (char) {
      case '{':
        return createToken(TokenType.LBRACE, char, this.createRange(start, this.currentLocation()));
      case '}':
        return createToken(TokenType.RBRACE, char, this.createRange(start, this.currentLocation()));
      case '(':
        return createToken(TokenType.LPAREN, char, this.createRange(start, this.currentLocation()));
      case ')':
        return createToken(TokenType.RPAREN, char, this.createRange(start, this.currentLocation()));
      case '[':
        return createToken(TokenType.LBRACKET, char, this.createRange(start, this.currentLocation()));
      case ']':
        return createToken(TokenType.RBRACKET, char, this.createRange(start, this.currentLocation()));
      case ',':
        return createToken(TokenType.COMMA, char, this.createRange(start, this.currentLocation()));
      case ':':
        return createToken(TokenType.COLON, char, this.createRange(start, this.currentLocation()));
      case ';':
        return createToken(TokenType.SEMICOLON, char, this.createRange(start, this.currentLocation()));
      case '.':
        if (this.peek() === '.') {
          this.advance();
          return createToken(TokenType.DOTDOT, '..', this.createRange(start, this.currentLocation()));
        }
        return createToken(TokenType.DOT, char, this.createRange(start, this.currentLocation()));
      case '+':
        return createToken(TokenType.PLUS, char, this.createRange(start, this.currentLocation()));
      case '*':
        return createToken(TokenType.STAR, char, this.createRange(start, this.currentLocation()));
      case '/':
        return createToken(TokenType.SLASH, char, this.createRange(start, this.currentLocation()));
      case '&':
        return createToken(TokenType.AMPERSAND, char, this.createRange(start, this.currentLocation()));
      case '|':
        return createToken(TokenType.PIPE, char, this.createRange(start, this.currentLocation()));
      case '^':
        return createToken(TokenType.CARET, char, this.createRange(start, this.currentLocation()));
      case '~':
        return createToken(TokenType.TILDE, char, this.createRange(start, this.currentLocation()));

      case '-':
        if (this.peek() === '>') {
          this.advance();
          return createToken(TokenType.ARROW, '->', this.createRange(start, this.currentLocation()));
        }
        return createToken(TokenType.MINUS, char, this.createRange(start, this.currentLocation()));

      case '=':
        if (this.peek() === '=') {
          this.advance();
          return createToken(TokenType.EQ, '==', this.createRange(start, this.currentLocation()));
        }
        return createToken(TokenType.ASSIGN, char, this.createRange(start, this.currentLocation()));

      case '!':
        if (this.peek() === '=') {
          this.advance();
          return createToken(TokenType.NE, '!=', this.createRange(start, this.currentLocation()));
        }
        return createToken(TokenType.BANG, char, this.createRange(start, this.currentLocation()));

      case '<':
        if (this.peek() === '=') {
          this.advance();
          return createToken(TokenType.LE, '<=', this.createRange(start, this.currentLocation()));
        }
        return createToken(TokenType.LT, char, this.createRange(start, this.currentLocation()));

      case '>':
        if (this.peek() === '=') {
          this.advance();
          return createToken(TokenType.GE, '>=', this.createRange(start, this.currentLocation()));
        }
        return createToken(TokenType.GT, char, this.createRange(start, this.currentLocation()));

      case '@':
        return createToken(TokenType.AT_SIGN, char, this.createRange(start, this.currentLocation()));

      default:
        throw new LexerError(`Unexpected character: '${char}'`, start, this.source);
    }
  }

  // ==========================================================================
  // Character Classification
  // ==========================================================================

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isHexDigit(char: string): boolean {
    return (
      this.isDigit(char) ||
      (char >= 'a' && char <= 'f') ||
      (char >= 'A' && char <= 'F')
    );
  }

  private isBinaryDigit(char: string): boolean {
    return char === '0' || char === '1';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  // ==========================================================================
  // Position Tracking
  // ==========================================================================

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.input[this.position];
  }

  private peekNext(): string {
    if (this.position + 1 >= this.input.length) return '\0';
    return this.input[this.position + 1];
  }

  private advance(): string {
    const char = this.input[this.position];
    this.position++;
    this.column++;
    return char;
  }

  private isAtEnd(): boolean {
    return this.position >= this.input.length;
  }

  private currentLocation(): SourceLocation {
    return createLocation(this.line, this.column, this.position, this.source);
  }

  private createRange(start: SourceLocation, end: SourceLocation): SourceRange {
    return createRange(start, end, this.source);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Tokenize DSL source code
 */
export function tokenize(input: string, source?: string): Token[] {
  const lexer = new Lexer(input, source);
  return lexer.tokenize();
}
