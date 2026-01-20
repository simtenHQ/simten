/**
 * Tests for IR Flattener
 */

import { describe, it, expect } from 'vitest';
import { flattenIR } from './ir-flattener';
import type { Component, Connection } from '../types';
import type { Circuit } from '../types/ir-v0.1';
import { bitType } from '../types/ir-v0.1';

describe('IR Flattener', () => {
  it('should keep primitive components as-is', () => {
    const components: Record<string, Component> = {
      'switch1': { id: 'switch1', type: 'SWITCH', value: false },
      'and1': { id: 'and1', type: 'AND_GATE' },
      'led1': { id: 'led1', type: 'LED', value: false },
    };

    const connections: Record<string, Connection> = {
      'conn1': {
        id: 'conn1',
        sourceComponentId: 'switch1',
        sourcePortIndex: 0,
        targetComponentId: 'and1',
        targetPortIndex: 0,
      },
    };

    const resolveComponent = (_name: string) => undefined;

    const result = flattenIR(components, connections, resolveComponent);

    expect(result.components).toHaveProperty('switch1');
    expect(result.components).toHaveProperty('and1');
    expect(result.components).toHaveProperty('led1');
    expect(Object.keys(result.components).length).toBe(3);
  });

  it('should expand composite component with DFlipFlop', () => {
    // Create a DFlipFlopTest circuit definition
    const dflipflopTestCircuit: Circuit = {
      id: 'circuit:DFlipFlopTest',
      name: 'DFlipFlopTest',
      parameters: [],
      inputs: [
        { name: 'd', portType: bitType() },
        { name: 'clk', portType: bitType() },
      ],
      outputs: [
        { name: 'q', portType: bitType() },
        { name: 'q_bar', portType: bitType() },
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'dff',
          componentRef: 'DFlipFlop',
          arguments: {},
          inputs: [
            { id: 'dff.d', name: 'd', portType: bitType() },
            { id: 'dff.clk', name: 'clk', portType: bitType() },
          ],
          outputs: [
            { id: 'dff.q', name: 'q', portType: bitType() },
            { id: 'dff.q_bar', name: 'q_bar', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: '', portName: 'd' },
          target: { nodeId: 'dff', portName: 'd' },
          portType: bitType(),
        },
        {
          id: 'conn2',
          source: { nodeId: '', portName: 'clk' },
          target: { nodeId: 'dff', portName: 'clk' },
          portType: bitType(),
        },
        {
          id: 'conn3',
          source: { nodeId: 'dff', portName: 'q' },
          target: { nodeId: '', portName: 'q' },
          portType: bitType(),
        },
        {
          id: 'conn4',
          source: { nodeId: 'dff', portName: 'q_bar' },
          target: { nodeId: '', portName: 'q_bar' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
      metadata: {
        description: 'Test wrapper for D Flip-Flop',
      },
    };

    // Create top-level components
    const components: Record<string, Component> = {
      'test1': { id: 'test1', type: 'DFlipFlopTest' },
    };

    const connections: Record<string, Connection> = {};

    const resolveComponent = (name: string) => {
      if (name === 'DFlipFlopTest') {
        return dflipflopTestCircuit;
      }
      return undefined;
    };

    const result = flattenIR(components, connections, resolveComponent);

    // Should have the internal DFlipFlop expanded
    expect(result.components).toHaveProperty('test1__dff');
    expect(result.components['test1__dff'].type).toBe('D_FLIP_FLOP');
    expect(result.components['test1__dff']).toHaveProperty('state');
  });

  it('should map internal connections correctly', () => {
    // Create a simple AND wrapper circuit
    const andWrapperCircuit: Circuit = {
      id: 'circuit:AndWrapper',
      name: 'AndWrapper',
      parameters: [],
      inputs: [
        { name: 'a', portType: bitType() },
        { name: 'b', portType: bitType() },
      ],
      outputs: [
        { name: 'out', portType: bitType() },
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'and1',
          componentRef: 'And',
          arguments: {},
          inputs: [
            { id: 'and1.a', name: 'a', portType: bitType() },
            { id: 'and1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'and1.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: '', portName: 'a' },
          target: { nodeId: 'and1', portName: 'a' },
          portType: bitType(),
        },
        {
          id: 'conn2',
          source: { nodeId: '', portName: 'b' },
          target: { nodeId: 'and1', portName: 'b' },
          portType: bitType(),
        },
        {
          id: 'conn3',
          source: { nodeId: 'and1', portName: 'out' },
          target: { nodeId: '', portName: 'out' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const components: Record<string, Component> = {
      'switch1': { id: 'switch1', type: 'SWITCH', value: false },
      'switch2': { id: 'switch2', type: 'SWITCH', value: false },
      'wrapper1': { id: 'wrapper1', type: 'AndWrapper' },
      'led1': { id: 'led1', type: 'LED', value: false },
    };

    const connections: Record<string, Connection> = {
      'conn1': {
        id: 'conn1',
        sourceComponentId: 'switch1',
        sourcePortIndex: 0,
        targetComponentId: 'wrapper1',
        targetPortIndex: 0,
      },
      'conn2': {
        id: 'conn2',
        sourceComponentId: 'switch2',
        sourcePortIndex: 0,
        targetComponentId: 'wrapper1',
        targetPortIndex: 1,
      },
      'conn3': {
        id: 'conn3',
        sourceComponentId: 'wrapper1',
        sourcePortIndex: 0,
        targetComponentId: 'led1',
        targetPortIndex: 0,
      },
    };

    const resolveComponent = (name: string) => {
      if (name === 'AndWrapper') {
        return andWrapperCircuit;
      }
      return undefined;
    };

    const result = flattenIR(components, connections, resolveComponent);

    // Should have the internal AND gate
    expect(result.components).toHaveProperty('wrapper1__and1');
    expect(result.components['wrapper1__and1'].type).toBe('AND_GATE');

    // Should have connections from switch1 -> internal and gate
    // Should have connections from internal and gate -> led1
    const flatConnections = Object.values(result.connections);

    // Find connection from switch1 to internal and gate
    const switch1Conn = flatConnections.find(
      c => c.sourceComponentId === 'switch1' && c.targetComponentId === 'wrapper1__and1'
    );
    expect(switch1Conn).toBeDefined();

    // Find connection from switch2 to internal and gate
    const switch2Conn = flatConnections.find(
      c => c.sourceComponentId === 'switch2' && c.targetComponentId === 'wrapper1__and1'
    );
    expect(switch2Conn).toBeDefined();

    // Find connection from internal and gate to led1
    const ledConn = flatConnections.find(
      c => c.sourceComponentId === 'wrapper1__and1' && c.targetComponentId === 'led1'
    );
    expect(ledConn).toBeDefined();
  });
});
