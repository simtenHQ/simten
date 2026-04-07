/**
 * Core Circuit Elaboration Engine
 *
 * Transforms hierarchical circuits (with composites) into flat circuits (primitives only).
 * This module has no browser/Zustand dependencies.
 *
 * Key concepts:
 * - Elaboration = Instantiation + Flattening
 * - Happens ONCE at compile-time, not every simulation tick
 * - Preserves hierarchy metadata for UI visualization
 * - Eliminates runtime composite evaluation complexity
 */

import type {
  Circuit,
  PortPath,
  CircuitLibrary,
} from '../types/circuit.js';
import type {
  FlatCircuit,
  FlatNode,
  FlatConnection,
  HierarchyNode,
} from '../types/simulator.js';
import { TOP_LEVEL_NODE, SEQUENTIAL_INPUT_PORTS } from '../types/simulator.js';
import { isBasePrimitive } from '../verilog/primitive-map.js';

export interface ElaborateOptions {
  /** Expand primitives that have referenceCircuit definitions into base primitives.
   *  Used by the Verilog exporter to produce fully synthesisable output.
   *  Default: false (normal simulation uses fast JavaScript evaluators). */
  expandReferences?: boolean;
}

// ============================================================================
// Elaboration Engine
// ============================================================================

/**
 * Elaborate a circuit: recursively flatten all composites into primitives.
 *
 * This is the main entry point for circuit elaboration.
 * It transforms a hierarchical circuit into a flat netlist of primitives.
 *
 * @param circuit - The circuit to elaborate
 * @param library - Component library for resolving component definitions
 * @param debug - Enable debug logging
 * @returns Flattened circuit with only primitives
 */
export function elaborate(
  circuit: Circuit,
  library: CircuitLibrary,
  debug: boolean = false,
  options?: ElaborateOptions,
): FlatCircuit {
  const nodes: FlatNode[] = [];
  const connections: FlatConnection[] = [];
  const hierarchy: HierarchyNode = {
    path: '',
    componentName: circuit.name,
    children: [],
    primitives: []
  };

  /**
   * Recursively flatten a circuit and all its nested composites.
   */
  function flattenCircuit(
    circ: Circuit,
    pathPrefix: string,
    parentHierarchy: HierarchyNode,
    elaborationStack: Set<string> = new Set()
  ): void {
    for (const node of circ.nodes) {
      const fullPath = pathPrefix + node.id;
      const component = library.resolveCircuit(node.componentRef);

      if (!component) {
        throw new Error(
          `Unknown component: ${node.componentRef} (referenced by node ${fullPath})`
        );
      }

      if (component.implementation.kind === 'primitive') {
        // TODO: Reference circuit expansion for Verilog export will be
        // reimplemented using the TypeScript builder API.
        // For now, all primitives are emitted as-is (no expansion).

        // Standard path: leaf primitive - add to flat list
        nodes.push({
          id: fullPath,
          primitiveType: node.componentRef,
          arguments: node.arguments,
          inputs: node.inputs.map(p => ({...p, nodeId: fullPath})),
          outputs: node.outputs.map(p => ({...p, nodeId: fullPath})),
          clocks: node.clocks.map(c => ({...c, nodeId: fullPath})),
          dependents: [],
          inputSources: [],
        });
        parentHierarchy.primitives.push(fullPath);

      } else if (component.implementation.kind === 'composite') {
        // Guard against recursive circuit definitions
        if (elaborationStack.has(node.componentRef)) {
          throw new Error(
            `Recursive circuit definition detected: '${node.componentRef}' references itself ` +
            `(cycle: ${[...elaborationStack, node.componentRef].join(' → ')})`
          );
        }

        // Create hierarchy node for this composite
        const childHierarchy: HierarchyNode = {
          path: fullPath,
          componentName: node.componentRef,
          children: [],
          primitives: []
        };
        parentHierarchy.children.push(childHierarchy);

        // Recursively flatten the composite's internal circuit
        const childStack = new Set(elaborationStack);
        childStack.add(node.componentRef);
        flattenCircuit(component, fullPath + '.', childHierarchy, childStack);

      } else {
        // Intrinsic components are treated like primitives
        console.warn(
          `Intrinsic component ${node.componentRef} treated as primitive during elaboration`
        );
        nodes.push({
          id: fullPath,
          primitiveType: node.componentRef,
          arguments: node.arguments,
          inputs: node.inputs.map(p => ({...p, nodeId: fullPath})),
          outputs: node.outputs.map(p => ({...p, nodeId: fullPath})),
          clocks: node.clocks.map(c => ({...c, nodeId: fullPath})),
          dependents: [],
          inputSources: [],
        });
        parentHierarchy.primitives.push(fullPath);
      }
    }

    // Flatten connections with full paths
    for (const conn of circ.connections) {
      const sourceId = conn.source.nodeId === ''
        ? (pathPrefix === '' ? TOP_LEVEL_NODE : pathPrefix.slice(0, -1))
        : pathPrefix + conn.source.nodeId;

      const targetId = conn.target.nodeId === ''
        ? (pathPrefix === '' ? TOP_LEVEL_NODE : pathPrefix.slice(0, -1))
        : pathPrefix + conn.target.nodeId;

      connections.push({
        id: `${sourceId}.${conn.source.portName}->${targetId}.${conn.target.portName}`,
        source: {
          nodeId: sourceId,
          portName: conn.source.portName
        },
        target: {
          nodeId: targetId,
          portName: conn.target.portName
        },
        portType: conn.portType
      });
    }
  }

  // Start elaboration from top level
  flattenCircuit(circuit, '', hierarchy, new Set([circuit.name]));

  // Post-process: Stitch connections through composite port boundaries
  const stitchedConnections = stitchCompositeConnections(
    circuit,
    connections,
    nodes,
    library,
    '',
    debug
  );

  // Build the flat circuit
  const flatCircuit: FlatCircuit = {
    nodes,
    connections: stitchedConnections,
    hierarchy,
    topLevelInputs: circuit.inputs,
    topLevelOutputs: circuit.outputs,
    nodeMap: new Map(),
  };

  // Build dependency graph for event-driven simulation
  buildDependencyGraph(flatCircuit);

  return flatCircuit;
}

