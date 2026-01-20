/**
 * Sequential Circuit Tests
 *
 * Critical validation tests for sequential circuit support.
 * These tests must pass before proceeding with more complex features.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Component, Connection, SequentialState, SwitchComponent } from '../types';
import {
  initializeSequentialState,
  runSimulationTick,
} from './simulator';

describe('Sequential Circuits', () => {
  describe('D Flip-Flop', () => {
    let components: Record<string, Component>;
    let connections: Record<string, Connection>;
    let seqState: SequentialState;

    beforeEach(() => {
      // Create a simple D flip-flop circuit with a switch for D and clock
      components = {
        switch_d: { id: 'switch_d', type: 'SWITCH', value: false },
        switch_clk: { id: 'switch_clk', type: 'SWITCH', value: false },
        dff: { id: 'dff', type: 'D_FLIP_FLOP', state: false },
        led_q: { id: 'led_q', type: 'LED', value: false },
      };

      connections = {
        conn1: {
          id: 'conn1',
          sourceComponentId: 'switch_d',
          sourcePortIndex: 0,
          targetComponentId: 'dff',
          targetPortIndex: 0, // D input
        },
        conn2: {
          id: 'conn2',
          sourceComponentId: 'switch_clk',
          sourcePortIndex: 0,
          targetComponentId: 'dff',
          targetPortIndex: 1, // CLK input
        },
        conn3: {
          id: 'conn3',
          sourceComponentId: 'dff',
          sourcePortIndex: 0, // Q output
          targetComponentId: 'led_q',
          targetPortIndex: 0,
        },
      };

      seqState = initializeSequentialState(components);
    });

    it('should initialize with state = false', () => {
      expect(seqState.currentState.get('dff')).toBe(false);
    });

    it('should not update on low clock', () => {
      // Set D = true, but keep clock low
      (components.switch_d as SwitchComponent).value = true;
      (components.switch_clk as SwitchComponent).value = false;

      const result = runSimulationTick(components, connections, seqState);
      expect(result.error).toBeUndefined();

      // State should remain false (no clock edge)
      expect(seqState.currentState.get('dff')).toBe(false);
    });

    it('should capture D on rising clock edge', () => {
      // Set D = true
      (components.switch_d as SwitchComponent).value = true;
      (components.switch_clk as SwitchComponent).value = false;

      // First tick: clock low, D = true
      runSimulationTick(components, connections, seqState);
      expect(seqState.currentState.get('dff')).toBe(false);

      // Second tick: rising edge (clock goes high)
      (components.switch_clk as SwitchComponent).value = true;
      runSimulationTick(components, connections, seqState);

      // State should now be true (captured D on rising edge)
      expect(seqState.currentState.get('dff')).toBe(true);
    });

    it('should hold value on high clock', () => {
      // Set D = true, trigger rising edge
      (components.switch_d as SwitchComponent).value =true;
      (components.switch_clk as SwitchComponent).value =false;
      runSimulationTick(components, connections, seqState);

      (components.switch_clk as SwitchComponent).value =true;
      runSimulationTick(components, connections, seqState);
      expect(seqState.currentState.get('dff')).toBe(true);

      // Change D to false while clock is still high
      (components.switch_d as SwitchComponent).value =false;
      runSimulationTick(components, connections, seqState);

      // State should remain true (no edge, clock was already high)
      expect(seqState.currentState.get('dff')).toBe(true);
    });

    it('should capture new D value on next rising edge', () => {
      // Capture true
      (components.switch_d as SwitchComponent).value =true;
      (components.switch_clk as SwitchComponent).value =false;
      runSimulationTick(components, connections, seqState);

      (components.switch_clk as SwitchComponent).value =true;
      runSimulationTick(components, connections, seqState);
      expect(seqState.currentState.get('dff')).toBe(true);

      // Lower clock
      (components.switch_clk as SwitchComponent).value =false;
      runSimulationTick(components, connections, seqState);

      // Set D = false and trigger new rising edge
      (components.switch_d as SwitchComponent).value =false;
      runSimulationTick(components, connections, seqState);

      (components.switch_clk as SwitchComponent).value =true;
      runSimulationTick(components, connections, seqState);

      // State should now be false
      expect(seqState.currentState.get('dff')).toBe(false);
    });
  });

  describe('4-bit Counter (CRITICAL VALIDATION)', () => {
    let components: Record<string, Component>;
    let connections: Record<string, Connection>;
    let seqState: SequentialState;

    beforeEach(() => {
      // Build a 4-bit counter using D flip-flops and XOR gates
      // Counter design: Q_next = Q XOR (all previous bits are 1)
      //
      // Bit 0: Always toggles (Q0_next = NOT Q0)
      // Bit 1: Toggles when Q0 = 1
      // Bit 2: Toggles when Q0 = 1 AND Q1 = 1
      // Bit 3: Toggles when Q0 = 1 AND Q1 = 1 AND Q2 = 1

      components = {
        // Clock source
        clk: { id: 'clk', type: 'SWITCH', value: false },

        // Bit 0: Toggle every clock
        dff0: { id: 'dff0', type: 'D_FLIP_FLOP', state: false },
        not0: { id: 'not0', type: 'NOT_GATE' },

        // Bit 1: Toggle when bit 0 is 1
        dff1: { id: 'dff1', type: 'D_FLIP_FLOP', state: false },
        xor1: { id: 'xor1', type: 'XOR_GATE' },

        // Bit 2: Toggle when bit 0 and bit 1 are both 1
        dff2: { id: 'dff2', type: 'D_FLIP_FLOP', state: false },
        and2: { id: 'and2', type: 'AND_GATE' },
        xor2: { id: 'xor2', type: 'XOR_GATE' },

        // Bit 3: Toggle when bit 0, bit 1, and bit 2 are all 1
        dff3: { id: 'dff3', type: 'D_FLIP_FLOP', state: false },
        and3a: { id: 'and3a', type: 'AND_GATE' },
        and3b: { id: 'and3b', type: 'AND_GATE' },
        xor3: { id: 'xor3', type: 'XOR_GATE' },

        // Output LEDs
        led0: { id: 'led0', type: 'LED', value: false },
        led1: { id: 'led1', type: 'LED', value: false },
        led2: { id: 'led2', type: 'LED', value: false },
        led3: { id: 'led3', type: 'LED', value: false },
      };

      connections = {
        // Bit 0 logic: D0 = NOT Q0
        c1: {
          id: 'c1',
          sourceComponentId: 'dff0',
          sourcePortIndex: 0, // Q0
          targetComponentId: 'not0',
          targetPortIndex: 0,
        },
        c2: {
          id: 'c2',
          sourceComponentId: 'not0',
          sourcePortIndex: 0,
          targetComponentId: 'dff0',
          targetPortIndex: 0, // D0
        },
        c3: {
          id: 'c3',
          sourceComponentId: 'clk',
          sourcePortIndex: 0,
          targetComponentId: 'dff0',
          targetPortIndex: 1, // CLK0
        },

        // Bit 1 logic: D1 = Q1 XOR Q0
        c4: {
          id: 'c4',
          sourceComponentId: 'dff1',
          sourcePortIndex: 0, // Q1
          targetComponentId: 'xor1',
          targetPortIndex: 0,
        },
        c5: {
          id: 'c5',
          sourceComponentId: 'dff0',
          sourcePortIndex: 0, // Q0
          targetComponentId: 'xor1',
          targetPortIndex: 1,
        },
        c6: {
          id: 'c6',
          sourceComponentId: 'xor1',
          sourcePortIndex: 0,
          targetComponentId: 'dff1',
          targetPortIndex: 0, // D1
        },
        c7: {
          id: 'c7',
          sourceComponentId: 'clk',
          sourcePortIndex: 0,
          targetComponentId: 'dff1',
          targetPortIndex: 1, // CLK1
        },

        // Bit 2 logic: D2 = Q2 XOR (Q0 AND Q1)
        c8: {
          id: 'c8',
          sourceComponentId: 'dff0',
          sourcePortIndex: 0, // Q0
          targetComponentId: 'and2',
          targetPortIndex: 0,
        },
        c9: {
          id: 'c9',
          sourceComponentId: 'dff1',
          sourcePortIndex: 0, // Q1
          targetComponentId: 'and2',
          targetPortIndex: 1,
        },
        c10: {
          id: 'c10',
          sourceComponentId: 'dff2',
          sourcePortIndex: 0, // Q2
          targetComponentId: 'xor2',
          targetPortIndex: 0,
        },
        c11: {
          id: 'c11',
          sourceComponentId: 'and2',
          sourcePortIndex: 0,
          targetComponentId: 'xor2',
          targetPortIndex: 1,
        },
        c12: {
          id: 'c12',
          sourceComponentId: 'xor2',
          sourcePortIndex: 0,
          targetComponentId: 'dff2',
          targetPortIndex: 0, // D2
        },
        c13: {
          id: 'c13',
          sourceComponentId: 'clk',
          sourcePortIndex: 0,
          targetComponentId: 'dff2',
          targetPortIndex: 1, // CLK2
        },

        // Bit 3 logic: D3 = Q3 XOR (Q0 AND Q1 AND Q2)
        c14: {
          id: 'c14',
          sourceComponentId: 'dff0',
          sourcePortIndex: 0, // Q0
          targetComponentId: 'and3a',
          targetPortIndex: 0,
        },
        c15: {
          id: 'c15',
          sourceComponentId: 'dff1',
          sourcePortIndex: 0, // Q1
          targetComponentId: 'and3a',
          targetPortIndex: 1,
        },
        c16: {
          id: 'c16',
          sourceComponentId: 'and3a',
          sourcePortIndex: 0,
          targetComponentId: 'and3b',
          targetPortIndex: 0,
        },
        c17: {
          id: 'c17',
          sourceComponentId: 'dff2',
          sourcePortIndex: 0, // Q2
          targetComponentId: 'and3b',
          targetPortIndex: 1,
        },
        c18: {
          id: 'c18',
          sourceComponentId: 'dff3',
          sourcePortIndex: 0, // Q3
          targetComponentId: 'xor3',
          targetPortIndex: 0,
        },
        c19: {
          id: 'c19',
          sourceComponentId: 'and3b',
          sourcePortIndex: 0,
          targetComponentId: 'xor3',
          targetPortIndex: 1,
        },
        c20: {
          id: 'c20',
          sourceComponentId: 'xor3',
          sourcePortIndex: 0,
          targetComponentId: 'dff3',
          targetPortIndex: 0, // D3
        },
        c21: {
          id: 'c21',
          sourceComponentId: 'clk',
          sourcePortIndex: 0,
          targetComponentId: 'dff3',
          targetPortIndex: 1, // CLK3
        },

        // Output connections
        c22: {
          id: 'c22',
          sourceComponentId: 'dff0',
          sourcePortIndex: 0,
          targetComponentId: 'led0',
          targetPortIndex: 0,
        },
        c23: {
          id: 'c23',
          sourceComponentId: 'dff1',
          sourcePortIndex: 0,
          targetComponentId: 'led1',
          targetPortIndex: 0,
        },
        c24: {
          id: 'c24',
          sourceComponentId: 'dff2',
          sourcePortIndex: 0,
          targetComponentId: 'led2',
          targetPortIndex: 0,
        },
        c25: {
          id: 'c25',
          sourceComponentId: 'dff3',
          sourcePortIndex: 0,
          targetComponentId: 'led3',
          targetPortIndex: 0,
        },
      };

      seqState = initializeSequentialState(components);
    });

    it('should initialize to 0000', () => {
      expect(seqState.currentState.get('dff0')).toBe(false);
      expect(seqState.currentState.get('dff1')).toBe(false);
      expect(seqState.currentState.get('dff2')).toBe(false);
      expect(seqState.currentState.get('dff3')).toBe(false);
    });

    it('should count from 0 to 15 and wrap to 0', () => {
      const expectedSequence = [
        0b0000, // 0
        0b0001, // 1
        0b0010, // 2
        0b0011, // 3
        0b0100, // 4
        0b0101, // 5
        0b0110, // 6
        0b0111, // 7
        0b1000, // 8
        0b1001, // 9
        0b1010, // 10
        0b1011, // 11
        0b1100, // 12
        0b1101, // 13
        0b1110, // 14
        0b1111, // 15
        0b0000, // 0 (wrap around)
      ];

      for (let i = 0; i < expectedSequence.length; i++) {
        const expected = expectedSequence[i];

        // Read current counter value
        const q0 = seqState.currentState.get('dff0') as boolean;
        const q1 = seqState.currentState.get('dff1') as boolean;
        const q2 = seqState.currentState.get('dff2') as boolean;
        const q3 = seqState.currentState.get('dff3') as boolean;

        const actual = (q3 ? 8 : 0) + (q2 ? 4 : 0) + (q1 ? 2 : 0) + (q0 ? 1 : 0);

        expect(actual).toBe(expected);

        // Generate clock pulse (low -> high -> low)
        (components.clk as SwitchComponent).value =false;
        runSimulationTick(components, connections, seqState);

        (components.clk as SwitchComponent).value =true;
        runSimulationTick(components, connections, seqState);
      }
    });

    it('should increment cycle counter', () => {
      expect(seqState.cycleCount).toBe(0);

      (components.clk as SwitchComponent).value =false;
      runSimulationTick(components, connections, seqState);
      expect(seqState.cycleCount).toBe(1);

      (components.clk as SwitchComponent).value =true;
      runSimulationTick(components, connections, seqState);
      expect(seqState.cycleCount).toBe(2);
    });
  });
});
