/**
 * Primitive Registry
 *
 * Single source of truth: all primitive metadata lives in core/simulator/primitives.ts.
 * This module auto-generates UI component instances from core definitions.
 *
 * To add a new primitive: edit core/simulator/primitives.ts — done.
 *
 * @see core/simulator/primitives.ts
 */

import type { Circuit } from '../types/circuit';
import type { Component } from '../types';
import {
  PRIMITIVE_DEFINITIONS as CORE_DEFINITIONS,
  type CorePrimitiveDefinition,
  type PrimitiveEvaluator,
  generatePrimitives as coreGeneratePrimitives,
  generateEvaluators as coreGenerateEvaluators,
} from '@turing-incomplete/core/simulator';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Complete primitive definition = core definition + auto-generated createComponent.
 */
export type PrimitiveDefinition = CorePrimitiveDefinition & {
  createComponent: (id: string, initialValue?: boolean | number) => Component;
};

// ============================================================================
// Auto-generated Component Factory
// ============================================================================

/**
 * Derives a createComponent function from a CorePrimitiveDefinition.
 *
 * Component initial state is built from:
 * - parameters with defaultValue → component properties
 * - state blocks with bit/bus type → `state` property
 * - state blocks with memory type → `addressWidth`, `dataWidth`, `memory`
 * - environmentalState + initialValue → override that argument key
 * - sequential state + initialValue → override `state` property
 */
function autoCreateComponent(def: CorePrimitiveDefinition) {
  return (id: string, initialValue?: boolean | number): Component => {
    const comp: Record<string, unknown> = { id, type: def.name };

    // Add parameter defaults as component properties
    if (def.parameters) {
      for (const param of def.parameters) {
        if (param.defaultValue !== undefined) {
          comp[param.name] = param.defaultValue;
        }
      }
    }

    // Ensure environmental state key is always initialized with correct type
    if (def.environmentalState) {
      const firstOutput = def.outputs[0];
      const defaultEnvValue = firstOutput?.portType.kind === 'bit' ? false : 0;
      // Override parameter-derived value with properly typed default
      if (comp[def.environmentalState] === undefined || comp[def.environmentalState] === 0) {
        comp[def.environmentalState] = defaultEnvValue;
      }
    }

    // Override with initialValue if provided
    if (initialValue !== undefined) {
      if (def.environmentalState) {
        comp[def.environmentalState] = initialValue;
      } else if (def.state?.length) {
        const s = def.state[0];
        if (s.stateType.kind !== 'memory') {
          comp.state = initialValue;
        }
      }
    }

    // Add state-derived properties
    if (def.state) {
      for (const s of def.state) {
        if (s.stateType.kind === 'memory') {
          comp.addressWidth = s.stateType.addressWidth;
          comp.dataWidth = s.stateType.dataWidth;
          comp.memory = new Map<number, number>();
        } else if (comp.state === undefined) {
          comp.state = s.initialValue;
        }
      }
    }

    return comp as Component;
  };
}

// ============================================================================
// Merged Definitions
// ============================================================================

/**
 * Build PRIMITIVE_DEFINITIONS by extending core definitions with auto-generated createComponent.
 */
function buildMergedDefinitions(): Record<string, PrimitiveDefinition> {
  const merged: Record<string, PrimitiveDefinition> = {};

  for (const [name, coreDef] of Object.entries(CORE_DEFINITIONS)) {
    merged[name] = {
      ...coreDef,
      createComponent: autoCreateComponent(coreDef),
    };
  }

  return merged;
}

/**
 * All primitive definitions — core logic + auto-generated component factory.
 *
 * To add a new primitive: edit core/simulator/primitives.ts — that's it.
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
): Record<string, { category: string; icon: string }> {
  return Object.fromEntries(
    Object.entries(defs).map(([name, def]) => [
      name,
      { category: def.category, icon: def.icon },
    ])
  );
}

/**
 * Create a component instance by type name.
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

export { generatePrimitives } from '@turing-incomplete/core/simulator';

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
