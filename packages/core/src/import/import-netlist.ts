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
import {
  RtlAdd,
  RtlAnd,
  RtlConcat2,
  RtlDlatch,
  RtlGe,
  RtlGt,
  RtlLe,
  RtlLogicAnd,
  RtlLogicNot,
  RtlLogicOr,
  RtlLt,
  RtlMem,
  RtlNe,
  RtlNot,
  RtlOr,
  RtlPmux,
  RtlReduceAnd,
  RtlReduceBool,
  RtlReduceOr,
  RtlReduceXor,
  RtlShl,
  RtlShr,
  RtlSlice,
  RtlSshr,
  RtlSub,
  RtlXor,
} from '../rtl/index.js';
import { Adder, Comparator, Constant, Mux, Register, Subtractor } from '../std/index.js';
import type {
  Circuit,
  Connection,
  Node,
  PortDescriptor,
  PortInstance,
  PortType,
} from '../types/circuit.js';
import { bitType, busType } from '../types/circuit.js';
import { type BitDriver, segmentBits, type YosysBit } from './net-map.js';

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
}

const symmetricUnsigned = (c: YosysCell) =>
  param(c, 'A_WIDTH') === param(c, 'B_WIDTH') &&
  param(c, 'A_WIDTH') === param(c, 'Y_WIDTH') &&
  !param(c, 'A_SIGNED') &&
  !param(c, 'B_SIGNED');

// A/B/Y width bundle and signedness — read straight off the cell parameters.
const w3 = (c: YosysCell) => ({
  aWidth: param(c, 'A_WIDTH'),
  bWidth: param(c, 'B_WIDTH'),
  yWidth: param(c, 'Y_WIDTH'),
});
const signs = (c: YosysCell) => ({ aSigned: param(c, 'A_SIGNED'), bSigned: param(c, 'B_SIGNED') });

/** binary A,B → Y (rtl primitive). */
const bin = (comp: (c: YosysCell) => BuiltCircuit): LiftRule[] => [
  { comp, inMap: { A: 'a', B: 'b' }, outMap: { Y: 'out' } },
];
/** unary A → Y (rtl primitive). */
const un = (comp: (c: YosysCell) => BuiltCircuit): LiftRule[] => [
  { comp, inMap: { A: 'a' }, outMap: { Y: 'out' } },
];

