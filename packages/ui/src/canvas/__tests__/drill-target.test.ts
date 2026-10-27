/**
 * The drill gate. Both double-click paths (CircuitCanvas's built-in handler and
 * the one inside CompositeInspectorDialog) route through `resolveDrillTarget`,
 * so this is where "can this node be opened, and into what" is decided.
 */

import { bit, circuit } from '@simten/core/circuit';
import type { CircuitDefinitions, CircuitIR } from '@simten/core/internal';
import { internalsOf } from '@simten/core/internal';
import { And, Xor } from '@simten/core/std';
import { describe, expect, it } from 'vitest';
import type { NodeData } from '../../nodes';
import { resolveDrillTarget } from '../drill-target';

const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { x: Xor, n: And },
  connect: ({ inputs, outputs, nodes: { x, n } }) => [
    inputs.a.to(x.a, n.a),
    inputs.b.to(x.b, n.b),
    x.out.to(outputs.sum),
    n.out.to(outputs.carry),
  ],
});

function definitionsOf(...circuits: CircuitIR[]): CircuitDefinitions {
  const byName = new Map(circuits.map((c) => [c.name, c]));
  return {
    resolveCircuit: (name) => byName.get(name),
    getAllPrimitiveNames: () =>
      [...byName.values()].filter((c) => c.implementation.kind === 'primitive').map((c) => c.name),
  };
}

function nodeData(componentRef: string, args: Record<string, unknown> = {}): NodeData {
  return {
    nodeId: 'n1',
    componentRef,
    label: componentRef.toLowerCase(),
    inputCount: 0,
    outputCount: 0,
    inputNames: [],
    outputNames: [],
    arguments: args,
  };
}

describe('resolveDrillTarget', () => {
  it('opens a composite into its own structure', () => {
    const definitions = definitionsOf(internalsOf(HalfAdder).ir);
    const frame = resolveDrillTarget(nodeData('HalfAdder'), definitions);
    expect(frame?.componentName).toBe('HalfAdder');
    expect(frame?.componentDef.nodes).toHaveLength(2);
  });

  it('opens an eval-only primitive into its gate-level reference build', () => {
    // The whole point: Adder has no `connect` and no nodes, so before MADE_OF
    // this was a dead end.
    const frame = resolveDrillTarget(nodeData('Adder', { width: 8 }), definitionsOf());
    expect(frame).not.toBeNull();
    const stages = frame?.componentDef.nodes.filter((n) => n.componentRef === 'FullAdder');
    expect(stages).toHaveLength(8);
  });

  it('builds to the node’s own width, not a fixed one', () => {
    for (const width of [1, 4, 16]) {
      const frame = resolveDrillTarget(nodeData('Adder', { width }), definitionsOf());
      const stages = frame?.componentDef.nodes.filter((n) => n.componentRef === 'FullAdder');
      expect(stages, `width ${width}`).toHaveLength(width);
    }
  });

  it('prefers real structure over a reference build', () => {
    // A user who defines their own Adder with actual internals should see those
    // internals, not the stdlib's explanation of a different circuit.
    const UserAdder = circuit('Adder', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit },
      nodes: { x: Xor },
      connect: ({ inputs, outputs, nodes: { x } }) => [
        inputs.a.to(x.a),
        inputs.b.to(x.b),
        x.out.to(outputs.sum),
      ],
    });
    const frame = resolveDrillTarget(
      nodeData('Adder', { width: 8 }),
      definitionsOf(internalsOf(UserAdder).ir),
    );
    expect(frame?.componentDef.nodes).toHaveLength(1);
    expect(frame?.componentDef.nodes[0].componentRef).toBe('Xor');
  });

  it('returns null for a leaf primitive', () => {
    expect(resolveDrillTarget(nodeData('Xor'), definitionsOf(internalsOf(Xor).ir))).toBeNull();
    // Deliberately excluded from MADE_OF.
    expect(resolveDrillTarget(nodeData('Multiplier', { width: 8 }), definitionsOf())).toBeNull();
    expect(resolveDrillTarget(nodeData('Constant', { value: 1 }), definitionsOf())).toBeNull();
  });

  it('returns null rather than throwing on a malformed argument bag', () => {
    // A bad width should leave the node inert, not break the canvas.
    for (const width of ['wide', Number.NaN, -1]) {
      expect(() => resolveDrillTarget(nodeData('Adder', { width }), definitionsOf())).not.toThrow();
    }
    // Missing arguments entirely — falls back to the default width.
    const frame = resolveDrillTarget(nodeData('Adder'), definitionsOf());
    expect(frame?.componentDef.nodes.filter((n) => n.componentRef === 'FullAdder')).toHaveLength(8);
  });

  it('carries definitions that resolve every node in the reference build', () => {
    // The bug this pins: FigletStream depends on Adder, not on the FullAdder /
    // Slice / Concat / gates that explain it. `projection.ts` drops any node it
    // cannot resolve, so a frame without its own definitions renders the boundary
    // ports and an empty middle.
    const pageDefinitions = definitionsOf(); // knows nothing
    const frame = resolveDrillTarget(nodeData('Adder', { width: 8 }), pageDefinitions);
    expect(frame?.definitions).toBeDefined();
    for (const node of frame?.componentDef.nodes ?? []) {
      expect(
        frame?.definitions?.resolveCircuit(node.componentRef),
        `${node.componentRef} unresolvable — it would be dropped from the canvas`,
      ).toBeDefined();
    }
  });

  it('keeps those definitions reachable when drilling deeper', () => {
    // FullAdder is only known because the Adder build introduced it; drilling
    // into it must still resolve Xor/And/Or.
    const frame = resolveDrillTarget(nodeData('Adder', { width: 4 }), definitionsOf());
    const inner = resolveDrillTarget(nodeData('FullAdder'), frame!.definitions!);
    expect(inner?.componentDef.nodes.length).toBeGreaterThan(0);
    for (const node of inner?.componentDef.nodes ?? []) {
      expect(inner?.definitions?.resolveCircuit(node.componentRef)).toBeDefined();
    }
  });

  it('carries the node label so the breadcrumb reads as the instance', () => {
    const data = nodeData('Adder', { width: 8 });
    data.label = 'adder';
    expect(resolveDrillTarget(data, definitionsOf())?.nodeLabel).toBe('adder');
  });
});
