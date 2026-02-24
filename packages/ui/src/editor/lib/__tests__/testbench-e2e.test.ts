/**
 * End-to-End Testbench Tests
 *
 * Tests the complete testbench pipeline:
 * 1. Parse testbench DSL
 * 2. Compile stimulus
 * 3. Generate VCD output
 */

import { describe, it, expect } from 'vitest';
import { parseDSLOrThrow } from '@turing-incomplete/core/dsl';
import { compileStimulus } from '../testing/stimulus-compiler';
import { generateVCD, parseVCDHeader } from '../visualization/vcd-generator';
import { CaptureData } from '../../types/testbench';

describe('End-to-End Testbench', () => {
  it('should parse testbench and generate VCD', () => {
    const dslCode = `
      testbench SimpleTest {
        use circuit Counter as dut

        input reset: Bit
        input enable: Bit
        output count: Bus[8]

        clock clk

        impl {
          node counter: Counter

          connect reset -> counter.reset
          connect enable -> counter.enable
          connect counter.count -> count

          stimulus on clk {
            at 0..1: reset = 1, enable = 0
            at 2..10: reset = 0, enable = 1
          }

          capture {
            signals: [reset, enable, count]
            format: vcd
            filename: "counter_test.vcd"
          }
        }
      }
    `;

    // Step 1: Parse
    const ast = parseDSLOrThrow(dslCode);

    expect(ast.testbenches).toBeDefined();
    const testbench = ast.testbenches![0];
    expect(testbench.name).toBe('SimpleTest');

    // Step 2: Compile stimulus
    const stimulus = testbench.impl!.stimulus![0];
    const schedule = compileStimulus(stimulus);

    // Verify schedule
    expect(schedule.events.size).toBe(11); // 0..10 = 11 cycles
    expect(schedule.events.get(0)).toBeDefined();
    expect(schedule.events.get(10)).toBeDefined();

    // Step 3: Simulate capture data (mock for now)
    const captureData = createMockCaptureData();

    // Step 4: Generate VCD
    const vcd = generateVCD(captureData);

    // Verify VCD structure
    expect(vcd).toContain('$date');
    expect(vcd).toContain('$version');
    expect(vcd).toContain('$timescale');
    expect(vcd).toContain('1 ns');

    // Verify signal declarations
    expect(vcd).toContain('reset');
    expect(vcd).toContain('enable');
    expect(vcd).toContain('count');

    // Verify value changes
    expect(vcd).toContain('#0'); // timestamp 0
    expect(vcd).toContain('#2'); // timestamp 2 (when reset goes low, enable goes high)
    expect(vcd).toContain('#3'); // timestamp 3 (count changes)

    // Parse the generated VCD to verify correctness
    const parsed = parseVCDHeader(vcd);
    expect(parsed.timescale).toBe('1 ns');
    expect(parsed.signals.length).toBe(3);

    const signalNames = parsed.signals.map(s => s.name);
    expect(signalNames).toContain('reset');
    expect(signalNames).toContain('enable');
    expect(signalNames).toContain('count');
  });

  it('should generate VCD for stepped stimulus', () => {
    const dslCode = `
      testbench ToggleTest {
        use circuit Toggle as dut

        input clk: Bit
        output q: Bit

        clock clk

        impl {
          stimulus on clk {
            at 0..20 step 5: clk = 1
          }

          capture {
            signals: [clk, q]
            format: vcd
            filename: "toggle_test.vcd"
          }
        }
      }
    `;

    const ast = parseDSLOrThrow(dslCode);
    const testbench = ast.testbenches![0];

    const stimulus = testbench.impl!.stimulus![0];
    const schedule = compileStimulus(stimulus);

    // Verify stepped schedule: 0, 5, 10, 15, 20 (5 events)
    expect(schedule.events.size).toBe(5);
    expect(schedule.events.has(0)).toBe(true);
    expect(schedule.events.has(5)).toBe(true);
    expect(schedule.events.has(10)).toBe(true);
    expect(schedule.events.has(15)).toBe(true);
    expect(schedule.events.has(20)).toBe(true);
    expect(schedule.events.has(1)).toBe(false);
  });

  it('should handle complex multi-signal stimulus', () => {
    const dslCode = `
      testbench ComplexTest {
        use circuit ALU as dut

        input a: Bus[8]
        input b: Bus[8]
        input op: Bus[2]
        output result: Bus[8]

        clock clk

        impl {
          stimulus on clk {
            // Test addition: 5 + 3 = 8
            at 0: a = 5, b = 3, op = 0

            // Test subtraction: 10 - 4 = 6
            at 1: a = 10, b = 4, op = 1

            // Test AND: 0xFF & 0x0F = 0x0F
            at 2: a = 255, b = 15, op = 2

            // Test OR: 0xF0 | 0x0F = 0xFF
            at 3: a = 240, b = 15, op = 3
          }

          capture {
            signals: [a, b, op, result]
            format: vcd
            filename: "alu_test.vcd"
          }
        }
      }
    `;

    const ast = parseDSLOrThrow(dslCode);
    const testbench = ast.testbenches![0];

    const stimulus = testbench.impl!.stimulus![0];
    const schedule = compileStimulus(stimulus);

    // Verify each cycle has correct assignments
    const cycle0 = schedule.events.get(0)!;
    expect(cycle0.length).toBe(3); // a, b, op
    expect(cycle0.find(a => a.portName === 'a')!.value).toBe(5);
    expect(cycle0.find(a => a.portName === 'b')!.value).toBe(3);
    expect(cycle0.find(a => a.portName === 'op')!.value).toBe(0);

    const cycle1 = schedule.events.get(1)!;
    expect(cycle1.find(a => a.portName === 'a')!.value).toBe(10);
    expect(cycle1.find(a => a.portName === 'b')!.value).toBe(4);
    expect(cycle1.find(a => a.portName === 'op')!.value).toBe(1);
  });

  it('should generate valid VCD for real counter simulation', () => {
    // Create realistic capture data simulating a counter
    const captureData: CaptureData = {
      config: {
        signals: [
          { nodeId: '', portName: 'reset', displayName: 'reset', width: 1 },
          { nodeId: '', portName: 'enable', displayName: 'enable', width: 1 },
          { nodeId: '', portName: 'count', displayName: 'count', width: 8 },
        ],
        format: 'vcd',
        filename: 'counter_simulation.vcd',
      },
      traces: new Map([
        [
          'reset',
          {
            signal: { nodeId: '', portName: 'reset', displayName: 'reset', width: 1 },
            values: [true, true, false, false, false, false, false, false],
            changes: [
              { cycle: 0, value: true },
              { cycle: 2, value: false },
            ],
          },
        ],
        [
          'enable',
          {
            signal: { nodeId: '', portName: 'enable', displayName: 'enable', width: 1 },
            values: [false, false, true, true, true, true, true, true],
            changes: [
              { cycle: 0, value: false },
              { cycle: 2, value: true },
            ],
          },
        ],
        [
          'count',
          {
            signal: { nodeId: '', portName: 'count', displayName: 'count', width: 8 },
            values: [0, 0, 0, 1, 2, 3, 4, 5],
            changes: [
              { cycle: 0, value: 0 },
              { cycle: 3, value: 1 },
              { cycle: 4, value: 2 },
              { cycle: 5, value: 3 },
              { cycle: 6, value: 4 },
              { cycle: 7, value: 5 },
            ],
          },
        ],
      ]),
    };

    const vcd = generateVCD(captureData);

    // Verify VCD content
    expect(vcd).toContain('$scope module testbench $end');
    expect(vcd).toContain('$var wire 1 ! reset $end');
    expect(vcd).toContain('$var wire 1 " enable $end');
    expect(vcd).toContain('$var wire 8 # count $end');

    // Verify timestamps and values
    expect(vcd).toContain('#0');
    expect(vcd).toContain('#2');
    expect(vcd).toContain('#7');

    // Verify reset sequence
    expect(vcd).toContain('1!'); // reset = 1
    expect(vcd).toContain('0!'); // reset = 0

    // Verify enable sequence
    expect(vcd).toContain('0"'); // enable = 0
    expect(vcd).toContain('1"'); // enable = 1

    // Verify count sequence
    expect(vcd).toContain('b00000000 #'); // count = 0
    expect(vcd).toContain('b00000001 #'); // count = 1
    expect(vcd).toContain('b00000010 #'); // count = 2
    expect(vcd).toContain('b00000101 #'); // count = 5

    // Parse and verify structure
    const parsed = parseVCDHeader(vcd);
    expect(parsed.signals.length).toBe(3);
    expect(parsed.signals[0].width).toBe(1);
    expect(parsed.signals[1].width).toBe(1);
    expect(parsed.signals[2].width).toBe(8);
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

function createMockCaptureData(): CaptureData {
  return {
    config: {
      signals: [
        { nodeId: '', portName: 'reset', displayName: 'reset', width: 1 },
        { nodeId: '', portName: 'enable', displayName: 'enable', width: 1 },
        { nodeId: '', portName: 'count', displayName: 'count', width: 8 },
      ],
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
            { cycle: 2, value: false },
          ],
        },
      ],
      [
        'enable',
        {
          signal: { nodeId: '', portName: 'enable', displayName: 'enable', width: 1 },
          values: [false, true],
          changes: [
            { cycle: 0, value: false },
            { cycle: 2, value: true },
          ],
        },
      ],
      [
        'count',
        {
          signal: { nodeId: '', portName: 'count', displayName: 'count', width: 8 },
          values: [0, 1, 2],
          changes: [
            { cycle: 0, value: 0 },
            { cycle: 3, value: 1 },
            { cycle: 4, value: 2 },
          ],
        },
      ],
    ]),
  };
}
