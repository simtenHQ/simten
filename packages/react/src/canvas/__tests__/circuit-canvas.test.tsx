// @vitest-environment jsdom

/**
 * `CircuitCanvas` on a circuit with ports: the box opens on the session's top
 * level, and what is inside it (a Screen's pixels, a memory to load a program
 * onto) works there as it does on a circuit drawn as it is. And a circuit that
 * fails to open after a good compile leaves the last drawing up.
 */

import { bit, bus, circuit } from '@simten/core';
import { And, DualPortRAM, RV32I_InstrMem, Screen } from '@simten/core/std';
import type { SandboxClient } from '@simten/sandbox';
import { inProcessSandbox } from '@simten/sandbox/host';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SandboxProvider } from '../../sandbox/SandboxProvider';
import { type UseSimulationResult, useSimulation } from '../../sandbox/useSimulation';
import { CircuitCanvas } from '../CircuitCanvas';
import { NODE_TYPES } from '../node-types';

/** Two ANDs in a row, drawn as a box with switches `a`, `b` and lamp `y`. */
const Chain = circuit('Chain', {
  inputs: { a: bit, b: bit },
  outputs: { y: bit },
  nodes: { g1: And, g2: And },
  connect: ({ inputs, outputs, nodes: { g1, g2 } }) => [
    inputs.a.to(g1.a),
    inputs.b.to(g1.b, g2.b),
    g1.out.to(g2.a),
    g2.out.to(outputs.y),
  ],
});

/** A RAM drawn on a Screen, with one port so the canvas draws it as a box. */
const Display = circuit('Display', {
  inputs: { we: bit },
  outputs: { first: bus(8) },
  nodes: { ram: DualPortRAM({ addressWidth: 16 }), screen: Screen() },
  connect: ({ inputs, outputs, nodes: { ram, screen } }) => [
    inputs.we.to(ram.weA),
    screen.addrB.to(ram.addrB),
    ram.outB.to(screen.dataIn),
    ram.outA.to(outputs.first),
  ],
});

/** An instruction memory behind a port. */
const Fetch = circuit('Fetch', {
  inputs: { pc: bus(32) },
  outputs: { instruction: bus(32) },
  nodes: { imem: RV32I_InstrMem },
  connect: ({ inputs, outputs, nodes: { imem } }) => [
    inputs.pc.to(imem.addr),
    imem.instruction.to(outputs.instruction),
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
  // jsdom's File can't read itself back; the memory node reads a dropped file this way.
  Blob.prototype.arrayBuffer ??= function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(this);
    });
  };
});

function inSandbox(children: ReactNode) {
  const client = inProcessSandbox();
  clients.push(client);
  return render(<SandboxProvider client={client}>{children}</SandboxProvider>);
}

/** The drawn node that shows `text`, once React Flow has drawn it. */
function nodeShowing(text: string): Promise<Element> {
  return waitFor(() => {
    const node = [...document.querySelectorAll('.react-flow__node')].find((n) =>
      n.textContent?.includes(text),
    );
    if (!node) throw new Error(`no node showing ${text} yet`);
    return node;
  });
}

const litPixels = () => document.querySelectorAll('rect[fill="#00ff00"]').length;

describe('CircuitCanvas on a circuit with ports', () => {
  it("shows a Screen's pixels once its box is opened", async () => {
    function Demo() {
      const simulation = useSimulation(Display, { memory: { ram: { 0: 1, 9: 1, 63: 1 } } });
      return <CircuitCanvas simulation={simulation} height={300} />;
    }
    inSandbox(<Demo />);
    fireEvent.doubleClick(await nodeShowing('Display'));
    await screen.findByText('8×8 pixels');
    await waitFor(() => expect(litPixels()).toBe(3));
  });

  it('loads a program onto a memory inside the box', async () => {
    const onLoadMemory = vi.fn();
    function Demo() {
      return (
        <CircuitCanvas simulation={useSimulation(Fetch)} onLoadMemory={onLoadMemory} height={300} />
      );
    }
    inSandbox(<Demo />);
    fireEvent.doubleClick(await nodeShowing('Fetch'));
    await screen.findByText('IMEM');
    const input = document.querySelector('input[type="file"]');
    if (!input) throw new Error('no file input');
    const program = new File([new Uint8Array([0x13, 0, 0, 0])], 'nop.bin');
    await act(async () => {
      fireEvent.change(input, { target: { files: [program] } });
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(onLoadMemory).toHaveBeenCalledWith('imem', new Map([[0, 0x13]]));
  });
});

const GOOD = `
const Pass = circuit('Pass', {
  inputs: { a: bit },
  outputs: { y: bit },
  nodes: { g: And },
  connect: ({ inputs, outputs, nodes: { g } }) => [inputs.a.to(g.a, g.b), g.out.to(outputs.y)],
})
`;

/** Compiles, then throws the first time the circuit settles. */
const THROWS = `
const Boom = circuit('Boom', {
  inputs: { a: bit },
  outputs: { y: bit },
  eval: () => { throw new Error('boom on settle') },
})
`;

describe('CircuitCanvas when a circuit fails to open', () => {
  it('keeps the last drawing up and reports the failure as a compile error', async () => {
    const seen: { sim?: UseSimulationResult } = {};
    function Demo({ source }: { source: string }) {
      const simulation = useSimulation({ source });
      seen.sim = simulation;
      return <CircuitCanvas simulation={simulation} height={300} />;
    }
    const { rerender } = inSandbox(<Demo source={GOOD} />);
    await nodeShowing('Pass');

    const client = clients[0];
    rerender(
      <SandboxProvider client={client}>
        <Demo source={THROWS} />
      </SandboxProvider>,
    );
    await waitFor(() => expect(seen.sim?.state.compileError?.message).toMatch(/boom on settle/));
    expect(seen.sim?.state.error).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await nodeShowing('Pass');
  });
});

describe('CircuitCanvas on an update', () => {
  it('re-renders only the nodes whose value changed', async () => {
    // Count each node's renders by wrapping the components the canvas draws nodes with.
    const renders = new Map<string, number>();
    const originals = { ...NODE_TYPES };
    for (const [type, Component] of Object.entries(originals)) {
      // Called, not rendered, so the node's own hooks run in the counted component.
      const draw = Component as (props: NodeProps) => ReactNode;
      NODE_TYPES[type] = (props: NodeProps) => {
        renders.set(props.id, (renders.get(props.id) ?? 0) + 1);
        return draw(props);
      };
    }
    try {
      const seen: { sim?: UseSimulationResult } = {};
      function Demo() {
        const simulation = useSimulation(Chain);
        seen.sim = simulation;
        return <CircuitCanvas simulation={simulation} height={300} />;
      }
      inSandbox(<Demo />);
      await nodeShowing('Chain');
      await new Promise((r) => setTimeout(r, 50));
      renders.clear();

      // `b` is 0, so flipping `a` changes `a` and nothing past the first AND.
      await act(async () => {
        await seen.sim?.actions.toggle('a');
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(seen.sim?.state.portValues?.get('__top__.a')).toBe(1);
      expect([...renders.keys()]).toEqual(['a']);
    } finally {
      Object.assign(NODE_TYPES, originals);
    }
  });
});
