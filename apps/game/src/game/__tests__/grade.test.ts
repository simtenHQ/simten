/**
 * The grader against the sandbox.
 *
 * The port-key contract first. Levels name signals bare, and the sandbox
 * namespaces top-level ports under `__top__.`. The sandbox adapter once shipped
 * the prefixed keys straight through, so grading read `undefined` for every
 * output and, thanks to a `?? 0` fallback, scored it 0, which silently passes
 * every truth-table row that expects 0. Three of the four rows in a two-input
 * AND expect 0, so it looked like one stubborn failing case rather than a
 * grader that never read anything.
 *
 * The host-side tests could not have caught it: they graded on a separate
 * local runtime, which was the half that was already right. There is one
 * grading path now, and the tests run it in `inProcessSandbox()`.
 */

import { SimulationClient } from '@simten/sandbox';
import { inProcessSandbox } from '@simten/sandbox/host';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { grade, readOutputs, resolveOutput } from '../grade';
import { LEVELS, LEVELS_BY_ID } from '../levels';
import { SOLUTIONS } from '../solutions';
import type { Level } from '../types';

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

  function ported(vectors: Level['vectors']): Level {
    const not = LEVELS_BY_ID.get('not');
    if (!not) throw new Error('no not level');
    return { ...not, target: 'Ported', inputs: ['a'], outputs: ['out'], allowed: ['Not'], vectors };
  }

  it('drives a port, and refuses a name that is neither a port nor a Switch', async () => {
    const sandbox = inProcessSandbox();
    try {
      const driven = await grade(
        sandbox,
        ported([{ inputs: { a: 1 }, expect: { out: 0 } }]),
        PORTED,
      );
      expect(driven).toEqual({ status: 'pass', gates: 1 });
      const refused = await grade(
        sandbox,
        ported([{ inputs: { b: 1 }, expect: { out: 0 } }]),
        PORTED,
      );
      expect(refused).toEqual({
        status: 'error',
        message: expect.stringContaining("has no input port, Switch or Input named 'b'"),
      });
    } finally {
      sandbox.dispose();
    }
  });
});

describe('grade', () => {
  // #521: the sandbox settles after each request, so writing a vector's
  // switches one request at a time let d = 0 land while en was still 1, and
  // the latch followed it. The grader now writes them in one request.
  it('passes the d-latch reference solution, whose vectors change two switches at once', async () => {
    const sandbox = inProcessSandbox();
    const set = vi.spyOn(SimulationClient.prototype, 'set');
    try {
      const level = LEVELS.find((l) => l.id === 'd-latch');
      if (!level) throw new Error('no d-latch level');
      const verdict = await grade(sandbox, level, SOLUTIONS[level.id]);
      expect(verdict.status).toBe('pass');
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
      const verdict = await grade(sandbox, level, SOLUTIONS[level.id]);
      expect(verdict.status).toBe('pass');
      expect(open).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalled();
      expect(release).toHaveBeenCalled();
    } finally {
      sandbox.dispose();
    }
  });
});
