/**
 * Breakout Raster Frame Test
 *
 * Compiles dsl-files/Breakout.dsl, runs it frame-by-frame (100 ticks per frame
 * for the 10x10 raster scan grid), and logs ball position + velocity after each
 * frame to diagnose physics issues.
 *
 * RasterDisplay scan grid: scanX 0-9, scanY 0-9 (8-9 are blanking regions).
 * One full frame = 100 ticks.
 * State updates happen on vblank (scanY >= 8), which spans ticks 80-89 in a frame.
 *
 * Expected initial state: ballX=3, ballY=4, ballDX=1, ballDY=1
 * Expected trajectory:    (3,4) → (4,5) → (5,6) → ...diagonal
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDSL } from '../../dsl/parser/index.js';
import { compileToIR } from '../../dsl/compiler/index.js';
import { PRIMITIVES } from '../primitives.js';
import { createComponentLibrary, createSimulatorFromCircuit } from '../index.js';
import type { Circuit } from '../../types/circuit.js';
import type { SimulatorEngine } from '../../types/simulator.js';

// ============================================================================
// Test Setup
// ============================================================================

function makeCompilerLibrary(simLibrary: ReturnType<typeof createComponentLibrary>) {
  return {
    getCircuit: (name: string) => simLibrary.resolveComponent(name),
    hasCircuit: (name: string) => simLibrary.resolveComponent(name) !== undefined,
    addCircuit: (_circuit: Circuit) => {},
  };
}

let breakoutCircuit: Circuit;
let simLibrary: ReturnType<typeof createComponentLibrary>;

beforeAll(() => {
  // __tests__ -> simulator -> src -> packages/core -> packages -> repo root
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
  const dslPath = join(repoRoot, 'dsl-files/Breakout.dsl');
  const source = readFileSync(dslPath, 'utf-8');

  simLibrary = createComponentLibrary(PRIMITIVES as Circuit[]);
  const compilerLib = makeCompilerLibrary(simLibrary);

  const { ast, errors } = parseDSL(source, 'Breakout.dsl');
  if (errors.length > 0) {
    throw new Error(`Parse errors:\n${errors.map(e => `  ${e.severity}: ${e.message} (line ${e.location.start.line})`).join('\n')}`);
  }

  const circuits = compileToIR(ast, compilerLib);
  const found = circuits.find(c => c.name === 'Breakout');
  if (!found) {
    throw new Error('Breakout circuit not found in compiled output');
  }
  breakoutCircuit = found;
});

function buildSim(): SimulatorEngine {
  return createSimulatorFromCircuit(breakoutCircuit, simLibrary);
}

// ============================================================================
// Port Value Helpers
// ============================================================================

/**
 * Read a register's Q output by searching for the node name segment in port keys.
 * Flat node IDs have the form "Breakout_<nodeName>_<timestamp>_<hash>".
 */
function regQ(pv: ReadonlyMap<string, boolean | number>, name: string): number {
  const exact = pv.get(`${name}.q`);
  if (exact !== undefined) return exact as number;

  const suffix = `.q`;
  const segment = `_${name}_`;
  for (const [key, val] of pv) {
    if (key.endsWith(suffix) && key.includes(segment)) {
      return val as number;
    }
  }
  throw new Error(
    `Register port ${name}.q not found. Available keys containing '${name}': ` +
    `[${Array.from(pv.keys()).filter(k => k.toLowerCase().includes(name.toLowerCase())).join(', ')}]`
  );
}

/**
 * Read a combinational node's output port by name.
 */
function nodeOut(pv: ReadonlyMap<string, boolean | number>, nodeName: string, portName: string = 'out'): number | boolean {
  const exact = pv.get(`${nodeName}.${portName}`);
  if (exact !== undefined) return exact;

  const segment = `_${nodeName}_`;
  for (const [key, val] of pv) {
    if (key.endsWith(`.${portName}`) && key.includes(segment)) {
      return val;
    }
  }
  throw new Error(
    `Node port ${nodeName}.${portName} not found. Available keys containing '${nodeName}': ` +
    `[${Array.from(pv.keys()).filter(k => k.toLowerCase().includes(nodeName.toLowerCase())).join(', ')}]`
  );
}

