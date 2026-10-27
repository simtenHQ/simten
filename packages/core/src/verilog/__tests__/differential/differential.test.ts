/**
 * Differential test: the JS simulator against Icarus Verilog (#431).
 *
 * Every case runs the same seeded random inputs through the simulator and
 * through iverilog on the exporter's Verilog, and compares top outputs and
 * every exported internal net, cycle by cycle. The import cases instead run
 * a hand-written design in iverilog against the simulator running what the
 * importer made of its yosys netlist. See `harness.ts`.
 *
 * A case that disagrees today because of a known bug is `it.fails`, with the
 * bug in `bug`. Fixing the bug makes the case pass, which fails the run until
 * the marker is removed. `DIFF_STRICT=1` runs those cases as ordinary tests,
 * to see their mismatches.
 *
 * Needs `iverilog` on PATH. Skipped locally without it; in CI a missing
 * iverilog fails the run, so the suite can't go quietly green.
 */

import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import type { Circuit, SinkPortRef, SourcePortRef } from '../../../circuit/builder-types.js';
import { bit, bus, circuit } from '../../../circuit/index.js';
import { internalsOf } from '../../../circuit/internals.js';
import { EXAMPLES } from '../../../examples/catalog.js';
import { importNetlist, type YosysNetlist } from '../../../import/index.js';
import { buildFromIR, executeCircuitCode, libraryOf } from '../../../internal.js';
import type { PortType } from '../../../ir/circuit-ir.js';
import {
  Adder,
  AddressCombiner,
  And,
  BitSlice,
  Buffer,
  BusAnd,
  BusNot,
  BusOr,
  BusXnor,
  BusXor,
  Combiner,
  Comparator,
  Concat,
  Constant,
  Decoder,
  DFlipFlop,
  Divider,
  DualPortRAM,
  DynamicSlice,
  FullAdder,
  Incrementer,
  LeftShifter,
  LogicAnd,
  LogicNot,
  LogicOr,
  Modulo,
  Multiplier,
  Mux,
  Nand,
  NibbleSplitter,
  Nor,
  Not,
  Or,
  RAM,
  ReduceAnd,
  ReduceOr,
  ReduceXnor,
  ReduceXor,
  Register,
  RightShifter,
  ROM,
  romFromBytes,
  SignExtend,
  SignedAdder,
  SignedComparator,
  SignedDivider,
  SignedModulo,
  SignedMultiplier,
  SignedRightShifter,
  Slice,
  Splitter,
  Subtractor,
  WrappingMultiplier,
  Xnor,
  Xor,
  ZeroExtend,
} from '../../../std/index.js';
import {
  type DiffOptions,
  type DiffTarget,
  describeMismatches,
  hasIverilog,
  type Reference,
  runDifferential,
} from './harness.js';

interface Case {
  name: string;
  target: () => DiffTarget;
  opts?: Partial<DiffOptions>;
  reference?: Reference;
  /** Known bug this case disagrees on today. Marks the case `it.fails`. */
  bug?: string;
}

// Known bugs. The filed ones name their issue; "unfiled" ones were found by
// this test and still need an issue.
const BUG = {
  logicalAnd: '#429: && on buses is emitted as bitwise &',
  logicalOps: '#429: && and ! on buses are emitted as bitwise & and ~',
  signedShift: '#429: JS >> is emitted as logical >>',
  onTickPorts: '#429: an onTick primitive gets no clk/rst_n port',
  stateInit: '#429 (no clk/rst_n port), then #131: state resets to 0, not its initial value',
  xMemory: '#436: unwritten memory reads 0 in the simulator and x in Verilog',
  negedge: '#430: imported negedge $dff becomes posedge',
  shiftWidth: '#430: imported shift amount is sliced to the result width',
  noMapping: 'unfiled: no Verilog mapping, exported as an UNSUPPORTED comment',
  cmpPorts: 'unfiled: Comparator ne/le/ge (and SignedComparator ne/le/ge) are never assigned',
  combiner: 'unfiled: Combiner bit inputs driven by internal nets get width-wide wires',
  switches: 'unfiled: Switch and Input nodes export as undriven wires',
  dualPortRom: 'unfiled: DualPortROM exports reads of a memory it never declares',
  ramInit: 'unfiled: RAM drops its memory contents on export',
} as const;

