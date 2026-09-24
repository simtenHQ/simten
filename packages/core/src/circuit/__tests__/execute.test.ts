import { describe, expect, it } from 'vitest';
import { executeCircuitCode, stripTypes } from '../execute.js';

// ============================================================================
// Type stripping
// ============================================================================

describe('stripTypes', () => {
  it('strips type annotations from parameters', () => {
    const ts = `const Register = (width: number) => circuit('Reg', {})`;
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
    const code = `const x = circuit('Test', { in: { a: bit } })`;
    expect(stripTypes(code)).toContain(code);
  });
});

// ============================================================================
// Basic execution
// ============================================================================

describe('executeCircuitCode', () => {
  it('executes a simple AND gate', () => {
    const result = executeCircuitCode(`
      const MyAnd = circuit('MyAnd', {
        inputs: { a: bit, b: bit },
        outputs: { out: bit },
        eval: ({ a, b }) => ({ out: (a && b) ? 1 : 0 }),
      })
    `);

    expect(result.error).toBeNull();
    expect(result.circuit).not.toBeNull();
    expect(result.circuit!.name).toBe('MyAnd');
    expect(result.circuits).toHaveLength(1);
  });

  it('executes a composite circuit using stdlib', () => {
    const result = executeCircuitCode(`
      const HalfAdder = circuit('HalfAdder', {
        inputs: { a: bit, b: bit },
        outputs: { sum: bit, carry: bit },
        nodes: { x: Xor, a: And },
        connect: ({ inputs, outputs, nodes: { x, a } }) => [
          inputs.a.to(x.a, a.a),
          inputs.b.to(x.b, a.b),
          x.out.to(outputs.sum),
          a.out.to(outputs.carry),
        ],
      })
    `);

    expect(result.error).toBeNull();
    expect(result.circuit!.name).toBe('HalfAdder');
    expect(result.circuit!.nodes).toHaveLength(2);
    expect(result.circuit!.connections).toHaveLength(6);
  });

  it('collects multiple circuits', () => {
    const result = executeCircuitCode(`
      const A = circuit('CompA', {
        inputs: { x: bit },
        outputs: { y: bit },
        eval: ({ x }) => ({ y: x }),
      })

      const B = circuit('CompB', {
        inputs: { x: bit },
        outputs: { y: bit },
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
    const result = executeCircuitCode(`
      const width: number = 8
      const MyAdder = circuit('MyAdder', {
        inputs: { a: bus(width), b: bus(width) },
        outputs: { sum: bus(width) },
        eval: ({ a, b }: { a: number; b: number }) => ({ sum: (a + b) & 0xFF }),
      })
    `);

    expect(result.error).toBeNull();
    expect(result.circuit!.name).toBe('MyAdder');
    expect(result.circuit!.inputs[0].portType).toEqual({ kind: 'bus', width: 8 });
  });

  it('handles parameterized component factories', () => {
    const result = executeCircuitCode(`
      const makeReg = (w: number) => circuit('Reg' + w, {
        inputs: { d: bus(w) },
        outputs: { q: bus(w) },
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
    const result = executeCircuitCode(`
      const Demo = circuit('Demo', {
        inputs: { a: bit },
        outputs: { b: bit },
        nodes: { n: Not },
        connect: ({ inputs, outputs, nodes: { n } }) => [
          inputs.a.to(n.in),
          n.out.to(outputs.b),
        ],
      })
    `);

    expect(result.error).toBeNull();
    expect(result.circuit!.nodes[0].componentRef).toBe('Not');
  });

  it('registers user circuits in the library', () => {
    const result = executeCircuitCode(`
      const MyGate = circuit('MyGate', {
        inputs: { a: bit },
        outputs: { out: bit },
        eval: ({ a }) => ({ out: a }),
      })
    `);

    expect(result.library.resolveCircuit('MyGate')).toBeDefined();
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
      const x = circuit('Bad', {
        inputs: { a: bit },
        outputs: { a: bit },
      })
    `);
    expect(result.error).not.toBeNull();
    expect(result.error).toContain('both input and output');
  });

  it('returns empty result for code with no circuits', () => {
    const result = executeCircuitCode(`const x = 42`);
    expect(result.error).toBeNull();
    expect(result.circuit).toBeNull();
    expect(result.circuits).toHaveLength(0);
  });
});

/**
 * Looking at a component you did not write.
 *
 * `export default FullAdder` builds nothing, so the collector that watches
 * `circuit()` calls stayed empty and the editor reported an empty file at
 * someone who could plainly see a component on screen. `circuits` still means
 * "constructed here" — the MCP tools report it as that — so the re-export
 * lands in `exportedCircuits` instead, and a renderer falls back to it.
 */
describe('exported components', () => {
  it('reports a re-exported stdlib component without claiming it was defined', () => {
    const result = executeCircuitCode(`
      import { FullAdder } from '@simten/core/std';
      export default FullAdder;
    `);

    expect(result.error).toBeNull();
    expect(result.circuits, 'nothing was defined here').toHaveLength(0);
    expect(result.exportedCircuits.map((c) => c.name)).toEqual(['FullAdder']);
    expect(result.circuit?.name, 'renderable falls back to the export').toBe('FullAdder');
  });

  it('calls a parameterised component factory for its default instance', () => {
    const result = executeCircuitCode(`
      import { Register } from '@simten/core/std';
      export const R = Register;
    `);

    expect(result.error).toBeNull();
    expect(result.exportedCircuits).toHaveLength(1);
    expect(result.circuit?.name).toBe('Register');
  });

  it('prefers what the source defined over what it re-exported', () => {
    const result = executeCircuitCode(`
      import { FullAdder } from '@simten/core/std';
      export const Mine = circuit('Mine', {
        inputs: { a: bit },
        outputs: { out: bit },
        nodes: { n: Not },
        connect: ({ inputs, outputs, nodes: { n } }) => [
          inputs.a.to(n.in),
          n.out.to(outputs.out),
        ],
      });
      export const Borrowed = FullAdder;
    `);

    expect(result.circuits.map((c) => c.name)).toEqual(['Mine']);
    expect(result.circuit?.name).toBe('Mine');
    expect(result.exportedCircuits.map((c) => c.name)).toEqual(['FullAdder']);
  });

  it('stays empty when the export is not a component', () => {
    const result = executeCircuitCode(`export const x = 42;`);

    expect(result.error).toBeNull();
    expect(result.circuits).toHaveLength(0);
    expect(result.exportedCircuits).toHaveLength(0);
    expect(result.circuit).toBeNull();
  });
});
