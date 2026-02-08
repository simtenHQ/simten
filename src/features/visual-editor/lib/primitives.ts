/**
 * Primitive Component Definitions
 *
 * ⚡ THIS IS THE SINGLE SOURCE OF TRUTH FOR ALL PRIMITIVE COMPONENTS ⚡
 *
 * To add a new primitive, add ONE definition to PRIMITIVE_DEFINITIONS below.
 * Everything else (circuit IR, evaluator, metadata, component creation) is
 * automatically generated from that definition.
 *
 * ## How to Add a New Primitive
 *
 * ### Example 1: Simple Combinational Primitive (Logic Gate)
 * ```typescript
 * MyGate: defineCombinational({
 *   name: 'MyGate',
 *   description: 'Does something cool with inputs',
 *   category: 'logic-gates',
 *   icon: '⚡',
 *   componentType: 'MY_GATE',
 *   inputs: [
 *     { name: 'a', portType: bitType() },
 *     { name: 'b', portType: bitType() },
 *   ],
 *   outputs: [{ name: 'out', portType: bitType() }],
 *   evaluate: (inputs) => {
 *     const a = inputs.get('a') as boolean;
 *     const b = inputs.get('b') as boolean;
 *     return new Map([['out', a && b]]);
 *   },
 * }),
 * ```
 *
 * ### Example 2: Sequential Primitive (Flip-Flop, Register)
 * ```typescript
 * MyRegister: defineSequential({
 *   name: 'MyRegister',
 *   description: 'Stores data',
 *   category: 'sequential',
 *   icon: '📦',
 *   componentType: 'MY_REGISTER',
 *   inputs: [{ name: 'data', portType: busType(8) }],
 *   outputs: [{ name: 'q', portType: busType(8) }],
 *   clocks: [{ name: 'clk' }],
 *   state: [{ id: 'reg-state', name: 'value', stateType: busType(8), initialValue: 0 }],
 *   evaluate: (inputs, currentState) => {
 *     return new Map([['q', currentState ?? 0]]);
 *   },
 *   updateState: (inputs, currentState, clockEdges) => {
 *     if (clockEdges['clk'] === 'rising') {
 *       return inputs.get('data') as number;
 *     }
 *     return currentState;
 *   },
 *   createComponent: (id, initialValue) => ({
 *     id,
 *     type: 'MyRegister',
 *     state: initialValue ?? 0,
 *   } as Component),
 * }),
 * ```
 *
 * ## Architecture
 *
 * Each primitive definition includes:
 * - **Identity**: name, description
 * - **UI metadata**: category, icon, componentType
 * - **Circuit structure**: inputs, outputs, clocks, state, parameters
 * - **Behavior**: evaluator function (computes outputs from inputs/state)
 * - **Component creation**: initial state logic
 *
 * From these definitions, we automatically generate:
 * - `PRIMITIVES` - Circuit IR definitions for the simulator
 * - `PRIMITIVE_EVALUATORS` - Evaluation logic registry
 * - `PRIMITIVE_METADATA` - UI palette metadata (via primitive-metadata.ts)
 * - `createPrimitiveComponent` - Component instance creator
 *
 * @see primitive-metadata.ts - Metadata for component palette
 * @see primitive-interface.ts - Evaluator interfaces
 */

import type {
  Circuit,
  BitValue,
  BusValue,
  PortDescriptor,
  ClockDescriptor,
  StateBlock,
  Parameter,
  Node,
} from '../types/ir-v0.1';
import { bitType, busType } from '../types/ir-v0.1';
import type { Component } from '../types/ir';
import type { ComponentType } from '../types';
import {
  createCombinationalEvaluator,
  createSequentialEvaluator,
  type PrimitiveEvaluator,
  type InputValue,
  type PrimitiveState,
  type ClockEdges,
  type EvaluationContext,
} from './primitive-interface';
import type { EnvironmentalStateValue } from '../types/simulation-snapshot';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Special metadata for primitives with unique behavior
 */
interface PrimitiveSpecialMetadata {
  /** Component kind (e.g., 'sink' for display components) */
  kind?: 'sink';
  /** Interfaces this component provides (e.g., 'FrameSnapshotSource' for DualPortRAM) */
  provides?: string[];
  /** Interfaces this component consumes (e.g., 'FrameSnapshotSource' for Screen) */
  consumes?: string[];
}

/**
 * Complete definition for a primitive component
 *
 * This interface captures everything needed to define a primitive:
 * - Circuit structure (IR definition)
 * - Evaluation logic (simulator behavior)
 * - UI presentation (palette metadata)
 * - Component creation (initial state)
 */
export interface PrimitiveDefinition {
  // ===== Identity =====
  /** Primitive name (must be unique, used as type identifier) */
  name: string;
  /** Human-readable description for tooltips and docs */
  description: string;

  // ===== UI Metadata =====
  /** Category for component palette organization */
  category: string;
  /** Display icon (emoji or unicode symbol) */
  icon: string;
  /** ComponentType enum value for legacy compatibility */
  componentType: ComponentType;

  // ===== Circuit Structure (IR) =====
  /** Input ports */
  inputs: PortDescriptor[];
  /** Output ports */
  outputs: PortDescriptor[];
  /** Clock signals (for sequential components) */
  clocks?: ClockDescriptor[];
  /** Internal state (for sequential components) */
  state?: StateBlock[];
  /** Configuration parameters */
  parameters?: Parameter[];

  // ===== Behavior =====
  /** Evaluation logic (computes outputs from inputs/state) */
  evaluator: PrimitiveEvaluator;

  // ===== Component Creation =====
  /**
   * Create a component instance with proper initial state
   *
   * This function replaces the giant switch statement in createPrimitiveComponent().
   * It encapsulates all component-specific initialization logic.
   *
   * @param id - Unique component ID
   * @param initialValue - Optional initial value for stateful/input components
   * @returns Component object with proper initial state
   */
  createComponent: (id: string, initialValue?: boolean | number) => Component;

  // ===== Special Metadata =====
  /** Optional metadata for special component types (sinks, DMA providers, etc.) */
  metadata?: PrimitiveSpecialMetadata;
  /**
   * Output dependency mode (for sequential components):
   * - 'state-only': Outputs come purely from state (DFlipFlop, Register, RasterDisplay)
   * - 'input-dependent': Outputs depend on current inputs (RAM - read is combinational)
   * Used for topological sorting to prevent false cycle detection.
   */
  outputDependency?: 'state-only' | 'input-dependent';

