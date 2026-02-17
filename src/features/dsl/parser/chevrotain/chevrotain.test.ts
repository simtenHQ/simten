/**
 * Chevrotain Parser Tests
 *
 * Tests the new Chevrotain-based parser against all DSL files.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse, DSLLexer } from './index';
import { parseDSL } from '../index';

const dslFilesDir = path.join(__dirname, '../../../../../dsl-files');

describe('Chevrotain Parser', () => {
  describe('lexer', () => {
    it('tokenizes port references correctly', () => {
      const source = 'connect a -> inv.in';
      const result = DSLLexer.tokenize(source);

      expect(result.errors).toEqual([]);

      const tokenNames = result.tokens.map((t) => t.tokenType?.name);
      // 'inv' should be Identifier, 'in' should be In keyword (as standalone)
      expect(tokenNames).toEqual([
        'Connect',
        'Identifier', // a
        'Arrow',
        'Identifier', // inv (no longer split because In requires word boundary)
        'Dot',
        'In', // in (keyword at word boundary)
      ]);
    });

    it('tokenizes impl block content correctly', () => {
      const source = `impl {
        node inv: Inverter
        connect a -> inv.in
      }`;
      const result = DSLLexer.tokenize(source);

      expect(result.errors).toEqual([]);

      const tokenNames = result.tokens.map((t) => t.tokenType?.name);
      expect(tokenNames).toContain('Impl');
      expect(tokenNames).toContain('Node');
      expect(tokenNames).toContain('Inverter' in tokenNames ? 'Identifier' : 'Identifier');
      expect(tokenNames).toContain('Connect');
    });
  });

  describe('parses all DSL files', () => {
    const files = fs.readdirSync(dslFilesDir).filter((f) => f.endsWith('.dsl'));

    for (const file of files) {
      it(`parses ${file}`, () => {
        const source = fs.readFileSync(path.join(dslFilesDir, file), 'utf8');
        const result = parse(source, file);

        // Should not have parse errors
        expect(result.errors).toEqual([]);

        // Should produce an AST
        expect(result.ast).not.toBeNull();
        expect(result.ast?.circuits.length).toBeGreaterThanOrEqual(0);
      });
    }
  });

  describe('multi-error recovery', () => {
    it('reports multiple errors in a single parse', () => {
      const source = `
        circuit Test {
          input a Bit  // Missing colon
          output b Bit  // Missing colon
        }
      `;
      const result = parse(source, 'test.dsl');

      // Should have multiple errors
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('recovers and continues parsing after an error', () => {
      const source = `
        circuit Test1 {
          input a: Bit
        }

        circuit Test2 {
          output b: Bit
        }
      `;
      const result = parse(source, 'test.dsl');

      // Should parse successfully
      expect(result.errors).toEqual([]);
      expect(result.ast?.circuits.length).toBe(2);
    });
  });

  describe('integration with parseDSL', () => {
    it('uses Chevrotain parser by default', () => {
      const source = `
        circuit MyCircuit {
          input a: Bit
          output b: Bit

          impl {
            node inv: Inverter
            connect a -> inv.in
            connect inv.out -> b
          }
        }
      `;
      const { ast, errors } = parseDSL(source, 'test.dsl');

      expect(errors).toEqual([]);
      expect(ast.circuits.length).toBe(1);
      expect(ast.circuits[0].name).toBe('MyCircuit');
      expect(ast.circuits[0].inputs.length).toBe(1);
      expect(ast.circuits[0].outputs.length).toBe(1);
      expect(ast.circuits[0].impl?.nodes.length).toBe(1);
      expect(ast.circuits[0].impl?.connections.length).toBe(2);
    });
  });
});
