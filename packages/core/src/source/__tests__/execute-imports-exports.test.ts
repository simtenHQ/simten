import { describe, expect, it } from 'vitest';
import { simulate } from '../../simulator/simulate.js';
import { executeCircuitCode, executeJsCode, stripExports, stripImports } from '../execute.js';

describe('stripExports', () => {
  it('drops the export keyword but keeps the declaration', () => {
    expect(stripExports('export const X = 1;')).toBe('const X = 1;');
    expect(stripExports('export function f() {}')).toBe('function f() {}');
    expect(stripExports('  export class C {}')).toBe('  class C {}');
  });
  it('removes `export { … }` re-export statements entirely', () => {
    expect(stripExports('export { a, b };').trim()).toBe('');
    expect(stripExports("export { a } from './x.js';").trim()).toBe('');
  });
  it('leaves non-export code untouched', () => {
    expect(stripExports('const exported = 1;')).toBe('const exported = 1;');
  });
});

describe('executeJsCode tolerates real import + export (new Function chokepoint)', () => {
  it('runs source that imports the builder from @simten/core/circuit (decision 0010)', () => {
    // Drafts and share links saved before 0010 use the removed path. Import
    // lines are stripped before source runs, so the path itself never matters.
    const code = `
      import { circuit, bit } from '@simten/core/circuit';
      import { Not } from '@simten/core/std';
      export const Inv = circuit('Inv', {
        inputs: { a: bit }, outputs: { y: bit }, nodes: { n: Not },
        connect: ({ inputs, outputs, nodes: { n } }) => [inputs.a.to(n.in), n.out.to(outputs.y)],
      });
    `;
    const result = executeCircuitCode(code);
    expect(result.error).toBeNull();
    const [inv] = result.exported;
    expect(inv?.name).toBe('Inv');
    const sim = simulate(inv);
    sim.set({ a: 1 });
    expect(sim.get('y')).toBe(0);
  });

  it('collects an exported circuit whose file carries imports', () => {
    const code = `
      import { circuit, bit } from '@simten/core';
      import { Not } from '@simten/core/std';
      export const Inv = circuit('Inv', {
        inputs: { a: bit }, outputs: { y: bit }, nodes: { n: Not },
        connect: ({ inputs, outputs, nodes: { n } }) => [inputs.a.to(n.in), n.out.to(outputs.y)],
      });
    `;
    const r = executeJsCode(code);
    expect(r.error).toBeNull();
    expect(r.circuits.map((c) => c.name)).toContain('Inv');
  });
});

describe('stripImports', () => {
  it('removes import statements, leaves the rest', () => {
    expect(stripImports("import { x } from 'm';\nconst y = 1;")).toContain('const y = 1;');
    expect(stripImports("import { x } from 'm';")).not.toMatch(/import/);
  });
});
