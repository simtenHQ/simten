/**
 * Structural invariants for elaborated circuits (`FlatCircuit`).
 *
 * Oracle-free assertions about the shape of an elaboration output. We don't
 * compare to a reference implementation (which would be circular — the
 * "expected" answer would come from re-running the elaborator's own logic).
 * Instead we check universal properties of any well-formed flat netlist:
 *
 *   1. No connection's source or target references a composite-instance path.
 *      Everything must resolve to a primitive node from `flat.nodes` or to
 *      `TOP_LEVEL_NODE` — the whole job of `stitchCompositeConnections` /
 *      `resolveThroughComposites` is to make this true. A surviving virtual
 *      port is a #138-class silent bug.
 *
 *   2. Every connection's source/target portName is a port the referenced node
 *      actually declares. Catches misrouted wires that point at a name the
 *      target node doesn't have.
 *
 *   3. Every top-level output has *exactly* one driver. Zero = silent dropped
 *      wire (the #138 shape — `crc8_demo`'s symptom before the fix). Two+ =
 *      silent multi-drive (the post-stitch gap behind issue #143). Conditioned
 *      on the HDL's current multi-drive rejection — needs revisiting if
 *      tri-state / wired-OR is ever added.
 *
 *   4. No duplicate connection IDs. A duplicate is either a bug in
 *      `stitchCompositeConnections`' connection-id construction or a silent
 *      double-wire.
 *
 *   5. Top-level inputs are *annotated* (not failed) when they have no
 *      downstream consumer. An unused top-level input is a diagnostic concern,
 *      not a silent-correctness one — surfaced for the caller to inspect.
 *
 * Returns a result object with the annotations. Throws on any hard failure
 * with a message naming the invariant and the offending data, so test output
 * points at the bug rather than "expected true to be false."
 *
 * Used by:
 *   - `chained-passthrough.test.ts`   (sanity-check the helper doesn't
 *     regress the #138 fix)
 *   - `composite-patterns.test.ts`    (every targeted pattern test)
 *   - `invariants-on-trusted-circuits.test.ts`  (regression net across the
 *     circuits the project already depends on)
 */

import type { Circuit, CircuitLibrary } from '../../types/circuit.js';
import { TOP_LEVEL_NODE } from '../../types/circuit.js';
import type { FlatCircuit, FlatNode } from '../../types/simulator.js';
import { elaborate } from '../elaboration.js';

/**
 * Build a library from a BuiltCircuit and elaborate it in one call. Mirrors
 * what `simulate()` does internally (`packages/core/src/sim/simulate.ts:115-126`)
 * so tests can elaborate directly without going through the simulator. Pure
 * test convenience — never call from product code.
 */
// Loose type — BuiltCircuit lives in circuit.ts as a structural shape; we only
// need .circuit and (optionally) ._dependencies here.
type BuiltCircuitLike = {
  circuit: Circuit;
  _dependencies?: Map<string, { circuit: Circuit }>;
};

export function elaborateBuilt(built: BuiltCircuitLike): FlatCircuit {
  const circuitMap = new Map<string, Circuit>();
  const library: CircuitLibrary & { addCircuit(c: Circuit): void } = {
    resolveCircuit: (name) => circuitMap.get(name),
    getAllPrimitiveNames: () =>
      [...circuitMap.entries()]
        .filter(([, c]) => c.implementation.kind === 'primitive')
        .map(([n]) => n),
    addCircuit: (c) => {
      circuitMap.set(c.name, c);
    },
  };
  library.addCircuit(built.circuit);
  if (built._dependencies) {
    for (const [, dep] of built._dependencies) library.addCircuit(dep.circuit);
  }
  return elaborate(built.circuit, library);
}

export interface InvariantResult {
  /** Top-level input names that drive no downstream connection. Diagnostic only. */
  unusedTopInputs: string[];
}