  // ===== Environmental State (Time-Travel Debugging) =====
  /**
   * Does this component have environmental state?
   * Environmental state = values from outside the circuit (user inputs, sensors, RNG)
   */
  hasEnvironmentalState?: boolean;

  /**
   * Capture environmental state from a node
   * Must return a cloneable, deterministic, replay-safe value
   */
  captureEnvironmentalState?: (node: Node) => EnvironmentalStateValue;

  /**
   * Restore environmental state to a node
   * Must be idempotent (can be called multiple times safely)
   */
  restoreEnvironmentalState?: (node: Node, state: EnvironmentalStateValue) => void;
}

// ============================================================================
// Helper Functions for Defining Primitives
// ============================================================================

/**
 * Define a primitive component with full configuration
 *
 * This is the core definition function. Use the convenience helpers
 * (defineCombinational, defineSequential) for common cases.
 *
 * @param def - Complete primitive definition
 * @returns The definition (for type checking)
 */
export function definePrimitive(def: PrimitiveDefinition): PrimitiveDefinition {
  return def;
}

/**
 * Define a simple combinational primitive (most common case)
 *
 * Combinational primitives:
 * - Have no clocks or state
 * - Compute outputs directly from inputs
 * - Examples: logic gates, arithmetic ops, bus ops
 *
 * This helper reduces boilerplate for the most common primitive type.
 *
 * @param config - Simplified configuration for combinational primitives
 * @returns Complete primitive definition
 */
export function defineCombinational(config: {
  name: string;
  description: string;
  category: string;
  icon: string;
  componentType: ComponentType;
  inputs: PortDescriptor[];
  outputs: PortDescriptor[];
  parameters?: Parameter[];
  evaluate: (
    inputs: Map<string, InputValue>,
    currentState?: PrimitiveState,
    context?: EvaluationContext
  ) => Map<string, BitValue | BusValue>;
  createComponent?: (id: string, initialValue?: boolean | number) => Component;
  metadata?: PrimitiveSpecialMetadata;
  hasEnvironmentalState?: boolean;
  captureEnvironmentalState?: (node: Node) => EnvironmentalStateValue;
  restoreEnvironmentalState?: (node: Node, state: EnvironmentalStateValue) => void;
}): PrimitiveDefinition {
  return definePrimitive({
    name: config.name,
    description: config.description,
    category: config.category,
    icon: config.icon,
    componentType: config.componentType,
    inputs: config.inputs,
    outputs: config.outputs,
    parameters: config.parameters,
    evaluator: createCombinationalEvaluator(config.evaluate),
    createComponent: config.createComponent ?? ((id) => ({ id, type: config.name } as Component)),
    metadata: config.metadata,
    hasEnvironmentalState: config.hasEnvironmentalState,
    captureEnvironmentalState: config.captureEnvironmentalState,
    restoreEnvironmentalState: config.restoreEnvironmentalState,
  });
}

/**
 * Define a sequential primitive (has state and clocks)
 *
 * Sequential primitives:
 * - Have one or more clocks
 * - Maintain internal state
 * - Update state on clock edges
 * - Examples: flip-flops, registers, RAM
 *
 * @param config - Configuration for sequential primitives
 * @returns Complete primitive definition
 */
export function defineSequential(config: {
  name: string;
  description: string;
  category: string;
  icon: string;
  componentType: ComponentType;
  inputs: PortDescriptor[];
  outputs: PortDescriptor[];
  clocks: ClockDescriptor[];
  state: StateBlock[];
  parameters?: Parameter[];
  evaluate: (
    inputs: Map<string, InputValue>,
    currentState?: PrimitiveState
  ) => Map<string, BitValue | BusValue>;
  updateState: (inputs: Map<string, InputValue>, currentState: PrimitiveState, clockEdges: ClockEdges) => PrimitiveState;
  createComponent: (id: string, initialValue?: boolean | number) => Component;
  /**
   * Output dependency mode:
   * - 'state-only': Outputs come purely from state (DFlipFlop, Register, RasterDisplay)
   * - 'input-dependent': Outputs depend on current inputs (RAM read is combinational)
   *
   * This affects evaluation order to prevent false cycle detection.
   * Default: 'input-dependent'
   */
  outputDependency?: 'state-only' | 'input-dependent';
  metadata?: PrimitiveSpecialMetadata;
}): PrimitiveDefinition {
  return definePrimitive({
    name: config.name,
    description: config.description,
    category: config.category,
    icon: config.icon,
    componentType: config.componentType,
    inputs: config.inputs,
    outputs: config.outputs,
    clocks: config.clocks,
    state: config.state,
    parameters: config.parameters,
    evaluator: createSequentialEvaluator(config.evaluate, config.updateState),
    createComponent: config.createComponent,
    metadata: config.metadata,
    outputDependency: config.outputDependency,
  });
}

// ============================================================================
// Primitive Definitions
// ============================================================================

/**
 * All primitive definitions in one place
 *
 * Add new primitives here - each entry creates:
 * - Circuit IR definition
 * - Evaluator registration
 * - Palette metadata
 * - Component creator
 */
