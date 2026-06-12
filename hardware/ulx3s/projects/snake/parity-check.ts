#!/usr/bin/env tsx
/**
 * parity-check.ts — every SnakeCore copy in the repo is structurally
 * identical to the one that ships to the FPGA.
 *
 * Copies checked against this project's circuit (@simten/core/examples):
 *  - the blog post circuit (apps/web .../snake-in-hardware/circuits.ts),
 *    which also drives the landing-page demo — a re-export of the canonical,
 *    checked anyway so a future re-fork gets caught
 *  - the /circuit editor example (apps/web .../visual-editor/examples.ts),
 *    a Monaco source string — built via executeCircuitCode, the same path
 *    the editor sandbox uses. Its top level is the playable harness
 *    (keyboard → decoder → SnakeCore ⇄ RAM → Screen), so the comparison
 *    covers SnakeCore and every stage composite under it by name.
 *
 * Comparison is on the circuit IR: ports, node set (component + arguments),
 * and the connection set — order-insensitive, so formatting and connect()
 * ordering don't matter. Arguments matter: a Mux() missing { width: 8 } is
 * sim-equivalent but synthesis-broken (the historical left/up mirror bug),
 * and this check exists to catch exactly that class of drift.
 */

import type { Circuit } from '@simten/core/simulator';
import { executeCircuitCode } from '@simten/core/circuit';
import { buildSnake } from './index.js';
import { Snake as BlogSnake } from '../../../../apps/web/src/features/blog/snake-in-hardware/circuits.js';
import { EXAMPLES } from '../../../../apps/web/src/features/visual-editor/examples.js';

interface CanonNode {
  id: string;
  ref: string;
  args: Record<string, unknown>;
}

interface CanonCircuit {
  inputs: string[];
  outputs: string[];
  nodes: CanonNode[];
  connections: string[];
}

function portSig(p: { name: string; portType: { kind: string; width?: number } }): string {
  return `${p.name}:${p.portType.kind === 'bus' ? `bus(${p.portType.width})` : p.portType.kind}`;
}

function canon(c: Circuit): CanonCircuit {
  return {
    inputs: c.inputs.map(portSig).sort(),
    outputs: c.outputs.map(portSig).sort(),
    nodes: c.nodes
      .map((n) => ({ id: n.id, ref: n.componentRef, args: (n.arguments ?? {}) as Record<string, unknown> }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    connections: c.connections
      .map((cn) => `${cn.source.nodeId || '@in'}.${cn.source.portName} -> ${cn.target.nodeId || '@out'}.${cn.target.portName}`)
      .sort(),
  };
}

function diff(name: string, ref: CanonCircuit, other: CanonCircuit): string[] {
  const problems: string[] = [];
  if (JSON.stringify(ref.inputs) !== JSON.stringify(other.inputs)) {
    problems.push(`inputs differ: ${JSON.stringify(other.inputs)} (want ${JSON.stringify(ref.inputs)})`);
  }
  if (JSON.stringify(ref.outputs) !== JSON.stringify(other.outputs)) {
    problems.push(`outputs differ: ${JSON.stringify(other.outputs)} (want ${JSON.stringify(ref.outputs)})`);
  }

  const refNodes = new Map(ref.nodes.map((n) => [n.id, n]));
  const otherNodes = new Map(other.nodes.map((n) => [n.id, n]));
  for (const [id, n] of refNodes) {
    const o = otherNodes.get(id);
    if (!o) {
      problems.push(`missing node '${id}' (${n.ref})`);
    } else if (o.ref !== n.ref) {
      problems.push(`node '${id}' is ${o.ref}, want ${n.ref}`);
    } else if (JSON.stringify(o.args) !== JSON.stringify(n.args)) {
      problems.push(`node '${id}' (${n.ref}) args ${JSON.stringify(o.args)}, want ${JSON.stringify(n.args)}`);
    }
  }
  for (const id of otherNodes.keys()) {
    if (!refNodes.has(id)) problems.push(`extra node '${id}' (${otherNodes.get(id)!.ref})`);
  }

  const refConns = new Set(ref.connections);
  const otherConns = new Set(other.connections);
  for (const c of refConns) if (!otherConns.has(c)) problems.push(`missing connection: ${c}`);
  for (const c of otherConns) if (!refConns.has(c)) problems.push(`extra connection: ${c}`);

  return problems.map((p) => `[${name}] ${p}`);
}

const { built } = buildSnake();

/** Canonical circuits by name: the FPGA top plus its whole dependency tree. */
const canonical = new Map<string, Circuit>([[built.circuit.name, built.circuit]]);
for (const [name, dep] of built._dependencies) {
  if (dep.circuit.implementation.kind === 'composite') canonical.set(name, dep.circuit);
}

/** The shared tree the editor example must carry verbatim: SnakeCore + stages. */
const SHARED = ['SnakeCore', ...[...canonical.keys()].filter((n) => n.startsWith('Snake_'))];

const problems: string[] = [];

// Copy 1: blog post / landing page demo — full tree against canonical.
problems.push(...diff('blog:Snake', canon(canonical.get('Snake')!), canon(BlogSnake.circuit)));
for (const [name, dep] of BlogSnake._dependencies) {
  if (dep.circuit.implementation.kind !== 'composite') continue;
  const ref = canonical.get(name);
  if (!ref) {
    problems.push(`[blog:${name}] composite not present in canonical tree`);
    continue;
  }
  problems.push(...diff(`blog:${name}`, canon(ref), canon(dep.circuit)));
}

// Copy 2: /circuit editor example source string.
const example = EXAMPLES.find((e) => e.id === 'snake');
if (!example) {
  console.error('❌ no example with id "snake" in visual-editor examples');
  process.exit(1);
}
const result = executeCircuitCode(example.code);
if (result.error) {
  console.error(`❌ editor snake example failed to execute: ${result.error}`);
  process.exit(1);
}
for (const name of SHARED) {
  const editorCircuit = result.circuits.find((c) => c.name === name);
  if (!editorCircuit) {
    problems.push(`[editor:${name}] circuit missing from the example source`);
    continue;
  }
  problems.push(...diff(`editor:${name}`, canon(canonical.get(name)!), canon(editorCircuit)));
}

// The example's top level must be the playable harness wired to SnakeCore.
const playable = result.circuits.find((c) => c.name === 'SnakePlayable');
if (!playable) {
  problems.push('[editor:SnakePlayable] playable top-level circuit missing');
} else {
  if (!playable.nodes.some((n) => n.componentRef === 'SnakeCore')) {
    problems.push('[editor:SnakePlayable] does not instantiate SnakeCore');
  }
  if (!playable.nodes.some((n) => n.id === 'keyboard' && n.componentRef === 'Input')) {
    problems.push("[editor:SnakePlayable] no Input node named 'keyboard' — arrow keys won't reach the game");
  }
  if (!playable.nodes.some((n) => n.componentRef === 'Screen')) {
    problems.push('[editor:SnakePlayable] no Screen — the game would be invisible');
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(`❌ ${p}`);
  console.error(`\n${problems.length} drift(s) from the FPGA circuit`);
  process.exit(1);
}
console.log(`✅ blog and editor-example snake circuits are structurally identical to the FPGA circuit (${SHARED.length} shared composites checked)`);