/**
 * Advance the simulator by N ticks and return final portValues
 * via getPortValues() (Phase 5 post-commit, reflects committed register state).
 */
function tickN(sim: SimulatorEngine, n: number): ReadonlyMap<string, boolean | number> {
  for (let i = 0; i < n; i++) {
    sim.tick();
  }
  return sim.getPortValues();
}

// ============================================================================
// Frame Constants
// ============================================================================

/** 10x10 raster: 100 ticks per frame */
const TICKS_PER_FRAME = 100;

// ============================================================================
// Tests
// ============================================================================

describe('Breakout Raster Frame Physics', () => {

  it('compiles without errors', () => {
    expect(breakoutCircuit).toBeDefined();
    expect(breakoutCircuit.name).toBe('Breakout');
  });

  it('initial state: ballX=3, ballY=4, DX=1, DY=1', () => {
    const sim = buildSim();
    const pv = sim.getPortValues();

    const x = regQ(pv, 'ballX');
    const y = regQ(pv, 'ballY');
    const dx = regQ(pv, 'ballDX');
    const dy = regQ(pv, 'ballDY');

    expect(x).toBe(3);
    expect(y).toBe(4);
    expect(dx).toBe(1);
    expect(dy).toBe(1);
  });

  it('ball trajectory log — 20 frames with full position and velocity', () => {
    const sim = buildSim();

    const trajectory: Array<{ frame: number; x: number; y: number; dx: number; dy: number }> = [];

    // Record initial state (frame 0)
    {
      const pv = sim.getPortValues();
      trajectory.push({
        frame: 0,
        x: regQ(pv, 'ballX'),
        y: regQ(pv, 'ballY'),
        dx: regQ(pv, 'ballDX'),
        dy: regQ(pv, 'ballDY'),
      });
    }

    for (let frame = 1; frame <= 20; frame++) {
      const pv = tickN(sim, TICKS_PER_FRAME);
      trajectory.push({
        frame,
        x: regQ(pv, 'ballX'),
        y: regQ(pv, 'ballY'),
        dx: regQ(pv, 'ballDX'),
        dy: regQ(pv, 'ballDY'),
      });
    }

    // Log the full trajectory for inspection
    console.log('\n=== Breakout Ball Trajectory (20 frames, 100 ticks/frame) ===');
    console.log('Frame | ballX | ballY | ballDX | ballDY | Notes');
    console.log('------|-------|-------|--------|--------|------');
    for (const { frame, x, y, dx, dy } of trajectory) {
      const dxStr = dx === 255 ? '-1' : `+${dx}`;
      const dyStr = dy === 255 ? '-1' : `+${dy}`;
      const notes: string[] = [];
      if (x === 0 && dx === 255) notes.push('AT_LEFT_WALL');
      if (x === 7 && dx === 1)   notes.push('AT_RIGHT_WALL');
      if (y === 0 && dy === 255) notes.push('AT_TOP_WALL');
      if (y === 7)               notes.push('AT_BOTTOM_ROW');
      console.log(
        `  ${String(frame).padStart(3)} | ${String(x).padStart(5)} | ${String(y).padStart(5)} | ${dxStr.padStart(6)} | ${dyStr.padStart(6)} | ${notes.join(', ')}`
      );
    }
    console.log('');

    // The ball must actually move from its starting position
    const afterFrame1 = trajectory[1];
    expect(afterFrame1.x).not.toBe(trajectory[0].x);
    expect(afterFrame1.y).not.toBe(trajectory[0].y);
  });

  it('ball moves diagonally — position advances by (DX,DY) each frame (mod 8)', () => {
    const sim = buildSim();
    let prev = {
      x: regQ(sim.getPortValues(), 'ballX'),
      y: regQ(sim.getPortValues(), 'ballY'),
      dx: regQ(sim.getPortValues(), 'ballDX'),
      dy: regQ(sim.getPortValues(), 'ballDY'),
    };

    const failures: string[] = [];

    for (let frame = 1; frame <= 20; frame++) {
      // Capture dx/dy BEFORE the tick so we know what the ball should move by
      const expectedX = (prev.x + (prev.dx <= 127 ? prev.dx : prev.dx - 256)) & 0x7;
      const expectedY = (prev.y + (prev.dy <= 127 ? prev.dy : prev.dy - 256)) & 0x7;

      const pv = tickN(sim, TICKS_PER_FRAME);
      const curr = {
        x: regQ(pv, 'ballX'),
        y: regQ(pv, 'ballY'),
        dx: regQ(pv, 'ballDX'),
        dy: regQ(pv, 'ballDY'),
      };

      // Ball must move to (prevX + signedDX) mod 8 unless a bounce occurred
      // After a bounce, newDX/newDY may change — we just check that the velocity
      // stays valid (1 or 255) and that position is consistent with SOME velocity
      if (curr.dx !== 1 && curr.dx !== 255) {
        failures.push(`Frame ${frame}: ballDX=${curr.dx} is not 1 or 255`);
      }
      if (curr.dy !== 1 && curr.dy !== 255) {
        failures.push(`Frame ${frame}: ballDY=${curr.dy} is not 1 or 255`);
      }

      // Check that ball actually moved (never frozen)
      if (curr.x === prev.x && curr.y === prev.y) {
        failures.push(`Frame ${frame}: ball did not move (stuck at x=${curr.x}, y=${curr.y})`);
      }

      // If no bounce happened (velocity unchanged), position must exactly match
      const dxChanged = curr.dx !== prev.dx;
      const dyChanged = curr.dy !== prev.dy;
      if (!dxChanged) {
        // X velocity unchanged — X must have advanced by prev.dx
        if (curr.x !== expectedX) {
          failures.push(
            `Frame ${frame}: X=${curr.x} expected ${expectedX} (prev=${prev.x} + dx=${prev.dx})`
          );
        }
      }
      if (!dyChanged) {
        // Y velocity unchanged — Y must have advanced by prev.dy
        if (curr.y !== expectedY) {
          failures.push(
            `Frame ${frame}: Y=${curr.y} expected ${expectedY} (prev=${prev.y} + dy=${prev.dy})`
          );
        }
      }

      prev = curr;
    }

    if (failures.length > 0) {
      console.log('\n=== Physics Failures ===');
      failures.forEach(f => console.log('  ' + f));
    }

    expect(failures).toEqual([]);
  });

  it('ball reaches row 7 and bounces off paddle (DY flips)', () => {
    const sim = buildSim();

    let seenRow7 = false;
    let dyFlippedFromDown = false;
    let prevDY = regQ(sim.getPortValues(), 'ballDY');

    for (let frame = 1; frame <= 30; frame++) {
      const pv = tickN(sim, TICKS_PER_FRAME);
      const y  = regQ(pv, 'ballY');
      const dy = regQ(pv, 'ballDY');

      if (y === 7) seenRow7 = true;
      // DY was 1 (moving down) and flipped to 255 (moving up) = paddle hit
      if (prevDY === 1 && dy === 255) {
        dyFlippedFromDown = true;
        console.log(`\nPaddle bounce detected at frame ${frame}, ballY=${y}`);
        break;
      }
      prevDY = dy;
    }

    expect(seenRow7).toBe(true);
    expect(dyFlippedFromDown).toBe(true);
  });

  it('top wall bounce — DY flips from 255 (up) to 1 (down)', () => {
    const sim = buildSim();

    let topBounced = false;
    let prevDY = regQ(sim.getPortValues(), 'ballDY');

    for (let frame = 1; frame <= 60; frame++) {
      const pv = tickN(sim, TICKS_PER_FRAME);
      const dy = regQ(pv, 'ballDY');

      // DY was 255 (moving up) and flipped to 1 (moving down) = top wall hit
      if (prevDY === 255 && dy === 1) {
        topBounced = true;
        const y = regQ(pv, 'ballY');
        console.log(`\nTop wall bounce at frame ${frame}, ballY=${y}`);
        break;
      }
      prevDY = dy;
    }

    expect(topBounced).toBe(true);
  });

  it('velocity is always 1 or 255 — no corrupted velocity values', () => {
    const sim = buildSim();

    for (let frame = 1; frame <= 30; frame++) {
      const pv = tickN(sim, TICKS_PER_FRAME);
      const dx = regQ(pv, 'ballDX');
      const dy = regQ(pv, 'ballDY');

      expect(
        dx === 1 || dx === 255,
        `Frame ${frame}: ballDX=${dx} is not 1 or 255`
      ).toBe(true);
      expect(
        dy === 1 || dy === 255,
        `Frame ${frame}: ballDY=${dy} is not 1 or 255`
      ).toBe(true);
    }
  });

  it('ball never stays frozen for two consecutive frames', () => {
    const sim = buildSim();

    let prevX = regQ(sim.getPortValues(), 'ballX');
    let prevY = regQ(sim.getPortValues(), 'ballY');

    for (let frame = 1; frame <= 20; frame++) {
      const pv = tickN(sim, TICKS_PER_FRAME);
      const x = regQ(pv, 'ballX');
      const y = regQ(pv, 'ballY');

      expect(
        x !== prevX || y !== prevY,
        `Frame ${frame}: ball frozen at (${x}, ${y})`
      ).toBe(true);

      prevX = x;
      prevY = y;
    }
  });

  it('vblank fires exactly once per frame (in ticks 80-89)', () => {
    const sim = buildSim();

    // In a fresh sim, scan starts at (0,0). vblank fires when scanY >= 8.
    // That means ticks 80-89 of each frame have vblank=1.
    let vblankCount = 0;

    for (let tick = 0; tick < TICKS_PER_FRAME; tick++) {
      const pv = sim.tick().portValues;
      // Find vblank signal from the display node
      for (const [key, val] of pv) {
        if (key.endsWith('.vblank') && key.toLowerCase().includes('display')) {
          if (val === true || val === 1) {
            vblankCount++;
          }
          break;
        }
      }
    }

    console.log(`\nvblank high for ${vblankCount} ticks in first frame`);
    // scanY=8 and scanY=9: each has 10 scanX positions = 20 ticks total
    expect(vblankCount).toBe(20);
  });

  it('detailed frame-by-frame trace: first 12 frames with pre/post state', () => {
    const sim = buildSim();

    console.log('\n=== Detailed 12-Frame Trace ===');

    let prevX = regQ(sim.getPortValues(), 'ballX');
    let prevY = regQ(sim.getPortValues(), 'ballY');
    let prevDX = regQ(sim.getPortValues(), 'ballDX');
    let prevDY = regQ(sim.getPortValues(), 'ballDY');

    for (let frame = 1; frame <= 12; frame++) {
      const pv = tickN(sim, TICKS_PER_FRAME);
      const x  = regQ(pv, 'ballX');
      const y  = regQ(pv, 'ballY');
      const dx = regQ(pv, 'ballDX');
      const dy = regQ(pv, 'ballDY');

      // Signed interpretation of velocity (255 = -1 in 8-bit unsigned)
      const signedDX = prevDX > 127 ? prevDX - 256 : prevDX;
      const signedDY = prevDY > 127 ? prevDY - 256 : prevDY;

      const expectedX = (prevX + signedDX) & 0x7;
      const expectedY = (prevY + signedDY) & 0x7;

      const xOk = x === expectedX;
      const yOk = y === expectedY;
      const dxChanged = dx !== prevDX;
      const dyChanged = dy !== prevDY;

      const status = (xOk || dxChanged) && (yOk || dyChanged) ? 'OK' : 'MISMATCH';
      const xNote = !xOk ? ` [X: got ${x}, expected ${expectedX}]` : '';
      const yNote = !yOk ? ` [Y: got ${y}, expected ${expectedY}]` : '';
      const bounceNote = dxChanged || dyChanged
        ? ` BOUNCE(${dxChanged ? 'DX' : ''}${dyChanged ? 'DY' : ''})`
        : '';

      console.log(
        `  Frame ${String(frame).padStart(2)}: (${prevX},${prevY}) +` +
        `(${signedDX < 0 ? signedDX : '+' + signedDX},${signedDY < 0 ? signedDY : '+' + signedDY})` +
        ` -> (${x},${y})  DX=${dx} DY=${dy}  ${status}${xNote}${yNote}${bounceNote}`
      );

      prevX = x; prevY = y; prevDX = dx; prevDY = dy;
    }
  });
});
