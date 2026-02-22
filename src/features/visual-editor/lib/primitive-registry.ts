/**
 * Primitive Registry — UI Extension Layer
 *
 * Imports core primitive definitions (evaluators, ports, parameters, state)
 * from @/core/simulator and extends them with UI-specific metadata:
 * - category, icon, componentType (palette presentation)
 * - createComponent (runtime component instantiation)
 * - environmental state hooks (time-travel debugging)
 *
 * The core module owns circuit structure and behavior.
 * This module owns presentation and component lifecycle.
 *
 * @see core/simulator/primitives.ts — Single source of truth for evaluators
 */

import type { Circuit, Node } from '../types/circuit';
import type { Component, ComponentType } from '../types';
import {
  PRIMITIVE_DEFINITIONS as CORE_DEFINITIONS,
  type CorePrimitiveDefinition,
  type PrimitiveEvaluator,
  generatePrimitives as coreGeneratePrimitives,
  generateEvaluators as coreGenerateEvaluators,
} from '@/core/simulator';
import type { EnvironmentalStateValue } from '../types/simulation-snapshot';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * UI-specific extension fields layered on top of CorePrimitiveDefinition.
 * These fields have no effect on simulation — they control presentation and lifecycle.
 */
export interface PrimitiveUIExtension {
  /** Category for component palette organization */
  category: string;
  /** Display icon (emoji or unicode symbol) */
  icon: string;
  /** ComponentType identifier for legacy compatibility */
  componentType: ComponentType;

  /**
   * Create a component instance with proper initial state.
   * Encapsulates component-specific initialization logic.
   */
  createComponent: (id: string, initialValue?: boolean | number) => Component;

  /** Optional metadata for special component types (sinks, DMA providers, etc.) */
  metadata?: PrimitiveSpecialMetadata;

  /** Does this component have environmental state? (user inputs, sensors, RNG) */
  hasEnvironmentalState?: boolean;
  /** Capture environmental state from a node (must return cloneable value) */
  captureEnvironmentalState?: (node: Node) => EnvironmentalStateValue;
  /** Restore environmental state to a node (must be idempotent) */
  restoreEnvironmentalState?: (node: Node, state: EnvironmentalStateValue) => void;
}

/** Special metadata for primitives with unique behavior */
interface PrimitiveSpecialMetadata {
  kind?: 'sink';
  provides?: string[];
  consumes?: string[];
}

/**
 * Complete primitive definition = core definition + UI extension.
 * TS enforces that UI fields are clearly separated from core logic.
 */
export type PrimitiveDefinition = CorePrimitiveDefinition & PrimitiveUIExtension;

// ============================================================================
// UI Extensions (presentation + lifecycle only, zero evaluator logic)
// ============================================================================

