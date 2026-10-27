import { describe, expect, it } from 'vitest';
import { bit } from '../bit-bus.js';
import { circuit } from '../circuit.js';
import { internalsOf } from '../internals.js';

// Type-level negative tests for #110: each `@ts-expect-error` line is
// rejected by the compiler for the stated reason. Since #428 the build also
// rejects the same connections at runtime, which the bodies check. If a future refactor produces a
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
    // The editor runs type-stripped code, so the build rejects it too (#428).
    const build = () =>
      circuit('HalfAdder_DirA', {
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
    expect(build).toThrow(
      /Connection a -> and1\.out runs the wrong way: output `out` of node .and1. \(And\) is a driver/,
    );
  });

  it('rejects calling .to() on a sink (inner node input)', () => {
    // The editor runs type-stripped code, so the build rejects it too (#428).
    const build = () =>
      circuit('HalfAdder_DirB', {
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
    expect(build).toThrow(
      /Connection xor1\.a -> sum runs the wrong way: input `a` of node .xor1. \(Xor\) can only be driven/,
    );
  });

  it('rejects calling .to() on a sink (outer output)', () => {
    // The editor runs type-stripped code, so the build rejects it too (#428).
    const build = () =>
      circuit('HalfAdder_DirC', {
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
    expect(build).toThrow(
      /Connection sum -> a runs the wrong way: circuit output `sum` can only be driven.*circuit input `a` is a driver/,
    );
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
    expect(internalsOf(HalfAdder).ir.connections.length).toBeGreaterThan(0);
  });
});
