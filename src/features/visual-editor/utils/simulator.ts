/**
 * Simulator Engine
 *
 * Handles signal propagation through the circuit.
 * Evaluates logic gates and updates component values.
 * Supports both primitive and user-defined composite components.
 */

import type { IRState, Component, Connection } from '../types';
import { getComponentSpec, isPrimitiveComponentType } from '../types';
import { useComponentLibraryStore } from '../stores/component-library-store';
import type { Circuit, Node, Connection as IRv01Connection, PortPath } from '../types/ir-v0.1';
import { portPathKey } from '../types/ir-v0.1';

/**
 * Maximum recursion depth for composite component evaluation
 */
const MAX_RECURSION_DEPTH = 10;

/**
 * Runs one simulation step, propagating values through the circuit
 */
export function runSimulationStep(ir: IRState, recursionDepth: number = 0): IRState {
  // Prevent infinite recursion in nested composite components
  if (recursionDepth > MAX_RECURSION_DEPTH) {
    console.error('[SIMULATOR] Max recursion depth exceeded in simulator');
    return ir;
  }
  // Deep clone components to avoid mutating the original state
  const updatedComponents: Record<string, Component> = {};
  for (const [id, component] of Object.entries(ir.components)) {
    updatedComponents[id] = { ...component };
  }

  // Process components in topological order
  // For Phase 1, we'll use a simple iterative approach
  // This works for acyclic circuits (no feedback loops)

  let hasChanges = true;
  let iterations = 0;
  const maxIterations = 100; // Prevent infinite loops

  while (hasChanges && iterations < maxIterations) {
    hasChanges = false;
    iterations++;

    // Evaluate each component
    for (const [id, component] of Object.entries(updatedComponents)) {
      const updatedValue = evaluateComponent(component, updatedComponents, ir, recursionDepth);

      // Only track changes for stateful components (SWITCH and LED)
      // Gates are combinational and don't store state
      if (updatedValue !== undefined && (component.type === 'SWITCH' || component.type === 'LED')) {
        const currentValue = 'value' in component ? component.value : undefined;

        if (currentValue !== updatedValue) {
          hasChanges = true;

          // Update the component value - create a new component object to ensure immutability
          if (component.type === 'LED') {
            updatedComponents[id] = {
              ...component,
              value: updatedValue
            } as Component;
          } else if (component.type === 'SWITCH') {
            // Switches in internal IR should maintain their fixed input values
            // Only update if it's a user-controlled switch (at depth 0)
            if (recursionDepth === 0) {
              updatedComponents[id] = {
                ...component,
                value: updatedValue
              } as Component;
            }
          }
        }
      }
    }
  }

  // Warn if simulation took many iterations (might indicate convergence issues)
  if (iterations >= maxIterations) {
    console.warn(`[SIMULATOR] Hit max iterations (${maxIterations}) at depth ${recursionDepth} - circuit may not have converged`);
  }

  return {
    ...ir,
    components: updatedComponents,
  };
}

/**
 * Evaluates a single component and returns its output value(s)
 */
function evaluateComponent(
  component: Component,
  components: Record<string, Component>,
  ir: IRState,
  recursionDepth: number = 0
): boolean | undefined {
  const spec = getComponentSpec(component.type);

  // Check if this is a primitive component
  if (isPrimitiveComponentType(component.type)) {
    switch (component.type) {
      case 'SWITCH':
        // Switch value is user-controlled, not evaluated
        // Type guard: SWITCH components have a value property
        if ('value' in component) {
          return component.value;
        }
        return undefined;

      case 'LED': {
        // LED displays the value from its input
        const inputValue = getComponentInputValue(component.id, 0, components, ir);
        return inputValue ?? false;
      }

      // All logic gates follow the same pattern
      case 'AND_GATE':
      case 'OR_GATE':
      case 'NOT_GATE':
      case 'NAND_GATE':
      case 'NOR_GATE':
      case 'XOR_GATE':
      case 'XNOR_GATE':
      case 'BUFFER': {
        // Get input values
        const inputValues = getComponentInputValues(component.id, spec?.inputCount ?? 0, components, ir);

        if (inputValues.length !== (spec?.inputCount ?? 0)) {
          return false; // Not all inputs connected
        }

        if (!spec?.evaluate) {
          return false;
        }

        const outputs = spec.evaluate(inputValues);
        return outputs[0]; // Return first output
      }
    }
  } else {
    // This is a user-defined composite component
    return evaluateCompositeComponent(component, components, ir, 0, recursionDepth);
  }

  return undefined;
}

/**
 * Evaluates a user-defined composite component by recursively simulating its internal circuit
 */
