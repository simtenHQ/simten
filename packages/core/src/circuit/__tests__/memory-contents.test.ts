/**
 * Memory contents have one format, `{ address: value }` (#474), and contents
 * that don't fit the memory are compile errors (decision 0002).
 */

import { describe, expect, it } from 'vitest';
import { simulate } from '../../simulator/simulate.js';
import { nodesOf } from '../../simulator/simulation.js';
import { DualPortRAM, ROM, romFromBytes } from '../../std/index.js';
import { bus, circuit, type MemoryContents, mem } from '../index.js';

/** A 4 x 8-bit lookup table with the given starting contents. */
function lut(contents?: MemoryContents) {
  return circuit('Lut', {
    inputs: { addr: bus(2) },
    outputs: { out: bus(8) },
    state: { table: mem(4, 8, contents) },
    eval: ({ addr, table }) => ({ out: table[addr] }),
    onTick: ({ table }) => ({ table }),
  });
}

/** `ROM` behind an 8-bit address, read back through `simulate()`. */
function romReader(rom: ReturnType<typeof ROM>) {
  return circuit('RomReader', {
    inputs: { addr: bus(16) },
    outputs: { out: bus(8) },
    nodes: { rom },
    connect: ({ inputs, outputs, nodes }) => [
      inputs.addr.to(nodes.rom.addr),
      nodes.rom.data_out.to(outputs.out),
    ],
  });
}

/** What `readAll` needs from a simulation of `lut` or `romReader`. */
interface Reader {
  set(values: { addr: number }): void;
  tick(): void;
  get(name: 'out'): number;
}

/** Read each address: set it, tick, read `out`. */
function readAll(sim: Reader, addrs: number[]): number[] {
  return addrs.map((addr) => {
    sim.set({ addr });
    sim.tick();
    return sim.get('out');
  });
}

describe('memory contents', () => {
  it('reads mem() object contents back through simulate()', () => {
    const reads = readAll(simulate(lut({ 0: 0x3e, 3: 0x07 })), [0, 1, 2, 3]);
    expect(reads).toEqual([0x3e, 0, 0, 0x07]);
  });

  it('takes dense contents from romFromBytes, in ROM and in mem()', () => {
    const bytes = [0xe3, 0xb0, 0xc4, 0x42];
    const rom = romReader(ROM({ memory: romFromBytes(bytes) }));
    expect(readAll(simulate(rom), [0, 1, 2, 3])).toEqual(bytes);
    expect(readAll(simulate(lut(romFromBytes(bytes))), [0, 1, 2, 3])).toEqual(bytes);
  });

  it('rejects a value wider than the memory, naming the circuit, field and address', () => {
    expect(() => ROM({ memory: { 0: 1, 5: 300 } })).toThrow(
      /Circuit 'ROM'[\s\S]*state 'memory': value 300 at address 5 does not fit in 8 bits/,
    );
    expect(() => lut({ 2: 256 })).toThrow(
      /Circuit 'Lut'[\s\S]*state 'table': value 256 at address 2 does not fit in 8 bits/,
    );
    expect(() => lut({ 1: -1 })).toThrow(/value -1 at address 1 does not fit/);
    expect(() => lut({ 1: 1.5 })).toThrow(/value 1.5 at address 1 is not an integer/);
  });

  it('rejects an address outside the memory', () => {
    expect(() => lut({ 9: 1 })).toThrow(
      /Circuit 'Lut'[\s\S]*state 'table': address 9 is out of range: the memory has 4 words/,
    );
    expect(() => DualPortRAM({ addressWidth: 2, memory: { 4: 1 } })).toThrow(
      /Circuit 'DualPortRAM'[\s\S]*address 4 is out of range/,
    );
    expect(() => lut({ '-1': 1 } as MemoryContents)).toThrow(
      /address '-1' is not a non-negative integer/,
    );
  });

  it('rejects arrays and Maps with a pointer at romFromBytes', () => {
    // Untyped (editor) code can pass these; the types already refuse them.
    const array = [1, 2, 3] as unknown as MemoryContents;
    const map = new Map([[0, 1]]) as unknown as MemoryContents;
    expect(() => ROM({ memory: array })).toThrow(
      /Circuit 'ROM'[\s\S]*state 'memory': memory contents must be a plain object \{ address: value \}, got an array; build dense contents with romFromBytes/,
    );
    expect(() => lut(array)).toThrow(/state 'table': .*got an array; .*romFromBytes/);
    expect(() => lut(map)).toThrow(
      /state 'table': .*got a Map; use Object.fromEntries\(map\), or .*romFromBytes/,
    );
    expect(() => DualPortRAM({ memory: map })).toThrow(/got a Map/);
  });

  it('nodesOf(sim).set loads { address: value } contents into a memory', () => {
    const sim = simulate(romReader(ROM()));
    nodesOf(sim).set('rom', { 0: 0x11, 2: 0x22 });
    const reads = [0, 1, 2].map((addr) => {
      sim.set({ addr });
      sim.tick();
      return sim.get('out');
    });
    expect(reads).toEqual([0x11, 0, 0x22]);

    // Type-level: set takes a number or memory contents, nothing else.
    // @ts-expect-error a Map is not memory contents
    expect(() => nodesOf(sim).set('rom', new Map([[0, 1]]))).toThrow(/got a Map/);
    // @ts-expect-error an array is not memory contents
    expect(() => nodesOf(sim).set('rom', [1, 2])).toThrow(/got an array/);
    // @ts-expect-error a string is not a node value
    expect(() => nodesOf(sim).set('rom', 'hello')).toThrow(/got string/);
  });
});
