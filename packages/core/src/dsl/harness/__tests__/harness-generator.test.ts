/**
 * Harness Generator Tests
 */
import { describe, it, expect } from 'vitest';
import {
  generateHarnessDSL,
  generateHarness,
  analyzeForHarness,
  extractCircuitInterface,
} from '../harness-generator.js';

describe('harness-generator', () => {
  describe('generateHarnessDSL', () => {
    it('uses HexDisplay for Bus outputs', () => {
      const harness = generateHarnessDSL({
        name: 'Counter',
        inputs: [],
        outputs: [{ name: 'count', type: 'Bus', width: 8 }],
        clocks: ['clk'],
      });

      expect(harness).toContain('HexDisplay');
      expect(harness).not.toContain('node count_out: Display');
    });

    it('uses Led for Bit outputs', () => {
      const harness = generateHarnessDSL({
        name: 'Inverter',
        inputs: [{ name: 'a', type: 'Bit' }],
        outputs: [{ name: 'out', type: 'Bit' }],
        clocks: [],
      });

      expect(harness).toContain('node out_out: Led');
      expect(harness).not.toContain('HexDisplay');
    });

    it('uses Switch for Bit inputs and Input for Bus inputs', () => {
      const harness = generateHarnessDSL({
        name: 'Adder',
        inputs: [
          { name: 'a', type: 'Bus', width: 8 },
          { name: 'b', type: 'Bus', width: 8 },
          { name: 'cin', type: 'Bit' },
        ],
        outputs: [
          { name: 'sum', type: 'Bus', width: 8 },
          { name: 'cout', type: 'Bit' },
        ],
        clocks: [],
      });

      expect(harness).toContain('node a_sw: Input(value=0)');
      expect(harness).toContain('node b_sw: Input(value=0)');
      expect(harness).toContain('node cin_sw: Switch(value=0)');
      expect(harness).toContain('node sum_out: HexDisplay');
      expect(harness).toContain('node cout_out: Led');
    });
  });

  describe('analyzeForHarness', () => {
    it('detects HexDisplay as existing display', () => {
      const dsl = `
        circuit Test {
          impl {
            node sw: Switch
            node d: HexDisplay
          }
        }
      `;
      const analysis = analyzeForHarness(dsl);
      expect(analysis.needsHarness).toBe(false);
    });

    it('detects Display as existing display', () => {
      const dsl = `
        circuit Test {
          impl {
            node sw: Switch
            node d: Display
          }
        }
      `;
      const analysis = analyzeForHarness(dsl);
      expect(analysis.needsHarness).toBe(false);
    });
  });

  describe('extractCircuitInterface', () => {
    it('extracts interface from clock-driven circuit', () => {
      const dsl = `
        circuit Counter {
          clock clk
          output count: Bus[8]
          impl {
            node reg: Register
          }
        }
      `;
      const iface = extractCircuitInterface(dsl);
      expect(iface?.name).toBe('Counter');
      expect(iface?.outputs).toEqual([{ name: 'count', type: 'Bus', width: 8 }]);
      expect(iface?.clocks).toEqual(['clk']);
    });
  });

  describe('generateHarness (end-to-end)', () => {
    it('generates harness with HexDisplay for Bus output circuit', () => {
      const dsl = `
        circuit Counter {
          clock clk
          output count: Bus[8]
          impl {
            node reg: Register
          }
        }
      `;
      const harness = generateHarness(dsl);
      expect(harness).not.toBeNull();
      expect(harness).toContain('HexDisplay');
      expect(harness).toContain('CounterHarness');
    });
  });
});
