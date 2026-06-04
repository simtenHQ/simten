import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerSetupTool } from './setup.js';
import { registerVerifyTool } from './verify.js';

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;

function capture(register: (s: never) => void): Map<string, Handler> {
  const tools = new Map<string, Handler>();
  const server = { tool: (name: string, _d: string, _s: unknown, h: Handler) => tools.set(name, h) };
  register(server as never);
  return tools;
}

describe('setup_project registration', () => {
  it('registers the setup_project tool', () => {
    expect([...capture(registerSetupTool).keys()]).toEqual(['setup_project']);
  });
});

describe('verify_circuit preflight', () => {
  let dir: string;
  let prevCwd: string;
  beforeEach(() => {
    prevCwd = process.cwd();
    dir = mkdtempSync(join(tmpdir(), 'simten-verify-'));
    process.chdir(dir);
  });
  afterEach(() => {
    process.chdir(prevCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns setup_required (without running tsx) when the folder has no framework deps', async () => {
    const verify = capture(registerVerifyTool).get('verify_circuit')!;
    const res = await verify({
      testbench: 'whatever.verify.ts',
      oracle: { tier: 'C', type: 't', independence_basis: 'b' },
    });
    expect(res.isError).toBe(true);
    const json = JSON.parse(res.content[0].text);
    expect(json.status).toBe('setup_required');
    expect(json.manual).toContain('@simten/core');
  });
});
