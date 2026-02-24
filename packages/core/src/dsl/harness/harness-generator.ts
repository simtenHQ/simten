/**
 * Harness Generator
 *
 * Deterministically generates test harness circuits for DUTs.
 * No LLM needed - pure function from interface → DSL.
 */

// ============================================================================
// Types
// ============================================================================

export interface PortInfo {
  name: string;
  type: 'Bit' | 'Bus';
  width?: number;
}

export interface CircuitInterface {
  name: string;
  inputs: PortInfo[];
  outputs: PortInfo[];
  clocks: string[];
}

export interface HarnessAnalysis {
  needsHarness: boolean;
  reason: string;
  interface?: CircuitInterface;
}

// ============================================================================
// Interface Extraction (from DSL)
// ============================================================================

/**
 * Extract circuit interface from DSL code.
 * Returns the last circuit found that has interface ports (the top-level DUT).
 * In multi-circuit files, sub-circuits are defined first and the main circuit last.
 */
export function extractCircuitInterface(dslCode: string): CircuitInterface | null {
  // Find all circuit blocks with their body text
  const circuits = extractCircuitBlocks(dslCode);
  if (circuits.length === 0) return null;

  // Work backwards to find the last circuit with interface ports
  for (let i = circuits.length - 1; i >= 0; i--) {
    const iface = parseCircuitInterface(circuits[i].name, circuits[i].body);
    if (iface.inputs.length > 0 || iface.outputs.length > 0) {
      return iface;
    }
  }

  // Fallback: return the last circuit even if it has no ports
  const last = circuits[circuits.length - 1];
  return parseCircuitInterface(last.name, last.body);
}

/**
 * Extract all circuit blocks (name + body text) from DSL code.
 * Uses brace counting to correctly delimit each circuit body.
 */
