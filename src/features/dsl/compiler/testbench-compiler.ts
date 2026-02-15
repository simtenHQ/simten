/**
 * Testbench Compiler
 *
 * Compiles testbench AST to executable testbench IR.
 *
 * Key responsibilities:
 * - Resolve circuit reference from component library
 * - Clone circuit to prevent library mutation (CRITICAL!)
 * - Build test circuit with DUT + test infrastructure
 * - Compile stimulus schedule
 * - Configure VCD capture
 * - Validate port mappings
 *
 * Design Principles:
 * - DUT immutability: Always clone before modification
 * - Helpful errors: Show available components if not found
 * - Component library is source of truth
 */

import { TestbenchDef, StimulusBlock, CaptureBlock } from '../types/testbench-ast';
import {
  Testbench,
  StimulusSchedule,
  CaptureConfig,
  SignalRef,
} from '../../visual-editor/types/testbench';
import {
  Circuit,
  Node as IRNode,
  Connection as IRConnection,
} from '../../visual-editor/types/ir-v0.1';
import { compileStimulus, validateStimulus } from '../../visual-editor/lib/testing/stimulus-compiler';
import { getMaxStimulusCycle } from '../../visual-editor/types/testbench';

// ============================================================================
// Compiler Errors
// ============================================================================

export class TestbenchCompilerError extends Error {
  constructor(
    message: string,
    public testbenchName?: string,
    public location?: { line: number; column: number }
  ) {
    super(message);
    this.name = 'TestbenchCompilerError';
  }
}

export class ComponentNotFoundError extends TestbenchCompilerError {
  constructor(
    circuitName: string,
    availableComponents: {
      primitives: string[];
      standard: string[];
      user: string[];
    },
    testbenchName?: string
  ) {
    const primitivesStr = availableComponents.primitives.length > 0
      ? `  Primitives (${availableComponents.primitives.length}): ${availableComponents.primitives.slice(0, 10).join(', ')}${availableComponents.primitives.length > 10 ? ', ...' : ''}`
      : '  Primitives: (none)';

    const standardStr = availableComponents.standard.length > 0
      ? `  Standard (${availableComponents.standard.length}): ${availableComponents.standard.slice(0, 10).join(', ')}${availableComponents.standard.length > 10 ? ', ...' : ''}`
      : '  Standard: (none)';

    const userStr = availableComponents.user.length > 0
      ? `  User (${availableComponents.user.length}): ${availableComponents.user.slice(0, 10).join(', ')}${availableComponents.user.length > 10 ? ', ...' : ''}`
      : '  User: (none)';

    const message =
      `Circuit '${circuitName}' not found in component library.\n\n` +
      `To fix this:\n` +
      `  • Load ${circuitName}.dsl into the editor first\n` +
      `  • Or check that the circuit name matches exactly\n\n` +
      `Available circuits:\n` +
      `${primitivesStr}\n` +
      `${standardStr}\n` +
      `${userStr}\n\n` +
      `Load ${circuitName}.dsl first or check circuit name.`;

    super(message, testbenchName);
    this.name = 'ComponentNotFoundError';
  }
}

// ============================================================================
// Component Library Interface
// ============================================================================

/**
 * Interface for component library (matches useComponentLibraryStore)
 */
export interface ComponentLibraryInterface {
  resolveComponent: (name: string) => Circuit | undefined;
  getAllPrimitiveNames: () => string[];
  getAllStandardNames: () => string[];
  getAllUserNames: () => string[];
  registerUser: (circuit: Circuit) => void;
}

// ============================================================================
// Testbench Compiler
// ============================================================================

/**
 * Compile testbench AST to executable IR
 *
 * @param testbenchAst - Testbench definition from parser
 * @param library - Component library for circuit resolution
 * @returns Executable testbench IR
 */
