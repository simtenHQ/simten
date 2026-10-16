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
 *   - DecodePLA: turns (instruction, T, conditions) into this cycle's control
 *     lines, bundled into one control bus per block.
 *   - ProgramCounter: PCL/PCH and the incrementer.
 *   - AddressBus: the ABL/ABH output registers, loaded from the ADL/ADH buses.
 *   - DataLatch: the input latch DL, the output register DOR and R/W.
 *   - ALU, Registers (A, X, Y, S) and Status (P).
 *   - The DB, SB, ADL and ADH buses that connect them.
 *
 * Simplified against the silicon: one clock edge per cycle instead of two
 * phases, each bus is a one-way select rather than shared pass-transistor
 * wiring, and the ALU has no input or output latches. None of that is visible
 * at the pins.
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
import { Slice } from './reconstruction.js';
import { AddressCombiner, Mux } from './routing.js';
import { DFlipFlop, Register } from './sequential.js';

type B = ReturnType<typeof bus>;
type Bit = typeof bit;

/** One control line out of a block's control bus. */
const line = (inWidth: number, offset: number) => Slice({ inWidth, offset, width: 1 });

// ─── Timing generator ───────────────────────────────────────────────────────
// T counts the cycles of the current instruction. Power-on state is T1 of the
// reset sequence, so the core runs its reset sequence without a reset pulse.
const MOS6502_TimingGenerator = circuit('MOS6502_TimingGenerator', () => ({
  inputs: {
    ctrl: bus(5),
    alu_c: bit,
    db: bus(8),
    p: bus(8),
    irq: bit,
    nmi: bit,
    reset: bit,
  },
  outputs: {
    state: bus(8),
    t: bus(3),
    sync: bit,
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
    n.kind.q.to(n.logic.kind),
    n.acr.q.to(n.logic.acr),
    n.adir.q.to(n.logic.adir),
    n.pending.q.to(n.logic.pending),
    n.nmi_prev.q.to(n.logic.nmi_prev),
    n.nmi_latch.q.to(n.logic.nmi_latch),
    inputs.ctrl.to(n.logic.ctrl),
    inputs.alu_c.to(n.logic.alu_c),
    inputs.db.to(n.logic.db),
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
    n.logic.state.to(outputs.state),
    n.logic.sync.to(outputs.sync),
    n.logic.ir_load.to(outputs.ir_load),
    n.logic.ir_clear.to(outputs.ir_clear),
    n.logic.vec.to(outputs.vec),
  ],
}));

// ─── Instruction decode ─────────────────────────────────────────────────────
// IR loads the opcode on each fetch, or BRK ($00) when an interrupt is taken.
// The opcode table turns it into `seq` (how the instruction sequences its
// cycles) and `exec` (what it computes).
const MOS6502_InstructionDecode = circuit('MOS6502_InstructionDecode', () => ({
  inputs: { data_in: bus(8), load: bit, clear: bit },
  outputs: { ir: bus(8), seq: bus(10), exec: bus(23) },
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
    table.seq.to(outputs.seq),
    table.exec.to(outputs.exec),
  ],
}));

