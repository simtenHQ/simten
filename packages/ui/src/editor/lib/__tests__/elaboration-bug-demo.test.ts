/**
 * Elaboration Bug Demonstration
 *
 * This test shows connections disappearing during elaboration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { elaborate } from '../elaboration';
import { useComponentLibraryStore } from '../../stores/component-library-store';
import { PRIMITIVES } from '@turing-incomplete/core/simulator';
import type { Circuit } from '../../types/circuit';

describe('Elaboration Bug - Composite Connections Disappearing', () => {
  let store: ReturnType<typeof useComponentLibraryStore.getState>;

  beforeEach(() => {
    store = useComponentLibraryStore.getState();
    store.clearAll();
    store.registerPrimitives(PRIMITIVES as any[]);
  });

  it('correctly handles composite with no external connections', () => {
    // A composite instance with no external connections should have NO flat connections.
    // The internal composite wiring defines port FORWARDING rules, not actual connections.
    // Actual connections only exist when something external connects to the composite.

    const bufferComposite: Circuit = {
      id: 'buffer-def',
      name: 'MyBuffer',
      parameters: [],
      inputs: [
        { name: 'in', portType: { kind: 'bit' } }
      ],
      outputs: [
        { name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'not_gate',
          componentRef: 'Not',
          arguments: {},
          inputs: [
            { id: 'not-in', name: 'in', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'not-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [
        // Internal wiring: these define forwarding rules
        {
          id: 'conn1',
          source: { nodeId: '', portName: 'in' },
          target: { nodeId: 'not_gate', portName: 'in' },
          portType: { kind: 'bit' }
        },
        {
          id: 'conn2',
          source: { nodeId: 'not_gate', portName: 'out' },
          target: { nodeId: '', portName: 'out' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    store.registerUser(bufferComposite);

    // Top circuit with NO external connections to buf1
    const topCircuit: Circuit = {
      id: 'top-circuit',
      name: 'TopCircuit',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'buf1',
          componentRef: 'MyBuffer',
          arguments: {},
          inputs: [
            { id: 'buf1-in', name: 'in', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'buf1-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [],  // No external connections to buf1
      implementation: { kind: 'composite' }
    };

    const flat = elaborate(topCircuit, store);

    // Should have 1 primitive node (the Not gate inside buf1)
    expect(flat.nodes).toHaveLength(1);
    expect(flat.nodes[0].id).toBe('buf1.not_gate');
    expect(flat.nodes[0].primitiveType).toBe('Not');

    // Should have 0 connections because nothing external connects to buf1
    // The internal wiring only creates forwarding rules, not actual wires
    expect(flat.connections.length).toBe(0);
  });

  it('correctly stitches external connections through composites', () => {
    // When EXTERNAL connections exist to a composite, they get stitched through
    // to the internal primitives via the forwarding rules.

    const bufferComposite: Circuit = {
      id: 'buffer-def',
      name: 'MyBuffer',
      parameters: [],
      inputs: [
        { name: 'in', portType: { kind: 'bit' } }
      ],
      outputs: [
        { name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'not_gate',
          componentRef: 'Not',
          arguments: {},
          inputs: [
            { id: 'not-in', name: 'in', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'not-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: '', portName: 'in' },
          target: { nodeId: 'not_gate', portName: 'in' },
          portType: { kind: 'bit' }
        },
        {
          id: 'conn2',
          source: { nodeId: 'not_gate', portName: 'out' },
          target: { nodeId: '', portName: 'out' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    store.registerUser(bufferComposite);

    // Top circuit WITH external connections to buf1
    const topCircuit: Circuit = {
      id: 'top-circuit',
      name: 'TopCircuit',
      parameters: [],
      inputs: [
        { name: 'top_in', portType: { kind: 'bit' } }
      ],
      outputs: [
        { name: 'top_out', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'buf1',
          componentRef: 'MyBuffer',
          arguments: {},
          inputs: [
            { id: 'buf1-in', name: 'in', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'buf1-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [
        // External connection TO buf1
        {
          id: 'ext-in',
          source: { nodeId: '', portName: 'top_in' },
          target: { nodeId: 'buf1', portName: 'in' },
          portType: { kind: 'bit' }
        },
        // External connection FROM buf1
        {
          id: 'ext-out',
          source: { nodeId: 'buf1', portName: 'out' },
          target: { nodeId: '', portName: 'top_out' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    const flat = elaborate(topCircuit, store);

    // Should have 1 primitive node
    expect(flat.nodes).toHaveLength(1);
    expect(flat.nodes[0].id).toBe('buf1.not_gate');

    // Should have 2 stitched connections:
    // 1. __top__.top_in -> buf1.not_gate.in (stitched through buf1.in)
    // 2. buf1.not_gate.out -> __top__.top_out (stitched through buf1.out)
    expect(flat.connections.length).toBe(2);

    const connIn = flat.connections.find(c =>
      c.source.portName === 'top_in' &&
      c.target.nodeId === 'buf1.not_gate' && c.target.portName === 'in'
    );
    const connOut = flat.connections.find(c =>
      c.source.nodeId === 'buf1.not_gate' && c.source.portName === 'out' &&
      c.target.portName === 'top_out'
    );

    expect(connIn).toBeDefined();
    expect(connOut).toBeDefined();
  });
});