export function compileTestbenchToIR(
  testbenchAst: TestbenchDef,
  library: ComponentLibraryInterface
): Testbench {
  // 1. Resolve circuit from component library
  const dutTemplate = library.resolveComponent(testbenchAst.circuitRef.circuitName);

  if (!dutTemplate) {
    throw new ComponentNotFoundError(
      testbenchAst.circuitRef.circuitName,
      {
        primitives: library.getAllPrimitiveNames(),
        standard: library.getAllStandardNames(),
        user: library.getAllUserNames(),
      },
      testbenchAst.name
    );
  }

  // 2. CRITICAL: Clone circuit to prevent library mutation
  const dut = deepCloneCircuit(dutTemplate);

  // 3. Build test circuit (DUT + test infrastructure)
  const testCircuit = buildTestCircuit(dut, testbenchAst, library);

  // 4. Compile stimulus schedule
  let stimulus: StimulusSchedule;
  if (testbenchAst.impl?.stimulus && testbenchAst.impl.stimulus.length > 0) {
    // For now, only support single stimulus block
    const stimulusBlock = testbenchAst.impl.stimulus[0];
    stimulus = compileStimulus(stimulusBlock);
    validateStimulus(stimulus);
  } else {
    // Empty stimulus schedule
    stimulus = {
      clockRef: testbenchAst.clocks[0]?.name || 'clk',
      events: new Map(),
    };
  }

  // 5. Configure VCD capture
  const capture = testbenchAst.impl?.capture
    ? compileCaptureConfig(testbenchAst.impl.capture, dut)
    : undefined;

  // 6. Calculate max cycles
  const maxCycles = getMaxStimulusCycle(stimulus) || 100; // Default to 100 if no stimulus

  // 7. Build testbench IR
  const testbench: Testbench = {
    name: testbenchAst.name,
    circuitRef: testbenchAst.circuitRef.circuitName,
    dutInstanceId: 'dut', // Standard instance name
    circuit: testCircuit,
    stimulus,
    capture,
    maxCycles,
  };

  return testbench;
}

// ============================================================================
// Circuit Cloning (CRITICAL - Prevents Library Mutation)
// ============================================================================

/**
 * Deep clone a circuit to prevent mutation of component library
 *
 * CRITICAL: This must be called before any modifications to the circuit
 */
function deepCloneCircuit(circuit: Circuit): Circuit {
  return {
    ...circuit,
    id: `${circuit.id}_clone_${Date.now()}`,
    parameters: [...circuit.parameters],
    inputs: circuit.inputs.map(p => ({ ...p, portType: { ...p.portType } })),
    outputs: circuit.outputs.map(p => ({ ...p, portType: { ...p.portType } })),
    clocks: [...circuit.clocks],
    state: circuit.state.map(s => ({
      ...s,
      stateType: { ...s.stateType },
      initialValue: cloneStateValue(s.initialValue),
      currentValue: s.currentValue !== undefined ? cloneStateValue(s.currentValue) : undefined,
    })),
    nodes: circuit.nodes.map(n => ({
      ...n,
      arguments: { ...n.arguments },
      inputs: n.inputs.map(p => ({ ...p, portType: { ...p.portType } })),
      outputs: n.outputs.map(p => ({ ...p, portType: { ...p.portType } })),
      clocks: n.clocks.map(c => ({ ...c })),
    })),
    connections: circuit.connections.map(c => ({
      ...c,
      source: { ...c.source },
      target: { ...c.target },
      portType: { ...c.portType },
    })),
    implementation: { ...circuit.implementation },
    metadata: circuit.metadata ? {
      ...circuit.metadata,
      testCases: circuit.metadata.testCases?.map(tc => ({ ...tc })),
      tags: circuit.metadata.tags ? [...circuit.metadata.tags] : undefined,
    } : undefined,
  };
}

function cloneStateValue(value: any): any {
  if (value && typeof value === 'object' && 'data' in value) {
    // MemoryValue with Map
    return {
      ...value,
      data: new Map(value.data),
    };
  }
  return value;
}

// ============================================================================
// Test Circuit Construction
// ============================================================================

/**
 * Build test circuit that includes DUT + test infrastructure
 *
 * Creates DUT as a composite instance instead of flattening.
 */
