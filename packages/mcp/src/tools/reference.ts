/**
 * Reference tools — get_grammar + list_components.
 *
 * Clients cap an MCP server's `instructions` field (Claude Code truncates at
 * 2KB; see https://code.claude.com/docs/en/mcp.md). The circuit-builder API
 * (~2KB) and the component catalog (~10KB) can't fit there — they'd be cut,
 * leaving the agent to guess part names and ports. So instead of baking that
 * reference into the always-injected instructions, we expose it on demand via
 * these tools: tool *results* aren't capped, so the agent gets the full text.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getGrammarHandler, getPrimitivesHandler, getLibrary } from '@simten/core/api';
import {
  getFactoryOptionSignatures,
  annotatePrimitivesWithOptions,
} from '../lib/primitive-params.js';

// Static reference, built once. The grammar is the circuit() builder API +
// worked examples; the component list is every primitive with its ports and
// constructor options (e.g. `Register ctor({ width?, value? })`) — ports alone
// don't reveal factory options.
const grammar = getGrammarHandler();
const components = annotatePrimitivesWithOptions(
  getPrimitivesHandler({ compact: true }, getLibrary()),
  getFactoryOptionSignatures(),
);

// How to write a .verify.ts testbench. This lives here (not in verify_circuit's
// description) because that description is capped at 2KB by clients — the
// simulate() stepper API was getting truncated off the end. Kept faithful to
// docs/verifying-circuits.mdx (the simulate() handle is lifted from a fixture).
const VERIFY_API = `Writing a .verify.ts testbench — a sibling file to your circuit, run on the host via tsx (full npm resolution, no sandbox).

SHAPE
  import { simulate } from '@simten/core/sim';
  import { verify, declareOracle } from '@simten/core/verify';
  import * as fc from 'fast-check';                       // only if you use verify.check
  import { MyCircuit } from './my_circuit.circuit.js';     // your DUT — must be exported

  declareOracle({ tier: 'B', type: '...', independence_basis: '...' });  // module top level, one per file

  verify.exhaustive('truth table', [2, 2], (a, b) => {
    const s = simulate(MyCircuit);
    try {
      s.set({ a, b });                                     // drive inputs by port name
      return s.get('sum') === (a ^ b) && s.get('carry') === (a & b);
    } finally {
      s.dispose();
    }
  });

  verify.run();   // REQUIRED — flushes the structured result (this is the gate)

THE simulate() HANDLE
  const s = simulate(Circuit);
  s.set({ portName: value, ... });   // set input port values (number/boolean)
  s.tick();                          // advance one rising clock edge (sequential circuits)
  s.get('portName');                 // read an output port's current value
  s.dispose();                       // ALWAYS in finally — frees the sim
  // Combinational: set() then get(). Sequential: set(), tick() per cycle, get().
  // Pulse a reset: s.set({ reset: 1 }); s.tick(); s.set({ reset: 0 }); then drive normally.

CHECK STRATEGIES
  verify.exhaustive(name, spaces, predicate) — sweep every combination. spaces: [256] = 0..255; [2,2] = all 4 (a,b) pairs. Harness caps at 2^20. Use when the space is enumerable.
  verify.check(name, fc.property(fc.nat(255), (x) => { ... })) — fast-check sampling for large spaces; shrinks to a minimal repro on failure.

TIER-A npm-oracle pattern (the flagship) — import a real package and compare the circuit against it:
  import { sha256 } from '@noble/hashes/sha2.js';
  const expected = sha256(new Uint8Array(0));            // independent reference, computed outside the circuit
  declareOracle({ tier: 'A', type: '@noble/hashes sha256("") vector', independence_basis: 'expected bytes come from an external crypto library, not this circuit' });
  verify.exhaustive('rom holds sha256("")[0..3]', [4], (addr) => {
    const s = simulate(HashRom);
    try { s.set({ addr }); s.tick(); return s.get('data') === expected[addr]; } finally { s.dispose(); }
  });
  verify.run();

The same file runs unchanged three ways: via verify_circuit (agent), 'tsx file.verify.ts' (CLI), or under vitest (wrap as test('verify', () => verify.run())). Lead with the tier when you report — Tier-A exhaustive is a far stronger claim than Tier-D sampled.`;

export function registerReferenceTools(server: McpServer): void {
  server.tool(
    'get_grammar',
    'Return the circuit-builder API: how to write a `circuit()` module — inputs/outputs, nodes, connect — with worked examples. Call this before writing a circuit.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: grammar }] }),
  );

  server.tool(
    'list_components',
    'Return the full catalog of available components from `@simten/core/std`, each with its ports and constructor options (e.g. `Register({ width })`). Call this to discover exact part names and parameters instead of guessing.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: components }] }),
  );

  server.tool(
    'get_verify_api',
    'Return how to write a `.verify.ts` testbench for `verify_circuit`: the `simulate()` stepper API (set/tick/get/dispose), `verify.exhaustive` vs `verify.check`, `declareOracle`, and worked examples (incl. the Tier-A npm-oracle pattern). Call this before writing a testbench.',
    {},
    async () => ({ content: [{ type: 'text' as const, text: VERIFY_API }] }),
  );
}
