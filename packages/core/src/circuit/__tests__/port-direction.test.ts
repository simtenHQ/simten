import { describe, expect, it } from 'vitest';
import { bit } from '../bit-bus.js';
import { circuit } from '../circuit.js';

// Type-level negative tests for #110. The bodies don't need to run — the
// assertion is that each `@ts-expect-error` line is rejected by the
// compiler for the stated reason. If a future refactor produces a
// *different* error on these lines, @ts-expect-error still passes silently,
// so the per-line comment locks in the expected failure mode and a code
// reviewer can verify it manually.

const And = circuit('And', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  eval: ({ a, b }) => ({ out: a && b ? 1 : 0 }),
});

const Xor = circuit('Xor', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  eval: ({ a, b }) => ({ out: a !== b ? 1 : 0 }),
});

describe('port direction is enforced at the type level (#110)', () => {
  it('rejects passing a source as a .to() target', () => {
    const HalfAdder = circuit('HalfAdder_DirA', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { xor1: Xor, and1: And },
      connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
        // @ts-expect-error and1.out is a SourcePortRef, not assignable to SinkPortRef
        inputs.a.to(xor1.a, and1.out),
        inputs.b.to(xor1.b, and1.b),
        xor1.out.to(outputs.sum),
        and1.out.to(outputs.carry),
      ],
    });
    expect(HalfAdder.circuit.name).toBe('HalfAdder_DirA');
  });

  it('rejects calling .to() on a sink (inner node input)', () => {
    const HalfAdder = circuit('HalfAdder_DirB', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { xor1: Xor, and1: And },
      connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
        inputs.a.to(xor1.a, and1.a),
        inputs.b.to(xor1.b, and1.b),
        // @ts-expect-error xor1.a is a SinkPortRef, property `to` does not exist
        xor1.a.to(outputs.sum),
        and1.out.to(outputs.carry),
      ],
    });
    expect(HalfAdder.circuit.name).toBe('HalfAdder_DirB');
  });

  it('rejects calling .to() on a sink (outer output)', () => {
    const HalfAdder = circuit('HalfAdder_DirC', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { xor1: Xor, and1: And },
      connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
        inputs.a.to(xor1.a, and1.a),
        inputs.b.to(xor1.b, and1.b),
        xor1.out.to(outputs.sum),
        and1.out.to(outputs.carry),
        // @ts-expect-error outputs.sum is a SinkPortRef, property `to` does not exist
        outputs.sum.to(inputs.a),
      ],
    });
    expect(HalfAdder.circuit.name).toBe('HalfAdder_DirC');
  });

  it('still accepts correct source→sink wiring', () => {
    const HalfAdder = circuit('HalfAdder_DirOK', {
      inputs: { a: bit, b: bit },
      outputs: { sum: bit, carry: bit },
      nodes: { xor1: Xor, and1: And },
      connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
        inputs.a.to(xor1.a, and1.a),
        inputs.b.to(xor1.b, and1.b),
        xor1.out.to(outputs.sum),
        and1.out.to(outputs.carry),
      ],
    });
    expect(HalfAdder.circuit.connections.length).toBeGreaterThan(0);
  });
});
