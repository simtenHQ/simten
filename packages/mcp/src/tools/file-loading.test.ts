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
import { toolOf as handlerOf } from '../__tests__/tools.js';
import { registerCheckTool } from './check.js';
import { registerSimulateTool } from './simulate.js';
import { registerVerifyTool } from './verify.js';

const check = handlerOf(registerCheckTool);
const simulate = handlerOf(registerSimulateTool);
const verify = handlerOf(registerVerifyTool);

const ORACLE = {
  tier: 'B',
  type: 'plain-JS reference',
  independence_basis: 'written without the gates',
};

const FILES: Record<string, string> = {
  // Written before decision 0010 removed the builder's own entry.
  'old-path.circuit.ts': `
import { bit, circuit } from '@simten/core/circuit';
import { Not } from '@simten/core/std';

export const Inv = circuit('Inv', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { n: Not },
  connect: ({ inputs, outputs, nodes: { n } }) => [inputs.a.to(n.in), n.out.to(outputs.y)],
});
`,
  // A sub-circuit in its own file, used as a node by the top file.
  'half-adder.circuit.ts': `
import { bit, circuit } from '@simten/core';
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
import { bit, circuit } from '@simten/core';
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
  s.set({ a, b });
  return s.get('sum') === (a ^ b) && s.get('carry') === (a & b);
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
import { bus, circuit } from '@simten/core';
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
  // Not exported, and two of them: both are listed, the last is simulated.
  'pair.circuit.ts': `
import { bit, circuit } from '@simten/core';
import { Not } from '@simten/core/std';

const Inverter = circuit('Inverter', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { n: Not },
  connect: ({ inputs, outputs, nodes: { n } }) => [inputs.a.to(n.in), n.out.to(outputs.y)],
});

circuit('Twice', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { first: Inverter, second: Inverter },
  connect: ({ inputs, outputs, nodes: { first, second } }) => [
    inputs.a.to(first.a),
    first.y.to(second.a),
    second.y.to(outputs.y),
  ],
});
`,
  // No imports at all: a snippet against the injected standard library.
  'snippet.circuit.ts': `
export const Buffer = circuit('Buffer', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { n: Not, m: Not },
  connect: ({ inputs, outputs, nodes: { n, m } }) => [
    inputs.a.to(n.in),
    n.out.to(m.in),
    m.out.to(outputs.y),
  ],
});
`,
  'syntax-error.circuit.ts': `
import { bit, circuit } from '@simten/core';

export const Broken = circuit('Broken', {
  inputs: { a: bit },
  outputs: { y: bit
  connect: ({ inputs, outputs }) => [inputs.a.to(outputs.y)],
});
`,
  'bad-port.circuit.ts': `
import { bit, circuit } from '@simten/core';
import { Not } from '@simten/core/std';

export const BadPort = circuit('BadPort', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { n: Not },
  connect: ({ inputs, outputs, nodes: { n } }) => [
    inputs.a.to(n.nope),
    n.out.to(outputs.y),
  ],
});
`,
  'uses-bad-port.circuit.ts': `
import { bit, circuit } from '@simten/core';
import { BadPort } from './bad-port.circuit.js';