const LIFT: Record<string, LiftRule[]> = {
  // symmetric unsigned → the familiar stdlib component; else the rtl primitive.
  $add: [
    {
      when: symmetricUnsigned,
      comp: (c) => Adder({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'sum' },
      tie: { carry_in: 0 },
    },
    {
      comp: (c) =>
        RtlAdd({
          aWidth: param(c, 'A_WIDTH'),
          bWidth: param(c, 'B_WIDTH'),
          yWidth: param(c, 'Y_WIDTH'),
        }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'out' },
    },
  ],
  $sub: [
    {
      when: symmetricUnsigned,
      comp: (c) => Subtractor({ width: param(c, 'Y_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'difference' },
      tie: { borrow_in: 0 },
    },
    {
      comp: (c) =>
        RtlSub({
          aWidth: param(c, 'A_WIDTH'),
          bWidth: param(c, 'B_WIDTH'),
          yWidth: param(c, 'Y_WIDTH'),
        }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'out' },
    },
  ],
  $eq: [
    {
      comp: (c) => Comparator({ width: param(c, 'A_WIDTH') }),
      inMap: { A: 'a', B: 'b' },
      outMap: { Y: 'eq' },
    },
  ],
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
      comp: (c) => RtlDlatch({ width: param(c, 'WIDTH'), enPolarity: param(c, 'EN_POLARITY') }),
      inMap: { D: 'd', EN: 'en' },
      outMap: { Q: 'q' },
      sequential: true,
    },
  ],

  // bitwise
  $and: bin((c) => RtlAnd(w3(c))),
  $or: bin((c) => RtlOr(w3(c))),
  $xor: bin((c) => RtlXor(w3(c))),
  $not: un((c) => RtlNot({ aWidth: param(c, 'A_WIDTH'), yWidth: param(c, 'Y_WIDTH') })),

  // reductions
  $reduce_or: un((c) => RtlReduceOr({ aWidth: param(c, 'A_WIDTH') })),
  $reduce_bool: un((c) => RtlReduceBool({ aWidth: param(c, 'A_WIDTH') })),
  $reduce_and: un((c) => RtlReduceAnd({ aWidth: param(c, 'A_WIDTH') })),
  $reduce_xor: un((c) => RtlReduceXor({ aWidth: param(c, 'A_WIDTH') })),

  // logical
  $logic_and: bin((c) => RtlLogicAnd({ aWidth: param(c, 'A_WIDTH'), bWidth: param(c, 'B_WIDTH') })),
  $logic_or: bin((c) => RtlLogicOr({ aWidth: param(c, 'A_WIDTH'), bWidth: param(c, 'B_WIDTH') })),
  $logic_not: un((c) => RtlLogicNot({ aWidth: param(c, 'A_WIDTH') })),

  // comparisons (signedness flows via numeric args)
  $lt: bin((c) => RtlLt({ ...w3(c), ...signs(c) })),
  $le: bin((c) => RtlLe({ ...w3(c), ...signs(c) })),
  $gt: bin((c) => RtlGt({ ...w3(c), ...signs(c) })),
  $ge: bin((c) => RtlGe({ ...w3(c), ...signs(c) })),
  $ne: bin((c) => RtlNe({ ...w3(c), ...signs(c) })),

  // shifts
  $shl: bin((c) => RtlShl(w3(c))),
  $shr: bin((c) => RtlShr(w3(c))),
  $sshr: bin((c) => RtlSshr({ ...w3(c), aSigned: param(c, 'A_SIGNED') })),

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
// Node construction from a BuiltCircuit (harvest exact port descriptors)
// ---------------------------------------------------------------------------

function instancesFrom(descs: readonly PortDescriptor[], nodeId: string): PortInstance[] {
  return descs.map((p) => ({ id: `${nodeId}.${p.name}`, name: p.name, portType: p.portType }));
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
    if (cell.type === '$mem_v2') {
      // each read port drives a WIDTH-bit lane of the packed RD_DATA output
      const { rdPorts, width } = memLayout(cell);
      for (let i = 0; i < rdPorts; i++) {
        const port = `rd_data_${i}`;
        sourceWidth.set(key(cn, port), width);
        lane(cell.connections.RD_DATA, i, width).forEach((b, j) => {
          if (typeof b === 'number') drivers.set(b, { nodeId: cn, portName: port, index: j });
        });
      }
      continue;
    }
    if (cell.type === '$pmux') {
      // Y output (WIDTH bits) is driven by RtlPmux.out
      const w = param(cell, 'WIDTH');
      sourceWidth.set(key(cn, 'out'), w);
      (cell.connections.Y ?? []).forEach((b, j) => {
        if (typeof b === 'number') drivers.set(b, { nodeId: cn, portName: 'out', index: j });
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
      sourceWidth.set(key(cn, sPort), bits.length);
      bits.forEach((b, idx) => {
        if (typeof b === 'number') drivers.set(b, { nodeId: cn, portName: sPort, index: idx });
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
      pushBuilt(id, RtlSlice({ inWidth: whole!, offset: seg.offset, width: seg.width }), {
        inWidth: whole!,
        offset: seg.offset,
        width: seg.width,
      });
      connect(seg.nodeId, seg.portName, id, 'in', portTypeOf(whole!));
      return { nodeId: id, portName: 'out' };
    };

    const srcs = segs.map((s) => ({ src: emitSeg(s), width: s.width }));
    // fold LSB-first with RtlConcat2 (lo = low bits, hi above)
    let acc = srcs[0];
    for (let i = 1; i < srcs.length; i++) {
      const hi = srcs[i];
      const id = `_c${helperId++}`;
      pushBuilt(id, RtlConcat2({ hiWidth: hi.width, loWidth: acc.width }), {
        hiWidth: hi.width,
        loWidth: acc.width,
      });
      connect(hi.src.nodeId, hi.src.portName, id, 'hi', portTypeOf(hi.width));
      connect(acc.src.nodeId, acc.src.portName, id, 'lo', portTypeOf(acc.width));
      acc = { src: { nodeId: id, portName: 'out' }, width: acc.width + hi.width };
    }
    return acc.src;
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
    if (cell.type === '$mem_v2') {
      const { rdPorts, wrPorts, abits, width, size } = memLayout(cell);
      pushBuilt(cn, RtlMem({ rdPorts, wrPorts, abits, width, size }), {});
      for (let i = 0; i < rdPorts; i++) {
        const s = resolveBits(lane(cell.connections.RD_ADDR, i, abits));
        connect(s.nodeId, s.portName, cn, `rd_addr_${i}`, portTypeOf(abits));
      }
      for (let i = 0; i < wrPorts; i++) {
        const sa = resolveBits(lane(cell.connections.WR_ADDR, i, abits));
        connect(sa.nodeId, sa.portName, cn, `wr_addr_${i}`, portTypeOf(abits));
        const sd = resolveBits(lane(cell.connections.WR_DATA, i, width));
        connect(sd.nodeId, sd.portName, cn, `wr_data_${i}`, portTypeOf(width));
        const se = resolveBits(lane(cell.connections.WR_EN, i, width));
        connect(se.nodeId, se.portName, cn, `wr_en_${i}`, portTypeOf(width));
      }
      continue;
    }

    if (cell.type === '$pmux') {
      // one-hot mux: A = default, S = one-hot select, B = sWidth candidates of
      // WIDTH bits each, packed. Slice B into per-lane b_i ports (≤32 bits).
      const w = param(cell, 'WIDTH');
      const sWidth = param(cell, 'S_WIDTH');
      pushBuilt(cn, RtlPmux({ width: w, sWidth }), {});
      const a = resolveBits(cell.connections.A ?? []);
      connect(a.nodeId, a.portName, cn, 'a', portTypeOf(w));
      const s = resolveBits(cell.connections.S ?? []);
      connect(s.nodeId, s.portName, cn, 's', portTypeOf(sWidth));
      for (let i = 0; i < sWidth; i++) {
        const bi = resolveBits(lane(cell.connections.B, i, w));
        connect(bi.nodeId, bi.portName, cn, `b_${i}`, portTypeOf(w));
      }
      continue;
    }

    const isSub = !!netlist.modules[cell.type];

    if (isSub) {
      const shape = shapes.get(cell.type)!;
      const inSet = new Set(shape.inputs.map((p) => p.name));
      const node: Node = {
        id: cn,
        componentRef: cell.type,
        arguments: {},
        inputs: instancesFrom(shape.inputs, cn),
        outputs: instancesFrom(shape.outputs, cn),
        clocks: shape.sequential ? [{ id: `${cn}.clk`, name: 'clk' }] : [],
      };
      nodes.push(node);
      for (const [pn, bits] of Object.entries(cell.connections)) {
        if (!inSet.has(pn)) continue; // skip outputs and CLK
        const src = resolveBits(bits);
        connect(src.nodeId, src.portName, cn, pn, portTypeOf(bits.length));
      }
      continue;
    }

    const rule = pickRule(cell);
    if (!rule) throw new Error(`${name}: unsupported cell type ${cell.type}`);
    const built = rule.comp(cell);
    const args: Record<string, number> = {};
    // bake width arg for lifted comps that carry it
    if (built._args)
      for (const [k, v] of Object.entries(built._args)) if (typeof v === 'number') args[k] = v;
    pushBuilt(cn, built, args);

    for (const [cellPort, compPort] of Object.entries(rule.inMap)) {
      const bits = cell.connections[cellPort];
      if (!bits) continue;
      const src = resolveBits(bits);
      connect(src.nodeId, src.portName, cn, compPort, portTypeOf(bits.length));
    }
    if (rule.tie) {
      for (const [compPort, value] of Object.entries(rule.tie)) {
        const id = `_k${helperId++}`;
        pushBuilt(id, Constant({ width: 1, value }), { width: 1, value });
        connect(id, 'out', cn, compPort, bitType());
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
