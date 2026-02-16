/**
 * Component Utility Functions - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { containsSequentialComponent, hasSequentialComponents } from '../utils/component-utils';
import type { Component } from '../../types';
import type { Circuit } from '../../types/circuit';

describe('containsSequentialComponent', () => {
  const mockResolveComponent = (name: string): Circuit | undefined => {
    // Mock component library
    const library: Record<string, Circuit> = {
      // Primitive sequential component (DFlipFlop)
      DFlipFlop: {
        id: 'dff',
        name: 'DFlipFlop',
        parameters: [],
        inputs: [
          { name: 'd', portType: { kind: 'bit' } },
          { name: 'clk', portType: { kind: 'bit' } },
        ],
        outputs: [
          { name: 'q', portType: { kind: 'bit' } },
          { name: 'q_bar', portType: { kind: 'bit' } },
        ],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'primitive' },
      },
      // Primitive combinational component (AndGate)
      AndGate: {
        id: 'and',
        name: 'AndGate',
        parameters: [],
        inputs: [
          { name: 'a', portType: { kind: 'bit' } },
          { name: 'b', portType: { kind: 'bit' } },
        ],
        outputs: [{ name: 'out', portType: { kind: 'bit' } }],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'primitive' },
      },
      // Composite component containing a DFlipFlop
      DFlipFlopTest: {
        id: 'dff-test',
        name: 'DFlipFlopTest',
        parameters: [],
        inputs: [
          { name: 'd', portType: { kind: 'bit' } },
          { name: 'clk', portType: { kind: 'bit' } },
        ],
        outputs: [
          { name: 'q', portType: { kind: 'bit' } },
          { name: 'q_bar', portType: { kind: 'bit' } },
        ],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'node1',
            componentRef: 'DFlipFlop', // References DFlipFlop internally
            arguments: {},
            inputs: [],
            outputs: [],
            clocks: [],
          },
        ],
        connections: [],
        implementation: { kind: 'composite' },
      },
      // Composite component containing only combinational logic
      MyAndGate: {
        id: 'my-and',
        name: 'MyAndGate',
        parameters: [],
        inputs: [
          { name: 'a', portType: { kind: 'bit' } },
          { name: 'b', portType: { kind: 'bit' } },
        ],
        outputs: [{ name: 'out', portType: { kind: 'bit' } }],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'node1',
            componentRef: 'AndGate', // References AndGate internally
            arguments: {},
            inputs: [],
            outputs: [],
            clocks: [],
          },
        ],
        connections: [],
        implementation: { kind: 'composite' },
      },
      // Deeply nested composite (contains DFlipFlopTest which contains DFlipFlop)
      DeepNested: {
        id: 'deep',
        name: 'DeepNested',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'node1',
            componentRef: 'DFlipFlopTest', // References DFlipFlopTest
            arguments: {},
            inputs: [],
            outputs: [],
            clocks: [],
          },
        ],
        connections: [],
        implementation: { kind: 'composite' },
      },
    };

    return library[name];
  };

  it('should return true for sequential primitive types', () => {
    const components: Record<string, Component> = {};
    expect(containsSequentialComponent('D_FLIP_FLOP', components, mockResolveComponent)).toBe(true);
    expect(containsSequentialComponent('REGISTER', components, mockResolveComponent)).toBe(true);
    expect(containsSequentialComponent('RAM', components, mockResolveComponent)).toBe(true);
  });

  it('should return false for combinational primitive types', () => {
    const components: Record<string, Component> = {};
    expect(containsSequentialComponent('AND_GATE', components, mockResolveComponent)).toBe(false);
    expect(containsSequentialComponent('OR_GATE', components, mockResolveComponent)).toBe(false);
    expect(containsSequentialComponent('NOT_GATE', components, mockResolveComponent)).toBe(false);
  });

  it('should return true for composite components containing sequential primitives', () => {
    const components: Record<string, Component> = {};
    expect(containsSequentialComponent('DFlipFlopTest', components, mockResolveComponent)).toBe(
      true
    );
  });

  it('should return false for composite components with only combinational logic', () => {
    const components: Record<string, Component> = {};
    expect(containsSequentialComponent('MyAndGate', components, mockResolveComponent)).toBe(false);
  });

  it('should handle deeply nested composite components', () => {
    const components: Record<string, Component> = {};
    expect(containsSequentialComponent('DeepNested', components, mockResolveComponent)).toBe(true);
  });

  it('should return false for undefined components', () => {
    const components: Record<string, Component> = {};
    expect(
      containsSequentialComponent('NonExistentComponent', components, mockResolveComponent)
    ).toBe(false);
  });

  it('should handle circular references without infinite recursion', () => {
    const circularResolve = (name: string): Circuit | undefined => {
      if (name === 'CircularA') {
        return {
          id: 'circular-a',
          name: 'CircularA',
          parameters: [],
          inputs: [],
          outputs: [],
          clocks: [],
          state: [],
          nodes: [
            {
              id: 'node1',
              componentRef: 'CircularB',
              arguments: {},
              inputs: [],
              outputs: [],
              clocks: [],
            },
          ],
          connections: [],
          implementation: { kind: 'composite' },
        };
      } else if (name === 'CircularB') {
        return {
          id: 'circular-b',
          name: 'CircularB',
          parameters: [],
          inputs: [],
          outputs: [],
          clocks: [],
          state: [],
          nodes: [
            {
              id: 'node1',
              componentRef: 'CircularA', // Circular reference!
              arguments: {},
              inputs: [],
              outputs: [],
              clocks: [],
            },
          ],
          connections: [],
          implementation: { kind: 'composite' },
        };
      }
      return undefined;
    };

    const components: Record<string, Component> = {};
    // Should not throw or hang
    expect(containsSequentialComponent('CircularA', components, circularResolve)).toBe(false);
  });
});

describe('hasSequentialComponents', () => {
  const mockResolveComponent = (name: string): Circuit | undefined => {
    const library: Record<string, Circuit> = {
      DFlipFlop: {
        id: 'dff',
        name: 'DFlipFlop',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'primitive' },
      },
      AndGate: {
        id: 'and',
        name: 'AndGate',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'primitive' },
      },
      DFlipFlopTest: {
        id: 'dff-test',
        name: 'DFlipFlopTest',
        parameters: [],
        inputs: [],
        outputs: [],
        clocks: [],
        state: [],
        nodes: [
          {
            id: 'node1',
            componentRef: 'DFlipFlop',
            arguments: {},
            inputs: [],
            outputs: [],
            clocks: [],
          },
        ],
        connections: [],
        implementation: { kind: 'composite' },
      },
    };

    return library[name];
  };

  it('should return true when circuit contains sequential primitives', () => {
    const components: Record<string, Component> = {
      comp1: { id: 'comp1', type: 'D_FLIP_FLOP', state: false },
      comp2: { id: 'comp2', type: 'AND_GATE' },
    };

    expect(hasSequentialComponents(components, mockResolveComponent)).toBe(true);
  });

  it('should return true when circuit contains composite with sequential primitives', () => {
    const components: Record<string, Component> = {
      comp1: { id: 'comp1', type: 'DFlipFlopTest' },
      comp2: { id: 'comp2', type: 'AND_GATE' },
    };

    expect(hasSequentialComponents(components, mockResolveComponent)).toBe(true);
  });

  it('should return false when circuit contains only combinational components', () => {
    const components: Record<string, Component> = {
      comp1: { id: 'comp1', type: 'AND_GATE' },
      comp2: { id: 'comp2', type: 'OR_GATE' },
    };

    expect(hasSequentialComponents(components, mockResolveComponent)).toBe(false);
  });

  it('should return false for empty circuit', () => {
    const components: Record<string, Component> = {};

    expect(hasSequentialComponents(components, mockResolveComponent)).toBe(false);
  });
});
