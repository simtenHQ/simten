#!/usr/bin/env bun
/**
 * Cycle-by-cycle co-simulation diff for the RV32I CPU.
 *
 * Runs a chosen firmware through both the TS simulator and iverilog (via the
 * verifier service), then writes a textual log of selected pipeline signals
 * cycle-by-cycle. Lines flagged with `⚠ … ← DIVERGE` are the first place TS
 * sim and Verilog disagree; everything downstream usually cascades from there.
 *
 * Built to chase the 2 failing LBU tests reported by verify.ts --suite, but
 * reusable for any future TS-sim ↔ Verilog divergence. Swap in different
 * firmware bytes via the FIRMWARE array; add/remove signals in
 * TRACKED_SIGNALS. The Verilog VCD lookup turns each TS-sim portValues key
 * (e.g. `cpu.fwd_a_mux2.out`) into the matching VCD var (`w_cpu_fwd_a_mux2_out`).
 *
 * Requires the verifier service at $VERIFIER_URL (defaults to
 * http://localhost:55002/verify). Reads combined.v from this directory —
 * regenerate with regen_verilog.ts if the IR has changed.
 *
 * Usage: bun hardware/ulx3s/projects/cpu/cycle-diff.ts [cycles]
 *        Output: cycle-diff.log + cycle-diff.vcd in this directory.
 *
 * Bug located on first use: TS sim's UNINITIALIZED_VALUE sentinel
 * (-2147483648 = 0x80000000 signed) collides with the legitimate U-type
 * immediate produced by `lui rX, 0x80000`. Change detection sees "no change"
 * and never propagates, so a5 ends up as 0 and every downstream UART poll
 * targets address 0 instead of 0x80000000. See
 * packages/core/src/simulator/numeric-values.ts for the bad sentinel.
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulate } from '@simten/core/sim';
import { buildCPUCore } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const N_CYCLES = parseInt(process.argv[2] ?? '20', 10);
const VERIFIER_URL = process.env.VERIFIER_URL ?? 'http://localhost:55002/verify';

// The exact firmware from tests.ts "Load / LBU all byte offsets" — one of
// the 2 tests where TS sim and iverilog diverge in verify.ts --suite.
// Dumped via dump-failing-fw.ts; expected UART output is [0x41, 0x42, 0x43, 0x44].
const FIRMWARE: number[] = [
  0x800007b7, 0x00010437, 0x04100513, 0x00a42023,
  0x04200513, 0x00a400a3, 0x04300513, 0x00a40123,
  0x04400513, 0x00a401a3, 0x00044703, 0x00000013,
  0x00000013, 0x00000013, 0x0007a283, 0x0012f293,
  0xfe028ce3, 0x00e7a023, 0x00144703, 0x00000013,
  0x00000013, 0x00000013, 0x0007a283, 0x0012f293,
  0xfe028ce3, 0x00e7a023, 0x00244703, 0x00000013,
  0x00000013, 0x00000013, 0x0007a283, 0x0012f293,
  0xfe028ce3, 0x00e7a023, 0x00344703, 0x00000013,
  0x00000013, 0x00000013, 0x0007a283, 0x0012f293,
  0xfe028ce3, 0x00e7a023, 0x0000006f,
];

// Signals to track each cycle. Keys are TS-sim portValues identifiers.
// The top-level RV32I_CPU_Core wraps the inner RV32I_Core as a node named
// `cpu`, so internal CPU signals live at `cpu.<nodeId>.<port>`. The matching
// Verilog VCD signal is `w_cpu_<nodeId>_<port>` (dots → underscores, w_ prefix).
const TRACKED_SIGNALS = [
  'cpu.pc.q',
  'cpu.ifid_instr.q',
  'cpu.idex_rs1.q',
  'cpu.idex_read1.q',  // actual rs1 VALUE going into EX
  'cpu.idex_read2.q',  // actual rs2 VALUE going into EX
  'cpu.idex_imm.q',
  'cpu.immgen.instruction',  // input to immgen
  'cpu.immgen.immediate',    // output of immgen
  'cpu.fwd_a_mux1.out',
  'cpu.fwd_a_mux2.out',
  'cpu.fwd_b_mux1.out',
  'cpu.fwd_b_mux2.out',
  'cpu.alu_src_mux.out',
  'cpu.alu.result',
  'cpu.exmem_alu_result.q',
  'cpu.exmem_mem_write.q',
  'cpu.exmem_funct3.q',
  'cpu.regfile.rd',           // which register the WB stage targets
  'cpu.regfile.we',           // write enable
  'cpu.regfile.write_data',   // value being written back
  'cpu.regfile.read2',        // a4's current value when rs2=14
  'cpu.memwb_load_data.q',    // LBU/LW loaded value in WB stage
  'cpu.memwb_load_data.data', // input to that register (= data_read)
  'data_read',                // top-level input
  'cpu.memwb_rd.q',           // WB stage's target register
  'cpu.memwb_reg_write.q',    // WB stage's write-enable
  'instr_addr',  // top-level outputs
  'data_addr',
  'data_write',
  'data_mem_write',
];

// Convert a TS-sim portValue key (`cpu.fwd_a_mux2.out`) to the matching
// Verilog VCD variable name (`w_cpu_fwd_a_mux2_out`).
function tsKeyToVcdVar(key: string): string {
  return 'w_' + key.replace(/\./g, '_');
}

const hex = (v: number, w = 8) => '0x' + (v >>> 0).toString(16).padStart(w, '0');

// ─── Run TS sim ────────────────────────────────────────────────────────────

function runTsSim(): Array<Map<string, number>> {
  const { built } = buildCPUCore();
  const cpu = simulate(built);
  cpu.set({ instruction: 0, data_read: 0 });

  const DMEM_BASE = 0x00010000;
  const dmem = new Uint8Array(0x1000);
  const trace: Array<Map<string, number>> = [];

  for (let cycle = 0; cycle < N_CYCLES; cycle++) {
    const snapshot = new Map<string, number>();
    const portValues = cpu.session.getState().portValues;
    for (const [key, val] of portValues) {
      const cleanKey = key.startsWith('__top__.') ? key.slice('__top__.'.length) : key;
      // Normalize to unsigned so cross-side `===` works regardless of JS's
      // bitwise-int sign convention. iverilog's parser always produces
      // non-negative values, but TS sim may carry signed-32 internally
      // (e.g. lui imm with bit 31 set comes back as -2147483648).
      const num = typeof val === 'boolean' ? (val ? 1 : 0) : ((val as number) >>> 0);
      snapshot.set(cleanKey, num);
    }
    trace.push(snapshot);

    const instrAddr = ((cpu.get('instr_addr') as number) >>> 0);
    const dataAddr  = ((cpu.get('data_addr')  as number) >>> 0);
    const memW      = cpu.get('data_mem_write') as unknown as number;
    const dataWrite = ((cpu.get('data_write') as number) >>> 0);
    const f3        = cpu.get('data_funct3') as unknown as number;
    const instr     = FIRMWARE[(instrAddr >>> 2) & 0x1ff] ?? 0;

    // Matches the iverilog testbench's data_read mux: UART poll returns 1,
    // DMEM returns the raw aligned word (CPU's LoadAlignFull does the slicing),
    // IMEM range falls back to instruction word. Without this, the CPU's UART
    // poll loop stalls in TS sim while iverilog charges ahead — the two sides
    // would diverge in pipeline state purely because of the testbench mismatch.
    // Mirror the iverilog testbench's data_read mux EXACTLY: the CPU core
    // has its own LoadAlignFull on the load path, so the testbench returns
    // the full aligned 32-bit word for both DMEM and IMEM accesses (no
    // pre-slicing for LBU). The earlier version's `(word >> byteOff*8) & 0xFF`
    // double-applied alignment and silently broke matching.
    let dataRead = 0;
    const UART_ADDR = 0x80000000;
    if (dataAddr === UART_ADDR) {
      dataRead = 1;
    } else if (dataAddr >= DMEM_BASE && dataAddr < DMEM_BASE + 0x1000) {
      const ao = (dataAddr - DMEM_BASE) & ~3;
      dataRead = (dmem[ao] | (dmem[ao+1]<<8) | (dmem[ao+2]<<16) | (dmem[ao+3]<<24)) >>> 0;
    } else if ((dataAddr >>> 12) === 0x00000) {
      const wi = (dataAddr >>> 2) & 0x1ff;
      dataRead = (FIRMWARE[wi] ?? 0) >>> 0;
    }
    void f3;
    if (memW && dataAddr >= DMEM_BASE && dataAddr < DMEM_BASE + 0x1000) {
      const off = dataAddr - DMEM_BASE;
      const f = f3 & 7;
      if (f === 0)      dmem[off] = dataWrite & 0xFF;
      else if (f === 1) { dmem[off]=dataWrite&0xFF; dmem[off+1]=(dataWrite>>8)&0xFF; }
      else              { dmem[off]=dataWrite&0xFF; dmem[off+1]=(dataWrite>>8)&0xFF; dmem[off+2]=(dataWrite>>16)&0xFF; dmem[off+3]=(dataWrite>>24)&0xFF; }
    }

    cpu.set({ instruction: instr, data_read: dataRead });
    cpu.tick();
  }
  cpu.dispose();
  return trace;
}

// ─── Run iverilog via verifier ─────────────────────────────────────────────

async function runIverilog(): Promise<{ vcd: string; log: string } | null> {
  // Build a testbench identical to verify.ts's pattern (combined.v lives
  // committed in the cpu project dir).
  const { readFileSync } = await import('node:fs');
  const combinedV = readFileSync(resolve(__dirname, 'combined.v'), 'utf8');

  // Match verify.ts's testbench layout: instantiate RV32I_CPU_Core directly
  // (no cpu_top wrapper / POR delay), drive IMEM/DMEM in the testbench.
  const imemInit = FIRMWARE
    .map((w, i) => w === 0 ? null : `      imem[${i}] = 32'h${(w >>> 0).toString(16).padStart(8, '0')};`)
    .filter(Boolean).join('\n');
  const tb = `\`timescale 1ns / 1ps
module tb;
  reg clk = 0;
  always #5 clk = ~clk;

  reg [31:0] imem [0:511];
  reg [31:0] dmem [0:1023];

  wire [31:0] instr_addr;
  wire [31:0] data_addr;
  wire [31:0] data_write;
  wire data_mem_read;
  wire data_mem_write;
  wire [2:0] data_funct3;
  reg  [31:0] instruction;
  reg  [31:0] data_read;

  reg rst_n_reg = 1'b1;
  RV32I_CPU_Core cpu (
    .clk(clk),
    .rst_n(rst_n_reg),
    .instruction(instruction),
    .data_read(data_read),
    .instr_addr(instr_addr),
    .data_addr(data_addr),
    .data_write(data_write),
    .data_mem_read(data_mem_read),
    .data_mem_write(data_mem_write),
    .data_funct3(data_funct3)
  );

  wire sel_dmem = (data_addr[31:12] == 20'h00010);
  wire sel_imem = (data_addr[31:12] == 20'h00000);
  wire sel_uart = (data_addr == 32'h80000000);
  wire [31:0] dmem_rdata = dmem[data_addr[11:2]];
  wire [31:0] imem_rdata = imem[data_addr[10:2]];
  always @(*) instruction = imem[instr_addr[10:2]];
  always @(*) begin
    if (sel_uart) data_read = 32'h1;
    else if (sel_dmem) data_read = dmem_rdata;
    else if (sel_imem) data_read = imem_rdata;
    else data_read = 32'h0;
  end

  always @(posedge clk) begin
    if (data_mem_write & sel_dmem) begin
      case (data_funct3[1:0])
        2'd0: case (data_addr[1:0])
          2'd0: dmem[data_addr[11:2]][ 7: 0] <= data_write[7:0];
          2'd1: dmem[data_addr[11:2]][15: 8] <= data_write[7:0];
          2'd2: dmem[data_addr[11:2]][23:16] <= data_write[7:0];
          2'd3: dmem[data_addr[11:2]][31:24] <= data_write[7:0];
        endcase
        2'd1: case (data_addr[1])
          1'b0: dmem[data_addr[11:2]][15: 0] <= data_write[15:0];
          1'b1: dmem[data_addr[11:2]][31:16] <= data_write[15:0];
        endcase
        default: dmem[data_addr[11:2]] <= data_write;
      endcase
    end
  end

  integer cycle;
  integer i;
  initial begin
    $dumpfile("verify.vcd"); $dumpvars(0, tb);
    for (i = 0; i < 512;  i = i + 1) imem[i] = 32'h0;
    for (i = 0; i < 1024; i = i + 1) dmem[i] = 32'h0;
${imemInit}
    #1;
    for (cycle = 0; cycle < ${N_CYCLES}; cycle = cycle + 1) begin
      @(posedge clk);
    end
    $finish;
  end
endmodule
`;

  const resp = await fetch(VERIFIER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verilog: combinedV, testbench: tb }),
  });
  if (!resp.ok) {
    console.error('Verifier request failed:', resp.status, await resp.text());
    return null;
  }
  const json = await resp.json() as { success: boolean; vcdBase64?: string; simulationLog?: string; error?: string };
  if (!json.success || !json.vcdBase64) {
    console.error('Verifier returned error:', json.error ?? '(no error)');
    return null;
  }
  return { vcd: Buffer.from(json.vcdBase64, 'base64').toString('utf8'), log: json.simulationLog ?? '' };
}

// ─── Minimal VCD parser ────────────────────────────────────────────────────

interface VcdData {
  /** Maps signal id (e.g. `!`) to its hierarchical name. */
  idToName: Map<string, string>;
  /** Time-ordered snapshots: each entry is { time, values } */
  events: Array<{ time: number; values: Map<string, string> }>;
}