function buildTestCircuit(
  dut: Circuit,
  testbenchAst: TestbenchDef,
  library: ComponentLibraryInterface
): Circuit {
  const nodes: IRNode[] = [];
  const connections: IRConnection[] = [];

  // Register DUT in library with unique, timestamped name (prevents collisions)
  const dutComponentName = `${testbenchAst.name}_DUT_${dut.name}_${Date.now()}`;
  library.registerUser({ ...dut, name: dutComponentName });

  // Create DUT instance node
  const dutInstanceNode: IRNode = {
    id: 'dut',
    label: dut.name,
    componentRef: dutComponentName,
    arguments: {},
    inputs: dut.inputs.map(p => ({
      id: `dut.${p.name}`,
      name: p.name,
      portType: p.portType,
    })),
    outputs: dut.outputs.map(p => ({
      id: `dut.${p.name}`,
      name: p.name,
      portType: p.portType,
    })),
    clocks: dut.clocks.map(c => ({
      id: `dut.${c.name}`,
      name: c.name,
    })),
  };

  nodes.push(dutInstanceNode);

  // Add Input nodes for each testbench input
  for (const testInput of testbenchAst.inputs) {
    const inputNode: IRNode = {
      id: `tb_input_${testInput.name}`,
      label: testInput.name,
      componentRef: 'Input',
      arguments: { value: 0 }, // Default value
      inputs: [],
      outputs: [
        {
          id: `tb_input_${testInput.name}_out`,
          name: 'out',
          portType: testInput.portType === 'Bus'
            ? { kind: 'bus' as const, width: testInput.width || 8 }
            : { kind: 'bit' as const },
        },
      ],
      clocks: [],
    };

    nodes.push(inputNode);

    // Connect Input node to DUT input
    connections.push({
      id: `tb_conn_${testInput.name}`,
      source: {
        nodeId: inputNode.id,
        portName: 'out',
      },
      target: {
        nodeId: 'dut', // DUT instance
        portName: testInput.name,
      },
      portType: inputNode.outputs[0].portType,
    });
  }

  // Add Output nodes for each testbench output
  for (const testOutput of testbenchAst.outputs) {
    const outputNode: IRNode = {
      id: `tb_output_${testOutput.name}`,
      label: testOutput.name,
      componentRef: 'Output',
      arguments: {},
      inputs: [
        {
          id: `tb_output_${testOutput.name}_in`,
          name: 'in',
          portType: testOutput.portType === 'Bus'
            ? { kind: 'bus' as const, width: testOutput.width || 8 }
            : { kind: 'bit' as const },
        },
      ],
      outputs: [],
      clocks: [],
    };

    nodes.push(outputNode);

    // Connect DUT output to Output node
    connections.push({
      id: `tb_conn_out_${testOutput.name}`,
      source: {
        nodeId: 'dut', // DUT instance
        portName: testOutput.name,
      },
      target: {
        nodeId: outputNode.id,
        portName: 'in',
      },
      portType: outputNode.inputs[0].portType,
    });
  }

  // Return test circuit with DUT instance + test infrastructure
  return {
    id: `testbench_${testbenchAst.name}_${Date.now()}`,
    name: `${testbenchAst.name}_circuit`,
    parameters: [],
    inputs: [],
    outputs: [],
    clocks: dut.clocks,
    state: [],
    nodes,
    connections,
    implementation: { kind: 'composite' },
    metadata: {
      description: `Testbench circuit for ${testbenchAst.name}`,
      tags: ['testbench'],
    },
  };
}

// ============================================================================
// Capture Configuration
// ============================================================================

/**
 * Compile capture block to VCD configuration
 */
