/**
 * Primitive Component Metadata
 *
 * Provides UI metadata (icons, categories) for primitive components.
 * This is separate from the primitive definitions to maintain clean separation
 * between structural definitions (primitives.ts) and UI presentation.
 */

import type { ComponentType } from '../types';

export interface PrimitiveMetadata {
  category: string;
  icon: string;
  componentType: ComponentType; // Maps to the actual ComponentType enum value
}

/**
 * Category definitions for organizing primitives in the UI
 */
export const PRIMITIVE_CATEGORIES = {
  LOGIC_GATES: 'logic-gates',
  ARITHMETIC: 'arithmetic',
  PLEXERS: 'plexers',
  SEQUENTIAL: 'sequential',
  MEMORY: 'memory',
  UTILITIES: 'utilities',
  IO: 'input-output',
  BUS_OPS: 'bus-operations',
  DISPLAY: 'display',
} as const;

/**
 * Category display information
 */
export const CATEGORY_INFO: Record<string, { label: string; icon: string; description: string }> = {
  [PRIMITIVE_CATEGORIES.IO]: {
    label: 'Input/Output',
    icon: '⚡',
    description: 'User controls and basic I/O',
  },
  [PRIMITIVE_CATEGORIES.LOGIC_GATES]: {
    label: 'Logic Gates',
    icon: '&',
    description: 'Basic and advanced logic operations',
  },
  [PRIMITIVE_CATEGORIES.ARITHMETIC]: {
    label: 'Arithmetic',
    icon: '➕',
    description: 'Mathematical operations',
  },
  [PRIMITIVE_CATEGORIES.PLEXERS]: {
    label: 'Plexers',
    icon: '⊓',
    description: 'Multiplexers and decoders',
  },
  [PRIMITIVE_CATEGORIES.SEQUENTIAL]: {
    label: 'Sequential',
    icon: '⏱',
    description: 'State storage and clocked logic',
  },
  [PRIMITIVE_CATEGORIES.MEMORY]: {
    label: 'Memory',
    icon: '💾',
    description: 'Memory storage components',
  },
  [PRIMITIVE_CATEGORIES.BUS_OPS]: {
    label: 'Bus Operations',
    icon: '📊',
    description: 'Multi-bit bus operations',
  },
  [PRIMITIVE_CATEGORIES.UTILITIES]: {
    label: 'Utilities',
    icon: '🔧',
    description: 'Helper components',
  },
  [PRIMITIVE_CATEGORIES.DISPLAY]: {
    label: 'Display',
    icon: '🖥',
    description: 'Visual display components',
  },
};

/**
 * Metadata mapping for all primitive components
 * Maps primitive name (from primitives.ts) to UI metadata and ComponentType
 */
