/**
 * Testbench AST Type Definitions
 *
 * AST nodes for testbench constructs (.tb.dsl files).
 * These are parsed by the DSL parser and compiled to testbench IR.
 *
 * Design Principles:
 * 1. Minimal syntax that doesn't bloat the language
 * 2. Bit-level stimulus core (Layer 2 in architecture)
 * 3. Source location tracking for error reporting
 * 4. Future-proof (ready for protocol helpers and assertions)
 */

import { ASTNode, PortRef, Expr, SourceRange } from './ast';

// ============================================================================
// Testbench Definition
// ============================================================================

/**
 * Top-level testbench definition
 *
 * Example:
 * testbench MiniSwitchTest {
 *   use circuit MiniSwitch2Port as dut
 *   input p0_byte: Bus[8]
 *   ...
 * }
 */
export interface TestbenchDef extends ASTNode {
  name: string;
  circuitRef: CircuitRef;
  inputs: TestInputDecl[];
  outputs: TestOutputDecl[];
  clocks: TestClockDecl[];
  helpers?: HelperFunction[];
  impl?: TestImplBlock;
  description?: string;
}

/**
 * Reference to the circuit under test
 *
 * Example: use circuit MiniSwitch2Port as dut
 */
export interface CircuitRef extends ASTNode {
  circuitName: string;
  instanceName: string; // "dut" by convention
}

// ============================================================================
// Port Declarations (Testbench Level)
// ============================================================================

/**
 * Testbench input (drives DUT or internal nodes)
 *
 * Example: input p0_byte: Bus[8]
 */
export interface TestInputDecl extends ASTNode {
  name: string;
  portType: 'Bit' | 'Bus';
  width?: number; // For Bus types
  description?: string;
}

/**
 * Testbench output (observes DUT outputs)
 *
 * Example: output p0_out_valid: Bit
 */
export interface TestOutputDecl extends ASTNode {
  name: string;
  portType: 'Bit' | 'Bus';
  width?: number; // For Bus types
  description?: string;
}

/**
 * Clock declaration (single clock in Phase 1, multi-clock in Phase 4)
 *
 * Example: clock clk
 * Phase 4: clock clk @ 100MHz
 */
export interface TestClockDecl extends ASTNode {
  name: string;
  frequency?: FrequencyExpr; // Phase 4: optional frequency
  description?: string;
}

/**
 * Frequency expression (Phase 4)
 *
 * Example: 100MHz, 50kHz, 1GHz
 */
export interface FrequencyExpr extends ASTNode {
  value: number;
  unit: 'Hz' | 'kHz' | 'MHz' | 'GHz';
}

// ============================================================================
// Implementation Block
// ============================================================================

/**
 * Testbench implementation
 *
 * Contains:
 * - Node instantiations (DUT instance)
 * - Connections between testbench ports and DUT
 * - Stimulus sequences
 * - Capture configuration (VCD export)
 * - Assertions (Phase 5)
 */
export interface TestImplBlock extends ASTNode {
  nodes: TestNodeDecl[];
  connections: TestConnectionStmt[];
  stimulus?: StimulusBlock[];
  capture?: CaptureBlock;
  assertions?: AssertBlock[]; // Phase 5
}

/**
 * Node instantiation inside testbench
 *
 * Example: node dut_instance: MiniSwitch2Port
 */
export interface TestNodeDecl extends ASTNode {
  instanceName: string;
  componentType: string;
  description?: string;
}

/**
 * Connection statement
 *
 * Example: connect p0_byte -> dut_instance.p0_byte
 */
export interface TestConnectionStmt extends ASTNode {
  source: PortRef;
  target: PortRef;
}

// ============================================================================
// Stimulus Block (Core Layer 2 - Bit-Level)
// ============================================================================

/**
 * Stimulus block - defines cycle-by-cycle signal values
 *
 * Example:
 * stimulus on clk {
 *   at 0: reset = 1, enable = 0
 *   at 10..20: enable = 1
 *   at 100: data = 0x42
 * }
 */
export interface StimulusBlock extends ASTNode {
  clockRef: string; // Which clock this stimulus is synchronized to
  events: StimulusEvent[];
}

/**
 * Single stimulus event or range of events
 *
 * Syntax variants:
 * - at 0: signal = value
 * - at 10..20: signal = value (inclusive range)
 * - at 0..100 step 10: signal = value (stepped range)
 */
export interface StimulusEvent extends ASTNode {
  timing: StimulusTiming;
  assignments: StimulusAssignment[];
}

/**
 * Timing specification for stimulus
 */