export const PRIMITIVE_DEFINITIONS: Record<string, PrimitiveDefinition> = {
  // ============================================================================
  // Logic Gates
  // ============================================================================

  And: defineCombinational({
    name: 'And',
    description: 'Logical AND gate - outputs true when both inputs are true',
    category: 'logic-gates',
    icon: '&',
    componentType: 'AND_GATE',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', a && b]]);
    },
  }),

  Or: defineCombinational({
    name: 'Or',
    description: 'Logical OR gate - outputs true when at least one input is true',
    category: 'logic-gates',
    icon: '≥1',
    componentType: 'OR_GATE',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', a || b]]);
    },
  }),

  Not: defineCombinational({
    name: 'Not',
    description: 'Logical NOT gate - inverts the input',
    category: 'logic-gates',
    icon: '¬',
    componentType: 'NOT_GATE',
    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('in') as boolean;
      return new Map([['out', !a]]);
    },
  }),

  Nand: defineCombinational({
    name: 'Nand',
    description: 'Logical NAND gate - outputs false only when both inputs are true',
    category: 'logic-gates',
    icon: '⊼',
    componentType: 'NAND_GATE',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', !(a && b)]]);
    },
  }),

  Nor: defineCombinational({
    name: 'Nor',
    description: 'Logical NOR gate - outputs true only when both inputs are false',
    category: 'logic-gates',
    icon: '⊽',
    componentType: 'NOR_GATE',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', !(a || b)]]);
    },
  }),

  Xor: defineCombinational({
    name: 'Xor',
    description: 'Logical XOR gate - outputs true when inputs are different',
    category: 'logic-gates',
    icon: '⊕',
    componentType: 'XOR_GATE',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', a !== b]]);
    },
  }),

  Xnor: defineCombinational({
    name: 'Xnor',
    description: 'Logical XNOR gate - outputs true when inputs are the same',
    category: 'logic-gates',
    icon: '⊙',
    componentType: 'XNOR_GATE',
    inputs: [
      { name: 'a', portType: bitType() },
      { name: 'b', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as boolean;
      const b = inputs.get('b') as boolean;
      return new Map([['out', a === b]]);
    },
  }),

  Buffer: defineCombinational({
    name: 'Buffer',
    description: 'Buffer - passes the input through unchanged',
    category: 'logic-gates',
    icon: '▷',
    componentType: 'BUFFER',
    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const a = inputs.get('in') as boolean;
      return new Map([['out', a]]);
    },
  }),

  // ============================================================================
  // I/O Components
  // ============================================================================

  Switch: defineCombinational({
    name: 'Switch',
    description: 'User-controllable input switch',
    category: 'input-output',
    icon: '⚡',
    componentType: 'SWITCH',
    inputs: [],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (_inputs) => {
      // Switch output is controlled externally, not evaluated
      // This evaluator is just for consistency
      return new Map([['out', false]]);
    },
    createComponent: (id, initialValue) => {
      const value: boolean = typeof initialValue === 'boolean' ? initialValue : false;
      return { id, type: 'Switch', value } as Component;
    },

    // Environmental state hooks for time-travel debugging
    hasEnvironmentalState: true,

    captureEnvironmentalState: (node: Node): EnvironmentalStateValue => {
      // Switch state is stored in node.arguments.value (boolean)
      return node.arguments.value as boolean;
    },

    restoreEnvironmentalState: (node: Node, state: EnvironmentalStateValue) => {
      // Restore switch position (must be boolean)
      node.arguments.value = state as boolean;
    },
  }),

  Led: defineCombinational({
    name: 'Led',
    description: 'Visual output LED indicator',
    category: 'input-output',
    icon: '💡',
    componentType: 'LED',
    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [],
    evaluate: (_inputs) => {
      // LED is an output component, no outputs
      // This evaluator is just for consistency
      return new Map();
    },
    createComponent: (id) => {
      const value: boolean = false;
      return { id, type: 'Led', value } as Component;
    },
  }),

  Output: defineCombinational({
    name: 'Output',
    description: 'Multi-bit output sink (for testbenches)',
    category: 'input-output',
    icon: '📤',
    componentType: 'OUTPUT',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [],
    evaluate: (_inputs) => {
      // Output is a sink component, no outputs
      return new Map();
    },
    createComponent: (id) => {
      return { id, type: 'Output', value: 0 } as Component;
    },
  }),

  Button: defineCombinational({
    name: 'Button',
    description: 'Push button input (momentary, user-controlled)',
    category: 'input-output',
    icon: '🔘',
    componentType: 'Button',
    inputs: [],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (_inputs) => {
      // Button output is controlled externally
      return new Map([['out', false]]);
    },
    createComponent: (id, initialValue) => {
      const value: boolean = typeof initialValue === 'boolean' ? initialValue : false;
      return { id, type: 'Button', value } as Component;
    },

    // Environmental state hooks for time-travel debugging
    hasEnvironmentalState: true,

    captureEnvironmentalState: (node: Node): EnvironmentalStateValue => {
      return node.arguments.value as boolean;
    },

    restoreEnvironmentalState: (node: Node, state: EnvironmentalStateValue) => {
      node.arguments.value = state as boolean;
    },
  }),

  Input: defineCombinational({
    name: 'Input',
    description: 'Multi-bit numeric input (runtime editable, default: 8-bit)',
    category: 'input-output',
    icon: '🔢',
    componentType: 'INPUT',
    inputs: [],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      // Get current value from component state (set by UI)
      // Default to 0 if not set
      const value = (inputs.get('__value') as number) ?? 0;
      return new Map([['out', value]]);
    },
    createComponent: (id, initialValue) => {
      const value: number = typeof initialValue === 'number' ? initialValue : 0;
      const width: number = 8; // Default width
      return { id, type: 'Input', value, width } as Component;
    },

    // Environmental state hooks for time-travel debugging
    hasEnvironmentalState: true,

    captureEnvironmentalState: (node: Node): EnvironmentalStateValue => {
      return node.arguments.value as number;
    },

    restoreEnvironmentalState: (node: Node, state: EnvironmentalStateValue) => {
      node.arguments.value = state as number;
    },
  }),

  // ============================================================================
  // Utilities
  // ============================================================================

  Constant: defineCombinational({
    name: 'Constant',
    description: 'Constant value source (parameterized by value)',
    category: 'utilities',
    icon: 'K',
    componentType: 'Constant',
    inputs: [],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      // __value is a parameter (not an input port), but we output it as a signal
      const value = inputs.get('__value') as BitValue | BusValue | undefined;
      return new Map([['out', value ?? 0]]);
    },
    createComponent: (id, initialValue) => {
      const value: boolean | number = initialValue ?? 0;
      return { id, type: 'Constant', value } as Component;
    },
  }),

  Splitter: defineCombinational({
    name: 'Splitter',
    description: 'Bus splitter - splits a bus into smaller buses (default: 8-bit to 2×4-bit)',
    category: 'utilities',
    icon: '⊢',
    componentType: 'Splitter',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [
      { name: 'out0', portType: busType(4) },
      { name: 'out1', portType: busType(4) },
    ],
    evaluate: (inputs) => {
      const inputValue = inputs.get('in') as number;
      const widthsOutParam = inputs.get('__widths_out');
      const widthsOut = (Array.isArray(widthsOutParam) ? widthsOutParam : [4, 4]) as number[];

      const outputs = new Map<string, boolean | number>();
      let bitOffset = 0;

      for (let i = 0; i < widthsOut.length; i++) {
        const width = widthsOut[i];
        const mask = (1 << width) - 1;
        const value = (inputValue >> bitOffset) & mask;

        if (width === 1) {
          outputs.set(`out${i}`, value !== 0);
        } else {
          outputs.set(`out${i}`, value);
        }

        bitOffset += width;
      }

      return outputs;
    },
  }),

  Splitter8to8: defineCombinational({
    name: 'Splitter8to8',
    description: 'Splits an 8-bit bus into 8 individual bit outputs (bit0=LSB, bit7=MSB)',
    category: 'utilities',
    icon: '⊢8',
    componentType: 'Splitter8to8',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [
      { name: 'bit0', portType: bitType() },
      { name: 'bit1', portType: bitType() },
      { name: 'bit2', portType: bitType() },
      { name: 'bit3', portType: bitType() },
      { name: 'bit4', portType: bitType() },
      { name: 'bit5', portType: bitType() },
      { name: 'bit6', portType: bitType() },
      { name: 'bit7', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const inputValue = inputs.get('in') as number;
      const outputs = new Map<string, boolean | number>();

      // Extract each bit (bit0 is LSB, bit7 is MSB)
      for (let i = 0; i < 8; i++) {
        const bitValue = (inputValue >> i) & 1;
        outputs.set(`bit${i}`, bitValue !== 0);
      }

      return outputs;
    },
  }),

  Probe: defineCombinational({
    name: 'Probe',
    description: 'Debug observation point - passes signal through unchanged',
    category: 'utilities',
    icon: '🔍',
    componentType: 'Probe',
    inputs: [{ name: 'in', portType: bitType() }],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      // Get actual input value (not a parameter)
      const value = inputs.get('in') as BitValue | BusValue | undefined;
      return new Map([['out', value ?? false]]);
    },
  }),

  BitSlice: defineCombinational({
    name: 'BitSlice',
    description:
      'Extract bits [low..high] from input (wire routing, zero logic cost). Default: bits 0-2 for modulo-8. For non-power-of-2 bounds, use Comparator+Adder+Mux.',
    category: 'utilities',
    icon: '[]',
    componentType: 'BitSlice',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const value = inputs.get('in') as number;
      // Parameters would come from node.arguments, but for now use defaults
      const low = (inputs.get('__low') as number) ?? 0;
      const high = (inputs.get('__high') as number) ?? 2;

      // Extract bits [low..high]
      const numBits = high - low + 1;
      const mask = (1 << numBits) - 1;
      const result = (value >> low) & mask;

      return new Map([['out', result]]);
    },
  }),

  // ============================================================================
  // Bus Operations (Multi-bit)
  // ============================================================================

  BusAnd: defineCombinational({
    name: 'BusAnd',
    description: 'Bitwise AND operation on 8-bit buses',
    category: 'bus-operations',
    icon: '&8',
    componentType: 'BusAnd',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      return new Map([['out', a & b]]);
    },
  }),

  BusOr: defineCombinational({
    name: 'BusOr',
    description: 'Bitwise OR operation on 8-bit buses',
    category: 'bus-operations',
    icon: '|8',
    componentType: 'BusOr',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      return new Map([['out', a | b]]);
    },
  }),

  BusNot: defineCombinational({
    name: 'BusNot',
    description: 'Bitwise NOT operation on 8-bit bus',
    category: 'bus-operations',
    icon: '¬8',
    componentType: 'BusNot',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const a = inputs.get('in') as number;
      // Note: Need to mask to the appropriate width
      // This is handled by the simulator based on port type
      return new Map([['out', ~a]]);
    },
  }),

  BusXor: defineCombinational({
    name: 'BusXor',
    description: 'Bitwise XOR operation on 8-bit buses',
    category: 'bus-operations',
    icon: '⊕8',
    componentType: 'BusXor',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      return new Map([['out', a ^ b]]);
    },
  }),

  // ============================================================================
  // Arithmetic Operations
  // ============================================================================

  Incrementer: defineCombinational({
    name: 'Incrementer',
    description: 'Incrementer - adds 1 to the input (wraps around at 255)',
    category: 'arithmetic',
    icon: '+1',
    componentType: 'Incrementer',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [{ name: 'out', portType: busType(8) }],
    evaluate: (inputs) => {
      const value = inputs.get('in') as number;
      const width = 8; // Default to 8-bit, will be parameterized later
      const maxValue = (1 << width) - 1;
      const result = (value + 1) & maxValue; // Wrap around on overflow
      return new Map([['out', result]]);
    },
  }),

  Adder: defineCombinational({
    name: 'Adder',
    description: 'Parameterized n-bit adder with carry in/out (default: 8-bit)',
    category: 'arithmetic',
    icon: '➕',
    componentType: 'Adder',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
      { name: 'carry_in', portType: bitType() },
    ],
    outputs: [
      { name: 'sum', portType: busType(8) },
      { name: 'carry_out', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      const carryIn = (inputs.get('carry_in') as boolean) ?? false ? 1 : 0;

      // Get width from metadata (passed as part of inputs map with special key)
      // For now, we'll infer width from the values or use a sensible default
      const width = (inputs.get('__width') as number) ?? 8;
      const mask = (1 << width) - 1;

      const result = a + b + carryIn;
      const sum = result & mask;
      const carryOut = (result >> width) !== 0;

      return new Map<string, boolean | number>([
        ['sum', sum],
        ['carry_out', carryOut],
      ]);
    },
  }),

  Multiplier: defineCombinational({
    name: 'Multiplier',
    description: 'Parameterized n×n bit multiplier, outputs 2n-bit product (default: 8×8=16-bit)',
    category: 'arithmetic',
    icon: '✖️',
    componentType: 'Multiplier',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [{ name: 'product', portType: busType(16) }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;

      const width = (inputs.get('__width') as number) ?? 8;
      const mask = (1 << (width * 2)) - 1;

      const product = (a * b) & mask;

      return new Map([['product', product]]);
    },
  }),

  Comparator: defineCombinational({
    name: 'Comparator',
    description: 'Parameterized n-bit comparator (default: 8-bit)',
    category: 'arithmetic',
    icon: '⚖️',
    componentType: 'Comparator',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [
      { name: 'eq', portType: bitType() },
      { name: 'lt', portType: bitType() },
      { name: 'gt', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;

      return new Map([
        ['eq', a === b],
        ['lt', a < b],
        ['gt', a > b],
      ]);
    },
  }),

  LeftShifter: defineCombinational({
    name: 'LeftShifter',
    description: 'Logical left bit shift (value << n) with zero fill',
    category: 'arithmetic',
    icon: '<<',
    componentType: 'LeftShifter',
    inputs: [
      { name: 'value', portType: busType(8) },
      { name: 'shift', portType: busType(8) },
    ],
    outputs: [{ name: 'result', portType: busType(8) }],
    evaluate: (inputs) => {
      const value = inputs.get('value') as number;
      const shift = inputs.get('shift') as number;
      const width = (inputs.get('__width') as number) ?? 8;

      // Mask for the output width
      const mask = (1 << width) - 1;

      // If shift is >= width, result is 0
      const result = shift >= width ? 0 : (value << shift) & mask;

      return new Map([['result', result]]);
    },
  }),

  RightShifter: defineCombinational({
    name: 'RightShifter',
    description: 'Logical right bit shift (value >> n) with zero fill',
    category: 'arithmetic',
    icon: '>>',
    componentType: 'RightShifter',
    inputs: [
      { name: 'value', portType: busType(8) },
      { name: 'shift', portType: busType(8) },
    ],
    outputs: [{ name: 'result', portType: busType(8) }],
    evaluate: (inputs) => {
      const value = inputs.get('value') as number;
      const shift = inputs.get('shift') as number;
      const width = (inputs.get('__width') as number) ?? 8;

      // If shift is >= width, result is 0
      const result = shift >= width ? 0 : value >>> shift;

      return new Map([['result', result]]);
    },
  }),

  Subtractor: defineCombinational({
    name: 'Subtractor',
    description: 'Parameterized n-bit subtractor with borrow in/out (default: 8-bit)',
    category: 'arithmetic',
    icon: '➖',
    componentType: 'Subtractor',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
      { name: 'borrow_in', portType: bitType() },
    ],
    outputs: [
      { name: 'difference', portType: busType(8) },
      { name: 'borrow_out', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      const borrowIn = (inputs.get('borrow_in') as boolean) ?? false ? 1 : 0;

      const width = (inputs.get('__width') as number) ?? 8;
      const mask = (1 << width) - 1;

      // Calculate result: a - b - borrow_in
      const result = a - b - borrowIn;
      const difference = result & mask;
      const borrowOut = result < 0;

      return new Map<string, boolean | number>([
        ['difference', difference],
        ['borrow_out', borrowOut],
      ]);
    },
  }),

  SignedAdder: defineCombinational({
    name: 'SignedAdder',
    description: 'Signed n-bit adder with overflow detection (default: 8-bit)',
    category: 'arithmetic',
    icon: '±',
    componentType: 'SignedAdder',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
      { name: 'carry_in', portType: bitType() },
    ],
    outputs: [
      { name: 'sum', portType: busType(8) },
      { name: 'overflow', portType: bitType() },
      { name: 'carry_out', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;
      const carryIn = (inputs.get('carry_in') as boolean) ?? false ? 1 : 0;

      const width = (inputs.get('__width') as number) ?? 8;
      const mask = (1 << width) - 1;
      const signBit = 1 << (width - 1);

      // Calculate sum
      const result = a + b + carryIn;
      const sum = result & mask;
      const carryOut = (result >> width) !== 0;

      // Detect signed overflow: overflow when operands have same sign but result has different sign
      const aSign = (a & signBit) !== 0;
      const bSign = (b & signBit) !== 0;
      const sumSign = (sum & signBit) !== 0;
      const overflow = aSign === bSign && aSign !== sumSign;

      return new Map<string, boolean | number>([
        ['sum', sum],
        ['overflow', overflow],
        ['carry_out', carryOut],
      ]);
    },
  }),

  SignedComparator: defineCombinational({
    name: 'SignedComparator',
    description: 'Signed n-bit comparator with all comparison flags (default: 8-bit)',
    category: 'arithmetic',
    icon: '⚖',
    componentType: 'SignedComparator',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [
      { name: 'eq', portType: bitType() },
      { name: 'lt', portType: bitType() },
      { name: 'gt', portType: bitType() },
      { name: 'lte', portType: bitType() },
      { name: 'gte', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;

      const width = (inputs.get('__width') as number) ?? 8;
      const signBit = 1 << (width - 1);
      const maxValue = 1 << width;

      // Convert to signed integers (two's complement)
      const aSigned = (a & signBit) ? a - maxValue : a;
      const bSigned = (b & signBit) ? b - maxValue : b;

      // Perform signed comparisons
      const eq = aSigned === bSigned;
      const lt = aSigned < bSigned;
      const gt = aSigned > bSigned;
      const lte = aSigned <= bSigned;
      const gte = aSigned >= bSigned;

      return new Map([
        ['eq', eq],
        ['lt', lt],
        ['gt', gt],
        ['lte', lte],
        ['gte', gte],
      ]);
    },
  }),

  SignedMultiplier: defineCombinational({
    name: 'SignedMultiplier',
    description: 'Signed n×n bit multiplier, outputs 2n-bit product (default: 8×8=16-bit)',
    category: 'arithmetic',
    icon: '×',
    componentType: 'SignedMultiplier',
    inputs: [
      { name: 'a', portType: busType(8) },
      { name: 'b', portType: busType(8) },
    ],
    outputs: [{ name: 'product', portType: busType(16) }],
    evaluate: (inputs) => {
      const a = inputs.get('a') as number;
      const b = inputs.get('b') as number;

      const width = (inputs.get('__width') as number) ?? 8;
      const signBit = 1 << (width - 1);
      const maxValue = 1 << width;
      const outputMask = (1 << (width * 2)) - 1;

      // Convert to signed integers (two's complement)
      const aSigned = (a & signBit) ? a - maxValue : a;
      const bSigned = (b & signBit) ? b - maxValue : b;

      // Multiply as signed integers
      const productSigned = aSigned * bSigned;

      // Convert back to unsigned representation (handle negative results)
      const product = productSigned >= 0
        ? productSigned
        : (productSigned + (1 << (width * 2))) & outputMask;

      return new Map([['product', product]]);
    },
  }),

  // ============================================================================
  // Plexers (Multiplexers and Decoders)
  // ============================================================================

  Mux: defineCombinational({
    name: 'Mux',
    description: 'Parameterized multiplexer (default: 2-input, 1-bit)',
    category: 'plexers',
    icon: '⊓',
    componentType: 'Mux',
    inputs: [
      { name: 'in0', portType: bitType() },
      { name: 'in1', portType: bitType() },
      { name: 'sel', portType: bitType() },
    ],
    outputs: [{ name: 'out', portType: bitType() }],
    evaluate: (inputs) => {
      const inputCount = (inputs.get('__input_count') as number) ?? 2;
      const width = (inputs.get('__width') as number) ?? 1;
      const selValue = inputs.get('sel');
      const sel = typeof selValue === 'boolean' ? (selValue ? 1 : 0) : (typeof selValue === 'number' ? selValue : 0);

      // Clamp selector to valid range
      const actualSel = Math.max(0, Math.min(Math.floor(sel), inputCount - 1));

      // Get the selected input (type assertion needed because Map values include parameters)
      const value = inputs.get(`in${actualSel}`) as BitValue | BusValue | undefined;

      // Ensure correct type for fallback: Bit=false, Bus=0
      const fallback = (width === 1) ? false : 0;
      const output = value !== undefined ? value : fallback;

      return new Map([['out', output]]);
    },
  }),

  Decoder: defineCombinational({
    name: 'Decoder',
    description: 'Parameterized n-to-2^n decoder (default: 2-to-4)',
    category: 'plexers',
    icon: '⊔',
    componentType: 'Decoder',
    inputs: [{ name: 'in', portType: busType(2) }],
    outputs: [
      { name: 'out0', portType: bitType() },
      { name: 'out1', portType: bitType() },
      { name: 'out2', portType: bitType() },
      { name: 'out3', portType: bitType() },
    ],
    evaluate: (inputs) => {
      const inputWidth = (inputs.get('__input_width') as number) ?? 2;
      const inputValue = inputs.get('in') as number;
      const outputCount = 1 << inputWidth;

      const outputs = new Map<string, boolean | number>();
      for (let i = 0; i < outputCount; i++) {
        outputs.set(`out${i}`, i === inputValue);
      }

      return outputs;
    },
  }),

  // ============================================================================
  // Display Components
  // ============================================================================

  SevenSegment: defineCombinational({
    name: 'SevenSegment',
    description: '7-segment display for hexadecimal digits (0-F)',
    category: 'display',
    icon: '8.',
    componentType: 'SevenSegment',
    inputs: [{ name: 'in', portType: busType(4) }],
    outputs: [],
    evaluate: (_inputs) => {
      // Display component - no outputs
      return new Map();
    },
    createComponent: (id) => {
      const value: number = 0;
      return { id, type: 'SevenSegment', value } as Component;
    },
  }),

  HexDisplay: defineCombinational({
    name: 'HexDisplay',
    description: 'Hexadecimal display for multi-bit values (default: 8-bit)',
    category: 'display',
    icon: '0xFF',
    componentType: 'HexDisplay',
    inputs: [{ name: 'in', portType: busType(8) }],
    outputs: [],
    evaluate: (_inputs) => {
      // Display component - no outputs
      return new Map();
    },
    createComponent: (id) => {
      const value: number = 0;
      const width: number = 8; // Default width
      return { id, type: 'HexDisplay', value, width } as Component;
    },
  }),

  Screen: defineCombinational({
    name: 'Screen',
    description:
      '8x8 pixel display - consumes framebuffer via FrameSnapshotSource (simulates VBLANK burst DMA)',
    category: 'display',
    icon: '🖥️',
    componentType: 'Screen',
    inputs: [{ name: 'dataIn', portType: busType(8) }],
    outputs: [{ name: 'addrB', portType: busType(8) }],
    evaluate: (_inputs, _currentState, _context) => {
      // Screen performs burst DMA - reads all 64 addresses from RAM in one evaluation
      // This simulates a display controller reading the framebuffer during VBLANK
      //
      // In real hardware:
      // - Display refresh happens at 60Hz (16ms period)
      // - During VBLANK (~1ms), display controller burst-reads the framebuffer
      // - Game logic runs at 10Hz (100ms period)
      // - Display shows stable image between refreshes
      //
      // In our simulation:
      // - Screen reads all 64 bytes from RAM each evaluation
      // - The explicit wiring (screen.addrB -> ram.addrB) is kept for documentation
      // - This is architecturally correct: displays DO burst-read memory

      // Dummy output - actual pixel data is stored in context for projection
      // The addrB output exists for circuit diagram clarity but isn't actively scanned
      return new Map([['addrB', 0]]);
    },
    createComponent: (id) => {
      // Memory-mapped display component
      // No value property needed - pixel data comes from RAM via DMA
      return { id, type: 'Screen' } as Component;
    },
    metadata: {
      kind: 'sink', // Sink component - outputs don't feed back into circuit
      consumes: ['FrameSnapshotSource'], // Requires exactly one connected snapshot provider
    },
  }),

  RasterDisplay: defineSequential({
    name: 'RasterDisplay',
    description: 'Hardware-accurate 8×8 raster display with scan counters and sync signals',
    category: 'display',
    icon: '📺',
    componentType: 'RasterDisplay',
    inputs: [{ name: 'dataIn', portType: busType(8) }],
    outputs: [
      { name: 'addrB', portType: busType(8) },
      { name: 'scanX', portType: busType(4) },
      { name: 'scanY', portType: busType(4) },
      { name: 'hblank', portType: bitType() },
      { name: 'vblank', portType: bitType() },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'raster-state',
        name: 'rasterState',
        stateType: { kind: 'memory', addressWidth: 8, dataWidth: 8 },
        initialValue: (() => {
          const initialMap = new Map<number, number>();
          initialMap.set(-1, 0); // scanX = 0
          initialMap.set(-2, 0); // scanY = 0
          return { data: initialMap, addressWidth: 8, dataWidth: 8 };
        })(),
      },
    ],
    evaluate: (inputs, currentState) => {
      // State is stored as Map<number, number>:
      // - Key -1: scanX position (0-9)
      // - Key -2: scanY position (0-9)
      // - Keys 0-63: pixel data
      const state = (currentState ?? new Map()) as Map<number, number>;
      const scanX = state.get(-1) ?? 0;
      const scanY = state.get(-2) ?? 0;

      // Calculate outputs
      const addr = scanY < 8 && scanX < 8 ? scanY * 8 + scanX : 0;
      const hblank = scanX >= 8;
      const vblank = scanY >= 8;

      return new Map<string, boolean | number>([
        ['addrB', addr],
        ['scanX', scanX],
        ['scanY', scanY],
        ['hblank', hblank],
        ['vblank', vblank],
      ]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      if (clockEdges['clk'] !== 'rising') {
        return currentState;
      }

      // Extract current state from Map
      const state = (currentState ?? new Map()) as Map<number, number>;
      let scanX = state.get(-1) ?? 0;
      let scanY = state.get(-2) ?? 0;

      // Capture pixel data during active scan
      const dataIn = (inputs.get('dataIn') as number) ?? 0;
      const newState = new Map(state); // Clone to avoid mutation

      if (scanX < 8 && scanY < 8) {
        const addr = scanY * 8 + scanX;
        newState.set(addr, dataIn);
      }

      // Increment scan position
      scanX++;
      if (scanX >= 10) {
        // 8 visible + 2 HBLANK
        scanX = 0;
        scanY++;
        if (scanY >= 10) {
          // 8 visible + 2 VBLANK
          scanY = 0; // Frame wrap
        }
      }

      // Store scan position in special keys
      newState.set(-1, scanX);
      newState.set(-2, scanY);

      return newState;
    },
    createComponent: (id) => {
      const addressWidth: number = 8;
      const dataWidth: number = 8;
      const memory = new Map<number, number>();
      memory.set(-1, 0); // scanX = 0
      memory.set(-2, 0); // scanY = 0
      return {
        id,
        type: 'RasterDisplay',
        addressWidth,
        dataWidth,
        memory,
      } as Component;
    },
    outputDependency: 'state-only', // Outputs (addrB, scanX, scanY) come from state, not inputs
  }),

  // ============================================================================
  // Sequential Components (Stateful)
  // ============================================================================

  DFlipFlop: defineSequential({
    name: 'DFlipFlop',
    description: 'D Flip-Flop - stores 1 bit of state, updates on rising clock edge',
    category: 'sequential',
    icon: 'D',
    componentType: 'D_FLIP_FLOP',
    inputs: [{ name: 'd', portType: bitType() }],
    outputs: [
      { name: 'q', portType: bitType() },
      { name: 'q_bar', portType: bitType() },
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'dff-state',
        name: 'value',
        stateType: bitType(),
        initialValue: false,
      },
    ],
    evaluate: (_inputs, currentState) => {
      const state = (currentState ?? false) as boolean;
      return new Map([
        ['q', state],
        ['q_bar', !state],
      ]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      const d = inputs.get('d') as boolean;
      const edge = clockEdges['clk'] ?? 'none';

      // Update state on rising edge
      if (edge === 'rising') {
        return d;
      }

      // Otherwise, keep current state
      return currentState;
    },
    createComponent: (id, initialValue) => {
      const state: boolean = typeof initialValue === 'boolean' ? initialValue : false;
      return { id, type: 'DFlipFlop', state } as Component;
    },
    outputDependency: 'state-only', // Q outputs come from stored state, not D input
  }),

  Register: defineSequential({
    name: 'Register',
    description: '8-bit Register - stores data on rising clock edge when write enable is high',
    category: 'sequential',
    icon: 'REG',
    componentType: 'REGISTER',
    inputs: [
      { name: 'data', portType: busType(8) },
      { name: 'we', portType: bitType() },
    ],
    outputs: [{ name: 'q', portType: busType(8) }],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'reg-state',
        name: 'value',
        stateType: busType(8),
        initialValue: 0,
      },
    ],
    evaluate: (_inputs, currentState) => {
      // Ensure state is always a number (defensive against type corruption)
      const state = typeof currentState === 'number' ? currentState : 0;
      return new Map([['q', state]]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      // Handle both number and boolean data values (for Bit vs Bus ports)
      const rawData = inputs.get('data');
      const data = typeof rawData === 'number' ? rawData : (rawData ? 1 : 0);
      const we = inputs.get('we'); // Truthy check works for both boolean and number
      const edge = clockEdges['clk'] ?? 'none';

      // Update state on rising edge when write enable is high
      if (edge === 'rising' && we) {
        return data;
      }

      // Otherwise, keep current state (ensure it's a number)
      return typeof currentState === 'number' ? currentState : 0;
    },
    createComponent: (id, initialValue) => {
      const width: number = 8; // Default width
      const state: number = typeof initialValue === 'number' ? initialValue : 0;
      return { id, type: 'Register', width, state } as Component;
    },
    outputDependency: 'state-only', // Q output comes from stored state, not data input
  }),

  // ============================================================================
  // Memory Components
  // ============================================================================

  ROM: defineSequential({
    name: 'ROM',
    description: 'Read-only memory with data initialization (default: 256×8). Use data=[...] for dense or data={addr: val, ...} for sparse initialization.',
    category: 'memory',
    icon: '📀',
    componentType: 'ROM',
    inputs: [{ name: 'addr', portType: busType(8) }],
    outputs: [{ name: 'data_out', portType: busType(8) }],
    clocks: [],
    state: [
      {
        id: 'rom-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 8, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 8, dataWidth: 8 },
      },
    ],
    evaluate: (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addr = inputs.get('addr') as number;
      const data = memory.get(addr) ?? 0;

      return new Map([['data_out', data]]);
    },
    updateState: (_inputs, currentState, _clockEdges) => {
      // ROM is read-only, state never changes
      return currentState;
    },
    createComponent: (id) => {
      const addressWidth: number = 8;
      const dataWidth: number = 8;
      const memory: Map<number, number> = new Map();
      return { id, type: 'ROM', addressWidth, dataWidth, memory } as Component;
    },
  }),

  RAM: defineSequential({
    name: 'RAM',
    description:
      '256x8 RAM - reads are combinational, writes occur on rising clock edge with write enable',
    category: 'memory',
    icon: '💾',
    componentType: 'RAM',
    inputs: [
      { name: 'addr', portType: busType(8) },
      { name: 'data_in', portType: busType(8) },
      { name: 'we', portType: bitType() },
    ],
    outputs: [{ name: 'data_out', portType: busType(8) }],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'ram-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 8, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 8, dataWidth: 8 },
      },
    ],
    evaluate: (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addr = inputs.get('addr') as number;
      const data = memory.get(addr) ?? 0;
      return new Map([['data_out', data]]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addr = inputs.get('addr') as number;
      const dataIn = inputs.get('data_in') as number;
      const we = inputs.get('we') as boolean;
      const edge = clockEdges['clk'] ?? 'none';

      // Write on rising edge with write enable
      if (edge === 'rising' && we) {
        // Create a new Map to avoid mutation
        const newMemory = new Map(memory);
        newMemory.set(addr, dataIn);
        return newMemory;
      }

      // Otherwise, keep current memory
      return memory;
    },
    createComponent: (id) => {
      const addressWidth: number = 8;
      const dataWidth: number = 8;
      const memory: Map<number, number> = new Map();
      return { id, type: 'RAM', addressWidth, dataWidth, memory } as Component;
    },
  }),

  DualPortRAM: defineSequential({
    name: 'DualPortRAM',
    description:
      '256x8 Dual-Port RAM - Both ports read combinationally. Port A writes on clock edge with write enable. Port B is read-only. Provides framebuffer snapshots.',
    category: 'memory',
    icon: '💾²',
    componentType: 'DualPortRAM',
    inputs: [
      { name: 'addrA', portType: busType(8) }, // Port A address (write/read port)
      { name: 'dataA', portType: busType(8) }, // Port A data input (for writes)
      { name: 'weA', portType: bitType() }, // Port A write enable
      { name: 'addrB', portType: busType(8) }, // Port B address (read port)
    ],
    outputs: [
      { name: 'dataA', portType: busType(8) }, // Port A data output (for reads)
      { name: 'dataB', portType: busType(8) }, // Port B data output
    ],
    clocks: [{ name: 'clk' }],
    state: [
      {
        id: 'dualram-state',
        name: 'memory',
        stateType: { kind: 'memory', addressWidth: 8, dataWidth: 8 },
        initialValue: { data: new Map(), addressWidth: 8, dataWidth: 8 },
      },
    ],
    evaluate: (inputs, currentState) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addrA = inputs.get('addrA') as number;
      const addrB = inputs.get('addrB') as number;
      const dataA = memory.get(addrA) ?? 0;
      const dataB = memory.get(addrB) ?? 0;
      return new Map([
        ['dataA', dataA],
        ['dataB', dataB],
      ]);
    },
    updateState: (inputs, currentState, clockEdges) => {
      const memory = (currentState ?? new Map()) as Map<number, number>;
      const addrA = inputs.get('addrA') as number;
      const dataA = inputs.get('dataA') as number;
      const weA = inputs.get('weA') as boolean;
      const edge = clockEdges['clk'] ?? 'none';

      // Port A: Write on rising edge with write enable
      if (edge === 'rising' && weA) {
        // Create a new Map to avoid mutation
        const newMemory = new Map(memory);
        newMemory.set(addrA, dataA);
        return newMemory;
      }

      // Otherwise, keep current memory
      return memory;
    },
    createComponent: (id) => {
      const addressWidth: number = 8;
      const dataWidth: number = 8;
      const memory: Map<number, number> = new Map();
      return { id, type: 'DualPortRAM', addressWidth, dataWidth, memory } as Component;
    },
    metadata: {
      provides: ['FrameSnapshotSource'], // Implements burst DMA snapshot interface
    },
  }),
};

