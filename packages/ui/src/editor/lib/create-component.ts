/**
 * UI Component Factory
 *
 * Creates editor Component instances from core primitive definitions.
 * This is the only editor-specific primitive logic — everything else
 * (definitions, evaluators, metadata) lives in core.
 */

import type { Component } from '../types';
import {
  PRIMITIVE_DEFINITIONS,
  type CorePrimitiveDefinition,
} from '@turing-incomplete/core/simulator';

/**
 * Derives a createComponent function from a CorePrimitiveDefinition.
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

/**
 * Create a component instance by type name.
 */
export function createPrimitiveComponent(
  id: string,
  type: string,
  initialValue?: boolean | number,
): Component | null {
  const def = PRIMITIVE_DEFINITIONS[type];
  return def ? autoCreateComponent(def)(id, initialValue) : null;
}

/**
 * Generate UI metadata (category + icon) from primitive definitions.
 */
export function generateMetadata(
  defs: Record<string, CorePrimitiveDefinition> = PRIMITIVE_DEFINITIONS,
): Record<string, { category: string; icon: string }> {
  return Object.fromEntries(
    Object.entries(defs).map(([name, def]) => [
      name,
      { category: def.category, icon: def.icon },
    ]),
  );
}
