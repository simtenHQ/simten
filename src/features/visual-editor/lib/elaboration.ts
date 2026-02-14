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
 * Precomputed input source for O(1) lookup.
 * Instead of scanning all connections, each node knows exactly where its inputs come from.
 */
export interface InputSource {
  portName: string;        // Target port name on this node
  sourceNodeId: string;    // Node that provides the value
  sourcePortName: string;  // Port on source node
}

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
  // Precomputed graph edges (populated by buildDependencyGraph)
  dependents: string[];                 // Node IDs that read from this node's outputs
  inputSources: InputSource[];          // Where each input comes from (O(inputs) lookup)
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
  nodeMap: Map<string, FlatNode>;     // Quick lookup by ID (populated by buildDependencyGraph)
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
          clocks: node.clocks.map(c => ({...c, nodeId: fullPath})),
          dependents: [],      // Populated by buildDependencyGraph
          inputSources: [],    // Populated by buildDependencyGraph
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
          clocks: node.clocks.map(c => ({...c, nodeId: fullPath})),
          dependents: [],      // Populated by buildDependencyGraph
          inputSources: [],    // Populated by buildDependencyGraph
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

  // Build the flat circuit
  const flatCircuit: FlatCircuit = {
    nodes,
    connections: stitchedConnections,
    hierarchy,
    topLevelInputs: circuit.inputs,
    topLevelOutputs: circuit.outputs,
    nodeMap: new Map(), // Populated by buildDependencyGraph
  };

  // Build dependency graph for event-driven simulation
  buildDependencyGraph(flatCircuit);

  return flatCircuit;
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

    // Helper: Check if a port is a primitive (not a composite)
    const isPrimitive = (port: PortPath): boolean =>
      port.nodeId === TOP_LEVEL_NODE || flatNodes.some(n => n.id === port.nodeId);

    // Helper: Follow forwarding chain until we hit primitives or can't forward anymore
    // This handles passthroughs where composites forward to other composite ports
    const resolveToEndpoints = (start: PortPath): PortPath[] => {
      const results: PortPath[] = [];
      const visited = new Set<string>();
      const queue: PortPath[] = [start];

      while (queue.length > 0) {
        const current = queue.shift()!;
        const key = `${current.nodeId}.${current.portName}`;

        // Avoid infinite loops
        if (visited.has(key)) continue;
        visited.add(key);

        // If it's a primitive, we're done with this path
        if (isPrimitive(current)) {
          results.push(current);
          continue;
        }

        // If it's a composite, try to forward
        if (compositeInstances.has(current.nodeId) && portForwarding.has(key)) {
          const forwards = portForwarding.get(key)!;
          for (const fwd of forwards) {
            queue.push(fwd);
          }
        } else {
          // Can't forward further, keep as-is (will be filtered later)
          results.push(current);
        }
      }

      return results.length > 0 ? results : [start];
    };

    // Get all source forwarding targets, following the chain to primitives
    let sources: PortPath[] = [conn.source];
    if (sourceIsComposite && !isInternalConnection) {
      sources = resolveToEndpoints(conn.source);
      if (debug && sources.length > 0) {
        for (const src of sources) {
          console.log(`  FORWARD SOURCE: ${conn.source.nodeId}.${conn.source.portName} -> ${src.nodeId}.${src.portName}`);
        }
      }
    }

    // Get all target forwarding targets, following the chain to primitives
    let targets: PortPath[] = [conn.target];
    if (targetIsComposite && !isInternalConnection) {
      targets = resolveToEndpoints(conn.target);
      if (debug && targets.length > 0) {
        for (const tgt of targets) {
          console.log(`  FORWARD TARGET: ${conn.target.nodeId}.${conn.target.portName} -> ${tgt.nodeId}.${tgt.portName}`);
        }
      }
    }

    // Create connections for all source-target pairs (handles fan-out)
    for (const finalSource of sources) {
      for (const finalTarget of targets) {
        // Skip self-loops (node connecting to itself on same port)
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

    return resolveThroughComposites(finalConnections, flatNodes, compositeInstances, debug);
  }

  return resolveThroughComposites(stitchedConnections, flatNodes, compositeInstances, debug);
}

