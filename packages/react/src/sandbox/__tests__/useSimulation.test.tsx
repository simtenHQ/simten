// @vitest-environment jsdom

/**
 * `useSimulation` against a real session host, in-process
 * (`inProcessSandbox()`): every message is structured-cloned, as postMessage
 * would. No iframe, no worker, no relay.
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
  type UseSimulationResult,
  useSimulation,
} from '../useSimulation';
import { loggedSandbox } from './logged-sandbox';

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

/** A port and a Switch inside: one `set` for both, by name (decision 0010). */
const Gated = circuit('Gated', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { sw: Switch, g: And },
  connect: ({ inputs, outputs, nodes: { sw, g } }) => [
    inputs.a.to(g.a),
    sw.out.to(g.b),
    g.out.to(outputs.y),
  ],
});

/** A port and a Switch with the same name. */
const Clash = circuit('Clash', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { a: Switch, g: And },
  connect: ({ inputs, outputs, nodes: { a, g } }) => [
    inputs.a.to(g.a),
    a.out.to(g.b),
    g.out.to(outputs.y),
  ],
});

const clients: SandboxClient[] = [];
afterEach(() => {
  cleanup();
  for (const c of clients.splice(0)) c.dispose();
});

function newClient(options?: { slowFirstCompile?: boolean }) {
  const logged = loggedSandbox(options);
  clients.push(logged.client);
  return logged;
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
  return { hook, calls: sandbox.current.calls, sandbox, errors };
}

