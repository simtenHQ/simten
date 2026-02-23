/**
 * Action Validator
 *
 * Validates assistant actions against guardrails before execution.
 */

import { GUARDRAILS, SCHEMA_COMPAT, PROTOCOL_VERSION } from '../constants';
import type { AssistantAction, ValidationResult } from '../types';

// ============================================================================
// Action Validation
// ============================================================================

/**
 * Validate an action against guardrails.
 */
export function validateAction(action: AssistantAction): ValidationResult {
  // Check if action type is known
  if (!isKnownActionType(action.type)) {
    return {
      valid: false,
      reason: `Unknown action type: ${action.type}`,
    };
  }

  // Validate based on action type
  switch (action.type) {
    case 'SET_INPUT':
      return validateSetInput(action);
    case 'RUN_SIMULATION':
      return validateRunSimulation(action);
    case 'SHOW_DIFF':
      return validateShowDiff(action);
    case 'INSERT_NODE':
      return validateInsertNode(action);
    default:
      return { valid: true };
  }
}

/**
 * Check if action type is known in current schema version.
 */
export function isKnownActionType(type: string): boolean {
  const supportedTypes = SCHEMA_COMPAT[PROTOCOL_VERSION];
  return supportedTypes?.includes(type) ?? false;
}

/**
 * Get all supported action types for a schema version.
 */
export function getSupportedActionTypes(version: string): string[] {
  return SCHEMA_COMPAT[version] ?? [];
}

// ============================================================================
// SET_INPUT Validation
// ============================================================================

function validateSetInput(
  action: AssistantAction & { type: 'SET_INPUT' }
): ValidationResult {
  if (typeof action.node !== 'string' || !action.node.trim()) {
    return {
      valid: false,
      reason: 'SET_INPUT requires node name string',
    };
  }

  if (typeof action.value !== 'number') {
    return {
      valid: false,
      reason: 'SET_INPUT requires numeric value',
    };
  }

  // Value must be non-negative integer
  if (action.value < 0 || !Number.isInteger(action.value)) {
    return {
      valid: false,
      reason: 'SET_INPUT value must be a non-negative integer',
    };
  }

  return { valid: true };
}

// ============================================================================
// RUN_SIMULATION Validation
// ============================================================================

function validateRunSimulation(
  action: AssistantAction & { type: 'RUN_SIMULATION' }
): ValidationResult {
  // Validate cycles
  if (typeof action.cycles !== 'number' || action.cycles < 1) {
    return {
      valid: false,
      reason: 'Simulation cycles must be a positive number',
    };
  }

  if (action.cycles > GUARDRAILS.MAX_SIMULATION_CYCLES) {
    return {
      valid: false,
      reason: `Maximum ${GUARDRAILS.MAX_SIMULATION_CYCLES} simulation cycles allowed (requested ${action.cycles})`,
    };
  }

  // Validate stimuli if present
  if (action.stimuli) {
    for (const [key, value] of Object.entries(action.stimuli)) {
      if (typeof key !== 'string') {
        return {
          valid: false,
          reason: 'Stimuli keys must be strings (input names)',
        };
      }
      if (typeof value !== 'number') {
        return {
          valid: false,
          reason: `Stimuli value for "${key}" must be a number`,
        };
      }
    }
  }

  return { valid: true };
}

// ============================================================================
// SHOW_DIFF Validation
// ============================================================================

function validateShowDiff(
  action: AssistantAction & { type: 'SHOW_DIFF' }
): ValidationResult {
  // These are validated separately in diff-validator.ts
  // Basic structure validation only here

  if (typeof action.originalCode !== 'string') {
    return {
      valid: false,
      reason: 'SHOW_DIFF requires originalCode string',
    };
  }

  if (typeof action.suggestedCode !== 'string') {
    return {
      valid: false,
      reason: 'SHOW_DIFF requires suggestedCode string',
    };
  }

  if (typeof action.explanation !== 'string') {
    return {
      valid: false,
      reason: 'SHOW_DIFF requires explanation string',
    };
  }

  return { valid: true };
}

// ============================================================================
// INSERT_NODE Validation
// ============================================================================

function validateInsertNode(
  action: AssistantAction & { type: 'INSERT_NODE' }
): ValidationResult {
  if (typeof action.componentRef !== 'string' || !action.componentRef.trim()) {
    return {
      valid: false,
      reason: 'INSERT_NODE requires componentRef string',
    };
  }

  // Validate connection paths if present
  if (action.connectFrom && typeof action.connectFrom !== 'string') {
    return {
      valid: false,
      reason: 'INSERT_NODE connectFrom must be a string',
    };
  }

  if (action.connectTo && typeof action.connectTo !== 'string') {
    return {
      valid: false,
      reason: 'INSERT_NODE connectTo must be a string',
    };
  }

  return { valid: true };
}

// ============================================================================
// Unknown Action Handling
// ============================================================================

/**
 * Handle unknown action types gracefully.
 * Returns a "skipped" result instead of throwing.
 */
export function handleUnknownAction(action: { type: string }): {
  success: true;
  ignored: true;
  reason: string;
} {
  console.warn(`[ActionIgnore] Unknown action type: ${action.type}`);
  return {
    success: true,
    ignored: true,
    reason: `Unknown action type: ${action.type}`,
  };
}
