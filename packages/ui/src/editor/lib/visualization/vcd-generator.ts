/**
 * VCD (Value Change Dump) Generator
 *
 * Generates industry-standard VCD waveform files from testbench traces.
 * VCD files can be viewed in GTKWave, ModelSim, Vivado, and other tools.
 *
 * VCD Format Specification:
 * - Header: version, date, timescale, scope, variable declarations
 * - Body: timestamp and value change records
 * - Compact: Only emit value changes, not every cycle
 *
 * References:
 * - IEEE 1364-2001 VCD Format
 * - GTKWave documentation
 */

import { CaptureData, TraceData, SignalRef } from '../../types/testbench';
import { BitValue, BusValue } from '../../types/circuit';

// ============================================================================
// VCD Generator
// ============================================================================

/**
 * Generate VCD file content from capture data
 *
 * @param captureData - Trace data collected during testbench run
 * @param timescale - Time unit (default: "1 ns" - 1 nanosecond per cycle)
 * @returns VCD file content as string
 */
export function generateVCD(
  captureData: CaptureData,
  timescale = '1 ns'
): string {
  const lines: string[] = [];

  // Generate header
  lines.push(...generateVCDHeader(timescale));

  // Generate variable declarations
  const signalIds = generateVariableDeclarations(captureData, lines);

  // Generate initial values and value changes
  lines.push('$dumpvars');
  generateValueChanges(captureData, signalIds, lines);
  lines.push('$end');

  return lines.join('\n');
}

/**
 * Generate VCD header section
 */
function generateVCDHeader(timescale: string): string[] {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push('$date');
  lines.push(`  ${now}`);
  lines.push('$end');

  lines.push('$version');
  lines.push('  Simten VCD Generator v0.1');
  lines.push('$end');

  lines.push('$timescale');
  lines.push(`  ${timescale}`);
  lines.push('$end');

  return lines;
}

/**
 * Generate variable declarations and assign signal IDs
 *
 * VCD uses short identifiers for signals (!, ", #, $, %, etc.)
 * to keep file size small.
 *
 * @returns Map from signal key to VCD identifier
 */
function generateVariableDeclarations(
  captureData: CaptureData,
  lines: string[]
): Map<string, string> {
  const signalIds = new Map<string, string>();

  lines.push('$scope module testbench $end');

  let idCounter = 0;
  for (const [key, trace] of captureData.traces) {
    const vcdId = generateVCDIdentifier(idCounter++);
    signalIds.set(key, vcdId);

    const signal = trace.signal;
    const varType = signal.width === 1 ? 'wire' : 'wire';
    const size = signal.width;

    lines.push(`$var ${varType} ${size} ${vcdId} ${signal.displayName} $end`);
  }

  lines.push('$upscope $end');
  lines.push('$enddefinitions $end');

  return signalIds;
}

/**
 * Generate VCD identifier from index
 *
 * VCD uses printable ASCII characters (33-126) for identifiers.
 * We use a simple base-94 encoding: !, ", #, $, %, ..., ~
 *
 * Examples: 0 → !, 1 → ", 2 → #, ..., 93 → ~, 94 → !!, 95 → !"
 */
function generateVCDIdentifier(index: number): string {
  const chars = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
  if (index < chars.length) {
    return chars[index];
  }

  // Multi-character IDs for > 94 signals
  let id = '';
  let n = index;
  while (n >= 0) {
    id = chars[n % chars.length] + id;
    n = Math.floor(n / chars.length) - 1;
    if (n < 0) break;
  }
  return id;
}

/**
 * Generate value changes section
 *
 * Format:
 * - Bit: 0! or 1! (value + identifier)
 * - Bus: b00101010 ! (binary value + identifier)
 * - Timestamp: #100 (hash + time)
 */
