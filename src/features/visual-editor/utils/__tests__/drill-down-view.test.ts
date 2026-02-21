/**
 * Tests for drill-down view utilities
 */

import { describe, it, expect } from 'vitest';
import {
  createDrillDownViewCircuit,
  scopePortValues,
  BOUNDARY_IN_PREFIX,
  BOUNDARY_OUT_PREFIX,
} from '../drill-down-view';
import type { Circuit } from '../../types/circuit';
import type { FlatPortValueMap } from '../../lib/flat-simulator';

// Helper to create a minimal composite Circuit for testing
function makeComposite(overrides: Partial<Circuit> = {}): Circuit {
  return {
    id: 'half-adder-def',
    name: 'HalfAdder',
    parameters: [],
    inputs: [
      { name: 'a', portType: { kind: 'bit' } },
      { name: 'b', portType: { kind: 'bit' } },
    ],
    outputs: [
      { name: 'sum', portType: { kind: 'bit' } },
      { name: 'carry', portType: { kind: 'bit' } },
    ],
    clocks: [],
    state: [],
    nodes: [
      {
        id: 'xor1',
        label: 'xor1',
        componentRef: 'Xor',
        arguments: {},
        inputs: [
          { id: 'xor1_a', name: 'a', portType: { kind: 'bit' } },
          { id: 'xor1_b', name: 'b', portType: { kind: 'bit' } },
        ],
        outputs: [
          { id: 'xor1_out', name: 'out', portType: { kind: 'bit' } },
        ],
        clocks: [],
      },
      {
        id: 'and1',
        label: 'and1',
        componentRef: 'And',
        arguments: {},
        inputs: [
          { id: 'and1_a', name: 'a', portType: { kind: 'bit' } },
          { id: 'and1_b', name: 'b', portType: { kind: 'bit' } },
        ],
        outputs: [
          { id: 'and1_out', name: 'out', portType: { kind: 'bit' } },
        ],
        clocks: [],
      },
    ],
    connections: [
      // a → xor1.a
      {
        id: 'c1',
        source: { nodeId: '', portName: 'a' },
        target: { nodeId: 'xor1', portName: 'a' },
        portType: { kind: 'bit' },
      },
      // b → xor1.b
      {
        id: 'c2',
        source: { nodeId: '', portName: 'b' },
        target: { nodeId: 'xor1', portName: 'b' },
        portType: { kind: 'bit' },
      },
      // a → and1.a
      {
        id: 'c3',
        source: { nodeId: '', portName: 'a' },
        target: { nodeId: 'and1', portName: 'a' },
        portType: { kind: 'bit' },
      },
      // b → and1.b
      {
        id: 'c4',
        source: { nodeId: '', portName: 'b' },
        target: { nodeId: 'and1', portName: 'b' },
        portType: { kind: 'bit' },
      },
      // xor1.out → sum
      {
        id: 'c5',
        source: { nodeId: 'xor1', portName: 'out' },
        target: { nodeId: '', portName: 'sum' },
        portType: { kind: 'bit' },
      },
      // and1.out → carry
      {
        id: 'c6',
        source: { nodeId: 'and1', portName: 'out' },
        target: { nodeId: '', portName: 'carry' },
        portType: { kind: 'bit' },
      },
      // Internal connection: xor1.out → and1.a (just for testing non-boundary)
      {
        id: 'c7',
        source: { nodeId: 'xor1', portName: 'out' },
        target: { nodeId: 'and1', portName: 'a' },
        portType: { kind: 'bit' },
      },
    ],
    implementation: { kind: 'composite' },
    ...overrides,
  };
}