// ============================================================================
// Auto-Generated Exports
// ============================================================================

/**
 * Generate Circuit IR definitions from primitive definitions
 *
 * Converts the co-located definitions into the Circuit[] array
 * that the simulator expects.
 *
 * @param defs - Primitive definitions
 * @returns Array of Circuit IR definitions
 */
export function generatePrimitives(defs: Record<string, PrimitiveDefinition>): Circuit[] {
  return Object.values(defs).map((def) => ({
    id: `primitive:${def.name}`,
    name: def.name,
    parameters: def.parameters ?? [],
    inputs: def.inputs,
    outputs: def.outputs,
    clocks: def.clocks ?? [],
    state: def.state ?? [],
    nodes: [],
    connections: [],
    implementation: { kind: 'primitive' as const },
    metadata: {
      description: def.description,
      ...def.metadata,
      outputDependency: def.outputDependency,
    },
  }));
}

/**
 * Generate evaluator registry from primitive definitions
 *
 * Creates the Record<string, PrimitiveEvaluator> that the simulator
 * uses to look up evaluation logic.
 *
 * @param defs - Primitive definitions
 * @returns Evaluator registry (name -> evaluator)
 */
export function generateEvaluators(
  defs: Record<string, PrimitiveDefinition>
): Record<string, PrimitiveEvaluator> {
  return Object.fromEntries(
    Object.entries(defs).map(([name, def]) => [name, def.evaluator])
  );
}

