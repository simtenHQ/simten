/**
 * `get` and `set` take a port's name and a Switch or Input's path alike, so
 * `circuit()` rejects a port and a Switch or Input with the same name where
 * the circuit is written (#545).
 */

import { describe, expect, it } from 'vitest';
import { Input, Led, Nand, Switch } from '../../std/index.js';
import { bit, bus } from '../bit-bus.js';
import { circuit } from '../circuit.js';

describe('a port and a Switch or Input with the same name', () => {
  it('rejects an output and a Switch, naming both and suggesting a rename', () => {
    expect(() =>
      circuit('OutClash', {
        outputs: { y: bit },
        nodes: { y: Switch, g: Nand },
        connect: ({ outputs, nodes: { y, g } }) => [y.out.to(g.a, g.b), g.out.to(outputs.y)],
      }),
    ).toThrow(
      "Circuit 'OutClash' validation failed:\n  - Output port 'y' and Switch node 'y' share a name, so get('y') and set('y') can't tell them apart. Rename one of them, e.g. the node to 'ySwitch'.",
    );
  });

  it('rejects an input and an Input', () => {
    expect(() =>
      circuit('InClash', {
        inputs: { n: bus(8) },
        outputs: { y: bus(8) },
        nodes: { n: Input({ width: 8 }) },
        connect: ({ outputs, nodes: { n } }) => [n.out.to(outputs.y)],
      }),
    ).toThrow(
      "Input port 'n' and Input node 'n' share a name, so get('n') and set('n') can't tell them apart. Rename one of them, e.g. the node to 'nInput'.",
    );
  });

  it('rejects a Switch from a node array whose expanded name is a port', () => {
    expect(() =>
      circuit('ArrayClash', {
        inputs: { s0: bit },
        outputs: { y: bit },
        nodes: { s: [Switch, Switch], g: Nand },
        connect: ({ outputs, nodes: { s, g } }) => [
          s[0].out.to(g.a),
          s[1].out.to(g.b),
          g.out.to(outputs.y),
        ],
      }),
    ).toThrow("Input port 's0' and Switch node 's0' share a name");
  });

  it('allows a gate or a lamp named like a port, since get and set never take its name', () => {
    expect(() =>
      circuit('GateNamedLikePort', {
        inputs: { a: bit },
        outputs: { y: bit, q: bit },
        nodes: { y: Nand, q: Led },
        connect: ({ inputs, outputs, nodes: { y, q } }) => [
          inputs.a.to(y.a, y.b, q.in),
          y.out.to(outputs.y, outputs.q),
        ],
      }),
    ).not.toThrow();
  });

  it('allows a nested Switch whose last name matches a port, since its path has a dot', () => {
    const Inner = circuit('Inner', {
      outputs: { y: bit },
      nodes: { a: Switch },
      connect: ({ outputs, nodes: { a } }) => [a.out.to(outputs.y)],
    });
    expect(() =>
      circuit('Outer', {
        inputs: { a: bit },
        outputs: { y: bit },
        nodes: { inner: Inner, g: Nand },
        connect: ({ inputs, outputs, nodes: { inner, g } }) => [
          inputs.a.to(g.a),
          inner.y.to(g.b),
          g.out.to(outputs.y),
        ],
      }),
    ).not.toThrow();
  });
});
