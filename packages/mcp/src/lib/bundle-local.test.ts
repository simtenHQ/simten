/**
 * show_circuit sends one source string to the sandbox, which has no file
 * system (#511). A circuit file that imports a sibling file is bundled first;
 * these cases check the bundle is one source that builds every circuit.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executeCircuitCode } from '@simten/core/internal';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bundleLocalImports, hasLocalImports } from './bundle-local.js';

const HALF_ADDER = `import { bit, circuit } from '@simten/core';
import { And, Xor } from '@simten/core/std';

export const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { xor: Xor, and: And },
  connect: ({ inputs, outputs, nodes: { xor, and } }) => [
    inputs.a.to(xor.a, and.a),
    inputs.b.to(xor.b, and.b),
    xor.out.to(outputs.sum),
    and.out.to(outputs.carry),
  ],
});
`;

const FULL_ADDER = `import { bit, circuit } from '@simten/core';
import { Or } from '@simten/core/std';
import { HalfAdder } from './half-adder.circuit';

export const FullAdder = circuit('FullAdder', {
  inputs: { a: bit, b: bit, cin: bit },
  outputs: { sum: bit, cout: bit },
  nodes: { h1: HalfAdder, h2: HalfAdder, or: Or },
  connect: ({ inputs, outputs, nodes: { h1, h2, or } }) => [
    inputs.a.to(h1.a),
    inputs.b.to(h1.b),
    h1.sum.to(h2.a),
    inputs.cin.to(h2.b),
    h2.sum.to(outputs.sum),
    h1.carry.to(or.a),
    h2.carry.to(or.b),
    or.out.to(outputs.cout),
  ],
});
`;

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'simten-bundle-'));
  writeFileSync(join(dir, 'half-adder.circuit.ts'), HALF_ADDER);
  writeFileSync(join(dir, 'full-adder.circuit.ts'), FULL_ADDER);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('hasLocalImports', () => {
  it('finds a relative import, and ignores package imports', () => {
    expect(hasLocalImports(FULL_ADDER)).toBe(true);
    expect(hasLocalImports(HALF_ADDER)).toBe(false);
    expect(hasLocalImports(`export { HalfAdder } from '../parts/half-adder';`)).toBe(true);
  });
});

describe('bundleLocalImports', () => {
  it('inlines the sibling file and leaves package imports for the sandbox', async () => {
    const bundled = await bundleLocalImports(join(dir, 'full-adder.circuit.ts'));
    if ('error' in bundled) throw new Error(bundled.error);
    expect(bundled.source).not.toContain('./half-adder');
    expect(bundled.source).toContain("from '@simten/core'".replace(/'/g, '"'));
    expect(bundled.source.indexOf("'HalfAdder'".replace(/'/g, '"'))).toBeLessThan(
      bundled.source.indexOf("'FullAdder'".replace(/'/g, '"')),
    );
  });

  it('runs as circuit source text, building the imported part first', async () => {
    const bundled = await bundleLocalImports(join(dir, 'full-adder.circuit.ts'));
    if ('error' in bundled) throw new Error(bundled.error);
    const result = executeCircuitCode(bundled.source);
    expect(result.error).toBeNull();
    expect(result.circuits.map((c) => c.name)).toEqual(['HalfAdder', 'FullAdder']);
  });

  it('reports a missing local file', async () => {
    // Used, so TypeScript keeps the import: an unused one is dropped before it's resolved.
    writeFileSync(
      join(dir, 'broken.circuit.ts'),
      `import { Nope } from './nope';\nexport const Broken = Nope;\n`,
    );
    const bundled = await bundleLocalImports(join(dir, 'broken.circuit.ts'));
    expect('error' in bundled ? bundled.error : '').toMatch(
      /Could not bundle .*broken\.circuit\.ts/,
    );
  });
});
