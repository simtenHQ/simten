/**
 * RV32I CPU project descriptor.
 *
 * Produces Verilog combining the exported RV32I_CPU_Core with cpu_top.v.
 * Firmware is compiled via the Cloudflare compiler service and loaded via
 * $readmemh("firmware.hex", imem) — this keeps the BRAM init patchable by
 * ecpbram, so firmware-only edits can hit the synth container's /patch
 * endpoint instead of re-running Yosys + nextpnr.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exportVerilog } from '@simten/core/verilog';
import { circuit, bit, bus } from '@simten/core/circuit';
import { Constant, RV32I_Core as RV32I_CoreDef } from '@simten/core/std';
import type { CircuitLibrary } from '@simten/core/simulator';

import type { Project, FirmwareBuild } from '../../lib/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Run `pnpm --filter @simten/compiler dev` first, or override with COMPILER_URL.
const COMPILER_URL = process.env.COMPILER_URL ?? 'http://localhost:55001/compile';

// Custom linker script: 2KB IMEM + 4KB DMEM (matches cpu_top.v declarations)
const LINKER_SCRIPT = `
OUTPUT_ARCH(riscv)
ENTRY(_start)

MEMORY {
    IMEM (rx)  : ORIGIN = 0x00000000, LENGTH = 2K
    DMEM (rwx) : ORIGIN = 0x00010000, LENGTH = 4K
}

SECTIONS {
    .text : {
        *(.text._start)
        *(.text*)
        *(.rodata*)
    } > IMEM

    .data : { *(.data*) } > DMEM

    .bss : {
        __bss_start = .;
        *(.bss*)
        *(COMMON)
        __bss_end = .;
    } > DMEM

    __stack_top = ORIGIN(DMEM) + LENGTH(DMEM);
}
`;

const IMEM_WORDS = 512;
const IMEM_BYTES = IMEM_WORDS * 4;

// ── Firmware compile (Cloudflare compiler service) ─────────────────────────

async function compileFirmware(source: string, opts: { language: string }): Promise<FirmwareBuild> {
  const { language } = opts;
  const resp = (await fetch(COMPILER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, language, linkerScript: LINKER_SCRIPT, disassemble: true }),
  }).then((r) => r.json())) as {
    success: boolean;
    binary?: string;
    disassembly?: string;
    stderr?: string;
    error?: string;
  };

  if (!resp.success) {
    throw new Error(resp.error ?? resp.stderr ?? 'compiler service failed');
  }
  const binary = new Uint8Array(Buffer.from(resp.binary!, 'base64'));
  return { binary, disassembly: resp.disassembly };
}

// ── Binary → $readmemh hex ─────────────────────────────────────────────────

export function binaryToReadmemh(binary: Uint8Array, numWords: number = IMEM_WORDS): string {
  const padded = new Uint8Array(numWords * 4);
  padded.set(binary.slice(0, Math.min(binary.length, numWords * 4)));

  const lines: string[] = [];
  for (let i = 0; i < numWords; i++) {
    const b0 = padded[i * 4 + 0];
    const b1 = padded[i * 4 + 1];
    const b2 = padded[i * 4 + 2];
    const b3 = padded[i * 4 + 3];
    const word = ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
    lines.push(word.toString(16).padStart(8, '0'));
  }
  return lines.join('\n') + '\n';
}

// ── Binary → Verilog inline initial block ──────────────────────────────────
// Reliably bakes firmware directly into the netlist. The $readmemh-based
// alternative doesn't survive synthesis in the current oss-cad-suite synth
// container (BRAM init is silently dropped), so we rewrite cpu_top.v to
// substitute this block in place of the $readmemh directive at synth time.

export function binaryToInlineInit(binary: Uint8Array, numWords: number = IMEM_WORDS): string {
  const padded = new Uint8Array(numWords * 4);
  padded.set(binary.slice(0, Math.min(binary.length, numWords * 4)));

  const lines: string[] = ['    initial begin'];
  for (let i = 0; i < numWords; i++) {
    const b0 = padded[i * 4 + 0];
    const b1 = padded[i * 4 + 1];
    const b2 = padded[i * 4 + 2];
    const b3 = padded[i * 4 + 3];
    const word = ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
    if (word !== 0) {
      lines.push(`        imem[${i}] = 32'h${word.toString(16).padStart(8, '0')};`);
    }
  }
  lines.push('    end');
  return lines.join('\n');
}

// ── RV32I_CPU_Core circuit (verbatim from old cpu_build.ts:151-339) ────────

export function buildCPUCore() {
  const RV32I_Core = RV32I_CoreDef();

  const RV32I_CPU_Core = circuit('RV32I_CPU_Core', {
    inputs: { instruction: bus(32), data_read: bus(32) },
    outputs: {
      instr_addr: bus(32),
      data_addr: bus(32),
      data_write: bus(32),
      data_mem_read: bit,
      data_mem_write: bit,
      data_funct3: bus(3),
    },
    nodes: {
      cpu: RV32I_Core,
      zero32: Constant({ value: 0, width: 32 }),
      zero1: Constant({ value: 0, width: 1 }),
    },
    connect: ({ inputs, outputs, nodes: { cpu, zero32, zero1 } }) => [
      inputs.instruction.to(cpu.instruction),
      inputs.data_read.to(cpu.data_read),
      zero32.out.to(cpu.net_rx_data),
      zero1.out.to(cpu.net_rx_valid, cpu.net_rx_frame),
      cpu.instr_addr.to(outputs.instr_addr),
      cpu.data_addr.to(outputs.data_addr),
      cpu.data_write.to(outputs.data_write),
      cpu.data_mem_read.to(outputs.data_mem_read),
      cpu.data_mem_write.to(outputs.data_mem_write),
      cpu.data_funct3.to(outputs.data_funct3),
    ],
  });

  const lib: CircuitLibrary = {
    resolveCircuit: (name) => {
      if (name === 'RV32I_CPU_Core') return RV32I_CPU_Core.circuit;
      if (name === 'RV32I_Core') return RV32I_Core.circuit;
      return (
        RV32I_CPU_Core._dependencies.get(name)?.circuit ??
        RV32I_Core._dependencies.get(name)?.circuit
      );
    },
    getAllPrimitiveNames: () => [
      ...new Set([...RV32I_CPU_Core._dependencies.keys(), ...RV32I_Core._dependencies.keys()]),
    ],
  };

  return { circuit: RV32I_CPU_Core.circuit, built: RV32I_CPU_Core, lib };
}

// ── Project descriptor ─────────────────────────────────────────────────────

export const project: Project = {
  name: 'cpu',
  projectDir: __dirname,
  bitFile: 'cpu.bit',
  defaultTimeoutMs: 5000,
  uart: { baud: 115200 },

  firmware: {
    imemBytes: IMEM_BYTES,
    compile: compileFirmware,
  },

  async buildVerilog(ctx) {
    if (!ctx.firmware) throw new Error('cpu project requires firmware');
    const hex = binaryToReadmemh(ctx.firmware.binary);
    const inlineInit = binaryToInlineInit(ctx.firmware.binary);

    const { circuit: cpuCircuit, lib } = buildCPUCore();
    const { verilog: cpuVerilog } = exportVerilog(cpuCircuit, lib, {
      target: 'synthesis',
      topModuleName: 'RV32I_CPU_Core',
    });

    const wrapperVerilog = readFileSync(resolve(__dirname, 'cpu_top.v'), 'utf8');
    const lpf = readFileSync(resolve(__dirname, 'ulx3s_cpu.lpf'), 'utf8');

    // Substitute inline init for $readmemh — bakes firmware into the netlist.
    // The $readmemh path in the current synth container silently drops BRAM
    // init, so the CPU would boot with garbage IMEM. This matches the
    // behavior of the original cpu_build.ts.
    const wrapperPatched = wrapperVerilog.replace(
      /\s*initial \$readmemh\("firmware\.hex",\s*imem\);/,
      '\n' + inlineInit,
    );
    const combinedVerilog = cpuVerilog + '\n\n' + wrapperPatched;

    // Find the byte range of the inline init block in combinedVerilog so the
    // pipeline cache can key on Verilog-with-firmware-zeroed (future fast
    // path via a /patch endpoint that regenerates the inline init).
    const initStart = combinedVerilog.indexOf(inlineInit);
    const firmwareInitRange =
      initStart >= 0 ? { start: initStart, end: initStart + inlineInit.length } : undefined;

    return {
      verilog: combinedVerilog,
      topModule: 'cpu_top',
      lpf,
      device: { chip: 'LFE5U-85F', package: 'CABGA381', sizeFlag: '85k' },
      extraFiles: { 'firmware.hex': hex },
      firmwareInitRange,
    };
  },
};
