/**
 * The server as a client sees it: spawned over stdio, as Claude Code runs it,
 * and driven with the SDK's own client on both protocol eras.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, describe, expect, it } from 'vitest';
import { INSTRUCTIONS } from './create-server.js';

const require = createRequire(import.meta.url);
const tsx = pathToFileURL(require.resolve('tsx')).href;
const entry = resolve(import.meta.dirname, 'index.ts');
const repoRoot = resolve(import.meta.dirname, '../../..');
const outside = mkdtempSync(join(tmpdir(), 'simten-mcp-outside-'));
afterAll(() => rmSync(outside, { recursive: true, force: true }));

const TIMEOUT = 60_000;
const REPO_ONLY = ['read_waveform', 'run_on_fpga'];
const EVERYWHERE = [
  'check_circuit',
  'get_grammar',
  'get_started',
  'get_verify_api',
  'list_components',
  'setup_project',
  'show_circuit',
  'simulate_circuit',
  'verify_circuit',
];

async function connect(cwd: string, mode: 'legacy' | { pin: string }): Promise<Client> {
  const client = new Client(
    { name: 'simten-test', version: '0.0.0' },
    { versionNegotiation: { mode } },
  );
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ['--import', tsx, entry],
      cwd,
      stderr: 'ignore',
    }),
  );
  return client;
}

async function withClient<T>(
  cwd: string,
  mode: 'legacy' | { pin: string },
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const client = await connect(cwd, mode);
  try {
    return await run(client);
  } finally {
    await client.close();
  }
}

const toolNames = (client: Client) =>
  client.listTools().then((r) => r.tools.map((t) => t.name).sort());

describe('over stdio', () => {
  it(
    'serves the 2026-07-28 revision, with cache hints on tools/list',
    () =>
      withClient(repoRoot, { pin: '2026-07-28' }, async (client) => {
        expect(client.getProtocolEra()).toBe('modern');
        expect(client.getNegotiatedProtocolVersion()).toBe('2026-07-28');
        const list = await client.listTools();
        expect(list.ttlMs).toBe(3_600_000);
        expect(list.cacheScope).toBe('private');
      }),
    TIMEOUT,
  );

  it(
    'still serves a 2025 client with initialize',
    () =>
      withClient(outside, 'legacy', async (client) => {
        expect(client.getProtocolEra()).toBe('legacy');
        expect(client.getInstructions()).toBe(INSTRUCTIONS);
        const list = await client.listTools();
        expect(list.ttlMs).toBeUndefined();
        const result = await client.callTool({
          name: 'simulate_circuit',
          arguments: {
            source: `const G = circuit('G', {
              inputs: { a: bit }, outputs: { y: bit }, nodes: { n: Not },
              connect: ({ inputs, outputs, nodes: { n } }) => [inputs.a.to(n.in), n.out.to(outputs.y)],
            });`,
            ticks: 1,
            inputs: { a: 1 },
          },
        });
        expect(result.isError).toBeFalsy();
      }),
    TIMEOUT,
  );

  it(
    'lists run_on_fpga and read_waveform only inside the Simten repo',
    async () => {
      const inside = await withClient(repoRoot, { pin: '2026-07-28' }, toolNames);
      expect(inside).toEqual([...EVERYWHERE, ...REPO_ONLY].sort());
      const elsewhere = await withClient(outside, { pin: '2026-07-28' }, toolNames);
      expect(elsewhere).toEqual(EVERYWHERE);
    },
    TIMEOUT,
  );

  it(
    'rejects a parameter the tool does not have, such as the removed show',
    () =>
      withClient(outside, { pin: '2026-07-28' }, async (client) => {
        const result = await client.callTool({
          name: 'simulate_circuit',
          arguments: { source: 'x', show: true },
        });
        expect(result.isError).toBe(true);
        expect(JSON.stringify(result.content)).toContain('show');
      }),
    TIMEOUT,
  );
});
