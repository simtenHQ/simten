import { readFileSync } from 'node:fs';
import { simulate } from '@simten/core';
import { executeCircuitCode, internalsOf } from '@simten/core/internal';
import { describe, expect, it } from 'vitest';
import { NES_SOURCE_FILE, renderNesSource } from '../scripts/gen-example.js';
import { createNes } from './board.js';
import { demoChr, demoPrg, logoBitmap, NesDemo } from './demo.js';

describe('demo cartridge', () => {
  it('draws the logo in the middle of the second frame', () => {
    const sim = createNes({
      prg: new Uint8Array(demoPrg()),
      chr: new Uint8Array(demoChr()),
      mapper: 0,
      mirroring: 'horizontal',
      battery: false,
    });
    // Frame 1 is blank while the program waits for vblank; keep frame 2.
    const pixels = new Map<number, number>();
    let frames = 0;
    let last = 0;
    while (frames < 2) {
      if (sim.get('video_we')) {
        const y = sim.get('video_y');
        if (y < last) frames++;
        last = y;
        if (frames === 1) pixels.set(y * 256 + sim.get('video_x'), sim.get('color'));
      }
      sim.tick();
    }
    const at = (x: number, y: number) => pixels.get(y * 256 + x);
    // The logo's 96×64 box starts at column 10, row 11: pixel (80, 88).
    // Every pixel in it is white on the line and backdrop off it.
    const logo = logoBitmap();
    const drawn = logo.map((row, y) => row.map((_, x) => at(80 + x, 88 + y)));
    expect(drawn).toEqual(logo.map((row) => row.map((bit) => (bit ? 0x30 : 0x0f))));
    // Outside it, backdrop.
    expect([at(10, 10), at(79, 120), at(176, 120), at(128, 87), at(128, 152)]).toEqual([
      0x0f, 0x0f, 0x0f, 0x0f, 0x0f,
    ]);
  });

  it('builds the demo board, with no ports of its own', () => {
    // No ports, so the canvas draws its insides: the NES wired to the screen.
    expect(internalsOf(NesDemo).ir.inputs).toEqual([]);
    expect(internalsOf(NesDemo).ir.outputs).toEqual([]);
    const sim = simulate(NesDemo);
    sim.tick(10);
  });
});

// Two guards: the copied text must match nes/src exactly, which covers the
// logic inside every eval and onTick; and the circuits it builds must match
// in structure (ports, nodes, wiring, options), which IR compares but which
// does not include that logic.
describe('the /circuit example', () => {
  it('nes-source.gen.ts is up to date (run `pnpm --filter @simten/nes gen:example`)', () => {
    expect(readFileSync(NES_SOURCE_FILE, 'utf8')).toBe(renderNesSource());
  });

  it('builds the same circuits as nes/src, every one', async () => {
    const { NES_SOURCE } = await import('../../packages/core/src/examples/nes-source.gen.js');
    const compiled = executeCircuitCode(NES_SOURCE);
    expect(compiled.error).toBeNull();
    expect(compiled.circuits.at(-1)?.name).toBe('NesDemo');

    // Every circuit in the tree, factories and std parts included, by name.
    const tree = (top: typeof NesDemo) =>
      new Map(
        [top, ...internalsOf(top).dependencies.values()].map((c) => [c.name, internalsOf(c).ir]),
      );
    const canonical = tree(NesDemo);
    const fromExample = tree(compiled.circuits.at(-1) as typeof NesDemo);
    expect(canonical.size).toBeGreaterThan(70);
    expect([...fromExample.keys()].sort()).toEqual([...canonical.keys()].sort());
    for (const [name, ir] of canonical) expect(fromExample.get(name), name).toEqual(ir);
  });
});