function extractCircuitBlocks(dslCode: string): Array<{ name: string; body: string }> {
  const blocks: Array<{ name: string; body: string }> = [];
  const circuitStartRegex = /circuit\s+(\w+)\s*\{/g;
  let startMatch;

  while ((startMatch = circuitStartRegex.exec(dslCode)) !== null) {
    const name = startMatch[1];
    const openBraceIndex = startMatch.index + startMatch[0].length - 1;

    // Count braces to find matching close
    let depth = 1;
    let pos = openBraceIndex + 1;
    while (pos < dslCode.length && depth > 0) {
      if (dslCode[pos] === '{') depth++;
      else if (dslCode[pos] === '}') depth--;
      pos++;
    }

    if (depth === 0) {
      blocks.push({ name, body: dslCode.substring(openBraceIndex + 1, pos - 1) });
    }
  }

  return blocks;
}

/**
 * Parse interface ports from a single circuit's body text.
 */
function parseCircuitInterface(name: string, body: string): CircuitInterface {
  const inputs: PortInfo[] = [];
  const outputs: PortInfo[] = [];
  const clocks: string[] = [];

  const inputRegex = /input\s+(\w+)\s*:\s*(Bit|Bus(?:\[(\d+)\])?)/g;
  let match;
  while ((match = inputRegex.exec(body)) !== null) {
    inputs.push({
      name: match[1],
      type: match[2].startsWith('Bus') ? 'Bus' : 'Bit',
      width: match[3] ? parseInt(match[3], 10) : undefined,
    });
  }

  const outputRegex = /output\s+(\w+)\s*:\s*(Bit|Bus(?:\[(\d+)\])?)/g;
  while ((match = outputRegex.exec(body)) !== null) {
    outputs.push({
      name: match[1],
      type: match[2].startsWith('Bus') ? 'Bus' : 'Bit',
      width: match[3] ? parseInt(match[3], 10) : undefined,
    });
  }

  const clockRegex = /clock\s+(\w+)/g;
  while ((match = clockRegex.exec(body)) !== null) {
    clocks.push(match[1]);
  }

  return { name, inputs, outputs, clocks };
}

// ============================================================================
// Analysis
// ============================================================================

/**
 * Analyze DSL code to determine if it needs a harness.
 */
export function analyzeForHarness(dslCode: string): HarnessAnalysis {
  const iface = extractCircuitInterface(dslCode);

  if (!iface) {
    return {
      needsHarness: false,
      reason: 'No circuit found in DSL',
    };
  }

  const hasInterface = iface.inputs.length > 0 || iface.outputs.length > 0;

  if (!hasInterface) {
    return {
      needsHarness: false,
      reason: 'Circuit has no interface ports (already self-contained)',
    };
  }

  // Check if it already looks like a harness
  if (isHarnessName(iface.name)) {
    return {
      needsHarness: false,
      reason: 'Circuit appears to already be a harness',
    };
  }

  // Check if DSL already has interactive components
  const hasSwitch = /node\s+\w+\s*:\s*Switch/i.test(dslCode);
  const hasButton = /node\s+\w+\s*:\s*Button/i.test(dslCode);
  const hasInput = /node\s+\w+\s*:\s*Input/i.test(dslCode);
  const hasDisplay = /node\s+\w+\s*:\s*(Display|HexDisplay)/i.test(dslCode);
  const hasLED = /node\s+\w+\s*:\s*LED/i.test(dslCode);
  const hasScreen = /node\s+\w+\s*:\s*Screen/i.test(dslCode);

  const hasInteractiveInputs = hasSwitch || hasButton || hasInput;
  const hasDisplayOutputs = hasDisplay || hasLED || hasScreen;

  if (hasInteractiveInputs && hasDisplayOutputs) {
    return {
      needsHarness: false,
      reason: 'Circuit already has interactive inputs and displays',
    };
  }

  return {
    needsHarness: true,
    reason: `Circuit "${iface.name}" has ${iface.inputs.length} input(s) and ${iface.outputs.length} output(s) that need interactive controls`,
    interface: iface,
  };
}

// ============================================================================
// DSL Generation
// ============================================================================

/**
 * Generate harness DSL code for a circuit interface.
 */
export function generateHarnessDSL(iface: CircuitInterface): string {
  const lines: string[] = [];
  const { name, inputs, outputs, clocks } = iface;

  // Header
  lines.push(`// Test Harness for ${name}`);
  lines.push(`// Interactive wrapper with controls and displays`);
  lines.push('');

  // Circuit declaration (no interface - self-contained)
  lines.push(`circuit ${name}Harness {`);
  lines.push('  impl {');

  // Input controls
  if (inputs.length > 0) {
    lines.push('    // === Input Controls ===');
    for (const input of inputs) {
      const component = input.type === 'Bus' ? 'Input(value=0)' : 'Switch(value=0)';
      lines.push(`    node ${input.name}_sw: ${component}`);
    }
    lines.push('');
  }

  // DUT
  lines.push('    // === Device Under Test ===');
  lines.push(`    node dut: ${name}`);
  lines.push('');

  // Wire inputs
  if (inputs.length > 0) {
    lines.push('    // === Input Wiring ===');
    for (const input of inputs) {
      lines.push(`    connect ${input.name}_sw.out -> dut.${input.name}`);
    }
    lines.push('');
  }

  // Output displays
  if (outputs.length > 0) {
    lines.push('    // === Output Displays ===');
    for (const output of outputs) {
      const component = output.type === 'Bus' ? 'HexDisplay' : 'Led';
      lines.push(`    node ${output.name}_out: ${component}`);
    }
    lines.push('');

    lines.push('    // === Output Wiring ===');
    for (const output of outputs) {
      lines.push(`    connect dut.${output.name} -> ${output.name}_out.in`);
    }
  }

  // Clock note
  if (clocks.length > 0) {
    lines.push('');
    lines.push(`    // Clock${clocks.length > 1 ? 's' : ''}: ${clocks.join(', ')} (driven by simulator)`);
  }

  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate a complete harness from DSL code.
 * Returns null if no harness is needed.
 */
export function generateHarness(dslCode: string): string | null {
  const analysis = analyzeForHarness(dslCode);

  if (!analysis.needsHarness || !analysis.interface) {
    return null;
  }

  return generateHarnessDSL(analysis.interface);
}

/**
 * Generate harness and append to original DSL.
 * Returns the combined DSL code.
 */
export function generateHarnessAppended(dslCode: string): string {
  const harness = generateHarness(dslCode);

  if (!harness) {
    return dslCode;
  }

  return `${dslCode.trim()}\n\n${harness}`;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if a name looks like a harness.
 */
export function isHarnessName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('harness') ||
         lower.endsWith('_harness') ||
         lower.endsWith('wrapper') ||
         lower.endsWith('_tb') ||
         lower.startsWith('tb_');
}
