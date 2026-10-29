/**
 * The port-key contract.
 *
 * `GradeRuntime.evaluate` must return BARE port names. The sandbox namespaces
 * top-level ports under `__top__.` while `@simten/core` returns them bare,
 * and because the interface never said which, the sandbox adapter shipped the
 * prefixed keys straight through. Grading then read `undefined` for every
 * output and, thanks to a `?? 0` fallback, scored it 0, which silently passes
 * every truth-table row that expects 0. Three of the four rows in a two-input
 * AND expect 0, so it looked like one stubborn failing case rather than a
 * grader that never read anything.
 *
 * The host-side tests could not have caught it: they use the local runtime,
 * which was the half that was already right.
 */

import { SimulationClient } from '@simten/sandbox';
import { inProcessSandbox } from '@simten/sandbox/host';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { grade } from '../grade';
import { LEVELS } from '../levels';
import { readOutputs, resolveOutput, sandboxRuntime } from '../runtime';
import { SOLUTIONS } from '../solutions';
import { localRuntime } from './local-runtime';

describe('resolveOutput / readOutputs', () => {
  it('strips the __top__ prefix', () => {
    expect(readOutputs({ '__top__.out': 1, '__top__.carry': 0 }, ['out', 'carry'])).toEqual({
      out: 1,
      carry: 0,
    });
  });

  it('coerces bit values to 0/1', () => {
    expect(readOutputs({ '__top__.out': true, '__top__.other': false }, ['out', 'other'])).toEqual({
      out: 1,
      other: 0,
    });
  });

  it('drops internal node ports', () => {
    // `and1.out` is a node's port, not the circuit's. A level grades the
    // interface, so an internal node that shares a port name must not stand in
    // for the real one.
    expect(readOutputs({ 'and1.out': 1, '__top__.out': 0 }, ['out'])).toEqual({ out: 0 });
  });

  it('returns nothing when the bag has no top-level ports', () => {
    // The failure that started this: an empty result must stay empty so the
    // grader reports "could not read output" rather than defaulting to 0.
    expect(readOutputs({ 'and1.out': 1 }, ['out'])).toEqual({});
  });
});

describe('resolveOutput spans both circuit shapes', () => {
  // The two shapes a level can take. One rule reads either, which is what lets
  // the self-contained early levels and the port-based abstraction level share
  // a grader and a level format.
  it('reads a top-level port', () => {
    expect(resolveOutput({ '__top__.out': 1 }, 'out')).toBe(1);
  });

  it('reads an Led node of that name', () => {
    expect(resolveOutput({ 'out.in': 1 }, 'out')).toBe(1);
  });

  it('prefers the port when a circuit somehow has both', () => {
    expect(resolveOutput({ '__top__.out': 0, 'out.in': 1 }, 'out')).toBe(0);
  });

  it('is undefined when neither exists, so the grader can say so', () => {
    expect(resolveOutput({ 'and1.out': 1 }, 'out')).toBeUndefined();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('inputs', () => {
  const PORTED = `
const Ported = circuit('Ported', {
  inputs: { a: bit },
  outputs: { out: bit },
  nodes: { inv: Not },
  connect: ({ inputs, outputs, nodes: { inv } }) => [inputs.a.to(inv.in), inv.out.to(outputs.out)],
})`;

  it('drives a port, and refuses a name that is neither a port nor a Switch, in both runtimes', async () => {
    const sandbox = inProcessSandbox();
    try {
      for (const runtime of [localRuntime(), sandboxRuntime(sandbox)]) {
        const { circuits } = await runtime.compile(PORTED);
        await runtime.select(circuits[0]);
        expect(await runtime.evaluate({ a: 1 }, ['out'])).toEqual({ out: 0 });
        await expect(runtime.evaluate({ b: 1 }, ['out'])).rejects.toThrow(
          "has no input port, Switch or Input named 'b'",
        );
        await runtime.close();
      }
    } finally {
      sandbox.dispose();
    }
  });
});

describe('sandboxRuntime', () => {
  // The browser grades through the sandbox; levels.test.ts proves every level
  // on the local runtime. This ties the two together.
  it('grades every level the same as the local runtime', { timeout: 60_000 }, async () => {
    const sandbox = inProcessSandbox();
    try {
      for (const level of LEVELS) {
        for (const source of [SOLUTIONS[level.id], level.stub]) {
          const local = await grade(localRuntime(), level, source);
          const remote = await grade(sandboxRuntime(sandbox), level, source);
          expect(remote, level.id).toEqual(local);
        }
      }
    } finally {
      sandbox.dispose();
    }
  });

  // #521: the sandbox settles after each request, so writing a vector's
  // switches one request at a time let d = 0 land while en was still 1, and
  // the latch followed it. The grader now writes them in one request.
  it('passes the d-latch reference solution, whose vectors change two switches at once', async () => {
    const sandbox = inProcessSandbox();
    const set = vi.spyOn(SimulationClient.prototype, 'set');
    try {
      const level = LEVELS.find((l) => l.id === 'd-latch');
      if (!level) throw new Error('no d-latch level');
      const remote = await grade(sandboxRuntime(sandbox), level, SOLUTIONS[level.id]);
      expect(remote.status).toBe('pass');
      expect(set).toHaveBeenCalledTimes(level.vectors.length);
    } finally {
      sandbox.dispose();
    }
  });

  it('frees its compile and session when grading ends', async () => {
    const sandbox = inProcessSandbox();
    const open = vi.spyOn(sandbox, 'open');
    const release = vi.spyOn(sandbox, 'release');
    const close = vi.spyOn(SimulationClient.prototype, 'close');
    try {
      const level = LEVELS[0];
      const verdict = await grade(sandboxRuntime(sandbox), level, SOLUTIONS[level.id]);
      expect(verdict.status).toBe('pass');
      expect(open).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalled();
      expect(release).toHaveBeenCalled();
    } finally {
      sandbox.dispose();
    }
  });
});
