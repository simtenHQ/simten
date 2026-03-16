/**
 * Simulation Throttle
 *
 * Cooldown + queueing to prevent simulation spam.
 * Large circuits + many cycles can freeze UI.
 */

import { GUARDRAILS } from '../constants';
import type { ActionResult } from '../types';
import type { RunSimulationAction } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface SimulationContext {
  /** Execute the simulation */
  runSimulation: (cycles: number, stimuli?: Record<string, number>) => Promise<void>;
}

// ============================================================================
// Simulation Throttle Class
// ============================================================================

export class SimulationThrottle {
  private lastSimulation = 0;
  private pendingAction: (RunSimulationAction & { actionId: string }) | null = null;
  private isRunning = false;

  /**
   * Check if a simulation can run immediately.
   */
  canRun(): boolean {
    const now = Date.now();
    const cooldownElapsed =
      now - this.lastSimulation >= GUARDRAILS.SIMULATION_COOLDOWN_MS;
    return !this.isRunning && cooldownElapsed;
  }

  /**
   * Get time until next simulation can run.
   */
  getTimeUntilAvailable(): number {
    if (!this.isRunning) {
      const elapsed = Date.now() - this.lastSimulation;
      return Math.max(0, GUARDRAILS.SIMULATION_COOLDOWN_MS - elapsed);
    }
    return GUARDRAILS.SIMULATION_COOLDOWN_MS; // Estimate
  }

  /**
   * Execute a simulation action with throttling.
   */
  async execute(
    action: RunSimulationAction & { actionId: string },
    context: SimulationContext
  ): Promise<ActionResult> {
    // If already running or in cooldown, try to queue
    if (!this.canRun()) {
      if (this.pendingAction) {
        // Already have one queued, reject
        return {
          success: false,
          actionId: action.actionId,
          type: action.type,
          reason: 'Simulation already queued. Please wait.',
        };
      }

      // Queue this one
      this.pendingAction = action;
      return {
        success: true,
        actionId: action.actionId,
        type: action.type,
        queued: true,
        reason: `Queued. Will run in ${Math.ceil(this.getTimeUntilAvailable() / 1000)}s`,
      };
    }

    // Execute immediately
    return this.doExecute(action, context);
  }

  /**
   * Internal execution with state tracking.
   */
  private async doExecute(
    action: RunSimulationAction & { actionId: string },
    context: SimulationContext
  ): Promise<ActionResult> {
    this.isRunning = true;
    const startTime = Date.now();

    try {
      await context.runSimulation(
        action.cycles,
        action.stimuli ?? undefined
      );

      this.lastSimulation = Date.now();

      return {
        success: true,
        actionId: action.actionId,
        type: action.type,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        actionId: action.actionId,
        type: action.type,
        reason: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isRunning = false;

      // Run queued simulation if exists
      if (this.pendingAction) {
        const queued = this.pendingAction;
        this.pendingAction = null;

        // Schedule after cooldown
        setTimeout(() => {
          this.doExecute(queued, context);
        }, GUARDRAILS.SIMULATION_COOLDOWN_MS);
      }
    }
  }

  /**
   * Check if there's a pending simulation.
   */
  hasPending(): boolean {
    return this.pendingAction !== null;
  }

  /**
   * Cancel any pending simulation.
   */
  cancelPending(): void {
    this.pendingAction = null;
  }

  /**
   * Reset the throttle state.
   */
  reset(): void {
    this.lastSimulation = 0;
    this.pendingAction = null;
    this.isRunning = false;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let throttleInstance: SimulationThrottle | null = null;

/**
 * Get the simulation throttle singleton.
 */
export function getSimulationThrottle(): SimulationThrottle {
  if (!throttleInstance) {
    throttleInstance = new SimulationThrottle();
  }
  return throttleInstance;
}

/**
 * Reset the simulation throttle.
 */
export function resetSimulationThrottle(): void {
  throttleInstance?.reset();
}
