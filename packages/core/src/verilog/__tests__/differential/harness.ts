/**
 * Differential test harness: the JS simulator against Icarus Verilog.
 *
 * Both sides get the same pseudo-random input vectors (fixed seed). Each cycle
 * applies the inputs, clocks once and samples. On the Verilog side that is
 * "drive, posedge, #1, sample", the timing `tick()` documents. Every top output
 * is compared, and so is every internal net the exporter declares as a
 * `w_<node>_<port>` wire (read through a hierarchical reference), so circuits
 * without top-level outputs, like most bundled examples, are still checked.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CircuitIR, PortType } from '../../../ir/circuit-ir.js';
import { createEngine, elaborate } from '../../../simulator/index.js';
import type { CircuitLibrary } from '../../../simulator/types.js';
import { exportVerilog } from '../../exporter.js';

export interface DiffTarget {
  top: CircuitIR;
  library: CircuitLibrary;
}

export interface DiffOptions {
  cycles: number;
  seed?: number;
  /** Inputs that must never be driven with 0 (divisors). */
  nonZero?: readonly string[];
  /** Per-input mask, to keep e.g. an address inside the initialised range. */
  inputMask?: Readonly<Record<string, number>>;
}

/** Hand-written Verilog to run instead of the exporter's output. */
export interface Reference {
  verilog: string;
  module: string;
  /** Name of the module's clock port, if it has one. */
  clock?: string;
}

interface Signal {
  label: string;
  simKey: string;
  /** Verilog expression inside `tb`. */
  expr: string;
  /** Declared width of the port in the circuit. The exporter can declare a
   *  wider wire (it widens every non-control port of a node with a `width`
   *  argument); only the declared bits are compared, and a wrong upper bit
   *  shows up wherever a consumer reads it. */
  width: number;
}

export interface Mismatch {
  cycle: number;
  signal: string;
  sim: string;
  verilog: string;
}

export interface DiffResult {
  signals: number;
  cycles: number;
  mismatches: Mismatch[];
}

let iverilogAvailable: boolean | undefined;

export function hasIverilog(): boolean {
  if (iverilogAvailable === undefined) {
    const r = spawnSync('iverilog', ['-V'], { encoding: 'utf8' });
    iverilogAvailable = /Icarus Verilog/.test(`${r.stdout ?? ''}${r.stderr ?? ''}`);
  }
  return iverilogAvailable;
}

