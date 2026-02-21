/**
 * Confirmation Flow
 *
 * Handles 'confirm' safety level actions.
 * Provides UI-driven confirmation before mutations.
 */

import type { AssistantAction } from '../types';
import { ACTION_SAFETY } from '../constants';

// ============================================================================
// Types
// ============================================================================

export interface ConfirmationRequest {
  action: AssistantAction;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
}

// ============================================================================
// Confirmation Content Generation
// ============================================================================

/**
 * Check if an action requires confirmation.
 */
export function requiresConfirmation(action: AssistantAction): boolean {
  return ACTION_SAFETY[action.type] === 'confirm';
}

/**
 * Build confirmation request for an action.
 */
export function buildConfirmationRequest(
  action: AssistantAction
): ConfirmationRequest {
  switch (action.type) {
    case 'INSERT_NODE':
      return {
        action,
        title: 'Insert Component',
        description: `Add "${action.componentRef}"${
          action.suggestedLabel ? ` as "${action.suggestedLabel}"` : ''
        } to your circuit?`,
        confirmLabel: 'Insert',
        cancelLabel: 'Cancel',
      };

    default:
      return {
        action,
        title: 'Confirm Action',
        description: `Execute ${action.type}?`,
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
      };
  }
}

/**
 * Get action preview content for confirmation modal.
 */
export function getActionPreview(action: AssistantAction): string {
  switch (action.type) {
    case 'SET_INPUT':
      return `Set ${action.node} to ${action.value}`;

    case 'RUN_SIMULATION':
      return `Run simulation for ${action.cycles} cycles`;

    case 'SHOW_DIFF':
      return `Apply code changes: ${action.explanation}`;

    case 'INSERT_NODE': {
      const parts = [`Insert ${action.componentRef}`];
      if (action.suggestedLabel) {
        parts.push(`as "${action.suggestedLabel}"`);
      }
      if (action.connectFrom) {
        parts.push(`connected from ${action.connectFrom}`);
      }
      if (action.connectTo) {
        parts.push(`to ${action.connectTo}`);
      }
      return parts.join(' ');
    }

    case 'GENERATE_HARNESS':
      return `Generate test harness${action.circuitName ? ` for ${action.circuitName}` : ''}`;

    case 'VERIFY_ASSERTION':
      return `Verify assertions${action.targetCircuit ? ` on ${action.targetCircuit}` : ''}`;

    default: {
      // Exhaustive check - this handles any future action types
      const _exhaustiveCheck: never = action;
      return `Execute ${(_exhaustiveCheck as AssistantAction).type}`;
    }
  }
}

// ============================================================================
// State Management for Pending Confirmations
// ============================================================================

interface PendingConfirmation {
  action: AssistantAction;
  resolve: (confirmed: boolean) => void;
}

let pendingConfirmation: PendingConfirmation | null = null;

/**
 * Request confirmation for an action.
 * Returns a promise that resolves when user responds.
 */
export function requestConfirmation(
  action: AssistantAction
): Promise<boolean> {
  return new Promise((resolve) => {
    pendingConfirmation = { action, resolve };
    // The UI should poll getPendingConfirmation or use a store
  });
}

/**
 * Get the current pending confirmation.
 */
export function getPendingConfirmation(): PendingConfirmation | null {
  return pendingConfirmation;
}

/**
 * Resolve the pending confirmation.
 */
export function resolveConfirmation(confirmed: boolean): void {
  if (pendingConfirmation) {
    pendingConfirmation.resolve(confirmed);
    pendingConfirmation = null;
  }
}

/**
 * Cancel any pending confirmation.
 */
export function cancelPendingConfirmation(): void {
  resolveConfirmation(false);
}
