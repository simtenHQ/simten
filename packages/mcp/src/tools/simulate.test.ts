import { describe, expect, it } from 'vitest';
import { type ToolCall, toolOf } from '../__tests__/tools.js';
import { registerSimulateTool } from './simulate.js';

function simulateTool(): ToolCall {
  return toolOf(registerSimulateTool);
}

const ROM_READER = `
import { bus, circuit } from '@simten/core';
import { ROM } from '@simten/core/std';

export const RomReader = circuit('RomReader', {
  inputs: { addr: bus(16) },
  outputs: { data: bus(8) },
  nodes: { rom: ROM() },
  connect: ({ inputs, outputs, nodes: { rom } }) => [
    inputs.addr.to(rom.addr),
    rom.data_out.to(outputs.data),
  ],
});
`;

describe('simulate_circuit memoryData', () => {
  it('loads { address: value } contents, so a ROM read sees them', async () => {
    const result = await simulateTool()({
      source: ROM_READER,
      ticks: 2,
      inputs: { addr: 1 },
      memoryData: { rom: { '0': 11, '1': 42 } },
    });
    expect(result.isError).toBeUndefined();
    const { signals } = JSON.parse(result.content[0].text);
    expect(signals.data).toEqual([{ value: 42, count: 2 }]);
  });

  it('finds a nested memory by its path inside the circuit', async () => {
    const source = `${ROM_READER}
export const Board = circuit('Board', {
  inputs: { addr: bus(16) },
  outputs: { data: bus(8) },
  nodes: { reader: RomReader },
  connect: ({ inputs, outputs, nodes: { reader } }) => [
    inputs.addr.to(reader.addr),
    reader.data.to(outputs.data),
  ],
});
`;
    const result = await simulateTool()({
      source,
      ticks: 1,
      inputs: { addr: 0 },
      memoryData: { 'reader.rom': { '0': 7 } },
    });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text).signals.data).toEqual([{ value: 7, count: 1 }]);
  });

  it('rejects a memoryData key that names no node', async () => {
    const result = await simulateTool()({
      source: ROM_READER,
      ticks: 1,
      memoryData: { imem: { '0': 1 } },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('memoryData: no node "imem"');
  });

  it('rejects a short name for a nested memory', async () => {
    const source = `${ROM_READER}
export const Board = circuit('Board', {
  inputs: { addr: bus(16) },
  outputs: { data: bus(8) },
  nodes: { reader: RomReader },
  connect: ({ inputs, outputs, nodes: { reader } }) => [
    inputs.addr.to(reader.addr),
    reader.data.to(outputs.data),
  ],
});
`;
    const result = await simulateTool()({
      source,
      ticks: 1,
      memoryData: { rom: { '0': 7 } },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('memoryData: no node "rom"');
  });
});

const LATCH = `
import { bit, circuit } from '@simten/core';
import { And, Led, Switch } from '@simten/core/std';

export const Gate = circuit('Gate', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { en: Switch, and: And, lamp: Led },
  connect: ({ inputs, outputs, nodes: { en, and, lamp } }) => [
    inputs.a.to(and.a),
    en.out.to(and.b),
    and.out.to(outputs.y, lamp.in),
  ],
});
`;

describe('simulate_circuit inputs', () => {
  it('sets input ports and Switch nodes with one map, as set() does', async () => {
    const result = await simulateTool()({ source: LATCH, ticks: 1, inputs: { a: 1, en: 1 } });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text).signals.y).toEqual([{ value: 1, count: 1 }]);
  });

  it('rejects a key that names no port or Switch, listing the inputs', async () => {
    const result = await simulateTool()({ source: ROM_READER, ticks: 1, inputs: { adr: 1 } });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(
      "inputs: set('adr'): RomReader has no input port, Switch or Input named 'adr'. Its inputs: addr",
    );
  });

  it('rejects a key that names a node that is not an input', async () => {
    const result = await simulateTool()({ source: LATCH, ticks: 1, inputs: { lamp: 1 } });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("inputs: set('lamp'): 'lamp' is a Led, not an input");
  });

  it('rejects a circuit with a port and a Switch of the same name', async () => {
    const source = LATCH.replace('nodes: { en: Switch', 'nodes: { a: Switch, en: Switch');
    const result = await simulateTool()({ source, ticks: 1, inputs: { a: 1 } });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Input port 'a' and Switch node 'a' share a name");
  });

  it('takes numbers only', async () => {
    await expect(
      simulateTool()({ source: LATCH, ticks: 1, inputs: { a: true } }),
    ).rejects.toThrow();
  });
});

describe('simulate_circuit parameters', () => {
  it('has no show parameter: it never paints the canvas', async () => {
    await expect(simulateTool()({ source: LATCH, show: true, reason: 'x' })).rejects.toThrow(
      /show/,
    );
  });
});