const widthOf = (pt: PortType) => (pt.kind === 'bus' ? pt.width : 1);
const maskOf = (w: number) => (w >= 32 ? 0xffffffff : 2 ** w - 1);
const sanitizeId = (id: string) => id.replace(/[.-]/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
const hex = (x: number | undefined) => (x === undefined ? 'missing' : `0x${x.toString(16)}`);

/** Deterministic LCG, so a failure reproduces from the seed alone. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

/** A value for a `w`-bit input: mostly uniform, one in eight an edge value. */
function pick(next: () => number, w: number): number {
  const mask = maskOf(w);
  if (next() % 8 === 0) {
    const edges = [0, mask, 2 ** (w - 1), 1, mask - 1];
    return (edges[next() % edges.length] & mask) >>> 0;
  }
  return (next() & mask) >>> 0;
}

export function makeVectors(top: CircuitIR, opts: DiffOptions): Record<string, number>[] {
  const { cycles, seed = 1, nonZero = [], inputMask = {} } = opts;
  const next = rng(seed);
  const vectors: Record<string, number>[] = [];
  for (let c = 0; c < cycles; c++) {
    const v: Record<string, number> = {};
    for (const p of top.inputs) {
      let x = pick(next, widthOf(p.portType));
      if (inputMask[p.name] !== undefined) x = (x & inputMask[p.name]) >>> 0;
      if (x === 0 && nonZero.includes(p.name)) x = 1;
      v[p.name] = x;
    }
    vectors.push(v);
  }
  return vectors;
}

function topSignals(top: CircuitIR): Signal[] {
  return top.outputs
    .filter((p) => widthOf(p.portType) <= 32)
    .map((p) => ({
      label: p.name,
      simKey: `__top__.${p.name}`,
      expr: p.name,
      width: widthOf(p.portType),
    }));
}

/** Every `w_<node>_<port>` wire the exporter declared, read through `dut.`. */
function internalSignals(target: DiffTarget, verilog: string): Signal[] {
  const declared = new Set<string>();
  for (const m of verilog.matchAll(/^\s*wire (?:\[\d+:0\] )?(w_\w+);/gm)) declared.add(m[1]);
  const flat = elaborate(target.top, target.library, false);
  const portWidth = new Map<string, number>();
  for (const node of flat.nodes) {
    for (const p of node.outputs) portWidth.set(`${node.id}.${p.name}`, widthOf(p.portType));
  }
  const signals: Signal[] = [];
  const seen = new Set<string>();
  for (const conn of flat.connections) {
    const { nodeId, portName } = conn.source;
    if (nodeId === '__top__') continue;
    const key = `${nodeId}.${portName}`;
    const wire = `w_${sanitizeId(nodeId)}_${sanitizeId(portName)}`;
    const width = portWidth.get(key) ?? widthOf(conn.portType);
    if (!declared.has(wire) || width > 32 || seen.has(wire)) continue;
    seen.add(wire);
    signals.push({ label: key, simKey: key, expr: `dut.${wire}`, width });
  }
  return signals;
}

function runSimulator(
  target: DiffTarget,
  vectors: Record<string, number>[],
  signals: Signal[],
): (number | undefined)[][] {
  const engine = createEngine(elaborate(target.top, target.library), {
    componentLibrary: target.library,
  });
  const trace: (number | undefined)[][] = [];
  for (const v of vectors) {
    for (const [name, value] of Object.entries(v)) engine.setNode(name, value);
    engine.tick();
    const values = engine.getPortValues();
    trace.push(
      signals.map((s) => {
        const x = values.get(s.simKey);
        return x === undefined ? undefined : Number(x) >>> 0;
      }),
    );
  }
  return trace;
}

/**
 * `clockPorts` are the DUT's clock (and reset) connections, if any. Reset is
 * held low across two edges and released between edges, so a synchronous
 * reset arm fires before the first sampled cycle.
 */
function testbench(
  top: CircuitIR,
  moduleName: string,
  clockPorts: string[],
  vectors: Record<string, number>[],
  signals: Signal[],
): string {
  const decl = (w: number) => (w > 1 ? `[${w - 1}:0] ` : '');
  const lines = ['`timescale 1ns / 1ps', 'module tb;', '  reg clk = 0;', '  reg rst_n = 0;'];
  for (const p of top.inputs) lines.push(`  reg ${decl(widthOf(p.portType))}${p.name};`);
  for (const p of top.outputs) lines.push(`  wire ${decl(widthOf(p.portType))}${p.name};`);
  const ports = [
    ...clockPorts,
    ...top.inputs.map((p) => `.${p.name}(${p.name})`),
    ...top.outputs.map((p) => `.${p.name}(${p.name})`),
  ];
  lines.push(`  ${moduleName} dut (${ports.join(', ')});`);
  lines.push('  always #5 clk = ~clk;');
  lines.push('  initial begin');
  for (const p of top.inputs) lines.push(`    ${p.name} = 0;`);
  lines.push('    @(posedge clk); @(posedge clk); #1 rst_n = 1;');
  const sample = signals.map((s) => `    $write(" %h", ${s.expr});`).join('\n');
  for (const v of vectors) {
    for (const p of top.inputs) {
      lines.push(`    ${p.name} = ${widthOf(p.portType)}'h${v[p.name].toString(16)};`);
    }
    lines.push('    @(posedge clk); #1;');
    lines.push('    $write("V");');
    lines.push(sample);
    lines.push('    $display("");');
  }
  lines.push('    $finish;');
  lines.push('  end');
  lines.push('endmodule');
  return `${lines.join('\n')}\n`;
}

function runIverilog(verilog: string, files: Record<string, string>, tb: string): string[][] {
  const dir = mkdtempSync(join(tmpdir(), 'simten-diff-'));
  try {
    writeFileSync(join(dir, 'dut.v'), verilog);
    writeFileSync(join(dir, 'tb.v'), tb);
    for (const [name, contents] of Object.entries(files)) writeFileSync(join(dir, name), contents);
    const compile = spawnSync('iverilog', ['-g2012', '-o', 'sim.vvp', 'tb.v', 'dut.v'], {
      cwd: dir,
      encoding: 'utf8',
    });
    if (compile.status !== 0) {
      throw new Error(`iverilog failed:\n${compile.stderr}${compile.stdout}`);
    }
    const out = execFileSync('vvp', ['-n', 'sim.vvp'], {
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    return out
      .split('\n')
      .filter((l) => l.startsWith('V'))
      .map((l) => l.slice(1).trim().split(/\s+/).filter(Boolean));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Compare `target` in the simulator against iverilog.
 *
 * By default iverilog runs the exporter's Verilog for `target`. With a
 * `reference` it runs that source instead (the import cases: simulate what
 * the importer made of a design, against the design itself), and only top
 * outputs are compared, since internal names don't line up.
 */
export function runDifferential(
  target: DiffTarget,
  opts: DiffOptions,
  reference?: Reference,
): DiffResult {
  let verilog: string;
  let files: Record<string, string> = {};
  let moduleName: string;
  let clockPorts: string[];
  let signals: Signal[];
  if (reference) {
    verilog = reference.verilog;
    moduleName = reference.module;
    clockPorts = reference.clock ? [`.${reference.clock}(clk)`] : [];
    signals = topSignals(target.top);
  } else {
    const result = exportVerilog(target.top, target.library);
    if (result.unsupported) {
      throw new Error(`exporter has no mapping for ${Object.keys(result.unsupported).join(', ')}`);
    }
    verilog = result.verilog;
    files = result.files;
    moduleName = sanitizeId(target.top.name);
    clockPorts = /^\s*input clk,?$/m.test(verilog) ? ['.clk(clk)', '.rst_n(rst_n)'] : [];
    signals = [...topSignals(target.top), ...internalSignals(target, verilog)];
  }

  const vectors = makeVectors(target.top, opts);
  const simTrace = runSimulator(target, vectors, signals);
  const vTrace = runIverilog(
    verilog,
    files,
    testbench(target.top, moduleName, clockPorts, vectors, signals),
  );
  if (vTrace.length !== vectors.length) {
    throw new Error(`iverilog printed ${vTrace.length} samples, expected ${vectors.length}`);
  }

  const mismatches: Mismatch[] = [];
  for (let c = 0; c < vectors.length; c++) {
    signals.forEach((s, i) => {
      const simV = simTrace[c][i];
      const raw = vTrace[c][i] ?? '';
      // Low `width` bits of the hex string; an x/z digit among them is a mismatch.
      const digits = raw.slice(-Math.ceil(s.width / 4));
      const vV = /^[0-9a-f]+$/i.test(digits)
        ? (Number.parseInt(digits, 16) & maskOf(s.width)) >>> 0
        : undefined;
      if (simV === undefined || vV === undefined || simV !== vV) {
        mismatches.push({
          cycle: c + 1,
          signal: `${s.label} [${s.width}]`,
          sim: hex(simV),
          verilog: vV === undefined ? raw : hex(vV),
        });
      }
    });
  }
  return { signals: signals.length, cycles: vectors.length, mismatches };
}

/** Count and first few mismatches, for the failure message. */
export function describeMismatches(r: DiffResult): string {
  const head = r.mismatches
    .slice(0, 8)
    .map((m) => `  cycle ${m.cycle} ${m.signal}: sim=${m.sim} iverilog=${m.verilog}`);
  return [
    `${r.mismatches.length} mismatches over ${r.cycles} cycles x ${r.signals} signals`,
    ...head,
  ].join('\n');
}
