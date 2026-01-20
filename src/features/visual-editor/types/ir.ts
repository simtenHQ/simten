/**
 * Intermediate Representation (IR) Types
 *
 * The IR represents the logical circuit structure without any visual information.
 * This is the "source of truth" for what components exist and how they're connected.
 */

// ===========================
// Component Type Definitions
// ===========================

/**
 * Legacy primitive component types (for backward compatibility)
 * These use SCREAMING_SNAKE_CASE naming convention
 *
 * NOTE: This enum is deprecated. New code should use the dynamic primitive
 * lookup from primitives.ts PRIMITIVES array, which uses PascalCase naming.
 */
export type LegacyPrimitiveComponentType =
  | 'SWITCH'
  | 'LED'
  | 'INPUT'
  | 'AND_GATE'
  | 'OR_GATE'
  | 'NOT_GATE'
  | 'NAND_GATE'
  | 'NOR_GATE'
  | 'XOR_GATE'
  | 'XNOR_GATE'
  | 'BUFFER'
  | 'D_FLIP_FLOP'
  | 'REGISTER'
  | 'RAM';

/**
 * All primitive component type names from primitives.ts
 * This type is derived from the PRIMITIVES array at runtime.
 *
 * Includes all 31+ primitive components like:
 * - Logic gates: And, Or, Not, Nand, Nor, Xor, Xnor, Buffer
 * - I/O: Switch, Led, Button, Input
 * - Arithmetic: Adder, Multiplier, Comparator
 * - Plexers: Mux, Decoder
 * - Sequential: DFlipFlop, Register, RAM, ROM
 * - Display: SevenSegment, HexDisplay
 * - Utility: Splitter, Splitter8to8, Constant, Probe
 * - Bus operations: BusAnd, BusOr, BusNot, BusXor
 */
export type PrimitiveComponentType = string;

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

export interface InputComponent extends ComponentBase {
  type: 'INPUT';
  value: number; // Current numeric value
  width: number; // Bit width (default: 8)
}

// OUTPUT components (display-only)
export interface LEDComponent extends ComponentBase {
  type: 'LED';
  value: boolean; // Current state (on/off)
}

export interface HexDisplayComponent extends ComponentBase {
  type: 'HexDisplay';
  value: number; // Current numeric value to display
  width: number; // Bit width (default: 8)
}

export interface SevenSegmentComponent extends ComponentBase {
  type: 'SevenSegment';
  value: number; // Current numeric value to display (0-15)
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

// SEQUENTIAL components (stateful)
export interface DFlipFlopComponent extends ComponentBase {
  type: 'D_FLIP_FLOP';
  state: boolean; // Current stored value (Q output)
}

export interface RegisterComponent extends ComponentBase {
  type: 'REGISTER';
  width: number; // Number of bits (default: 8)
  state: number; // Current stored value
}

export interface RAMComponent extends ComponentBase {
  type: 'RAM';
  addressWidth: number; // Number of address bits (default: 8)
  dataWidth: number; // Number of data bits (default: 8)
  memory: Map<number, number>; // Sparse memory storage
}

// USER-DEFINED components (composite/custom)
export interface UserDefinedComponent extends ComponentBase {
  type: string; // Component name from library (e.g., 'MyAndGate', 'HalfAdder')
  // User components are resolved from the component library at runtime
}

export type Component =
  | SwitchComponent
  | InputComponent
  | LEDComponent
  | HexDisplayComponent
  | SevenSegmentComponent
  | AndGateComponent
  | OrGateComponent
  | NotGateComponent
  | NandGateComponent
  | NorGateComponent
  | XorGateComponent
  | XnorGateComponent
  | BufferComponent
  | DFlipFlopComponent
  | RegisterComponent
  | RAMComponent
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
  evaluate?: (inputs: (boolean | number)[]) => (boolean | number)[]; // Logic function
}

/**
 * Legacy primitive component specifications (SCREAMING_SNAKE_CASE naming)
 *
 * DEPRECATED: This is kept only for backward compatibility.
 * New code should use the primitives.ts PRIMITIVES array with PascalCase naming.
 *
 * These specs use the old evaluate() signature which will be removed in the future.
 */
