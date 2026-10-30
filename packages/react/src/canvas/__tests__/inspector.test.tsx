// @vitest-environment jsdom

/**
 * The drill-down inspector as a view of the main simulation: values come from
 * the main session by dotted path, boundary ports are indicators, and a
 * reference build runs as a second session that opens with its frame, follows
 * the parent's inputs and closes with it.
 *
 * Sessions run against an in-process session host (no iframe, no worker).
 */

import { bit, circuit, simulate } from '@simten/core';
import {
  type CircuitDefinitions,
  type CircuitIR,
  internalsOf,
  nodesOf,
} from '@simten/core/internal';
import { And, Led, Switch, Xor } from '@simten/core/std';
import type { SandboxClient } from '@simten/sandbox';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { NodeData } from '../../nodes';
import { NumericInputNode } from '../../nodes/NumericInputNode';
import { loggedSandbox } from '../../sandbox/__tests__/logged-sandbox';
import { SandboxProvider } from '../../sandbox/SandboxProvider';
import { type UseSimulationResult, useSimulation } from '../../sandbox/useSimulation';
import { CompositeInspectorDialog } from '../CompositeInspectorDialog';
import { projectCircuit } from '../circuit-to-flow';
import { createDrillDownViewCircuit } from '../drill-down-view';
import { resolveDrillTarget } from '../drill-target';
import type { InspectorFrame } from '../types';
import { useReferenceSession } from '../useReferenceSession';
import { CanvasContext, useValueStore } from '../values';

const HalfAdder = circuit('HalfAdder', {
  inputs: { a: bit, b: bit },
  outputs: { sum: bit, carry: bit },
  nodes: { x: Xor, n: And },
  connect: ({ inputs, outputs, nodes: { x, n } }) => [
    inputs.a.to(x.a, n.a),
    inputs.b.to(x.b, n.b),
    x.out.to(outputs.sum),
    n.out.to(outputs.carry),
  ],
});

/** Switches and lamps around a HalfAdder named `ha`: no ports, so it is drawn as it is. */
const Bench = circuit('Bench', {
  nodes: { a: Switch, b: Switch, ha: HalfAdder, s: Led, c: Led },
  connect: ({ nodes: { a, b, ha, s, c } }) => [
    a.out.to(ha.a),
    b.out.to(ha.b),
    ha.sum.to(s.in),
    ha.carry.to(c.in),
  ],
});

const HALF_ADDER = internalsOf(HalfAdder).ir;

function definitionsOf(...circuits: CircuitIR[]): CircuitDefinitions {
  const byName = new Map(circuits.map((c) => [c.name, c]));
  return {
    resolveCircuit: (name) => byName.get(name),
    getAllPrimitiveNames: () =>
      [...byName.values()].filter((c) => c.implementation.kind === 'primitive').map((c) => c.name),
  };
}

function nodeData(
  nodeId: string,
  componentRef: string,
  args: Record<string, unknown> = {},
  path = nodeId,
): NodeData {
  return {
    nodeId,
    path,
    componentRef,
    label: nodeId,
    inputCount: 0,
    outputCount: 0,
    inputNames: [],
    outputNames: [],
    arguments: args,
  };
}

const clients: SandboxClient[] = [];
afterEach(() => {
  cleanup();
  for (const c of clients.splice(0)) c.dispose();
});

function sandbox() {
  const logged = loggedSandbox();
  clients.push(logged.client);
  return logged;
}

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

/** The value each node and wire of the drill-down view of HalfAdder at `path` reads from `ports`. */
function drillDownValues(ports: ReadonlyMap<string, number>, path: string) {
  const view = createDrillDownViewCircuit(HALF_ADDER);
  const positions = Object.fromEntries(view.nodes.map((n) => [n.id, { x: 0, y: 0 }]));
  const primitives = {
    resolveCircuit: (name: string) =>
      ({ implementation: { kind: 'primitive' }, name }) as unknown as CircuitIR,
    getAllPrimitiveNames: () => [],
  };
  const { nodes, edges } = projectCircuit(view, positions, primitives, path);
  const read = (key: string | undefined) => (key === undefined ? undefined : ports.get(key));
  return {
    node: (id: string) => read(nodes.find((n) => n.id === id)?.data.valueKey),
    wire: (from: string) => read(edges.find((e) => e.source === from)?.data?.keys[0]),
  };
}

