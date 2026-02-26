"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  applyNodeChanges,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
  type Node,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { compileDSL, type ComponentLibrary, type Circuit } from "@/features/dsl";
import {
  elaborate,
  type FlatCircuit,
  type FlatPortValueMap,
  type FlatSequentialState,
  useComponentLibraryStore,
  getPrimitives,
  projectCircuitToReactFlow,
  type MetadataState,
  InputNode,
  OutputNode,
  LogicGateNode,
} from "@turing-incomplete/ui/editor";
import {
  createSimulator,
  type SimulatorEngine,
  type ComponentLibrary as CoreComponentLibrary,
} from "@turing-incomplete/core/simulator";

const nodeTypes: NodeTypes = {
  inputNode: InputNode,
  outputNode: OutputNode,
  logicGateNode: LogicGateNode,
  numericInputNode: InputNode,
  registerNode: LogicGateNode,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// Component library adapter for DSL compiler
class LibraryAdapter implements ComponentLibrary {
  constructor(private store: ReturnType<typeof useComponentLibraryStore.getState>) {}
  getCircuit(name: string) { return this.store.resolveComponent(name); }
  hasCircuit(name: string) { return this.store.resolveComponent(name) !== undefined; }
  addCircuit(circuit: Circuit) { this.store.registerUser(circuit); }
}

// Adapt store for core simulator
function adaptLibrary(store: ReturnType<typeof useComponentLibraryStore.getState>): CoreComponentLibrary {
  return {
    resolveComponent: (name) => store.resolveComponent(name),
    getAllPrimitiveNames: () => store.getAllPrimitiveNames(),
  };
}

// Clean labels: "NandDemo_in_a_12345_xyz" -> "A"
function cleanLabel(nodeId: string): string {
  // Extract meaningful part
  let name = nodeId;
  if (nodeId.includes('.')) {
    name = nodeId.split('.').pop() || nodeId;
  }

  // Remove timestamp suffixes
  const parts = name.split('_');
  for (let i = 0; i < parts.length; i++) {
    if (/^\d{10,}$/.test(parts[i])) {
      name = parts.slice(0, i).join('_');
      break;
    }
  }

  // Remove circuit prefix patterns like "NandDemo_", "AndDemo_", etc.
  const prefixMatch = name.match(/^[A-Z][a-zA-Z]*Demo_(.+)$/);
  if (prefixMatch) {
    name = prefixMatch[1];
  }

  // Friendly names for common patterns
  const friendlyNames: Record<string, string> = {
    'in_a': 'A',
    'in_b': 'B',
    'in_cin': 'Cin',
    'input': 'In',
    'out': 'Out',
    'sum': 'Sum',
    'carry': 'Carry',
    'cout': 'Cout',
    'stored': 'Q',
    'gate': 'NAND',
    'nand1': 'NAND',
    'nand2': 'NAND',
    'nand3': 'NAND',
    'nand4': 'NAND',
    'not_a': 'NOT',
    'not_b': 'NOT',
    'or_out': 'NAND',
    'xor1': 'XOR',
    'and1': 'AND',
    'or1': 'OR',
    'ha1': 'HA1',
    'ha2': 'HA2',
    'dff': 'DFF',
  };

  return friendlyNames[name] || name.toUpperCase();
}

// Auto-layout for circuits
function layoutCircuit(circuit: Circuit): MetadataState {
  const metadata: MetadataState = { components: {}, connections: {} };
  if (!circuit?.nodes) return metadata;

  const inputs: string[] = [];
  const middle: string[] = [];
  const outputs: string[] = [];

  for (const node of circuit.nodes) {
    const ref = node.componentRef;
    if (ref === 'Switch' || ref === 'Input' || ref === 'Button') {
      inputs.push(node.id);
    } else if (ref === 'Led' || ref === 'Output') {
      outputs.push(node.id);
    } else {
      middle.push(node.id);
    }
  }

  const SPACING_X = 140;
  const SPACING_Y = 80;
  const START_X = 50;
  const START_Y = 50;

  const maxRows = Math.max(inputs.length, middle.length, outputs.length, 1);
  const totalHeight = (maxRows - 1) * SPACING_Y;

  // Position inputs
  const inputStartY = START_Y + (totalHeight - (inputs.length - 1) * SPACING_Y) / 2;
  inputs.forEach((id, i) => {
    metadata.components[id] = { id, position: { x: START_X, y: inputStartY + i * SPACING_Y } };
  });

  // Position middle nodes (may need multiple columns)
  const cols = Math.ceil(middle.length / 3);
  const middleStartY = START_Y + (totalHeight - (Math.min(middle.length, 3) - 1) * SPACING_Y) / 2;
  middle.forEach((id, i) => {
    const col = Math.floor(i / 3);
    const row = i % 3;
    metadata.components[id] = {
      id,
      position: { x: START_X + SPACING_X + col * SPACING_X, y: middleStartY + row * SPACING_Y },
    };
  });

  // Position outputs
  const outputX = START_X + SPACING_X * (1 + Math.max(cols, 1));
  const outputStartY = START_Y + (totalHeight - (outputs.length - 1) * SPACING_Y) / 2;
  outputs.forEach((id, i) => {
    metadata.components[id] = { id, position: { x: outputX, y: outputStartY + i * SPACING_Y } };
  });

  return metadata;
}

interface MiniCircuitProps {
  dsl: string;
  sectionId: string;
}

// Fit view button
function FitViewButton() {
  const { fitView } = useReactFlow();
  return (
    <button
      onClick={() => fitView({ padding: 0.2 })}
      className="absolute bottom-2 left-2 bg-gray-800/80 hover:bg-gray-700 text-gray-400 p-1.5 rounded transition-colors z-10"
      title="Fit view"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
      </svg>
    </button>
  );
}

function MiniCircuitInner({ dsl, sectionId }: MiniCircuitProps) {
  const flatCircuitRef = useRef<FlatCircuit | null>(null);
  const compiledCircuitRef = useRef<Circuit | null>(null);
  const simulatorRef = useRef<SimulatorEngine | null>(null);

  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [portValues, setPortValues] = useState<FlatPortValueMap | null>(null);
  const [sequentialState, setSequentialState] = useState<FlatSequentialState | null>(null);
  const [isSequential, setIsSequential] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);

  // Compile and setup simulator
  useEffect(() => {
    setError(null);
    setCycleCount(0);

    const store = useComponentLibraryStore.getState();
    if (store.getAllPrimitiveNames().length === 0) {
      store.registerPrimitives(getPrimitives());
    }

    const library = new LibraryAdapter(store);
    let result;
    try {
      result = compileDSL(dsl, library, `${sectionId}.dsl`);
    } catch (e) {
      setError(`Parse error in ${sectionId}: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }

    if (result.errors.length > 0) {
      setError(`${sectionId}: ${result.errors.map(e => e.message).join("; ")}`);
      return;
    }

    if (result.circuits.length === 0) {
      setError("No circuit found");
      return;
    }

    for (const c of result.circuits) {
      store.registerUser(c);
    }

    const mainCircuit = result.circuits[result.circuits.length - 1];
    compiledCircuitRef.current = mainCircuit;
    setIsSequential(!!mainCircuit.clocks?.length);

    try {
      const elaborated = elaborate(mainCircuit, store);
      flatCircuitRef.current = elaborated;

      const simulator = createSimulator(elaborated, { componentLibrary: adaptLibrary(store) });
      simulatorRef.current = simulator;

      // Clean up labels for display
      const cleanedCircuit: Circuit = {
        ...mainCircuit,
        nodes: mainCircuit.nodes.map(n => ({ ...n, label: cleanLabel(n.label || n.id) })),
      };
      setCircuit(cleanedCircuit);
      setSequentialState(simulator.getState());

      // Initial run
      const simResult = simulator.runCombinational();
      if (!simResult.error) {
        setPortValues(simulator.getPortValues() as FlatPortValueMap);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [dsl, sectionId]);

  // Toggle a switch node
  const toggleNode = useCallback((nodeId: string) => {
    const simulator = simulatorRef.current;
    const flatCircuit = flatCircuitRef.current;
    if (!simulator || !flatCircuit) return;

    const node = flatCircuit.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const current = node.arguments?.value;
    const newValue = typeof current === 'boolean' ? !current : (current === 1 ? 0 : 1);

    simulator.setInput(nodeId, newValue);
    const result = simulator.runCombinational();
    if (!result.error) {
      setPortValues(simulator.getPortValues() as FlatPortValueMap);
    }
  }, []);

  // Clock tick
  const tick = useCallback(() => {
    const simulator = simulatorRef.current;
    if (!simulator) return;

    const result = simulator.tick();
    const state = simulator.getState();
    if (state) {
      setCycleCount(state.cycleCount);
      setSequentialState(state);
    }
    setPortValues(result.portValues as FlatPortValueMap);
  }, []);

  // Reset
  const reset = useCallback(() => {
    const simulator = simulatorRef.current;
    if (!simulator) return;

    simulator.reset();
    setCycleCount(0);
    setSequentialState(simulator.getState());
    const result = simulator.runCombinational();
    if (!result.error) {
      setPortValues(simulator.getPortValues() as FlatPortValueMap);
    }
  }, []);

  // Project to React Flow
  const metadata = useMemo(() => circuit ? layoutCircuit(circuit) : { components: {}, connections: {} }, [circuit]);

  const { projectedNodes, edges } = useMemo(() => {
    if (!circuit) return { projectedNodes: [], edges: [] };

    const projected = projectCircuitToReactFlow(circuit, metadata, portValues ?? undefined, sequentialState ?? undefined);

    const nodesWithHandlers = projected.nodes.map((node) => {
      const ref = node.data?.componentRef;
      if (ref === 'Switch' || ref === 'Input' || ref === 'Button') {
        return {
          ...node,
          data: { ...node.data, onToggle: () => toggleNode(node.id) },
        };
      }
      return node;
    });

    return { projectedNodes: nodesWithHandlers, edges: projected.edges };
  }, [circuit, metadata, portValues, sequentialState, toggleNode]);

  // Sync nodes
  useEffect(() => {
    setNodes(currentNodes => {
      const posMap = new Map(currentNodes.map(n => [n.id, n.position]));
      return projectedNodes.map(n => ({ ...n, position: posMap.get(n.id) ?? n.position }));
    });
  }, [projectedNodes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes(nds => applyNodeChanges(changes, nds)),
    []
  );

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400 text-sm p-4 text-center">
        {error}
      </div>
    );
  }

  if (!circuit) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={[1, 2]}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        preventScrolling={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#1f2937" />
      </ReactFlow>
      <FitViewButton />

      {/* Clock controls for sequential circuits */}
      {isSequential && (
        <div className="absolute bottom-2 right-2 flex items-center gap-2 z-10">
          <button
            onClick={tick}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
          >
            Tick
          </button>
          <button
            onClick={reset}
            className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors"
          >
            Reset
          </button>
          <span className="text-gray-500 text-xs">
            #{cycleCount}
          </span>
        </div>
      )}
    </div>
  );
}

export function MiniCircuit(props: MiniCircuitProps) {
  return (
    <ReactFlowProvider>
      <MiniCircuitInner {...props} />
    </ReactFlowProvider>
  );
}
