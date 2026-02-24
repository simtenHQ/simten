/**
 * Testbench Integration Tests
 *
 * Tests the full pipeline:
 * 1. Parse testbench DSL
 * 2. Compile stimulus
 * 3. Run testbench
 */

import { describe, it, expect } from 'vitest';
import { parseDSL, parseDSLOrThrow } from '@/features/dsl';
import { compileStimulus, validateStimulus, formatStimulusSchedule } from '../testing/stimulus-compiler';

describe('Testbench Integration', () => {
  describe('Basic Parsing', () => {
    it('should parse a simple testbench definition', () => {
      const dslCode = `
        testbench SimpleTest {
          use circuit Counter as dut

          input reset: Bit
          input enable: Bit
          output count: Bus[8]

          clock clk

          impl {
            node dut_instance: Counter

            connect reset -> dut_instance.reset
            connect enable -> dut_instance.enable
            connect dut_instance.count -> count

            stimulus on clk {
              at 0: reset = 1, enable = 0
              at 1: reset = 0, enable = 1
              at 2..10: enable = 1
            }

            capture {
              signals: [reset, enable, count]
              format: vcd
              filename: "counter_test.vcd"
            }
          }
        }
      `;

      const ast = parseDSLOrThrow(dslCode);

      expect(ast.testbenches).toBeDefined();
      expect(ast.testbenches!.length).toBe(1);

      const testbench = ast.testbenches![0];
      expect(testbench.name).toBe('SimpleTest');
      expect(testbench.circuitRef.circuitName).toBe('Counter');
      expect(testbench.circuitRef.instanceName).toBe('dut');
      expect(testbench.inputs.length).toBe(2);
      expect(testbench.outputs.length).toBe(1);
      expect(testbench.clocks.length).toBe(1);

      expect(testbench.impl).toBeDefined();
      expect(testbench.impl!.nodes.length).toBe(1);
      expect(testbench.impl!.connections.length).toBe(3);
      expect(testbench.impl!.stimulus).toBeDefined();
      expect(testbench.impl!.stimulus!.length).toBe(1);
      expect(testbench.impl!.capture).toBeDefined();
    });

    it('should parse testbench with frequency annotation (Phase 4 syntax)', () => {
      const dslCode = `
        testbench ClockTest {
          use circuit DFlipFlop as dut

          input d: Bit
          output q: Bit

          clock clk @ 100MHz

          impl {
            stimulus on clk {
              at 0: d = 0
              at 1: d = 1
            }
          }
        }
      `;

      const ast = parseDSLOrThrow(dslCode);

      expect(ast.testbenches).toBeDefined();
      const testbench = ast.testbenches![0];
      expect(testbench.clocks[0].frequency).toBeDefined();
      expect(testbench.clocks[0].frequency!.value).toBe(100);
      expect(testbench.clocks[0].frequency!.unit).toBe('MHz');
    });
  });

  describe('Stimulus Compilation', () => {
    it('should compile single cycle stimulus', () => {
      const dslCode = `
        testbench Test {
          use circuit Foo as dut
          input a: Bit
          clock clk
          impl {
            stimulus on clk {
              at 0: a = 1
              at 5: a = 0
            }
          }
        }
      `;

      const ast = parseDSLOrThrow(dslCode);
      const stimulus = ast.testbenches![0].impl!.stimulus![0];

      const schedule = compileStimulus(stimulus);
      validateStimulus(schedule);

      expect(schedule.clockRef).toBe('clk');
      expect(schedule.events.size).toBe(2);
      expect(schedule.events.get(0)).toBeDefined();
      expect(schedule.events.get(0)![0].portName).toBe('a');
      expect(schedule.events.get(0)![0].value).toBe(1);
      expect(schedule.events.get(5)![0].value).toBe(0);
    });

    it('should expand range notation', () => {
      const dslCode = `
        testbench Test {
          use circuit Foo as dut
          input enable: Bit
          clock clk
          impl {
            stimulus on clk {
              at 10..15: enable = 1
            }
          }
        }
      `;

      const ast = parseDSLOrThrow(dslCode);
      const stimulus = ast.testbenches![0].impl!.stimulus![0];

      const schedule = compileStimulus(stimulus);

      // Should create events for cycles 10, 11, 12, 13, 14, 15 (6 cycles total)
      expect(schedule.events.size).toBe(6);
      expect(schedule.events.get(10)).toBeDefined();
      expect(schedule.events.get(11)).toBeDefined();
      expect(schedule.events.get(15)).toBeDefined();
      expect(schedule.events.get(16)).toBeUndefined();
    });

    it('should expand stepped ranges', () => {
      const dslCode = `
        testbench Test {
          use circuit Foo as dut
          input toggle: Bit
          clock clk
          impl {
            stimulus on clk {
              at 0..20 step 5: toggle = 1
            }
          }
        }
      `;

      const ast = parseDSLOrThrow(dslCode);
      const stimulus = ast.testbenches![0].impl!.stimulus![0];

      const schedule = compileStimulus(stimulus);

      // Should create events for cycles 0, 5, 10, 15, 20 (5 cycles)
      expect(schedule.events.size).toBe(5);
      expect(schedule.events.get(0)).toBeDefined();
      expect(schedule.events.get(5)).toBeDefined();
      expect(schedule.events.get(10)).toBeDefined();
      expect(schedule.events.get(15)).toBeDefined();
      expect(schedule.events.get(20)).toBeDefined();
      expect(schedule.events.get(1)).toBeUndefined();
    });

    it('should handle computed values with cycle variable', () => {
      const dslCode = `
        testbench Test {
          use circuit Foo as dut
          input data: Bus[8]
          clock clk
          impl {
            stimulus on clk {
              at 0..10: data = 100
            }
          }
        }
      `;

      const ast = parseDSLOrThrow(dslCode);
      const stimulus = ast.testbenches![0].impl!.stimulus![0];

      const schedule = compileStimulus(stimulus);

      // Each cycle should have the value
      for (let i = 0; i <= 10; i++) {
        expect(schedule.events.get(i)).toBeDefined();
        expect(schedule.events.get(i)![0].value).toBe(100);
      }
    });

    it('should handle multiple assignments in same cycle', () => {
      const dslCode = `
        testbench Test {
          use circuit Foo as dut
          input a: Bit
          input b: Bit
          input c: Bus[8]
          clock clk
          impl {
            stimulus on clk {
              at 0: a = 1, b = 0, c = 42
            }
          }
        }
      `;

      const ast = parseDSLOrThrow(dslCode);
      const stimulus = ast.testbenches![0].impl!.stimulus![0];

      const schedule = compileStimulus(stimulus);

      const actions = schedule.events.get(0)!;
      expect(actions.length).toBe(3);
      expect(actions.find(a => a.portName === 'a')!.value).toBe(1);
      expect(actions.find(a => a.portName === 'b')!.value).toBe(0);
      expect(actions.find(a => a.portName === 'c')!.value).toBe(42);
    });

    it('should format stimulus schedule for debugging', () => {
      const dslCode = `
        testbench Test {
          use circuit Foo as dut
          input reset: Bit
          clock clk
          impl {
            stimulus on clk {
              at 0: reset = 1
              at 1..3: reset = 0
            }
          }
        }
      `;

      const ast = parseDSLOrThrow(dslCode);
      const stimulus = ast.testbenches![0].impl!.stimulus![0];

      const schedule = compileStimulus(stimulus);
      const formatted = formatStimulusSchedule(schedule);

      expect(formatted).toContain('Stimulus on clk');
      expect(formatted).toContain('cycle 0: reset=1');
      expect(formatted).toContain('cycle 1: reset=0');
    });
  });

  describe('Error Handling', () => {
    it('should reject testbench without circuit reference', () => {
      const dslCode = `
        testbench BadTest {
          input a: Bit
          clock clk
        }
      `;

      expect(() => parseDSLOrThrow(dslCode)).toThrow();
    });

    it('should reject invalid range (start > end)', () => {
      const dslCode = `
        testbench Test {
          use circuit Foo as dut
          input a: Bit
          clock clk
          impl {
            stimulus on clk {
              at 10..5: a = 1
            }
          }
        }
      `;

      const ast = parseDSLOrThrow(dslCode);
      const stimulus = ast.testbenches![0].impl!.stimulus![0];

      expect(() => compileStimulus(stimulus)).toThrow(/Invalid range/);
    });

    it('should reject invalid step value', () => {
      const dslCode = `
        testbench Test {
          use circuit Foo as dut
          input a: Bit
          clock clk
          impl {
            stimulus on clk {
              at 0..10 step 0: a = 1
            }
          }
        }
      `;

      const ast = parseDSLOrThrow(dslCode);
      const stimulus = ast.testbenches![0].impl!.stimulus![0];

      expect(() => compileStimulus(stimulus)).toThrow(/Invalid step/);
    });
  });
});
