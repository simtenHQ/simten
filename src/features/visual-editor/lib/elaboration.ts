/**
 * Circuit Elaboration Engine
 *
 * Transforms hierarchical circuits (with composites) into flat circuits (primitives only).
 * This is analogous to how Verilog/VHDL simulators elaborate modules into netlists.
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
  PortInstance,
  ClockInstance,
  PortDescriptor,
  PortType,
  ArgumentValue,
} from '../types/ir-v0.1';
import { ComponentLibraryStore } from '../stores/component-library-store';

// ============================================================================
// Flat Circuit Types
// ============================================================================

/**
 * Virtual top-level node for circuit-level ports.
 * Used to avoid empty string paths that could collide or behave inconsistently.
 */
export const TOP_LEVEL_NODE = '__top__';

/**
 * A flattened node - always a primitive, never a composite.
 * ID includes full hierarchical path (e.g., "cpu.alu.adder1")
 */
export interface FlatNode {
  id: string;                           // Full path: "cpu.alu.adder1"
  primitiveType: string;                // "Adder", "Register", etc.
  arguments: Record<string, ArgumentValue>;   // Node parameterization
  inputs: PortInstance[];               // With full path IDs
  outputs: PortInstance[];
  clocks: ClockInstance[];
}

/**
 * A flattened connection with full hierarchical paths.
 */
export interface FlatConnection {
  id: string;
  source: PortPath;  // {nodeId: "cpu.alu.adder1", portName: "sum"}
  target: PortPath;  // {nodeId: "cpu.regs.a", portName: "data"}
  portType: PortType;
}

/**
 * Hierarchy metadata for UI visualization.
 * Allows UI to show hierarchical view even though simulation is flat.
 */
export interface HierarchyNode {
  path: string;              // "" for top, "cpu" for cpu, "cpu.alu" for alu inside cpu
  componentName: string;     // "CPU", "ALU", etc.
  children: HierarchyNode[]; // Nested composites
  primitives: string[];      // IDs of leaf primitives at this level
}

/**
 * The elaborated (flattened) circuit.
 * Contains only primitives, but preserves hierarchy metadata for visualization.
 */
