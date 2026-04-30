/**
 * Idempotency Tracker
 *
 * Per-session tracking to prevent duplicate action execution.
 * Scoped to chat session - resets on page reload or new session.
 */

// ============================================================================
// Idempotency Tracker Class
// ============================================================================

export class IdempotencyTracker {
  private executedActions = new Set<string>();
  private readonly sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Check if an action has already been executed.
   */
  hasExecuted(actionId: string): boolean {
    return this.executedActions.has(actionId);
  }

  /**
   * Mark an action as executed.
   */
  markExecuted(actionId: string): void {
    this.executedActions.add(actionId);
  }

  /**
   * Get the session ID.
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get the count of executed actions.
   */
  getExecutedCount(): number {
    return this.executedActions.size;
  }

  /**
   * Clear all tracked actions (for session reset).
   */
  reset(): void {
    this.executedActions.clear();
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let currentTracker: IdempotencyTracker | null = null;

/**
 * Get or create the idempotency tracker for a session.
 * Creates a new tracker if sessionId differs from current.
 */
export function getIdempotencyTracker(sessionId: string): IdempotencyTracker {
  if (!currentTracker || currentTracker.getSessionId() !== sessionId) {
    currentTracker = new IdempotencyTracker(sessionId);
  }
  return currentTracker;
}

/**
 * Reset the current idempotency tracker.
 */
export function resetIdempotencyTracker(): void {
  currentTracker?.reset();
  currentTracker = null;
}