function evaluateCompositeComponent(
  component: Component,
  components: Record<string, Component>,
  ir: IRState,
  portIndex: number = 0,
  recursionDepth: number = 0
): boolean | undefined {
  // Get the component library store (we need to access it without React hooks context)
  const library = useComponentLibraryStore.getState().library;

  // Look up the circuit definition
  const circuitDef = library.user.get(component.type) ||
                     library.standard.get(component.type) ||
                     library.primitives.get(component.type);

  if (!circuitDef) {
    console.warn(`[COMPOSITE] Component definition not found for: ${component.type}`);
    return false;
  }

  // Get the number of inputs based on circuit definition
  const inputCount = circuitDef.inputs.length;
  const outputCount = circuitDef.outputs.length;

  // Collect input values from the parent circuit
  const inputValues = getComponentInputValues(component.id, inputCount, components, ir);

  // Debug: Log for Adder8Bit evaluations
  if (component.type === 'Adder8Bit') {
    console.log(`[DEBUG] Evaluating ${component.type} portIndex=${portIndex}, outputName=${circuitDef.outputs[portIndex]?.name}`);
    console.log(`[DEBUG] Input values:`, inputValues);
  }

  // Build an internal IR state for the composite component's circuit
  const internalIR = buildInternalIRFromCircuit(circuitDef, inputValues);

  // Run simulation on the internal circuit (increment recursion depth)
  const simulatedIR = runSimulationStep(internalIR, recursionDepth + 1);

  // Extract output values from the simulated internal circuit
  // Use portIndex to get the correct output
  if (outputCount > portIndex && circuitDef.outputs.length > portIndex) {
    const outputPortName = circuitDef.outputs[portIndex].name;

    // Find the connection to the output port in the internal circuit
    const outputConnection = Object.values(simulatedIR.connections).find(
      (conn) => {
        // Look for a connection where the target would be the circuit's output
        // In our internal IR, circuit outputs are represented by connections to the output ports
        return conn.targetComponentId === outputPortName;
      }
    );

    if (outputConnection) {
      const sourceComponent = simulatedIR.components[outputConnection.sourceComponentId];
      if (sourceComponent) {
        const result = getComponentOutputValue(sourceComponent, outputConnection.sourcePortIndex, simulatedIR.components, simulatedIR, recursionDepth);
        if (component.type === 'Adder8Bit') {
          console.log(`[DEBUG] ${component.type} port ${portIndex} (${outputPortName}) = ${result}`);
        }
        return result;
      }
    }

    // Alternative: if output is directly connected, look for nodes that represent outputs
    // For a simple pass-through like "connect a -> result", we need to trace the connection
    const outputNode = Object.values(simulatedIR.components).find(
      (comp) => comp.type === outputPortName || comp.id === outputPortName
    );

    if (outputNode && 'value' in outputNode) {
      if (component.type === 'Adder8Bit') {
        console.log(`[DEBUG] ${component.type} port ${portIndex} (${outputPortName}) = ${outputNode.value} (from LED)`);
      }
      return outputNode.value;
    }
  }

  if (component.type === 'Adder8Bit') {
    console.log(`[DEBUG] ${component.type} port ${portIndex} - NO OUTPUT FOUND, returning false`);
  }
  return false;
}

/**
 * Builds an internal IR state from a Circuit definition for simulation
 */
function buildInternalIRFromCircuit(
  circuit: Circuit,
  inputValues: boolean[]
): IRState {
  const internalComponents: Record<string, Component> = {};
  const internalConnections: Record<string, Connection> = {};

  // Create input components (represented as switches with fixed values)
  circuit.inputs.forEach((inputDesc, index) => {
    const inputId = inputDesc.name;
    internalComponents[inputId] = {
      id: inputId,
      type: 'SWITCH',
      value: inputValues[index] ?? false,
    } as Component;
  });

  // Create output components (represented as LEDs)
  circuit.outputs.forEach((outputDesc) => {
    const outputId = outputDesc.name;
    internalComponents[outputId] = {
      id: outputId,
      type: 'LED',
      value: false,
    } as Component;
  });

  // Convert internal nodes to components
  circuit.nodes.forEach((node: Node) => {
    // Map node's componentRef to the component type
    // For primitives, componentRef should match primitive types
    const componentType = mapNodeToComponentType(node.componentRef);

    internalComponents[node.id] = {
      id: node.id,
      type: componentType,
      label: node.label,
    } as Component;
  });

  // Convert internal connections
  circuit.connections.forEach((conn: IRv01Connection, index: number) => {
    const connectionId = `conn_${index}`;

    // Map source and target port paths to component IDs and port indices
    const sourceInfo = mapPortPathToComponentPort(conn.source, circuit);
    const targetInfo = mapPortPathToComponentPort(conn.target, circuit);

    if (sourceInfo && targetInfo) {
      internalConnections[connectionId] = {
        id: connectionId,
        sourceComponentId: sourceInfo.componentId,
        sourcePortIndex: sourceInfo.portIndex,
        targetComponentId: targetInfo.componentId,
        targetPortIndex: targetInfo.portIndex,
      };
    }
  });

  return {
    components: internalComponents,
    connections: internalConnections,
  };
}

