/**
 * Yosys JSON netlist → simten Circuit IR.
 *
 * Consumes the JSON produced by:
 *   yosys -p "read_verilog x.v; hierarchy -top top; proc; opt_clean;
 *             memory_collect; write_json x.json"
 *
 * Emits one composite `Circuit` per module. Word-level `$` cells are lifted to
 * stdlib components where the mapping is exact (`$mux`→Mux, `$dff`→Register,
 * `$add`→Adder, `$eq`→Comparator); non-`$` cells reference sibling modules
 * (hierarchy). Bit-vector wiring is reconstructed via `segmentBits` into direct
 * connections plus `RtlSlice`/`RtlConcat2`/`Constant` nodes.
 *
 * Spike scope: only the cell types the demo fixture exercises. Unsupported
 * shapes throw rather than silently mis-lift. `$dff` CLK is dropped — every
 * register shares simten's single simulation clock (single-clock only).
 *
 * Follows auto-harness.ts: pure Circuit IR construction, no code execution.
 */

import type { BuiltCircuit } from '../circuit/types.js';
import { Dlatch, Mem, Pmux } from '../rtl/index.js';
import {
  Adder,
  BusAnd,
  BusNot,
  BusOr,
  BusXnor,
  BusXor,
  Comparator,
  Concat,
  Constant,
  Divider,
  DynamicSlice,
  LeftShifter,
  LogicAnd,
  LogicNot,
  LogicOr,
  Modulo,
  Mux,
  Not,
  ReduceAnd,
  ReduceOr,
  ReduceXnor,
  ReduceXor,
  Register,
  RightShifter,
  SignExtend,
  SignedComparator,
  SignedDivider,
  SignedModulo,
  SignedRightShifter,
  Slice,
  Subtractor,
  WrappingMultiplier,
  ZeroExtend,
} from '../std/index.js';
import type {
  ArgumentValue,
  Circuit,
  Connection,
  Node,
  PortDescriptor,
  PortInstance,
  PortType,
} from '../types/circuit.js';
import { bitType, busType } from '../types/circuit.js';
import { type BitDriver, type Segment, segmentBits, type YosysBit } from './net-map.js';

// ---------------------------------------------------------------------------
// Yosys JSON shape
// ---------------------------------------------------------------------------

interface YosysPort {
  direction: 'input' | 'output' | 'inout';
  bits: YosysBit[];
}
interface YosysCell {
  type: string;
  port_directions?: Record<string, 'input' | 'output' | 'inout'>;
  connections: Record<string, YosysBit[]>;
  parameters?: Record<string, string | number>;
  /** Emitted by `write_json` for every cell. `src` is "file:line.col-line.col",
   *  which is how a lifted node can be pointed back at the RTL that produced it. */
  attributes?: Record<string, string>;
  /** 0 when the instance was named in the source, 1 when yosys invented the
   *  name (`$add$serv_alu.v:45$774`). Only the invented ones get renamed after
   *  the signal they drive — an instance the author named already reads well. */
  hide_name?: 0 | 1;
}
interface YosysModule {
  ports: Record<string, YosysPort>;
  cells: Record<string, YosysCell>;
  /** Signal names for nets. Always emitted by `write_json`; used to name
   *  signals in diagnostics and to name the nodes that drive them. Optional so
   *  a hand-built netlist still parses.
   *
   *  `hide_name` is 0 for a name that came from the RTL and 1 for one yosys
   *  invented while flattening — the distinction that makes this worth reading:
   *  `serv_alu` has 41 nets and 24 real names among them. */
  netnames?: Record<string, { bits: (number | string)[]; hide_name?: 0 | 1 }>;
}
export interface YosysNetlist {
  modules: Record<string, YosysModule>;
}

const portTypeOf = (width: number): PortType => (width === 1 ? bitType() : busType(width));

/** Parse a yosys parameter (binary string or number) to an integer. */
function param(cell: YosysCell, name: string): number {
  const v = cell.parameters?.[name];
  if (v === undefined) throw new Error(`${cell.type}: missing parameter ${name}`);
  return typeof v === 'number' ? v : parseInt(v, 2);
}

// ---------------------------------------------------------------------------
// Lift table — $cell → stdlib component
// ---------------------------------------------------------------------------

interface LiftRule {
  /** Guard — this rule applies only if `when` is absent or returns true.
   *  Rules are tried in order (first match wins), so put the specific
   *  (lift-to-stdlib) rule before the general (rtl-primitive) fallback. */
  when?: (cell: YosysCell) => boolean;
  /** Build the component instance from the cell's parameters. */
  comp: (cell: YosysCell) => BuiltCircuit;
  /** cell input port → component input port. */
  inMap: Record<string, string>;
  /** cell output port → component output port. */
  outMap: Record<string, string>;
  /** component input ports tied to a constant. */
  tie?: Record<string, number>;
  /** does this component carry simten's implicit clock? */
  sequential?: boolean;
  /**
   * Adapt each operand to the component's port width before connecting: narrow
   * operands are `ZeroExtend`/`SignExtend`-ed (per `<PORT>_SIGNED`), wide ones
   * `Slice`-truncated. Lets a symmetric stdlib component (Adder/BusAnd/…) at
   * `Y_WIDTH` cover yosys's independent A/B/Y widths with no `Rtl*` fallback —
   * correct because add/sub/bitwise depend only on the low `Y_WIDTH` bits.
   */
  adaptOperands?: boolean;
  /** Explicit node arguments (shape) to store, for import-namespace primitives
   *  whose `circuit()` config form doesn't carry `_args` (e.g. Dlatch). Lets the
   *  serializer emit a factory call `Dlatch({ width, enPolarity })`. */
  nodeArgs?: (cell: YosysCell) => Record<string, number>;
}

// A/B/Y width bundle and signedness — read straight off the cell parameters.

/** binary A,B → Y (rtl primitive). */
const bin = (comp: (c: YosysCell) => BuiltCircuit): LiftRule[] => [
  { comp, inMap: { A: 'a', B: 'b' }, outMap: { Y: 'out' } },
];
/** unary A → Y (rtl primitive). */
const un = (comp: (c: YosysCell) => BuiltCircuit): LiftRule[] => [
  { comp, inMap: { A: 'a' }, outMap: { Y: 'out' } },
];

/** A ⋚ B → one comparator flag. Signed iff both operands are signed; operands
 *  adapt to max(A,B) width. Y maps to the requested flag (eq/ne/lt/le/gt/ge). */
const cmp = (flag: string): LiftRule[] => [
  {
    comp: (c) => {
      const width = Math.max(param(c, 'A_WIDTH'), param(c, 'B_WIDTH'));
      return param(c, 'A_SIGNED') && param(c, 'B_SIGNED')
        ? SignedComparator({ width })
        : Comparator({ width });
    },
    inMap: { A: 'a', B: 'b' },
    outMap: { Y: flag },
    adaptOperands: true,
  },
];

