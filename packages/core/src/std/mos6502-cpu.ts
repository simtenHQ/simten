/*
 * MOS6502_Core — a cycle-accurate NMOS 6502, built from the blocks of the
 * 6502 block diagram.
 *
 * One `tick()` is one 6502 clock cycle, and every cycle is a bus cycle: the
 * core drives `addr` and `rw`, and either reads `data_in` or writes
 * `data_out`. That includes the dummy reads and writes the real chip makes,
 * so the pins match a 6502 cycle for cycle. `sync` is high on opcode fetches.
 *
 * Structure (each block a composite you can open on the canvas):
 *   - TimingGenerator: the T state, page-cross latch and interrupt logic.
 *   - InstructionDecode: the instruction register and the opcode table.
 *   - DecodePLA: turns (instruction, T, conditions) into this cycle's control lines.
 *   - ProgramCounter: PCL/PCH and the incrementer.
 *   - AddressBus: the ABL/ABH output registers, loaded from the ADL/ADH buses.
 *   - DataLatch: the input latch DL, the output register DOR and R/W.
 *   - ALU, Registers (A, X, Y, S) and Status (P).
 *   - The DB, SB, ADL and ADH buses that connect them.
 *
 * Memory is external: wire `addr`/`rw`/`data_out` to RAM, ROM and I/O and
 * return the byte at `addr` on `data_in` in the same cycle. The core starts in
 * its reset sequence, so it fetches the reset vector at $FFFC on its own.
 * `reset`, `irq` and `nmi` are active high.
 *
 * `debug` flag (default off): adds outputs for the registers (`a`, `x`, `y`,
 * `s`, `p`), the program counter `pc`, the instruction register `ir` and the
 * timing state `t`. With it off they are absent from the circuit.
 */

import { bit, bus } from '../circuit/bit-bus.js';
import { circuit } from '../circuit/circuit.js';
import type { BuiltCircuit } from '../circuit/types.js';
import { Constant } from './io.js';
import {
  MOS6502_ADHBus,
  MOS6502_ADLBus,
  MOS6502_ALU,
  MOS6502_DBBus,
  MOS6502_DecodePLA,
  MOS6502_DORSelect,
  MOS6502_OpcodeTable,
  MOS6502_PCIncrementer,
  MOS6502_SBBus,
  MOS6502_StatusLogic,
  MOS6502_TimingLogic,
} from './mos6502.js';
import { AddressCombiner, Mux } from './routing.js';
import { DFlipFlop, Register } from './sequential.js';

type B = ReturnType<typeof bus>;
type Bit = typeof bit;

// ─── Timing generator ───────────────────────────────────────────────────────
// T counts the cycles of the current instruction. Power-on state is T1 of the
// reset sequence, so the core runs its reset sequence without a reset pulse.
const MOS6502_TimingGenerator = circuit('MOS6502_TimingGenerator', () => ({
  inputs: {
    fetch: bit,
    end: bit,
    acr_load: bit,
    acr_branch: bit,
    alu_c: bit,
    db: bus(8),
    int_take: bit,
    p: bus(8),
    irq: bit,
    nmi: bit,
    reset: bit,
  },
  outputs: {
    t: bus(3),
    acr: bit,
    adir: bit,
    pending: bit,
    kind: bus(2),
    ir_load: bit,
    ir_clear: bit,
    vec: bus(8),
  },
  nodes: {
    t: Register({ width: 3, value: 1 }),
    kind: Register({ width: 2, value: 3 }),
    acr: DFlipFlop(),
    adir: DFlipFlop(),
    pending: DFlipFlop(),
    nmi_prev: DFlipFlop(),
    nmi_latch: DFlipFlop(),
    logic: MOS6502_TimingLogic,
    one: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    n.one.out.to(n.t.we, n.kind.we),
    n.t.q.to(n.logic.t, outputs.t),
    n.kind.q.to(n.logic.kind, outputs.kind),
    n.acr.q.to(n.logic.acr, outputs.acr),
    n.adir.q.to(n.logic.adir, outputs.adir),
    n.pending.q.to(n.logic.pending, outputs.pending),
    n.nmi_prev.q.to(n.logic.nmi_prev),
    n.nmi_latch.q.to(n.logic.nmi_latch),
    inputs.fetch.to(n.logic.fetch),
    inputs.end.to(n.logic.end),
    inputs.acr_load.to(n.logic.acr_load),
    inputs.acr_branch.to(n.logic.acr_branch),
    inputs.alu_c.to(n.logic.alu_c),
    inputs.db.to(n.logic.db),
    inputs.int_take.to(n.logic.int_take),
    inputs.p.to(n.logic.p),
    inputs.irq.to(n.logic.irq),
    inputs.nmi.to(n.logic.nmi, n.nmi_prev.d),
    inputs.reset.to(n.logic.reset),
    n.logic.t_next.to(n.t.data),
    n.logic.kind_next.to(n.kind.data),
    n.logic.acr_next.to(n.acr.d),
    n.logic.adir_next.to(n.adir.d),
    n.logic.pending_next.to(n.pending.d),
    n.logic.nmi_latch_next.to(n.nmi_latch.d),
    n.logic.ir_load.to(outputs.ir_load),
    n.logic.ir_clear.to(outputs.ir_clear),
    n.logic.vec.to(outputs.vec),
  ],
}));

