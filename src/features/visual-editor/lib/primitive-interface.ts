/**
 * Primitive Component Interface
 *
 * Defines the unified interface for all primitive (kernel-implemented) components.
 * This interface supports both combinational and sequential components with a
 * clean separation of concerns:
 * - `evaluate()`: Computes outputs from inputs and current state
 * - `updateState()`: Computes next state from inputs and clock edges (sequential only)
 * - `isSequential()`: Identifies components that require state management
 *
 * Design Goals:
 * 1. Type safety: Clear input/output contracts
 * 2. Deterministic execution: No hidden state or side effects
 * 3. Testability: Pure functions that are easy to test
 * 4. Extensibility: Easy to add new primitive types
 * 5. Performance: Efficient evaluation for thousands of nodes
 */

import type { BitValue, BusValue } from '../types/ir-v0.1';

/**
 * Parameter value types for component configuration
 *
 * Some components need additional configuration passed via the inputs Map
 * using special keys prefixed with "__" (e.g., "__width", "__widths_out").
 * These are not actual input ports, but configuration parameters.
 *
 * Examples:
 * - number: Width parameter for Adder
 * - number[]: Array of widths for Splitter
 * - string: Configuration strings
 */
export type ParameterValue = number | number[] | string | boolean;

/**
 * Input value types for primitive evaluators
 *
 * Supports:
 * - BitValue (boolean): Single-bit signals
 * - BusValue (number): Multi-bit buses
 * - ParameterValue: Configuration parameters (prefixed with "__")
 */
export type InputValue = BitValue | BusValue | ParameterValue;

/**
 * State value types for sequential components
 *
 * - BitValue (boolean): For single-bit state (D Flip-Flop)
 * - BusValue (number): For multi-bit state (Register)
 * - Map<number, number>: For memory storage (RAM)
 * - undefined: For combinational components (no state)
 */
export type PrimitiveState = BitValue | BusValue | Map<number, number> | undefined;

/**
 * Clock edge detection result
 */
export type ClockEdge = 'rising' | 'falling' | 'none';

/**
 * Clock edge information for state updates
 */
export interface ClockEdges {
  [clockName: string]: ClockEdge;
}

/**
 * Unified primitive evaluator interface
 *
 * All primitive components implement this interface, providing:
 * 1. Output computation (evaluate)
 * 2. State updates for sequential components (updateState)
 * 3. Sequential flag (isSequential)
 *
 * Execution model:
 * - Combinational phase: Call evaluate() to get outputs from inputs
 * - Sequential phase: Call updateState() to compute next state (if sequential)
 * - State commit: Simulator commits next state to current state
 *
 * Example usage (D Flip-Flop):
 * ```typescript
 * // Phase 1: Evaluate outputs (reads current state)
 * const outputs = evaluator.evaluate(inputs, currentState);
 *
 * // Phase 2: Update state (computes next state on rising edge)
 * const nextState = evaluator.updateState?.(inputs, currentState, clockEdges);
 *
 * // Phase 3: Commit state (simulator handles this)
 * currentState = nextState;
 * ```
 */
export interface PrimitiveEvaluator {
  /**
   * Evaluate component outputs from inputs and current state
   *
   * This is called during the combinational phase of simulation.
   * For sequential components, this returns outputs based on CURRENT state,
   * not inputs. State updates happen separately in updateState().
   *
   * @param inputs - Map of input port names to values (including "__"-prefixed parameters)
   * @param currentState - Current state value (for sequential components)
   * @returns Map of output port names to values
   *
   * Examples:
   * - AND gate: Returns {out: inputs.a && inputs.b}
   * - D Flip-Flop: Returns {q: currentState, q_bar: !currentState}
   * - Switch: Returns {out: false} (value is externally controlled)
   * - Splitter: Uses inputs.__widths_out parameter to split the bus
   */
  evaluate(
    inputs: Map<string, InputValue>,
    currentState?: PrimitiveState
  ): Map<string, BitValue | BusValue>;

  /**
   * Update component state based on inputs and clock edges (sequential only)
   *
   * This is called during the sequential phase of simulation, after all
   * combinational logic has stabilized. It computes the NEXT state value
   * based on inputs and clock edges.
   *
   * Only defined for sequential components (DFlipFlop, Register, RAM).
   * Returns undefined for combinational components.
   *
   * @param inputs - Map of input port names to values (including "__"-prefixed parameters)
   * @param currentState - Current state value
   * @param clockEdges - Clock edge information for each clock signal
   * @returns Next state value, or current state if no update
   *
   * Examples:
   * - D Flip-Flop: Returns inputs.d on rising edge, currentState otherwise
   * - Register: Returns inputs.data when inputs.we is high, currentState otherwise
   * - RAM: Updates memory at inputs.addr on rising edge with inputs.we high
   */
  updateState?(
    inputs: Map<string, InputValue>,
    currentState: PrimitiveState,
    clockEdges: ClockEdges
  ): PrimitiveState;

  /**
   * Check if this component is sequential (has state)
   *
   * Sequential components require special handling in the simulator:
   * - State initialization
   * - Double buffering (current/next state)
   * - Clock edge detection
   * - Two-phase execution (combinational + state update)
   *
   * @returns true if component has state, false otherwise
   */
  isSequential(): boolean;
}

/**
 * Helper to create a simple combinational evaluator
 *
 * Most logic gates are combinational, so this helper reduces boilerplate.
 *
 * @param evaluateFn - Function that computes outputs from inputs
 * @returns PrimitiveEvaluator implementation
 */
export function createCombinationalEvaluator(
  evaluateFn: (inputs: Map<string, InputValue>) => Map<string, BitValue | BusValue>
): PrimitiveEvaluator {
  return {
    evaluate: evaluateFn,
    isSequential: () => false,
  };
}

/**
 * Helper to create a sequential evaluator
 *
 * Sequential components (flip-flops, registers, RAM) need both evaluate
 * and updateState implementations.
 *
 * @param evaluateFn - Function that computes outputs from current state
 * @param updateStateFn - Function that computes next state from inputs and clock edges
 * @returns PrimitiveEvaluator implementation
 */
export function createSequentialEvaluator(
  evaluateFn: (
    inputs: Map<string, InputValue>,
    currentState?: PrimitiveState
  ) => Map<string, BitValue | BusValue>,
  updateStateFn: (
    inputs: Map<string, InputValue>,
    currentState: PrimitiveState,
    clockEdges: ClockEdges
  ) => PrimitiveState
): PrimitiveEvaluator {
  return {
    evaluate: evaluateFn,
    updateState: updateStateFn,
    isSequential: () => true,
  };
}
