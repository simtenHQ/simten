/**
 * Tests for Circuit Flattener (IR v0.1)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { flattenCircuit, hasCompositeComponents } from './circuit-flattener';
import { useComponentLibraryStore } from '../stores/component-library-store';
import type { Circuit } from '../types/ir-v0.1';
import { bitType } from '../types/ir-v0.1';

describe('Circuit Flattener (IR v0.1)', () => {
  beforeEach(() => {
    // Reset library before each test
    const library = useComponentLibraryStore.getState();
    library.clearUserComponents();
  });

  it('should keep primitive-only circuits unchanged', () => {
    const circuit: Circuit = {
      id: 'test:simple',
      name: 'SimpleCircuit',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'and1',
          componentRef: 'And',
          arguments: {},
          inputs: [
            { id: 'and1.a', name: 'a', portType: bitType() },
            { id: 'and1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'and1.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
        {
          id: 'not1',
          componentRef: 'Not',
          arguments: {},
          inputs: [
            { id: 'not1.in', name: 'in', portType: bitType() },
          ],
          outputs: [
            { id: 'not1.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: 'and1', portName: 'out' },
          target: { nodeId: 'not1', portName: 'in' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const flattened = flattenCircuit(circuit);

    // Should have same nodes (all primitives)
    expect(flattened.nodes.length).toBe(2);
    expect(flattened.nodes[0].id).toBe('and1');
    expect(flattened.nodes[1].id).toBe('not1');

    // Should have same connection
    expect(flattened.connections.length).toBe(1);
    expect(flattened.connections[0].source.nodeId).toBe('and1');
    expect(flattened.connections[0].target.nodeId).toBe('not1');
  });

  it('should expand simple composite component (HalfAdder)', () => {
    const library = useComponentLibraryStore.getState();

    // Define HalfAdder as composite
    const halfAdder: Circuit = {
      id: 'user:halfadder',
      name: 'HalfAdder',
      parameters: [],
      inputs: [
        { name: 'a', portType: bitType() },
        { name: 'b', portType: bitType() },
      ],
      outputs: [
        { name: 'sum', portType: bitType() },
        { name: 'carry', portType: bitType() },
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'xor1',
          componentRef: 'Xor',
          arguments: {},
          inputs: [
            { id: 'xor1.a', name: 'a', portType: bitType() },
            { id: 'xor1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'xor1.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
        {
          id: 'and1',
          componentRef: 'And',
          arguments: {},
          inputs: [
            { id: 'and1.a', name: 'a', portType: bitType() },
            { id: 'and1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'and1.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [
        // Input a -> xor1.a
        {
          id: 'c1',
          source: { nodeId: '', portName: 'a' },
          target: { nodeId: 'xor1', portName: 'a' },
          portType: bitType(),
        },
        // Input b -> xor1.b
        {
          id: 'c2',
          source: { nodeId: '', portName: 'b' },
          target: { nodeId: 'xor1', portName: 'b' },
          portType: bitType(),
        },
        // Input a -> and1.a
        {
          id: 'c3',
          source: { nodeId: '', portName: 'a' },
          target: { nodeId: 'and1', portName: 'a' },
          portType: bitType(),
        },
        // Input b -> and1.b
        {
          id: 'c4',
          source: { nodeId: '', portName: 'b' },
          target: { nodeId: 'and1', portName: 'b' },
          portType: bitType(),
        },
        // xor1.out -> sum
        {
          id: 'c5',
          source: { nodeId: 'xor1', portName: 'out' },
          target: { nodeId: '', portName: 'sum' },
          portType: bitType(),
        },
        // and1.out -> carry
        {
          id: 'c6',
          source: { nodeId: 'and1', portName: 'out' },
          target: { nodeId: '', portName: 'carry' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
    };

    library.registerUser(halfAdder);

    // Create circuit using HalfAdder
    const circuit: Circuit = {
      id: 'test:halfadder-usage',
      name: 'HalfAdderUsage',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'sw1',
          componentRef: 'Switch',
          arguments: { value: true },
          inputs: [],
          outputs: [
            { id: 'sw1.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
        {
          id: 'sw2',
          componentRef: 'Switch',
          arguments: { value: true },
          inputs: [],
          outputs: [
            { id: 'sw2.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
        {
          id: 'ha1',
          componentRef: 'HalfAdder',
          arguments: {},
          inputs: [
            { id: 'ha1.a', name: 'a', portType: bitType() },
            { id: 'ha1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'ha1.sum', name: 'sum', portType: bitType() },
            { id: 'ha1.carry', name: 'carry', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: 'sw1', portName: 'out' },
          target: { nodeId: 'ha1', portName: 'a' },
          portType: bitType(),
        },
        {
          id: 'conn2',
          source: { nodeId: 'sw2', portName: 'out' },
          target: { nodeId: 'ha1', portName: 'b' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
    };

    const flattened = flattenCircuit(circuit);

    // Should have 4 nodes: sw1, sw2, ha1__xor1, ha1__and1
    expect(flattened.nodes.length).toBe(4);

    const nodeIds = flattened.nodes.map(n => n.id).sort();
    expect(nodeIds).toContain('sw1');
    expect(nodeIds).toContain('sw2');
    expect(nodeIds).toContain('ha1__xor1');
    expect(nodeIds).toContain('ha1__and1');

    // Check node mapping
    expect(flattened.nodeMapping.get('ha1')).toEqual(['ha1__xor1', 'ha1__and1']);

    // Should have connections: sw1 -> ha1__xor1, sw1 -> ha1__and1, sw2 -> ha1__xor1, sw2 -> ha1__and1
    expect(flattened.connections.length).toBeGreaterThanOrEqual(2);

    // Verify connections are remapped correctly
    const sw1Connections = flattened.connections.filter(c => c.source.nodeId === 'sw1');
    expect(sw1Connections.length).toBeGreaterThan(0);
    expect(sw1Connections.some(c => c.target.nodeId === 'ha1__xor1')).toBe(true);
    expect(sw1Connections.some(c => c.target.nodeId === 'ha1__and1')).toBe(true);
  });

  it('should handle nested composite components (FullAdder using HalfAdders)', () => {
    const library = useComponentLibraryStore.getState();

    // Define HalfAdder
    const halfAdder: Circuit = {
      id: 'user:halfadder',
      name: 'HalfAdder',
      parameters: [],
      inputs: [
        { name: 'a', portType: bitType() },
        { name: 'b', portType: bitType() },
      ],
      outputs: [
        { name: 'sum', portType: bitType() },
        { name: 'carry', portType: bitType() },
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'xor1',
          componentRef: 'Xor',
          arguments: {},
          inputs: [
            { id: 'xor1.a', name: 'a', portType: bitType() },
            { id: 'xor1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'xor1.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
        {
          id: 'and1',
          componentRef: 'And',
          arguments: {},
          inputs: [
            { id: 'and1.a', name: 'a', portType: bitType() },
            { id: 'and1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'and1.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [
        {
          id: 'c1',
          source: { nodeId: '', portName: 'a' },
          target: { nodeId: 'xor1', portName: 'a' },
          portType: bitType(),
        },
        {
          id: 'c2',
          source: { nodeId: '', portName: 'b' },
          target: { nodeId: 'xor1', portName: 'b' },
          portType: bitType(),
        },
        {
          id: 'c3',
          source: { nodeId: '', portName: 'a' },
          target: { nodeId: 'and1', portName: 'a' },
          portType: bitType(),
        },
        {
          id: 'c4',
          source: { nodeId: '', portName: 'b' },
          target: { nodeId: 'and1', portName: 'b' },
          portType: bitType(),
        },
        {
          id: 'c5',
          source: { nodeId: 'xor1', portName: 'out' },
          target: { nodeId: '', portName: 'sum' },
          portType: bitType(),
        },
        {
          id: 'c6',
          source: { nodeId: 'and1', portName: 'out' },
          target: { nodeId: '', portName: 'carry' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
    };

    library.registerUser(halfAdder);

    // Define FullAdder using HalfAdders
    const fullAdder: Circuit = {
      id: 'user:fulladder',
      name: 'FullAdder',
      parameters: [],
      inputs: [
        { name: 'a', portType: bitType() },
        { name: 'b', portType: bitType() },
        { name: 'cin', portType: bitType() },
      ],
      outputs: [
        { name: 'sum', portType: bitType() },
        { name: 'cout', portType: bitType() },
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'ha1',
          componentRef: 'HalfAdder',
          arguments: {},
          inputs: [
            { id: 'ha1.a', name: 'a', portType: bitType() },
            { id: 'ha1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'ha1.sum', name: 'sum', portType: bitType() },
            { id: 'ha1.carry', name: 'carry', portType: bitType() },
          ],
          clocks: [],
        },
        {
          id: 'ha2',
          componentRef: 'HalfAdder',
          arguments: {},
          inputs: [
            { id: 'ha2.a', name: 'a', portType: bitType() },
            { id: 'ha2.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'ha2.sum', name: 'sum', portType: bitType() },
            { id: 'ha2.carry', name: 'carry', portType: bitType() },
          ],
          clocks: [],
        },
        {
          id: 'or1',
          componentRef: 'Or',
          arguments: {},
          inputs: [
            { id: 'or1.a', name: 'a', portType: bitType() },
            { id: 'or1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'or1.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [
        // a -> ha1.a
        {
          id: 'fc1',
          source: { nodeId: '', portName: 'a' },
          target: { nodeId: 'ha1', portName: 'a' },
          portType: bitType(),
        },
        // b -> ha1.b
        {
          id: 'fc2',
          source: { nodeId: '', portName: 'b' },
          target: { nodeId: 'ha1', portName: 'b' },
          portType: bitType(),
        },
        // ha1.sum -> ha2.a
        {
          id: 'fc3',
          source: { nodeId: 'ha1', portName: 'sum' },
          target: { nodeId: 'ha2', portName: 'a' },
          portType: bitType(),
        },
        // cin -> ha2.b
        {
          id: 'fc4',
          source: { nodeId: '', portName: 'cin' },
          target: { nodeId: 'ha2', portName: 'b' },
          portType: bitType(),
        },
        // ha2.sum -> sum
        {
          id: 'fc5',
          source: { nodeId: 'ha2', portName: 'sum' },
          target: { nodeId: '', portName: 'sum' },
          portType: bitType(),
        },
        // ha1.carry -> or1.a
        {
          id: 'fc6',
          source: { nodeId: 'ha1', portName: 'carry' },
          target: { nodeId: 'or1', portName: 'a' },
          portType: bitType(),
        },
        // ha2.carry -> or1.b
        {
          id: 'fc7',
          source: { nodeId: 'ha2', portName: 'carry' },
          target: { nodeId: 'or1', portName: 'b' },
          portType: bitType(),
        },
        // or1.out -> cout
        {
          id: 'fc8',
          source: { nodeId: 'or1', portName: 'out' },
          target: { nodeId: '', portName: 'cout' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
    };

    library.registerUser(fullAdder);

    // Create circuit using FullAdder
    const circuit: Circuit = {
      id: 'test:fulladder-usage',
      name: 'FullAdderUsage',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'fa1',
          componentRef: 'FullAdder',
          arguments: {},
          inputs: [
            { id: 'fa1.a', name: 'a', portType: bitType() },
            { id: 'fa1.b', name: 'b', portType: bitType() },
            { id: 'fa1.cin', name: 'cin', portType: bitType() },
          ],
          outputs: [
            { id: 'fa1.sum', name: 'sum', portType: bitType() },
            { id: 'fa1.cout', name: 'cout', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [],
      implementation: { kind: 'composite' },
    };

    const flattened = flattenCircuit(circuit);

    // Should have 5 primitive nodes: fa1__ha1__xor1, fa1__ha1__and1, fa1__ha2__xor1, fa1__ha2__and1, fa1__or1
    expect(flattened.nodes.length).toBe(5);

    const nodeIds = flattened.nodes.map(n => n.id).sort();
    expect(nodeIds).toContain('fa1__ha1__xor1');
    expect(nodeIds).toContain('fa1__ha1__and1');
    expect(nodeIds).toContain('fa1__ha2__xor1');
    expect(nodeIds).toContain('fa1__ha2__and1');
    expect(nodeIds).toContain('fa1__or1');

    // Verify state isolation - each HalfAdder instance has separate XOR and AND gates
    const ha1Nodes = nodeIds.filter(id => id.startsWith('fa1__ha1__'));
    const ha2Nodes = nodeIds.filter(id => id.startsWith('fa1__ha2__'));
    expect(ha1Nodes.length).toBe(2); // xor1, and1
    expect(ha2Nodes.length).toBe(2); // xor1, and1
  });

  it('should handle sequential components with state isolation', () => {
    const library = useComponentLibraryStore.getState();

    // Define Counter composite with Register
    const counter: Circuit = {
      id: 'user:counter',
      name: 'Counter',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'count', portType: bitType() },
      ],
      clocks: [
        { name: 'clk' },
      ],
      state: [],
      nodes: [
        {
          id: 'reg',
          componentRef: 'Register',
          arguments: { width: 8 },
          inputs: [
            { id: 'reg.d', name: 'd', portType: bitType() },
            { id: 'reg.we', name: 'we', portType: bitType() },
          ],
          outputs: [
            { id: 'reg.q', name: 'q', portType: bitType() },
          ],
          clocks: [
            { name: 'clk' },
          ],
        },
      ],
      connections: [
        {
          id: 'cc1',
          source: { nodeId: 'reg', portName: 'q' },
          target: { nodeId: '', portName: 'count' },
          portType: bitType(),
        },
      ],
      implementation: { kind: 'composite' },
    };

    library.registerUser(counter);

    // Create circuit with TWO counter instances
    const circuit: Circuit = {
      id: 'test:dual-counter',
      name: 'DualCounter',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'counter1',
          componentRef: 'Counter',
          arguments: {},
          inputs: [],
          outputs: [
            { id: 'counter1.count', name: 'count', portType: bitType() },
          ],
          clocks: [
            { name: 'clk' },
          ],
        },
        {
          id: 'counter2',
          componentRef: 'Counter',
          arguments: {},
          inputs: [],
          outputs: [
            { id: 'counter2.count', name: 'count', portType: bitType() },
          ],
          clocks: [
            { name: 'clk' },
          ],
        },
      ],
      connections: [],
      implementation: { kind: 'composite' },
    };

    const flattened = flattenCircuit(circuit);

    // Should have 2 register nodes with unique IDs
    expect(flattened.nodes.length).toBe(2);

    const nodeIds = flattened.nodes.map(n => n.id).sort();
    expect(nodeIds).toContain('counter1__reg');
    expect(nodeIds).toContain('counter2__reg');

    // Verify each has Register componentRef
    expect(flattened.nodes[0].componentRef).toBe('Register');
    expect(flattened.nodes[1].componentRef).toBe('Register');

    // Verify state isolation via unique IDs
    expect(flattened.nodes[0].id).not.toBe(flattened.nodes[1].id);
  });

  it('should correctly detect composite components', () => {
    const library = useComponentLibraryStore.getState();

    // Circuit with only primitives
    const primitiveCircuit: Circuit = {
      id: 'test:primitive-only',
      name: 'PrimitiveOnly',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'and1',
          componentRef: 'And',
          arguments: {},
          inputs: [
            { id: 'and1.a', name: 'a', portType: bitType() },
            { id: 'and1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'and1.out', name: 'out', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [],
      implementation: { kind: 'composite' },
    };

    expect(hasCompositeComponents(primitiveCircuit)).toBe(false);

    // Register a composite component
    const halfAdder: Circuit = {
      id: 'user:halfadder',
      name: 'HalfAdder',
      parameters: [],
      inputs: [
        { name: 'a', portType: bitType() },
        { name: 'b', portType: bitType() },
      ],
      outputs: [
        { name: 'sum', portType: bitType() },
        { name: 'carry', portType: bitType() },
      ],
      clocks: [],
      state: [],
      nodes: [],
      connections: [],
      implementation: { kind: 'composite' },
    };

    library.registerUser(halfAdder);

    // Circuit with composite component
    const compositeCircuit: Circuit = {
      id: 'test:with-composite',
      name: 'WithComposite',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'ha1',
          componentRef: 'HalfAdder',
          arguments: {},
          inputs: [
            { id: 'ha1.a', name: 'a', portType: bitType() },
            { id: 'ha1.b', name: 'b', portType: bitType() },
          ],
          outputs: [
            { id: 'ha1.sum', name: 'sum', portType: bitType() },
            { id: 'ha1.carry', name: 'carry', portType: bitType() },
          ],
          clocks: [],
        },
      ],
      connections: [],
      implementation: { kind: 'composite' },
    };

    expect(hasCompositeComponents(compositeCircuit)).toBe(true);
  });
});
