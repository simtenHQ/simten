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
 * Returns the first circuit found that has interface ports.
 */
export function extractCircuitInterface(dslCode: string): CircuitInterface | null {
  // Match circuit declaration: circuit Name { ... }
  const circuitMatch = dslCode.match(/circuit\s+(\w+)\s*\{/);
  if (!circuitMatch) return null;

  const name = circuitMatch[1];

  // Extract inputs: input name: Type or input name: Bus[N]
  const inputs: PortInfo[] = [];
  const inputRegex = /input\s+(\w+)\s*:\s*(Bit|Bus(?:\[(\d+)\])?)/g;
  let match;
  while ((match = inputRegex.exec(dslCode)) !== null) {
    inputs.push({
      name: match[1],
      type: match[2].startsWith('Bus') ? 'Bus' : 'Bit',
      width: match[3] ? parseInt(match[3], 10) : undefined,
    });
  }

  // Extract outputs: output name: Type or output name: Bus[N]
  const outputs: PortInfo[] = [];
  const outputRegex = /output\s+(\w+)\s*:\s*(Bit|Bus(?:\[(\d+)\])?)/g;
  while ((match = outputRegex.exec(dslCode)) !== null) {
    outputs.push({
      name: match[1],
      type: match[2].startsWith('Bus') ? 'Bus' : 'Bit',
      width: match[3] ? parseInt(match[3], 10) : undefined,
    });
  }

  // Extract clocks: clock name
  const clocks: string[] = [];
  const clockRegex = /clock\s+(\w+)/g;
  while ((match = clockRegex.exec(dslCode)) !== null) {
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
  const hasDisplay = /node\s+\w+\s*:\s*Display/i.test(dslCode);
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
      const component = output.type === 'Bus' ? 'Display' : 'LED';
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