/**
 * Stitch connections through composite port boundaries.
 */
function stitchCompositeConnections(
  circuit: Circuit,
  connections: FlatConnection[],
  flatNodes: FlatNode[],
  library: CircuitLibrary,
  pathPrefix: string,
  debug: boolean = false
): FlatConnection[] {
  // Build a map of composite port forwarding rules
  const portForwarding = new Map<string, PortPath[]>();

  // Track all composite instances
  const compositeInstances = new Set<string>();

  // Build forwarding map for each composite instance
  function buildForwardingMap(circ: Circuit, prefix: string, elaborationStack: Set<string> = new Set()): void {
    for (const node of circ.nodes) {
      const fullPath = prefix + node.id;
      const component = library.resolveCircuit(node.componentRef);

      if (!component) continue;

      if (component.implementation.kind === 'composite') {
        if (elaborationStack.has(node.componentRef)) continue; // Already guarded in flattenCircuit

        compositeInstances.add(fullPath);

        if (debug) {
          console.log(`\n=== Tracing composite: ${fullPath} (${node.componentRef}) ===`);
        }
        traceCompositePorts(component, fullPath, portForwarding, library, debug);

        const childStack = new Set(elaborationStack);
        childStack.add(node.componentRef);
        buildForwardingMap(component, fullPath + '.', childStack);
      }
    }
  }

  buildForwardingMap(circuit, pathPrefix, new Set([circuit.name]));

  if (debug) {
    console.log(`\n=== Port Forwarding Map (${portForwarding.size} rules) ===`);
    for (const [key, values] of portForwarding.entries()) {
      for (const value of values) {
        console.log(`  ${key} -> ${value.nodeId}.${value.portName}`);
      }
    }
  }

  // Rewrite connections using the forwarding map
  const stitchedConnections: FlatConnection[] = [];

  for (const conn of connections) {
    const sourceIsComposite = compositeInstances.has(conn.source.nodeId);
    const targetIsComposite = compositeInstances.has(conn.target.nodeId);

    // Skip internal port forwarding connections
    const sourceInsideTarget = targetIsComposite &&
                                conn.source.nodeId.startsWith(conn.target.nodeId + '.');
    const targetInsideSource = sourceIsComposite &&
                                conn.target.nodeId.startsWith(conn.source.nodeId + '.');

    if (sourceInsideTarget || targetInsideSource) {
      if (debug) {
        console.log(`  SKIP PORT FORWARDING: ${conn.source.nodeId}.${conn.source.portName} -> ${conn.target.nodeId}.${conn.target.portName}`);
      }
      continue;
    }

    const isInternalConnection = sourceIsComposite && targetIsComposite &&
                                 conn.source.nodeId === conn.target.nodeId;

    const isPrimitive = (port: PortPath): boolean =>
      port.nodeId === TOP_LEVEL_NODE || flatNodes.some(n => n.id === port.nodeId);

    const resolveToEndpoints = (start: PortPath): PortPath[] => {
      const results: PortPath[] = [];
      const visited = new Set<string>();
      const queue: PortPath[] = [start];

      while (queue.length > 0) {
        const current = queue.shift()!;
        const key = `${current.nodeId}.${current.portName}`;

        if (visited.has(key)) continue;
        visited.add(key);

        if (isPrimitive(current)) {
          results.push(current);
          continue;
        }

        if (compositeInstances.has(current.nodeId) && portForwarding.has(key)) {
          const forwards = portForwarding.get(key)!;
          for (const fwd of forwards) {
            queue.push(fwd);
          }
        } else {
          results.push(current);
        }
      }

      return results.length > 0 ? results : [start];
    };

    let sources: PortPath[] = [conn.source];
    if (sourceIsComposite && !isInternalConnection) {
      sources = resolveToEndpoints(conn.source);
      if (debug && sources.length > 0) {
        for (const src of sources) {
          console.log(`  FORWARD SOURCE: ${conn.source.nodeId}.${conn.source.portName} -> ${src.nodeId}.${src.portName}`);
        }
      }
    }

    let targets: PortPath[] = [conn.target];
    if (targetIsComposite && !isInternalConnection) {
      targets = resolveToEndpoints(conn.target);
      if (debug && targets.length > 0) {
        for (const tgt of targets) {
          console.log(`  FORWARD TARGET: ${conn.target.nodeId}.${conn.target.portName} -> ${tgt.nodeId}.${tgt.portName}`);
        }
      }
    }

    // Create connections for all source-target pairs
    for (const finalSource of sources) {
      for (const finalTarget of targets) {
        const isSelfLoop = finalSource.nodeId === finalTarget.nodeId &&
                          finalSource.portName === finalTarget.portName;

        if (!isSelfLoop) {
          stitchedConnections.push({
            id: `${finalSource.nodeId}.${finalSource.portName}->${finalTarget.nodeId}.${finalTarget.portName}`,
            source: finalSource,
            target: finalTarget,
            portType: conn.portType
          });
        }
      }
    }
  }

  // Post-process: Eliminate passthrough connections
  const passthroughConnections = stitchedConnections.filter(conn =>
    compositeInstances.has(conn.source.nodeId) &&
    conn.source.nodeId === conn.target.nodeId
  );

  if (passthroughConnections.length > 0) {
    if (debug) {
      console.log(`\n=== Eliminating ${passthroughConnections.length} passthrough connections ===`);
    }

    const finalConnections: FlatConnection[] = [];
    const processedPassthroughs = new Set<string>();

    for (const conn of stitchedConnections) {
      const isPassthrough = compositeInstances.has(conn.source.nodeId) &&
                           conn.source.nodeId === conn.target.nodeId;

      if (isPassthrough) {
        processedPassthroughs.add(conn.id);
        if (debug) {
          console.log(`  PASSTHROUGH: ${conn.source.nodeId}.${conn.source.portName} -> ${conn.target.portName}`);
        }

        const inputConnections = stitchedConnections.filter(c =>
          c.target.nodeId === conn.source.nodeId &&
          c.target.portName === conn.source.portName &&
          !processedPassthroughs.has(c.id)
        );

        const outputConnections = stitchedConnections.filter(c =>
          c.source.nodeId === conn.target.nodeId &&
          c.source.portName === conn.target.portName &&
          !processedPassthroughs.has(c.id)
        );

        for (const inputConn of inputConnections) {
          for (const outputConn of outputConnections) {
            const directConn: FlatConnection = {
              id: `${inputConn.source.nodeId}.${inputConn.source.portName}->${outputConn.target.nodeId}.${outputConn.target.portName}`,
              source: inputConn.source,
              target: outputConn.target,
              portType: conn.portType
            };
            finalConnections.push(directConn);
            processedPassthroughs.add(inputConn.id);
            processedPassthroughs.add(outputConn.id);

            if (debug) {
              console.log(`    DIRECT: ${directConn.source.nodeId}.${directConn.source.portName} -> ${directConn.target.nodeId}.${directConn.target.portName}`);
            }
          }
        }
      } else if (!processedPassthroughs.has(conn.id)) {
        finalConnections.push(conn);
      }
    }

    return resolveThroughComposites(finalConnections, flatNodes, compositeInstances, debug);
  }

  return resolveThroughComposites(stitchedConnections, flatNodes, compositeInstances, debug);
}