// ─── Instruction decode ─────────────────────────────────────────────────────
// IR loads the opcode on each fetch, or BRK ($00) when an interrupt is taken.
const MOS6502_InstructionDecode = circuit('MOS6502_InstructionDecode', () => ({
  inputs: { data_in: bus(8), load: bit, clear: bit },
  outputs: {
    ir: bus(8),
    mode: bus(5),
    access: bus(2),
    op: bus(3),
    sb: bus(4),
    db: bit,
    cin: bus(2),
    dec: bit,
    dst: bus(3),
    flags: bus(3),
    fop: bus(3),
    store: bus(3),
    cond: bus(3),
  },
  nodes: {
    ir: Register({ width: 8 }),
    brk: Mux({ width: 8 }),
    table: MOS6502_OpcodeTable,
  },
  connect: ({ inputs, outputs, nodes: { ir, brk, table } }) => [
    inputs.data_in.to(brk.in0),
    inputs.clear.to(brk.sel),
    brk.out.to(ir.data),
    inputs.load.to(ir.we),
    ir.q.to(table.ir, outputs.ir),
    table.mode.to(outputs.mode),
    table.access.to(outputs.access),
    table.op.to(outputs.op),
    table.sb.to(outputs.sb),
    table.db.to(outputs.db),
    table.cin.to(outputs.cin),
    table.dec.to(outputs.dec),
    table.dst.to(outputs.dst),
    table.flags.to(outputs.flags),
    table.fop.to(outputs.fop),
    table.store.to(outputs.store),
    table.cond.to(outputs.cond),
  ],
}));

// ─── Program counter ────────────────────────────────────────────────────────
// PCL/PCH and the incrementer. `pcls`/`pchs` (PC, plus one when `inc`) feed
// the address buses; a jump loads PC from the ADL/ADH buses instead.
const MOS6502_ProgramCounter = circuit('MOS6502_ProgramCounter', () => ({
  inputs: { inc: bit, load: bit, adl: bus(8), adh: bus(8) },
  outputs: { pcl: bus(8), pch: bus(8), pcls: bus(8), pchs: bus(8) },
  nodes: {
    pcl: Register({ width: 8 }),
    pch: Register({ width: 8 }),
    incr: MOS6502_PCIncrementer,
    load_l: Mux({ width: 8 }),
    load_h: Mux({ width: 8 }),
    one: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: { pcl, pch, incr, load_l, load_h, one } }) => [
    one.out.to(pcl.we, pch.we),
    pcl.q.to(incr.pcl, outputs.pcl),
    pch.q.to(incr.pch, outputs.pch),
    inputs.inc.to(incr.inc),
    incr.pcls.to(load_l.in0, outputs.pcls),
    incr.pchs.to(load_h.in0, outputs.pchs),
    inputs.adl.to(load_l.in1),
    inputs.adh.to(load_h.in1),
    inputs.load.to(load_l.sel, load_h.sel),
    load_l.out.to(pcl.data),
    load_h.out.to(pch.data),
  ],
}));

