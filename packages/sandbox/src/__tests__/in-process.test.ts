/** `inProcessSandbox()`: a client and a host in one process, for tests. */

import { executeCircuitCode } from '@simten/core/internal';
import { afterEach, describe, expect, it } from 'vitest';
import { inProcessSandbox } from '../in-process.js';
import type { SandboxClient } from '../sandbox-client.js';
import { D_LATCH } from './helpers.js';

const open: SandboxClient[] = [];
afterEach(() => {
  for (const client of open.splice(0)) client.dispose();
});

describe('inProcessSandbox', () => {
  it('compiles, opens and drives a circuit like a real sandbox', async () => {
    const client = inProcessSandbox();
    open.push(client);
    const sim = await client.open({ compiled: await client.compile(D_LATCH), circuit: 'DLatch' });
    expect(client.status).toBe('ready');
    await sim.set({ d: 1, en: 1 });
    await sim.set({ d: 0, en: 0 });
    expect(sim.getState().ports.get('q.in')).toBe(1);
  });

  it('runs source through the given execute', async () => {
    const calls: string[] = [];
    const client = inProcessSandbox({
      execute: (source) => {
        calls.push(source);
        return executeCircuitCode(source);
      },
    });
    open.push(client);
    await client.compile(D_LATCH);
    expect(calls).toEqual([D_LATCH]);
  });
});