const UI_EXTENSIONS: Record<string, PrimitiveUIExtension> = {
  // === Logic Gates ===
  And: { category: 'logic-gates', icon: '&', componentType: 'AND_GATE', createComponent: (id) => ({ id, type: 'And' } as Component) },
  Or: { category: 'logic-gates', icon: '≥1', componentType: 'OR_GATE', createComponent: (id) => ({ id, type: 'Or' } as Component) },
  Not: { category: 'logic-gates', icon: '¬', componentType: 'NOT_GATE', createComponent: (id) => ({ id, type: 'Not' } as Component) },
  Nand: { category: 'logic-gates', icon: '⊼', componentType: 'NAND_GATE', createComponent: (id) => ({ id, type: 'Nand' } as Component) },
  Nor: { category: 'logic-gates', icon: '⊽', componentType: 'NOR_GATE', createComponent: (id) => ({ id, type: 'Nor' } as Component) },
  Xor: { category: 'logic-gates', icon: '⊕', componentType: 'XOR_GATE', createComponent: (id) => ({ id, type: 'Xor' } as Component) },
  Xnor: { category: 'logic-gates', icon: '⊙', componentType: 'XNOR_GATE', createComponent: (id) => ({ id, type: 'Xnor' } as Component) },
  Buffer: { category: 'logic-gates', icon: '▷', componentType: 'BUFFER', createComponent: (id) => ({ id, type: 'Buffer' } as Component) },

  // === I/O Components ===
  Switch: {
    category: 'input-output', icon: '⚡', componentType: 'SWITCH',
    createComponent: (id, initialValue) => ({ id, type: 'Switch', value: typeof initialValue === 'boolean' ? initialValue : false } as Component),
    hasEnvironmentalState: true,
    captureEnvironmentalState: (node: Node) => node.arguments.value as boolean,
    restoreEnvironmentalState: (node: Node, state: EnvironmentalStateValue) => { node.arguments.value = state as boolean; },
  },
  Led: { category: 'input-output', icon: '💡', componentType: 'LED', createComponent: (id) => ({ id, type: 'Led', value: false } as Component) },
  Output: { category: 'input-output', icon: '📤', componentType: 'OUTPUT', createComponent: (id) => ({ id, type: 'Output', value: 0 } as Component) },
  Button: {
    category: 'input-output', icon: '🔘', componentType: 'Button',
    createComponent: (id, initialValue) => ({ id, type: 'Button', value: typeof initialValue === 'boolean' ? initialValue : false } as Component),
    hasEnvironmentalState: true,
    captureEnvironmentalState: (node: Node) => node.arguments.value as boolean,
    restoreEnvironmentalState: (node: Node, state: EnvironmentalStateValue) => { node.arguments.value = state as boolean; },
  },
  Input: {
    category: 'input-output', icon: '🔢', componentType: 'INPUT',
    createComponent: (id, initialValue) => ({ id, type: 'Input', value: typeof initialValue === 'number' ? initialValue : 0, width: 8 } as Component),
    hasEnvironmentalState: true,
    captureEnvironmentalState: (node: Node) => node.arguments.value as number,
    restoreEnvironmentalState: (node: Node, state: EnvironmentalStateValue) => { node.arguments.value = state as number; },
  },

  // === Utilities ===
  Constant: {
    category: 'utilities', icon: 'K', componentType: 'Constant',
    createComponent: (id, initialValue) => ({ id, type: 'Constant', value: initialValue ?? 0 } as Component),
  },
  Splitter: { category: 'utilities', icon: '⊢', componentType: 'Splitter', createComponent: (id) => ({ id, type: 'Splitter' } as Component) },
  Splitter8to8: { category: 'utilities', icon: '⊢8', componentType: 'Splitter8to8', createComponent: (id) => ({ id, type: 'Splitter8to8' } as Component) },
  Combiner8to8: { category: 'utilities', icon: '⊣8', componentType: 'Combiner8to8', createComponent: (id) => ({ id, type: 'Combiner8to8' } as Component) },
  Probe: { category: 'utilities', icon: '🔍', componentType: 'Probe', createComponent: (id) => ({ id, type: 'Probe' } as Component) },
  BitSlice: { category: 'utilities', icon: '[]', componentType: 'BitSlice', createComponent: (id) => ({ id, type: 'BitSlice' } as Component) },
  AddressCombiner: { category: 'utilities', icon: '⊕16', componentType: 'AddressCombiner', createComponent: (id) => ({ id, type: 'AddressCombiner' } as Component) },

  // === Bus Operations ===
  BusAnd: { category: 'bus-operations', icon: '&8', componentType: 'BusAnd', createComponent: (id) => ({ id, type: 'BusAnd' } as Component) },
  BusOr: { category: 'bus-operations', icon: '|8', componentType: 'BusOr', createComponent: (id) => ({ id, type: 'BusOr' } as Component) },
  BusNot: { category: 'bus-operations', icon: '¬8', componentType: 'BusNot', createComponent: (id) => ({ id, type: 'BusNot' } as Component) },
  BusXor: { category: 'bus-operations', icon: '⊕8', componentType: 'BusXor', createComponent: (id) => ({ id, type: 'BusXor' } as Component) },

  // === Arithmetic ===
  Incrementer: { category: 'arithmetic', icon: '+1', componentType: 'Incrementer', createComponent: (id) => ({ id, type: 'Incrementer' } as Component) },
  Adder: { category: 'arithmetic', icon: '➕', componentType: 'Adder', createComponent: (id) => ({ id, type: 'Adder' } as Component) },
  Multiplier: { category: 'arithmetic', icon: '✖️', componentType: 'Multiplier', createComponent: (id) => ({ id, type: 'Multiplier' } as Component) },
  Comparator: { category: 'arithmetic', icon: '⚖️', componentType: 'Comparator', createComponent: (id) => ({ id, type: 'Comparator' } as Component) },
  LeftShifter: { category: 'arithmetic', icon: '<<', componentType: 'LeftShifter', createComponent: (id) => ({ id, type: 'LeftShifter' } as Component) },
  RightShifter: { category: 'arithmetic', icon: '>>', componentType: 'RightShifter', createComponent: (id) => ({ id, type: 'RightShifter' } as Component) },
  Subtractor: { category: 'arithmetic', icon: '➖', componentType: 'Subtractor', createComponent: (id) => ({ id, type: 'Subtractor' } as Component) },
  SignedAdder: { category: 'arithmetic', icon: '±', componentType: 'SignedAdder', createComponent: (id) => ({ id, type: 'SignedAdder' } as Component) },
  SignedComparator: { category: 'arithmetic', icon: '⚖', componentType: 'SignedComparator', createComponent: (id) => ({ id, type: 'SignedComparator' } as Component) },
  SignedMultiplier: { category: 'arithmetic', icon: '×', componentType: 'SignedMultiplier', createComponent: (id) => ({ id, type: 'SignedMultiplier' } as Component) },

  // === Plexers ===
  Mux: { category: 'plexers', icon: '⊓', componentType: 'Mux', createComponent: (id) => ({ id, type: 'Mux' } as Component) },
  Decoder: { category: 'plexers', icon: '⊔', componentType: 'Decoder', createComponent: (id) => ({ id, type: 'Decoder' } as Component) },

  // === Display ===
  SevenSegment: { category: 'display', icon: '8.', componentType: 'SevenSegment', createComponent: (id) => ({ id, type: 'SevenSegment', value: 0 } as Component) },
  HexDisplay: { category: 'display', icon: '0xFF', componentType: 'HexDisplay', createComponent: (id) => ({ id, type: 'HexDisplay', value: 0, width: 8 } as Component) },
  Screen: {
    category: 'display', icon: '🖥️', componentType: 'Screen',
    createComponent: (id) => ({ id, type: 'Screen' } as Component),
    metadata: { kind: 'sink', consumes: ['FrameSnapshotSource'] },
  },
  RasterDisplay: {
    category: 'display', icon: '📺', componentType: 'RasterDisplay',
    createComponent: (id) => {
      const memory = new Map<number, number>();
      memory.set(-1, 0); // scanX = 0
      memory.set(-2, 0); // scanY = 0
      return { id, type: 'RasterDisplay', addressWidth: 8, dataWidth: 8, memory } as Component;
    },
  },

  // === Sequential ===
  DFlipFlop: {
    category: 'sequential', icon: 'D', componentType: 'D_FLIP_FLOP',
    createComponent: (id, initialValue) => ({ id, type: 'DFlipFlop', state: typeof initialValue === 'boolean' ? initialValue : false } as Component),
  },
  Register: {
    category: 'sequential', icon: 'REG', componentType: 'REGISTER',
    createComponent: (id, initialValue) => ({ id, type: 'Register', width: 8, state: typeof initialValue === 'number' ? initialValue : 0 } as Component),
  },

  // === Memory ===
  ROM: {
    category: 'memory', icon: '📀', componentType: 'ROM',
    createComponent: (id) => ({ id, type: 'ROM', addressWidth: 16, dataWidth: 8, memory: new Map() } as Component),
  },
  RAM: {
    category: 'memory', icon: '💾', componentType: 'RAM',
    createComponent: (id) => ({ id, type: 'RAM', addressWidth: 8, dataWidth: 8, memory: new Map() } as Component),
  },
  DualPortRAM: {
    category: 'memory', icon: '💾²', componentType: 'DualPortRAM',
    createComponent: (id) => ({ id, type: 'DualPortRAM', addressWidth: 8, dataWidth: 8, memory: new Map() } as Component),
    metadata: { provides: ['FrameSnapshotSource'] },
  },

  // === I/O Devices ===
  Console: {
    category: 'io', icon: '📺', componentType: 'Console',
    createComponent: (id) => ({ id, type: 'Console', text: '' } as Component),
  },
};

