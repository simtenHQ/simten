/**
 * VCD Generator Tests
 *
 * Tests VCD file generation and formatting.
 */

import { describe, expect, it } from 'vitest';
import { type CaptureData, type SignalRef, TraceData } from '../../types/testbench';
import {
  formatVCDStats,
  generateVCD,
  getVCDStats,
  parseVCDHeader,
} from '../visualization/vcd-generator';

describe('VCD Generator', () => {
  describe('Basic VCD Generation', () => {
    it('should generate valid VCD header', () => {
      const captureData = createSimpleCaptureData();
      const vcd = generateVCD(captureData);

      expect(vcd).toContain('$date');
      expect(vcd).toContain('$version');
      expect(vcd).toContain('$timescale');
      expect(vcd).toContain('1 ns');
      expect(vcd).toContain('$end');
    });

    it('should declare all signals', () => {
      const captureData = createSimpleCaptureData();
      const vcd = generateVCD(captureData);

      expect(vcd).toContain('$var wire 1 ! clk $end');
      expect(vcd).toContain('$var wire 8 " data $end');
    });

    it('should generate value changes', () => {
      const captureData = createSimpleCaptureData();
      const vcd = generateVCD(captureData);

      // Check for timestamps
      expect(vcd).toContain('#0');
      expect(vcd).toContain('#1');
      expect(vcd).toContain('#2');

      // Check for value changes
      expect(vcd).toContain('0!'); // clk = 0
      expect(vcd).toContain('1!'); // clk = 1
      expect(vcd).toContain('b00000000 "'); // data = 0
    });

    it('should handle bit signals correctly', () => {
      const captureData: CaptureData = {
        config: {
          signals: [],
          format: 'vcd',
          filename: 'test.vcd',
        },
        traces: new Map([
          [
            'reset',
            {
              signal: { nodeId: '', portName: 'reset', displayName: 'reset', width: 1 },
              values: [true, false],
              changes: [
                { cycle: 0, value: true },
                { cycle: 1, value: false },
              ],
            },
          ],
        ]),
      };

      const vcd = generateVCD(captureData);

      expect(vcd).toContain('1!'); // reset = true (1)
      expect(vcd).toContain('0!'); // reset = false (0)
    });

    it('should handle bus signals correctly', () => {
      const captureData: CaptureData = {
        config: {
          signals: [],
          format: 'vcd',
          filename: 'test.vcd',
        },
        traces: new Map([
          [
            'data',
            {
              signal: { nodeId: '', portName: 'data', displayName: 'data', width: 8 },
              values: [0, 42, 255],
              changes: [
                { cycle: 0, value: 0 },
                { cycle: 1, value: 42 },
                { cycle: 2, value: 255 },
              ],
            },
          ],
        ]),
      };

      const vcd = generateVCD(captureData);

      expect(vcd).toContain('b00000000 !'); // data = 0
      expect(vcd).toContain('b00101010 !'); // data = 42
      expect(vcd).toContain('b11111111 !'); // data = 255
    });

    it('should handle multiple signals changing in same cycle', () => {
      const captureData: CaptureData = {
        config: {
          signals: [],
          format: 'vcd',
          filename: 'test.vcd',
        },
        traces: new Map([
          [
            'a',
            {
              signal: { nodeId: '', portName: 'a', displayName: 'a', width: 1 },
              values: [false, true],
              changes: [
                { cycle: 0, value: false },
                { cycle: 5, value: true },
              ],
            },
          ],
          [
            'b',
            {
              signal: { nodeId: '', portName: 'b', displayName: 'b', width: 1 },
              values: [true, false],
              changes: [
                { cycle: 0, value: true },
                { cycle: 5, value: false },
              ],
            },
          ],
        ]),
      };

      const vcd = generateVCD(captureData);

      // Should have only 2 timestamps (0 and 5)
      const timestamps = vcd.match(/#\d+/g);
      expect(timestamps).toHaveLength(2);
      expect(timestamps).toContain('#0');
      expect(timestamps).toContain('#5');
    });
  });

  describe('VCD Identifier Generation', () => {
    it('should generate unique identifiers for many signals', () => {
      const signals: SignalRef[] = [];
      for (let i = 0; i < 100; i++) {
        signals.push({
          nodeId: '',
          portName: `sig${i}`,
          displayName: `sig${i}`,
          width: 1,
        });
      }

      const captureData: CaptureData = {
        config: {
          signals: [],
          format: 'vcd',
          filename: 'test.vcd',
        },
        traces: new Map(
          signals.map((sig, i) => [
            sig.portName,
            {
              signal: sig,
              values: [false],
              changes: [{ cycle: 0, value: false }],
            },
          ]),
        ),
      };

      const vcd = generateVCD(captureData);

      // Check that all signals are declared
      for (let i = 0; i < 100; i++) {
        expect(vcd).toContain(`sig${i} $end`);
      }
    });
  });

  describe('VCD Parsing', () => {
    it('should parse VCD header correctly', () => {
      const captureData = createSimpleCaptureData();
      const vcd = generateVCD(captureData);

      const parsed = parseVCDHeader(vcd);

      expect(parsed.timescale).toBe('1 ns');
      expect(parsed.signals).toHaveLength(2);
      expect(parsed.signals[0].name).toBe('clk');
      expect(parsed.signals[0].width).toBe(1);
      expect(parsed.signals[1].name).toBe('data');
      expect(parsed.signals[1].width).toBe(8);
    });
  });

  describe('VCD Statistics', () => {
    it('should calculate VCD stats correctly', () => {
      const captureData = createSimpleCaptureData();
      const stats = getVCDStats(captureData);

      expect(stats.signalCount).toBe(2);
      expect(stats.totalCycles).toBe(3); // cycles 0, 1, 2
      expect(stats.totalChanges).toBeGreaterThan(0);
      expect(stats.fileSize).toBeGreaterThan(0);
    });

    it('should format stats for display', () => {
      const captureData = createSimpleCaptureData();
      const stats = getVCDStats(captureData);
      const formatted = formatVCDStats(stats);

      expect(formatted).toContain('VCD Statistics:');
      expect(formatted).toContain('Signals: 2');
      expect(formatted).toContain('Cycles: 3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty capture data', () => {
      const captureData: CaptureData = {
        config: {
          signals: [],
          format: 'vcd',
          filename: 'test.vcd',
        },
        traces: new Map(),
      };

      const vcd = generateVCD(captureData);

      expect(vcd).toContain('$date');
      expect(vcd).toContain('$end');
    });

    it('should handle signal with no changes', () => {
      const captureData: CaptureData = {
        config: {
          signals: [],
          format: 'vcd',
          filename: 'test.vcd',
        },
        traces: new Map([
          [
            'static',
            {
              signal: { nodeId: '', portName: 'static', displayName: 'static', width: 1 },
              values: [true],
              changes: [], // No changes
            },
          ],
        ]),
      };

      const vcd = generateVCD(captureData);

      expect(vcd).toContain('$var wire 1 ! static $end');
    });

    it('should handle large bus widths', () => {
      const captureData: CaptureData = {
        config: {
          signals: [],
          format: 'vcd',
          filename: 'test.vcd',
        },
        traces: new Map([
          [
            'wide_bus',
            {
              signal: { nodeId: '', portName: 'wide_bus', displayName: 'wide_bus', width: 32 },
              values: [0xdeadbeef],
              changes: [{ cycle: 0, value: 0xdeadbeef }],
            },
          ],
        ]),
      };

      const vcd = generateVCD(captureData);

      expect(vcd).toContain('$var wire 32 ! wide_bus $end');
      // 0xDEADBEEF = 11011110101011011011111011101111
      expect(vcd).toContain('b11011110101011011011111011101111 !');
    });
  });

  describe('Real-World Example', () => {
    it('should generate VCD for counter circuit', () => {
      const captureData: CaptureData = {
        config: {
          signals: [],
          format: 'vcd',
          filename: 'counter.vcd',
        },
        traces: new Map([
          [
            'clk',
            {
              signal: { nodeId: '', portName: 'clk', displayName: 'clk', width: 1 },
              values: [false, true, false, true, false, true],
              changes: [
                { cycle: 0, value: false },
                { cycle: 1, value: true },
                { cycle: 2, value: false },
                { cycle: 3, value: true },
                { cycle: 4, value: false },
                { cycle: 5, value: true },
              ],
            },
          ],
          [
            'reset',
            {
              signal: { nodeId: '', portName: 'reset', displayName: 'reset', width: 1 },
              values: [true, false, false, false, false, false],
              changes: [
                { cycle: 0, value: true },
                { cycle: 1, value: false },
              ],
            },
          ],
          [
            'count',
            {
              signal: { nodeId: '', portName: 'count', displayName: 'count', width: 8 },
              values: [0, 0, 1, 2, 3, 4],
              changes: [
                { cycle: 0, value: 0 },
                { cycle: 2, value: 1 },
                { cycle: 3, value: 2 },
                { cycle: 4, value: 3 },
                { cycle: 5, value: 4 },
              ],
            },
          ],
        ]),
      };

      const vcd = generateVCD(captureData);

      // Verify structure
      expect(vcd).toContain('$date');
      expect(vcd).toContain('$version');
      expect(vcd).toContain('$timescale');
      expect(vcd).toContain('$scope module testbench $end');

      // Verify signal declarations
      expect(vcd).toContain('clk $end');
      expect(vcd).toContain('reset $end');
      expect(vcd).toContain('count $end');

      // Verify value changes
      expect(vcd).toContain('#0');
      expect(vcd).toContain('#5');

      // Check file is reasonably sized (not empty, not huge)
      expect(vcd.length).toBeGreaterThan(100);
      expect(vcd.length).toBeLessThan(10000);
    });
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

function createSimpleCaptureData(): CaptureData {
  return {
    config: {
      signals: [],
      format: 'vcd',
      filename: 'test.vcd',
    },
    traces: new Map([
      [
        'clk',
        {
          signal: { nodeId: '', portName: 'clk', displayName: 'clk', width: 1 },
          values: [false, true, false],
          changes: [
            { cycle: 0, value: false },
            { cycle: 1, value: true },
            { cycle: 2, value: false },
          ],
        },
      ],
      [
        'data',
        {
          signal: { nodeId: '', portName: 'data', displayName: 'data', width: 8 },
          values: [0, 42, 255],
          changes: [
            { cycle: 0, value: 0 },
            { cycle: 1, value: 42 },
            { cycle: 2, value: 255 },
          ],
        },
      ],
    ]),
  };
}