/**
 * Resolve connections through composite ports via transitive closure.
 *
 * When we have:
 *   A -> composite.port (A is primitive, composite.port is composite)
 *   composite.port -> B (composite.port is composite, B is primitive)
 *
 * We create:
 *   A -> B (direct connection between primitives)
 *
 * This handles passthrough composites that have no primitives on certain paths.
 */
function resolveThroughComposites(
  connections: FlatConnection[],
  flatNodes: FlatNode[],
  _compositeInstances: Set<string>,  // Reserved for future use
  debug: boolean
): FlatConnection[] {
  // Helper to check if a port is on a primitive
  const isPrimitive = (port: PortPath): boolean =>
    port.nodeId === TOP_LEVEL_NODE || flatNodes.some(n => n.id === port.nodeId);

  // Build maps for quick lookups
  // Map from "nodeId.portName" -> connections where this is the target
  const connectionsToPort = new Map<string, FlatConnection[]>();
  // Map from "nodeId.portName" -> connections where this is the source
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

  // Find all connections that need transitive resolution
  // These are connections where target is a composite port
  const result: FlatConnection[] = [];
  const processed = new Set<string>();

  for (const conn of connections) {
    // If both endpoints are primitives, keep as-is
    if (isPrimitive(conn.source) && isPrimitive(conn.target)) {
      result.push(conn);
      continue;
    }

    // If target is a composite, find where it connects to next
    if (!isPrimitive(conn.target)) {
      const targetKey = `${conn.target.nodeId}.${conn.target.portName}`;

      // Find connections FROM this composite port
      const outgoing = connectionsFromPort.get(targetKey) || [];

      for (const nextConn of outgoing) {
        // Create a transitive connection
        const transitiveConn: FlatConnection = {
          id: `${conn.source.nodeId}.${conn.source.portName}->${nextConn.target.nodeId}.${nextConn.target.portName}`,
          source: conn.source,
          target: nextConn.target,
          portType: conn.portType
        };

        // Only add if this creates a connection between primitives (or is closer to it)
        if (!processed.has(transitiveConn.id)) {
          processed.add(transitiveConn.id);

          if (isPrimitive(transitiveConn.source) && isPrimitive(transitiveConn.target)) {
            if (debug) {
              console.log(`  TRANSITIVE: ${transitiveConn.source.nodeId}.${transitiveConn.source.portName} -> ${transitiveConn.target.nodeId}.${transitiveConn.target.portName}`);
            }
            result.push(transitiveConn);
          } else {
            // Still has composite endpoints, add back to process again
            // But prevent infinite loops by tracking what we've processed
          }
        }
      }
    }
    // Note: If source is composite but target is primitive, we still keep it
    // because we need to find what connects TO that source
    else if (!isPrimitive(conn.source)) {
      const sourceKey = `${conn.source.nodeId}.${conn.source.portName}`;

      // Find connections TO this composite port
      const incoming = connectionsToPort.get(sourceKey) || [];

      for (const prevConn of incoming) {
        // Create a transitive connection
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
 *
 * For each circuit-level port of a composite, find where it actually connects inside.
 * Handles fan-out: one input port can connect to multiple internal nodes.
 * Also handles fan-out THROUGH nested composites (e.g., clk -> nestedComp.clk where
 * nestedComp has clk -> [reg1.clk, reg2.clk]).
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
      // Use resolveInternalPorts to get ALL targets (handles fan-out through nested composites)
      const internalTargets = resolveInternalPorts(
        compositePath,
        conn.target,
        composite,
        library
      );
      // Append all targets to existing array (handles fan-out)
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
    // Forwarding: compositePath.outputPort → [compositePath.internalNode.port]
    // (Usually just one source for outputs, but use array for consistency)
    if (conn.source.nodeId !== '' && conn.target.nodeId === '') {
      const compositeOutputKey = `${compositePath}.${conn.target.portName}`;
      // Use resolveInternalPorts for consistency (outputs typically have one source)
      const internalSources = resolveInternalPorts(
        compositePath,
        conn.source,
        composite,
        library
      );
      // Append to existing array
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
    // Add ONLY forward direction: input -> output
    // The output will be resolved by the parent's connections
    if (conn.source.nodeId === '' && conn.target.nodeId === '') {
      if (debug) {
        console.log(`  PASSTHROUGH: ${conn.source.portName} -> ${conn.target.portName}`);
      }
      // Only add forward direction (input -> output)
      // Don't add backward direction (output -> input) as it creates cycles
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
 *
 * If the port belongs to another composite, recursively trace through it.
 * Returns an ARRAY of PortPaths to handle fan-out through nested composites.
 * For example, if composite A has clk -> B.clk, and B has clk -> [reg1.clk, reg2.clk],
 * this returns [A.B.reg1.clk, A.B.reg2.clk].
 */
function resolveInternalPorts(
  compositePath: string,
  portRef: PortPath,
  composite: Circuit,
  library: ComponentLibraryStore
): PortPath[] {
  // Handle circuit-level port references (passthrough endpoints)
  // When portRef.nodeId is empty, it's referring to the composite's own port,
  // not an internal node. This happens when tracing through a passthrough connection.
  if (portRef.nodeId === '') {
    // Return the composite's port - it will be looked up in the forwarding map
    // during stitching, or handled as a passthrough.
    return [{ nodeId: compositePath, portName: portRef.portName }];
  }

  const fullPath = compositePath + '.' + portRef.nodeId;

  // Find the referenced node
  const node = composite.nodes.find(n => n.id === portRef.nodeId);
  if (!node) {
    // Node not found, return as-is
    return [{ nodeId: fullPath, portName: portRef.portName }];
  }

  const component = library.resolveComponent(node.componentRef);
  if (!component || component.implementation.kind !== 'composite') {
    // It's a primitive, return the full path
    return [{ nodeId: fullPath, portName: portRef.portName }];
  }

  // It's a composite - need to trace through it
  // Look for ALL connections matching this port (handles fan-out in nested composites)
  const results: PortPath[] = [];

  for (const conn of component.connections) {
    // If this is an output port, find what internal node connects to it
    if (conn.target.nodeId === '' && conn.target.portName === portRef.portName) {
      // Recursively resolve the internal source(s)
      const resolved = resolveInternalPorts(fullPath, conn.source, component, library);
      results.push(...resolved);
    }

    // If this is an input port, find what internal node it connects to
    if (conn.source.nodeId === '' && conn.source.portName === portRef.portName) {
      // Recursively resolve the internal target(s)
      const resolved = resolveInternalPorts(fullPath, conn.target, component, library);
      results.push(...resolved);
    }
  }

  // If we found any matches, return them; otherwise return the composite node path
  if (results.length > 0) {
    return results;
  }
  return [{ nodeId: fullPath, portName: portRef.portName }];
}

// ============================================================================
// Dependency Graph Building (for Event-Driven Simulation)
// ============================================================================

/**
 * Build dependency graph for event-driven simulation.
 * Populates:
 * - nodeMap: O(1) lookup of nodes by ID
 * - dependents: For each node, which nodes read from its outputs
 * - inputSources: For each node, where each input comes from (O(inputs) lookup)
 *
 * This enables O(K) event-driven propagation instead of O(N) full evaluation,
 * where K is the number of nodes that actually change.
 */
function buildDependencyGraph(flatCircuit: FlatCircuit): void {
  // Build nodeMap for O(1) lookup
  flatCircuit.nodeMap = new Map(flatCircuit.nodes.map(n => [n.id, n]));

  // Initialize arrays (in case they weren't already)
  for (const node of flatCircuit.nodes) {
    node.dependents = [];
    node.inputSources = [];
  }

  // Build both forward (dependents) and reverse (inputSources) edges
  for (const conn of flatCircuit.connections) {
    const sourceId = conn.source.nodeId;
    const targetId = conn.target.nodeId;

    // Skip connections TO circuit outputs (handled separately in propagateToTopLevelOutputs)
    // But allow connections FROM circuit inputs so inputSources gets populated
    if (targetId === TOP_LEVEL_NODE) continue;

    // Forward edge: source's dependents list
    const sourceNode = flatCircuit.nodeMap.get(sourceId);
    if (sourceNode && !sourceNode.dependents.includes(targetId)) {
      sourceNode.dependents.push(targetId);
    }

    // Reverse edge: target's inputSources (for O(inputs) lookup during evaluation)
    const targetNode = flatCircuit.nodeMap.get(targetId);
    if (targetNode) {
      targetNode.inputSources.push({
        portName: conn.target.portName,
        sourceNodeId: sourceId,
        sourcePortName: conn.source.portName,
      });
    }
  }

  // Assertion: verify all nodes have inputSources populated
  if (process.env.NODE_ENV !== 'production') {
    for (const node of flatCircuit.nodes) {
      console.assert(
        Array.isArray(node.inputSources),
        `inputSources not set for ${node.id}`
      );
      console.assert(
        Array.isArray(node.dependents),
        `dependents not set for ${node.id}`
      );
    }
  }
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
  // Categorize nodes into evaluation phases:
  //
  // Phase 1: state-output nodes (registers) - outputs depend only on state
  //   These must run first so combinational logic can use their .q values
  //
  // Phase 2: combinational + state-read nodes - topologically sorted
  //   This includes pure combinational nodes AND state+inputs nodes (RAM/ROM)
  //   State+inputs nodes break WRITE feedback (data_in/we -> data_out) but
  //   participate normally in READ paths (addr -> data_out -> downstream)
  //
  // Phase 3: sink nodes (displays, LEDs)
  //
  // This mirrors real hardware: registers present .q, then all combinational
  // logic (including memory reads) evaluates, then results display.
  const stateOutputNodes = new Set<string>();  // state-only: run first
  const stateReadNodes = new Set<string>();    // state+inputs: tracked for edge filtering
  const sinkNodes = new Set<string>();
  const dependentNodes: string[] = [];

  for (const node of nodes) {
    const component = library.resolveComponent(node.primitiveType);
    if (!component) continue;

    // Check metadata for node category
    const isSink = component.metadata?.kind === 'sink';
    const outputDep = component.metadata?.outputDependency;
    const isSequential = component.metadata?.kind === 'sequential';

    if (isSink) {
      sinkNodes.add(node.id);
    } else if (outputDep === 'state+inputs') {
      // RAM/ROM: outputs depend on state AND inputs (address)
      // Include in combinational sort, but track for write-feedback filtering
      stateReadNodes.add(node.id);
      dependentNodes.push(node.id);
    } else if (outputDep === 'state-only' || isSequential) {
      // Registers: outputs depend only on state
      // Must run first so combinational logic can use their .q values
      stateOutputNodes.add(node.id);
    } else {
      dependentNodes.push(node.id);
    }
  }

  // Build dependency graph for dependent nodes only
  // Exclude edges FROM state nodes and sink nodes (they don't create combinational cycles)
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  // Initialize graph
  for (const nodeId of dependentNodes) {
    graph.set(nodeId, new Set());
    inDegree.set(nodeId, 0);
  }

  // Build edges (source -> target)
  const dependentSet = new Set(dependentNodes);

  // Define write ports for state+inputs nodes (these create write-feedback cycles)
  const writePortNames = new Set(['data_in', 'we', 'data', 'dataA', 'weA']);

  for (const conn of connections) {
    const source = conn.source.nodeId;
    const target = conn.target.nodeId;

    // Skip circuit-level ports
    if (source === TOP_LEVEL_NODE || target === TOP_LEVEL_NODE) continue;
    if (source === '' || target === '') continue;

    // Skip connections FROM state-output nodes or sink nodes
    // State-output (registers): outputs don't depend on inputs, no combinational path
    // Sink nodes: outputs don't feed back into the circuit
    if (stateOutputNodes.has(source) || sinkNodes.has(source)) continue;

    // Skip write-feedback edges TO state+inputs nodes
    // These are edges to write ports (data_in, we) that create feedback cycles.
    // Keep edges to read ports (addr) - those are valid combinational dependencies.
    if (stateReadNodes.has(target) && writePortNames.has(conn.target.portName)) continue;

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

  // Return evaluation order matching real hardware timing:
  // 1. State-output nodes (registers output .q)
  // 2. Combinational + state-read nodes in topological order
  //    (address computation -> RAM read -> downstream muxes)
  // 3. Sink nodes (displays, LEDs)
  return [
    ...Array.from(stateOutputNodes),
    ...result,
    ...Array.from(sinkNodes)
  ];
}
