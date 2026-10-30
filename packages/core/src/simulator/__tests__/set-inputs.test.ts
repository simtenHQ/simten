/**
 * `Simulation.set` takes the circuit's inputs as a person at the board sees
 * them: input ports by name, and Switch and Input nodes by path (decision
 * 0010). Every key resolves exactly, and every value is written before the
 * circuit settles. `get` reads the same keys back. Also
 * `simulate(top, { memory })`.
 */

import { describe, expect, it } from 'vitest';
import { libraryOf } from '../../circuit/behavior.js';
import { bit, bus, circuit } from '../../circuit/index.js';
import { internalsOf } from '../../circuit/internals.js';
import { Input, Led, Nand, Register, ROM, Switch } from '../../std/index.js';
import { primitivePaths } from '../input-keys.js';
import { simulate } from '../simulate.js';
import { nodesOf, type Simulation } from '../simulation.js';

/** The game's d-latch level: no ports, two switches. */
const DLatch = circuit('SetDLatch', {
  nodes: { d: Switch, en: Switch, n1: Nand, n2: Nand, n3: Nand, n4: Nand, q: Led },
  connect: ({ nodes: { d, en, n1, n2, n3, n4, q } }) => [
    d.out.to(n1.a),
    en.out.to(n1.b, n2.b),
    n1.out.to(n2.a, n3.a),
    n2.out.to(n4.b),
    n3.out.to(n4.a, q.in),
    n4.out.to(n3.b),
  ],
});

/** A latch with a port, a switch inside and the latch one level down. */
const Board = circuit('SetBoard', {
  inputs: { a: bit },
  outputs: { y: bit, q: bit },
  nodes: { latch: DLatch, kbd: Input({ width: 8 }), gate: Nand },
  connect: ({ inputs, outputs, nodes: { gate } }) => [
    inputs.a.to(gate.a, gate.b),
    gate.out.to(outputs.y),
  ],
});

/** A port and a switch with the same name: `set('a')` can't choose. */
const Clash = circuit('SetClash', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { a: Switch, g: Nand },
  connect: ({ inputs, outputs, nodes: { a, g } }) => [
    inputs.a.to(g.a),
    a.out.to(g.b),
    g.out.to(outputs.y),
  ],
});

/**
 * An output and a Switch with the same name. The builder allows it, so `get`
 * and `set` refuse the name rather than read one and write the other.
 */
const OutputClash = circuit('SetOutputClash', {
  outputs: { y: bit },
  nodes: { y: Switch, g: Nand },
  connect: ({ outputs, nodes: { y, g } }) => [y.out.to(g.a, g.b), g.out.to(outputs.y)],
});

const outputs = (sim: { read(): Record<string, number> }) => sim.read();
/** The latch's lamp. */
const lamp = (sim: Simulation, at = 'q') => nodesOf(sim).ports().get(`${at}.in`);

describe('set', () => {
  it('writes Switch nodes by name, all before the circuit settles (#521)', () => {
    const sim = simulate(DLatch);
    sim.set({ d: 1, en: 1 });
    sim.tick();
    // Going to d = 0, en = 0 in one call holds q at 1. One at a time, d = 0
    // would land while en was still 1.
    expect(lamp(sim)).toBe(1);
    sim.set({ d: 0, en: 0 });
    sim.tick();
    expect(lamp(sim)).toBe(1);
  });

  it('takes ports and nested Switch and Input paths in one call', () => {
    const sim = simulate(Board);
    sim.set({ a: 1, 'latch.d': 1, 'latch.en': 1, kbd: 65 });
    expect(outputs(sim).y).toBe(0);
    expect(lamp(sim, 'latch.q')).toBe(1);
    expect(nodesOf(sim).ports().get('kbd.out')).toBe(65);
    sim.set({ a: 0 });
    expect(outputs(sim).y).toBe(1);
  });

  it('rejects a key that names a node that is not an input, and writes nothing', () => {
    const sim = simulate(Board);
    expect(() => sim.set({ a: 1, gate: 1 } as never)).toThrow(
      "set('gate'): 'gate' is a Nand, not an input",
    );
    // `a` was not written.
    expect(outputs(sim).y).toBe(1);
  });

  it('rejects an unknown key, naming the inputs', () => {
    const sim = simulate(Board);
    expect(() => sim.set({ b: 1 } as never)).toThrow(
      "set('b'): SetBoard has no input port, Switch or Input named 'b'. Its inputs: a",
    );
  });

  it('rejects a key that names both a port and a Switch', () => {
    const sim = simulate(Clash);
    expect(() => sim.set({ a: 1 })).toThrow('ambiguous');
  });

  it('types its keys from the circuit', () => {
    const latch = simulate(DLatch);
    latch.set({ d: 1, en: 0 });
    // @ts-expect-error: n1 is a Nand, not a Switch
    expect(() => latch.set({ n1: 1 })).toThrow();
    const board = simulate(Board);
    board.set({ a: 1, kbd: 3, 'latch.d': 1 });
    // @ts-expect-error: y is an output
    expect(() => board.set({ y: 1 })).toThrow();
  });
});