/** Top circuit plus every transitive dependency and their behavior. */
function target(top: Circuit): DiffTarget {
  return { top: internalsOf(top).ir, library: libraryOf(top) };
}

/**
 * One instance of `inner` with its ports brought out to top-level ports of the
 * same names (only `outputs`, if given).
 */
function wrap(name: string, inner: Circuit, outputs?: readonly string[]): DiffTarget {
  const ports = (list: readonly { name: string; portType: PortType }[]) =>
    Object.fromEntries(list.map((p) => [p.name, p.portType]));
  const ins = ports(internalsOf(inner).ir.inputs);
  const outs = ports(
    internalsOf(inner).ir.outputs.filter((p) => !outputs || outputs.includes(p.name)),
  );
  const top = circuit(`T_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`, {
    inputs: ins,
    outputs: outs,
    nodes: { u: inner },
    connect: ({ inputs, outputs: o, nodes: { u } }) => {
      const sinks = u as unknown as Record<string, SinkPortRef>;
      const sources = u as unknown as Record<string, SourcePortRef>;
      return [
        ...Object.keys(ins).map((k) => inputs[k].to(sinks[k])),
        ...Object.keys(outs).map((k) => sources[k].to(o[k])),
      ];
    },
  });
  return target(top);
}

function example(id: string): DiffTarget {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`no example '${id}'`);
  const compiled = executeCircuitCode(ex.code);
  if (compiled.error) throw new Error(`${id}: ${compiled.error}`);
  return {
    top: compiled.circuits[compiled.circuits.length - 1],
    library: compiled.library,
  };
}

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

function imported(module: string): DiffTarget {
  const netlist = JSON.parse(fixture('imports.json')) as YosysNetlist;
  const { top, definitions, behaviors } = importNetlist(netlist, module);
  const deps = [...definitions.values()].filter((c) => c.name !== top.name);
  return target(buildFromIR(top, deps, behaviors));
}

const cases: Case[] = [];
const std = (name: string, inner: () => Circuit, extra: Omit<Case, 'name' | 'target'> = {}) =>
  cases.push({ name, target: () => wrap(name, inner()), ...extra });

// ── std combinational ───────────────────────────────────────────────────
for (const [n, c] of [
  ['And', And],
  ['Or', Or],
  ['Not', Not],
  ['Nand', Nand],
  ['Nor', Nor],
  ['Xor', Xor],
  ['Xnor', Xnor],
  ['Buffer', Buffer],
  ['FullAdder', FullAdder],
  ['Incrementer', Incrementer],
  ['Multiplier', Multiplier],
  ['SignedAdder', SignedAdder],
  ['SignedMultiplier', SignedMultiplier],
  ['Decoder', Decoder],
  ['NibbleSplitter', NibbleSplitter],
  ['AddressCombiner', AddressCombiner],
] as const) {
  std(n, () => c);
}