// ============================================================================
// Merged Definitions
// ============================================================================

/**
 * Build merged PRIMITIVE_DEFINITIONS by combining core + UI extensions.
 * Validates that every core primitive has a UI extension (and vice versa).
 */
function buildMergedDefinitions(): Record<string, PrimitiveDefinition> {
  const merged: Record<string, PrimitiveDefinition> = {};

  for (const [name, coreDef] of Object.entries(CORE_DEFINITIONS)) {
    const ui = UI_EXTENSIONS[name];
    if (!ui) {
      throw new Error(
        `Primitive "${name}" defined in core but missing UI extension in primitive-registry.ts`
      );
    }
    merged[name] = { ...coreDef, ...ui };
  }

  // Warn about UI extensions without core definitions
  for (const name of Object.keys(UI_EXTENSIONS)) {
    if (!(name in CORE_DEFINITIONS)) {
      throw new Error(
        `UI extension "${name}" defined in primitive-registry.ts but missing core definition`
      );
    }
  }

  return merged;
}

/**
 * All primitive definitions — core logic merged with UI metadata.
 *
 * To add a new primitive:
 * 1. Add the core definition (ports, evaluator, state) in core/simulator/primitives.ts
 * 2. Add the UI extension (icon, category, createComponent) here
 */
export const PRIMITIVE_DEFINITIONS: Record<string, PrimitiveDefinition> =
  buildMergedDefinitions();

