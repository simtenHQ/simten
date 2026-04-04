/**
 * Tests for the circuit code execution engine.
 */

import { describe, it, expect } from 'vitest';
import { executeCircuitCode, stripTypes } from '../execute.js';

// ============================================================================
// Type stripping
// ============================================================================

describe('stripTypes', () => {
  it('strips type annotations from parameters', () => {
    const ts = `const Register = (width: number) => component('Reg')`;
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

  it('strips type assertions', () => {
    const ts = `const x = value as number`;
    const js = stripTypes(ts);
    expect(js).not.toContain('as number');
  });

  it('preserves regular JavaScript', () => {
    const code = `const x = component('Test').in('a', bit).build()`;
    expect(stripTypes(code)).toContain(code);
  });
});

// ============================================================================
// Basic execution
// ============================================================================

describe('executeCircuitCode', () => {
  it('executes a simple AND gate', () => {
    const result = executeCircuitCode(`
      const MyAnd = component('MyAnd')
        .in('a', bit)
        .in('b', bit)
        .out('out', bit)
        .eval(({ a, b }) => ({ out: (a && b) ? 1 : 0 }))
        .build()
    `);

    expect(result.error).toBeNull();
    expect(result.circuit).not.toBeNull();
    expect(result.circuit!.name).toBe('MyAnd');
    expect(result.circuits).toHaveLength(1);
  });

  it('executes a composite circuit using stdlib', () => {
    const result = executeCircuitCode(`
      const HalfAdder = component('HalfAdder')
        .in('a', bit)
        .in('b', bit)
        .out('sum', bit)
        .out('carry', bit)
        .node('x', Xor)
        .node('a', And)
        .connect(({ in: inp, out, x, a }) => [
          inp.a.to(x.a, a.a),
          inp.b.to(x.b, a.b),
          x.out.to(out.sum),
          a.out.to(out.carry),
        ])
        .build()
    `);

    expect(result.error).toBeNull();
    expect(result.circuit!.name).toBe('HalfAdder');
    expect(result.circuit!.nodes).toHaveLength(2);
    expect(result.circuit!.connections).toHaveLength(6);
  });

  it('collects multiple circuits', () => {
    const result = executeCircuitCode(`
      const A = component('CompA')
        .in('x', bit).out('y', bit)
        .eval(({ x }) => ({ y: x }))
        .build()

      const B = component('CompB')
        .in('x', bit).out('y', bit)
        .eval(({ x }) => ({ y: x ? 0 : 1 }))
        .build()
    `);

    expect(result.error).toBeNull();
    expect(result.circuits).toHaveLength(2);
    expect(result.circuits[0].name).toBe('CompA');
    expect(result.circuits[1].name).toBe('CompB');
    // Last circuit is the "main" one
    expect(result.circuit!.name).toBe('CompB');
  });

  it('handles TypeScript syntax', () => {
    const result = executeCircuitCode(`
      const width: number = 8
      const MyAdder = component('MyAdder')
        .in('a', bus(width))
        .in('b', bus(width))
        .out('sum', bus(width))
        .eval(({ a, b }: { a: number; b: number }) => ({ sum: (a + b) & 0xFF }))
        .build()
    `);

    expect(result.error).toBeNull();
    expect(result.circuit!.name).toBe('MyAdder');
    expect(result.circuit!.inputs[0].portType).toEqual({ kind: 'bus', width: 8 });
  });

  it('handles parameterized component factories', () => {
    const result = executeCircuitCode(`
      const makeReg = (w: number) => component('Reg' + w)
        .in('d', bus(w))
        .out('q', bus(w))
        .state({ stored: 0 })
        .eval(({ stored }) => ({ q: stored }))
        .onTick(({ d }) => ({ stored: d }))
        .build()

      const Reg8 = makeReg(8)
      const Reg16 = makeReg(16)
    `);

    expect(result.error).toBeNull();
    expect(result.circuits).toHaveLength(2);
    expect(result.circuits[0].name).toBe('Reg8');
    expect(result.circuits[1].name).toBe('Reg16');
  });

  it('stdlib components are available without imports', () => {
    const result = executeCircuitCode(`
      const Demo = component('Demo')
        .in('a', bit)
        .out('b', bit)
        .node('n', Not)
        .connect(({ in: inp, out, n }) => [
          inp.a.to(n.in),
          n.out.to(out.b),
        ])
        .build()
    `);

    expect(result.error).toBeNull();
    expect(result.circuit!.nodes[0].componentRef).toBe('Not');
  });

  it('registers user circuits in the library', () => {
    const result = executeCircuitCode(`
      const MyGate = component('MyGate')
        .in('a', bit).out('out', bit)
        .eval(({ a }) => ({ out: a }))
        .build()
    `);

    expect(result.library.resolveComponent('MyGate')).toBeDefined();
  });
});

// ============================================================================
// Error handling
// ============================================================================

describe('error handling', () => {
  it('returns error for syntax errors', () => {
    const result = executeCircuitCode(`const x = {{{`);
    expect(result.error).not.toBeNull();
    expect(result.circuit).toBeNull();
  });

  it('returns error for runtime errors', () => {
    const result = executeCircuitCode(`
      const x = component('Bad')
        .in('a', bit)
        .in('a', bit)
        .build()
    `);
    expect(result.error).not.toBeNull();
    expect(result.error).toContain('Duplicate');
  });

  it('returns empty result for code with no circuits', () => {
    const result = executeCircuitCode(`const x = 42`);
    expect(result.error).toBeNull();
    expect(result.circuit).toBeNull();
    expect(result.circuits).toHaveLength(0);
  });
});