// Widths 1 to 32. Random operands at full width overflow the adders,
// subtractors and shifters on most cycles.
for (const w of [1, 8, 16, 32]) {
  std(`Adder w${w}`, () => Adder({ width: w }));
  std(`Mux w${w}`, () => Mux({ width: w }));
  std(`BusAnd w${w}`, () => BusAnd({ width: w }));
  std(`BusOr w${w}`, () => BusOr({ width: w }));
  std(`BusXor w${w}`, () => BusXor({ width: w }));
  std(`BusNot w${w}`, () => BusNot({ width: w }));
  std(`LogicNot w${w}`, () => LogicNot({ width: w }));
  std(`LogicOr w${w}`, () => LogicOr({ aWidth: w, bWidth: w }));
  std(`ReduceOr w${w}`, () => ReduceOr({ width: w }));
  std(`Register w${w}`, () => Register({ width: w, value: w === 1 ? 1 : 5 }));
}
std('LogicAnd w1', () => LogicAnd({ aWidth: 1, bWidth: 1 }));
for (const w of [8, 16, 32]) {
  std(`LogicAnd w${w}`, () => LogicAnd({ aWidth: w, bWidth: w }), { bug: BUG.logicalAnd });
  std(`Subtractor w${w}`, () => Subtractor({ width: w }));
  // The outputs the exporter drives; the all-ports cases below cover the rest.
  const cmp = `Comparator w${w}, eq/lt/gt`;
  cases.push({ name: cmp, target: () => wrap(cmp, Comparator({ width: w }), ['eq', 'lt', 'gt']) });
  const scmp = `SignedComparator w${w}, eq/lt/gt/lte/gte`;
  cases.push({
    name: scmp,
    target: () => wrap(scmp, SignedComparator({ width: w }), ['eq', 'lt', 'gt', 'lte', 'gte']),
  });
}
for (const w of [8, 16]) {
  std(`LeftShifter w${w}`, () => LeftShifter({ width: w }));
  std(`RightShifter w${w}`, () => RightShifter({ width: w }));
}
std('LeftShifter w32', () => LeftShifter({ width: 32 }));
std('RightShifter w32', () => RightShifter({ width: 32 }));
std('LeftShifter w32, shift < 32', () => LeftShifter({ width: 32 }), {
  opts: { inputMask: { shift: 31 } },
});
std('RightShifter w32, shift < 32', () => RightShifter({ width: 32 }), {
  opts: { inputMask: { shift: 31 } },
});
std('Comparator w8, all ports', () => Comparator({ width: 8 }), { bug: BUG.cmpPorts });
std('SignedComparator w8, all ports', () => SignedComparator({ width: 8 }), {
  bug: BUG.cmpPorts,
});
std('Splitter w4', () => Splitter({ width: 4 }));
std('Combiner w4', () => Combiner({ width: 4 }));
std('Concat 1+7', () => Concat({ hiWidth: 1, loWidth: 7 }));
std('Concat 16+16', () => Concat({ hiWidth: 16, loWidth: 16 }));
std('BitSlice 3..6', () => BitSlice({ low: 3, high: 6 }));
std('BitSlice 0..31', () => BitSlice({ low: 0, high: 31, width: 32 }));
std('SignExtend 4->16', () => SignExtend({ inWidth: 4, outWidth: 16 }));
std('SignExtend 16->32', () => SignExtend({ inWidth: 16, outWidth: 32 }));
std('ZeroExtend 4->16', () => ZeroExtend({ inWidth: 4, outWidth: 16 }));
std('Constant w8', () => Constant({ value: 0xa5, width: 8 }));
std('Constant w32', () => Constant({ value: 0xdeadbeef, width: 32 }));

// No exporter mapping at all: one case each, so a new mapping flips one.
std('BusXnor w8', () => BusXnor({ width: 8 }), { bug: BUG.noMapping });
std('ReduceAnd w8', () => ReduceAnd({ width: 8 }), { bug: BUG.noMapping });
std('ReduceXor w8', () => ReduceXor({ width: 8 }), { bug: BUG.noMapping });
std('ReduceXnor w8', () => ReduceXnor({ width: 8 }), { bug: BUG.noMapping });
std('WrappingMultiplier w8', () => WrappingMultiplier({ width: 8 }), { bug: BUG.noMapping });
std('SignedRightShifter w8', () => SignedRightShifter({ width: 8 }), { bug: BUG.noMapping });
std('Slice 8[2+:4]', () => Slice({ inWidth: 8, offset: 2, width: 4 }), { bug: BUG.noMapping });
std('DynamicSlice 32/5/8', () => DynamicSlice({ inWidth: 32, shiftWidth: 5, outWidth: 8 }), {
  bug: BUG.noMapping,
});
for (const [n, c] of [
  ['Divider', Divider],
  ['Modulo', Modulo],
  ['SignedDivider', SignedDivider],
  ['SignedModulo', SignedModulo],
] as const) {
  std(`${n} w8`, () => c({ width: 8 }), { opts: { nonZero: ['b'] }, bug: BUG.noMapping });
}

// ── std sequential and memory ───────────────────────────────────────────
// Reads stay inside the initialised range: an unwritten word is x in Verilog.
const bytes = (n: number) => Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff);
const record = (a: number[]) => Object.fromEntries(a.map((v, i) => [i, v]));
const low16 = { inputMask: { addr: 15 } };
std('DFlipFlop', () => DFlipFlop({ value: 1 }));
std('ROM, object contents', () => ROM({ memory: record(bytes(16)) }), { opts: low16 });
std('DualPortRAM 4x16, object contents', () =>
  DualPortRAM({ addressWidth: 4, dataWidth: 16, memory: record(bytes(16)) }),
);
std('ROM, romFromBytes contents', () => ROM({ memory: romFromBytes(bytes(16)) }), {
  opts: low16,
});
std('RAM, initial contents', () => RAM({ memory: record(bytes(16)) }), {
  opts: low16,
  bug: BUG.ramInit,
});
std('RAM, uninitialised', () => RAM(), { bug: BUG.xMemory });