/**
 * Maps a node's componentRef to a ComponentType for the old IR format
 */
function mapNodeToComponentType(componentRef: string): string {
  // Map common component references to primitive types
  const typeMap: Record<string, string> = {
    'And': 'AND_GATE',
    'Or': 'OR_GATE',
    'Not': 'NOT_GATE',
    'Nand': 'NAND_GATE',
    'Nor': 'NOR_GATE',
    'Xor': 'XOR_GATE',
    'Xnor': 'XNOR_GATE',
    'Buffer': 'BUFFER',
    'Switch': 'SWITCH',
    'Led': 'LED',
  };

  return typeMap[componentRef] || componentRef;
}

/**
 * Maps a PortPath to a component ID and port index
 */
function mapPortPathToComponentPort(
  portPath: PortPath,
  circuit: Circuit
): { componentId: string; portIndex: number } | null {
  // If nodeId is empty, it refers to a circuit-level port (input/output)
  if (portPath.nodeId === '') {
    // Circuit-level port - use the port name as component ID
    return {
      componentId: portPath.portName,
      portIndex: 0,
    };
  }

  // Find the node
  const node = circuit.nodes.find((n) => n.id === portPath.nodeId);
  if (!node) {
    return null;
  }

  // Find the port index by name
  const inputPortIndex = node.inputs.findIndex((p) => p.name === portPath.portName);
  if (inputPortIndex !== -1) {
    return {
      componentId: node.id,
      portIndex: inputPortIndex,
    };
  }

  const outputPortIndex = node.outputs.findIndex((p) => p.name === portPath.portName);
  if (outputPortIndex !== -1) {
    return {
      componentId: node.id,
      portIndex: outputPortIndex,
    };
  }

  return null;
}

/**
 * Gets the input value for a specific port of a component
 */
function getComponentInputValue(
  componentId: string,
  portIndex: number,
  components: Record<string, Component>,
  ir: IRState
): boolean | undefined {
  // Find the connection to this input port
  const connection = Object.values(ir.connections).find(
    (conn) => conn.targetComponentId === componentId && conn.targetPortIndex === portIndex
  );

  if (!connection) {
    return undefined; // Unconnected
  }

  const sourceComponent = components[connection.sourceComponentId];
  if (!sourceComponent) {
    return undefined;
  }

  // Get the source component's output value
  return getComponentOutputValue(sourceComponent, connection.sourcePortIndex, components, ir);
}

/**
 * Gets all input values for a component
 */
function getComponentInputValues(
  componentId: string,
  inputCount: number,
  components: Record<string, Component>,
  ir: IRState
): boolean[] {
  const values: boolean[] = [];

  for (let i = 0; i < inputCount; i++) {
    const value = getComponentInputValue(componentId, i, components, ir);
    values.push(value ?? false); // Default to false for unconnected inputs
  }

  return values;
}

/**
 * Gets the output value for a specific port of a component
 */
function getComponentOutputValue(
  component: Component,
  portIndex: number,
  components: Record<string, Component>,
  ir: IRState,
  recursionDepth: number = 0
): boolean | undefined {
  // Check if this is a primitive component
  if (isPrimitiveComponentType(component.type)) {
    switch (component.type) {
      case 'SWITCH':
        // Type guard: SWITCH components have a value property
        if ('value' in component) {
          return component.value;
        }
        return undefined;

      // All logic gates follow the same pattern
      case 'AND_GATE':
      case 'OR_GATE':
      case 'NOT_GATE':
      case 'NAND_GATE':
      case 'NOR_GATE':
      case 'XOR_GATE':
      case 'XNOR_GATE':
      case 'BUFFER': {
        const spec = getComponentSpec(component.type);
        const inputValues = getComponentInputValues(component.id, spec?.inputCount ?? 0, components, ir);

        if (!spec?.evaluate) {
          return false;
        }

        const outputs = spec.evaluate(inputValues);
        return outputs[portIndex];
      }

      case 'LED':
        // LEDs don't have outputs
        return undefined;
    }
  } else {
    // This is a user-defined composite component
    return evaluateCompositeComponent(component, components, ir, portIndex, recursionDepth);
  }

  return undefined;
}

/**
 * Validates the circuit for simulation
 */
export function validateCircuit(ir: IRState): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for disconnected inputs (warning, not error)
  for (const component of Object.values(ir.components)) {
    const spec = getComponentSpec(component.type);

    for (let i = 0; i < (spec?.inputCount ?? 0); i++) {
      const hasConnection = Object.values(ir.connections).some(
        (conn) => conn.targetComponentId === component.id && conn.targetPortIndex === i
      );

      if (!hasConnection) {
        errors.push(`Component ${component.id} input ${i} is not connected`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
