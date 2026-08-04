/**
 * Regression: `setDebugStateUpdate` must stay reachable from the simulator
 * barrel.
 *
 * The propagation tracing it gates is the only view into a circuit once
 * elaboration has flattened it to typed arrays — but the setter was exported
 * from propagate.ts and never re-exported from simulator/index.ts, so nothing
 * outside that module could flip the flag. The tracing existed and could not
 * be switched on by anyone.
 *
 * Importing through '../index.js' here (not '../propagate.js') is the point:
 * it is the barrel re-export that regressed, and only a barrel import catches
 * that.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { bit, circuit } from '../../circuit/index.js';
import { simulate } from '../../sim/index.js';
import { Register } from '../../std/index.js';
import { setDebugStateUpdate } from '../index.js';

const Dut = circuit('DebugFlagDut', {
  inputs: { d: bit, we: bit },
  outputs: { q: bit },
  nodes: { r: Register({ width: 1 }) },
  connect: ({ inputs, outputs, nodes: { r } }) => [
    inputs.d.to(r.data),
    inputs.we.to(r.we),
    r.q.to(outputs.q),
  ],
});

function tickCapturingLogs(): string[] {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const h = simulate(Dut);
  try {
    h.set({ d: 1, we: 1 });
    h.tick();
    return spy.mock.calls.map((args) => String(args[0]));
  } finally {
    h.dispose();
    spy.mockRestore();
  }
}

describe('setDebugStateUpdate', () => {
  afterEach(() => {
    setDebugStateUpdate(false);
  });

  it('is reachable from the simulator barrel', () => {
    expect(typeof setDebugStateUpdate).toBe('function');
  });

  it('emits no propagation tracing when off (the default)', () => {
    expect(tickCapturingLogs()).toEqual([]);
  });

  it('emits seed and propagate tracing when on', () => {
    setDebugStateUpdate(true);
    const logs = tickCapturingLogs();
    expect(logs.some((l) => l.includes('[seedInitialQueue]'))).toBe(true);
    expect(logs.some((l) => l.includes('[propagate]'))).toBe(true);
  });

  it('stops tracing again once turned off', () => {
    setDebugStateUpdate(true);
    expect(tickCapturingLogs().length).toBeGreaterThan(0);
    setDebugStateUpdate(false);
    expect(tickCapturingLogs()).toEqual([]);
  });
});