export type StimulusTiming =
  | SingleCycleTiming
  | RangeTiming
  | SteppedTiming;

/**
 * Single cycle: at 5
 */
export interface SingleCycleTiming extends ASTNode {
  kind: 'single';
  cycle: number | Expr; // Can be computed
}

/**
 * Range of cycles: at 10..20 (inclusive)
 */
export interface RangeTiming extends ASTNode {
  kind: 'range';
  start: number | Expr;
  end: number | Expr; // Inclusive
}

/**
 * Stepped range: at 0..100 step 10
 */
export interface SteppedTiming extends ASTNode {
  kind: 'stepped';
  start: number | Expr;
  end: number | Expr; // Inclusive
  step: number;
}

/**
 * Signal assignment within stimulus event
 *
 * Example: reset = 1, enable = 0
 */
export interface StimulusAssignment extends ASTNode {
  signal: string; // Signal name (testbench input or node argument)
  value: Expr; // Value to assign (can be computed from cycle variable)
}

// ============================================================================
// Capture Block (VCD Export - Phase 2)
// ============================================================================

/**
 * Capture configuration for waveform export
 *
 * Example:
 * capture {
 *   signals: [p0_byte, p0_valid, p0_out_byte, p0_out_valid]
 *   format: vcd
 *   filename: "miniswitch_test.vcd"
 * }
 */
export interface CaptureBlock extends ASTNode {
  signals: string[]; // Signal names to capture
  format: 'vcd'; // Only VCD for now, could add FST/VPD later
  filename: string;
}

// ============================================================================
// Helper Functions (Phase 3)
// ============================================================================

/**
 * Helper function definition (compiles to stimulus sequences)
 *
 * Example:
 * function send_eth_frame(port: string, dest: Bus[48], payload: Bus[8][]) {
 *   // Function body with tick() calls and assignments
 * }
 */
export interface HelperFunction extends ASTNode {
  name: string;
  parameters: HelperParameter[];
  body: HelperStatement[];
}

export interface HelperParameter extends ASTNode {
  name: string;
  paramType: 'string' | 'int' | 'Bus' | 'Bit';
  width?: number; // For Bus types
  isArray?: boolean; // For array parameters
}

export type HelperStatement =
  | HelperAssignment
  | HelperForLoop
  | HelperTickCall;

export interface HelperAssignment extends ASTNode {
  kind: 'assignment';
  target: string; // Can include string interpolation: ${port}_byte
  value: Expr;
}

export interface HelperForLoop extends ASTNode {
  kind: 'for';
  variable: string;
  start: number;
  end: number;
  body: HelperStatement[];
}

export interface HelperTickCall extends ASTNode {
  kind: 'tick';
}

// ============================================================================
// Assertions (Phase 5)
// ============================================================================

/**
 * Assertion block - automated test conditions
 *
 * Example:
 * assert on clk {
 *   at 10: output == expected, "Output should match expected"
 *   at 10..20: valid -> (data != 0), "Valid data must be non-zero"
 * }
 */
export interface AssertBlock extends ASTNode {
  clockRef: string;
  assertions: Assertion[];
}

export interface Assertion extends ASTNode {
  timing: StimulusTiming; // Reuse timing types from stimulus
  condition: Expr;
  message?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a testbench has stimulus defined
 */
export function hasStimulus(testbench: TestbenchDef): boolean {
  return testbench.impl !== undefined &&
         testbench.impl.stimulus !== undefined &&
         testbench.impl.stimulus.length > 0;
}

/**
 * Check if a testbench has capture configured
 */
export function hasCapture(testbench: TestbenchDef): boolean {
  return testbench.impl !== undefined &&
         testbench.impl.capture !== undefined;
}

/**
 * Check if a testbench has assertions
 */
export function hasAssertions(testbench: TestbenchDef): boolean {
  return testbench.impl !== undefined &&
         testbench.impl.assertions !== undefined &&
         testbench.impl.assertions.length > 0;
}

/**
 * Get all signal names referenced in stimulus
 */
export function getStimulusSignals(stimulus: StimulusBlock): string[] {
  const signals = new Set<string>();
  for (const event of stimulus.events) {
    for (const assignment of event.assignments) {
      signals.add(assignment.signal);
    }
  }
  return Array.from(signals);
}

/**
 * Format timing for debugging
 */
export function formatTiming(timing: StimulusTiming): string {
  switch (timing.kind) {
    case 'single':
      return `at ${timing.cycle}`;
    case 'range':
      return `at ${timing.start}..${timing.end}`;
    case 'stepped':
      return `at ${timing.start}..${timing.end} step ${timing.step}`;
  }
}
