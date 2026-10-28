// @vitest-environment jsdom

/**
 * `useSimulation` against a real session host, in-process: the client talks to
 * a `SessionHost` through a transport that structured-clones every message,
 * as postMessage would. No iframe, no worker, no relay.
 */

import { bit, circuit } from '@simten/core/circuit';
import { And, Switch } from '@simten/core/std';
import type { SandboxClient } from '@simten/sandbox';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SandboxProvider } from '../SandboxProvider';
import {
  diagnosticOf,
  type SimulationSource,
  type UseSimulationOptions,
  useSimulation,
} from '../useSimulation';
import { inProcessClient } from './in-process';

const COUNTER = `
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

const ROM_READER = `
const RomReader = circuit('RomReader', {
  inputs: { addr: bus(16) },
  outputs: { out: bus(8) },
  nodes: { rom: ROM() },
  connect: ({ inputs, outputs, nodes: { rom } }) => [inputs.addr.to(rom.addr), rom.data_out.to(outputs.out)],
})
`;

const AndGate = circuit('AndGate', {
  inputs: { a: bit, b: bit },
  outputs: { y: bit },
  nodes: { g: And },
  connect: ({ inputs, outputs, nodes: { g } }) => [
    inputs.a.to(g.a),
    inputs.b.to(g.b),
    g.out.to(outputs.y),
  ],
});

/** A lamp wired to a switch inside the circuit: no ports, so nothing to harness. */
const SwitchBoard = circuit('SwitchBoard', {
  nodes: { s: Switch, g: And },
  connect: ({ nodes: { s, g } }) => [s.out.to(g.a, g.b)],
});

const clients: SandboxClient[] = [];
afterEach(() => {
  cleanup();
  for (const c of clients.splice(0)) c.dispose();
});

function newClient(options?: { slowFirstCompile?: boolean }) {
  const { client, transport } = inProcessClient(options);
  clients.push(client);
  return { client, transport };
}

function render(
  source: SimulationSource | null,
  options?: UseSimulationOptions,
  { strict = false, slowFirstCompile = false } = {},
) {
  const sandbox = { current: newClient({ slowFirstCompile }) };
  /** Every error the hook reported, on any render. */
  const errors: string[] = [];
  const wrapper = ({ children }: { children: ReactNode }) => {
    const provider = <SandboxProvider client={sandbox.current.client}>{children}</SandboxProvider>;
    return strict ? <StrictMode>{provider}</StrictMode> : provider;
  };
  const hook = renderHook(
    (props: { source: SimulationSource | null; options?: UseSimulationOptions }) => {
      const result = useSimulation(props.source, props.options);
      if (result.state.error) errors.push(result.state.error);
      return result;
    },
    { wrapper, initialProps: { source, options } },
  );
  return { hook, transport: sandbox.current.transport, sandbox, errors };
}

describe('useSimulation', () => {
  it('compiles a circuit built on the page, harnesses it and flips its switches', async () => {
    const { hook } = render(AndGate, { harness: true });
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    const { state } = hook.result.current;
    expect(state.circuit?.name).toBe('AndGateDemo');
    expect(state.definitions?.resolveCircuit('Switch')).toBeDefined();
    expect(state.outputs).toEqual({ y: 0 });

    await act(async () => {
      await hook.result.current.actions.setInput('a', 1);
      await hook.result.current.actions.toggleNode('b');
    });
    expect(hook.result.current.state.outputs).toEqual({ y: 1 });
    expect(hook.result.current.state.portValues?.get('y.in')).toBe(1);
  });

  it('simulates source text and keeps the last good session after a failed compile', async () => {
    const { hook } = render({ source: COUNTER }, { debounceMs: 0 });
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    await act(async () => {
      await hook.result.current.actions.set({ en: 1 });
      await hook.result.current.actions.tick(3);
    });
    expect(hook.result.current.state.cycle).toBe(3);
    expect(hook.result.current.state.outputs).toEqual({ count: 3 });

    hook.rerender({ source: { source: 'const x = ;' }, options: { debounceMs: 0 } });
    await waitFor(() => expect(hook.result.current.compileError).not.toBeNull());
    // The location comes from the message, which is the only place the sandbox reports it.
    expect(hook.result.current.compileError).toMatchObject({ line: 1, column: 11 });
    expect(hook.result.current.compileError?.message).toMatch(/\(1:11\)$/);
    expect(hook.result.current.state.ready).toBe(true);
    expect(hook.result.current.state.cycle).toBe(3);
  });

  it('reports a write to anything but an input as an error instead of throwing', async () => {
    const { hook } = render({ source: COUNTER }, { debounceMs: 0 });
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    await act(async () => {
      await hook.result.current.actions.setInput('reg', 5);
    });
    expect(hook.result.current.state.error).toMatch(/'reg' is a Register, not an input/);
  });

  it('opens a new session for new memory, starting at cycle 0', async () => {
    const first = { rom: { 0: 0x11 } };
    const { hook } = render({ source: ROM_READER }, { debounceMs: 0, memory: first });
    await waitFor(() => expect(hook.result.current.state.outputs).toEqual({ out: 0x11 }));
    await act(async () => {
      await hook.result.current.actions.tick(2);
    });
    const before = hook.result.current.client;

    hook.rerender({
      source: { source: ROM_READER },
      options: { debounceMs: 0, memory: { rom: { 0: 0x22 } } },
    });
    await waitFor(() => expect(hook.result.current.state.outputs).toEqual({ out: 0x22 }));
    expect(hook.result.current.client).not.toBe(before);
    expect(hook.result.current.state.cycle).toBe(0);
    expect(before?.getState().status).toBe('closed');
  });

  it('keeps one actions object across updates and sessions', async () => {
    const { hook } = render(SwitchBoard);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    const { actions } = hook.result.current;
    await act(async () => {
      await actions.toggleNode('s');
    });
    expect(hook.result.current.state.portValues?.get('g.out')).toBe(1);
    expect(hook.result.current.actions).toBe(actions);
  });

  it('starts a run asked for before the session opened', async () => {
    const { hook, transport } = render({ source: COUNTER }, { debounceMs: 0 });
    act(() => {
      void hook.result.current.actions.run(60);
    });
    await waitFor(() => expect(hook.result.current.state.isRunning).toBe(true));
    expect(hook.result.current.state.speed).toBe(60);
    expect(transport.sent.some((r) => r.type === 'run')).toBe(true);
    await act(async () => {
      await hook.result.current.actions.pause();
    });
    expect(hook.result.current.state.isRunning).toBe(false);
  });

  it('closes its session and frees its compile when it unmounts', async () => {
    const { hook, transport } = render(AndGate);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    hook.unmount();
    await waitFor(() => {
      const types = transport.sent.map((r) => r.type);
      expect(types).toContain('close');
      expect(types).toContain('release');
    });
  });

  it("doesn't reopen for memory that is equal by value", async () => {
    const { hook, transport } = render(
      { source: ROM_READER },
      { debounceMs: 0, memory: { rom: { 0: 0x11 } } },
    );
    await waitFor(() => expect(hook.result.current.state.outputs).toEqual({ out: 0x11 }));
    await act(async () => {
      await hook.result.current.actions.tick(2);
    });
    const session = hook.result.current.client;
    hook.rerender({
      source: { source: ROM_READER },
      options: { debounceMs: 0, memory: { rom: { 0: 0x11 } } },
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(hook.result.current.client).toBe(session);
    expect(hook.result.current.state.cycle).toBe(2);
    expect(transport.sent.filter((r) => r.type === 'open')).toHaveLength(1);
  });

  it("toggles from the last write, not a pushed state that hasn't caught up", async () => {
    const { hook } = render(SwitchBoard);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    const { actions } = hook.result.current;
    // A double click: the second toggle runs before the first one's state arrives.
    await act(async () => {
      await Promise.all([actions.toggleNode('s'), actions.toggleNode('s')]);
    });
    expect(hook.result.current.state.portValues?.get('s.out')).toBe(0);
  });

  it('drops a compile that finishes after a newer one started', async () => {
    const { hook, transport } = render(
      { source: COUNTER },
      { debounceMs: 0 },
      { slowFirstCompile: true },
    );
    // The second source goes out before the first compile has answered.
    await waitFor(() => expect(transport.sent.map((r) => r.type)).toContain('compile'));
    hook.rerender({ source: { source: ROM_READER }, options: { debounceMs: 0 } });
    await waitFor(() => expect(hook.result.current.state.circuit?.name).toBe('RomReader'));
    // The first compile answers late, after RomReader opened, and is let go unopened.
    await waitFor(() => expect(transport.sent.map((r) => r.type)).toContain('release'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    const types = transport.sent.map((r) => r.type);
    expect(types.filter((t) => t === 'compile')).toHaveLength(2);
    expect(types.filter((t) => t === 'open')).toHaveLength(1);
    expect(hook.result.current.state.circuit?.name).toBe('RomReader');
  });

  it('survives a StrictMode double mount without an error', async () => {
    const { hook, errors } = render(AndGate, { harness: true }, { strict: true });
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    await act(async () => {
      await hook.result.current.actions.setInput('a', 1);
    });
    expect(hook.result.current.state.ready).toBe(true);
    expect(errors).toEqual([]);
  });

  it('moves to a new sandbox without opening the old compile there', async () => {
    const { hook, sandbox, errors } = render(AndGate);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    const first = hook.result.current.client;
    sandbox.current = newClient();
    hook.rerender({ source: AndGate, options: undefined });
    await waitFor(() => expect(hook.result.current.client).not.toBe(first));
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    expect(errors).toEqual([]);
    expect(sandbox.current.transport.sent.filter((r) => r.type === 'open')).toHaveLength(1);
  });
});

describe('diagnosticOf', () => {
  it('reads the location from the end of a parse error', () => {
    expect(diagnosticOf(new Error('Unexpected token (3:7)'))).toEqual({
      message: 'Unexpected token (3:7)',
      line: 3,
      column: 7,
    });
  });

  it('gives 0:0 when the message has no location', () => {
    expect(diagnosticOf('Nothing to show.')).toEqual({
      message: 'Nothing to show.',
      line: 0,
      column: 0,
    });
  });
});