function generateValueChanges(
  captureData: CaptureData,
  signalIds: Map<string, string>,
  lines: string[]
): void {
  // Collect all value changes across all signals
  const changes: Array<{
    cycle: number;
    signalKey: string;
    value: BitValue | BusValue;
    width: number;
  }> = [];

  for (const [key, trace] of captureData.traces) {
    for (const change of trace.changes) {
      changes.push({
        cycle: change.cycle,
        signalKey: key,
        value: change.value,
        width: trace.signal.width,
      });
    }
  }

  // Sort by cycle (stable sort to preserve signal order within same cycle)
  changes.sort((a, b) => a.cycle - b.cycle);

  // Emit value changes grouped by cycle
  let currentCycle = -1;
  for (const change of changes) {
    // Emit timestamp if cycle changed
    if (change.cycle !== currentCycle) {
      currentCycle = change.cycle;
      lines.push(`#${currentCycle}`);
    }

    const vcdId = signalIds.get(change.signalKey)!;

    if (change.width === 1) {
      // Bit signal: "0!" or "1!"
      const bitValue = typeof change.value === 'boolean' ? (change.value ? '1' : '0') : (change.value ? '1' : '0');
      lines.push(`${bitValue}${vcdId}`);
    } else {
      // Bus signal: "b00101010 !"
      const busValue = formatBusValueAsBinary(change.value as number, change.width);
      lines.push(`b${busValue} ${vcdId}`);
    }
  }
}

/**
 * Format a bus value as binary string
 *
 * @param value - Numeric value
 * @param width - Bit width
 * @returns Binary string (e.g., "00101010" for 42 with width 8)
 */
function formatBusValueAsBinary(value: number, width: number): string {
  let binary = value.toString(2);

  // Pad with leading zeros
  while (binary.length < width) {
    binary = '0' + binary;
  }

  // Truncate if too long (handle overflow)
  if (binary.length > width) {
    binary = binary.slice(-width);
  }

  return binary;
}

// ============================================================================
// VCD File Writing
// ============================================================================

/**
 * Write VCD to file (triggers browser download)
 */
export function writeVCDToFile(
  captureData: CaptureData,
  filename: string,
  timescale = '1 ns'
): void {
  const vcdContent = generateVCD(captureData, timescale);
  downloadVCD(vcdContent, filename);
}

/**
 * Trigger VCD file download in browser
 */
export function downloadVCD(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================================
// VCD Parsing (for testing/verification)
// ============================================================================

/**
 * Parse VCD header to extract signal information
 * (Useful for testing and verification)
 */
export interface VCDSignalInfo {
  id: string;
  name: string;
  width: number;
  type: string;
}

/**
 * Parse VCD file header
 */
export function parseVCDHeader(vcdContent: string): {
  timescale: string;
  signals: VCDSignalInfo[];
} {
  const lines = vcdContent.split('\n');
  let timescale = '1 ns';
  const signals: VCDSignalInfo[] = [];

  let inTimescale = false;
  let inVars = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '$timescale') {
      inTimescale = true;
    } else if (inTimescale && !trimmed.startsWith('$')) {
      timescale = trimmed;
      inTimescale = false;
    }

    if (trimmed.startsWith('$var')) {
      // $var wire 8 ! data $end
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 5) {
        signals.push({
          type: parts[1],
          width: parseInt(parts[2]),
          id: parts[3],
          name: parts[4],
        });
      }
    }

    if (trimmed === '$enddefinitions') {
      break;
    }
  }

  return { timescale, signals };
}

// ============================================================================
// Debugging
// ============================================================================

/**
 * Get VCD file statistics
 */
export function getVCDStats(captureData: CaptureData): {
  signalCount: number;
  totalCycles: number;
  totalChanges: number;
  fileSize: number;
} {
  let totalChanges = 0;
  let maxCycle = 0;

  for (const [, trace] of captureData.traces) {
    totalChanges += trace.changes.length;
    if (trace.changes.length > 0) {
      maxCycle = Math.max(maxCycle, trace.changes[trace.changes.length - 1].cycle);
    }
  }

  const vcdContent = generateVCD(captureData);
  const fileSize = new Blob([vcdContent]).size;

  return {
    signalCount: captureData.traces.size,
    totalCycles: maxCycle + 1,
    totalChanges,
    fileSize,
  };
}

/**
 * Format VCD stats for display
 */
export function formatVCDStats(stats: ReturnType<typeof getVCDStats>): string {
  const lines: string[] = [];
  lines.push('VCD Statistics:');
  lines.push(`  Signals: ${stats.signalCount}`);
  lines.push(`  Cycles: ${stats.totalCycles}`);
  lines.push(`  Value Changes: ${stats.totalChanges}`);
  lines.push(`  File Size: ${formatBytes(stats.fileSize)}`);
  return lines.join('\n');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
