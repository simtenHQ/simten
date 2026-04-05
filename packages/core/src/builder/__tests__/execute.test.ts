import { describe, it, expect } from 'vitest';
import { executeComponentCode, stripTypes } from '../execute.js';

// ============================================================================
// Type stripping
// ============================================================================

describe('stripTypes', () => {
  it('strips type annotations from parameters', () => {
    const ts = `const Register = (width: number) => component('Reg', {})`;
    const js = stripTypes(ts);
    expect(js).not.toContain(': number');
    expect(js).toContain('(width)');
  });

  it('strips interface declarations', () => {
    const ts = `interface Foo { x: number }\nconst a = 1`;
    const js = stripTypes(ts);
    expect(js).not.toContain('interface');
    expect(js).toContain('const a = 1');
  });

  it('preserves regular JavaScript', () => {
    const code = `const x = component('Test', { in: { a: bit } })`;
    expect(stripTypes(code)).toContain(code);
  });
});

// ============================================================================
// Basic execution
// ============================================================================

describe('executeComponentCode', () => {
  it('executes a simple AND gate', () => {
    const result = executeComponentCode(`
      const MyAnd = component('MyAnd', {
        in: { a: bit, b: bit },
        out: { out: bit },
        eval: ({ a, b }) => ({ out: (a && b) ? 1 : 0 }),
      })
    `);

    expect(result.error).toBeNull();
    expect(result.circuit).not.toBeNull();
    expect(result.circuit!.name).toBe('MyAnd');
    expect(result.circuits).toHaveLength(1);
  });

  it('executes a composite circuit using stdlib', () => {
    const result = executeComponentCode(`
      const HalfAdder = component('HalfAdder', {
        in: { a: bit, b: bit },
        out: { sum: bit, carry: bit },
        nodes: { x: Xor, a: And },
        connect: ({ in: inp, out, x, a }) => [
          inp.a.to(x.a, a.a),
          inp.b.to(x.b, a.b),
          x.out.to(out.sum),
          a.out.to(out.carry),
        ],
      })
    `);

    expect(result.error).toBeNull();
    expect(result.circuit!.name).toBe('HalfAdder');
    expect(result.circuit!.nodes).toHaveLength(2);
    expect(result.circuit!.connections).toHaveLength(6);
  });

  it('collects multiple circuits', () => {
    const result = executeComponentCode(`
      const A = component('CompA', {
        in: { x: bit },
        out: { y: bit },
        eval: ({ x }) => ({ y: x }),
      })

      const B = component('CompB', {
        in: { x: bit },
        out: { y: bit },
        eval: ({ x }) => ({ y: x ? 0 : 1 }),
      })
    `);

    expect(result.error).toBeNull();
    expect(result.circuits).toHaveLength(2);
    expect(result.circuits[0].name).toBe('CompA');
    expect(result.circuits[1].name).toBe('CompB');
    expect(result.circuit!.name).toBe('CompB');
  });

  it('handles TypeScript syntax', () => {
    const result = executeComponentCode(`
      const width: number = 8
      const MyAdder = component('MyAdder', {
        in: { a: bus(width), b: bus(width) },
        out: { sum: bus(width) },
        eval: ({ a, b }: { a: number; b: number }) => ({ sum: (a + b) & 0xFF }),
      })
    `);

    expect(result.error).toBeNull();
    expect(result.circuit!.name).toBe('MyAdder');
    expect(result.circuit!.inputs[0].portType).toEqual({ kind: 'bus', width: 8 });
  });

  it('handles parameterized component factories', () => {
    const result = executeComponentCode(`
      const makeReg = (w: number) => component('Reg' + w, {
        in: { d: bus(w) },
        out: { q: bus(w) },
        state: { stored: 0 },
        eval: ({ stored }) => ({ q: stored }),
        onTick: ({ d }) => ({ stored: d }),
      })

      const Reg8 = makeReg(8)
      const Reg16 = makeReg(16)
    `);

    expect(result.error).toBeNull();
    expect(result.circuits).toHaveLength(2);
    expect(result.circuits[0].name).toBe('Reg8');
    expect(result.circuits[1].name).toBe('Reg16');
  });

  it('stdlib components are available without imports', () => {
    const result = executeComponentCode(`
      const Demo = component('Demo', {
        in: { a: bit },
        out: { b: bit },
        nodes: { n: Not },
        connect: ({ in: inp, out, n }) => [
          inp.a.to(n.in),
          n.out.to(out.b),
        ],
      })
    `);

    expect(result.error).toBeNull();
    expect(result.circuit!.nodes[0].componentRef).toBe('Not');
  });

  it('registers user circuits in the library', () => {
    const result = executeComponentCode(`
      const MyGate = component('MyGate', {
        in: { a: bit },
        out: { out: bit },
        eval: ({ a }) => ({ out: a }),
      })
    `);

    expect(result.library.resolveComponent('MyGate')).toBeDefined();
  });
});

// ============================================================================
// Error handling
// ============================================================================

describe('error handling', () => {
  it('returns error for syntax errors', () => {
    const result = executeComponentCode(`const x = {{{`);
    expect(result.error).not.toBeNull();
    expect(result.circuit).toBeNull();
  });

  it('returns error for runtime errors', () => {
    const result = executeComponentCode(`
      const x = component('Bad', {
        in: { a: bit },
        out: { a: bit },
      })
    `);
    expect(result.error).not.toBeNull();
    expect(result.error).toContain('both input and output');
  });

  it('returns empty result for code with no circuits', () => {
    const result = executeComponentCode(`const x = 42`);
    expect(result.error).toBeNull();
    expect(result.circuit).toBeNull();
    expect(result.circuits).toHaveLength(0);
  });
});