function parseVcd(vcd: string): VcdData {
  const idToName = new Map<string, string>();
  const scope: string[] = [];
  let i = 0;
  const lines = vcd.split('\n');

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('$enddefinitions')) { i++; break; }
    if (line.startsWith('$scope')) {
      const parts = line.split(/\s+/);
      scope.push(parts[2]);
    } else if (line.startsWith('$upscope')) {
      scope.pop();
    } else if (line.startsWith('$var')) {
      const parts = line.split(/\s+/);
      idToName.set(parts[3], scope.join('.') + '.' + parts[4]);
    }
    i++;
  }

  const events: Array<{ time: number; values: Map<string, string> }> = [];
  let current = new Map<string, string>();
  let time = -1;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      if (time >= 0 && current.size > 0) events.push({ time, values: current });
      time = parseInt(line.slice(1), 10);
      current = new Map();
      continue;
    }
    if (line[0] === 'b') {
      const sp = line.indexOf(' ');
      current.set(line.slice(sp + 1), line.slice(1, sp));
    } else {
      current.set(line.slice(1), line[0]);
    }
  }
  if (time >= 0 && current.size > 0) events.push({ time, values: current });
  return { idToName, events };
}

function bitsToNum(s: string): number {
  if (s === '0' || s === '1') return parseInt(s, 10);
  return parseInt(s.replace(/x|z/g, '0'), 2);
}