// ── small composites ────────────────────────────────────────────────────
cases.push({
  name: 'Counter8',
  target: () =>
    target(
      circuit('Counter8', {
        inputs: { en: bit },
        outputs: { count: bus(8) },
        nodes: {
          r: Register({ width: 8 }),
          inc: Adder({ width: 8 }),
          one: Constant({ value: 1, width: 8 }),
        },
        connect: ({ inputs, outputs, nodes: { r, inc, one } }) => [
          r.q.to(inc.a, outputs.count),
          one.out.to(inc.b),
          inc.sum.to(r.data),
          inputs.en.to(r.we),
        ],
      }),
    ),
});
cases.push({
  name: 'Accumulator32',
  target: () =>
    target(
      circuit('Accumulator32', {
        inputs: { x: bus(32), we: bit, clear: bit },
        outputs: { acc: bus(32), carry: bit },
        nodes: { r: Register({ width: 32 }), add: Adder({ width: 32 }) },
        connect: ({ inputs, outputs, nodes: { r, add } }) => [
          r.q.to(add.a, outputs.acc),
          inputs.x.to(add.b),
          add.sum.to(r.data),
          add.carry_out.to(outputs.carry),
          inputs.we.to(r.we),
          inputs.clear.to(r.rst),
        ],
      }),
    ),
});
cases.push({
  name: 'ShiftChain3',
  target: () =>
    target(
      circuit('ShiftChain3', {
        inputs: { d: bit },
        outputs: { q0: bit, q1: bit, q2: bit },
        nodes: { a: DFlipFlop(), b: DFlipFlop(), c: DFlipFlop() },
        connect: ({ inputs, outputs, nodes: { a, b, c } }) => [
          inputs.d.to(a.d),
          a.q.to(b.d, outputs.q0),
          b.q.to(c.d, outputs.q1),
          c.q.to(outputs.q2),
        ],
      }),
    ),
});
cases.push({
  name: 'RippleAdder4',
  bug: BUG.combiner,
  target: () =>
    target(
      circuit('RippleAdder4', {
        inputs: { a: bus(4), b: bus(4), cin: bit },
        outputs: { sum: bus(4), cout: bit },
        nodes: {
          sa: Splitter({ width: 4 }),
          sb: Splitter({ width: 4 }),
          f0: FullAdder,
          f1: FullAdder,
          f2: FullAdder,
          f3: FullAdder,
          join: Combiner({ width: 4 }),
        },
        connect: ({ inputs, outputs, nodes: { sa, sb, f0, f1, f2, f3, join } }) => [
          inputs.a.to(sa.in),
          inputs.b.to(sb.in),
          inputs.cin.to(f0.carry_in),
          sa.bit0.to(f0.a),
          sb.bit0.to(f0.b),
          sa.bit1.to(f1.a),
          sb.bit1.to(f1.b),
          sa.bit2.to(f2.a),
          sb.bit2.to(f2.b),
          sa.bit3.to(f3.a),
          sb.bit3.to(f3.b),
          f0.carry_out.to(f1.carry_in),
          f1.carry_out.to(f2.carry_in),
          f2.carry_out.to(f3.carry_in),
          f0.sum.to(join.bit0),
          f1.sum.to(join.bit1),
          f2.sum.to(join.bit2),
          f3.sum.to(join.bit3),
          join.out.to(outputs.sum),
          f3.carry_out.to(outputs.cout),
        ],
      }),
    ),
});

// ── user eval / onTick, exported through eval-synth ─────────────────────
const evalCase = (name: string, built: Circuit, bug?: string) =>
  cases.push({ name, target: () => wrap(name, built), bug });