export interface FlatCircuit {
  nodes: FlatNode[];
  connections: FlatConnection[];
  hierarchy: HierarchyNode;  // For visualization
  topLevelInputs: PortDescriptor[];   // Circuit-level inputs
  topLevelOutputs: PortDescriptor[];  // Circuit-level outputs
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
 * @returns Flattened circuit with only primitives
 */
export function elaborate(
  circuit: Circuit,
  library: ComponentLibraryStore,
  debug: boolean = false
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
   *
   * @param circ - Circuit to flatten
   * @param pathPrefix - Current hierarchical path (e.g., "cpu.alu.")
   * @param parentHierarchy - Parent hierarchy node for building tree
   */
  function flattenCircuit(
    circ: Circuit,
    pathPrefix: string,
    parentHierarchy: HierarchyNode
  ): void {
    for (const node of circ.nodes) {
      const fullPath = pathPrefix + node.id;
      const component = library.resolveComponent(node.componentRef);

      if (!component) {
        throw new Error(
          `Unknown component: ${node.componentRef} (referenced by node ${fullPath})`
        );
      }

      if (component.implementation.kind === 'primitive') {
        // Leaf primitive - add to flat list
        nodes.push({
          id: fullPath,
          primitiveType: node.componentRef,
          arguments: node.arguments,
          inputs: node.inputs.map(p => ({...p, nodeId: fullPath})),
          outputs: node.outputs.map(p => ({...p, nodeId: fullPath})),
          clocks: node.clocks.map(c => ({...c, nodeId: fullPath}))
        });
        parentHierarchy.primitives.push(fullPath);

      } else if (component.implementation.kind === 'composite') {
        // Create hierarchy node for this composite
        const childHierarchy: HierarchyNode = {
          path: fullPath,
          componentName: node.componentRef,
          children: [],
          primitives: []
        };
        parentHierarchy.children.push(childHierarchy);

        // Recursively flatten the composite's internal circuit
        flattenCircuit(component, fullPath + '.', childHierarchy);

      } else {
        // Intrinsic components are treated like primitives for now
        // (They might need special handling in the future)
        console.warn(
          `Intrinsic component ${node.componentRef} treated as primitive during elaboration`
        );
        nodes.push({
          id: fullPath,
          primitiveType: node.componentRef,
          arguments: node.arguments,
          inputs: node.inputs.map(p => ({...p, nodeId: fullPath})),
          outputs: node.outputs.map(p => ({...p, nodeId: fullPath})),
          clocks: node.clocks.map(c => ({...c, nodeId: fullPath}))
        });
        parentHierarchy.primitives.push(fullPath);
      }
    }

    // Flatten connections with full paths
    for (const conn of circ.connections) {
      // Handle circuit-level ports using virtual top-level node
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
  flattenCircuit(circuit, '', hierarchy);

  // Post-process: Stitch connections through composite port boundaries
  const stitchedConnections = stitchCompositeConnections(
    circuit,
    connections,
    nodes,
    library,
    '',
    debug
  );

  return {
    nodes,
    connections: stitchedConnections,
    hierarchy,
    topLevelInputs: circuit.inputs,
    topLevelOutputs: circuit.outputs
  };
}

/**
 * Stitch connections through composite port boundaries.
 *
 * When a connection goes to/from a composite node, we need to trace it through
 * to the actual primitive it connects to inside that composite.
 *
 * Example:
 *   parent.control.pc_load -> parent.pc_reg.we
 *
 * If "control" is a composite with:
 *   state_reg.q -> {output}.pc_load
 *
 * The stitched connection should be:
 *   parent.control.state_reg.q -> parent.pc_reg.we
 */
function stitchCompositeConnections(
  circuit: Circuit,
  connections: FlatConnection[],
  flatNodes: FlatNode[],
  library: ComponentLibraryStore,
  pathPrefix: string,
  debug: boolean = false
): FlatConnection[] {
  // Build a map of composite port forwarding rules
  // Key: "compositePath.portName", Value: array of primitive port paths (for fan-out)
  const portForwarding = new Map<string, PortPath[]>();

  // Track all composite instances (needed to recognize virtual composite ports)
  const compositeInstances = new Set<string>();

  // Build forwarding map for each composite instance
  function buildForwardingMap(circ: Circuit, prefix: string): void {
    for (const node of circ.nodes) {
      const fullPath = prefix + node.id;
      const component = library.resolveComponent(node.componentRef);

      if (!component) continue;

      if (component.implementation.kind === 'composite') {
        // Track this composite instance
        compositeInstances.add(fullPath);

        // For this composite instance, trace its circuit-level ports to internal primitives
        if (debug) {
          console.log(`\n=== Tracing composite: ${fullPath} (${node.componentRef}) ===`);
        }
        traceCompositePorts(component, fullPath, portForwarding, library, debug);

        // Recursively process nested composites
        buildForwardingMap(component, fullPath + '.');
      }
    }
  }

  // Build the forwarding map
  buildForwardingMap(circuit, pathPrefix);

  if (debug) {
    console.log(`\n=== Port Forwarding Map (${portForwarding.size} rules) ===`);
    for (const [key, values] of portForwarding.entries()) {
      for (const value of values) {
        console.log(`  ${key} -> ${value.nodeId}.${value.portName}`);
      }
    }
  }

  // Rewrite connections using the forwarding map
  // Handle fan-out: one composite port can map to multiple internal targets
  const stitchedConnections: FlatConnection[] = [];

  for (const conn of connections) {
    const sourceIsComposite = compositeInstances.has(conn.source.nodeId);
    const targetIsComposite = compositeInstances.has(conn.target.nodeId);

    // Skip internal port forwarding connections.
    // These are connections where a composite's port connects to/from its OWN internal nodes.
    // Example: pe00.weightIn -> pe00.weightReg.data (target is inside source)
    //          pe00.weightPipe.q -> pe00.weightOut (source is inside target)
    //
    // We detect this by checking if one nodeId is a prefix of the other.
    // External sibling connections like b_col0_mux.out -> pe00.weightIn should NOT be skipped.

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

    // Apply forwarding to composite instance ports to resolve them to internal primitives
    // Skip forwarding for internal connections (both endpoints in same composite)
    const isInternalConnection = sourceIsComposite && targetIsComposite &&
                                 conn.source.nodeId === conn.target.nodeId;

    // Get all source forwarding targets (usually just one for outputs)
    let sources: PortPath[] = [conn.source];
    if (sourceIsComposite && !isInternalConnection) {
      const sourceKey = `${conn.source.nodeId}.${conn.source.portName}`;
      if (portForwarding.has(sourceKey)) {
        sources = portForwarding.get(sourceKey)!;
        if (debug) {
          for (const src of sources) {
            console.log(`  FORWARD SOURCE: ${sourceKey} -> ${src.nodeId}.${src.portName}`);
          }
        }
      }
    }

    // Get all target forwarding targets (can be multiple for fan-out inputs)
    let targets: PortPath[] = [conn.target];
    if (targetIsComposite && !isInternalConnection) {
      const targetKey = `${conn.target.nodeId}.${conn.target.portName}`;
      if (portForwarding.has(targetKey)) {
        targets = portForwarding.get(targetKey)!;
        if (debug) {
          for (const tgt of targets) {
            console.log(`  FORWARD TARGET: ${targetKey} -> ${tgt.nodeId}.${tgt.portName}`);
          }
        }
      }
    }

    // Create connections for all source-target pairs (handles fan-out)
    for (const finalSource of sources) {
      for (const finalTarget of targets) {
        // Keep connections where both endpoints are primitives or top-level
        // (Composite instance ports should have been forwarded or skipped)
        const sourceIsPrimitive = finalSource.nodeId === TOP_LEVEL_NODE ||
                                  flatNodes.some(n => n.id === finalSource.nodeId);
        const targetIsPrimitive = finalTarget.nodeId === TOP_LEVEL_NODE ||
                                  flatNodes.some(n => n.id === finalTarget.nodeId);

        // Skip self-loops (node connecting to itself on same port)
        const isSelfLoop = finalSource.nodeId === finalTarget.nodeId &&
                          finalSource.portName === finalTarget.portName;

        if (sourceIsPrimitive && targetIsPrimitive && !isSelfLoop) {
          stitchedConnections.push({
            id: `${finalSource.nodeId}.${finalSource.portName}->${finalTarget.nodeId}.${finalTarget.portName}`,
            source: finalSource,
            target: finalTarget,
            portType: conn.portType
          });
        } else if (debug && !isSelfLoop) {
          console.log(`  FILTERED: ${finalSource.nodeId}.${finalSource.portName} -> ${finalTarget.nodeId}.${finalTarget.portName}`);
          console.log(`    sourceIsPrimitive: ${sourceIsPrimitive}, targetIsPrimitive: ${targetIsPrimitive}`);
        }
      }
    }
  }

  // Post-process: Eliminate passthrough connections
  // A passthrough is when both source and target are the same composite instance
  // (e.g., pt.x -> pt.y where pt is a composite with no internal nodes)
  const passthroughConnections = stitchedConnections.filter(conn =>
    compositeInstances.has(conn.source.nodeId) &&
    conn.source.nodeId === conn.target.nodeId
  );

  if (passthroughConnections.length > 0) {
    if (debug) {
      console.log(`\n=== Eliminating ${passthroughConnections.length} passthrough connections ===`);
    }

    // For each passthrough connection, splice it out and connect through
    const finalConnections: FlatConnection[] = [];
    const processedPassthroughs = new Set<string>();

    for (const conn of stitchedConnections) {
      // Check if this is a passthrough connection
      const isPassthrough = compositeInstances.has(conn.source.nodeId) &&
                           conn.source.nodeId === conn.target.nodeId;

      if (isPassthrough) {
        processedPassthroughs.add(conn.id);
        if (debug) {
          console.log(`  PASSTHROUGH: ${conn.source.nodeId}.${conn.source.portName} -> ${conn.target.portName}`);
        }

        // Find all connections TO this passthrough input
        const inputConnections = stitchedConnections.filter(c =>
          c.target.nodeId === conn.source.nodeId &&
          c.target.portName === conn.source.portName &&
          !processedPassthroughs.has(c.id)
        );

        // Find all connections FROM this passthrough output
        const outputConnections = stitchedConnections.filter(c =>
          c.source.nodeId === conn.target.nodeId &&
          c.source.portName === conn.target.portName &&
          !processedPassthroughs.has(c.id)
        );

        // Create direct connections from each input source to each output target
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
        // Keep non-passthrough connections
        finalConnections.push(conn);
      }
    }

    return finalConnections;
  }

  return stitchedConnections;
}

/**
 * Trace a composite's circuit-level ports to their internal primitive sources/targets.
 *
 * For each circuit-level port of a composite, find where it actually connects inside.
 * Handles fan-out: one input port can connect to multiple internal nodes.
 */
function traceCompositePorts(
  composite: Circuit,
  compositePath: string,
  portForwarding: Map<string, PortPath[]>,
  library: ComponentLibraryStore,
  debug: boolean = false
): void {
  // Trace each circuit-level connection
  for (const conn of composite.connections) {
    // Case 1: Circuit input connects to internal node (fan-out supported)
    // Forwarding: compositePath.inputPort → [compositePath.internalNode1.port, ...]
    if (conn.source.nodeId === '' && conn.target.nodeId !== '') {
      const compositeInputKey = `${compositePath}.${conn.source.portName}`;
      const internalTarget = resolveInternalPort(
        compositePath,
        conn.target,
        composite,
        library
      );
      // Append to existing array (handles fan-out)
      if (!portForwarding.has(compositeInputKey)) {
        portForwarding.set(compositeInputKey, []);
      }
      portForwarding.get(compositeInputKey)!.push(internalTarget);
      if (debug) {
        console.log(`  INPUT: ${conn.source.portName} -> ${internalTarget.nodeId}.${internalTarget.portName}`);
      }
    }

    // Case 2: Internal node connects to circuit output
    // Forwarding: compositePath.outputPort → [compositePath.internalNode.port]
    // (Usually just one source for outputs, but use array for consistency)
    if (conn.source.nodeId !== '' && conn.target.nodeId === '') {
      const compositeOutputKey = `${compositePath}.${conn.target.portName}`;
      const internalSource = resolveInternalPort(
        compositePath,
        conn.source,
        composite,
        library
      );
      // Append to existing array
      if (!portForwarding.has(compositeOutputKey)) {
        portForwarding.set(compositeOutputKey, []);
      }
      portForwarding.get(compositeOutputKey)!.push(internalSource);
      if (debug) {
        console.log(`  OUTPUT: ${conn.target.portName} <- ${internalSource.nodeId}.${internalSource.portName}`);
      }
    }

    // Case 3: Input connects directly to output (passthrough)
    // Track these for post-processing - we'll eliminate them later
    if (conn.source.nodeId === '' && conn.target.nodeId === '') {
      if (debug) {
        console.log(`  PASSTHROUGH: ${conn.source.portName} -> ${conn.target.portName}`);
      }
      // Don't create forwarding rules - we'll handle passthrough specially
      continue;
    }
  }
}

/**
 * Resolve an internal port reference to its ultimate primitive.
 *
 * If the port belongs to another composite, recursively trace through it.
 */
function resolveInternalPort(
  compositePath: string,
  portRef: PortPath,
  composite: Circuit,
  library: ComponentLibraryStore
): PortPath {
  const fullPath = compositePath + '.' + portRef.nodeId;

  // Find the referenced node
  const node = composite.nodes.find(n => n.id === portRef.nodeId);
  if (!node) {
    // Node not found, return as-is
    return { nodeId: fullPath, portName: portRef.portName };
  }

  const component = library.resolveComponent(node.componentRef);
  if (!component || component.implementation.kind !== 'composite') {
    // It's a primitive, return the full path
    return { nodeId: fullPath, portName: portRef.portName };
  }

  // It's a composite - need to trace through it
  // Look for where this port connects inside the nested composite
  for (const conn of component.connections) {
    // If this is an output port, find what internal node connects to it
    if (conn.target.nodeId === '' && conn.target.portName === portRef.portName) {
      // Recursively resolve the internal source
      return resolveInternalPort(fullPath, conn.source, component, library);
    }

    // If this is an input port, find what internal node it connects to
    if (conn.source.nodeId === '' && conn.source.portName === portRef.portName) {
      // Recursively resolve the internal target
      return resolveInternalPort(fullPath, conn.target, component, library);
    }
  }

  // If we can't trace it, return the composite node path
  return { nodeId: fullPath, portName: portRef.portName };
}

/**
 * Check if a value is a FlatCircuit (vs a Circuit).
 * Used for backward compatibility during migration.
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
 * Only considers combinational edges (excludes edges TO sequential elements).
 *
 * Sequential elements are identified using component metadata (metadata.kind === 'sequential')
 * rather than hardcoded type names, making this extensible.
 *
 * @param nodes - Flat node list (all primitives)
 * @param connections - Flat connection list
 * @param library - Component library for checking metadata
 * @returns Node IDs in evaluation order, or null if cycle detected
 */
export function topologicalSortFlat(
  nodes: FlatNode[],
  connections: FlatConnection[],
  library: ComponentLibraryStore
): string[] | null {
  // Identify state-breaking nodes (outputs from state, not inputs)
  // These nodes break combinational cycles
  const stateBreakingNodes = new Set<string>();
  const sinkNodes = new Set<string>();
  const dependentNodes: string[] = [];

  for (const node of nodes) {
    const component = library.resolveComponent(node.primitiveType);
    if (!component) continue;

    // Check metadata for node category
    const isSink = component.metadata?.kind === 'sink';
    const isStateOnly = component.metadata?.outputDependency === 'state-only';
    const isSequential = component.metadata?.kind === 'sequential';

    if (isSink) {
      sinkNodes.add(node.id);
    } else if (isStateOnly || isSequential) {
      stateBreakingNodes.add(node.id);
    } else {
      dependentNodes.push(node.id);
    }
  }

  // Build dependency graph for dependent nodes only
  // Exclude edges FROM state-breaking and sink nodes (they don't create combinational cycles)
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  // Initialize graph
  for (const nodeId of dependentNodes) {
    graph.set(nodeId, new Set());
    inDegree.set(nodeId, 0);
  }

  // Build edges (source -> target)
  const dependentSet = new Set(dependentNodes);

  for (const conn of connections) {
    const source = conn.source.nodeId;
    const target = conn.target.nodeId;

    // Skip circuit-level ports
    if (source === TOP_LEVEL_NODE || target === TOP_LEVEL_NODE) continue;
    if (source === '' || target === '') continue;

    // Skip connections FROM state-breaking or sink nodes
    if (stateBreakingNodes.has(source) || sinkNodes.has(source)) continue;

    // Only consider edges between dependent nodes
    if (!dependentSet.has(source) || !dependentSet.has(target)) continue;

    if (!graph.get(source)?.has(target)) {
      graph.get(source)?.add(target);
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const result: string[] = [];

  // Start with nodes that have no dependencies
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

  // Check for cycles
  if (result.length !== dependentNodes.length) {
    return null; // Cycle detected
  }

  // Return evaluation order:
  // 1. State-breaking nodes first (outputs from state)
  // 2. Dependent nodes in topological order
  // 3. Sink nodes last (outputs don't feed back)
  return [
    ...Array.from(stateBreakingNodes),
    ...result,
    ...Array.from(sinkNodes)
  ];
}
