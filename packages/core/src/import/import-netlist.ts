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
  BusXor,
  Comparator,
  Concat,
  Constant,
  LeftShifter,
  LogicAnd,
  LogicNot,
  LogicOr,
  Mux,
  ReduceAnd,
  ReduceOr,
  ReduceXor,
  Register,
  RightShifter,
  SignedComparator,
  SignedRightShifter,
  SignExtend,
  Slice,
  Subtractor,
  ZeroExtend,
} from '../std/index.js';
import type {
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
}
interface YosysModule {
  ports: Record<string, YosysPort>;
  cells: Record<string, YosysCell>;
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
    { comp: (c) => BusAnd({ width: param(c, 'Y_WIDTH') }), inMap: { A: 'a', B: 'b' }, outMap: { Y: 'out' }, adaptOperands: true },
  ],
  $or: [
    { comp: (c) => BusOr({ width: param(c, 'Y_WIDTH') }), inMap: { A: 'a', B: 'b' }, outMap: { Y: 'out' }, adaptOperands: true },
  ],
  $xor: [
    { comp: (c) => BusXor({ width: param(c, 'Y_WIDTH') }), inMap: { A: 'a', B: 'b' }, outMap: { Y: 'out' }, adaptOperands: true },
  ],
  $not: [
    { comp: (c) => BusNot({ width: param(c, 'Y_WIDTH') }), inMap: { A: 'in' }, outMap: { Y: 'out' }, adaptOperands: true },
  ],

  // reductions → stdlib bus→bit (reduce_bool ≡ reduce_or: both are `a != 0`)
  $reduce_or: un((c) => ReduceOr({ width: param(c, 'A_WIDTH') })),
  $reduce_bool: un((c) => ReduceOr({ width: param(c, 'A_WIDTH') })),
  $reduce_and: un((c) => ReduceAnd({ width: param(c, 'A_WIDTH') })),
  $reduce_xor: un((c) => ReduceXor({ width: param(c, 'A_WIDTH') })),

  // logical → stdlib bus→bit
  $logic_and: bin((c) => LogicAnd({ aWidth: param(c, 'A_WIDTH'), bWidth: param(c, 'B_WIDTH') })),
  $logic_or: bin((c) => LogicOr({ aWidth: param(c, 'A_WIDTH'), bWidth: param(c, 'B_WIDTH') })),
  $logic_not: un((c) => LogicNot({ width: param(c, 'A_WIDTH') })),

  // shifts → stdlib shifters at Y_WIDTH; value/shift adapted (shift is unsigned,
  // value per A_SIGNED). $sshr is the arithmetic (sign-replicating) right shift.
  $shl: [
    { comp: (c) => LeftShifter({ width: param(c, 'Y_WIDTH') }), inMap: { A: 'value', B: 'shift' }, outMap: { Y: 'result' }, adaptOperands: true },
  ],
  $shr: [
    { comp: (c) => RightShifter({ width: param(c, 'Y_WIDTH') }), inMap: { A: 'value', B: 'shift' }, outMap: { Y: 'result' }, adaptOperands: true },
  ],
  $sshr: [
    { comp: (c) => SignedRightShifter({ width: param(c, 'Y_WIDTH') }), inMap: { A: 'value', B: 'shift' }, outMap: { Y: 'result' }, adaptOperands: true },
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
      const line = parts.slice(1).join('$').match(/:(\d+)/)?.[1];
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

function nodeFromBuilt(id: string, built: BuiltCircuit, args: Record<string, number>): Node {
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
}

/** First pass: derive each module's port interface (needed for cross-refs). */
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
        c.type === '$dlatch' ||
        c.type === '$mem_v2' ||
        (netlist.modules[c.type] && shapes.get(c.type)?.sequential),
    );
    shapes.set(name, { inputs, outputs, sequential });
  }
  return shapes;
}

function translateModule(
  name: string,
  mod: YosysModule,
  shapes: Map<string, ModuleShape>,
  netlist: YosysNetlist,
  libDeps: Map<string, Circuit>,
): Circuit {
  const nodes: Node[] = [];
  const connections: Connection[] = [];
  let helperId = 0;
  let connId = 0;

  /** Create a node from a BuiltCircuit and register its dependency circuits. */
  const pushBuilt = (id: string, built: BuiltCircuit, args: Record<string, number>): void => {
    collectDeps(built, libDeps);
    nodes.push(nodeFromBuilt(id, built, args));
  };

  // Sanitize every cell name → a valid, unique node id up front (before the
  // driver map), so the driver map and every connection/node ref use the same
  // clean id. `nid` maps a raw yosys cell name to its sanitized node id.
  const idOf = makeIdSanitizer();
  const cellId = new Map<string, string>(Object.keys(mod.cells).map((cn) => [cn, idOf(cn)]));
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
    if (!d) throw new Error(`${name}: net ${net} has no driver`);
    return d;
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

  // --- emit a node per cell, wiring its inputs --------------------------
  for (const [cn, cell] of Object.entries(mod.cells)) {
    const cid = nid(cn); // sanitized node id (see makeIdSanitizer)
    if (cell.type === '$mem_v2') {
      const { rdPorts, wrPorts, abits, width, size } = memLayout(cell);
      // shape args stored on the node so the serializer can emit Mem({...})
      pushBuilt(cid, Mem({ rdPorts, wrPorts, abits, width, size }), {
        rdPorts,
        wrPorts,
        abits,
        width,
        size,
      });
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

    const isSub = !!netlist.modules[cell.type];

    if (isSub) {
      const shape = shapes.get(cell.type)!;
      const inSet = new Set(shape.inputs.map((p) => p.name));
      const node: Node = {
        id: cid,
        componentRef: cell.type,
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

  // --- wire module outputs ----------------------------------------------
  for (const [pn, p] of Object.entries(mod.ports)) {
    if (p.direction === 'input') continue;
    const src = resolveBits(p.bits);
    connect(src.nodeId, src.portName, '', pn, portTypeOf(p.bits.length));
  }

  const shape = shapes.get(name)!;
  return {
    version: 1,
    name,
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
}

/**
 * Translate a yosys netlist into simten Circuit IR.
 *
 * @param topName - which module is the top (defaults to the sole/only module
 *                  that nothing else instantiates).
 */
export function importNetlist(netlist: YosysNetlist, topName?: string): ImportResult {
  const shapes = moduleShapes(netlist);
  const library = new Map<string, Circuit>();

  for (const [name, mod] of Object.entries(netlist.modules)) {
    library.set(name, translateModule(name, mod, shapes, netlist, library));
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

  return { top: library.get(top)!, library };
}
