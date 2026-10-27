/**
 * A circuit file must load the same way in check_circuit, simulate_circuit and
 * verify_circuit (#497). Each case here is a small project on disk whose top
 * file imports something from a sibling file, run through the real handlers.
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerCheckTool } from './check.js';
import { registerSimulateTool } from './simulate.js';
import { registerVerifyTool } from './verify.js';

type Result = { content: { type: string; text: string }[]; isError?: boolean };
type Handler = (args: Record<string, unknown>) => Promise<Result>;

function handlerOf(register: (server: never) => void): Handler {
  let handler: Handler | undefined;
  const server = {
    tool: (_name: string, _desc: string, _schema: unknown, h: Handler) => {
      handler = h;
    },
  };
  register(server as never);
  if (!handler) throw new Error('tool did not register a handler');
  return handler;
}

const check = handlerOf(registerCheckTool);
const simulate = handlerOf(registerSimulateTool);
const verify = handlerOf(registerVerifyTool);

const ORACLE = {
  tier: 'B',
  type: 'plain-JS reference',
  independence_basis: 'written without the gates',
};

const FILES: Record<string, string> = {
  // A sub-circuit in its own file, used as a node by the top file.
  'half-adder.circuit.ts': `
import { bit, circuit } from '@simten/core/circuit';
import { And, Xor } from '@simten/core/std';

export const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { x: Xor, n: And },
  connect: ({ inputs, outputs, nodes: { x, n } }) => [
    inputs.a.to(x.a, n.a),
    inputs.b.to(x.b, n.b),
    x.out.to(outputs.sum),
    n.out.to(outputs.carry),
  ],
});
`,
  'top.circuit.ts': `
import { bit, circuit } from '@simten/core/circuit';
import { HalfAdder } from './half-adder.circuit.js';

export const Top = circuit('Top', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { ha: HalfAdder },
  connect: ({ inputs, outputs, nodes: { ha } }) => [
    inputs.a.to(ha.a),
    inputs.b.to(ha.b),
    ha.sum.to(outputs.sum),
    ha.carry.to(outputs.carry),
  ],
});
`,
  'top.verify.ts': `
import { simulate } from '@simten/core';
import { declareOracle, describe, verify } from '@simten/core/verify';
import { Top } from './top.circuit.js';

describe('Top');
declareOracle(${JSON.stringify(ORACLE)});
verify.exhaustive('truth table', [2, 2], (a, b) => {
  const s = simulate(Top);
  try {
    s.set({ a, b });
    return s.get('sum') === (a ^ b) && s.get('carry') === (a & b);
  } finally {
    s.dispose();
  }
});
verify.run();
`,
  // A plain helper module: a constant table and a function that builds a ROM.
  'table.ts': `
import { ROM, romFromBytes } from '@simten/core/std';

export const TABLE: readonly number[] = [11, 42, 7];
export function tableRom() {
  return ROM({ memory: romFromBytes(TABLE) });
}
`,
  'lookup.circuit.ts': `
import { bus, circuit } from '@simten/core/circuit';
import { tableRom } from './table.js';

export const Lookup = circuit('Lookup', {
  inputs: { addr: bus(16) },
  outputs: { data: bus(8) },
  nodes: { rom: tableRom() },
  connect: ({ inputs, outputs, nodes: { rom } }) => [
    inputs.addr.to(rom.addr),
    rom.data_out.to(outputs.data),
  ],
});
`,
  'lookup.verify.ts': `
import { simulate } from '@simten/core';
import { declareOracle, describe, verify } from '@simten/core/verify';
import { Lookup } from './lookup.circuit.js';

describe('Lookup');
declareOracle(${JSON.stringify(ORACLE)});
const expected = [11, 42, 7, 0];
verify.exhaustive('table', [4], (addr) => {
  const s = simulate(Lookup);
  try {
    s.set({ addr });
    s.tick();
    return s.get('data') === expected[addr];
  } finally {
    s.dispose();
  }
});
verify.run();
`,
};

let project = '';
// verify_circuit's subprocess inherits this env. The harness inside it must
// run in its tsx mode (print the result), not its vitest mode (throw).
const ENV_KEYS = ['SIMTEN_REPO_ROOT', 'VITEST', 'VITEST_POOL_ID', 'VITEST_WORKER_ID'];
const savedEnv = new Map<string, string | undefined>();

beforeAll(() => {
  // A project folder with @simten/core, fast-check and tsx resolvable, the way
  // setup_project leaves one, linked to this workspace's copies.
  const here = dirname(fileURLToPath(import.meta.url));
  const core = resolve(here, '../../../core');
  const repo = resolve(core, '../..');
  project = realpathSync(mkdtempSync(join(tmpdir(), 'simten-497-')));
  mkdirSync(join(project, 'node_modules/@simten'), { recursive: true });
  mkdirSync(join(project, 'node_modules/.bin'));
  symlinkSync(core, join(project, 'node_modules/@simten/core'));
  symlinkSync(join(core, 'node_modules/fast-check'), join(project, 'node_modules/fast-check'));
  symlinkSync(realpathSync(join(repo, 'node_modules/tsx')), join(project, 'node_modules/tsx'));
  symlinkSync('../tsx/dist/cli.mjs', join(project, 'node_modules/.bin/tsx'));
  writeFileSync(join(project, 'package.json'), '{ "type": "module" }\n');
  for (const [name, text] of Object.entries(FILES)) writeFileSync(join(project, name), text);
  for (const key of ENV_KEYS) {
    savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
  process.env.SIMTEN_REPO_ROOT = project;
});

afterAll(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(project, { recursive: true, force: true });
});

const TIMEOUT = 60_000;

// check_circuit and simulate_circuit run the file's text with its imports
// stripped and the standard library injected, so a name imported from a
// sibling file is never defined: they fail with "HalfAdder is not defined" and
// "tableRom is not defined". verify_circuit loads the files as real modules and
// passes. Marked as expected failures until the tools load files one way.

describe('a circuit importing a sub-circuit from a sibling file', () => {
  it(
    'verify_circuit passes',
    async () => {
      const result = await verify({ testbench: join(project, 'top.verify.ts'), oracle: ORACLE });
      expect(result.content[0].text).toContain('"testbench_passed": true');
      expect(result.isError).toBe(false);
    },
    TIMEOUT,
  );

  it.fails(
    'check_circuit reports it valid',
    async () => {
      const result = await check({ filePath: join(project, 'top.circuit.ts') });
      const report = JSON.parse(result.content[0].text);
      expect(report.diagnostics).toEqual([]);
      expect(report.valid).toBe(true);
      expect(report.analysis.circuitsDefined).toContain('Top');
    },
    TIMEOUT,
  );

  it.fails(
    'simulate_circuit simulates it',
    async () => {
      const result = await simulate({
        filePath: join(project, 'top.circuit.ts'),
        ticks: 1,
        inputs: { a: 1, b: 1 },
        show: false,
      });
      expect(result.isError).toBeUndefined();
      const trace = JSON.parse(result.content[0].text);
      expect(trace.circuit).toBe('Top');
      expect(trace.signals.sum).toEqual([{ value: 0, count: 1 }]);
      expect(trace.signals.carry).toEqual([{ value: 1, count: 1 }]);
    },
    TIMEOUT,
  );
});

describe('a circuit importing a helper function from a sibling file', () => {
  it(
    'verify_circuit passes',
    async () => {
      const result = await verify({ testbench: join(project, 'lookup.verify.ts'), oracle: ORACLE });
      expect(result.content[0].text).toContain('"testbench_passed": true');
      expect(result.isError).toBe(false);
    },
    TIMEOUT,
  );

  it.fails(
    'check_circuit reports it valid',
    async () => {
      const result = await check({ filePath: join(project, 'lookup.circuit.ts') });
      const report = JSON.parse(result.content[0].text);
      expect(report.diagnostics).toEqual([]);
      expect(report.valid).toBe(true);
      expect(report.analysis.circuitsDefined).toContain('Lookup');
    },
    TIMEOUT,
  );

  it.fails(
    'simulate_circuit reads the table the helper built',
    async () => {
      const result = await simulate({
        filePath: join(project, 'lookup.circuit.ts'),
        ticks: 1,
        inputs: { addr: 1 },
        show: false,
      });
      expect(result.isError).toBeUndefined();
      const trace = JSON.parse(result.content[0].text);
      expect(trace.circuit).toBe('Lookup');
      expect(trace.signals.data).toEqual([{ value: 42, count: 1 }]);
    },
    TIMEOUT,
  );
});
