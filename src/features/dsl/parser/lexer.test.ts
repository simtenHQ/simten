/**
 * Lexer Tests
 */

import { describe, it, expect } from 'vitest';
import { Lexer, tokenize, LexerError } from './lexer';
import { TokenType } from './token';

describe('Lexer', () => {
  describe('Keywords', () => {
    it('should tokenize all keywords', () => {
      const input = 'circuit input output clock node connect state impl on rising falling if else';
      const tokens = tokenize(input);

      expect(tokens).toHaveLength(14); // 13 keywords + EOF
      expect(tokens[0].type).toBe(TokenType.CIRCUIT);
      expect(tokens[1].type).toBe(TokenType.INPUT);
      expect(tokens[2].type).toBe(TokenType.OUTPUT);
      expect(tokens[3].type).toBe(TokenType.CLOCK);
      expect(tokens[4].type).toBe(TokenType.NODE);
      expect(tokens[5].type).toBe(TokenType.CONNECT);
      expect(tokens[6].type).toBe(TokenType.STATE);
      expect(tokens[7].type).toBe(TokenType.IMPL);
      expect(tokens[8].type).toBe(TokenType.ON);
      expect(tokens[9].type).toBe(TokenType.RISING);
      expect(tokens[10].type).toBe(TokenType.FALLING);
      expect(tokens[11].type).toBe(TokenType.IF);
      expect(tokens[12].type).toBe(TokenType.ELSE);
      expect(tokens[13].type).toBe(TokenType.EOF);
    });

    it('should tokenize built-in types', () => {
      const input = 'Bit Bus Word Array true false';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.BIT);
      expect(tokens[1].type).toBe(TokenType.BUS);
      expect(tokens[2].type).toBe(TokenType.WORD);
      expect(tokens[3].type).toBe(TokenType.ARRAY);
      expect(tokens[4].type).toBe(TokenType.TRUE);
      expect(tokens[5].type).toBe(TokenType.FALSE);
    });
  });

  describe('Identifiers', () => {
    it('should tokenize simple identifiers', () => {
      const input = 'foo bar baz_123 MyComponent';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('foo');
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('bar');
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[2].value).toBe('baz_123');
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('MyComponent');
    });

    it('should distinguish identifiers from keywords', () => {
      const input = 'circuit Circuit CIRCUIT circuitFoo';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.CIRCUIT); // keyword
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER); // different case
      expect(tokens[2].type).toBe(TokenType.IDENTIFIER); // all caps
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER); // prefix
    });
  });

  describe('Numbers', () => {
    it('should tokenize decimal numbers', () => {
      const input = '0 1 42 123456';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].numberValue).toBe(0);
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].numberValue).toBe(1);
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].numberValue).toBe(42);
      expect(tokens[3].type).toBe(TokenType.NUMBER);
      expect(tokens[3].numberValue).toBe(123456);
    });

    it('should tokenize hexadecimal numbers', () => {
      const input = '0x00 0xFF 0x1A2B';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].numberValue).toBe(0);
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].numberValue).toBe(255);
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].numberValue).toBe(6699);
    });

    it('should tokenize binary numbers', () => {
      const input = '0b0 0b1 0b1010 0b11111111';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].numberValue).toBe(0);
      expect(tokens[1].type).toBe(TokenType.NUMBER);
      expect(tokens[1].numberValue).toBe(1);
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].numberValue).toBe(10);
      expect(tokens[3].type).toBe(TokenType.NUMBER);
      expect(tokens[3].numberValue).toBe(255);
    });
  });

  describe('Strings', () => {
    it('should tokenize simple strings', () => {
      const input = '"hello" "world"';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].stringValue).toBe('hello');
      expect(tokens[1].type).toBe(TokenType.STRING);
      expect(tokens[1].stringValue).toBe('world');
    });

    it('should handle escape sequences', () => {
      const input = '"hello\\nworld" "tab\\there" "quote\\"here"';
      const tokens = tokenize(input);

      expect(tokens[0].stringValue).toBe('hello\nworld');
      expect(tokens[1].stringValue).toBe('tab\there');
      expect(tokens[2].stringValue).toBe('quote"here');
    });

    it('should error on unterminated string', () => {
      const input = '"unterminated';
      expect(() => tokenize(input)).toThrow(LexerError);
    });
  });

  describe('Operators', () => {
    it('should tokenize single-character operators', () => {
      const input = '+ - * / & | ^ ~ ! < >';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.PLUS);
      expect(tokens[1].type).toBe(TokenType.MINUS);
      expect(tokens[2].type).toBe(TokenType.STAR);
      expect(tokens[3].type).toBe(TokenType.SLASH);
      expect(tokens[4].type).toBe(TokenType.AMPERSAND);
      expect(tokens[5].type).toBe(TokenType.PIPE);
      expect(tokens[6].type).toBe(TokenType.CARET);
      expect(tokens[7].type).toBe(TokenType.TILDE);
      expect(tokens[8].type).toBe(TokenType.BANG);
      expect(tokens[9].type).toBe(TokenType.LT);
      expect(tokens[10].type).toBe(TokenType.GT);
    });

    it('should tokenize multi-character operators', () => {
      const input = '-> == != <= >=';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.ARROW);
      expect(tokens[1].type).toBe(TokenType.EQ);
      expect(tokens[2].type).toBe(TokenType.NE);
      expect(tokens[3].type).toBe(TokenType.LE);
      expect(tokens[4].type).toBe(TokenType.GE);
    });

    it('should distinguish = from ==', () => {
      const input = '= == = ==';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.ASSIGN);
      expect(tokens[1].type).toBe(TokenType.EQ);
      expect(tokens[2].type).toBe(TokenType.ASSIGN);
      expect(tokens[3].type).toBe(TokenType.EQ);
    });
  });

  describe('Delimiters', () => {
    it('should tokenize all delimiters', () => {
      const input = '{ } ( ) [ ] , : ; .';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.LBRACE);
      expect(tokens[1].type).toBe(TokenType.RBRACE);
      expect(tokens[2].type).toBe(TokenType.LPAREN);
      expect(tokens[3].type).toBe(TokenType.RPAREN);
      expect(tokens[4].type).toBe(TokenType.LBRACKET);
      expect(tokens[5].type).toBe(TokenType.RBRACKET);
      expect(tokens[6].type).toBe(TokenType.COMMA);
      expect(tokens[7].type).toBe(TokenType.COLON);
      expect(tokens[8].type).toBe(TokenType.SEMICOLON);
      expect(tokens[9].type).toBe(TokenType.DOT);
    });
  });

  describe('Comments', () => {
    it('should skip single-line comments', () => {
      const input = 'foo // this is a comment\nbar';
      const tokens = tokenize(input);

      expect(tokens).toHaveLength(3); // foo, bar, EOF
      expect(tokens[0].value).toBe('foo');
      expect(tokens[1].value).toBe('bar');
    });

    it('should skip multi-line comments', () => {
      const input = 'foo /* this is\na multi-line\ncomment */ bar';
      const tokens = tokenize(input);

      expect(tokens).toHaveLength(3); // foo, bar, EOF
      expect(tokens[0].value).toBe('foo');
      expect(tokens[1].value).toBe('bar');
    });

    it('should error on unterminated multi-line comment', () => {
      const input = 'foo /* unterminated comment';
      expect(() => tokenize(input)).toThrow(LexerError);
    });
  });

  describe('Location Tracking', () => {
    it('should track line and column numbers', () => {
      const input = 'foo\nbar\nbaz';
      const tokens = tokenize(input);

      expect(tokens[0].location.start.line).toBe(1);
      expect(tokens[0].location.start.column).toBe(1);

      expect(tokens[1].location.start.line).toBe(2);
      expect(tokens[1].location.start.column).toBe(1);

      expect(tokens[2].location.start.line).toBe(3);
      expect(tokens[2].location.start.column).toBe(1);
    });

    it('should track columns correctly', () => {
      const input = 'foo bar baz';
      const tokens = tokenize(input);

      expect(tokens[0].location.start.column).toBe(1);
      expect(tokens[1].location.start.column).toBe(5);
      expect(tokens[2].location.start.column).toBe(9);
    });
  });

  describe('Real-world Examples', () => {
    it('should tokenize a simple circuit definition', () => {
      const input = `
        circuit HalfAdder {
          input a: Bit
          input b: Bit
          output sum: Bit
          output carry: Bit
        }
      `;

      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.CIRCUIT);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('HalfAdder');
      expect(tokens[2].type).toBe(TokenType.LBRACE);
      expect(tokens[3].type).toBe(TokenType.INPUT);
      // ... etc
    });

    it('should tokenize a connection statement', () => {
      const input = 'connect a -> xor1.a';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.CONNECT);
      expect(tokens[1].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[1].value).toBe('a');
      expect(tokens[2].type).toBe(TokenType.ARROW);
      expect(tokens[3].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[3].value).toBe('xor1');
      expect(tokens[4].type).toBe(TokenType.DOT);
      expect(tokens[5].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[5].value).toBe('a');
    });

    it('should tokenize a parameterized bus type', () => {
      const input = 'Bus[8]';
      const tokens = tokenize(input);

      expect(tokens[0].type).toBe(TokenType.BUS);
      expect(tokens[1].type).toBe(TokenType.LBRACKET);
      expect(tokens[2].type).toBe(TokenType.NUMBER);
      expect(tokens[2].numberValue).toBe(8);
      expect(tokens[3].type).toBe(TokenType.RBRACKET);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const tokens = tokenize('');
      expect(tokens.length).toBeGreaterThanOrEqual(1); // At least EOF
      expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
    });

    it('should handle whitespace-only input', () => {
      const tokens = tokenize('   \n  \t  \n  ');
      expect(tokens.length).toBeGreaterThanOrEqual(1); // At least EOF
      expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
      // Should have no real tokens besides EOF
      const nonEOFTokens = tokens.filter(t => t.type !== TokenType.EOF);
      expect(nonEOFTokens).toHaveLength(0);
    });

    it('should handle mixed line endings', () => {
      const input = 'foo\nbar\r\nbaz\r';
      const tokens = tokenize(input);
      // Filter out EOF
      const contentTokens = tokens.filter(t => t.type !== TokenType.EOF);
      expect(contentTokens).toHaveLength(3); // foo, bar, baz
      expect(contentTokens[0].value).toBe('foo');
      expect(contentTokens[1].value).toBe('bar');
      expect(contentTokens[2].value).toBe('baz');
    });

    it('should error on invalid characters', () => {
      // Note: @ is now a valid token (AT_SIGN), so use backtick instead
      const input = 'foo ` bar';
      expect(() => tokenize(input)).toThrow(LexerError);
    });
  });
});