// ─── Address bus ────────────────────────────────────────────────────────────
// ABL/ABH latch the ADL/ADH buses every cycle: the address for cycle N is
// formed during cycle N-1, as on the real chip.
const MOS6502_AddressBus = circuit('MOS6502_AddressBus', () => ({
  inputs: { adl: bus(8), adh: bus(8) },
  outputs: { abl: bus(8), abh: bus(8), addr: bus(16) },
  nodes: {
    abl: Register({ width: 8 }),
    abh: Register({ width: 8 }),
    join: AddressCombiner,
    one: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: { abl, abh, join, one } }) => [
    one.out.to(abl.we, abh.we),
    inputs.adl.to(abl.data),
    inputs.adh.to(abh.data),
    abl.q.to(join.lo, outputs.abl),
    abh.q.to(join.hi, outputs.abh),
    join.out.to(outputs.addr),
  ],
}));

// ─── Data latch ─────────────────────────────────────────────────────────────
// DL holds a byte read on an earlier cycle; DOR holds the byte to write on the
// next one. R/W is registered alongside it.
const MOS6502_DataLatch = circuit('MOS6502_DataLatch', () => ({
  inputs: {
    data_in: bus(8),
    dl_load: bit,
    write: bit,
    dor_sel: bus(3),
    a: bus(8),
    x: bus(8),
    y: bus(8),
    p: bus(8),
    push_b: bit,
    pchs: bus(8),
    pcls: bus(8),
    alu: bus(8),
  },
  outputs: { dl: bus(8), data_out: bus(8), rw: bit },
  nodes: {
    dl: Register({ width: 8 }),
    dor: Register({ width: 8 }),
    select: MOS6502_DORSelect,
    wr: DFlipFlop(),
    one: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: { dl, dor, select, wr, one } }) => [
    inputs.data_in.to(dl.data, select.data),
    inputs.dl_load.to(dl.we),
    dl.q.to(outputs.dl),
    inputs.dor_sel.to(select.sel),
    inputs.a.to(select.a),
    inputs.x.to(select.x),
    inputs.y.to(select.y),
    inputs.p.to(select.p),
    inputs.push_b.to(select.push_b),
    inputs.pchs.to(select.pchs),
    inputs.pcls.to(select.pcls),
    inputs.alu.to(select.alu),
    select.out.to(dor.data),
    one.out.to(dor.we),
    dor.q.to(outputs.data_out),
    inputs.write.to(wr.d),
    wr.q_bar.to(outputs.rw),
  ],
}));

// ─── Registers ──────────────────────────────────────────────────────────────
// A, X, Y and the stack pointer S, each loaded from the ALU result.
const MOS6502_Registers = circuit('MOS6502_Registers', () => ({
  inputs: { result: bus(8), load_a: bit, load_x: bit, load_y: bit, load_s: bit },
  outputs: { a: bus(8), x: bus(8), y: bus(8), s: bus(8) },
  nodes: {
    a: Register({ width: 8 }),
    x: Register({ width: 8 }),
    y: Register({ width: 8 }),
    s: Register({ width: 8 }),
  },
  connect: ({ inputs, outputs, nodes: { a, x, y, s } }) => [
    inputs.result.to(a.data, x.data, y.data, s.data),
    inputs.load_a.to(a.we),
    inputs.load_x.to(x.we),
    inputs.load_y.to(y.we),
    inputs.load_s.to(s.we),
    a.q.to(outputs.a),
    x.q.to(outputs.x),
    y.q.to(outputs.y),
    s.q.to(outputs.s),
  ],
}));

// ─── Status register ────────────────────────────────────────────────────────
const MOS6502_Status = circuit('MOS6502_Status', () => ({
  inputs: {
    n: bit,
    z: bit,
    c: bit,
    v: bit,
    data: bus(8),
    p_nz: bit,
    p_c: bit,
    p_v: bit,
    p_bit: bit,
    p_load: bit,
    p_fop: bus(3),
  },
  outputs: { p: bus(8) },
  nodes: {
    p: Register({ width: 8, value: 0x24 }),
    logic: MOS6502_StatusLogic,
    one: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: { p, logic, one } }) => [
    one.out.to(p.we),
    p.q.to(logic.p, outputs.p),
    inputs.n.to(logic.n),
    inputs.z.to(logic.z),
    inputs.c.to(logic.c),
    inputs.v.to(logic.v),
    inputs.data.to(logic.data),
    inputs.p_nz.to(logic.p_nz),
    inputs.p_c.to(logic.p_c),
    inputs.p_v.to(logic.p_v),
    inputs.p_bit.to(logic.p_bit),
    inputs.p_load.to(logic.p_load),
    inputs.p_fop.to(logic.p_fop),
    logic.next.to(p.data),
  ],
}));