// ============================================================================
// Generated Exports (delegated to core where possible)
// ============================================================================

/** Primitive circuit IR definitions (from core) */
export const PRIMITIVES: Circuit[] = coreGeneratePrimitives(CORE_DEFINITIONS);

/** Primitive evaluator registry (from core) */
export const PRIMITIVE_EVALUATORS: Record<string, PrimitiveEvaluator> =
  coreGenerateEvaluators(CORE_DEFINITIONS);

/**
 * Generate UI metadata from primitive definitions.
 * Used by the component palette.
 */
export function generateMetadata(
  defs: Record<string, PrimitiveDefinition>
): Record<string, { category: string; icon: string; componentType: ComponentType }> {
  return Object.fromEntries(
    Object.entries(defs).map(([name, def]) => [
      name,
      { category: def.category, icon: def.icon, componentType: def.componentType },
    ])
  );
}

/**
 * Create a component instance by type name.
 * Replaces the old giant switch statement.
 */
export const createPrimitiveComponent = (
  id: string,
  type: string,
  initialValue?: boolean | number
): Component | null => {
  const def = PRIMITIVE_DEFINITIONS[type];
  return def ? def.createComponent(id, initialValue) : null;
};

// ============================================================================
// Helper Functions (re-export core helpers for backward compatibility)
// ============================================================================

export { generatePrimitives } from '@/core/simulator';

/** Get all primitive circuits */
export function getPrimitives(): Circuit[] {
  return PRIMITIVES;
}

/** Get primitive evaluator by name */
export function getPrimitiveEvaluator(name: string): PrimitiveEvaluator | undefined {
  return PRIMITIVE_EVALUATORS[name];
}

/** Check if a component is a primitive */
export function isPrimitive(name: string): boolean {
  return name in PRIMITIVE_DEFINITIONS;
}

/** Get primitive circuit definition by name */
export function getPrimitiveCircuit(name: string): Circuit | undefined {
  return PRIMITIVES.find((p) => p.name === name);
}