evalCase(
  'eval masked add w8',
  circuit('EvMaskedAdd', {
    inputs: { a: bus(8), b: bus(8) },
    outputs: { sum: bus(8) },
    eval: ({ a, b }) => ({ sum: (a + b) & 0xff }),
  }),
);
evalCase(
  'eval unmasked add w8',
  circuit('EvUnmaskedAdd', {
    inputs: { a: bus(8), b: bus(8) },
    outputs: { sum: bus(8) },
    eval: ({ a, b }) => ({ sum: a + b }),
  }),
);
evalCase(
  'eval && and ! on buses',
  circuit('EvLogical', {
    inputs: { a: bus(8), b: bus(8) },
    outputs: { both: bit, none: bit },
    eval: ({ a, b }) => ({ both: a && b ? 1 : 0, none: !a ? 1 : 0 }),
  }),
  BUG.logicalOps,
);
evalCase(
  'eval >> on 32 bits',
  circuit('EvSignedShift', {
    inputs: { a: bus(32) },
    outputs: { y: bus(32) },
    eval: ({ a }) => ({ y: a >> 3 }),
  }),
  BUG.signedShift,
);
evalCase(
  'onTick counter',
  circuit('EvCounter', {
    inputs: { en: bit },
    outputs: { count: bus(8) },
    state: { n: 0 },
    eval: ({ n }) => ({ count: n & 0xff }),
    onTick: ({ en, n }) => ({ n: en ? (n + 1) & 0xff : n }),
  }),
  BUG.onTickPorts,
);
evalCase(
  'onTick early return',
  circuit('EvEarlyReturn', {
    inputs: { en: bit },
    outputs: { count: bus(8) },
    state: { n: 0 },
    eval: ({ n }) => ({ count: n & 0xff }),
    onTick: ({ en, n }) => {
      if (!en) return { n };
      return { n: (n + 1) & 0xff };
    },
  }),
  BUG.onTickPorts,
);
evalCase(
  'onTick nonzero initial state',
  circuit('EvInitState', {
    inputs: { en: bit },
    outputs: { count: bus(8) },
    state: { n: 42 },
    eval: ({ n }) => ({ count: n & 0xff }),
    onTick: ({ en, n }) => ({ n: en ? (n + 1) & 0xff : n }),
  }),
  BUG.stateInit,
);

// ── bundled examples ────────────────────────────────────────────────────
// Not here: figlet (needs the editor's figlet global) and 6502-computer
// (uses Slice, which has no mapping; covered above).
for (const [id, cycles, bug] of [
  ['hack-alu', 200, undefined],
  ['fibonacci', 64, undefined],
  ['rule30', 64, undefined],
  ['half-adder', 32, BUG.switches],
  ['alu', 64, BUG.switches],
  ['tpu-3x3', 64, BUG.switches],
  ['snake', 200, BUG.switches],
  ['rv32i-computer', 300, BUG.dualPortRom],
] as const) {
  cases.push({ name: `example ${id}`, target: () => example(id), opts: { cycles }, bug });
}

// ── imported designs, against their source ──────────────────────────────
const source = fixture('imports.v');
cases.push({
  name: 'import acc',
  target: () => imported('acc'),
  reference: { verilog: source, module: 'acc', clock: 'clk' },
});
cases.push({
  name: 'import negedge_pipe',
  target: () => imported('negedge_pipe'),
  reference: { verilog: source, module: 'negedge_pipe', clock: 'clk' },
  bug: BUG.negedge,
});
cases.push({
  name: 'import wide_shift',
  target: () => imported('wide_shift'),
  reference: { verilog: source, module: 'wide_shift' },
  bug: BUG.shiftWidth,
});

// ── run ─────────────────────────────────────────────────────────────────
const available = hasIverilog();
if (!available && process.env.CI) {
  throw new Error('iverilog is not installed; the differential test has to run in CI');
}
const strict = !!process.env.DIFF_STRICT;
let ran = 0;

describe.skipIf(!available)('simulator vs iverilog', () => {
  afterAll(() => {
    const known = cases.filter((c) => c.bug).length;
    // In the CI log, so it's visible that the cases ran rather than skipped.
    console.log(
      `differential: ran ${ran} of ${cases.length} cases (${cases.length - known} must match, ${known} known bugs expected to fail)`,
    );
  });

  for (const c of cases) {
    const body = () => {
      ran++;
      const r = runDifferential(c.target(), { cycles: 128, seed: 1, ...c.opts }, c.reference);
      expect(r.mismatches, describeMismatches(r)).toEqual([]);
    };
    if (c.bug && !strict) it.fails(`${c.name} [${c.bug}]`, body);
    else it(c.name, body);
  }
});

if (!available) {
  describe('simulator vs iverilog', () => {
    it.skip('skipped: iverilog not on PATH (brew install icarus-verilog / apt install iverilog)');
  });
}
