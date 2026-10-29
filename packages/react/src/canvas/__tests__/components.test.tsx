// @vitest-environment jsdom

/**
 * The components that take a simulation (decision 0010): `CircuitCanvas`
 * draws it and its clicks call its actions, `ClockControls` drives its clock
 * and renders nothing without one, `WaveformViewer` records it over time.
 * Against an in-process sandbox.
 */

import { bit, bus, circuit } from '@simten/core';
import { And, Register } from '@simten/core/std';
import type { SandboxClient } from '@simten/sandbox';
import { inProcessSandbox } from '@simten/sandbox/host';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SandboxProvider } from '../../sandbox/SandboxProvider';
import { type UseSimulationResult, useSimulation } from '../../sandbox/useSimulation';
import { WaveformViewer } from '../../waveform/WaveformViewer';
import { CircuitCanvas } from '../CircuitCanvas';
import { ClockControls } from '../ClockControls';

const AndGate = circuit('CanvasAnd', {
  inputs: { a: bit, b: bit },
  outputs: { y: bit },
  nodes: { g: And },
  connect: ({ inputs, outputs, nodes: { g } }) => [
    inputs.a.to(g.a),
    inputs.b.to(g.b),
    g.out.to(outputs.y),
  ],
});

const Add8 = circuit('Add8', {
  inputs: { a: bus(8), b: bus(8) },
  outputs: { y: bus(8) },
  eval: ({ a, b }) => ({ y: (a + b) & 0xff }),
});

/** Counts up by `step` while `en` is on. */
const Counter = circuit('CanvasCounter', {
  inputs: { en: bit, step: bus(8) },
  outputs: { count: bus(8) },
  nodes: { reg: Register(), add: Add8 },
  connect: ({ inputs, outputs, nodes: { reg, add } }) => [
    inputs.en.to(reg.we),
    inputs.step.to(add.b),
    reg.q.to(add.a, outputs.count),
    add.y.to(reg.data),
  ],
});

const clients: SandboxClient[] = [];
afterEach(() => {
  cleanup();
  for (const c of clients.splice(0)) c.dispose();
});

beforeAll(() => {
  // React Flow measures nodes; jsdom has no layout, so give it the APIs it calls.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.DOMMatrixReadOnly ??= class {
    m22 = 1;
  } as unknown as typeof DOMMatrixReadOnly;
});

function inSandbox(children: ReactNode) {
  const client = inProcessSandbox();
  clients.push(client);
  return render(<SandboxProvider client={client}>{children}</SandboxProvider>);
}

describe('CircuitCanvas', () => {
  it('shows it is compiling, then the circuit, and a click on a switch sets it', async () => {
    let sim: UseSimulationResult | null = null;
    function Demo() {
      const simulation = useSimulation(AndGate);
      sim = simulation;
      return <CircuitCanvas simulation={simulation} height={300} />;
    }
    inSandbox(<Demo />);
    expect(screen.getByText('Compiling...')).toBeTruthy();
    // React Flow keeps nodes out of the accessibility tree until it has measured them.
    const a = await waitFor(() => {
      const button = document.querySelector('button[role="switch"][aria-label="a"]');
      if (!button) throw new Error('no switch a yet');
      return button;
    });
    await act(async () => {
      fireEvent.click(a);
      await new Promise((r) => setTimeout(r, 20));
    });
    await waitFor(() => expect(sim?.state.portValues?.get('__top__.a')).toBe(1));
  });

  it('shows the compile error when there is nothing to draw', async () => {
    function Demo() {
      return <CircuitCanvas simulation={useSimulation({ source: 'const x = ;' })} />;
    }
    inSandbox(<Demo />);
    await screen.findByText(/Unexpected token/);
  });
});

describe('ClockControls', () => {
  it('renders nothing for a circuit without a clock', async () => {
    let sim: UseSimulationResult | null = null;
    function Demo() {
      const simulation = useSimulation(AndGate);
      sim = simulation;
      return <ClockControls simulation={simulation} />;
    }
    const { container } = inSandbox(<Demo />);
    await waitFor(() => expect(sim?.state.ready).toBe(true));
    expect(container.innerHTML).toBe('');
  });

  it("ticks a sequential circuit's clock", async () => {
    function Demo() {
      const simulation = useSimulation(Counter, { initialInputs: { en: 1, step: 2 } });
      return (
        <>
          <ClockControls simulation={simulation} />
          <span data-testid="count">{simulation.state.outputs.count}</span>
        </>
      );
    }
    inSandbox(<Demo />);
    const tick = await screen.findByRole('button', { name: 'Tick' });
    await act(async () => {
      fireEvent.click(tick);
      await new Promise((r) => setTimeout(r, 20));
    });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
  });
});

describe('WaveformViewer', () => {
  it('records the inputs and outputs at each cycle', async () => {
    let sim: UseSimulationResult | null = null;
    function Demo() {
      const simulation = useSimulation(Counter, { initialInputs: { en: 1, step: 1 } });
      sim = simulation;
      return <WaveformViewer simulation={simulation} />;
    }
    inSandbox(<Demo />);
    await waitFor(() => expect(sim?.state.ready).toBe(true));
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await sim?.actions.tick();
      });
    }
    await screen.findByText(/cycles 0 to 3/);
    for (const name of ['en', 'step', 'count']) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save VCD' })).toBeTruthy();
    // Ticking back through history moves the cursor and keeps the trace.
    await act(async () => {
      await sim?.actions.stepBack();
    });
    expect(screen.getByText(/cycles 0 to 3/)).toBeTruthy();
  });
});
