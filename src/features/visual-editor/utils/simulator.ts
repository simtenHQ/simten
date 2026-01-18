/**
 * Simulator Engine
 *
 * Handles signal propagation through the circuit.
 * Evaluates logic gates and updates component values.
 */

import type { IRState, Component } from '../types';
import { COMPONENT_SPECS } from '../types';

/**
 * Runs one simulation step, propagating values through the circuit
 */
export function runSimulationStep(ir: IRState): IRState {
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
      const updatedValue = evaluateComponent(component, updatedComponents, ir);

      if (updatedValue !== undefined) {
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
            // Switches maintain their user-set value
            updatedComponents[id] = {
              ...component,
              value: updatedValue
            } as Component;
          }
        }
      }
    }
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
  ir: IRState
): boolean | undefined {
  const spec = COMPONENT_SPECS[component.type];

  switch (component.type) {
    case 'SWITCH':
      // Switch value is user-controlled, not evaluated
      return component.value;

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
      const inputValues = getComponentInputValues(component.id, spec.inputCount, components, ir);

      if (inputValues.length !== spec.inputCount) {
        return false; // Not all inputs connected
      }

      if (!spec.evaluate) {
        return false;
      }

      const outputs = spec.evaluate(inputValues);
      return outputs[0]; // Return first output
    }

    default:
      return undefined;
  }
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
  ir: IRState
): boolean | undefined {
  switch (component.type) {
    case 'SWITCH':
      return component.value;

    // All logic gates follow the same pattern
    case 'AND_GATE':
    case 'OR_GATE':
    case 'NOT_GATE':
    case 'NAND_GATE':
    case 'NOR_GATE':
    case 'XOR_GATE':
    case 'XNOR_GATE':
    case 'BUFFER': {
      const spec = COMPONENT_SPECS[component.type];
      const inputValues = getComponentInputValues(component.id, spec.inputCount, components, ir);

      if (!spec.evaluate) {
        return false;
      }

      const outputs = spec.evaluate(inputValues);
      return outputs[portIndex];
    }

    case 'LED':
      // LEDs don't have outputs
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Validates the circuit for simulation
 */
export function validateCircuit(ir: IRState): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for disconnected inputs (warning, not error)
  for (const component of Object.values(ir.components)) {
    const spec = COMPONENT_SPECS[component.type];

    for (let i = 0; i < spec.inputCount; i++) {
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