export const LEGACY_PRIMITIVE_SPECS: Record<LegacyPrimitiveComponentType, ComponentSpec> = {
  SWITCH: {
    type: 'SWITCH',
    inputCount: 0,
    outputCount: 1,
  },
  INPUT: {
    type: 'INPUT',
    inputCount: 0,
    outputCount: 1,
  },
  LED: {
    type: 'LED',
    inputCount: 1,
    outputCount: 0,
  },
  AND_GATE: {
    type: 'AND_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: (boolean | number)[]) => {
      const result = inputs.length === 2 ? Boolean(inputs[0]) && Boolean(inputs[1]) : false;
      return [result];
    },
  },
  OR_GATE: {
    type: 'OR_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: (boolean | number)[]) => {
      const result = inputs.length === 2 ? (Boolean(inputs[0]) || Boolean(inputs[1])) : false;
      return [result];
    },
  },
  NOT_GATE: {
    type: 'NOT_GATE',
    inputCount: 1,
    outputCount: 1,
    evaluate: (inputs: (boolean | number)[]) => {
      const result = inputs.length === 1 ? !Boolean(inputs[0]) : false;
      return [result];
    },
  },
  NAND_GATE: {
    type: 'NAND_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: (boolean | number)[]) => {
      const result = inputs.length === 2 ? !(Boolean(inputs[0]) && Boolean(inputs[1])) : true;
      return [result];
    },
  },
  NOR_GATE: {
    type: 'NOR_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: (boolean | number)[]) => {
      const result = inputs.length === 2 ? !(Boolean(inputs[0]) || Boolean(inputs[1])) : true;
      return [result];
    },
  },
  XOR_GATE: {
    type: 'XOR_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: (boolean | number)[]) => {
      const result = inputs.length === 2 ? (Boolean(inputs[0]) !== Boolean(inputs[1])) : false;
      return [result];
    },
  },
  XNOR_GATE: {
    type: 'XNOR_GATE',
    inputCount: 2,
    outputCount: 1,
    evaluate: (inputs: (boolean | number)[]) => {
      const result = inputs.length === 2 ? (Boolean(inputs[0]) === Boolean(inputs[1])) : false;
      return [result];
    },
  },
  BUFFER: {
    type: 'BUFFER',
    inputCount: 1,
    outputCount: 1,
    evaluate: (inputs: (boolean | number)[]) => {
      const result = inputs.length === 1 ? Boolean(inputs[0]) : false;
      return [result];
    },
  },
  D_FLIP_FLOP: {
    type: 'D_FLIP_FLOP',
    inputCount: 2, // D (data), CLK (clock)
    outputCount: 2, // Q, Q_BAR (inverse)
  },
  REGISTER: {
    type: 'REGISTER',
    inputCount: 2, // DATA (bus), WE (write enable)
    outputCount: 1, // Q (bus)
  },
  RAM: {
    type: 'RAM',
    inputCount: 4, // ADDR (bus), DATA_IN (bus), WE (write enable), CLK (clock)
    outputCount: 1, // DATA_OUT (bus)
  },
};

// Backward compatibility aliases
export const PRIMITIVE_COMPONENT_SPECS = LEGACY_PRIMITIVE_SPECS;
export const COMPONENT_SPECS = LEGACY_PRIMITIVE_SPECS;

/**
 * Check if a component type is a primitive (from either old or new system)
 *
 * This uses dynamic lookup from primitives.ts as the source of truth.
 * Falls back to legacy specs for backward compatibility.
 */
export function isPrimitiveComponentType(type: ComponentType): type is PrimitiveComponentType {
  // Try new-style primitives first (PascalCase from primitives.ts)
  try {
    const { isPrimitive } = require('../lib/primitives');
    if (isPrimitive(type)) {
      return true;
    }
  } catch (e) {
    // If primitives.ts is not available, fall through to legacy check
  }

  // Fall back to legacy primitives (SCREAMING_SNAKE_CASE)
  return type in LEGACY_PRIMITIVE_SPECS;
}

/**
 * Get component specification for any component type
 *
 * This function provides a unified interface for getting component specs
 * from either the new primitives.ts system or the legacy system.
 */
export function getComponentSpec(type: ComponentType): ComponentSpec | undefined {
  // Try new-style primitives first (from primitives.ts PRIMITIVES array)
  try {
    const { PRIMITIVES } = require('../lib/primitives');
    const primitive = PRIMITIVES.find((p: any) => p.name === type);
    if (primitive) {
      return {
        type,
        inputCount: primitive.inputs.length,
        outputCount: primitive.outputs.length,
      };
    }
  } catch (e) {
    // If primitives.ts is not available (e.g., during initial load), fall through
  }

  // Fall back to legacy primitives
  if (type in LEGACY_PRIMITIVE_SPECS) {
    return LEGACY_PRIMITIVE_SPECS[type as LegacyPrimitiveComponentType];
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

// ===========================
// Sequential Simulation State
// ===========================

/**
 * Clock signal state
 */
export interface ClockSignal {
  previousValue: boolean;
  currentValue: boolean;
}

/**
 * Sequential simulation state management
 * Uses double buffering to prevent race conditions
 */
export interface SequentialState {
  // Clock signals
  clocks: Map<string, ClockSignal>;

  // Component state (double buffered)
  // Includes undefined to match PrimitiveState type from primitive-interface.ts
  currentState: Map<string, boolean | number | Map<number, number> | undefined>;
  nextState: Map<string, boolean | number | Map<number, number> | undefined>;

  // Simulation cycle counter
  cycleCount: number;
}

/**
 * Helper function to check if a component is sequential (has state)
 */
export function isSequentialComponent(type: ComponentType): boolean {
  return type === 'D_FLIP_FLOP' || type === 'REGISTER' || type === 'RAM';
}

/**
 * Helper function to detect clock edge
 */
export function detectClockEdge(clock: ClockSignal): 'rising' | 'falling' | 'none' {
  if (!clock.previousValue && clock.currentValue) {
    return 'rising';
  } else if (clock.previousValue && !clock.currentValue) {
    return 'falling';
  }
  return 'none';
}