function compileCaptureConfig(
  captureBlock: CaptureBlock,
  dut: Circuit
): CaptureConfig {
  const signals: SignalRef[] = [];

  // Map signal names to actual ports
  for (const signalName of captureBlock.signals) {
    // Check if it's a circuit input
    const inputPort = dut.inputs.find(p => p.name === signalName);
    if (inputPort) {
      signals.push({
        nodeId: 'dut', // DUT instance
        portName: signalName,
        displayName: signalName,
        width: inputPort.portType.kind === 'bus' ? inputPort.portType.width : 1,
      });
      continue;
    }

    // Check if it's a circuit output
    const outputPort = dut.outputs.find(p => p.name === signalName);
    if (outputPort) {
      signals.push({
        nodeId: 'dut', // DUT instance
        portName: signalName,
        displayName: signalName,
        width: outputPort.portType.kind === 'bus' ? outputPort.portType.width : 1,
      });
      continue;
    }

    // If not found, warn but don't fail (might be internal signal)
    console.warn(`Capture signal '${signalName}' not found in circuit ports`);
  }

  return {
    signals,
    format: 'vcd',
    filename: captureBlock.filename,
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate testbench against DUT circuit
 *
 * Checks:
 * - All stimulus signals exist in DUT
 * - All capture signals exist in DUT
 * - Clock references are valid
 */
export function validateTestbenchAgainstDUT(
  testbenchAst: TestbenchDef,
  dut: Circuit
): void {
  // Validate stimulus signals
  if (testbenchAst.impl?.stimulus) {
    for (const stimulusBlock of testbenchAst.impl.stimulus) {
      validateStimulusSignals(stimulusBlock, dut);
    }
  }

  // Validate capture signals
  if (testbenchAst.impl?.capture) {
    validateCaptureSignals(testbenchAst.impl.capture, dut);
  }

  // Validate clock references
  for (const clockDecl of testbenchAst.clocks) {
    const clockExists = dut.clocks.some(c => c.name === clockDecl.name);
    if (!clockExists && dut.clocks.length > 0) {
      throw new TestbenchCompilerError(
        `Clock '${clockDecl.name}' not found in circuit '${dut.name}'. ` +
        `Available clocks: ${dut.clocks.map(c => c.name).join(', ')}`,
        testbenchAst.name,
        clockDecl.location?.start
      );
    }
  }
}

/**
 * Validate stimulus signals exist in DUT
 */
function validateStimulusSignals(stimulusBlock: StimulusBlock, dut: Circuit): void {
  const allInputNames = dut.inputs.map(p => p.name);

  for (const event of stimulusBlock.events) {
    for (const assignment of event.assignments) {
      const signalName = assignment.signal;

      if (!allInputNames.includes(signalName)) {
        // Try to find similar names for helpful error message
        const similar = findSimilarNames(signalName, allInputNames);
        const didYouMean = similar.length > 0 ? `\n\nDid you mean '${similar[0]}'?` : '';

        throw new TestbenchCompilerError(
          `Stimulus signal '${signalName}' not found in circuit '${dut.name}'.` +
          `\n\nAvailable inputs: ${allInputNames.join(', ')}` +
          didYouMean,
          undefined,
          assignment.location?.start
        );
      }
    }
  }
}

/**
 * Validate capture signals exist in DUT
 */
function validateCaptureSignals(captureBlock: CaptureBlock, dut: Circuit): void {
  const allPortNames = [
    ...dut.inputs.map(p => p.name),
    ...dut.outputs.map(p => p.name),
  ];

  for (const signalName of captureBlock.signals) {
    if (!allPortNames.includes(signalName)) {
      const similar = findSimilarNames(signalName, allPortNames);
      const didYouMean = similar.length > 0 ? `\n\nDid you mean '${similar[0]}'?` : '';

      throw new TestbenchCompilerError(
        `Capture signal '${signalName}' not found in circuit '${dut.name}'.` +
        `\n\nAvailable ports: ${allPortNames.join(', ')}` +
        didYouMean,
        undefined,
        captureBlock.location?.start
      );
    }
  }
}

/**
 * Find similar names using Levenshtein distance
 */
function findSimilarNames(target: string, candidates: string[]): string[] {
  const distances = candidates.map(candidate => ({
    name: candidate,
    distance: levenshteinDistance(target.toLowerCase(), candidate.toLowerCase()),
  }));

  return distances
    .filter(d => d.distance <= 2) // Only suggest if very similar
    .sort((a, b) => a.distance - b.distance)
    .map(d => d.name);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