// ─── The core ───────────────────────────────────────────────────────────────
const MOS6502_CoreFactory = circuit(
  'MOS6502_Core',
  ({ debug = false }: { debug?: boolean } = {}) => {
    const inputs = { data_in: bus(8), irq: bit, nmi: bit, reset: bit };
    // Debug ports exist only when `debug` is on, but stay in the type so the
    // connect below can name them without casts.
    const outputs = {
      addr: bus(16),
      data_out: bus(8),
      rw: bit,
      sync: bit,
      ...(debug
        ? {
            pc: bus(16),
            a: bus(8),
            x: bus(8),
            y: bus(8),
            s: bus(8),
            p: bus(8),
            ir: bus(8),
            t: bus(3),
          }
        : {}),
    } as unknown as CoreOuts;

    return {
      inputs,
      outputs,
      nodes: {
        timing: MOS6502_TimingGenerator(),
        decode: MOS6502_InstructionDecode(),
        pla: MOS6502_DecodePLA,
        pc: MOS6502_ProgramCounter(),
        ab: MOS6502_AddressBus(),
        latch: MOS6502_DataLatch(),
        alu: MOS6502_ALU,
        regs: MOS6502_Registers(),
        status: MOS6502_Status(),
        db: MOS6502_DBBus,
        sb: MOS6502_SBBus,
        adl: MOS6502_ADLBus,
        adh: MOS6502_ADHBus,
        ...(debug ? { pc_join: AddressCombiner } : {}),
      } as {
        timing: ReturnType<typeof MOS6502_TimingGenerator>;
        decode: ReturnType<typeof MOS6502_InstructionDecode>;
        pla: typeof MOS6502_DecodePLA;
        pc: ReturnType<typeof MOS6502_ProgramCounter>;
        ab: ReturnType<typeof MOS6502_AddressBus>;
        latch: ReturnType<typeof MOS6502_DataLatch>;
        alu: typeof MOS6502_ALU;
        regs: ReturnType<typeof MOS6502_Registers>;
        status: ReturnType<typeof MOS6502_Status>;
        db: typeof MOS6502_DBBus;
        sb: typeof MOS6502_SBBus;
        adl: typeof MOS6502_ADLBus;
        adh: typeof MOS6502_ADHBus;
        pc_join: typeof AddressCombiner;
      },
      connect: ({ inputs, outputs, nodes: n }) => {
        const rows = [
          // Timing
          n.pla.fetch.to(n.timing.fetch, outputs.sync),
          n.pla.end.to(n.timing.end),
          n.pla.acr_load.to(n.timing.acr_load),
          n.pla.acr_branch.to(n.timing.acr_branch),
          n.pla.int_take.to(n.timing.int_take),
          n.alu.c.to(n.timing.alu_c, n.status.c),
          n.db.out.to(n.timing.db, n.alu.b),
          inputs.irq.to(n.timing.irq),
          inputs.nmi.to(n.timing.nmi),
          inputs.reset.to(n.timing.reset),
          n.timing.t.to(n.pla.t),
          n.timing.acr.to(n.pla.acr),
          n.timing.adir.to(n.pla.adir),
          n.timing.pending.to(n.pla.pending),
          n.timing.kind.to(n.pla.kind),

          // Instruction decode → PLA
          inputs.data_in.to(
            n.decode.data_in,
            n.latch.data_in,
            n.status.data,
            n.db.data,
            n.adl.data,
            n.adh.data,
          ),
          n.timing.ir_load.to(n.decode.load),
          n.timing.ir_clear.to(n.decode.clear),
          n.decode.mode.to(n.pla.mode),
          n.decode.access.to(n.pla.access),
          n.decode.op.to(n.pla.op),
          n.decode.sb.to(n.pla.sb),
          n.decode.db.to(n.pla.db),
          n.decode.cin.to(n.pla.cin),
          n.decode.dec.to(n.pla.dec),
          n.decode.dst.to(n.pla.dst),
          n.decode.flags.to(n.pla.flags),
          n.decode.fop.to(n.pla.fop),
          n.decode.store.to(n.pla.store),
          n.decode.cond.to(n.pla.cond),
          n.status.p.to(n.pla.p, n.timing.p, n.latch.p),

          // Buses
          n.pla.sb_sel.to(n.sb.sel),
          n.pla.db_sel.to(n.db.sel),
          n.pla.adl.to(n.adl.sel),
          n.pla.adh.to(n.adh.sel),
          n.regs.a.to(n.sb.a, n.latch.a),
          n.regs.x.to(n.sb.x, n.latch.x),
          n.regs.y.to(n.sb.y, n.latch.y),
          n.regs.s.to(n.sb.s, n.adl.s),
          n.latch.dl.to(n.sb.dl, n.db.dl, n.adl.dl),
          n.pc.pcl.to(n.sb.pcl),
          n.pc.pch.to(n.sb.pch),
          n.pc.pcls.to(n.adl.pcl, n.latch.pcls),
          n.pc.pchs.to(n.adh.pch, n.latch.pchs),
          n.ab.abl.to(n.sb.abl, n.adl.abl),
          n.ab.abh.to(n.sb.abh, n.adh.abh),
          n.timing.vec.to(n.adl.vec),

          // ALU
          n.sb.out.to(n.alu.a),
          n.pla.alu_op.to(n.alu.op),
          n.pla.alu_cin.to(n.alu.cin),
          n.pla.decimal.to(n.alu.decimal),
          n.alu.result.to(n.regs.result, n.adl.alu, n.adh.alu, n.latch.alu),
          n.alu.n.to(n.status.n),
          n.alu.z.to(n.status.z),
          n.alu.v.to(n.status.v),

          // Registers and status
          n.pla.load_a.to(n.regs.load_a),
          n.pla.load_x.to(n.regs.load_x),
          n.pla.load_y.to(n.regs.load_y),
          n.pla.load_s.to(n.regs.load_s),
          n.pla.p_nz.to(n.status.p_nz),
          n.pla.p_c.to(n.status.p_c),
          n.pla.p_v.to(n.status.p_v),
          n.pla.p_bit.to(n.status.p_bit),
          n.pla.p_load.to(n.status.p_load),
          n.pla.p_fop.to(n.status.p_fop),

          // Program counter and address bus
          n.pla.pc_inc.to(n.pc.inc),
          n.pla.pc_load.to(n.pc.load),
          n.adl.out.to(n.pc.adl, n.ab.adl),
          n.adh.out.to(n.pc.adh, n.ab.adh),
          n.ab.addr.to(outputs.addr),

          // Data latch and pins
          n.pla.dl_load.to(n.latch.dl_load),
          n.pla.write.to(n.latch.write),
          n.pla.dor.to(n.latch.dor_sel),
          n.pla.push_b.to(n.latch.push_b),
          n.latch.data_out.to(outputs.data_out),
          n.latch.rw.to(outputs.rw),
        ];

        if (debug) {
          rows.push(
            n.pc.pcl.to(n.pc_join.lo),
            n.pc.pch.to(n.pc_join.hi),
            n.pc_join.out.to(outputs.pc),
            n.regs.a.to(outputs.a),
            n.regs.x.to(outputs.x),
            n.regs.y.to(outputs.y),
            n.regs.s.to(outputs.s),
            n.status.p.to(outputs.p),
            n.decode.ir.to(outputs.ir),
            n.timing.t.to(outputs.t),
          );
        }

        return rows;
      },
    };
  },
);

// Spell the ports out so the export's type doesn't drag every internal node
// into the shipped .d.ts bundle (see RV32I_Core).
type CoreIns = { data_in: B; irq: Bit; nmi: Bit; reset: Bit };
type CoreOuts = {
  addr: B;
  data_out: B;
  rw: Bit;
  sync: Bit;
  pc: B;
  a: B;
  x: B;
  y: B;
  s: B;
  p: B;
  ir: B;
  t: B;
};

/** A cycle-accurate NMOS 6502 core; memory and I/O connect to its bus pins. */
export const MOS6502_Core = MOS6502_CoreFactory as unknown as (opts?: {
  debug?: boolean;
}) => BuiltCircuit<CoreIns, CoreOuts>;