/**
 * Resolve connections through composite ports via transitive closure.
 */
function resolveThroughComposites(
  connections: FlatConnection[],
  flatNodes: FlatNode[],
  _compositeInstances: Set<string>,
  debug: boolean
): FlatConnection[] {
  const isPrimitive = (port: PortPath): boolean =>
    port.nodeId === TOP_LEVEL_NODE || flatNodes.some(n => n.id === port.nodeId);

  const connectionsToPort = new Map<string, FlatConnection[]>();
  const connectionsFromPort = new Map<string, FlatConnection[]>();

  for (const conn of connections) {
    const targetKey = `${conn.target.nodeId}.${conn.target.portName}`;
    if (!connectionsToPort.has(targetKey)) {
      connectionsToPort.set(targetKey, []);
    }
    connectionsToPort.get(targetKey)!.push(conn);

    const sourceKey = `${conn.source.nodeId}.${conn.source.portName}`;
    if (!connectionsFromPort.has(sourceKey)) {
      connectionsFromPort.set(sourceKey, []);
    }
    connectionsFromPort.get(sourceKey)!.push(conn);
  }

  const result: FlatConnection[] = [];
  const processed = new Set<string>();

  for (const conn of connections) {
    if (isPrimitive(conn.source) && isPrimitive(conn.target)) {
      result.push(conn);
      continue;
    }

    if (!isPrimitive(conn.target)) {
      const targetKey = `${conn.target.nodeId}.${conn.target.portName}`;
      const outgoing = connectionsFromPort.get(targetKey) || [];

      for (const nextConn of outgoing) {
        const transitiveConn: FlatConnection = {
          id: `${conn.source.nodeId}.${conn.source.portName}->${nextConn.target.nodeId}.${nextConn.target.portName}`,
          source: conn.source,
          target: nextConn.target,
          portType: conn.portType
        };

        if (!processed.has(transitiveConn.id)) {
          processed.add(transitiveConn.id);

          if (isPrimitive(transitiveConn.source) && isPrimitive(transitiveConn.target)) {
            if (debug) {
              console.log(`  TRANSITIVE: ${transitiveConn.source.nodeId}.${transitiveConn.source.portName} -> ${transitiveConn.target.nodeId}.${transitiveConn.target.portName}`);
            }
            result.push(transitiveConn);
          }
        }
      }
    } else if (!isPrimitive(conn.source)) {
      const sourceKey = `${conn.source.nodeId}.${conn.source.portName}`;
      const incoming = connectionsToPort.get(sourceKey) || [];

      for (const prevConn of incoming) {
        const transitiveConn: FlatConnection = {
          id: `${prevConn.source.nodeId}.${prevConn.source.portName}->${conn.target.nodeId}.${conn.target.portName}`,
          source: prevConn.source,
          target: conn.target,
          portType: conn.portType
        };

        if (!processed.has(transitiveConn.id)) {
          processed.add(transitiveConn.id);

          if (isPrimitive(transitiveConn.source) && isPrimitive(transitiveConn.target)) {
            if (debug) {
              console.log(`  TRANSITIVE: ${transitiveConn.source.nodeId}.${transitiveConn.source.portName} -> ${transitiveConn.target.nodeId}.${transitiveConn.target.portName}`);
            }
            result.push(transitiveConn);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Trace a composite's circuit-level ports to their internal primitive sources/targets.
 */
function traceCompositePorts(
  composite: Circuit,
  compositePath: string,
  portForwarding: Map<string, PortPath[]>,
  library: CircuitLibrary,
  debug: boolean = false
): void {
  for (const conn of composite.connections) {
    // Case 1: Circuit input connects to internal node
    if (conn.source.nodeId === '' && conn.target.nodeId !== '') {
      const compositeInputKey = `${compositePath}.${conn.source.portName}`;
      const internalTargets = resolveInternalPorts(
        compositePath,
        conn.target,
        composite,
        library
      );
      if (!portForwarding.has(compositeInputKey)) {
        portForwarding.set(compositeInputKey, []);
      }
      for (const internalTarget of internalTargets) {
        portForwarding.get(compositeInputKey)!.push(internalTarget);
        if (debug) {
          console.log(`  INPUT: ${conn.source.portName} -> ${internalTarget.nodeId}.${internalTarget.portName}`);
        }
      }
    }

    // Case 2: Internal node connects to circuit output
    if (conn.source.nodeId !== '' && conn.target.nodeId === '') {
      const compositeOutputKey = `${compositePath}.${conn.target.portName}`;
      const internalSources = resolveInternalPorts(
        compositePath,
        conn.source,
        composite,
        library
      );
      if (!portForwarding.has(compositeOutputKey)) {
        portForwarding.set(compositeOutputKey, []);
      }
      for (const internalSource of internalSources) {
        portForwarding.get(compositeOutputKey)!.push(internalSource);
        if (debug) {
          console.log(`  OUTPUT: ${conn.target.portName} <- ${internalSource.nodeId}.${internalSource.portName}`);
        }
      }
    }

    // Case 3: Input connects directly to output (passthrough)
    if (conn.source.nodeId === '' && conn.target.nodeId === '') {
      if (debug) {
        console.log(`  PASSTHROUGH: ${conn.source.portName} -> ${conn.target.portName}`);
      }
      const inputKey = `${compositePath}.${conn.source.portName}`;

      if (!portForwarding.has(inputKey)) {
        portForwarding.set(inputKey, []);
      }
      portForwarding.get(inputKey)!.push({ nodeId: compositePath, portName: conn.target.portName });

      if (debug) {
        console.log(`    -> Added passthrough forwarding: ${inputKey} -> ${compositePath}.${conn.target.portName}`);
      }
    }
  }
}

/**
 * Resolve an internal port reference to its ultimate primitive(s).
 */
function resolveInternalPorts(
  compositePath: string,
  portRef: PortPath,
  composite: Circuit,
  library: CircuitLibrary,
  visited: Set<string> = new Set()
): PortPath[] {
  if (portRef.nodeId === '') {
    return [{ nodeId: compositePath, portName: portRef.portName }];
  }

  const fullPath = compositePath + '.' + portRef.nodeId;

  const node = composite.nodes.find(n => n.id === portRef.nodeId);
  if (!node) {
    return [{ nodeId: fullPath, portName: portRef.portName }];
  }

  const component = library.resolveCircuit(node.componentRef);
  if (!component || component.implementation.kind !== 'composite') {
    return [{ nodeId: fullPath, portName: portRef.portName }];
  }

  // Guard against recursive resolution
  if (visited.has(node.componentRef)) {
    return [{ nodeId: fullPath, portName: portRef.portName }];
  }
  const childVisited = new Set(visited);
  childVisited.add(node.componentRef);

  // It's a composite - need to trace through it
  const results: PortPath[] = [];

  for (const conn of component.connections) {
    if (conn.target.nodeId === '' && conn.target.portName === portRef.portName) {
      const resolved = resolveInternalPorts(fullPath, conn.source, component, library, childVisited);
      results.push(...resolved);
    }

    if (conn.source.nodeId === '' && conn.source.portName === portRef.portName) {
      const resolved = resolveInternalPorts(fullPath, conn.target, component, library, childVisited);
      results.push(...resolved);
    }
  }

  if (results.length > 0) {
    return results;
  }
  return [{ nodeId: fullPath, portName: portRef.portName }];
}

// ============================================================================
// Dependency Graph Building
// ============================================================================

/**
 * Build dependency graph for event-driven simulation.
 */
function buildDependencyGraph(flatCircuit: FlatCircuit): void {
  flatCircuit.nodeMap = new Map(flatCircuit.nodes.map(n => [n.id, n]));

  for (const node of flatCircuit.nodes) {
    node.dependents = [];
    node.inputSources = [];
  }

  for (const conn of flatCircuit.connections) {
    const sourceId = conn.source.nodeId;
    const targetId = conn.target.nodeId;

    if (targetId === TOP_LEVEL_NODE) continue;

    const sourceNode = flatCircuit.nodeMap.get(sourceId);
    if (sourceNode && !sourceNode.dependents.includes(targetId)) {
      sourceNode.dependents.push(targetId);
    }

    const targetNode = flatCircuit.nodeMap.get(targetId);
    if (targetNode) {
      targetNode.inputSources.push({
        portName: conn.target.portName,
        sourceNodeId: sourceId,
        sourcePortName: conn.source.portName,
      });
    }
  }
}

/**
 * Check if a value is a FlatCircuit.
 */
export function isFlatCircuit(value: unknown): value is FlatCircuit {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodes' in value &&
    'connections' in value &&
    'hierarchy' in value &&
    Array.isArray((value as FlatCircuit).nodes) &&
    (value as FlatCircuit).nodes.every(n => 'primitiveType' in n)
  );
}

// ============================================================================
// Topological Sort for Flat Circuits
// ============================================================================

/**
 * Topological sort for flat circuits.
 */
export function topologicalSortFlat(
  nodes: FlatNode[],
  connections: FlatConnection[],
  library: CircuitLibrary
): string[] | null {
  const stateOutputNodes = new Set<string>();
  const stateReadNodes = new Set<string>();
  const sinkNodes = new Set<string>();
  const dependentNodes: string[] = [];

  for (const node of nodes) {
    const component = library.resolveCircuit(node.primitiveType);
    if (!component) continue;

    const isSink = component.metadata?.kind === 'sink';
    const outputDep = component.metadata?.outputDependency;
    const isSequential = component.metadata?.kind === 'sequential';

    if (isSink) {
      sinkNodes.add(node.id);
    } else if (outputDep === 'state+inputs') {
      stateReadNodes.add(node.id);
      dependentNodes.push(node.id);
    } else if (outputDep === 'state-only' || isSequential) {
      stateOutputNodes.add(node.id);
    } else {
      dependentNodes.push(node.id);
    }
  }

  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const nodeId of dependentNodes) {
    graph.set(nodeId, new Set());
    inDegree.set(nodeId, 0);
  }

  const dependentSet = new Set(dependentNodes);
  const writePortNames = SEQUENTIAL_INPUT_PORTS;

  for (const conn of connections) {
    const source = conn.source.nodeId;
    const target = conn.target.nodeId;

    if (source === TOP_LEVEL_NODE || target === TOP_LEVEL_NODE) continue;
    if (source === '' || target === '') continue;

    if (stateOutputNodes.has(source) || sinkNodes.has(source)) continue;

    if (stateReadNodes.has(target) && writePortNames.has(conn.target.portName)) continue;

    if (!dependentSet.has(source) || !dependentSet.has(target)) continue;

    if (!graph.get(source)?.has(target)) {
      graph.get(source)?.add(target);
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];

  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const neighbor of graph.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (result.length !== dependentNodes.length) {
    return null; // Cycle detected
  }

  return [
    ...Array.from(stateOutputNodes),
    ...result,
    ...Array.from(sinkNodes)
  ];
}