describe('a drill-down view', () => {
  it('reads the inside of `ha` and its dissolved boundary from the flat map', () => {
    const sim = simulate(Bench);
    const nodes = nodesOf(sim);
    nodes.set('a', 1);
    const ports = nodes.ports();
    // Flattening dissolves the composite's own ports.
    expect(ports.has('ha.a')).toBe(false);

    const view = drillDownValues(ports, 'ha');
    expect(view.wire('x')).toBe(1);
    expect(view.wire('n')).toBe(0);
    expect(view.node('__boundary_in_a')).toBe(1);
    expect(view.node('__boundary_in_b')).toBe(0);
    expect(view.node('__boundary_out_sum')).toBe(1);
    expect(view.node('__boundary_out_carry')).toBe(0);
  });

  it("reads a session's own ports at its top level", () => {
    const sim = simulate(HalfAdder);
    sim.set({ a: 1, b: 1 });
    const view = drillDownValues(nodesOf(sim).ports(), '');
    expect(view.node('__boundary_in_a')).toBe(1);
    expect(view.node('__boundary_out_sum')).toBe(0);
    expect(view.node('__boundary_out_carry')).toBe(1);
  });
});

describe('drill paths', () => {
  it("opens a composite at the node's path in the session", () => {
    const definitions = definitionsOf(HALF_ADDER);
    expect(resolveDrillTarget(nodeData('ha', 'HalfAdder'), definitions)?.path).toBe('ha');
    const nested = nodeData('ha', 'HalfAdder', {}, 'cpu.ha');
    expect(resolveDrillTarget(nested, definitions)?.path).toBe('cpu.ha');
  });

  it('roots a reference build in its own session, fed from the primitive', () => {
    const frame = resolveDrillTarget(
      nodeData('add', 'Adder', { width: 4 }, 'cpu.add'),
      definitionsOf(),
    );
    expect(frame?.path).toBe('');
    expect(frame?.reference?.instance).toBe('cpu.add');
    expect(frame?.reference?.circuit.name).toBe('Adder4_madeOf');
  });
});

describe('CompositeInspectorDialog', () => {
  /** The dialog open on `ha`, over a live simulation of Bench. */
  function Inspector({ onSimulation }: { onSimulation: (s: UseSimulationResult) => void }) {
    const simulation = useSimulation(Bench);
    onSimulation(simulation);
    const values = useValueStore(simulation.state.portValues);
    const definitions = simulation.state.definitions;
    if (!definitions) return null;
    const stack: InspectorFrame[] = [
      { componentName: 'HalfAdder', componentDef: HALF_ADDER, nodeLabel: 'ha', path: 'ha' },
    ];
    const noop = () => {};
    return (
      <CompositeInspectorDialog
        stack={stack}
        definitions={definitions}
        simulation={simulation}
        values={values}
        onClose={noop}
        onPopLevel={noop}
        onPushLevel={noop}
        onNavigate={noop}
      />
    );
  }

  it('shows boundary ports as indicators that follow the main session', async () => {
    const { client, sets } = sandbox();
    let simulation: UseSimulationResult | null = null;
    render(
      <SandboxProvider client={client}>
        <Inspector onSimulation={(s) => (simulation = s)} />
      </SandboxProvider>,
    );
    await waitFor(() => expect(screen.getByLabelText('a: off')).toBeTruthy());
    // Indicators, not controls.
    expect(screen.queryAllByRole('switch', { hidden: true })).toHaveLength(0);
    expect(screen.getByLabelText('b: off')).toBeTruthy();

    // Flip the switch on the canvas behind the dialog: the inspector follows.
    await act(async () => {
      await simulation?.actions.set({ a: 1 });
    });
    await waitFor(() => expect(screen.getByLabelText('a: on')).toBeTruthy());

    // Nothing the dialog did wrote to the circuit: the one input write is ours.
    expect(sets).toHaveLength(1);
  });
});

