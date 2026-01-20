/**
 * Integration test for Splitter8to8 component
 *
 * This test verifies the bug fix for Splitter8to8 not working correctly.
 *
 * Test scenario:
 * - Input component set to 255 (0b11111111)
 * - Splitter8to8 connected to the Input
 * - 8 LEDs connected to each of the Splitter8to8 outputs
 * - ALL LEDs should show "ON" (true)
 */

import { describe, it, expect } from 'vitest';
import type { Component, Connection } from '../types';
import { runSimulation } from './simulator';

describe('Splitter8to8 Integration Test', () => {
  it('should correctly split 255 into 8 true bits for LEDs', () => {
    // Create components
    const inputComp: Component = {
      id: 'input1',
      type: 'INPUT',
      value: 255,
      width: 8,
    };

    const splitterComp: Component = {
      id: 'splitter1',
      type: 'Splitter8to8',
    };

    const ledComps: Component[] = Array.from({ length: 8 }, (_, i) => ({
      id: `led${i}`,
      type: 'LED',
      value: false,
    }));

    const components: Record<string, Component> = {
      [inputComp.id]: inputComp,
      [splitterComp.id]: splitterComp,
      ...Object.fromEntries(ledComps.map(led => [led.id, led])),
    };

    // Create connections
    // Input -> Splitter8to8
    const inputToSplitter: Connection = {
      id: 'conn0',
      sourceComponentId: inputComp.id,
      sourcePortIndex: 0,
      targetComponentId: splitterComp.id,
      targetPortIndex: 0,
    };

    // Splitter8to8 -> 8 LEDs
    const splitterToLeds: Connection[] = Array.from({ length: 8 }, (_, i) => ({
      id: `conn${i + 1}`,
      sourceComponentId: splitterComp.id,
      sourcePortIndex: i,
      targetComponentId: ledComps[i].id,
      targetPortIndex: 0,
    }));

    const connections: Record<string, Connection> = {
      [inputToSplitter.id]: inputToSplitter,
      ...Object.fromEntries(splitterToLeds.map(conn => [conn.id, conn])),
    };

    // Run simulation
    const result = runSimulation(components, connections);

    // Verify no errors
    expect(result.error).toBeUndefined();

    // Verify Input output is 255
    const inputOutput = result.componentOutputs.get(inputComp.id);
    expect(inputOutput).toEqual([255]);

    // Verify Splitter8to8 outputs are all true
    const splitterOutputs = result.componentOutputs.get(splitterComp.id);
    expect(splitterOutputs).toHaveLength(8);
    expect(splitterOutputs).toEqual([true, true, true, true, true, true, true, true]);

    // Verify all LED inputs are true (all LEDs should be ON)
    // The LED inputs should be sourced from the Splitter8to8 outputs
    for (let i = 0; i < 8; i++) {
      // Check the Splitter8to8 output port that connects to this LED
      const splitterOutputKey = `${splitterComp.id}.output.${i}`;
      const splitterOutput = result.portValues.get(splitterOutputKey);
      expect(splitterOutput).toBe(true); // Each bit should be true
    }
  });

  it('should correctly split 0 into 8 false bits for LEDs', () => {
    // Create components
    const inputComp: Component = {
      id: 'input1',
      type: 'INPUT',
      value: 0,
      width: 8,
    };

    const splitterComp: Component = {
      id: 'splitter1',
      type: 'Splitter8to8',
    };

    const ledComps: Component[] = Array.from({ length: 8 }, (_, i) => ({
      id: `led${i}`,
      type: 'LED',
      value: false,
    }));

    const components: Record<string, Component> = {
      [inputComp.id]: inputComp,
      [splitterComp.id]: splitterComp,
      ...Object.fromEntries(ledComps.map(led => [led.id, led])),
    };

    // Create connections
    // Input -> Splitter8to8
    const inputToSplitter: Connection = {
      id: 'conn0',
      sourceComponentId: inputComp.id,
      sourcePortIndex: 0,
      targetComponentId: splitterComp.id,
      targetPortIndex: 0,
    };

    // Splitter8to8 -> 8 LEDs
    const splitterToLeds: Connection[] = Array.from({ length: 8 }, (_, i) => ({
      id: `conn${i + 1}`,
      sourceComponentId: splitterComp.id,
      sourcePortIndex: i,
      targetComponentId: ledComps[i].id,
      targetPortIndex: 0,
    }));

    const connections: Record<string, Connection> = {
      [inputToSplitter.id]: inputToSplitter,
      ...Object.fromEntries(splitterToLeds.map(conn => [conn.id, conn])),
    };

    // Run simulation
    const result = runSimulation(components, connections);

    // Verify no errors
    expect(result.error).toBeUndefined();

    // Verify Input output is 0
    const inputOutput = result.componentOutputs.get(inputComp.id);
    expect(inputOutput).toEqual([0]);

    // Verify Splitter8to8 outputs are all false
    const splitterOutputs = result.componentOutputs.get(splitterComp.id);
    expect(splitterOutputs).toHaveLength(8);
    expect(splitterOutputs).toEqual([false, false, false, false, false, false, false, false]);

    // Verify all LED inputs are false (all LEDs should be OFF)
    // The LED inputs should be sourced from the Splitter8to8 outputs
    for (let i = 0; i < 8; i++) {
      // Check the Splitter8to8 output port that connects to this LED
      const splitterOutputKey = `${splitterComp.id}.output.${i}`;
      const splitterOutput = result.portValues.get(splitterOutputKey);
      expect(splitterOutput).toBe(false); // Each bit should be false
    }
  });

  it('should correctly split 170 (0b10101010) into alternating bits', () => {
    // Create components
    const inputComp: Component = {
      id: 'input1',
      type: 'INPUT',
      value: 170, // 0b10101010
      width: 8,
    };

    const splitterComp: Component = {
      id: 'splitter1',
      type: 'Splitter8to8',
    };

    const ledComps: Component[] = Array.from({ length: 8 }, (_, i) => ({
      id: `led${i}`,
      type: 'LED',
      value: false,
    }));

    const components: Record<string, Component> = {
      [inputComp.id]: inputComp,
      [splitterComp.id]: splitterComp,
      ...Object.fromEntries(ledComps.map(led => [led.id, led])),
    };

    // Create connections
    // Input -> Splitter8to8
    const inputToSplitter: Connection = {
      id: 'conn0',
      sourceComponentId: inputComp.id,
      sourcePortIndex: 0,
      targetComponentId: splitterComp.id,
      targetPortIndex: 0,
    };

    // Splitter8to8 -> 8 LEDs
    const splitterToLeds: Connection[] = Array.from({ length: 8 }, (_, i) => ({
      id: `conn${i + 1}`,
      sourceComponentId: splitterComp.id,
      sourcePortIndex: i,
      targetComponentId: ledComps[i].id,
      targetPortIndex: 0,
    }));

    const connections: Record<string, Connection> = {
      [inputToSplitter.id]: inputToSplitter,
      ...Object.fromEntries(splitterToLeds.map(conn => [conn.id, conn])),
    };

    // Run simulation
    const result = runSimulation(components, connections);

    // Verify no errors
    expect(result.error).toBeUndefined();

    // Verify Input output is 170
    const inputOutput = result.componentOutputs.get(inputComp.id);
    expect(inputOutput).toEqual([170]);

    // Verify Splitter8to8 outputs alternate (bit0=0, bit1=1, bit2=0, bit3=1, ...)
    // 170 = 0b10101010, so bit0=0, bit1=1, bit2=0, bit3=1, bit4=0, bit5=1, bit6=0, bit7=1
    const splitterOutputs = result.componentOutputs.get(splitterComp.id);
    expect(splitterOutputs).toHaveLength(8);
    expect(splitterOutputs).toEqual([
      false, // bit0 = 0
      true,  // bit1 = 1
      false, // bit2 = 0
      true,  // bit3 = 1
      false, // bit4 = 0
      true,  // bit5 = 1
      false, // bit6 = 0
      true,  // bit7 = 1
    ]);
  });
});