export const UsesBadPort = circuit('UsesBadPort', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { b: BadPort },
  connect: ({ inputs, outputs, nodes: { b } }) => [inputs.a.to(b.a), b.y.to(outputs.y)],
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
  s.set({ addr });
  return s.get('data') === expected[addr];
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

// Before #497, check_circuit and simulate_circuit ran a file's text with its
// imports stripped and the standard library injected, so a name imported from
// a sibling file was never defined: they failed with "HalfAdder is not
// defined" and "tableRom is not defined", while verify_circuit, which loads the
// files as real modules, passed.

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

  it(
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

  it(
    'simulate_circuit simulates it',
    async () => {
      const result = await simulate({
        filePath: join(project, 'top.circuit.ts'),
        ticks: 1,
        inputs: { a: 1, b: 1 },
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

describe('a file that imports the builder from @simten/core/circuit', () => {
  it(
    'check_circuit and simulate_circuit still load it',
    async () => {
      const file = join(project, 'old-path.circuit.ts');
      const report = JSON.parse((await check({ filePath: file })).content[0].text);
      expect(report.valid).toBe(true);
      const trace = JSON.parse(
        (await simulate({ filePath: file, ticks: 1, inputs: { a: 1 } })).content[0].text,
      );
      expect(trace.signals.y).toEqual([{ value: 0, count: 1 }]);
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

  it(
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

  it(
    'simulate_circuit reads the table the helper built',
    async () => {
      const result = await simulate({
        filePath: join(project, 'lookup.circuit.ts'),
        ticks: 1,
        inputs: { addr: 1 },
      });
      expect(result.isError).toBeUndefined();
      const trace = JSON.parse(result.content[0].text);
      expect(trace.circuit).toBe('Lookup');
      expect(trace.signals.data).toEqual([{ value: 42, count: 1 }]);
    },
    TIMEOUT,
  );
});

describe('a single file', () => {
  it(
    'lists every circuit it builds, exported or not, and simulates the last',
    async () => {
      const file = join(project, 'pair.circuit.ts');
      const report = JSON.parse((await check({ filePath: file })).content[0].text);
      expect(report.valid).toBe(true);
      expect(report.analysis.circuitsDefined).toEqual(['Inverter', 'Twice']);

      const result = await simulate({ filePath: file, ticks: 1, inputs: { a: 1 } });
      expect(result.isError).toBeUndefined();
      const trace = JSON.parse(result.content[0].text);
      expect(trace.circuit).toBe('Twice');
      expect(trace.signals.y).toEqual([{ value: 1, count: 1 }]);
    },
    TIMEOUT,
  );

  it(
    'with no imports still runs against the injected standard library',
    async () => {
      const file = join(project, 'snippet.circuit.ts');
      const report = JSON.parse((await check({ filePath: file })).content[0].text);
      expect(report.valid).toBe(true);
      expect(report.analysis.circuitsDefined).toEqual(['Buffer']);

      const result = await simulate({ filePath: file, ticks: 1, inputs: { a: 1 } });
      expect(JSON.parse(result.content[0].text).signals.y).toEqual([{ value: 1, count: 1 }]);
    },
    TIMEOUT,
  );
});

describe('a project with no setup', () => {
  it(
    'checks and simulates a two-file project with no package.json or node_modules',
    async () => {
      const bare = realpathSync(mkdtempSync(join(tmpdir(), 'simten-497-bare-')));
      try {
        for (const name of ['half-adder.circuit.ts', 'top.circuit.ts']) {
          writeFileSync(join(bare, name), FILES[name]);
        }
        const report = JSON.parse(
          (await check({ filePath: join(bare, 'top.circuit.ts') })).content[0].text,
        );
        expect(report.diagnostics).toEqual([]);
        expect(report.analysis.circuitsDefined).toEqual(['HalfAdder', 'Top']);
      } finally {
        rmSync(bare, { recursive: true, force: true });
      }
    },
    TIMEOUT,
  );

  it(
    'sees an edit to an imported file on the next call',
    async () => {
      const sub = join(project, 'half-adder.circuit.ts');
      const run = async () => {
        const result = await simulate({
          filePath: join(project, 'top.circuit.ts'),
          ticks: 1,
          inputs: { a: 1, b: 1 },
        });
        return JSON.parse(result.content[0].text).signals.carry;
      };
      expect(await run()).toEqual([{ value: 1, count: 1 }]);
      writeFileSync(
        sub,
        FILES['half-adder.circuit.ts'].replace(
          'nodes: { x: Xor, n: And }',
          'nodes: { x: Xor, n: Xor }',
        ),
      );
      try {
        expect(await run()).toEqual([{ value: 0, count: 1 }]);
      } finally {
        writeFileSync(sub, FILES['half-adder.circuit.ts']);
      }
    },
    TIMEOUT,
  );
});

describe('an error in a circuit file', () => {
  it(
    'a syntax error comes back with the file and line',
    async () => {
      const file = join(project, 'syntax-error.circuit.ts');
      const report = JSON.parse((await check({ filePath: file })).content[0].text);
      expect(report.valid).toBe(false);
      expect(report.diagnostics[0].line).toBe(7);
      expect(report.diagnostics[0].message).toMatch(
        /^syntax-error\.circuit\.ts:7:\d+: Expected "\}" but found "connect"$/,
      );

      const result = await simulate({ filePath: file, ticks: 1 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(report.diagnostics[0].message);
    },
    TIMEOUT,
  );

  it(
    'a throw inside circuit() comes back with the file and line, not a stack',
    async () => {
      const file = join(project, 'bad-port.circuit.ts');
      const report = JSON.parse((await check({ filePath: file })).content[0].text);
      expect(report.valid).toBe(false);
      expect(report.diagnostics[0].line).toBe(5);
      const message: string = report.diagnostics[0].message;
      expect(message).toMatch(/^bad-port\.circuit\.ts:5:\d+: Circuit 'BadPort' validation failed/);
      expect(message).toContain("Port 'nope' does not exist on node 'n'");
      expect(message).not.toContain('    at ');

      const result = await simulate({ filePath: file, ticks: 1 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe(message);
    },
    TIMEOUT,
  );

  it(
    'an error in an imported file names that file',
    async () => {
      const report = JSON.parse(
        (await check({ filePath: join(project, 'uses-bad-port.circuit.ts') })).content[0].text,
      );
      expect(report.valid).toBe(false);
      // The line is in bad-port.circuit.ts, not the file being checked.
      expect(report.diagnostics[0].line).toBeUndefined();
      expect(report.diagnostics[0].message).toMatch(/^bad-port\.circuit\.ts:5:\d+: /);
    },
    TIMEOUT,
  );
});
