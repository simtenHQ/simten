/**
 * An in-process sandbox (`inProcessSandbox()` from `@simten/sandbox/host`)
 * that logs what the hook asks of it, for tests that check a session was
 * closed or a compile released. `slowFirstCompile` holds the first compile's
 * answer back 300ms.
 */

import type { SandboxClient, SimulationClient } from '@simten/sandbox';
import { inProcessSandbox } from '@simten/sandbox/host';

type LoggedCall = 'compile' | 'open' | 'release' | 'set' | 'run' | 'close';

interface SandboxLog {
  client: SandboxClient;
  /** Every call, in order. */
  calls: LoggedCall[];
  /** The circuit and options of each `open`. */
  opens: { circuit: string; history?: number }[];
  /** The values of each `set`. */
  sets: Record<string, number>[];
}

export function loggedSandbox({ slowFirstCompile = false } = {}): SandboxLog {
  const client = inProcessSandbox();
  const calls: LoggedCall[] = [];
  const opens: SandboxLog['opens'] = [];
  const sets: SandboxLog['sets'] = [];
  let compiles = 0;
  const delayFirst = async <T>(result: Promise<T>): Promise<T> => {
    calls.push('compile');
    const first = compiles++ === 0;
    const value = await result;
    if (first && slowFirstCompile) await new Promise((r) => setTimeout(r, 300));
    return value;
  };
  const { compile, compileCircuit, open, release } = client;
  client.compile = (source) => delayFirst(compile.call(client, source));
  client.compileCircuit = (circuit) => delayFirst(compileCircuit.call(client, circuit));
  client.release = (compiled) => {
    calls.push('release');
    release.call(client, compiled);
  };
  client.open = async (source, options) => {
    calls.push('open');
    const circuit = typeof source.circuit === 'string' ? source.circuit : source.circuit.name;
    opens.push({ circuit, history: options?.history });
    const session: SimulationClient = await open.call(client, source, options);
    const { set, run, close } = session;
    session.set = (values) => {
      calls.push('set');
      sets.push(values);
      return set.call(session, values);
    };
    session.run = (speed) => {
      calls.push('run');
      return run.call(session, speed);
    };
    session.close = () => {
      calls.push('close');
      return close.call(session);
    };
    return session;
  };
  return { client, calls, opens, sets };
}
