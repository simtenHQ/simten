/**
 * Wire thickness: buses draw heavier than single bits, so you can tell them
 * apart without a width label on every wire. The width comes from the
 * connection's own `portType`, which is already resolved for parametric parts
 * like `BitSlice({ low: 5, high: 7 })`.
 */

import type { CircuitIR } from '@simten/core/internal';
import { describe, expect, it } from 'vitest';
import { projectCircuitToReactFlow } from '../projection';

const circuit: CircuitIR = {
  name: 'Top',
  inputs: [],
  outputs: [],
  nodes: [
    {
      id: 'opcode',
      label: 'opcode',
      componentRef: 'Input',
      arguments: { value: 0, width: 8 },
      inputs: [],
      outputs: [{ id: 'opcode_out', name: 'out', portType: { kind: 'bus', width: 8 } }],
    },
    {
      id: 'en',
      label: 'en',
      componentRef: 'Switch',
      arguments: { value: false },
      inputs: [],
      outputs: [{ id: 'en_out', name: 'out', portType: { kind: 'bit' } }],
    },
    {
      id: 'reg',
      label: 'reg',
      componentRef: 'Register',
      arguments: { width: 8 },
      inputs: [
        { id: 'reg_data', name: 'data', portType: { kind: 'bus', width: 8 } },
        { id: 'reg_we', name: 'we', portType: { kind: 'bit' } },
      ],
      outputs: [{ id: 'reg_q', name: 'q', portType: { kind: 'bus', width: 8 } }],
    },
  ],
  connections: [
    {
      id: 'bus',
      source: { nodeId: 'opcode', portName: 'out' },
      target: { nodeId: 'reg', portName: 'data' },
      portType: { kind: 'bus', width: 8 },
    },
    {
      id: 'bit',
      source: { nodeId: 'en', portName: 'out' },
      target: { nodeId: 'reg', portName: 'we' },
      portType: { kind: 'bit' },
    },
  ],
  implementation: { kind: 'composite' },
} as unknown as CircuitIR;

const library = {
  resolveCircuit: () => undefined,
  getAllPrimitiveNames: () => ['Input', 'Switch', 'Register'],
};
const metadata = { components: {}, connections: {} };

describe('wire thickness', () => {
  const { edges } = projectCircuitToReactFlow(circuit, metadata, library);
  const strokeOf = (id: string) => edges.find((e) => e.id === id)?.style?.strokeWidth;

  it('draws a bus heavier than a single bit', () => {
    expect(strokeOf('bit')).toBe(2);
    expect(strokeOf('bus')).toBe(4);
  });
});
