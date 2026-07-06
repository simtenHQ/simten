import { describe, it, expect } from 'vitest';
import { circuit } from '../circuit.js';
import { bit } from '../bit-bus.js';

const And = circuit('And', {
  inputs: { a: bit, b: bit },
  outputs: { out: bit },
  eval: ({ a, b }) => ({ out: a && b ? 1 : 0 }),
});

const Not = circuit('Not', {
  inputs: { in: bit },
  outputs: { out: bit },
  eval: ({ in: inp }) => ({ out: inp ? 0 : 1 }),
});

describe('multi-driver detection', () => {
  it('throws when two different sources target the same input port', () => {
    expect(() =>
      circuit('Bad', {
        inputs: { a: bit, b: bit },
        outputs: { out: bit },
        nodes: { n: Not },
        connect: ({ inputs, outputs, nodes: { n } }) => [
          inputs.a.to(n.in),
          inputs.b.to(n.in),
          n.out.to(outputs.out),
        ],
      }),
    ).toThrow(/n\.in has multiple drivers: a, b/);
  });

  it('lists all conflicting sources for a port', () => {
    expect(() =>
      circuit('Bad', {
        inputs: { a: bit, b: bit, c: bit },
        outputs: { out: bit },
        nodes: { n: Not },
        connect: ({ inputs, outputs, nodes: { n } }) => [
          inputs.a.to(n.in),
          inputs.b.to(n.in),
          inputs.c.to(n.in),
          n.out.to(outputs.out),
        ],
      }),
    ).toThrow(/n\.in has multiple drivers: a, b, c/);
  });

  it('reports multiple distinct conflicts in one throw, sorted lexicographically', () => {
    let caught: Error | null = null;
    try {
      circuit('Bad', {
        inputs: { x: bit, y: bit },
        outputs: { s: bit, c: bit },
        nodes: {
          xor1: circuit('Xor', {
            inputs: { a: bit, b: bit },
            outputs: { out: bit },
            eval: ({ a, b }) => ({ out: a !== b ? 1 : 0 }),
          }),
          and1: And,
        },
        connect: ({ inputs, outputs, nodes: { xor1, and1 } }) => [
          inputs.x.to(xor1.a, and1.a),
          inputs.y.to(xor1.a, and1.a), // multi-driver on both xor1.a and and1.a
          xor1.out.to(outputs.s),
          and1.out.to(outputs.c),
        ],
      });
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    const msg = caught!.message;
    // Both conflicts present
    expect(msg).toMatch(/and1\.a has multiple drivers/);
    expect(msg).toMatch(/xor1\.a has multiple drivers/);
    // Lexicographic order: and1.a comes before xor1.a
    expect(msg.indexOf('and1.a')).toBeLessThan(msg.indexOf('xor1.a'));
  });

  it('does not throw when each port has exactly one driver', () => {
    expect(() =>
      circuit('Good', {
        inputs: { a: bit },
        outputs: { out: bit },
        nodes: { n: Not },
        connect: ({ inputs, outputs, nodes: { n } }) => [inputs.a.to(n.in), n.out.to(outputs.out)],
      }),
    ).not.toThrow();
  });

  it('silently dedupes identical (target, source) triples', () => {
    const c = circuit('Dup', {
      inputs: { a: bit },
      outputs: { out: bit },
      nodes: { n: Not },
      connect: ({ inputs, outputs, nodes: { n } }) => [
        inputs.a.to(n.in),
        inputs.a.to(n.in), // exact duplicate
        n.out.to(outputs.out),
      ],
    });
    // After dedup: one a→n.in edge and one n.out→outputs.out edge.
    expect(c.circuit.connections).toHaveLength(2);
    const edge = c.circuit.connections.find(
      (e) => e.target.nodeId === 'n' && e.target.portName === 'in',
    );
    expect(edge).toBeDefined();
  });

  it('throws on multi-driver inside a composite parent before any flattening', () => {
    // Inner is well-formed on its own.
    const Inner = circuit('Inner', {
      inputs: { x: bit },
      outputs: { y: bit },
      nodes: { n: Not },
      connect: ({ inputs, outputs, nodes: { n } }) => [inputs.x.to(n.in), n.out.to(outputs.y)],
    });

    // Parent drives inner.x from two distinct sources.
    expect(() =>
      circuit('Outer', {
        inputs: { p: bit, q: bit },
        outputs: { z: bit },
        nodes: { inner: Inner },
        connect: ({ inputs, outputs, nodes: { inner } }) => [
          inputs.p.to(inner.x),
          inputs.q.to(inner.x),
          inner.y.to(outputs.z),
        ],
      }),
    ).toThrow(/inner\.x has multiple drivers/);
  });
});
