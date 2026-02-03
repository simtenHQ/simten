/**
 * Stimulus Compiler
 *
 * Compiles testbench stimulus AST to executable stimulus schedule.
 *
 * Features:
 * - Range expansion: at 0..6 -> 7 individual events
 * - Stepped ranges: at 0..100 step 10 -> 11 events
 * - Computed values: data = cycle & 0xFF
 * - Cycle ordering validation
 *
 * The compiled stimulus schedule is a Map<cycle, actions[]> that
 * the testbench runner uses to apply stimulus during simulation.
 */

import {
  StimulusBlock,
  StimulusEvent,
  StimulusTiming,
  SingleCycleTiming,
  RangeTiming,
  SteppedTiming,
  StimulusAssignment,
} from '../../dsl/types/testbench-ast';
import { Expr, LiteralExpr, VariableExpr, BinaryExpr, UnaryExpr } from '../../dsl/types/ast';
import {
  StimulusSchedule,
  StimulusAction,
  createStimulusSchedule,
  addStimulusAction,
} from '../types/testbench';

// ============================================================================
// Compiler Error
// ============================================================================

export class StimulusCompilerError extends Error {
  constructor(
    message: string,
    public location?: { line: number; column: number }
  ) {
    super(message);
    this.name = 'StimulusCompilerError';
  }
}

// ============================================================================
// Stimulus Compiler
// ============================================================================

/**
 * Compile stimulus block to executable schedule
 */
export function compileStimulus(stimulus: StimulusBlock): StimulusSchedule {
  const schedule = createStimulusSchedule(stimulus.clockRef);

  for (const event of stimulus.events) {
    const cycles = expandTiming(event.timing);

    for (const cycle of cycles) {
      for (const assignment of event.assignments) {
        const value = evaluateExpr(assignment.value, cycle);
        const action: StimulusAction = {
          nodeId: '', // Circuit-level (testbench-runner will resolve to tb_input nodes)
          portName: assignment.signal,
          value,
        };
        addStimulusAction(schedule, cycle, action);
      }
    }
  }

  return schedule;
}

/**
 * Expand timing specification to array of cycle numbers
 */
function expandTiming(timing: StimulusTiming): number[] {
  switch (timing.kind) {
    case 'single':
      return [evaluateCycleExpr((timing as SingleCycleTiming).cycle)];

    case 'range': {
      const rangeTiming = timing as RangeTiming;
      const start = evaluateCycleExpr(rangeTiming.start);
      const end = evaluateCycleExpr(rangeTiming.end);

      if (start > end) {
        throw new StimulusCompilerError(
          `Invalid range: start (${start}) > end (${end})`,
          timing.location?.start
        );
      }

      const cycles: number[] = [];
      for (let i = start; i <= end; i++) {
        cycles.push(i);
      }
      return cycles;
    }

    case 'stepped': {
      const steppedTiming = timing as SteppedTiming;
      const start = evaluateCycleExpr(steppedTiming.start);
      const end = evaluateCycleExpr(steppedTiming.end);
      const step = steppedTiming.step;

      if (start > end) {
        throw new StimulusCompilerError(
          `Invalid range: start (${start}) > end (${end})`,
          timing.location?.start
        );
      }

      if (step <= 0) {
        throw new StimulusCompilerError(
          `Invalid step: ${step} (must be positive)`,
          timing.location?.start
        );
      }

      const cycles: number[] = [];
      for (let i = start; i <= end; i += step) {
        cycles.push(i);
      }
      return cycles;
    }

    default:
      throw new StimulusCompilerError('Unknown timing kind');
  }
}

/**
 * Evaluate cycle expression (for timing)
 */
function evaluateCycleExpr(expr: number | Expr): number {
  if (typeof expr === 'number') {
    return expr;
  }

  // For now, cycle expressions must be literals or simple computations
  const value = evaluateExpr(expr, 0);
  if (typeof value !== 'number') {
    throw new StimulusCompilerError('Cycle expression must evaluate to number');
  }

  return value;
}

/**
 * Evaluate expression to a value
 *
 * @param expr - Expression to evaluate
 * @param cycle - Current cycle number (for 'cycle' variable)
 */