describe('useSimulation', () => {
  it('compiles a circuit built on the page, harnesses it and flips its switches', async () => {
    const { hook } = render(AndGate);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    const { state } = hook.result.current;
    expect(state.circuit?.name).toBe('AndGateDemo');
    // Export and the game's drilldown need the circuit, not its harness.
    expect(state.circuitName).toBe('AndGate');
    expect(state.definitions?.resolveCircuit('Switch')).toBeDefined();
    expect(state.outputs).toEqual({ y: 0 });

    await act(async () => {
      await hook.result.current.actions.set({ a: 1 });
      await hook.result.current.actions.toggle('b');
    });
    expect(hook.result.current.state.outputs).toEqual({ y: 1 });
    expect(hook.result.current.state.portValues?.get('y.in')).toBe(1);
  });

  it('simulates source text and keeps the last good session after a failed compile', async () => {
    const { hook } = render({ source: COUNTER });
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    await act(async () => {
      await hook.result.current.actions.set({ en: 1 });
      await hook.result.current.actions.tick(3);
    });
    expect(hook.result.current.state.cycle).toBe(3);
    expect(hook.result.current.state.outputs).toEqual({ count: 3 });

    hook.rerender({ source: { source: 'const x = ;' }, options: undefined });
    await waitFor(() => expect(hook.result.current.state.compileError).not.toBeNull());
    // The location comes from the message, which is the only place the sandbox reports it.
    expect(hook.result.current.state.compileError).toMatchObject({ line: 1, column: 11 });
    expect(hook.result.current.state.compileError?.message).toMatch(/\(1:11\)$/);
    expect(hook.result.current.state.ready).toBe(true);
    expect(hook.result.current.state.cycle).toBe(3);
  });

  it('reports a write to anything but an input as an error instead of throwing', async () => {
    const { hook } = render({ source: COUNTER });
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    await act(async () => {
      await hook.result.current.actions.set({ reg: 5 });
    });
    expect(hook.result.current.state.error).toBe(
      "set('reg'): 'reg' is a Register, not an input. Only input ports and Switch and Input nodes can be set; load a memory's contents with the memory option.",
    );
  });

  it('opens a new session for new memory, starting at cycle 0', async () => {
    const first = { rom: { 0: 0x11 } };
    const { hook, calls } = render({ source: ROM_READER }, { memory: first });
    await waitFor(() => expect(hook.result.current.state.outputs).toEqual({ out: 0x11 }));
    await act(async () => {
      await hook.result.current.actions.tick(2);
    });
    const opens = calls.filter((c) => c === 'open').length;

    hook.rerender({
      source: { source: ROM_READER },
      options: { memory: { rom: { 0: 0x22 } } },
    });
    await waitFor(() => expect(hook.result.current.state.outputs).toEqual({ out: 0x22 }));
    expect(calls.filter((c) => c === 'open')).toHaveLength(opens + 1);
    expect(hook.result.current.state.cycle).toBe(0);
    expect(calls).toContain('close');
  });

  it('keeps one actions object across updates and sessions', async () => {
    const { hook } = render(SwitchBoard);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    const { actions } = hook.result.current;
    await act(async () => {
      await actions.toggle('s');
    });
    expect(hook.result.current.state.portValues?.get('g.out')).toBe(1);
    expect(hook.result.current.actions).toBe(actions);
  });

  it('starts a run asked for before the session opened', async () => {
    const { hook, calls } = render({ source: COUNTER });
    act(() => {
      void hook.result.current.actions.run(60);
    });
    await waitFor(() => expect(hook.result.current.state.isRunning).toBe(true));
    expect(hook.result.current.state.speed).toBe(60);
    expect(calls).toContain('run');
    await act(async () => {
      await hook.result.current.actions.pause();
    });
    expect(hook.result.current.state.isRunning).toBe(false);
  });

  it('closes its session and frees its compile when it unmounts', async () => {
    const { hook, calls } = render(AndGate);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    hook.unmount();
    await waitFor(() => {
      expect(calls).toContain('close');
      expect(calls).toContain('release');
    });
  });

  it("doesn't reopen for memory that is equal by value", async () => {
    const { hook, calls } = render({ source: ROM_READER }, { memory: { rom: { 0: 0x11 } } });
    await waitFor(() => expect(hook.result.current.state.outputs).toEqual({ out: 0x11 }));
    await act(async () => {
      await hook.result.current.actions.tick(2);
    });
    hook.rerender({
      source: { source: ROM_READER },
      options: { memory: { rom: { 0: 0x11 } } },
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(hook.result.current.state.cycle).toBe(2);
    expect(calls.filter((c) => c === 'open')).toHaveLength(1);
  });

  it("toggles from the last write, not a pushed state that hasn't caught up", async () => {
    const { hook } = render(SwitchBoard);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    const { actions } = hook.result.current;
    // A double click: the second toggle runs before the first one's state arrives.
    await act(async () => {
      await Promise.all([actions.toggle('s'), actions.toggle('s')]);
    });
    expect(hook.result.current.state.portValues?.get('s.out')).toBe(0);
  });

  it('toggles from a value written by set that is still in flight', async () => {
    const { hook } = render(AndGate);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    const { actions } = hook.result.current;
    await act(async () => {
      await Promise.all([actions.set({ a: 1, b: 1 }), actions.toggle('a')]);
    });
    expect(hook.result.current.state.portValues?.get('a.out')).toBe(0);
    expect(hook.result.current.state.outputs).toEqual({ y: 0 });
  });

  it('forgets a rejected set, so a toggle flips from the real value', async () => {
    const { hook } = render(AndGate);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    const { actions } = hook.result.current;
    await act(async () => {
      await actions.set({ a: 1 });
      // `g` is the And gate inside the circuit: the whole record is rejected and a stays 1.
      await actions.set({ a: 0, g: 1 } as never);
    });
    expect(hook.result.current.state.error).toMatch(/'g' is a And, not an input/);
    await act(async () => {
      await actions.toggle('a');
    });
    expect(hook.result.current.state.portValues?.get('a.out')).toBe(0);
  });

  it('keeps a later write when an earlier one to the same path is rejected', async () => {
    const { hook } = render(AndGate);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    const { actions } = hook.result.current;
    await act(async () => {
      await actions.set({ a: 1 });
      // Both in flight: the record is rejected, then a = 0 lands.
      const rejected = actions.set({ a: 1, g: 1 } as never);
      const later = actions.set({ a: 0 });
      await rejected;
      // a = 0 is still in flight, so the toggle must flip from it, not from 1.
      await Promise.all([later, actions.toggle('a')]);
    });
    expect(hook.result.current.state.portValues?.get('a.out')).toBe(1);
  });

  it('drops a compile that finishes after a newer one started', async () => {
    const { hook, calls } = render({ source: COUNTER }, undefined, { slowFirstCompile: true });
    // The second source goes out before the first compile has answered.
    await waitFor(() => expect(calls).toContain('compile'));
    hook.rerender({ source: { source: ROM_READER }, options: undefined });
    await waitFor(() => expect(hook.result.current.state.circuitName).toBe('RomReader'));
    // The first compile answers late, after RomReader opened, and is let go unopened.
    await waitFor(() => expect(calls).toContain('release'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(calls.filter((c) => c === 'compile')).toHaveLength(2);
    expect(calls.filter((c) => c === 'open')).toHaveLength(1);
    expect(hook.result.current.state.circuitName).toBe('RomReader');
  });

  it('survives a StrictMode double mount without an error', async () => {
    const { hook, errors } = render(AndGate, undefined, { strict: true });
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    await act(async () => {
      await hook.result.current.actions.set({ a: 1 });
    });
    expect(hook.result.current.state.ready).toBe(true);
    expect(errors).toEqual([]);
  });

  it('moves to a new sandbox without opening the old compile there', async () => {
    const { hook, sandbox, errors } = render(AndGate);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    sandbox.current = newClient();
    hook.rerender({ source: AndGate, options: undefined });
    await waitFor(() => expect(sandbox.current.calls).toContain('open'));
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    expect(errors).toEqual([]);
    expect(sandbox.current.calls.filter((c) => c === 'open')).toHaveLength(1);
  });
});

describe('inputs by name', () => {
  it('sets a port and a Switch inside the circuit in one call, and toggles either', async () => {
    const { hook } = render(Gated);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    await act(async () => {
      await hook.result.current.actions.set({ a: 1, sw: 1 });
    });
    expect(hook.result.current.state.outputs).toEqual({ y: 1 });
    // The harness is the session's business: the Switch is under `dut` there.
    expect(hook.result.current.state.portValues?.get('dut.sw.out')).toBe(1);
    await act(async () => {
      await hook.result.current.actions.toggle('sw');
    });
    expect(hook.result.current.state.outputs).toEqual({ y: 0 });
  });

  it('says a key that names both a port and a Switch is ambiguous', async () => {
    const { hook } = render(Clash);
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    await act(async () => {
      await hook.result.current.actions.set({ a: 1 });
    });
    expect(hook.result.current.state.error).toMatch(/ambiguous/);
  });

  it('starts at initialInputs, and reset leaves a flipped switch where it is', async () => {
    const { hook } = render({ source: COUNTER }, { initialInputs: { en: 1 } });
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    await act(async () => {
      await hook.result.current.actions.tick(2);
    });
    expect(hook.result.current.state.outputs).toEqual({ count: 2 });
    await act(async () => {
      await hook.result.current.actions.toggle('en');
      await hook.result.current.actions.reset();
      await hook.result.current.actions.tick(3);
    });
    // en stayed off through the reset, so the counter didn't count.
    expect(hook.result.current.state.cycle).toBe(3);
    expect(hook.result.current.state.outputs).toEqual({ count: 0 });
    expect(hook.result.current.state.portValues?.get('en.out')).toBe(0);
  });

  it('types set, toggle and outputs from a circuit built on the page', async () => {
    const client = newClient().client;
    const hook = renderHook(() => useSimulation(Gated), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SandboxProvider client={client}>{children}</SandboxProvider>
      ),
    });
    await waitFor(() => expect(hook.result.current.state.ready).toBe(true));
    const { actions, state } = hook.result.current;
    const y: number = state.outputs.y;
    expect(y).toBe(0);
    await act(async () => {
      await actions.set({ a: 0, sw: 0 });
      // @ts-expect-error: y is an output
      await actions.set({ y: 1 });
      // @ts-expect-error: g is an And gate
      await actions.toggle('g');
    });
    // Any typed simulation goes to the components.
    const forCanvas: UseSimulationResult = hook.result.current;
    expect(forCanvas.state.ready).toBe(true);
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
