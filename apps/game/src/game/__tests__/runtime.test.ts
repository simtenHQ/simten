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

import { bit, circuit } from '@simten/core/circuit';
import { internalsOf } from '@simten/core/internal';
import { Led, Not, Switch } from '@simten/core/std';
import { SandboxClient, type SandboxTransport } from '@simten/sandbox';
import { SessionHost } from '@simten/sandbox/host';
import type { SandboxMessage, SessionRequest } from '@simten/sandbox/protocol';
import { describe, expect, it } from 'vitest';
import { grade } from '../grade';
import { LEVELS } from '../levels';
import {
  RuntimeFailure,
  readOutputs,
  resolveOutput,
  sandboxRuntime,
  splitInputs,
} from '../runtime';
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

describe('splitInputs', () => {
  const ported = internalsOf(
    circuit('Ported', {
      inputs: { a: bit },
      outputs: { out: bit },
      nodes: { inv: Not },
      connect: ({ inputs, outputs, nodes: { inv } }) => [
        inputs.a.to(inv.in),
        inv.out.to(outputs.out),
      ],
    }),
  ).ir;
  const selfContained = internalsOf(
    circuit('SelfContained', {
      nodes: { a: Switch, inv: Not, out: Led },
      connect: ({ nodes: { a, inv, out } }) => [a.out.to(inv.in), inv.out.to(out.in)],
    }),
  ).ir;

  it('sends a port name to the ports', () => {
    expect(splitInputs(ported, { a: 1 })).toEqual({ ports: { a: 1 }, nodes: {} });
  });

  it('sends a Switch name to the nodes', () => {
    expect(splitInputs(selfContained, { a: 1 })).toEqual({ ports: {}, nodes: { a: 1 } });
  });

  it('throws for a name that is neither, rather than driving nothing', () => {
    expect(() => splitInputs(ported, { b: 1 })).toThrow(RuntimeFailure);
    expect(() => splitInputs(ported, { b: 1 })).toThrow('`Ported` has no input port or node `b`');
  });
});

/** A session host in this process, through a transport that structured-clones like postMessage. */
function inProcess(sent: SessionRequest[] = []): SandboxTransport {
  let host: SessionHost | null = null;
  return {
    connect(receive) {
      host = new SessionHost({
        post: (message) => {
          if (message.type === 'progressed') return;
          const copy = structuredClone(message) as SandboxMessage;
          setTimeout(() => receive(copy), 0);
        },
      });
      setTimeout(() => receive({ type: 'ready' }), 0);
    },
    send(request) {
      sent.push(request);
      const copy = structuredClone(request);
      setTimeout(() => host?.handle(copy), 0);
    },
    close() {
      host = null;
    },
  };
}

describe('sandboxRuntime', () => {
  // The browser grades through the sandbox; levels.test.ts proves every level
  // on the local runtime. This ties the two together, with one known
  // difference below.
  it('grades every level the same as the local runtime', { timeout: 60_000 }, async () => {
    const sandbox = new SandboxClient({ transport: inProcess() });
    try {
      for (const level of LEVELS) {
        for (const source of [SOLUTIONS[level.id], level.stub]) {
          const local = await grade(localRuntime(), level, source);
          const remote = await grade(sandboxRuntime(sandbox), level, source);
          if (level.id === 'd-latch' && source === SOLUTIONS[level.id]) continue;
          expect(remote, level.id).toEqual(local);
        }
      }
    } finally {
      sandbox.dispose();
    }
  });

  // A bug in the browser grader, on main before #417 PR 7 and after it. The
  // sandbox settles after each `setInput`, so a vector's switches change one
  // at a time: row 2 sets d = 0 while en is still 1, the latch follows d, and
  // en = 0 then holds the 0. The local runtime writes both before settling.
  // Fixing it needs a request that writes several inputs at once. When this
  // test fails, the bug is fixed: drop the exception above and this test.
  it('fails the d-latch reference solution in the browser, as on main', async () => {
    const sandbox = new SandboxClient({ transport: inProcess() });
    try {
      const level = LEVELS.find((l) => l.id === 'd-latch');
      if (!level) throw new Error('no d-latch level');
      const remote = await grade(sandboxRuntime(sandbox), level, SOLUTIONS[level.id]);
      expect(remote).toMatchObject({
        status: 'fail',
        failure: { kind: 'vector', index: 1, actual: { q: 0 } },
      });
      expect(await grade(localRuntime(), level, SOLUTIONS[level.id])).toMatchObject({
        status: 'pass',
      });
    } finally {
      sandbox.dispose();
    }
  });

  it('frees its compile and session when grading ends', async () => {
    const sent: SessionRequest[] = [];
    const sandbox = new SandboxClient({ transport: inProcess(sent) });
    try {
      const level = LEVELS[0];
      const verdict = await grade(sandboxRuntime(sandbox), level, SOLUTIONS[level.id]);
      expect(verdict.status).toBe('pass');
      const types = sent.map((r) => r.type);
      expect(types.filter((t) => t === 'open')).toHaveLength(1);
      expect(types).toContain('close');
      expect(types).toContain('release');
    } finally {
      sandbox.dispose();
    }
  });
});