export const PRIMITIVE_METADATA: Record<string, PrimitiveMetadata> = {
  // Logic Gates
  And: { category: PRIMITIVE_CATEGORIES.LOGIC_GATES, icon: '&', componentType: 'AND_GATE' },
  Or: { category: PRIMITIVE_CATEGORIES.LOGIC_GATES, icon: '≥1', componentType: 'OR_GATE' },
  Not: { category: PRIMITIVE_CATEGORIES.LOGIC_GATES, icon: '¬', componentType: 'NOT_GATE' },
  Nand: { category: PRIMITIVE_CATEGORIES.LOGIC_GATES, icon: '⊼', componentType: 'NAND_GATE' },
  Nor: { category: PRIMITIVE_CATEGORIES.LOGIC_GATES, icon: '⊽', componentType: 'NOR_GATE' },
  Xor: { category: PRIMITIVE_CATEGORIES.LOGIC_GATES, icon: '⊕', componentType: 'XOR_GATE' },
  Xnor: { category: PRIMITIVE_CATEGORIES.LOGIC_GATES, icon: '⊙', componentType: 'XNOR_GATE' },
  Buffer: { category: PRIMITIVE_CATEGORIES.LOGIC_GATES, icon: '▷', componentType: 'BUFFER' },

  // I/O Components
  Switch: { category: PRIMITIVE_CATEGORIES.IO, icon: '⚡', componentType: 'SWITCH' },
  Led: { category: PRIMITIVE_CATEGORIES.IO, icon: '💡', componentType: 'LED' },
  Button: { category: PRIMITIVE_CATEGORIES.IO, icon: '🔘', componentType: 'Button' },
  Input: { category: PRIMITIVE_CATEGORIES.IO, icon: '🔢', componentType: 'INPUT' },

  // Bus Operations (these use primitive names as ComponentType since they're not in PrimitiveComponentType enum)
  BusAnd: { category: PRIMITIVE_CATEGORIES.BUS_OPS, icon: '&8', componentType: 'BusAnd' },
  BusOr: { category: PRIMITIVE_CATEGORIES.BUS_OPS, icon: '|8', componentType: 'BusOr' },
  BusNot: { category: PRIMITIVE_CATEGORIES.BUS_OPS, icon: '¬8', componentType: 'BusNot' },
  BusXor: { category: PRIMITIVE_CATEGORIES.BUS_OPS, icon: '⊕8', componentType: 'BusXor' },

  // Arithmetic (using primitive names as ComponentType)
  Adder: { category: PRIMITIVE_CATEGORIES.ARITHMETIC, icon: '➕', componentType: 'Adder' },
  Multiplier: { category: PRIMITIVE_CATEGORIES.ARITHMETIC, icon: '✖️', componentType: 'Multiplier' },
  Comparator: { category: PRIMITIVE_CATEGORIES.ARITHMETIC, icon: '⚖️', componentType: 'Comparator' },

  // Plexers (using primitive names as ComponentType)
  Mux: { category: PRIMITIVE_CATEGORIES.PLEXERS, icon: '⊓', componentType: 'Mux' },
  Decoder: { category: PRIMITIVE_CATEGORIES.PLEXERS, icon: '⊔', componentType: 'Decoder' },

  // Sequential Components
  DFlipFlop: { category: PRIMITIVE_CATEGORIES.SEQUENTIAL, icon: 'D', componentType: 'D_FLIP_FLOP' },
  Register: { category: PRIMITIVE_CATEGORIES.SEQUENTIAL, icon: 'REG', componentType: 'REGISTER' },

  // Memory
  RAM: { category: PRIMITIVE_CATEGORIES.MEMORY, icon: '💾', componentType: 'RAM' },
  ROM: { category: PRIMITIVE_CATEGORIES.MEMORY, icon: '📀', componentType: 'ROM' },

  // Utilities (using primitive names as ComponentType)
  Constant: { category: PRIMITIVE_CATEGORIES.UTILITIES, icon: 'K', componentType: 'Constant' },
  Splitter: { category: PRIMITIVE_CATEGORIES.UTILITIES, icon: '⊢', componentType: 'Splitter' },
  Splitter8to8: { category: PRIMITIVE_CATEGORIES.UTILITIES, icon: '⊢8', componentType: 'Splitter8to8' },
  Probe: { category: PRIMITIVE_CATEGORIES.UTILITIES, icon: '🔍', componentType: 'Probe' },

  // Display Components (using primitive names as ComponentType)
  SevenSegment: { category: PRIMITIVE_CATEGORIES.DISPLAY, icon: '8.', componentType: 'SevenSegment' },
  HexDisplay: { category: PRIMITIVE_CATEGORIES.DISPLAY, icon: '0xFF', componentType: 'HexDisplay' },
};

/**
 * Get metadata for a primitive component
 */
export function getPrimitiveMetadata(name: string): PrimitiveMetadata | undefined {
  return PRIMITIVE_METADATA[name];
}

/**
 * Get all primitives grouped by category
 */
export function getPrimitivesByCategory(): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const [name, metadata] of Object.entries(PRIMITIVE_METADATA)) {
    const category = metadata.category;
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(name);
  }

  return grouped;
}
