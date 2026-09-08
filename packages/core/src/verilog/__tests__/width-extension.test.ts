/**
 * Width adaptation must survive Verilog export, by either route.
 *
 * `ZeroExtend`/`SignExtend` had no entry in `primitive-map`, so any circuit
 * using one exported as `// WARNING: Unsupported primitive` in place of the
 * extension — output that parses and synthesizes and does not do what the
 * circuit does, exactly the failure `unsupported-primitives.test.ts` was
 * written about. The importer emits both routinely from yosys netlists
 * (see component-homes.ts), and they are authorable, so the gap was reachable
 * two ways. Both are pure wiring: zero-extension pads with constant 0s,
 * sign-extension replicates the top bit, and yosys folds either into the net.
 *
 * The Snake test is here because nothing else in the suite exports Snake to
 * Verilog, which is how the missing mappings went unnoticed in the first place.
 */

import { describe, expect, it } from 'vitest';
import { bit, bus, circuit } from '../../circuit/index.js';
import { buildSnake } from '../../examples/snake.js';
import type { Circuit, CircuitLibrary } from '../../index.js';
import { BitSlice, Register, SignExtend, ZeroExtend } from '../../std/index.js';
import { exportVerilog } from '../index.js';

/** Top circuit plus every transitive dependency, so elaboration can resolve. */
function libraryFor(top: { circuit: Circuit; _dependencies?: ReadonlyMap<string, unknown> }) {
  const byName = new Map<string, Circuit>();
  const add = (c: unknown) => {
    const b = c as { circuit?: Circuit; _dependencies?: ReadonlyMap<string, unknown> };
    if (!b?.circuit || byName.has(b.circuit.name)) return;
    byName.set(b.circuit.name, b.circuit);
    for (const dep of b._dependencies?.values() ?? []) add(dep);
  };
  add(top);
  return {
    resolveCircuit: (name: string) => byName.get(name),
    getAllPrimitiveNames: () => [...byName.keys()],
  } as unknown as CircuitLibrary;
}

describe('width adaptation exports to Verilog', () => {
  const Extend = circuit('ExtendTop', {
    inputs: { a: bus(3) },
    outputs: { z: bus(8), s: bus(8) },
    nodes: {
      ze: ZeroExtend({ inWidth: 3, outWidth: 8 }),
      se: SignExtend({ inWidth: 3, outWidth: 8 }),
    },
    connect: ({ inputs, outputs, nodes: { ze, se } }) => [
      inputs.a.to(ze.in, se.in),
      ze.out.to(outputs.z),
      se.out.to(outputs.s),
    ],
  });

  it('zero-extension pads with constant zeros', () => {
    const res = exportVerilog(Extend.circuit, libraryFor(Extend));
    expect(res.verilog).toContain("= {5'b0, a};");
  });

  it('sign-extension replicates the top input bit', () => {
    const res = exportVerilog(Extend.circuit, libraryFor(Extend));
    expect(res.verilog).toContain('= {{5{a[2]}}, a};');
  });

  it('neither is reported unsupported', () => {
    const res = exportVerilog(Extend.circuit, libraryFor(Extend)) as { unsupported?: unknown };
    expect(res.unsupported ?? null).toBeNull();
  });

  // circuit() permits a widening connection (a port is uninterpreted `Bits`, so
  // there is only one meaning it can have). Export leans on `inferWidth` taking
  // max(source, target) for the wire, and then on Verilog's own implicit
  // zero-extension for the narrower assignment. Pinned because a "simplification"
  // of inferWidth to either endpoint's width would silently truncate here.
  it('a widening connection gets a wire at the wider width', () => {
    const Widen = circuit('WidenTop', {
      inputs: { a: bus(8), we: bit },
      outputs: { q: bus(8) },
      nodes: { sl: BitSlice({ low: 0, high: 2 }), r: Register({ width: 8 }) },
      connect: ({ inputs, outputs, nodes: { sl, r } }) => [
        inputs.a.to(sl.in),
        sl.out.to(r.data), // bus(3) -> bus(8)
        inputs.we.to(r.we),
        r.q.to(outputs.q),
      ],
    });
    const res = exportVerilog(Widen.circuit, libraryFor(Widen)) as {
      verilog: string;
      unsupported?: unknown;
    };
    expect(res.verilog).toContain('wire [7:0] w_sl_out;');
    expect(res.verilog).toContain('assign w_sl_out = a[2:0];');
    expect(res.unsupported ?? null).toBeNull();
  });

  it('Snake exports with no unsupported primitives', () => {
    const built = buildSnake() as Record<string, unknown>;
    const top = Object.values(built).find(
      (v) => (v as { circuit?: Circuit })?.circuit?.name === 'Snake',
    ) as { circuit: Circuit };
    expect(top, 'Snake top not found in buildSnake()').toBeDefined();
    const res = exportVerilog(top.circuit, libraryFor(top)) as { unsupported?: unknown };
    expect(res.unsupported ?? null).toBeNull();
  });
});