describe('a bus boundary port', () => {
  // Wide boundary inputs render as NumericInputNode, which edits on click.
  // In the inspector there's no handler to write with, so it's a reading.
  function renderNumeric(set?: (path: string, value: number) => void) {
    const data: NodeData = {
      ...nodeData('__boundary_in_addr', 'Input', { width: 32, value: 7 }),
      label: 'addr',
      outputNames: ['out'],
      valueKey: 'addr.out',
    };
    const values = {
      get: () => ({ ports: null, peripherals: new Map() }),
      subscribe: () => () => {},
    };
    render(
      <CanvasContext.Provider value={{ values, actions: { set } }}>
        <ReactFlowProvider>
          <NumericInputNode data={data} />
        </ReactFlowProvider>
      </CanvasContext.Provider>,
    );
    fireEvent.click(screen.getByText('7'));
  }

  it('is a reading, not a field, without a handler', () => {
    renderNumeric();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('still edits on the canvas, where there is one', () => {
    renderNumeric(() => {});
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});

describe('useReferenceSession', () => {
  const adder = resolveDrillTarget(
    nodeData('add', 'Adder', { width: 4 }, 'dut.add'),
    definitionsOf(),
  );
  if (!adder) throw new Error('Adder has a reference build');

  function renderReference(client: SandboxClient) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SandboxProvider client={client}>{children}</SandboxProvider>
    );
    return renderHook(
      (props: { frame: InspectorFrame | null; ports: ReadonlyMap<string, number> }) =>
        useReferenceSession(props.frame, props.ports),
      {
        wrapper,
        initialProps: {
          frame: adder as InspectorFrame | null,
          ports: new Map([
            ['dut.add.a', 3],
            ['dut.add.b', 4],
            ['dut.add.carry_in', 0],
          ]),
        },
      },
    );
  }

  it('opens on drill-down, follows the parent, and closes with the frame', async () => {
    const { client, calls, opens, sets } = sandbox();
    const hook = renderReference(client);

    await waitFor(() => expect(hook.result.current.ports?.get('__top__.sum')).toBe(7));
    expect(opens).toHaveLength(1);
    expect(opens[0]).toMatchObject({ circuit: 'Adder4_madeOf', history: 0 });

    // The parent's inputs change; the build follows.
    hook.rerender({
      frame: adder,
      ports: new Map([
        ['dut.add.a', 9],
        ['dut.add.b', 4],
        ['dut.add.carry_in', 1],
      ]),
    });
    await waitFor(() => expect(hook.result.current.ports?.get('__top__.sum')).toBe(14));
    expect(sets.at(-1)).toEqual({ a: 9, carry_in: 1 });

    // A parent update with the same inputs sends nothing.
    const before = calls.length;
    hook.rerender({
      frame: adder,
      ports: new Map([
        ['dut.add.a', 9],
        ['dut.add.b', 4],
        ['dut.add.carry_in', 1],
        ['dut.other.out', 1],
      ]),
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.length).toBe(before);

    // Popping the frame closes the session and frees its compile.
    hook.rerender({ frame: null, ports: new Map() });
    await waitFor(() => expect(calls).toContain('release'));
    expect(calls).toContain('close');
    expect(hook.result.current.ports).toBeNull();
  });

  it('closes when the dialog unmounts', async () => {
    const { client, calls } = sandbox();
    const hook = renderReference(client);
    await waitFor(() => expect(hook.result.current.ports).not.toBeNull());
    hook.unmount();
    await waitFor(() => expect(calls).toContain('close'));
  });
});
