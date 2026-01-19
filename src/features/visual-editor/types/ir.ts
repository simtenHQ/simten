/**
 * Intermediate Representation (IR) Types
 *
 * The IR represents the logical circuit structure without any visual information.
 * This is the "source of truth" for what components exist and how they're connected.
 */

// ===========================
// Component Type Definitions
// ===========================

// Primitive component types (built-in)
export type PrimitiveComponentType =
  | 'SWITCH'
  | 'LED'
  | 'AND_GATE'
  | 'OR_GATE'
  | 'NOT_GATE'
  | 'NAND_GATE'
  | 'NOR_GATE'
  | 'XOR_GATE'
  | 'XNOR_GATE'
  | 'BUFFER';

// ComponentType can be primitive or user-defined (string)
export type ComponentType = PrimitiveComponentType | string;

export interface ComponentBase {
  id: string;
  type: ComponentType;
  label?: string;
}

// INPUT components (user-controllable)
export interface SwitchComponent extends ComponentBase {
  type: 'SWITCH';
  value: boolean; // Current state of the switch
}

// OUTPUT components (display-only)
export interface LEDComponent extends ComponentBase {
  type: 'LED';
  value: boolean; // Current state (on/off)
}

// LOGIC components
export interface AndGateComponent extends ComponentBase {
  type: 'AND_GATE';
}

export interface OrGateComponent extends ComponentBase {
  type: 'OR_GATE';
}

export interface NotGateComponent extends ComponentBase {
  type: 'NOT_GATE';
}

export interface NandGateComponent extends ComponentBase {
  type: 'NAND_GATE';
}

export interface NorGateComponent extends ComponentBase {
  type: 'NOR_GATE';
}

export interface XorGateComponent extends ComponentBase {
  type: 'XOR_GATE';
}

export interface XnorGateComponent extends ComponentBase {
  type: 'XNOR_GATE';
}

export interface BufferComponent extends ComponentBase {
  type: 'BUFFER';
}

// USER-DEFINED components (composite/custom)
export interface UserDefinedComponent extends ComponentBase {
  type: string; // Component name from library (e.g., 'MyAndGate', 'HalfAdder')
  // User components are resolved from the component library at runtime
}

export type Component =
  | SwitchComponent
  | LEDComponent
  | AndGateComponent
  | OrGateComponent
  | NotGateComponent
  | NandGateComponent
  | NorGateComponent
  | XorGateComponent
  | XnorGateComponent
  | BufferComponent
  | UserDefinedComponent;

// ===========================
// Port Definitions
// ===========================

export type PortType = 'input' | 'output';

export interface PortDefinition {
  id: string; // Unique port identifier (e.g., "comp1.in0", "comp1.out0")
  componentId: string;
  type: PortType;
  index: number; // Port index on the component (0, 1, 2...)
  value?: boolean; // Current signal value on this port
}

// ===========================
// Connection Definitions
// ===========================

export interface Connection {
  id: string;
  sourceComponentId: string;
  sourcePortIndex: number;
  targetComponentId: string;
  targetPortIndex: number;
}

// ===========================
// Component Specifications
// ===========================

// Defines the port configuration for each component type
export interface ComponentSpec {
  type: ComponentType;
  inputCount: number;
  outputCount: number;
  evaluate?: (inputs: boolean[]) => boolean[]; // Logic function
}

// Primitive component specifications
export const PRIMITIVE_COMPONENT_SPECS: Record<PrimitiveComponentType, ComponentSpec> = {
  SWITCH: {
    type: 'SWITCH',
    inputCount: 0,
    outputCount: 1,
    // Switch output is controlled by user, not evaluated
  },
  LED: {
    type: 'LED',
    inputCount: 1,
    outputCount: 0,
    // LED is an output component, no evaluation
  },
  AND_GATE: {
    type: 'AND_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: boolean[]) => {
      // AND gate: output is true only if all inputs are true
      const result = inputs.length === 2 ? inputs[0] && inputs[1] : false;
      return [result];
    },
  },
  OR_GATE: {
    type: 'OR_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: boolean[]) => {
      // OR gate: output is true if ANY input is true
      const result = inputs.length === 2 ? (inputs[0] || inputs[1]) : false;
      return [result];
    },
  },
  NOT_GATE: {
    type: 'NOT_GATE',
    inputCount: 1,
    outputCount: 1,
    evaluate: (inputs: boolean[]) => {
      // NOT gate: output is inverse of input
      const result = inputs.length === 1 ? !inputs[0] : false;
      return [result];
    },
  },
  NAND_GATE: {
    type: 'NAND_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: boolean[]) => {
      // NAND gate: output is false only when ALL inputs are true
      const result = inputs.length === 2 ? !(inputs[0] && inputs[1]) : true;
      return [result];
    },
  },
  NOR_GATE: {
    type: 'NOR_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: boolean[]) => {
      // NOR gate: output is true only when ALL inputs are false
      const result = inputs.length === 2 ? !(inputs[0] || inputs[1]) : true;
      return [result];
    },
  },
  XOR_GATE: {
    type: 'XOR_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: boolean[]) => {
      // XOR gate: output is true when inputs are different
      const result = inputs.length === 2 ? (inputs[0] !== inputs[1]) : false;
      return [result];
    },
  },
  XNOR_GATE: {
    type: 'XNOR_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: boolean[]) => {
      // XNOR gate: output is true when inputs are the same
      const result = inputs.length === 2 ? (inputs[0] === inputs[1]) : false;
      return [result];
    },
  },
  BUFFER: {
    type: 'BUFFER',
    inputCount: 1,
    outputCount: 1,
    evaluate: (inputs: boolean[]) => {
      // BUFFER: output equals input
      const result = inputs.length === 1 ? inputs[0] : false;
      return [result];
    },
  },
};

// Backward compatibility alias
export const COMPONENT_SPECS = PRIMITIVE_COMPONENT_SPECS;

// Helper function to check if a component type is primitive
export function isPrimitiveComponentType(type: ComponentType): type is PrimitiveComponentType {
  return type in PRIMITIVE_COMPONENT_SPECS;
}

// Helper function to safely get component specs
export function getComponentSpec(type: ComponentType): ComponentSpec | undefined {
  if (isPrimitiveComponentType(type)) {
    return PRIMITIVE_COMPONENT_SPECS[type];
  }
  // TODO: For user-defined components, resolve from component library
  return undefined;
}

// ===========================
// IR State
// ===========================

export interface IRState {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
}
