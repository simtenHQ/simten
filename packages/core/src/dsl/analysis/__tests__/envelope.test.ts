/**
 * LLM Envelope Tests
 *
 * Tests the canonical HardwareLLMEnvelope contract.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ENVELOPE_VERSION,
  buildEnvelope,
  buildMinimalEnvelope,
  buildFullEnvelope,
  isEnvelopeValid,
  hasErrors,
  serializeEnvelope,
  parseEnvelope,
  getEnvelopeStatusCode,
} from '../envelope.js';
import { validateCircuit } from '../../validation/index.js';
import { analyzeCircuit } from '../metrics.js';
import { elaborate } from '../../../simulator/elaboration.js';
import { createComponentLibrary } from '../../../simulator/index.js';
import { PRIMITIVES } from '../../../simulator/primitives.js';
import { compileToIR } from '../../compiler/index.js';
import { parseDSL } from '../../parser/index.js';
import type { ElaboratedContext } from '../types.js';

describe('LLM Envelope', () => {
  let library: ReturnType<typeof createComponentLibrary>;

  beforeEach(() => {
    library = createComponentLibrary(PRIMITIVES);
  });

  function createContext(source: string): ElaboratedContext | null {
    const { ast, errors } = parseDSL(source, { componentLibrary: library });
    if (errors.length > 0) {
      return null;
    }

    const compilerLibrary = {
      getCircuit: (name: string) => library.resolveComponent(name),
      hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
      addCircuit: () => {},
    };

    try {
      const circuits = compileToIR(ast, compilerLibrary);
      if (circuits.length === 0) return null;
      const circuit = circuits[0];
      const flat = elaborate(circuit, library);
      return { circuit, flat, library };
    } catch {
      return null;
    }
  }

  describe('buildEnvelope', () => {
    it('includes version field', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
        }
      `;

      const validation = validateCircuit(source, { componentLibrary: library });
      const envelope = buildEnvelope({
        validation,
        library,
      });

      expect(envelope.version).toBe(ENVELOPE_VERSION);
    });

    it('all fields are present (never undefined)', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
        }
      `;

      const validation = validateCircuit(source, { componentLibrary: library });
      const envelope = buildEnvelope({
        validation,
        library,
      });

      // Check all required fields exist
      expect(envelope).toHaveProperty('version');
      expect(envelope).toHaveProperty('validation');
      expect(envelope).toHaveProperty('metrics');
      expect(envelope).toHaveProperty('behavioralDiagnostics');
      expect(envelope).toHaveProperty('simulation');
      expect(envelope).toHaveProperty('delta');
      expect(envelope).toHaveProperty('components');
      expect(envelope).toHaveProperty('grammarSummary');

      // Fields should be null, not undefined
      expect(envelope.metrics).toBeNull();
      expect(envelope.simulation).toBeNull();
      expect(envelope.delta).toBeNull();

      // Arrays should be arrays, not undefined
      expect(Array.isArray(envelope.behavioralDiagnostics)).toBe(true);
      expect(Array.isArray(envelope.components)).toBe(true);
    });

    it('includes metrics when provided', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
          impl {
            node inv: Not
            connect a -> inv.in
            connect inv.out -> out
          }
        }
      `;

      const validation = validateCircuit(source, { componentLibrary: library });
      const ctx = createContext(source);

      if (ctx) {
        const metrics = analyzeCircuit(ctx);
        const envelope = buildEnvelope({
          validation,
          metrics,
          library,
        });

        expect(envelope.metrics).not.toBeNull();
        expect(envelope.metrics?.nodeCount).toBeGreaterThan(0);
      }
    });
  });

  describe('buildMinimalEnvelope', () => {
    it('creates envelope with validation only', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
        }
      `;

      const validation = validateCircuit(source, { componentLibrary: library });
      const envelope = buildMinimalEnvelope(validation, library);

      expect(envelope.validation).toBeDefined();
      expect(envelope.metrics).toBeNull();
      expect(envelope.simulation).toBeNull();
    });
  });

  describe('buildFullEnvelope', () => {
    it('creates envelope with metrics', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
          impl {
            node inv: Not
            connect a -> inv.in
            connect inv.out -> out
          }
        }
      `;

      const validation = validateCircuit(source, { componentLibrary: library });
      const ctx = createContext(source);

      if (ctx) {
        const metrics = analyzeCircuit(ctx);
        const envelope = buildFullEnvelope(validation, metrics, library);

        expect(envelope.metrics).not.toBeNull();
      }
    });
  });

  describe('status helpers', () => {
    it('isEnvelopeValid returns true for valid circuit', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
        }
      `;

      const validation = validateCircuit(source, { componentLibrary: library });
      const envelope = buildMinimalEnvelope(validation, library);

      expect(isEnvelopeValid(envelope)).toBe(true);
    });

    it('isEnvelopeValid returns false for invalid circuit', () => {
      const source = `
        circuit Test {
          input a Bit
        }
      `;

      const validation = validateCircuit(source, { componentLibrary: library });
      const envelope = buildMinimalEnvelope(validation, library);

      expect(isEnvelopeValid(envelope)).toBe(false);
    });

    it('hasErrors correctly detects errors', () => {
      const validSource = `
        circuit Test {
          input a: Bit
          output out: Bit
        }
      `;

      const invalidSource = `
        circuit Test {
          input a Bit
        }
      `;

      const validEnvelope = buildMinimalEnvelope(
        validateCircuit(validSource, { componentLibrary: library }),
        library
      );

      const invalidEnvelope = buildMinimalEnvelope(
        validateCircuit(invalidSource, { componentLibrary: library }),
        library
      );

      expect(hasErrors(validEnvelope)).toBe(false);
      expect(hasErrors(invalidEnvelope)).toBe(true);
    });

    it('getEnvelopeStatusCode returns correct status', () => {
      const validSource = `
        circuit Test {
          input a: Bit
          output out: Bit
          impl {
            node inv: Not
            connect a -> inv.in
            connect inv.out -> out
          }
        }
      `;

      const validation = validateCircuit(validSource, { componentLibrary: library });
      const envelope = buildMinimalEnvelope(validation, library);

      expect(getEnvelopeStatusCode(envelope)).toBe('valid');
    });
  });

  describe('serialization', () => {
    it('serializes to valid JSON', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
        }
      `;

      const validation = validateCircuit(source, { componentLibrary: library });
      const envelope = buildMinimalEnvelope(validation, library);
      const json = serializeEnvelope(envelope);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('round-trips correctly', () => {
      const source = `
        circuit Test {
          input a: Bit
          output out: Bit
        }
      `;

      const validation = validateCircuit(source, { componentLibrary: library });
      const original = buildMinimalEnvelope(validation, library);
      const json = serializeEnvelope(original);
      const parsed = parseEnvelope(json);

      expect(parsed.version).toBe(original.version);
      expect(parsed.validation.valid).toBe(original.validation.valid);
    });
  });
});