// ─── Program counter ────────────────────────────────────────────────────────
// PCL/PCH and the incrementer. `pcls`/`pchs` (PC, plus one when incrementing)
// feed the address buses; a jump loads PC from the ADL/ADH buses instead.
const MOS6502_ProgramCounter = circuit('MOS6502_ProgramCounter', () => ({
  inputs: { ctrl: bus(2), adl: bus(8), adh: bus(8) },
  outputs: { pcl: bus(8), pch: bus(8), pcls: bus(8), pchs: bus(8) },
  nodes: {
    increment: line(2, 0),
    load: line(2, 1),
    pcl: Register({ width: 8 }),
    pch: Register({ width: 8 }),
    incr: MOS6502_PCIncrementer,
    load_l: Mux({ width: 8 }),
    load_h: Mux({ width: 8 }),
    one: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    inputs.ctrl.to(n.increment.in, n.load.in),
    n.one.out.to(n.pcl.we, n.pch.we),
    n.pcl.q.to(n.incr.pcl, outputs.pcl),
    n.pch.q.to(n.incr.pch, outputs.pch),
    n.increment.out.to(n.incr.inc),
    n.incr.pcls.to(n.load_l.in0, outputs.pcls),
    n.incr.pchs.to(n.load_h.in0, outputs.pchs),
    inputs.adl.to(n.load_l.in1),
    inputs.adh.to(n.load_h.in1),
    n.load.out.to(n.load_l.sel, n.load_h.sel),
    n.load_l.out.to(n.pcl.data),
    n.load_h.out.to(n.pch.data),
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
// The data pins come in here. `data` passes the byte being read straight
// through (the latch is transparent while it is read); DL holds a byte read on
// an earlier cycle; DOR holds the byte to write on the next one, and R/W is
// registered alongside it.
const MOS6502_DataLatch = circuit('MOS6502_DataLatch', () => ({
  inputs: {
    data_in: bus(8),
    ctrl: bus(6),
    a: bus(8),
    x: bus(8),
    y: bus(8),
    p: bus(8),
    pchs: bus(8),
    pcls: bus(8),
    alu: bus(8),
  },
  outputs: { data: bus(8), dl: bus(8), data_out: bus(8), rw: bit },
  nodes: {
    dl_load: line(6, 0),
    write: line(6, 1),
    dl: Register({ width: 8 }),
    dor: Register({ width: 8 }),
    select: MOS6502_DORSelect,
    wr: DFlipFlop(),
    one: Constant({ value: 1 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    inputs.ctrl.to(n.dl_load.in, n.write.in, n.select.ctrl),
    inputs.data_in.to(n.dl.data, n.select.data, outputs.data),
    n.dl_load.out.to(n.dl.we),
    n.dl.q.to(outputs.dl),
    inputs.a.to(n.select.a),
    inputs.x.to(n.select.x),
    inputs.y.to(n.select.y),
    inputs.p.to(n.select.p),
    inputs.pchs.to(n.select.pchs),
    inputs.pcls.to(n.select.pcls),
    inputs.alu.to(n.select.alu),
    n.select.out.to(n.dor.data),
    n.one.out.to(n.dor.we),
    n.dor.q.to(outputs.data_out),
    n.write.out.to(n.wr.d),
    n.wr.q_bar.to(outputs.rw),
  ],
}));

// ─── Registers ──────────────────────────────────────────────────────────────
// A, X, Y and the stack pointer S, each loaded from the ALU result.
const MOS6502_Registers = circuit('MOS6502_Registers', () => ({
  inputs: { result: bus(8), ctrl: bus(4) },
  outputs: { a: bus(8), x: bus(8), y: bus(8), s: bus(8) },
  nodes: {
    load_a: line(4, 0),
    load_x: line(4, 1),
    load_y: line(4, 2),
    load_s: line(4, 3),
    a: Register({ width: 8 }),
    x: Register({ width: 8 }),
    y: Register({ width: 8 }),
    s: Register({ width: 8 }),
  },
  connect: ({ inputs, outputs, nodes: n }) => [
    inputs.ctrl.to(n.load_a.in, n.load_x.in, n.load_y.in, n.load_s.in),
    inputs.result.to(n.a.data, n.x.data, n.y.data, n.s.data),
    n.load_a.out.to(n.a.we),
    n.load_x.out.to(n.x.we),
    n.load_y.out.to(n.y.we),
    n.load_s.out.to(n.s.we),
    n.a.q.to(outputs.a),
    n.x.q.to(outputs.x),
    n.y.q.to(outputs.y),
    n.s.q.to(outputs.s),
  ],
}));

// ─── Status register ────────────────────────────────────────────────────────
const MOS6502_Status = circuit('MOS6502_Status', () => ({
  inputs: { n: bit, z: bit, c: bit, v: bit, data: bus(8), ctrl: bus(8) },
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
    inputs.ctrl.to(logic.ctrl),
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
          // Pins
          inputs.data_in.to(n.latch.data_in),
          inputs.irq.to(n.timing.irq),
          inputs.nmi.to(n.timing.nmi),
          inputs.reset.to(n.timing.reset),
          n.ab.addr.to(outputs.addr),
          n.latch.data_out.to(outputs.data_out),
          n.latch.rw.to(outputs.rw),
          n.timing.sync.to(outputs.sync),

          // Control: instruction and timing state in, one bundle per block out
          n.timing.ir_load.to(n.decode.load),
          n.timing.ir_clear.to(n.decode.clear),
          n.decode.seq.to(n.pla.seq),
          n.decode.exec.to(n.pla.exec),
          n.timing.state.to(n.pla.state),
          n.status.p.to(n.pla.p, n.timing.p, n.latch.p),
          n.pla.timing_ctrl.to(n.timing.ctrl),
          n.pla.pc_ctrl.to(n.pc.ctrl),
          n.pla.bus_ctrl.to(n.db.ctrl, n.sb.ctrl, n.adl.ctrl, n.adh.ctrl),
          n.pla.alu_op.to(n.alu.op),
          n.pla.alu_cin.to(n.alu.cin),
          n.pla.decimal.to(n.alu.decimal),
          n.pla.reg_ctrl.to(n.regs.ctrl),
          n.pla.p_ctrl.to(n.status.ctrl),
          n.pla.latch_ctrl.to(n.latch.ctrl),

          // Data: what the buses carry
          n.latch.data.to(n.decode.data_in, n.status.data, n.db.data, n.adl.data, n.adh.data),
          n.latch.dl.to(n.sb.dl, n.db.dl, n.adl.dl),
          n.regs.a.to(n.sb.a, n.latch.a),
          n.regs.x.to(n.sb.x, n.latch.x),
          n.regs.y.to(n.sb.y, n.latch.y),
          n.regs.s.to(n.sb.s, n.adl.s),
          n.pc.pcl.to(n.sb.pcl),
          n.pc.pch.to(n.sb.pch),
          n.pc.pcls.to(n.adl.pcl, n.latch.pcls),
          n.pc.pchs.to(n.adh.pch, n.latch.pchs),
          n.ab.abl.to(n.sb.abl, n.adl.abl),
          n.ab.abh.to(n.sb.abh, n.adh.abh),
          n.timing.vec.to(n.adl.vec),

          // ALU: A from SB, B from DB; the result feeds the registers and buses
          n.sb.out.to(n.alu.a),
          n.db.out.to(n.alu.b, n.timing.db),
          n.alu.result.to(n.regs.result, n.adl.alu, n.adh.alu, n.latch.alu),
          n.alu.c.to(n.timing.alu_c, n.status.c),
          n.alu.n.to(n.status.n),
          n.alu.z.to(n.status.z),
          n.alu.v.to(n.status.v),

          // Next address: ADL/ADH load the address bus, and PC on a jump
          n.adl.out.to(n.pc.adl, n.ab.adl),
          n.adh.out.to(n.pc.adh, n.ab.adh),
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
