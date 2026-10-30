/**
 * What the server teaches has to run. get_grammar's module and every example
 * get_started writes are loaded here as real modules, with their own imports,
 * against the current @simten/core, and simulated.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Circuit, simulate } from '@simten/core';
import { EXAMPLES } from '@simten/core/examples';
import { isCircuit, nodesOf } from '@simten/core/internal';
import { afterAll, describe, expect, it } from 'vitest';
import { materializeExample } from './get_started.js';
import { GRAMMAR } from './grammar.js';

// Inside the package, so the files' imports resolve to this workspace's core.
const tmpRoot = join(import.meta.dirname, '..', '..', '.teaching-tmp');
mkdirSync(tmpRoot, { recursive: true });
const dir = mkdtempSync(join(tmpRoot, 'run-'));
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

async function load(name: string, source: string): Promise<Record<string, unknown>> {
  const file = join(dir, `${name}.circuit.ts`);
  writeFileSync(file, source);
  return import(pathToFileURL(file).href);
}

function circuitOf(module: Record<string, unknown>, name: string): Circuit {
  const made = module[name];
  if (!isCircuit(made)) throw new Error(`${name} is not an exported circuit`);
  return made as Circuit;
}

describe('get_grammar', () => {
  it('imports everything it uses and exports every circuit', async () => {
    const grammar = await load('grammar', GRAMMAR);
    expect(Object.keys(grammar).sort()).toEqual(['Adder8', 'ByteNot', 'Counter', 'HalfAdder']);
  });

  it('HalfAdder adds', async () => {
    const s = simulate(circuitOf(await load('grammar', GRAMMAR), 'HalfAdder'));
    s.set({ a: 1, b: 1 });
    expect(s.read()).toEqual({ sum: 0, carry: 1 });
  });

  it('Counter counts', async () => {
    const s = simulate(circuitOf(await load('grammar', GRAMMAR), 'Counter'));
    s.tick(3);
    expect(s.get('count')).toBe(3);
  });

  it('ByteNot is driven by its Switch paths, as the comment says', async () => {
    const s = simulate(circuitOf(await load('grammar', GRAMMAR), 'ByteNot'));
    s.set({ a0: 1 });
    const ports = nodesOf(s).ports();
    expect(ports.get('n0.out')).toBe(0);
    expect(ports.get('n1.out')).toBe(1);
  });

  it('Adder8 adds with carry', async () => {
    const s = simulate(circuitOf(await load('grammar', GRAMMAR), 'Adder8'));
    s.set({ a: 200, b: 100 });
    expect(s.read()).toEqual({ sum: 44, carry: 1 });
  });
});

describe('get_started examples', () => {
  // npm-importing examples (e.g. figlet) resolve via esm.sh in the browser only.
  const local = EXAMPLES.filter(
    (ex) => !/^\s*import\s.+from\s+['"](?!@simten)[^'".][^'"]*['"]/m.test(ex.code),
  );

  for (const ex of local) {
    it(`"${ex.id}" loads as a module and simulates`, async () => {
      const module = await load(ex.id.replace(/\W/g, '_'), materializeExample(ex));
      const circuits = Object.values(module).filter(isCircuit);
      expect(circuits.length).toBeGreaterThan(0);
      const top = circuits[circuits.length - 1] as Circuit;
      const s = simulate(top);
      s.tick(2);
      expect(s.read()).toBeTypeOf('object');
    });
  }
});