function evaluateExpr(expr: Expr, cycle: number): number | boolean {
  switch ((expr as any).kind) {
    case undefined: {
      // Check if it's a literal expression
      if ('value' in expr) {
        const literal = expr as LiteralExpr;
        if (typeof literal.value === 'number' || typeof literal.value === 'boolean') {
          return literal.value;
        }
        throw new StimulusCompilerError(`Invalid literal value: ${literal.value}`);
      }

      // Check if it's a variable expression
      if ('name' in expr) {
        const variable = expr as VariableExpr;
        if (variable.name === 'cycle') {
          return cycle;
        }
        throw new StimulusCompilerError(`Unknown variable: ${variable.name}`);
      }

      // Check if it's a binary expression
      if ('operator' in expr && 'left' in expr && 'right' in expr) {
        return evaluateBinaryExpr(expr as BinaryExpr, cycle);
      }

      // Check if it's a unary expression
      if ('operator' in expr && 'operand' in expr) {
        return evaluateUnaryExpr(expr as UnaryExpr, cycle);
      }

      throw new StimulusCompilerError('Unknown expression type');
    }

    default:
      throw new StimulusCompilerError(`Unsupported expression kind: ${(expr as any).kind}`);
  }
}

/**
 * Evaluate binary expression
 */
function evaluateBinaryExpr(expr: BinaryExpr, cycle: number): number | boolean {
  const left = evaluateExpr(expr.left, cycle);
  const right = evaluateExpr(expr.right, cycle);

  // Arithmetic operators
  if (typeof left === 'number' && typeof right === 'number') {
    switch (expr.operator) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return Math.floor(left / right); // Integer division
      case '&': return left & right; // Bitwise AND
      case '|': return left | right; // Bitwise OR
      case '^': return left ^ right; // Bitwise XOR
      case '==': return left === right;
      case '!=': return left !== right;
      case '<': return left < right;
      case '>': return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;
      default:
        throw new StimulusCompilerError(`Unknown operator: ${expr.operator}`);
    }
  }

  // Boolean operators
  if (typeof left === 'boolean' && typeof right === 'boolean') {
    switch (expr.operator) {
      case '==': return left === right;
      case '!=': return left !== right;
      default:
        throw new StimulusCompilerError(`Invalid operator for booleans: ${expr.operator}`);
    }
  }

  throw new StimulusCompilerError('Type mismatch in binary expression');
}

/**
 * Evaluate unary expression
 */
function evaluateUnaryExpr(expr: UnaryExpr, cycle: number): number | boolean {
  const operand = evaluateExpr(expr.operand, cycle);

  if (typeof operand === 'number') {
    switch (expr.operator) {
      case '-': return -operand;
      case '~': return ~operand; // Bitwise NOT
      case '!': return operand === 0; // Logical NOT (treat 0 as false)
      default:
        throw new StimulusCompilerError(`Unknown unary operator: ${expr.operator}`);
    }
  }

  if (typeof operand === 'boolean') {
    switch (expr.operator) {
      case '!': return !operand;
      default:
        throw new StimulusCompilerError(`Invalid unary operator for boolean: ${expr.operator}`);
    }
  }

  throw new StimulusCompilerError('Type mismatch in unary expression');
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate stimulus schedule
 *
 * Checks:
 * - No duplicate assignments in same cycle
 * - Cycles are non-negative
 */
export function validateStimulus(schedule: StimulusSchedule): void {
  for (const [cycle, actions] of schedule.events) {
    if (cycle < 0) {
      throw new StimulusCompilerError(`Invalid cycle: ${cycle} (must be non-negative)`);
    }

    // Check for duplicate signal assignments in same cycle
    const signals = new Set<string>();
    for (const action of actions) {
      const key = `${action.nodeId}.${action.portName}`;
      if (signals.has(key)) {
        throw new StimulusCompilerError(
          `Duplicate assignment to signal ${action.portName} at cycle ${cycle}`
        );
      }
      signals.add(key);
    }
  }
}

// ============================================================================
// Debugging
// ============================================================================

/**
 * Format stimulus schedule for debugging
 */
export function formatStimulusSchedule(schedule: StimulusSchedule): string {
  const lines: string[] = [];
  lines.push(`Stimulus on ${schedule.clockRef}:`);

  const sortedCycles = Array.from(schedule.events.keys()).sort((a, b) => a - b);

  for (const cycle of sortedCycles) {
    const actions = schedule.events.get(cycle)!;
    const assignments = actions.map(a => `${a.portName}=${a.value}`).join(', ');
    lines.push(`  cycle ${cycle}: ${assignments}`);
  }

  return lines.join('\n');
}
