/**
 * Elaboration Engine Tests
 *
 * Tests circuit elaboration (flattening composites into primitives).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { elaborate, topologicalSortFlat, TOP_LEVEL_NODE } from '../elaboration';
import { useCircuitLibraryStore } from '../../stores/circuit-library-store';
import type { Circuit } from '../../types/circuit';

describe('Circuit Elaboration', () => {
  beforeEach(() => {
    // Clear component library before each test
    const library = useCircuitLibraryStore.getState();
    library.clearAll();

    // Register basic primitives
    library.registerPrimitive({
      id: 'and-primitive',
      name: 'And',
      parameters: [],
      inputs: [
        { name: 'a', portType: { kind: 'bit' } },
        { name: 'b', portType: { kind: 'bit' } }
      ],
      outputs: [
        { name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [],
      connections: [],
      implementation: { kind: 'primitive' },
      metadata: { kind: 'combinational' }
    });

    library.registerPrimitive({
      id: 'register-primitive',
      name: 'Register',
      parameters: [],
      inputs: [
        { name: 'data', portType: { kind: 'bus', width: 8 } }
      ],
      outputs: [
        { name: 'out', portType: { kind: 'bus', width: 8 } }
      ],
      clocks: [{ name: 'clk' }],
      state: [{
        id: 'reg-state',
        name: 'value',
        stateType: { kind: 'bus', width: 8 },
        initialValue: 0
      }],
      nodes: [],
      connections: [],
      implementation: { kind: 'primitive' },
      metadata: { kind: 'sequential', outputDependency: 'state-only' }
    });
  });

  it('flattens single-level circuit with only primitives', () => {
    const circuit: Circuit = {
      id: 'simple-circuit',
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
            { id: 'and1-a', name: 'a', portType: { kind: 'bit' } },
            { id: 'and1-b', name: 'b', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'and1-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        },
        {
          id: 'reg1',
          componentRef: 'Register',
          arguments: {},
          inputs: [
            { id: 'reg1-data', name: 'data', portType: { kind: 'bus', width: 8 } }
          ],
          outputs: [
            { id: 'reg1-out', name: 'out', portType: { kind: 'bus', width: 8 } }
          ],
          clocks: [
            { id: 'reg1-clk', name: 'clk' }
          ]
        }
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: 'and1', portName: 'out' },
          target: { nodeId: 'reg1', portName: 'data' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    const library = useCircuitLibraryStore.getState();
    const flat = elaborate(circuit, library);

    // Should have 2 nodes (both primitives)
    expect(flat.nodes).toHaveLength(2);
    expect(flat.nodes[0].id).toBe('and1');
    expect(flat.nodes[0].primitiveType).toBe('And');
    expect(flat.nodes[1].id).toBe('reg1');
    expect(flat.nodes[1].primitiveType).toBe('Register');

    // Should have 1 connection
    expect(flat.connections).toHaveLength(1);
    expect(flat.connections[0].source.nodeId).toBe('and1');
    expect(flat.connections[0].target.nodeId).toBe('reg1');

    // Hierarchy should be flat (no children)
    expect(flat.hierarchy.path).toBe('');
    expect(flat.hierarchy.componentName).toBe('SimpleCircuit');
    expect(flat.hierarchy.children).toHaveLength(0);
    expect(flat.hierarchy.primitives).toHaveLength(2);
  });

  it('flattens nested composites', () => {
    const library = useCircuitLibraryStore.getState();

    // Define a composite "AndGate" that contains primitive And
    library.registerStandard({
      id: 'and-composite',
      name: 'AndGate',
      parameters: [],
      inputs: [
        { name: 'a', portType: { kind: 'bit' } },
        { name: 'b', portType: { kind: 'bit' } }
      ],
      outputs: [
        { name: 'out', portType: { kind: 'bit' } }
      ],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'internal_and',
          componentRef: 'And',
          arguments: {},
          inputs: [
            { id: 'internal_and-a', name: 'a', portType: { kind: 'bit' } },
            { id: 'internal_and-b', name: 'b', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'internal_and-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [
        {
          id: 'in-a',
          source: { nodeId: '', portName: 'a' },
          target: { nodeId: 'internal_and', portName: 'a' },
          portType: { kind: 'bit' }
        },
        {
          id: 'in-b',
          source: { nodeId: '', portName: 'b' },
          target: { nodeId: 'internal_and', portName: 'b' },
          portType: { kind: 'bit' }
        },
        {
          id: 'out',
          source: { nodeId: 'internal_and', portName: 'out' },
          target: { nodeId: '', portName: 'out' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    });

    // Create a top-level circuit that uses AndGate
    const circuit: Circuit = {
      id: 'nested-circuit',
      name: 'NestedCircuit',
      parameters: [],
      inputs: [],
      outputs: [],
      clocks: [],
      state: [],
      nodes: [
        {
          id: 'gate1',
          componentRef: 'AndGate',
          arguments: {},
          inputs: [
            { id: 'gate1-a', name: 'a', portType: { kind: 'bit' } },
            { id: 'gate1-b', name: 'b', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'gate1-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [],
      implementation: { kind: 'composite' }
    };

    const flat = elaborate(circuit, library);

    // Should have 1 primitive node (nested composite flattened)
    expect(flat.nodes).toHaveLength(1);
    expect(flat.nodes[0].id).toBe('gate1.internal_and');
    expect(flat.nodes[0].primitiveType).toBe('And');

    // No external connections to gate1, so no flat connections
    // Internal composite wiring defines forwarding rules, not actual wires
    expect(flat.connections).toHaveLength(0);

    // Hierarchy should show nesting
    expect(flat.hierarchy.children).toHaveLength(1);
    expect(flat.hierarchy.children[0].path).toBe('gate1');
    expect(flat.hierarchy.children[0].componentName).toBe('AndGate');
    expect(flat.hierarchy.children[0].primitives).toContain('gate1.internal_and');
  });

  it('handles top-level ports correctly', () => {
    const library = useCircuitLibraryStore.getState();

    const circuit: Circuit = {
      id: 'circuit-with-ports',
      name: 'CircuitWithPorts',
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
          id: 'and1',
          componentRef: 'And',
          arguments: {},
          inputs: [
            { id: 'and1-a', name: 'a', portType: { kind: 'bit' } },
            { id: 'and1-b', name: 'b', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'and1-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        }
      ],
      connections: [
        {
          id: 'input-conn',
          source: { nodeId: '', portName: 'in' },
          target: { nodeId: 'and1', portName: 'a' },
          portType: { kind: 'bit' }
        },
        {
          id: 'output-conn',
          source: { nodeId: 'and1', portName: 'out' },
          target: { nodeId: '', portName: 'out' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    const flat = elaborate(circuit, library);

    // Connections to/from top-level ports should use TOP_LEVEL_NODE
    const inputConn = flat.connections.find(c => c.target.nodeId === 'and1');
    const outputConn = flat.connections.find(c => c.source.nodeId === 'and1');

    expect(inputConn).toBeDefined();
    expect(inputConn!.source.nodeId).toBe(TOP_LEVEL_NODE);

    expect(outputConn).toBeDefined();
    expect(outputConn!.target.nodeId).toBe(TOP_LEVEL_NODE);
  });

  it('topological sort works on flat circuits', () => {
    const library = useCircuitLibraryStore.getState();

    const circuit: Circuit = {
      id: 'topo-test',
      name: 'TopoTest',
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
            { id: 'and1-a', name: 'a', portType: { kind: 'bit' } },
            { id: 'and1-b', name: 'b', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'and1-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        },
        {
          id: 'and2',
          componentRef: 'And',
          arguments: {},
          inputs: [
            { id: 'and2-a', name: 'a', portType: { kind: 'bit' } },
            { id: 'and2-b', name: 'b', portType: { kind: 'bit' } }
          ],
          outputs: [
            { id: 'and2-out', name: 'out', portType: { kind: 'bit' } }
          ],
          clocks: []
        },
        {
          id: 'reg1',
          componentRef: 'Register',
          arguments: {},
          inputs: [
            { id: 'reg1-data', name: 'data', portType: { kind: 'bus', width: 8 } }
          ],
          outputs: [
            { id: 'reg1-out', name: 'out', portType: { kind: 'bus', width: 8 } }
          ],
          clocks: [
            { id: 'reg1-clk', name: 'clk' }
          ]
        }
      ],
      connections: [
        {
          id: 'conn1',
          source: { nodeId: 'and1', portName: 'out' },
          target: { nodeId: 'and2', portName: 'a' },
          portType: { kind: 'bit' }
        }
      ],
      implementation: { kind: 'composite' }
    };

    const flat = elaborate(circuit, library);
    const evalOrder = topologicalSortFlat(flat.nodes, flat.connections, library);

    expect(evalOrder).not.toBeNull();
    expect(evalOrder).toHaveLength(3);

    // Register should come first (state-only node)
    expect(evalOrder![0]).toBe('reg1');

    // and1 should come before and2 (dependency)
    const and1Index = evalOrder!.indexOf('and1');
    const and2Index = evalOrder!.indexOf('and2');
    expect(and1Index).toBeGreaterThan(-1);
    expect(and2Index).toBeGreaterThan(-1);
    expect(and1Index).toBeLessThan(and2Index);
  });
});
