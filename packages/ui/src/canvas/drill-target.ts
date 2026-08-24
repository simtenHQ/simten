/**
 * What opens when a node is double-clicked.
 *
 * Two kinds of node are drillable and they mean different things:
 *
 * - A composite has real internal structure. Opening it shows what it *is*.
 * - An eval-only primitive with an entry in `MADE_OF` has no internal
 *   structure at all — `Adder({ width: 8 })` computes `a + b + carry_in` in one
 *   step. Opening it shows a gate-level build of the same function, proven
 *   equivalent to it by `made-of.verify.ts`.
 *
 * The reference build is never elaborated into the running netlist; it is
 * constructed here, on demand, for display in a dialog that runs its own
 * simulator. Drilling an Adder costs nothing until someone drills it.
 *
 * Frames carry their own library. A reference build introduces circuits the
 * page has never heard of — FigletStream depends on `Adder`, not on the
 * `FullAdder`/`Slice`/`Concat`/`Xor` that explain it — and `projection.ts`
 * silently drops any node it cannot resolve. Without the layered library the
 * dialog renders the boundary ports and nothing in between.
 */

import type { Circuit, CircuitLibrary } from '@simten/core';
import { MADE_OF } from '@simten/core/std';
import type { NodeData } from '../nodes';
import type { InspectorFrame } from './types';

/** The shape `circuit()` returns: the IR plus its transitive dependencies. */
interface BuiltLike {
  circuit: Circuit;
  _dependencies?: Map<string, { circuit?: Circuit } | undefined>;
}

/** A library that answers from `extra` first, then falls back to `base`. */
function layer(base: CircuitLibrary, extra: Map<string, Circuit>): CircuitLibrary {
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
 *
 * Composites win over reference builds: if a user has defined their own Adder
 * with real structure, that structure is the truth and should be what opens.
 */
export function resolveDrillTarget(
  nodeData: NodeData,
  library: CircuitLibrary,
): InspectorFrame | null {
  const { componentRef } = nodeData;
  const nodeLabel = nodeData.label ?? componentRef;

  const componentDef = library.resolveCircuit(componentRef);
  if (componentDef?.implementation.kind === 'composite' && componentDef.nodes.length > 0) {
    // Carry the library forward so a frame opened from inside a reference build
    // keeps seeing the gates that build introduced.
    return { componentName: componentRef, componentDef, nodeLabel, library };
  }

  const build = MADE_OF[componentRef];
  if (!build) return null;

  // Build to this node's own arguments, so Adder({width:16}) opens 16 stages
  // and Adder({width:8}) opens 8.
  const args = (nodeData.arguments ?? {}) as Record<string, never>;
  let built: BuiltLike;
  try {
    built = build(args) as BuiltLike;
  } catch {
    // A malformed argument bag should leave the node inert, not break the canvas.
    return null;
  }

  const extra = new Map<string, Circuit>([[built.circuit.name, built.circuit]]);
  for (const dep of built._dependencies?.values() ?? []) {
    if (dep?.circuit) extra.set(dep.circuit.name, dep.circuit);
  }

  return {
    componentName: componentRef,
    componentDef: built.circuit,
    nodeLabel,
    library: layer(library, extra),
  };
}
