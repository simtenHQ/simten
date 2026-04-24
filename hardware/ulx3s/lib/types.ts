/**
 * Generic hardware pipeline types. No project-specific knowledge.
 *
 * A Project descriptor (see projects/) captures how to produce Verilog for one
 * FPGA target (CPU, Snake, etc.); runPipeline() drives it through the shared
 * compile → synth → PnR → flash → UART-capture stages.
 */

export interface DeviceSpec {
  /** ECP5 size, e.g. 'LFE5U-85F'. */
  chip: string;
  /** Package, e.g. 'CABGA381'. */
  package: string;
  /** nextpnr size flag without leading '--', e.g. '85k'. */
  sizeFlag: '25k' | '45k' | '85k';
}

export interface FirmwareBuild {
  /** Compiled flat binary. */
  binary: Uint8Array;
  /** Optional disassembly text from the compiler (if produced). */
  disassembly?: string;
}

export interface FirmwareSpec {
  /** Max instruction-memory size in bytes. */
  imemBytes: number;
  /**
   * Compile firmware source text into a flat binary.
   * `language` examples: 'c' | 'rust' | 'asm'.
   */
  compile(source: string, opts: { language: string }): Promise<FirmwareBuild>;
}

export interface BuildVerilogCtx {
  /** Absolute path to hardware/ulx3s/. */
  baseDir: string;
  /** Compiled firmware (present only if project.firmware was configured). */
  firmware?: FirmwareBuild;
}

export interface BuildVerilogResult {
  /** Full combined Verilog source (circuit + top wrapper). */
  verilog: string;
  /** Top module name for synth / PnR. */
  topModule: string;
  /** LPF constraints contents. */
  lpf: string;
  /** Device to target. */
  device: DeviceSpec;
  /** Auxiliary files to pass to the synth container (e.g. firmware.hex). */
  extraFiles?: Record<string, string>;
  /**
   * Optional: byte offsets in `verilog` that contain firmware init data. When
   * set, runPipeline hashes `verilog` with this range zeroed out as the
   * bitstream-cache key — so firmware-only edits hit the ecpbram fast path.
   */
  firmwareInitRange?: { start: number; end: number };
}

export interface Project {
  /** Short identifier, e.g. 'cpu', 'snake', 'uart_test'. */
  name: string;
  /** Output bitstream filename (written to hardware/ulx3s/<bitFile>). */
  bitFile: string;
  /** Optional firmware pipeline (present for CPU-like projects). */
  firmware?: FirmwareSpec;
  /** Produce combined Verilog + wrapper. */
  buildVerilog(ctx: BuildVerilogCtx): Promise<BuildVerilogResult>;
  /** Optional UART characteristics (for run_on_fpga capture). */
  uart?: { baud: number };
  /** Default UART capture timeout in ms. */
  defaultTimeoutMs?: number;
}

// ── Pipeline result shape ───────────────────────────────────────────────────

export interface CompileStageResult {
  firmware_bytes: number;
  fits_imem: boolean;
  disassembly_first_40_lines?: string;
}

export interface SynthStageResult {
  /** True when the ecpbram fast path produced this bitstream. */
  cached: boolean;
  bitstream_kb: number;
  timing_achieved_mhz?: number;
  timing_target_mhz?: number;
  utilization?: { lut: number; ff: number; bram: number; io?: number };
  warnings: string[];
}

export interface FlashStageResult {
  flashed: boolean;
  flash_duration_ms: number;
}

export interface RunStageResult {
  uart_bytes: number[];
  uart_string: string;
  captured_ms: number;
  partial: boolean;
}

export interface MatchStageResult {
  pattern: string;
  found: boolean;
  position?: number;
}

export interface StageError {
  stage: 'compile' | 'synth' | 'flash' | 'run' | 'match';
  message: string;
  stderr_tail: string;
  suggestion?: string;
}

export interface RunResult {
  success: boolean;
  stage: 'compile' | 'synth' | 'flash' | 'run' | 'match';
  duration_ms: number;
  compile?: CompileStageResult;
  synth?: SynthStageResult;
  flash?: FlashStageResult;
  run?: RunStageResult;
  match?: MatchStageResult;
  error?: StageError;
  warnings?: string[];
}

export interface PipelineOptions {
  project: Project;
  firmwareSourcePath?: string;
  firmwareLanguage?: string;
  flash: boolean;
  fullRebuild?: boolean;
  verbose?: boolean;
}

/** Intermediate result covering everything up to (and including) flash. */
export interface PipelineResult {
  ok: boolean;
  stage: 'compile' | 'synth' | 'flash';
  compile?: CompileStageResult;
  synth?: SynthStageResult;
  flash?: FlashStageResult;
  warnings: string[];
  error?: StageError;
  /** Bitstream bytes (present on success even if --no-flash). */
  bitstream?: Buffer;
}
