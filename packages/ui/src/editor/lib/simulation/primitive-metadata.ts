/**
 * Primitive Component Metadata
 *
 * Provides UI metadata (icons, categories) for primitive components.
 *
 * This file now exports metadata auto-generated from primitives.ts.
 * All metadata is defined alongside the primitives in a single source of truth.
 *
 * @see primitives.ts - The single source of truth for all primitives
 */

import { PRIMITIVE_DEFINITIONS, generateMetadata } from '../primitive-registry';

export interface PrimitiveMetadata {
  category: string;
  icon: string;
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
 * Metadata mapping for all primitive components (auto-generated)
 *
 * This mapping is automatically generated from PRIMITIVE_DEFINITIONS.
 * To add or modify primitive metadata, edit primitives.ts.
 */
export const PRIMITIVE_METADATA: Record<string, PrimitiveMetadata> =
  generateMetadata(PRIMITIVE_DEFINITIONS);

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

// ============================================================================
// Namespace Support
// ============================================================================

/**
 * Known namespaces for primitive grouping in the palette.
 */
export const PRIMITIVE_NAMESPACES = {
  CORE: 'core',
  RV32I: 'rv32i',
} as const;

/**
 * Namespace display information
 */
export const NAMESPACE_INFO: Record<string, { label: string; description: string }> = {
  [PRIMITIVE_NAMESPACES.CORE]: {
    label: 'Core',
    description: 'Built-in digital logic primitives',
  },
  [PRIMITIVE_NAMESPACES.RV32I]: {
    label: 'RISC-V (RV32I)',
    description: 'RV32I base integer instruction set components',
  },
};

/**
 * Get all primitives grouped by namespace, then by category within each namespace.
 */
export function getPrimitivesByNamespace(): Map<string, Map<string, string[]>> {
  const grouped = new Map<string, Map<string, string[]>>();

  for (const [name, def] of Object.entries(PRIMITIVE_DEFINITIONS)) {
    const ns = def.namespace ?? 'core';
    const category = def.category;

    if (!grouped.has(ns)) {
      grouped.set(ns, new Map());
    }
    const nsMap = grouped.get(ns)!;
    if (!nsMap.has(category)) {
      nsMap.set(category, []);
    }
    nsMap.get(category)!.push(name);
  }

  return grouped;
}