describe('createDrillDownViewCircuit', () => {
  it('creates boundary input nodes for each composite input port', () => {
    const composite = makeComposite();
    const view = createDrillDownViewCircuit(composite);

    const boundaryA = view.nodes.find((n) => n.id === `${BOUNDARY_IN_PREFIX}a`);
    const boundaryB = view.nodes.find((n) => n.id === `${BOUNDARY_IN_PREFIX}b`);

    expect(boundaryA).toBeDefined();
    expect(boundaryA!.componentRef).toBe('Switch'); // bit type → Switch
    expect(boundaryA!.label).toBe('a');

    expect(boundaryB).toBeDefined();
    expect(boundaryB!.componentRef).toBe('Switch');
  });

  it('creates boundary output nodes for each composite output port', () => {
    const composite = makeComposite();
    const view = createDrillDownViewCircuit(composite);

    const boundarySum = view.nodes.find((n) => n.id === `${BOUNDARY_OUT_PREFIX}sum`);
    const boundaryCarry = view.nodes.find((n) => n.id === `${BOUNDARY_OUT_PREFIX}carry`);

    expect(boundarySum).toBeDefined();
    expect(boundarySum!.componentRef).toBe('Led');
    expect(boundarySum!.label).toBe('sum');

    expect(boundaryCarry).toBeDefined();
    expect(boundaryCarry!.componentRef).toBe('Led');
  });

  it('uses Input node for bus-width input ports', () => {
    const composite = makeComposite({
      inputs: [
        { name: 'data', portType: { kind: 'bus', width: 8 } },
      ],
    });
    const view = createDrillDownViewCircuit(composite);

    const boundaryData = view.nodes.find((n) => n.id === `${BOUNDARY_IN_PREFIX}data`);
    expect(boundaryData).toBeDefined();
    expect(boundaryData!.componentRef).toBe('Input');
    expect(boundaryData!.arguments.width).toBe(8);
  });

  it('rewrites connections with nodeId: "" to use boundary node IDs', () => {
    const composite = makeComposite();
    const view = createDrillDownViewCircuit(composite);

    // c1: "" → xor1 should become __boundary_in_a → xor1
    const c1 = view.connections.find((c) => c.id === 'c1');
    expect(c1!.source.nodeId).toBe(`${BOUNDARY_IN_PREFIX}a`);
    expect(c1!.source.portName).toBe('out');
    expect(c1!.target.nodeId).toBe('xor1');
    expect(c1!.target.portName).toBe('a');

    // c5: xor1 → "" should become xor1 → __boundary_out_sum
    const c5 = view.connections.find((c) => c.id === 'c5');
    expect(c5!.source.nodeId).toBe('xor1');
    expect(c5!.source.portName).toBe('out');
    expect(c5!.target.nodeId).toBe(`${BOUNDARY_OUT_PREFIX}sum`);
    expect(c5!.target.portName).toBe('in');
  });

  it('preserves internal connections unchanged', () => {
    const composite = makeComposite();
    const view = createDrillDownViewCircuit(composite);

    const c7 = view.connections.find((c) => c.id === 'c7');
    expect(c7!.source.nodeId).toBe('xor1');
    expect(c7!.source.portName).toBe('out');
    expect(c7!.target.nodeId).toBe('and1');
    expect(c7!.target.portName).toBe('a');
  });

  it('preserves original internal nodes', () => {
    const composite = makeComposite();
    const view = createDrillDownViewCircuit(composite);

    const xor1 = view.nodes.find((n) => n.id === 'xor1');
    const and1 = view.nodes.find((n) => n.id === 'and1');

    expect(xor1).toBeDefined();
    expect(xor1!.componentRef).toBe('Xor');
    expect(and1).toBeDefined();
    expect(and1!.componentRef).toBe('And');
  });

  it('handles composite with no inputs', () => {
    const composite = makeComposite({
      inputs: [],
      connections: [
        {
          id: 'c5',
          source: { nodeId: 'xor1', portName: 'out' },
          target: { nodeId: '', portName: 'sum' },
          portType: { kind: 'bit' },
        },
      ],
    });
    const view = createDrillDownViewCircuit(composite);

    // No boundary input nodes
    const boundaryInputs = view.nodes.filter((n) => n.id.startsWith(BOUNDARY_IN_PREFIX));
    expect(boundaryInputs).toHaveLength(0);

    // Still has boundary output
    const boundaryOutputs = view.nodes.filter((n) => n.id.startsWith(BOUNDARY_OUT_PREFIX));
    expect(boundaryOutputs).toHaveLength(2); // sum and carry from base composite
  });

  it('handles composite with no outputs', () => {
    const composite = makeComposite({
      outputs: [],
      connections: [
        {
          id: 'c1',
          source: { nodeId: '', portName: 'a' },
          target: { nodeId: 'xor1', portName: 'a' },
          portType: { kind: 'bit' },
        },
      ],
    });
    const view = createDrillDownViewCircuit(composite);

    const boundaryOutputs = view.nodes.filter((n) => n.id.startsWith(BOUNDARY_OUT_PREFIX));
    expect(boundaryOutputs).toHaveLength(0);

    const boundaryInputs = view.nodes.filter((n) => n.id.startsWith(BOUNDARY_IN_PREFIX));
    expect(boundaryInputs).toHaveLength(2); // a and b from base composite
  });
});