describe('get', () => {
  it('reads an input port after set, and still reads outputs', () => {
    const sim = simulate(Board);
    sim.set({ a: 1 });
    expect(sim.get('a')).toBe(1);
    expect(sim.get('y')).toBe(0);
  });

  it('reads Switch and Input nodes by path, as set writes them', () => {
    const sim = simulate(Board);
    sim.set({ 'latch.d': 1, kbd: 65 });
    expect(sim.get('latch.d')).toBe(1);
    expect(sim.get('latch.en')).toBe(0);
    expect(sim.get('kbd')).toBe(65);
  });

  it('rejects a gate, and a name that is nothing, listing what can be read', () => {
    const sim = simulate(Board);
    // @ts-expect-error: gate is a Nand
    expect(() => sim.get('gate')).toThrow(
      "get('gate'): 'gate' is a Nand, not a port, Switch or Input.",
    );
    expect(() => sim.get('b' as never)).toThrow(
      "get('b'): SetBoard has no port, Switch or Input named 'b'. Its inputs: a. Its Switches and Inputs: latch.d, latch.en, kbd. Its outputs: y, q",
    );
  });

  it('rejects a key that names both a port and a Switch', () => {
    const sim = simulate(Clash);
    expect(() => sim.get('a')).toThrow("get('a'): SetClash has both an input port and a Switch");
  });

  it('rejects a name that is both an output and a Switch, as set does, so a toggle reads what it writes', () => {
    const sim = simulate(OutputClash);
    expect(() => sim.get('y')).toThrow(
      "get('y'): SetOutputClash has both an output port and a Switch named 'y', so the key is ambiguous. Rename one of them.",
    );
    expect(() => sim.set({ y: 1 } as never)).toThrow(
      "set('y'): SetOutputClash has both an output port and a Switch named 'y'",
    );
  });
});

describe('primitivePaths', () => {
  it('walks the IR to the node paths and types a simulation has', () => {
    const sim = simulate(Board);
    const library = libraryOf(Board);
    const paths = primitivePaths(internalsOf(Board).ir, library.definitions);
    expect(paths.get('latch.d')).toBe('Switch');
    expect(paths.get('kbd')).toBe('Input');
    for (const [path, type] of paths) expect(nodesOf(sim).primitiveOf(path)).toBe(type);
  });
});

describe('reset', () => {
  it('leaves switches and ports where they are', () => {
    const sim = simulate(Board);
    sim.set({ a: 1, kbd: 9, 'latch.d': 1 });
    sim.reset();
    expect(outputs(sim).y).toBe(0);
    expect(nodesOf(sim).ports().get('kbd.out')).toBe(9);
    expect(nodesOf(sim).ports().get('latch.d.out')).toBe(1);
  });
});

describe('simulate(top, { memory })', () => {
  const Reader = circuit('SetReader', {
    inputs: { addr: bus(16) },
    outputs: { data: bus(8) },
    nodes: { rom: ROM(), reg: Register() },
    connect: ({ inputs, outputs, nodes: { rom } }) => [
      inputs.addr.to(rom.addr),
      rom.data_out.to(outputs.data),
    ],
  });

  it('loads contents by node path before cycle 0, and reset keeps them', () => {
    const sim = simulate(Reader, { memory: { rom: { 0: 7, 1: 9 } }, history: 4 });
    expect(sim.cycle).toBe(0);
    expect(sim.history).toEqual({ length: 1, index: 0 });
    sim.set({ addr: 1 });
    expect(sim.get('data')).toBe(9);
    sim.tick(3);
    sim.reset();
    sim.set({ addr: 0 });
    expect(sim.get('data')).toBe(7);
  });

  it('rejects contents for a path with no node', () => {
    expect(() => simulate(Reader, { memory: { nope: { 0: 1 } } })).toThrow();
  });
});
