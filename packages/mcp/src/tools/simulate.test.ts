import { describe, expect, it } from 'vitest';
import { registerSimulateTool } from './simulate.js';

type Result = { content: { type: string; text: string }[]; isError?: boolean };
type Handler = (args: Record<string, unknown>) => Promise<Result>;

function simulateTool(): Handler {
  let handler: Handler | undefined;
  const server = {
    tool: (_name: string, _desc: string, _schema: unknown, h: Handler) => {
      handler = h;
    },
  };
  registerSimulateTool(server as never);
  return handler!;
}

const ROM_READER = `
import { bus, circuit } from '@simten/core/circuit';
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
      show: false,
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
      show: false,
    });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text).signals.data).toEqual([{ value: 7, count: 1 }]);
  });

  it('rejects a memoryData key that names no node', async () => {
    const result = await simulateTool()({
      source: ROM_READER,
      ticks: 1,
      memoryData: { imem: { '0': 1 } },
      show: false,
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
      show: false,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('memoryData: no node "rom"');
  });
});

describe('simulate_circuit inputs', () => {
  it('rejects a name that is not a top-level input, listing the inputs', async () => {
    const result = await simulateTool()({
      source: ROM_READER,
      ticks: 1,
      inputs: { adr: 1 },
      show: false,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(
      'inputs: "adr" is not an input of circuit "RomReader". Inputs: addr',
    );
  });
});