/**
 * Generate UI metadata from primitive definitions
 *
 * Creates the Record<string, PrimitiveMetadata> for the component palette.
 *
 * @param defs - Primitive definitions
 * @returns Metadata registry (name -> metadata)
 */
export function generateMetadata(
  defs: Record<string, PrimitiveDefinition>
): Record<string, { category: string; icon: string; componentType: ComponentType }> {
  return Object.fromEntries(
    Object.entries(defs).map(([name, def]) => [
      name,
      {
        category: def.category,
        icon: def.icon,
        componentType: def.componentType,
      },
    ])
  );
}

/**
 * Generate component creator function from primitive definitions
 *
 * Replaces the giant switch statement in createPrimitiveComponent().
 * Each primitive's createComponent function handles its own initialization.
 *
 * @param defs - Primitive definitions
 * @returns Function that creates components by type
 */
export function generateCreator(
  defs: Record<string, PrimitiveDefinition>
): (id: string, type: string, initialValue?: boolean | number) => Component | null {
  return (id: string, type: string, initialValue?: boolean | number) => {
    const def = defs[type];
    if (!def) {
      return null;
    }
    return def.createComponent(id, initialValue);
  };
}

/**
 * Primitive evaluator registry (auto-generated)
 *
 * This registry is automatically generated from PRIMITIVE_DEFINITIONS.
 * To add a new primitive evaluator, add it to PRIMITIVE_DEFINITIONS above.
 */
