/** Shared by the sandbox tests: circuit sources and a host driven in-process. */

import type { HostMessage, SessionRequest, SessionResponse } from '../protocol.js';
import { SessionHost, type SessionHostOptions } from '../session-host.js';

/** An 8-bit counter with an enable input. */
export const COUNTER = `
const Counter = circuit('Counter', {
  inputs: { en: bit },
  outputs: { count: bus(8) },
  nodes: { reg: Register(), inc: Incrementer },
  connect: ({ inputs, outputs, nodes: { reg, inc } }) => [
    inputs.en.to(reg.we),
    reg.q.to(inc.in, outputs.count),
    inc.out.to(reg.data),
  ],
})
`;

export const ADDER = `
const Add = circuit('Add', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { sum: bus(8) },
  eval: ({ a, b }) => ({ sum: (a + b) & 0xff }),
})
`;

/** A gated D latch built from NANDs, driven by two switches: the game's d-latch level. */
export const D_LATCH = `
const DLatch = circuit('DLatch', {
  nodes: { d: Switch, en: Switch, n1: Nand, n2: Nand, n3: Nand, n4: Nand, q: Led },
  connect: ({ nodes: { d, en, n1, n2, n3, n4, q } }) => [
    d.out.to(n1.a),
    en.out.to(n1.b, n2.b),
    n1.out.to(n2.a, n3.a),
    n2.out.to(n4.b),
    n3.out.to(n4.a, q.in),
    n4.out.to(n3.b),
  ],
})
`;

/** A request without its id. */
type Body = SessionRequest extends infer R
  ? R extends SessionRequest
    ? Omit<R, 'id'>
    : never
  : never;

/** Narrow a response to the type the test expects, failing with what came instead. */
export function expectType<T extends SessionResponse['type']>(
  response: SessionResponse,
  type: T,
): Extract<SessionResponse, { type: T }> {
  if (response.type !== type) {
    const detail = response.type === 'failed' ? `: ${response.error}` : '';
    throw new Error(`expected '${type}', got '${response.type}'${detail}`);
  }
  return response as Extract<SessionResponse, { type: T }>;
}

/** A host whose answers come back as promises; every message it posts is kept in `messages`. */
export function startHost(options: Partial<SessionHostOptions> = {}) {
  const messages: HostMessage[] = [];
  const waiting = new Map<string, (response: SessionResponse) => void>();
  const host = new SessionHost({
    ...options,
    post: (message) => {
      messages.push(message);
      if (message.type === 'progressed' || message.id === undefined) return;
      const resolve = waiting.get(message.id);
      waiting.delete(message.id);
      resolve?.(message);
    },
  });
  let counter = 0;
  const call = (body: Body): Promise<SessionResponse> =>
    new Promise((resolve) => {
      const id = `t${++counter}`;
      waiting.set(id, resolve);
      host.handle({ ...body, id } as SessionRequest);
    });
  return { host, messages, call };
}