const LIFT: Record<string, LiftRule[]> = {
  // Arithmetic → stdlib at Y_WIDTH with operand adaptation (independent A/B/Y
  // widths handled by ZeroExtend/SignExtend/Slice, never an Rtl* fallback).
  $add: [
    {
      comp: (c) => Adder({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'sum' },
      tie: { carry_in: 0 },
      adaptOperands: true,
    },
  ],
  $sub: [
    {
      comp: (c) => Subtractor({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'difference' },
      tie: { borrow_in: 0 },
      adaptOperands: true,
    },
  ],
  // comparisons → Comparator (unsigned) / SignedComparator (both operands
  // signed), at max(A,B) width with operand adaptation; Y maps to the flag.
  $eq: cmp('eq'),
  $ne: cmp('ne'),
  $lt: cmp('lt'),
  $le: cmp('le'),
  $gt: cmp('gt'),
  $ge: cmp('ge'),
  $mux: [
    {
      comp: (c) => Mux({ width: param(c, 'WIDTH') }),
      inMap: { A: 'in0', B: 'in1', S: 'sel' },
      outMap: { Y: 'out' },
    },
  ],
  $dff: [
    {
      comp: (c) => Register({ width: param(c, 'WIDTH') }),
      inMap: { D: 'data' }, // CLK intentionally dropped (single sim clock)
      outMap: { Q: 'q' },
      tie: { we: 1 },
      sequential: true,
    },
  ],
  $dlatch: [
    {
      comp: (c) => Dlatch({ width: param(c, 'WIDTH'), enPolarity: param(c, 'EN_POLARITY') }),
      inMap: { D: 'd', EN: 'en' },
      outMap: { Q: 'q' },
      sequential: true,
      nodeArgs: (c) => ({ width: param(c, 'WIDTH'), enPolarity: param(c, 'EN_POLARITY') }),
    },
  ],

  // bitwise → stdlib Bus ops at Y_WIDTH with operand adaptation
  $and: [
    {
      comp: (c) => BusAnd({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'out' },
      adaptOperands: true,
    },
  ],
  $or: [
    {
      comp: (c) => BusOr({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'out' },
      adaptOperands: true,
    },
  ],
  $xor: [
    {
      comp: (c) => BusXor({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'out' },
      adaptOperands: true,
    },
  ],
  $xnor: [
    {
      comp: (c) => BusXnor({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'out' },
      adaptOperands: true,
    },
  ],
  $not: [
    {
      comp: (c) => BusNot({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'in' },
      outMap: { Y: 'out' },
      adaptOperands: true,
    },
  ],

  // reductions → stdlib bus→bit (reduce_bool ≡ reduce_or: both are `a != 0`)
  $reduce_or: un((c) => ReduceOr({ width: param(c, 'A_WIDTH') })),
  $reduce_bool: un((c) => ReduceOr({ width: param(c, 'A_WIDTH') })),
  $reduce_and: un((c) => ReduceAnd({ width: param(c, 'A_WIDTH') })),
  $reduce_xor: un((c) => ReduceXor({ width: param(c, 'A_WIDTH') })),
  $reduce_xnor: un((c) => ReduceXnor({ width: param(c, 'A_WIDTH') })),

  // logical → stdlib bus→bit
  $logic_and: bin((c) => LogicAnd({ aWidth: param(c, 'A_WIDTH'), bWidth: param(c, 'B_WIDTH') })),
  $logic_or: bin((c) => LogicOr({ aWidth: param(c, 'A_WIDTH'), bWidth: param(c, 'B_WIDTH') })),
  $logic_not: un((c) => LogicNot({ width: param(c, 'A_WIDTH') })),

  // $mul → wrapping multiply at Y_WIDTH (operands adapted per signedness).
  $mul: [
    {
      comp: (c) => WrappingMultiplier({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'out' },
      adaptOperands: true,
    },
  ],
  // $div / $mod → divider/modulo at Y_WIDTH (signed iff both operands signed).
  // yosys computes arithmetic at Y_WIDTH ≥ operand widths, so operand adaptation
  // only zero/sign-extends (value-preserving) — safe for divide/remainder.
  $div: [
    {
      comp: (c) =>
        param(c, 'A_SIGNED') && param(c, 'B_SIGNED')
          ? SignedDivider({ width: param(c, 'Y_WIDTH') })
          : Divider({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'out' },
      adaptOperands: true,
    },
  ],
  $mod: [
    {
      comp: (c) =>
        param(c, 'A_SIGNED') && param(c, 'B_SIGNED')
          ? SignedModulo({ width: param(c, 'Y_WIDTH') })
          : Modulo({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'out' },
      adaptOperands: true,
    },
  ],
  // $shiftx → dynamic part-select in[shift +: Y_WIDTH] (ports sized to A/B/Y).
  $shiftx: [
    {
      comp: (c) =>
        DynamicSlice({
          inWidth: param(c, 'A_WIDTH'),
          shiftWidth: param(c, 'B_WIDTH'),
          outWidth: param(c, 'Y_WIDTH'),
        }),
      inMap: { A: 'in', B: 'shift' },
      outMap: { Y: 'out' },
    },
  ],

  // shifts → stdlib shifters at Y_WIDTH; value/shift adapted (shift is unsigned,
  // value per A_SIGNED). $sshr is the arithmetic (sign-replicating) right shift.
  $shl: [
    {
      comp: (c) => LeftShifter({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'value', B: 'shift' },
      outMap: { Y: 'result' },
      adaptOperands: true,
    },
  ],
  $shr: [
    {
      comp: (c) => RightShifter({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'value', B: 'shift' },
      outMap: { Y: 'result' },
      adaptOperands: true,
    },
  ],
  $sshr: [
    {
      comp: (c) => SignedRightShifter({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'value', B: 'shift' },
      outMap: { Y: 'result' },
      adaptOperands: true,
    },
  ],

  // $pmux is handled specially (per-lane candidate ports) — see translateModule.
};

/** First rule whose `when` guard passes (first match wins). */
function pickRule(cell: YosysCell): LiftRule | undefined {
  const rules = LIFT[cell.type];
  if (!rules) return undefined;
  return rules.find((r) => !r.when || r.when(cell));
}

// $mem_v2 shape and the per-lane sub-array of a packed connection.
const memLayout = (c: YosysCell) => ({
  rdPorts: param(c, 'RD_PORTS'),
  wrPorts: param(c, 'WR_PORTS'),
  abits: param(c, 'ABITS'),
  width: param(c, 'WIDTH'),
  size: param(c, 'SIZE'),
});
const lane = (bits: YosysBit[] | undefined, i: number, w: number): YosysBit[] =>
  (bits ?? []).slice(i * w, (i + 1) * w);

/**
 * Parse a yosys `$mem_v2` INIT parameter into a sparse `{ addr: value }` map
 * (the format sequential-init overlays onto a memory state block). yosys packs
 * the init as a `SIZE*WIDTH` bit-string with **word 0 at the rightmost end**,
 * MSB-first within each word; `x` bits resolve to 0 (2-state). Only non-zero
 * words are stored. This applies ROM/`$readmemh` contents on import so an
 * imported CPU boots its real program instead of empty memory.
 */
function parseMemInit(
  cell: YosysCell,
  size: number,
  width: number,
): Record<number, number> | undefined {
  const init = cell.parameters?.INIT;
  if (typeof init !== 'string' || init.length === 0 || width > 32) return undefined;
  const offset = cell.parameters?.OFFSET !== undefined ? param(cell, 'OFFSET') : 0;
  const total = size * width;
  const s = init.length < total ? init.padStart(total, '0') : init;
  const out: Record<number, number> = {};
  for (let a = 0; a < size; a++) {
    const end = total - a * width;
    const start = end - width;
    if (start < 0) break;
    let v = 0;
    for (let i = start; i < end; i++) v = v * 2 + (s[i] === '1' ? 1 : 0);
    v = v >>> 0;
    if (v !== 0) out[a + offset] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Cell output ports, by directions if present else a known-output fallback. */
const KNOWN_OUTPUTS = new Set(['Y', 'Q', 'CO', 'X', 'dout', 'out']);
function cellOutputPorts(cell: YosysCell, subOutputs?: Set<string>): Set<string> {
  if (cell.port_directions) {
    return new Set(
      Object.entries(cell.port_directions)
        .filter(([, d]) => d === 'output')
        .map(([p]) => p),
    );
  }
  if (subOutputs) return subOutputs;
  return new Set(Object.keys(cell.connections).filter((p) => KNOWN_OUTPUTS.has(p)));
}

// ---------------------------------------------------------------------------
// Sign/zero-extension recognition (clean reconstruction, Workstream B1)
// ---------------------------------------------------------------------------

type NetSegment = Extract<Segment, { kind: 'net' }>;
interface ExtInfo {
  base: NetSegment;
  kind: 'sign' | 'zero';
  toWidth: number;
}

/**
 * Recognize a widening: a single net run followed only by its high padding.
 * yosys lowers `$signed` widening into MSB replication (the run's top bit,
 * `offset+width-1`, repeated 1 bit at a time) and unsigned widening into a
 * constant-zero pad. Either collapses to one `SignExtend`/`ZeroExtend` node
 * instead of a slice + N×concat chain. Anything else (a genuine multi-field
 * concat) returns null and folds normally.
 */
function detectExtension(segs: Segment[]): ExtInfo | null {
  if (segs.length < 2) return null;
  const base = segs[0];
  if (base.kind !== 'net') return null;
  const rest = segs.slice(1);

  // zero-extension: the high segments are all constant 0
  if (rest.every((s) => s.kind === 'const' && s.value === 0)) {
    const pad = rest.reduce((a, s) => a + s.width, 0);
    return { base, kind: 'zero', toWidth: base.width + pad };
  }

  // sign-extension: the high bits replicate the run's MSB, one bit at a time
  const msb = base.offset + base.width - 1;
  const isMsbRepeat = rest.every(
    (s) =>
      s.kind === 'net' &&
      s.width === 1 &&
      s.nodeId === base.nodeId &&
      s.portName === base.portName &&
      s.offset === msb,
  );
  if (isMsbRepeat) return { base, kind: 'sign', toWidth: base.width + rest.length };

  return null;
}

// ---------------------------------------------------------------------------
// Node-id sanitization (Known hard problems #1)
// ---------------------------------------------------------------------------

/**
 * Turn a yosys id (`$add$demo.v:33$2`, `$procdff$5`, `\genblk[0].u`, `u_sub`)
 * into a valid, unique JS identifier — used as a node id and in `nodes.<id>.<port>`
 * refs by the serializer. Uniqueness is **guaranteed** (a counter suffix on
 * collision); readability is best-effort (the op token and source line are kept).
 * Sanitized cell ids never start with `_`, keeping them disjoint from the
 * importer's `_k`/`_s`/`_c`/`_x` helper ids so the two id spaces cannot collide.
 *
 * Run this AFTER any matcher that keys on the raw id (parameter sets, memory
 * names) — sanitizing first would destroy that semantic information.
 */
function makeIdSanitizer(): (raw: string) => string {
  const used = new Set<string>();
  return (raw: string): string => {
    let s = raw.replace(/^\\/, ''); // strip yosys public-name backslash
    if (s.startsWith('$')) {
      // auto-generated `$<op>$<file>:<line>$<serial>` — keep op (+ source line)
      const parts = s.split('$').filter(Boolean);
      const op = parts[0] ?? 'n';
      const line = parts
        .slice(1)
        .join('$')
        .match(/:(\d+)/)?.[1];
      s = line ? `${op}_${line}` : op;
    }
    s = s
      .replace(/[^A-Za-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!s) s = 'n';
    if (/^[0-9]/.test(s)) s = `n_${s}`;
    let id = s;
    for (let k = 2; used.has(id); k++) id = `${s}_${k}`;
    used.add(id);
    return id;
  };
}

// ---------------------------------------------------------------------------
// Node construction from a BuiltCircuit (harvest exact port descriptors)
// ---------------------------------------------------------------------------

function instancesFrom(descs: readonly PortDescriptor[], nodeId: string): PortInstance[] {
  return descs.map((p) => ({ id: `${nodeId}.${p.name}`, name: p.name, portType: p.portType }));
}

/** Width of a built component's input port (1 for a bit port). */
function portWidth(built: BuiltCircuit, portName: string): number {
  const p = built.circuit.inputs.find((d) => d.name === portName);
  if (!p) throw new Error(`${built.circuit.name}: no input port '${portName}'`);
  return p.portType.kind === 'bus' ? p.portType.width : 1;
}

function nodeFromBuilt(id: string, built: BuiltCircuit, args: Record<string, ArgumentValue>): Node {
  const c = built.circuit;
  return {
    id,
    componentRef: c.name,
    arguments: { ...built._args, ...args },
    inputs: instancesFrom(c.inputs, id),
    outputs: instancesFrom(c.outputs, id),
    clocks: c.clocks.map((ck) => ({ id: `${id}.${ck.name}`, name: ck.name })),
  };
}

/** Collect a BuiltCircuit's circuit + transitive dependency circuits. */
function collectDeps(built: BuiltCircuit, into: Map<string, Circuit>): void {
  if (!into.has(built.circuit.name)) into.set(built.circuit.name, built.circuit);
  for (const [, dep] of built._dependencies) collectDeps(dep, into);
}

// ---------------------------------------------------------------------------
// Per-module translation
// ---------------------------------------------------------------------------

interface ModuleShape {
  inputs: PortDescriptor[];
  outputs: PortDescriptor[];
  sequential: boolean;
  /** Input ports dropped as clock-only (see `moduleShapes`). */
  clockPorts: string[];
}

const DFF_FAMILY = new Set(['$dff', '$adff', '$sdff', '$dffe']);

/**
 * Reject flip-flops driven by a clock this model cannot represent.
 *
 * simten has exactly one implicit clock: every stateful primitive subscribes to
 * it the moment it declares state, and clocks are never wired, so `$dff` CLK is
 * always dropped. That is sound when CLK is the module's own clock port and
 * unsound otherwise — a flip-flop clocked by a *data* signal (a clock divider's
 * `div[15]`, the previous stage of a ripple counter, a gated clock) would have
 * its clock silently discarded and end up latching on the main clock instead.
 * The result imports cleanly and simulates as a different circuit: a 4-bit
 * ripple counter becomes four flip-flops toggling together, counting 0, 15, 0.
 *
 * Silently mis-lifting is the one outcome this importer refuses everywhere else
 * (unsupported cell types throw), so derived clocks throw too. The message names
 * the signal and points at the clock-enable rewrite, which is what synchronous
 * design methodology prescribes anyway.
 */
function assertSingleClockDomain(moduleName: string, mod: YosysModule, shape: ModuleShape): void {
  const clockBits = new Set<number>();
  for (const portName of shape.clockPorts) {
    for (const b of mod.ports[portName]?.bits ?? []) {
      if (typeof b === 'number') clockBits.add(b);
    }
  }

  const nameOfBit = new Map<number, string>();
  for (const [signal, info] of Object.entries(mod.netnames ?? {})) {
    info.bits.forEach((b, i) => {
      if (typeof b !== 'number' || nameOfBit.has(b)) return;
      nameOfBit.set(b, info.bits.length > 1 ? `${signal}[${i}]` : signal);
    });
  }

  for (const [cellName, cell] of Object.entries(mod.cells)) {
    if (!DFF_FAMILY.has(cell.type)) continue;
    const derived = (cell.connections.CLK ?? []).filter(
      (b) => typeof b !== 'number' || !clockBits.has(b),
    );
    if (derived.length === 0) continue;

    const clockSignal = typeof derived[0] === 'number' ? nameOfBit.get(derived[0]) : undefined;
    const target =
      (cell.connections.Q ?? [])
        .map((b) => (typeof b === 'number' ? nameOfBit.get(b) : undefined))
        .find(Boolean) ?? cellName;

    throw new Error(
      `Module '${moduleName}': flip-flop '${target}' is clocked by ` +
        `${clockSignal ? `'${clockSignal}'` : 'a derived signal'}, not by the module's clock. ` +
        `simten models a single synchronous clock domain — every register advances on the same ` +
        `tick() and clocks are never wired — so a derived clock (clock divider, ripple counter, ` +
        `gated clock) cannot be represented. Rewrite it in the one clock domain using a clock ` +
        `enable: register the derived signal, detect its rising edge, and gate the assignment ` +
        `with that pulse under 'always @(posedge clk)'.`,
    );
  }
}

/** Is `pin` on `cellType` a clock input we drop (never wire)? */
function isClockPin(
  cellType: string,
  pin: string,
  clockPortsByModule: Map<string, Set<string>>,
): boolean {
  if (cellType === '$dff' || cellType === '$adff' || cellType === '$sdff' || cellType === '$dffe')
    return pin === 'CLK';
  if (cellType === '$mem' || cellType === '$mem_v2') return pin === 'RD_CLK' || pin === 'WR_CLK';
  // Submodule instance: clock iff the child module identified this port as one.
  return clockPortsByModule.get(cellType)?.has(pin) ?? false;
}

/**
 * First pass: derive each module's port interface (needed for cross-refs).
 *
 * Clock-only input ports are dropped here. simten sequential primitives run on a
 * single implicit clock (`$dff` CLK is never lifted — every Register shares it),
 * so a top-level clock port carries no signal: it lands as a dangling input and,
 * worse, collides with the `clk` the Verilog exporter re-adds on round-trip. A
 * port is clock-only when every consumer of its net is a clock pin (`$dff`-family
 * CLK, memory RD/WR_CLK, or a sequential submodule's own clock port) — computed
 * to a fixpoint so submodule clock ports propagate up the hierarchy. Reset ports
 * survive: their nets feed `Register.rst`/`Not`/`Mux.sel`, not clock pins. A net
 * with any non-clock sink (e.g. a gated clock, or a feedthrough to an output)
 * stays too.
 */
function moduleShapes(netlist: YosysNetlist): Map<string, ModuleShape> {
  const shapes = new Map<string, ModuleShape>();
  for (const [name, mod] of Object.entries(netlist.modules)) {
    const inputs: PortDescriptor[] = [];
    const outputs: PortDescriptor[] = [];
    for (const [pn, p] of Object.entries(mod.ports)) {
      const desc: PortDescriptor = { name: pn, portType: portTypeOf(p.bits.length) };
      if (p.direction === 'input') inputs.push(desc);
      else outputs.push(desc); // treat inout as output for the spike
    }
    const sequential = Object.values(mod.cells).some(
      (c) =>
        c.type === '$dff' ||
        c.type === '$adff' ||
        c.type === '$sdff' ||
        c.type === '$dffe' ||
        c.type === '$dlatch' ||
        c.type === '$mem_v2' ||
        (netlist.modules[c.type] && shapes.get(c.type)?.sequential),
    );
    shapes.set(name, { inputs, outputs, sequential, clockPorts: [] });
  }

  // Per-module: which cell pins consume each input port's net, and whether the
  // net also drives a module output (a feedthrough → never clock-only). Built
  // once; the fixpoint below only re-checks the clock verdict of each consumer.
  type Consumer = { cellType: string; pin: string };
  const analysis = new Map<
    string,
    { consumers: Map<string, Consumer[]>; feedsOutput: Set<string> }
  >();
  for (const [name, mod] of Object.entries(netlist.modules)) {
    const bitConsumers = new Map<number, Consumer[]>();
    for (const cell of Object.values(mod.cells)) {
      for (const [pin, bits] of Object.entries(cell.connections)) {
        for (const b of bits) {
          if (typeof b !== 'number') continue;
          let list = bitConsumers.get(b);
          if (!list) {
            list = [];
            bitConsumers.set(b, list);
          }
          list.push({ cellType: cell.type, pin });
        }
      }
    }
    const outputBits = new Set<number>();
    for (const p of Object.values(mod.ports)) {
      if (p.direction === 'input') continue;
      for (const b of p.bits) if (typeof b === 'number') outputBits.add(b);
    }
    const consumers = new Map<string, Consumer[]>();
    const feedsOutput = new Set<string>();
    for (const [pn, p] of Object.entries(mod.ports)) {
      if (p.direction !== 'input') continue;
      const acc: Consumer[] = [];
      for (const b of p.bits) {
        if (typeof b !== 'number') continue;
        const list = bitConsumers.get(b);
        if (list) acc.push(...list);
        if (outputBits.has(b)) feedsOutput.add(pn);
      }
      consumers.set(pn, acc);
    }
    analysis.set(name, { consumers, feedsOutput });
  }

  // Fixpoint: a submodule's clock ports aren't known until the child is resolved,
  // so iterate until no module gains a new clock port.
  const clockPortsByModule = new Map<string, Set<string>>(
    Object.keys(netlist.modules).map((n) => [n, new Set<string>()]),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of Object.keys(netlist.modules)) {
      const { consumers, feedsOutput } = analysis.get(name)!;
      const cp = clockPortsByModule.get(name)!;
      for (const [pn, cons] of consumers) {
        if (cp.has(pn) || feedsOutput.has(pn) || cons.length === 0) continue;
        if (cons.every((c) => isClockPin(c.cellType, c.pin, clockPortsByModule))) {
          cp.add(pn);
          changed = true;
        }
      }
    }
  }

  // Drop the clock-only ports from each module's input interface.
  for (const [name, shape] of shapes) {
    const cp = clockPortsByModule.get(name)!;
    if (cp.size === 0) continue;
    shape.clockPorts = [...cp];
    shape.inputs = shape.inputs.filter((d) => !cp.has(d.name));
  }
  return shapes;
}

/**
 * Rename yosys-invented cells after the RTL signal they drive.
 *
 * Drilling into an imported design used to land on `add_45`, `_k17`, `mux_92` —
 * names derived from the operator and the source line, which say what a node is
 * but nothing about what it means. The netlist already carries better ones:
 * yosys records every net's source name in `netnames` with `hide_name: 0`, and
 * `serv_alu` has 24 of them against 17 invented — including every label in
 * SERV's own block diagram (`result_add`, `result_lt`, `add_cy`, `cmp_r`,
 * `rs1_sx`, `op_b_sx`). Naming a node after its output net is how a reader
 * thinks about it anyway: the adder that produces `result_add`.
 *
 * Two rules keep this from making things worse:
 *
 * - Only cells yosys named itself (`hide_name: 1`) are renamed. A submodule
 *   instance the author called `cpu` keeps `cpu` — it is already the better
 *   name, and overwriting it with whatever net it happens to drive would lose
 *   the RTL's own hierarchy labels.
 * - The whole output port must belong to one named net. A cell driving half of
 *   `result_add` is not `result_add`, and saying so would be a lie a reader
 *   can't check.
 *
 * Returns raw cell name → preferred name, for cells that have one. Everything
 * else falls through to the existing operator-and-line naming.
 */
function rtlSignalNames(mod: YosysModule): Map<string, string> {
  // Net bit → the source-level signal it belongs to, plus each signal's full
  // bit set. First name wins, matching how diagnostics resolve a bit already.
  const nameOfBit = new Map<number, string>();
  const bitsOfSignal = new Map<string, number[]>();
  for (const [signal, info] of Object.entries(mod.netnames ?? {})) {
    if (info.hide_name === 1) continue;
    const owned: number[] = [];
    for (const b of info.bits) {
      if (typeof b !== 'number' || nameOfBit.has(b)) continue;
      nameOfBit.set(b, signal);
      owned.push(b);
    }
    if (owned.length > 0) bitsOfSignal.set(signal, owned);
  }
  if (nameOfBit.size === 0) return new Map();

  const preferred = new Map<string, string>();
  for (const [cellName, cell] of Object.entries(mod.cells)) {
    if (cell.hide_name !== 1) continue;
    const outputs = Object.entries(cell.port_directions ?? {}).filter(
      ([, dir]) => dir === 'output',
    );
    if (outputs.length !== 1) continue; // ambiguous: which net would name it?

    const bits = cell.connections[outputs[0][0]] ?? [];
    const driven = new Set(bits.filter((b): b is number => typeof b === 'number'));
    if (bits.length === 0 || driven.size !== bits.length) continue;

    // Every bit named, and every signal touched driven here in full — otherwise
    // the name claims more than the node does.
    const signals = new Set<string>();
    for (const b of driven) {
      const signal = nameOfBit.get(b);
      if (signal === undefined) break;
      signals.add(signal);
    }
    if (signals.size === 0 || [...driven].some((b) => !nameOfBit.has(b))) continue;
    const whole = [...signals].every((sig) =>
      (bitsOfSignal.get(sig) ?? []).every((b) => driven.has(b)),
    );
    if (!whole) continue;

    // Bit 0 is the value; a higher bit is the carry or flag riding along with
    // it, as in `{add_cy, result_add} = a + b`.
    const lsb = typeof bits[0] === 'number' ? nameOfBit.get(bits[0]) : undefined;
    if (lsb !== undefined) preferred.set(cellName, lsb);
  }
  return preferred;
}

/**
 * Human-readable source location for a cell, from yosys's `src` attribute.
 *
 * The raw value is an absolute path inside the synth container's scratch dir
 * plus a column span — "/tmp/synth/de8285ed/dut.v:4278.7-4285.10". Neither the
 * server's temp path nor the columns mean anything to the user, and the path is
 * an internal detail that should not reach a browser, so keep basename + line.
 */
function sourceRef(cell: YosysCell): string | undefined {
  const src = cell.attributes?.src;
  if (!src) return undefined;
  const first = src.split('|')[0]; // yosys joins multiple spans with '|'
  const base = first.slice(first.lastIndexOf('/') + 1);
  return base.replace(/\.\d+(-\d+\.\d+)?$/, '');
}

function translateModule(
  name: string,
  mod: YosysModule,
  shapes: Map<string, ModuleShape>,
  netlist: YosysNetlist,
  libDeps: Map<string, Circuit>,
  moduleNameOf: (raw: string) => string,
  warnings: string[],
): Circuit {
  const shape = shapes.get(name)!;
  assertSingleClockDomain(name, mod, shape);

  const nodes: Node[] = [];
  const connections: Connection[] = [];
  let helperId = 0;
  let connId = 0;

  /** Create a node from a BuiltCircuit and register its dependency circuits. */
  const pushBuilt = (
    id: string,
    built: BuiltCircuit,
    args: Record<string, ArgumentValue>,
  ): void => {
    collectDeps(built, libDeps);
    nodes.push(nodeFromBuilt(id, built, args));
  };

  // Sanitize every cell name → a valid, unique node id up front (before the
  // driver map), so the driver map and every connection/node ref use the same
  // clean id. `nid` maps a raw yosys cell name to its sanitized node id.
  //
  // Cells yosys named itself are renamed after the RTL signal they drive, so
  // the canvas reads `result_add` instead of `add_45`. See rtlSignalNames.
  const idOf = makeIdSanitizer();
  const preferredName = rtlSignalNames(mod);
  const cellId = new Map<string, string>(
    Object.keys(mod.cells).map((cn) => [cn, idOf(preferredName.get(cn) ?? cn)]),
  );
  const nid = (cn: string) => cellId.get(cn) ?? cn;

  // --- driver map: bit id → who drives it -------------------------------
  const drivers = new Map<number, BitDriver>();
  const sourceWidth = new Map<string, number>(); // `${nodeId}\0${port}` → width
  const key = (nodeId: string, port: string) => `${nodeId}\0${port}`;

  // module inputs are drivers (nodeId '')
  for (const [pn, p] of Object.entries(mod.ports)) {
    if (p.direction === 'input') {
      sourceWidth.set(key('', pn), p.bits.length);
      p.bits.forEach((b, idx) => {
        if (typeof b === 'number') drivers.set(b, { nodeId: '', portName: pn, index: idx });
      });
    }
  }
  // cell outputs are drivers. Port names are recorded in SIMTEN terms:
  // lifted cells rename yosys output ports (Y→sum, Q→q…) via outMap; submodule
  // ports keep their names.
  for (const [cn, cell] of Object.entries(mod.cells)) {
    const id = nid(cn);
    if (cell.type === '$mem_v2') {
      // each read port drives a WIDTH-bit lane of the packed RD_DATA output
      const { rdPorts, width } = memLayout(cell);
      for (let i = 0; i < rdPorts; i++) {
        const port = `rd_data_${i}`;
        sourceWidth.set(key(id, port), width);
        lane(cell.connections.RD_DATA, i, width).forEach((b, j) => {
          if (typeof b === 'number') drivers.set(b, { nodeId: id, portName: port, index: j });
        });
      }
      continue;
    }
    if (cell.type === '$pmux') {
      // Y output (WIDTH bits) is driven by RtlPmux.out
      const w = param(cell, 'WIDTH');
      sourceWidth.set(key(id, 'out'), w);
      (cell.connections.Y ?? []).forEach((b, j) => {
        if (typeof b === 'number') drivers.set(b, { nodeId: id, portName: 'out', index: j });
      });
      continue;
    }
    if (cell.type === '$adff' || cell.type === '$sdff' || cell.type === '$dffe') {
      // reset/enable flip-flops lift to a Register; Q is driven by the reg's q.
      const w = param(cell, 'WIDTH');
      sourceWidth.set(key(id, 'q'), w);
      (cell.connections.Q ?? []).forEach((b, j) => {
        if (typeof b === 'number') drivers.set(b, { nodeId: id, portName: 'q', index: j });
      });
      continue;
    }
    const isSub = !!netlist.modules[cell.type];
    const subOut = isSub ? new Set(shapes.get(cell.type)!.outputs.map((o) => o.name)) : undefined;
    const outs = cellOutputPorts(cell, subOut);
    const outMap = isSub ? undefined : pickRule(cell)?.outMap;
    const rename = (yPort: string) => (isSub ? yPort : (outMap?.[yPort] ?? yPort));
    for (const [pn, bits] of Object.entries(cell.connections)) {
      if (!outs.has(pn)) continue;
      const sPort = rename(pn);
      sourceWidth.set(key(id, sPort), bits.length);
      bits.forEach((b, idx) => {
        if (typeof b === 'number') drivers.set(b, { nodeId: id, portName: sPort, index: idx });
      });
    }
  }
  const driverOf = (net: number): BitDriver => {
    const d = drivers.get(net);
    if (d) return d;
    // Undriven net: tie to 0 and continue rather than hard-failing. This is
    // simten's 2-state analog of how yosys/iverilog tolerate an undriven wire
    // (x/z) — usually an unassigned or misspelled signal in the source. Register
    // the tie so repeat reads reuse it (and the warning fires once per net).
    const id = `_u${helperId++}`;
    pushBuilt(id, Constant({ width: 1, value: 0 }), { width: 1, value: 0 });
    const tie: BitDriver = { nodeId: id, portName: 'out', index: 0 };
    drivers.set(net, tie);
    sourceWidth.set(key(id, 'out'), 1);
    warnings.push(`${name}: an undriven net was tied to 0 (an unassigned or misspelled signal)`);
    return tie;
  };

  // --- resolve a bit vector to a single {nodeId, portName} source -------
  function resolveBits(bits: YosysBit[]): { nodeId: string; portName: string } {
    const segs = segmentBits(bits, driverOf);

    const emitSeg = (seg: (typeof segs)[number]): { nodeId: string; portName: string } => {
      if (seg.kind === 'const') {
        const id = `_k${helperId++}`;
        pushBuilt(id, Constant({ width: seg.width, value: seg.value }), {
          width: seg.width,
          value: seg.value,
        });
        return { nodeId: id, portName: 'out' };
      }
      const whole = sourceWidth.get(key(seg.nodeId, seg.portName));
      if (seg.offset === 0 && whole === seg.width)
        return { nodeId: seg.nodeId, portName: seg.portName };
      // partial → slice
      const id = `_s${helperId++}`;
      pushBuilt(id, Slice({ inWidth: whole!, offset: seg.offset, width: seg.width }), {
        inWidth: whole!,
        offset: seg.offset,
        width: seg.width,
      });
      connect(seg.nodeId, seg.portName, id, 'in', portTypeOf(whole!));
      return { nodeId: id, portName: 'out' };
    };

    // Collapse sign/zero extension into ONE node instead of a slice+concat
    // chain (the plumbing explosion — a single widening is otherwise ~8 nodes).
    // yosys lowers `$signed` widening into MSB replication (a net run followed
    // by copies of that run's top bit) and unsigned widening into a zero pad.
    const ext = detectExtension(segs);
    if (ext) {
      const base = emitSeg(ext.base);
      const id = `_x${helperId++}`;
      const comp =
        ext.kind === 'sign'
          ? SignExtend({ inWidth: ext.base.width, outWidth: ext.toWidth })
          : ZeroExtend({ inWidth: ext.base.width, outWidth: ext.toWidth });
      pushBuilt(id, comp, { inWidth: ext.base.width, outWidth: ext.toWidth });
      connect(base.nodeId, base.portName, id, 'in', portTypeOf(ext.base.width));
      return { nodeId: id, portName: 'out' };
    }

    const srcs = segs.map((s) => ({ src: emitSeg(s), width: s.width }));
    // fold LSB-first with Concat (low = low bits, high above)
    let acc = srcs[0];
    for (let i = 1; i < srcs.length; i++) {
      const hi = srcs[i];
      const id = `_c${helperId++}`;
      pushBuilt(id, Concat({ hiWidth: hi.width, loWidth: acc.width }), {
        hiWidth: hi.width,
        loWidth: acc.width,
      });
      connect(hi.src.nodeId, hi.src.portName, id, 'high', portTypeOf(hi.width));
      connect(acc.src.nodeId, acc.src.portName, id, 'low', portTypeOf(acc.width));
      acc = { src: { nodeId: id, portName: 'out' }, width: acc.width + hi.width };
    }
    return acc.src;
  }

  // Adapt a resolved source to a target operand width: ZeroExtend/SignExtend if
  // narrower, Slice-truncate if wider, identity if equal. Emits ≤1 node.
  function adaptWidth(
    src: { nodeId: string; portName: string },
    srcW: number,
    targetW: number,
    signed: boolean,
  ): { nodeId: string; portName: string } {
    if (srcW === targetW) return src;
    const id = `_w${helperId++}`;
    if (srcW < targetW) {
      const comp = signed
        ? SignExtend({ inWidth: srcW, outWidth: targetW })
        : ZeroExtend({ inWidth: srcW, outWidth: targetW });
      pushBuilt(id, comp, { inWidth: srcW, outWidth: targetW });
    } else {
      pushBuilt(id, Slice({ inWidth: srcW, offset: 0, width: targetW }), {
        inWidth: srcW,
        offset: 0,
        width: targetW,
      });
    }
    connect(src.nodeId, src.portName, id, 'in', portTypeOf(srcW));
    return { nodeId: id, portName: 'out' };
  }

  function connect(
    srcNode: string,
    srcPort: string,
    dstNode: string,
    dstPort: string,
    portType: PortType,
  ): void {
    connections.push({
      id: `conn${connId++}`,
      source: { nodeId: srcNode, portName: srcPort },
      target: { nodeId: dstNode, portName: dstPort },
      portType,
    });
  }

  /** `$display`/`$write` cells lifted to nothing — collected so a design with
   *  fifty of them produces one warning rather than fifty. */
  const droppedPrints: string[] = [];

  // --- emit a node per cell, wiring its inputs --------------------------
  for (const [cn, cell] of Object.entries(mod.cells)) {
    const cid = nid(cn); // sanitized node id (see makeIdSanitizer)
    if (cell.type === '$mem_v2') {
      const { rdPorts, wrPorts, abits, width, size } = memLayout(cell);
      // shape args stored on the node so the serializer can emit Mem({...});
      // `store` overlays the $mem_v2 INIT ($readmemh/ROM contents) onto the state.
      const memArgs: Record<string, ArgumentValue> = { rdPorts, wrPorts, abits, width, size };
      const init = parseMemInit(cell, size, width);
      if (init) memArgs.store = init;
      pushBuilt(cid, Mem({ rdPorts, wrPorts, abits, width, size }), memArgs);
      for (let i = 0; i < rdPorts; i++) {
        const s = resolveBits(lane(cell.connections.RD_ADDR, i, abits));
        connect(s.nodeId, s.portName, cid, `rd_addr_${i}`, portTypeOf(abits));
      }
      for (let i = 0; i < wrPorts; i++) {
        const sa = resolveBits(lane(cell.connections.WR_ADDR, i, abits));
        connect(sa.nodeId, sa.portName, cid, `wr_addr_${i}`, portTypeOf(abits));
        const sd = resolveBits(lane(cell.connections.WR_DATA, i, width));
        connect(sd.nodeId, sd.portName, cid, `wr_data_${i}`, portTypeOf(width));
        const se = resolveBits(lane(cell.connections.WR_EN, i, width));
        connect(se.nodeId, se.portName, cid, `wr_en_${i}`, portTypeOf(width));
      }
      continue;
    }

    if (cell.type === '$pmux') {
      // one-hot mux: A = default, S = one-hot select, B = sWidth candidates of
      // WIDTH bits each, packed. Slice B into per-lane b_i ports (≤32 bits).
      const w = param(cell, 'WIDTH');
      const sWidth = param(cell, 'S_WIDTH');
      pushBuilt(cid, Pmux({ width: w, sWidth }), { width: w, sWidth });
      const a = resolveBits(cell.connections.A ?? []);
      connect(a.nodeId, a.portName, cid, 'a', portTypeOf(w));
      const s = resolveBits(cell.connections.S ?? []);
      connect(s.nodeId, s.portName, cid, 's', portTypeOf(sWidth));
      for (let i = 0; i < sWidth; i++) {
        const bi = resolveBits(lane(cell.connections.B, i, w));
        connect(bi.nodeId, bi.portName, cid, `b_${i}`, portTypeOf(w));
      }
      continue;
    }

    if (cell.type === '$adff' || cell.type === '$sdff' || cell.type === '$dffe') {
      // Reset/enable flip-flops → stdlib Register. CLK is dropped (single sim
      // clock). $adff (async) and $sdff (sync) both map to Register's synchronous
      // rst: in simten's cycle-accurate model an async reset held across an edge
      // is indistinguishable from a sync one. $dffe's clock-enable maps to `we`.
      const w = param(cell, 'WIDTH');
      pushBuilt(cid, Register({ width: w }), { width: w });
      const d = resolveBits(cell.connections.D);

      // Wire a 1-bit control net to a target port, inverting through a Not gate
      // when the source is active-low (Register's rst/we and Mux.sel are active-high).
      const wireCtrl = (
        bits: YosysBit[],
        activeHigh: number,
        dstNode: string,
        dstPort: string,
      ): void => {
        const src = resolveBits(bits);
        if (activeHigh) {
          connect(src.nodeId, src.portName, dstNode, dstPort, bitType());
        } else {
          const kn = `_n${helperId++}`;
          pushBuilt(kn, Not, {});
          connect(src.nodeId, src.portName, kn, 'in', bitType());
          connect(kn, 'out', dstNode, dstPort, bitType());
        }
      };

      if (cell.type === '$dffe') {
        // clock-enable → we; D → data (no reset; unconnected rst reads 0)
        connect(d.nodeId, d.portName, cid, 'data', portTypeOf(w));
        wireCtrl(cell.connections.EN, param(cell, 'EN_POLARITY'), cid, 'we');
      } else {
        // $adff/$sdff: latch every edge (we tied 1); reset folded in.
        const kWe = `_k${helperId++}`;
        pushBuilt(kWe, Constant({ width: 1, value: 1 }), { width: 1, value: 1 });
        connect(kWe, 'out', cid, 'we', bitType());
        const async = cell.type === '$adff';
        const resetValue = param(cell, async ? 'ARST_VALUE' : 'SRST_VALUE');
        const rstBits = cell.connections[async ? 'ARST' : 'SRST'];
        const rstPol = param(cell, async ? 'ARST_POLARITY' : 'SRST_POLARITY');
        if (resetValue === 0) {
          // reset-to-0: the clean path — D → data, reset → Register.rst.
          connect(d.nodeId, d.portName, cid, 'data', portTypeOf(w));
          wireCtrl(rstBits, rstPol, cid, 'rst');
        } else if (Number.isFinite(resetValue)) {
          // non-zero reset: fold the preset into the data path with a Mux +
          // Constant — data = reset ? resetValue : D (reset drives Mux.sel).
          const kc = `_k${helperId++}`;
          pushBuilt(kc, Constant({ width: w, value: resetValue }), { width: w, value: resetValue });
          const km = `_rm${helperId++}`;
          pushBuilt(km, Mux({ width: w }), { width: w });
          connect(d.nodeId, d.portName, km, 'in0', portTypeOf(w)); // sel=0 → data
          connect(kc, 'out', km, 'in1', portTypeOf(w)); // sel=1 → reset value
          wireCtrl(rstBits, rstPol, km, 'sel'); // reset (active-high) selects
          connect(km, 'out', cid, 'data', portTypeOf(w));
        } else {
          // Reset value has undefined (x) bits — refuse rather than guess.
          throw new Error(`${name}: ${cell.type} has an undefined reset value`);
        }
      }
      continue;
    }

    const isSub = !!netlist.modules[cell.type];

    if (isSub) {
      const shape = shapes.get(cell.type)!;
      const inSet = new Set(shape.inputs.map((p) => p.name));
      const node: Node = {
        id: cid,
        componentRef: moduleNameOf(cell.type),
        arguments: {},
        inputs: instancesFrom(shape.inputs, cid),
        outputs: instancesFrom(shape.outputs, cid),
        clocks: shape.sequential ? [{ id: `${cid}.clk`, name: 'clk' }] : [],
      };
      nodes.push(node);
      for (const [pn, bits] of Object.entries(cell.connections)) {
        if (!inSet.has(pn)) continue; // skip outputs and CLK
        const src = resolveBits(bits);
        connect(src.nodeId, src.portName, cid, pn, portTypeOf(bits.length));
      }
      continue;
    }

    // `$display`/`$write` become `$print` cells. They have no hardware meaning,
    // so lifting them is impossible — but throwing takes a whole design down over
    // a debug statement, and real RTL is full of them (this is what blocked the
    // servant SoC outright). Drop the cell and say so, rather than either failing
    // the import or silently swallowing the user's output.
    //
    // TODO: emit a Print node feeding a Console instead. Everything needed is on
    // the cell already — FORMAT, ARGS and EN — so the fix belongs right here.
    if (cell.type === '$print') {
      droppedPrints.push(sourceRef(cell) ?? cn);
      continue;
    }

    const rule = pickRule(cell);
    if (!rule) throw new Error(`${name}: unsupported cell type ${cell.type}`);
    const built = rule.comp(cell);
    const args: Record<string, number> = rule.nodeArgs ? rule.nodeArgs(cell) : {};
    // bake width arg for lifted comps that carry it
    if (built._args)
      for (const [k, v] of Object.entries(built._args)) if (typeof v === 'number') args[k] = v;
    pushBuilt(cid, built, args);

    for (const [cellPort, compPort] of Object.entries(rule.inMap)) {
      const bits = cell.connections[cellPort];
      if (!bits) continue;
      let src = resolveBits(bits);
      let w = bits.length;
      if (rule.adaptOperands) {
        // Extend/truncate the operand to the component's port width, per the
        // operand's own signedness (`<PORT>_SIGNED`).
        w = portWidth(built, compPort);
        src = adaptWidth(src, bits.length, w, !!param(cell, `${cellPort}_SIGNED`));
      }
      connect(src.nodeId, src.portName, cid, compPort, portTypeOf(w));
    }
    if (rule.tie) {
      for (const [compPort, value] of Object.entries(rule.tie)) {
        const id = `_k${helperId++}`;
        pushBuilt(id, Constant({ width: 1, value }), { width: 1, value });
        connect(id, 'out', cid, compPort, bitType());
      }
    }
  }

  if (droppedPrints.length > 0) {
    const where = [...new Set(droppedPrints)].slice(0, 3).join(', ');
    const more = droppedPrints.length > 3 ? ` and ${droppedPrints.length - 3} more` : '';
    warnings.push(
      `${moduleNameOf(name)}: dropped ${droppedPrints.length} $display/$write statement(s) ` +
        `(${where}${more}) — simulation output is not shown yet`,
    );
  }

  // --- wire module outputs ----------------------------------------------
  for (const [pn, p] of Object.entries(mod.ports)) {
    if (p.direction === 'input') continue;
    const src = resolveBits(p.bits);
    connect(src.nodeId, src.portName, '', pn, portTypeOf(p.bits.length));
  }

  return {
    version: 1,
    name: moduleNameOf(name),
    inputs: shape.inputs,
    outputs: shape.outputs,
    clocks: shape.sequential ? [{ name: 'clk' }] : [],
    state: [],
    nodes,
    connections,
    implementation: { kind: 'composite' },
    metadata: { description: `Imported from Verilog module '${name}'` },
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface ImportResult {
  /** The chosen top module's circuit. */
  top: Circuit;
  /** Every module circuit + every stdlib/rtl dependency circuit, by name. */
  library: Map<string, Circuit>;
  /** Non-fatal notes about the import (e.g. undriven nets tied to 0). */
  warnings: string[];
}

/**
 * Translate a yosys netlist into simten Circuit IR.
 *
 * @param topName - which module is the top (defaults to the sole/only module
 *                  that nothing else instantiates).
 */
/**
 * Sanitize yosys module names → valid, unique JS identifiers for use as circuit
 * names and submodule `componentRef`s. Parameterized instances arrive mangled
 * (`$paramod$hash\rom_wozmon`, `$paramod\ClockGen\USE_SAVESTATE=1`); the readable
 * base module name is extracted (the first `\Name`), then sanitized + uniquified.
 */
function makeModuleNameSanitizer(netlist: YosysNetlist): (raw: string) => string {
  const map = new Map<string, string>();
  const used = new Set<string>();
  const sanitize = (raw: string): string => {
    let base = raw;
    if (base.startsWith('$paramod')) {
      const m = base.match(/\\([A-Za-z_][A-Za-z0-9_]*)/); // first `\Name` = base module
      base = m ? m[1] : base.replace(/^\$paramod\$?/, '');
    }
    base = base
      .replace(/^\\/, '')
      .replace(/[^A-Za-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!base) base = 'mod';
    if (/^[0-9]/.test(base)) base = `m_${base}`;
    let id = base;
    for (let k = 2; used.has(id); k++) id = `${base}_${k}`;
    used.add(id);
    return id;
  };
  for (const raw of Object.keys(netlist.modules)) map.set(raw, sanitize(raw));
  return (raw) => map.get(raw) ?? raw;
}

export function importNetlist(netlist: YosysNetlist, topName?: string): ImportResult {
  const shapes = moduleShapes(netlist);
  const moduleNameOf = makeModuleNameSanitizer(netlist);
  const library = new Map<string, Circuit>();
  const warnings: string[] = [];

  for (const [name, mod] of Object.entries(netlist.modules)) {
    library.set(
      moduleNameOf(name),
      translateModule(name, mod, shapes, netlist, library, moduleNameOf, warnings),
    );
  }

  // Surface the implicit-clock convention: clock-only ports were dropped because
  // simten registers share one implicit clock (step it with tick). Leaving them
  // would add a dangling input that also duplicates on Verilog re-export.
  const droppedClocks = new Set<string>();
  for (const shape of shapes.values()) for (const p of shape.clockPorts) droppedClocks.add(p);
  if (droppedClocks.size > 0) {
    const names = [...droppedClocks].map((p) => `'${p}'`).join(', ');
    warnings.push(
      `Dropped clock port${droppedClocks.size > 1 ? 's' : ''} ${names}: simten sequential logic runs on a single implicit clock (step it with tick), so an imported clock port carries no signal.`,
    );
  }

  // pick top: explicit, else the module no other module instantiates
  let top = topName;
  if (!top) {
    const instantiated = new Set<string>();
    for (const mod of Object.values(netlist.modules))
      for (const cell of Object.values(mod.cells))
        if (netlist.modules[cell.type]) instantiated.add(cell.type);
    const roots = Object.keys(netlist.modules).filter((m) => !instantiated.has(m));
    if (roots.length !== 1)
      throw new Error(`cannot infer top module (candidates: ${roots.join(', ')}); pass topName`);
    top = roots[0];
  }

  return { top: library.get(moduleNameOf(top))!, library, warnings: [...new Set(warnings)] };
}