// ─── Diff ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('Running TS sim…');
  const tsTrace = runTsSim();
  console.log(`  ${tsTrace.length} cycles captured`);

  console.log('Running iverilog via verifier…');
  const ivResult = await runIverilog();
  if (!ivResult) { console.error('iverilog run failed; abort.'); process.exit(1); }
  console.log(`  log length: ${ivResult.log.length}, vcd length: ${ivResult.vcd.length}`);

  console.log('Parsing VCD…');
  writeFileSync(resolve(__dirname, 'cycle-diff.vcd'), ivResult.vcd);
  const vcd = parseVcd(ivResult.vcd);
  console.log(`  ${vcd.idToName.size} signals, ${vcd.events.length} value-change events`);

  // Cycle-by-cycle log
  const outLines: string[] = [];
  outLines.push(`# Cycle-by-cycle co-simulation log\n`);
  outLines.push(`#   ts = TS simulator, iv = iverilog\n`);
  outLines.push(`# Signals tracked: ${TRACKED_SIGNALS.length}, cycles: ${N_CYCLES}\n\n`);

  // Reverse-index VCD: signal name (just the trailing `w_*` identifier) → vcd id.
  // We look up Verilog vars by the name we construct from the TS-sim key.
  const vcdNameToId = new Map<string, string>();
  for (const [id, fullName] of vcd.idToName) {
    const trailing = fullName.split('.').pop()!;
    vcdNameToId.set(trailing, id);
  }

  // Build a per-cycle iverilog snapshot keyed by the TS-sim-style name.
  // The testbench has `always #5 clk = ~clk` (period 10ns) and the `'timescale
  // 1ns / 1ps` directive makes VCD timestamps in picoseconds. Posedges fall
  // at 5000 ps, 15000 ps, 25000 ps… i.e. the Nth posedge is at (2N-1)*5000 ps.
  // We sample 1 ps after each posedge to capture post-edge state. Cycle 0
  // is pre-first-posedge (initial values).
  const ivTrace: Array<Map<string, number>> = [];
  const current = new Map<string, number>();
  let eventIdx = 0;
  for (let c = 0; c < N_CYCLES; c++) {
    const sampleTime = c === 0 ? 4000 : (2 * c - 1) * 5000 + 1;
    while (eventIdx < vcd.events.length && vcd.events[eventIdx].time <= sampleTime) {
      for (const [id, val] of vcd.events[eventIdx].values) current.set(id, bitsToNum(val));
      eventIdx++;
    }
    const snap = new Map<string, number>();
    for (const tsKey of TRACKED_SIGNALS) {
      const vcdVar = tsKeyToVcdVar(tsKey);
      const id = vcdNameToId.get(vcdVar);
      if (id !== undefined && current.has(id)) snap.set(tsKey, current.get(id)!);
    }
    ivTrace.push(snap);
  }

  let firstDiverge = -1;
  for (let c = 0; c < Math.min(tsTrace.length, ivTrace.length); c++) {
    outLines.push(`── Cycle ${c} ──\n`);
    let mismatch = false;
    for (const sig of TRACKED_SIGNALS) {
      const ts = tsTrace[c].get(sig);
      const iv = ivTrace[c].get(sig);
      const match = ts === iv;
      const marker = match ? '  ' : '⚠ ';
      outLines.push(`${marker}${sig.padEnd(28)} ts=${ts !== undefined ? hex(ts) : '   undef   '}  iv=${iv !== undefined ? hex(iv) : '   undef   '}${match ? '' : '   ← DIVERGE'}\n`);
      if (!match && firstDiverge < 0) firstDiverge = c;
      if (!match) mismatch = true;
    }
    if (mismatch && firstDiverge === c) outLines.push(`  ↑ first divergence at cycle ${c}\n`);
  }

  const outPath = resolve(__dirname, 'cycle-diff.log');
  writeFileSync(outPath, outLines.join(''));
  console.log(`\nWrote ${outLines.length} lines to ${outPath}`);
  if (firstDiverge >= 0) console.log(`First divergence at cycle ${firstDiverge}`);
  else console.log(`No divergences in tracked signals across ${tsTrace.length} cycles.`);
}

await main();
