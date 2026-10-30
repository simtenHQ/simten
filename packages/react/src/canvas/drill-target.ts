/**
 * What opens when a node is double-clicked.
 *
 * Two kinds of node are drillable and they mean different things:
 *
 * - A composite has real internal structure. Opening it shows what it *is*.
 * - An eval-only primitive with an entry in `MADE_OF` has no internal
 *   structure at all — `Adder({ width: 8 })` computes `a + b + carry_in` in one
 *   step. Opening it shows a gate-level build of the same function, proven
 *   equivalent to it by `made-of-equivalence.verify.ts`.
 *
 * The reference build is never elaborated into the running netlist. Its IR is
 * constructed here, on demand, for display; the inspector runs it as a second
 * session in the sandbox. Drilling an Adder costs nothing until someone drills it.
 *
 * Frames carry their own circuit definitions. A reference build introduces circuits the
 * page has never heard of — FigletStream depends on `Adder`, not on the
 * `FullAdder`/`Slice`/`Concat`/`Xor` that explain it, and `circuit-to-flow.ts`
 * silently drops any node it cannot resolve. Without the layered definitions the
 * dialog renders the boundary ports and nothing in between.
 */

import {
  type ArgumentValue,
  type CircuitDefinitions,
  type CircuitIR,
  internalsOf,
  isCircuit,
} from '@simten/core/internal';
import { MADE_OF } from '@simten/core/std';
import type { NodeData } from '../nodes';
import type { InspectorFrame } from './types';

/** Definitions that answer from `extra` first, then fall back to `base`. */
function layer(base: CircuitDefinitions, extra: Map<string, CircuitIR>): CircuitDefinitions {
  return {
    resolveCircuit: (name) => extra.get(name) ?? base.resolveCircuit(name),
    getAllPrimitiveNames: () => {
      const names = new Set(base.getAllPrimitiveNames());
      for (const c of extra.values()) {
        if (c.implementation.kind === 'primitive') names.add(c.name);
      }
      return [...names];
    },
  };
}

/**
 * Resolve the frame a double-click should push, or null if the node is a leaf.
 * The frame opens at the node's path in the session it was clicked in.
 *
 * Composites win over reference builds: if a user has defined their own Adder
 * with real structure, that structure is the truth and should be what opens.
 */
export function resolveDrillTarget(
  nodeData: NodeData,
  definitions: CircuitDefinitions,
): InspectorFrame | null {
  const { componentRef, path } = nodeData;
  const nodeLabel = nodeData.label ?? componentRef;

  const componentDef = definitions.resolveCircuit(componentRef);
  if (componentDef?.implementation.kind === 'composite' && componentDef.nodes.length > 0) {
    // Carry the definitions forward so a frame opened from inside a reference build
    // keeps seeing the gates that build introduced.
    return { componentName: componentRef, componentDef, nodeLabel, definitions, path };
  }

  const build = MADE_OF[componentRef];
  if (!build) return null;

  // Build to this node's own arguments, so Adder({width:16}) opens 16 stages
  // and Adder({width:8}) opens 8.
  const args = (nodeData.arguments ?? {}) as Record<string, ArgumentValue>;
  let built: unknown;
  try {
    built = build(args);
  } catch {
    // A malformed argument bag should leave the node inert, not break the canvas.
    return null;
  }
  if (!isCircuit(built)) return null;

  const { ir, dependencies } = internalsOf(built);
  const extra = new Map<string, CircuitIR>([[ir.name, ir]]);
  for (const dep of dependencies.values()) extra.set(dep.name, internalsOf(dep).ir);

  return {
    componentName: componentRef,
    componentDef: ir,
    nodeLabel,
    definitions: layer(definitions, extra),
    // The build is the top level of its own session, fed from this primitive.
    path: '',
    reference: { instance: path, circuit: built },
  };
}
