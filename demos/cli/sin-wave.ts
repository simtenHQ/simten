/**
 * Sin Wave — ASCII terminal demo
 *
 * A counter steps through a 256-entry ROM preloaded with sin values.
 * The output scrolls across the terminal as a live ASCII waveform.
 *
 * Run: pnpm --filter @simten/demos sin-wave
 */

import { circuit, bus } from '@simten/core/circuit';
import { Register, Adder, ROM, Constant, romFromBytes } from '@simten/core/std';
import { createSimulatorFromCircuit, createCircuitLibrary, TOP_LEVEL_NODE } from '@simten/core';

// ── Circuit ──────────────────────────────────────────────────────────────────

// 256-sample sin LUT: maps 0–255 → 0–255 (unsigned, one full cycle)
const sinLUT = Array.from({ length: 256 }, (_, i) =>
  Math.round((Math.sin((i / 256) * 2 * Math.PI) + 1) * 127.5),
);

const SinWave = circuit('SinWave', {
  outputs: { value: bus(8), addr: bus(8) },
  nodes: {
    reg: Register({ width: 8 }),
    adder: Adder({ width: 8 }),
    rom: ROM({ memory: romFromBytes(sinLUT) }),
    one: Constant({ value: 1 }),
    we: Constant({ value: 1 }),
    zero: Constant({ value: 0 }),
  },
  connect: ({ outputs, nodes: { reg, adder, rom, one, we, zero } }) => [
    reg.q.to(adder.a),
    one.out.to(adder.b),
    zero.out.to(adder.carry_in),
    adder.sum.to(reg.data),
    we.out.to(reg.we),
    reg.q.to(rom.addr),
    rom.data_out.to(outputs.value),
    reg.q.to(outputs.addr),
  ],
});

// ── Library + Simulator ───────────────────────────────────────────────────────

// Build library from SinWave's transitive dependencies
const circuits: import('@simten/core').Circuit[] = [SinWave.circuit];
for (const [, dep] of SinWave._dependencies) {
  if (dep?.circuit) circuits.push(dep.circuit);
}
const lib = createCircuitLibrary(circuits);

const sim = createSimulatorFromCircuit(SinWave.circuit, lib);

// ── Rendering ─────────────────────────────────────────────────────────────────

const COLS = Math.min(process.stdout.columns ?? 80, 120) - 6; // leave room for y-axis
const ROWS = 20;
const TICK_MS = 40;

const history: number[] = [];

// Block characters for smooth half-row resolution
const UPPER = '▀';
const LOWER = '▄';
const FULL = '█';
const EMPTY = ' ';

function render(values: number[]) {
  const cols = Math.min(values.length, COLS);
  const slice = values.slice(-cols);

  // Build a grid: each cell is true/false (signal present)
  // Use double-resolution rows (ROWS*2 logical rows → ROWS printed rows via half-blocks)
  const logicalRows = ROWS * 2;
  const grid: boolean[][] = Array.from({ length: logicalRows }, () => Array(cols).fill(false));

  for (let col = 0; col < cols; col++) {
    const v = slice[col];
    const row = logicalRows - 1 - Math.round((v / 255) * (logicalRows - 1));
    grid[row][col] = true;
  }

  const lines: string[] = [];

  // Y-axis labels + waveform rows
  for (let r = 0; r < ROWS; r++) {
    const upper = grid[r * 2];
    const lower = grid[r * 2 + 1];

    // Y-axis label every 5 rows
    const logicalVal = Math.round(255 - (r / (ROWS - 1)) * 255);
    const label =
      r === 0
        ? '255'
        : r === ROWS - 1
          ? '  0'
          : r % 5 === 0
            ? String(logicalVal).padStart(3)
            : '   ';

    let row = '';
    for (let c = 0; c < cols; c++) {
      const u = upper[c],
        l = lower[c];
      if (u && l) row += FULL;
      else if (u) row += UPPER;
      else if (l) row += LOWER;
      else {
        // Midline axis marker
        const midRow = ROWS - 1;
        row += r === midRow ? '\x1b[2m·\x1b[0m' : EMPTY;
      }
    }

    lines.push(`\x1b[2m${label}\x1b[0m │${row}`);
  }

  // X-axis
  const currentAddr = values[values.length - 1];
  const xAxis = '    └' + '─'.repeat(cols);
  const info = `\x1b[36m  addr: ${String(currentAddr ?? 0).padStart(3)}/255   value: ${String(
    history[history.length - 1] ?? 0,
  ).padStart(3)}   cycle: ${String(history.length).padStart(5)}\x1b[0m`;

  // Move cursor to top, redraw
  process.stdout.write('\x1b[H');
  process.stdout.write(lines.join('\n') + '\n');
  process.stdout.write(xAxis + '\n');
  process.stdout.write(info + '\n');
}

// ── Run ───────────────────────────────────────────────────────────────────────

// Hide cursor, clear screen
process.stdout.write('\x1b[?25l\x1b[2J\x1b[H');

// Restore cursor on exit
process.on('SIGINT', () => {
  process.stdout.write('\x1b[?25h\n');
  process.exit(0);
});

const interval = setInterval(() => {
  const result = sim.tick();
  const value = (result.portValues.get(`${TOP_LEVEL_NODE}.value`) as number) ?? 0;
  const addr = (result.portValues.get(`${TOP_LEVEL_NODE}.addr`) as number) ?? 0;

  history.push(value);
  render(history.map((v, i) => v)); // addr tracked separately via portValues
}, TICK_MS);