export function assertFlatCircuitInvariants(flat: FlatCircuit): InvariantResult {
  // Re-use the precomputed nodeMap if the caller populated it (elaborate() does);
  // fall back to building one ourselves so the helper is independent of that.
  const nodeMap: Map<string, FlatNode> =
    flat.nodeMap && flat.nodeMap.size > 0
      ? flat.nodeMap
      : new Map(flat.nodes.map((n) => [n.id, n]));

  const topInputNames = new Set(flat.topLevelInputs.map((p) => p.name));
  const topOutputNames = new Set(flat.topLevelOutputs.map((p) => p.name));

  // ── Invariants 1 + 2: every endpoint resolves to a primitive (or TOP), and
  // its portName actually exists on that node. Walk every connection once;
  // collect violations into a single message so an audit pass surfaces the
  // full picture, not just the first offender.
  const violations: string[] = [];

  const checkEndpoint = (
    role: 'source' | 'target',
    nodeId: string,
    portName: string,
    connId: string,
  ): void => {
    if (nodeId === TOP_LEVEL_NODE) {
      // Top-level source ↔ topLevelInputs (a top input flows OUT of TOP).
      // Top-level target ↔ topLevelOutputs (a top output flows IN to TOP).
      const allowed = role === 'source' ? topInputNames : topOutputNames;
      if (!allowed.has(portName)) {
        violations.push(
          `[invariant 2] connection ${connId}: ${role} ${TOP_LEVEL_NODE}.${portName} ` +
            `is not a declared top-level ${role === 'source' ? 'input' : 'output'}`,
        );
      }
      return;
    }
    const node = nodeMap.get(nodeId);
    if (!node) {
      // Invariant 1: a connection references a node that isn't in flat.nodes.
      // For composite-instance paths this is the #138-class symptom we care
      // about; for other ids it's also a structural bug worth flagging.
      violations.push(
        `[invariant 1] connection ${connId}: ${role} ${nodeId}.${portName} ` +
          `references a node not present in flat.nodes ` +
          `(likely an unresolved composite-instance path — the elaborator's ` +
          `transitive-closure step did not fully resolve this edge)`,
      );
      return;
    }
    // Invariant 2: portName must be declared on the node, on the correct side.
    // A source uses an OUTPUT port; a target uses an INPUT or CLOCK port.
    const allowedPorts =
      role === 'source'
        ? node.outputs.map((p) => p.name)
        : [...node.inputs.map((p) => p.name), ...node.clocks.map((p) => p.name)];
    if (!allowedPorts.includes(portName)) {
      violations.push(
        `[invariant 2] connection ${connId}: ${role} ${nodeId}.${portName} ` +
          `is not a declared ${role === 'source' ? 'output' : 'input/clock'} of ` +
          `${node.primitiveType} (declares: ${allowedPorts.join(', ') || '<none>'})`,
      );
    }
  };

  // ── Invariant 4: no duplicate connection ids.
  const seenIds = new Set<string>();

  // ── Invariant 3: count drivers per top-level output AS WE WALK.
  const driversPerTopOutput = new Map<string, number>();
  for (const name of topOutputNames) driversPerTopOutput.set(name, 0);

  // Track top-input usage for the annotation in invariant 5.
  const topInputConsumed = new Set<string>();

  for (const conn of flat.connections) {
    if (seenIds.has(conn.id)) {
      violations.push(`[invariant 4] duplicate connection id: ${conn.id}`);
    }
    seenIds.add(conn.id);

    checkEndpoint('source', conn.source.nodeId, conn.source.portName, conn.id);
    checkEndpoint('target', conn.target.nodeId, conn.target.portName, conn.id);

    if (conn.target.nodeId === TOP_LEVEL_NODE && topOutputNames.has(conn.target.portName)) {
      driversPerTopOutput.set(
        conn.target.portName,
        (driversPerTopOutput.get(conn.target.portName) ?? 0) + 1,
      );
    }
    if (conn.source.nodeId === TOP_LEVEL_NODE && topInputNames.has(conn.source.portName)) {
      topInputConsumed.add(conn.source.portName);
    }
  }

  // ── Invariant 3 final check.
  for (const [name, count] of driversPerTopOutput) {
    if (count === 0) {
      violations.push(
        `[invariant 3] top-level output '${name}' has zero drivers ` +
          `(silent dropped wire — the #138 shape)`,
      );
    } else if (count > 1) {
      violations.push(
        `[invariant 3] top-level output '${name}' has ${count} drivers ` +
          `(silent multi-drive — see #143 for the post-stitch gap)`,
      );
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `assertFlatCircuitInvariants: ${violations.length} violation(s):\n  ` +
        violations.join('\n  '),
    );
  }

  // ── Invariant 5: annotation, not failure.
  const unusedTopInputs = [...topInputNames].filter((n) => !topInputConsumed.has(n));
  return { unusedTopInputs };
}
