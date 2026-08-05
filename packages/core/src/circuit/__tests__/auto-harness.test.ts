/**
 * The harness keeps the library in step with the circuit it wraps.
 *
 * `autoHarness` builds a `dut` node whose ports come straight from the circuit
 * passed in, and references the circuit by *name* so the canvas can resolve it
 * from the library. Those are two views of the same thing, and they have to
 * agree.
 *
 * Registration used to be skipped when an entry already existed. In a normal
 * build that is harmless — a name is defined once. In the editor the library
 * store outlives the source, so adding an input to a circuit produced a `dut`
 * advertising three ports in front of a two-port definition: handles drawn from
 * one, edges routed from the other, landing beside each other on the canvas.
 * Reverting the edit did not help, because the stale entry was the *first*
 * definition, not the previous one.
 */

import { describe, expect, it } from 'vitest';
import { And } from '../../std/index.js';
import type { Circuit } from '../../types/circuit.js';
import { autoHarness } from '../auto-harness.js';
import { bit } from '../bit-bus.js';
import { circuit } from '../circuit.js';

function makeLibrary() {
  const store = new Map<string, Circuit>();
  return {
    store,
    resolveCircuit: (name: string) => store.get(name),
    addCircuit: (c: Circuit) => {
      store.set(c.name, c);
    },
  };
}

/** The same circuit name, built with a varying input set — an editor session. */
function build(inputs: Record<string, ReturnType<typeof bit> | typeof bit>) {
  return circuit('Editable', {
    inputs: inputs as { a: typeof bit; b: typeof bit },
    outputs: { out: bit },
    nodes: { g1: And },
    connect: ({ inputs: ins, outputs, nodes }) => [
      ins.a.to(nodes.g1.a),
      ins.b.to(nodes.g1.b),
      nodes.g1.out.to(outputs.out),
    ],
  }).circuit;
}

const dutPorts = (harness: Circuit) =>
  harness.nodes.find((n) => n.id === 'dut')?.inputs.map((p) => p.name) ?? [];

const libraryPorts = (lib: ReturnType<typeof makeLibrary>) =>
  lib.store.get('Editable')?.inputs.map((p) => p.name) ?? [];

describe('autoHarness library registration', () => {
  it('registers the circuit on first use', () => {
    const lib = makeLibrary();
    const harness = autoHarness(build({ a: bit, b: bit }), lib);

    expect(dutPorts(harness)).toEqual(['a', 'b']);
    expect(libraryPorts(lib)).toEqual(['a', 'b']);
  });

  it('updates the entry when a port is added', () => {
    const lib = makeLibrary();
    autoHarness(build({ a: bit, b: bit }), lib);

    const harness = autoHarness(build({ a: bit, b: bit, c: bit }), lib);

    expect(dutPorts(harness)).toEqual(['a', 'b', 'c']);
    expect(libraryPorts(lib), 'library must not keep the two-port version').toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('updates again when the port is removed, rather than keeping the first definition', () => {
    const lib = makeLibrary();
    autoHarness(build({ a: bit, b: bit }), lib);
    autoHarness(build({ a: bit, b: bit, c: bit }), lib);

    const harness = autoHarness(build({ a: bit, b: bit }), lib);

    expect(dutPorts(harness)).toEqual(['a', 'b']);
    expect(libraryPorts(lib)).toEqual(['a', 'b']);
  });

  it('gives every input a switch, matching the dut', () => {
    const lib = makeLibrary();
    const harness = autoHarness(build({ a: bit, b: bit, c: bit }), lib);

    const switches = harness.nodes.filter((n) => n.componentRef === 'Switch').map((n) => n.id);
    expect(switches).toEqual(['a', 'b', 'c']);
    expect(switches).toEqual(dutPorts(harness));
  });
});
