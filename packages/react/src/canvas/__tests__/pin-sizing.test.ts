/**
 * Blocks size themselves from their pins, and the layout spaces them by the
 * same sums. Before, every unlisted block was laid out as 160x80 whatever it
 * carried, so a block with nine outputs squeezed its pins together and was
 * drawn over whatever the layout had put beneath it.
 */

import type { CircuitIR } from '@simten/core/internal';
import { describe, expect, it } from 'vitest';
import { PIN_PITCH, pinColumnHeight, pinLabelGutter } from '../../nodes/BaseNode';
import { computeDagreLayout } from '../dagre-layout';

const outputs = Array.from({ length: 9 }, (_, i) => `out_ctrl_${i}`);

const block = (id: string) => ({
  id,
  label: id,
  componentRef: 'Controller',
  arguments: {},
  inputs: [{ id: `${id}_in`, name: 'in', portType: { kind: 'bit' } }],
  outputs: outputs.map((name) => ({ id: `${id}_${name}`, name, portType: { kind: 'bit' } })),
});

/** One source feeding two nine-output blocks, so both land in the same rank. */
const circuit = {
  name: 'Top',
  inputs: [],
  outputs: [],
  nodes: [
    {
      id: 'src',
      label: 'src',
      componentRef: 'Switch',
      arguments: {},
      inputs: [],
      outputs: [{ id: 'src_out', name: 'out', portType: { kind: 'bit' } }],
    },
    block('upper'),
    block('lower'),
  ],
  connections: ['upper', 'lower'].map((id) => ({
    id: `c_${id}`,
    source: { nodeId: 'src', portName: 'out' },
    target: { nodeId: id, portName: 'in' },
    portType: { kind: 'bit' },
  })),
  implementation: { kind: 'composite' },
} as unknown as CircuitIR;

describe('pin sizing', () => {
  it('gives each pin its own slot', () => {
    expect(pinColumnHeight(9)).toBe(10 * PIN_PITCH);
  });

  it('widens a label gutter for long pin names', () => {
    expect(pinLabelGutter(['a', 'b'])).toBe(32);
    expect(pinLabelGutter(['timing_ctrl'])).toBeGreaterThan(pinLabelGutter(['a']));
  });

  it('spaces tall blocks so they do not overlap', () => {
    const positions = computeDagreLayout(circuit);
    const gap = Math.abs(positions.upper.y - positions.lower.y);
    expect(gap).toBeGreaterThanOrEqual(pinColumnHeight(outputs.length));
  });
});
