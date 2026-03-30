/**
 * Types for the Verilog exporter and verification pipeline.
 */

export interface VerilogExportOptions {
  /** Export mode: flat (single module) or hierarchical (sub-modules preserved) */
  mode?: 'flat' | 'hierarchical';
  /** Override top module name (defaults to circuit name) */
  topModuleName?: string;
  /** Clock signal name (defaults to 'clk') */
  clockName?: string;
  /** Include `timescale directive */
  includeTimescale?: boolean;
  /** Target: simulation (relaxed, initial blocks) or synthesis (strict, FPGA-friendly) */
  target?: 'simulation' | 'synthesis';
}

export interface VerilogTestbenchOptions {
  /** Clock half-period in simulation time units (default: 5) */
  clockHalfPeriod?: number;
  /** Combinational settling delay (default: 10) */
  settleTime?: number;
  /** Sample delay after clock edge (default: 1) */
  sampleDelay?: number;
  /** Maximum simulation cycles before timeout (default: 1000) */
  timeoutCycles?: number;
}

export interface TestVector {
  /** Unique test case ID */
  id: number;
  /** Input values: { portName: value } */
  inputs: Record<string, number | boolean>;
  /** Expected output values: { portName: value } */
  expected: Record<string, number | boolean>;
  /** Number of clock ticks before sampling (0 for combinational) */
  ticks?: number;
  /** Human-readable description */
  description?: string;
}

export interface VerilogLintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface VerificationResult {
  verified: boolean;
  coverage: 'test-vectors' | 'exhaustive' | 'random';
  testCount: number;
  allPassed: boolean;
  results: VerificationTestResult[];
  /** Cycle-by-cycle trace for sequential circuits */
  trace?: VerificationCycle[];
}

export interface VerificationTestResult {
  testCase: number;
  passed: boolean;
  inputs: Record<string, number | boolean>;
  expected: Record<string, number | boolean>;
  actual: Record<string, number | boolean>;
  description?: string;
}

export interface VerificationCycle {
  cycle: number;
  outputs: Record<string, number>;
}