export const PRIMITIVE_EVALUATORS: Record<string, PrimitiveEvaluator> =
  generateEvaluators(PRIMITIVE_DEFINITIONS);

/**
 * Primitive circuit IR definitions (auto-generated)
 *
 * This array is automatically generated from PRIMITIVE_DEFINITIONS.
 * To add a new primitive circuit, add it to PRIMITIVE_DEFINITIONS above.
 */
export const PRIMITIVES: Circuit[] = generatePrimitives(PRIMITIVE_DEFINITIONS);

/**
 * Create initial component state for a primitive (auto-generated)
 *
 * This function is automatically generated from PRIMITIVE_DEFINITIONS.
 * Each primitive's createComponent function handles its own initialization.
 *
 * @param id - Unique component identifier
 * @param type - Component type name (must match a name in PRIMITIVE_DEFINITIONS)
 * @param initialValue - Optional initial value for input/stateful components
 * @returns Component object with proper initial state, or null if type is unknown
 */
export const createPrimitiveComponent = generateCreator(PRIMITIVE_DEFINITIONS);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all primitive circuits
 */
export function getPrimitives(): Circuit[] {
  return PRIMITIVES;
}

/**
 * Get primitive evaluator by name
 */
export function getPrimitiveEvaluator(name: string): PrimitiveEvaluator | undefined {
  return PRIMITIVE_EVALUATORS[name];
}

/**
 * Check if a component is a primitive
 */
export function isPrimitive(name: string): boolean {
  return name in PRIMITIVE_DEFINITIONS;
}

/**
 * Get primitive circuit definition by name
 */
export function getPrimitiveCircuit(name: string): Circuit | undefined {
  return PRIMITIVES.find((p) => p.name === name);
}
