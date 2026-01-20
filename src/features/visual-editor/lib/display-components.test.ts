/**
 * Display Components Integration Test
 *
 * Tests HexDisplay and SevenSegment components with the simulator.
 */

import { describe, it, expect } from 'vitest';
import type { Component, Connection } from '../types';
import { runSimulation, getDisplayUpdates } from './simulator';

describe('Display Components', () => {
  describe('HexDisplay', () => {
    it('should display hex value FF for input 255', () => {
      // Circuit: Input(255) -> HexDisplay
      const components: Record<string, Component> = {
        input1: {
          id: 'input1',
          type: 'INPUT',
          label: 'Input',
          value: 255,
          width: 8,
        },
        hex1: {
          id: 'hex1',
          type: 'HexDisplay',
          label: 'Display',
          value: 0, // Will be updated by simulation
        },
      };

      const connections: Record<string, Connection> = {
        conn1: {
          id: 'conn1',
          sourceComponentId: 'input1',
          sourcePortIndex: 0,
          targetComponentId: 'hex1',
          targetPortIndex: 0,
        },
      };

      // Run simulation
      const result = runSimulation(components, connections);
      expect(result.error).toBeUndefined();

      // Get display updates
      const displayUpdates = getDisplayUpdates(components, connections, result.portValues);

      // HexDisplay should receive value 255
      expect(displayUpdates.get('hex1')).toBe(255);
    });

    it('should display hex value 2A for input 42', () => {
      const components: Record<string, Component> = {
        input1: {
          id: 'input1',
          type: 'INPUT',
          label: 'Input',
          value: 42,
          width: 8,
        },
        hex1: {
          id: 'hex1',
          type: 'HexDisplay',
          label: 'Display',
          value: 0,
        },
      };

      const connections: Record<string, Connection> = {
        conn1: {
          id: 'conn1',
          sourceComponentId: 'input1',
          sourcePortIndex: 0,
          targetComponentId: 'hex1',
          targetPortIndex: 0,
        },
      };

      const result = runSimulation(components, connections);
      expect(result.error).toBeUndefined();

      const displayUpdates = getDisplayUpdates(components, connections, result.portValues);
      expect(displayUpdates.get('hex1')).toBe(42);
    });

    it('should display hex value 00 for input 0', () => {
      const components: Record<string, Component> = {
        input1: {
          id: 'input1',
          type: 'INPUT',
          label: 'Input',
          value: 0,
          width: 8,
        },
        hex1: {
          id: 'hex1',
          type: 'HexDisplay',
          label: 'Display',
          value: 0,
        },
      };

      const connections: Record<string, Connection> = {
        conn1: {
          id: 'conn1',
          sourceComponentId: 'input1',
          sourcePortIndex: 0,
          targetComponentId: 'hex1',
          targetPortIndex: 0,
        },
      };

      const result = runSimulation(components, connections);
      expect(result.error).toBeUndefined();

      const displayUpdates = getDisplayUpdates(components, connections, result.portValues);
      expect(displayUpdates.get('hex1')).toBe(0);
    });
  });

  describe('SevenSegment', () => {
    it('should display 4-bit value for input 15 (F)', () => {
      const components: Record<string, Component> = {
        input1: {
          id: 'input1',
          type: 'INPUT',
          label: 'Input',
          value: 15,
          width: 4,
        },
        seg1: {
          id: 'seg1',
          type: 'SevenSegment',
          label: 'Display',
          value: 0,
        },
      };

      const connections: Record<string, Connection> = {
        conn1: {
          id: 'conn1',
          sourceComponentId: 'input1',
          sourcePortIndex: 0,
          targetComponentId: 'seg1',
          targetPortIndex: 0,
        },
      };

      const result = runSimulation(components, connections);
      expect(result.error).toBeUndefined();

      const displayUpdates = getDisplayUpdates(components, connections, result.portValues);
      expect(displayUpdates.get('seg1')).toBe(15);
    });

    it('should display 4-bit value for input 7', () => {
      const components: Record<string, Component> = {
        input1: {
          id: 'input1',
          type: 'INPUT',
          label: 'Input',
          value: 7,
          width: 4,
        },
        seg1: {
          id: 'seg1',
          type: 'SevenSegment',
          label: 'Display',
          value: 0,
        },
      };

      const connections: Record<string, Connection> = {
        conn1: {
          id: 'conn1',
          sourceComponentId: 'input1',
          sourcePortIndex: 0,
          targetComponentId: 'seg1',
          targetPortIndex: 0,
        },
      };

      const result = runSimulation(components, connections);
      expect(result.error).toBeUndefined();

      const displayUpdates = getDisplayUpdates(components, connections, result.portValues);
      expect(displayUpdates.get('seg1')).toBe(7);
    });
  });

  describe('Multiple Display Components', () => {
    it('should handle multiple HexDisplay components independently', () => {
      const components: Record<string, Component> = {
        input1: {
          id: 'input1',
          type: 'INPUT',
          value: 255,
          width: 8,
        },
        input2: {
          id: 'input2',
          type: 'INPUT',
          value: 42,
          width: 8,
        },
        hex1: {
          id: 'hex1',
          type: 'HexDisplay',
          value: 0,
        },
        hex2: {
          id: 'hex2',
          type: 'HexDisplay',
          value: 0,
        },
      };

      const connections: Record<string, Connection> = {
        conn1: {
          id: 'conn1',
          sourceComponentId: 'input1',
          sourcePortIndex: 0,
          targetComponentId: 'hex1',
          targetPortIndex: 0,
        },
        conn2: {
          id: 'conn2',
          sourceComponentId: 'input2',
          sourcePortIndex: 0,
          targetComponentId: 'hex2',
          targetPortIndex: 0,
        },
      };

      const result = runSimulation(components, connections);
      expect(result.error).toBeUndefined();

      const displayUpdates = getDisplayUpdates(components, connections, result.portValues);
      expect(displayUpdates.get('hex1')).toBe(255);
      expect(displayUpdates.get('hex2')).toBe(42);
    });
  });
});
