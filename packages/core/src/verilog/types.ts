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
  /**
   * Memory-init threshold in words. Memories with at least this many
   * preloaded entries are emitted as `$readmemh("<file>.hex")` with the
   * hex contents bundled in `ExportResult.files`; smaller memories stay
   * inline as `initial begin mem[K] = …; end` for readability.
   * Defaults to `INLINE_MEMORY_THRESHOLD` (2048 words) — matches the
   * Yosys/Vivado/Quartus convention that very large memories are
   * better expressed as external hex files.
   */
  inlineMemoryThreshold?: number;
}

/**
 * Result of exporting a circuit to Verilog. Callers write `verilog` to
 * a `.v` file and every entry in `files` to its own filename sitting
 * next to it — the sidecar hex files referenced by `$readmemh`
 * directives in the Verilog output, when a memory exceeds the inline
 * threshold.
 */
export interface ExportResult {
  /** The main Verilog source (what would go in a `.v` file). */
  verilog: string;
  /**
   * Sidecar files by filename (e.g. `<module>_<node>_<state>.hex`).
   * Empty when the circuit has no memory that exceeded the threshold.
   */
  files: Record<string, string>;
  /**
   * Primitives the exporter had no mapping for, as `primitiveType` → node ids.
   *
   * Empty on a clean export. When non-empty the emitted Verilog contains
   * `// WARNING: Unsupported primitive` comments in place of real logic, so it
   * parses and synthesizes but does NOT do what the circuit does — a yosys
   * equivalence check against the original finds counterexamples. Callers that
   * hand the output to a user or a toolchain must refuse rather than ship it.
   *
   * Optional so existing consumers are unaffected.
   */
  unsupported?: Record<string, string[]>;
}

/**
 * Default threshold (in words) for switching a memory from inline
 * `initial begin … end` to `$readmemh` with a sidecar hex file.
 * Matches common FPGA synthesis tool preferences and keeps inline
 * Verilog files under ~60KB for readability.
 */
export const INLINE_MEMORY_THRESHOLD = 2048;

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