describe('scopePortValues', () => {
  it('returns original map when prefix is empty', () => {
    const portValues: FlatPortValueMap = new Map([
      ['xor1.out', true],
      ['and1.out', false],
    ]);

    const result = scopePortValues(portValues, '');
    expect(result).toBe(portValues); // Same reference
  });

  it('strips prefix from matching keys', () => {
    const portValues: FlatPortValueMap = new Map([
      ['ha1.xor1.out', true],
      ['ha1.and1.out', false],
      ['other.node.out', true],
    ]);

    const result = scopePortValues(portValues, 'ha1.');
    expect(result.get('xor1.out')).toBe(true);
    expect(result.get('and1.out')).toBe(false);
    expect(result.has('other.node.out')).toBe(false);
  });

  it('ignores keys that do not start with prefix', () => {
    const portValues: FlatPortValueMap = new Map([
      ['ha1.xor1.out', true],
      ['ha2.xor1.out', false],
    ]);

    const result = scopePortValues(portValues, 'ha1.');
    expect(result.size).toBe(1);
    expect(result.get('xor1.out')).toBe(true);
  });

  it('maps boundary input port values correctly', () => {
    const composite = makeComposite();
    const portValues: FlatPortValueMap = new Map([
      ['ha1.a', true],
      ['ha1.b', false],
    ]);

    const result = scopePortValues(portValues, 'ha1.', composite);
    expect(result.get(`${BOUNDARY_IN_PREFIX}a.out`)).toBe(true);
    expect(result.get(`${BOUNDARY_IN_PREFIX}b.out`)).toBe(false);
  });

  it('maps boundary output port values correctly', () => {
    const composite = makeComposite();
    const portValues: FlatPortValueMap = new Map([
      ['ha1.sum', true],
      ['ha1.carry', false],
    ]);

    const result = scopePortValues(portValues, 'ha1.', composite);
    expect(result.get(`${BOUNDARY_OUT_PREFIX}sum.in`)).toBe(true);
    expect(result.get(`${BOUNDARY_OUT_PREFIX}carry.in`)).toBe(false);
  });

  it('works with nested prefixes (multi-level drill-down)', () => {
    const portValues: FlatPortValueMap = new Map([
      ['ha1.ha2.xor1.out', true],
      ['ha1.ha2.and1.out', false],
      ['ha1.xor1.out', true],
    ]);

    const result = scopePortValues(portValues, 'ha1.ha2.');
    expect(result.get('xor1.out')).toBe(true);
    expect(result.get('and1.out')).toBe(false);
    // ha1.xor1.out does not start with 'ha1.ha2.' so it should not appear
    expect(result.has('xor1.out')).toBe(true); // from ha1.ha2.xor1.out
  });

  it('handles empty port values map', () => {
    const portValues: FlatPortValueMap = new Map();
    const result = scopePortValues(portValues, 'ha1.');
    expect(result.size).toBe(0);
  });
});
