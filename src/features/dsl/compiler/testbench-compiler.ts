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

import { TestbenchDef, StimulusBlock, CaptureBlock, AssertBlock, Assertion } from '../types/testbench-ast';
import {
  Testbench,
  StimulusSchedule,
  CaptureConfig,
  SignalRef,
  AssertionSchedule,
  CompiledAssertion,
  TestbenchState,
} from '../../visual-editor/types/testbench';
import {
  Circuit,
  Node as IRNode,
  Connection as IRConnection,
} from '../../visual-editor/types/circuit';
import { compileStimulus, validateStimulus } from '../../visual-editor/lib/testing/stimulus-compiler';
import { getMaxStimulusCycle } from '../../visual-editor/types/testbench';
import { Expr, LiteralExpr, VariableExpr, BinaryExpr, UnaryExpr } from '../types/ast';

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

  // 6. Compile assertion schedule
  const assertions =
    testbenchAst.impl?.assertions && testbenchAst.impl.assertions.length > 0
      ? compileAssertions(testbenchAst.impl.assertions)
      : undefined;

  // 7. Calculate max cycles
  const maxCycles = getMaxStimulusCycle(stimulus) || 100; // Default to 100 if no stimulus

  // 8. Build testbench IR
  const testbench: Testbench = {
    name: testbenchAst.name,
    circuitRef: testbenchAst.circuitRef.circuitName,
    dutInstanceId: 'dut', // Standard instance name
    circuit: testCircuit,
    stimulus,
    capture,
    assertions,
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
// Assertion Compilation
// ============================================================================

/**
 * Compile assertion blocks into an executable AssertionSchedule.
 *
 * Each Assertion expands its timing (single / range / stepped) to produce
 * one CompiledAssertion per cycle.  The condition is compiled to a closure
 * that reads signal values from the live TestbenchState at runtime.
 */
export function compileAssertions(assertBlocks: AssertBlock[]): AssertionSchedule {
  // All assert blocks must share the same clock reference.
  // Use the first block's clockRef as canonical (validation can enforce parity).
  const clockRef = assertBlocks[0].clockRef;

  const assertionMap = new Map<number, CompiledAssertion[]>();

  let assertionCounter = 0;

  for (const block of assertBlocks) {
    for (const assertion of block.assertions) {
      const cycles = expandAssertionTiming(assertion);
      const compiledCondition = compileConditionExpr(assertion.condition);
      const message =
        assertion.message ??
        `Assertion failed at cycle {cycle}`;

      for (const cycle of cycles) {
        const id = `assert_${assertionCounter++}_cycle_${cycle}`;
        const compiledAssertion: CompiledAssertion = {
          id,
          // The condition receives the live TestbenchState and resolves
          // signal values from portValues.  The cycle variable is
          // substituted at compile time for this specific expansion.
          condition: (state: TestbenchState) =>
            evaluateCondition(compiledCondition, state, cycle),
          message: message.replace('{cycle}', String(cycle)),
        };

        if (!assertionMap.has(cycle)) {
          assertionMap.set(cycle, []);
        }
        assertionMap.get(cycle)!.push(compiledAssertion);
      }
    }
  }

  return { clockRef, assertions: assertionMap };
}

/**
 * Expand assertion timing to an array of cycle numbers.
 * Reuses the same timing kinds as stimulus: single / range / stepped.
 */
function expandAssertionTiming(assertion: Assertion): number[] {
  const timing = assertion.timing;

  switch (timing.kind) {
    case 'single': {
      const cycle = evaluateStaticExpr(timing.cycle);
      return [cycle];
    }
    case 'range': {
      const start = evaluateStaticExpr(timing.start);
      const end = evaluateStaticExpr(timing.end);
      if (start > end) {
        throw new TestbenchCompilerError(
          `Invalid assertion range: start (${start}) > end (${end})`
        );
      }
      const cycles: number[] = [];
      for (let i = start; i <= end; i++) {
        cycles.push(i);
      }
      return cycles;
    }
    case 'stepped': {
      const start = evaluateStaticExpr(timing.start);
      const end = evaluateStaticExpr(timing.end);
      const step = timing.step;
      if (start > end) {
        throw new TestbenchCompilerError(
          `Invalid assertion range: start (${start}) > end (${end})`
        );
      }
      if (step <= 0) {
        throw new TestbenchCompilerError(
          `Invalid assertion step: ${step} (must be positive)`
        );
      }
      const cycles: number[] = [];
      for (let i = start; i <= end; i += step) {
        cycles.push(i);
      }
      return cycles;
    }
  }
}

/**
 * Evaluate a static expression (no signal references) to a number.
 * Used for timing expansions where only literal values are valid.
 */
function evaluateStaticExpr(expr: number | Expr): number {
  if (typeof expr === 'number') {
    return expr;
  }
  const result = evaluateConditionAtCycle(expr, new Map(), 0);
  if (typeof result !== 'number') {
    throw new TestbenchCompilerError(
      'Assertion timing expression must evaluate to a number'
    );
  }
  return result;
}

// ============================================================================
// Condition Expression Compiler
// ============================================================================

/**
 * Intermediate compiled condition — an Expr tree annotated for fast evaluation.
 * We keep the original Expr tree and evaluate it directly at runtime.
 */
type CompiledConditionExpr = Expr;

/**
 * "Compile" a condition expression.  For now this is identity — the Expr tree
 * is already structured for evaluation.  A future pass could pre-compute
 * constant sub-expressions here.
 */
function compileConditionExpr(expr: Expr): CompiledConditionExpr {
  return expr;
}

/**
 * Evaluate a compiled condition against live testbench state.
 *
 * Signal names in the expression map to portValues in TestbenchState.
 * The `cycle` variable resolves to the current cycle number.
 */
function evaluateCondition(
  expr: CompiledConditionExpr,
  state: TestbenchState,
  cycle: number
): boolean {
  const result = evaluateConditionAtCycle(expr, state.portValues, cycle);
  // Truthy check: numbers ≠ 0 are true, booleans pass through
  return typeof result === 'boolean' ? result : result !== 0;
}

/**
 * Recursive expression evaluator for assertion conditions.
 *
 * Supports:
 * - Numeric literals and boolean literals
 * - Variable references (resolved from portValues or `cycle` keyword)
 * - Binary operators: arithmetic, bitwise, comparison
 * - Unary operators: !, ~, -
 */
function evaluateConditionAtCycle(
  expr: Expr,
  portValues: Map<string, number | boolean>,
  cycle: number
): number | boolean {
  // Literal expression: { value: number | boolean | string }
  if ('value' in expr) {
    const literal = expr as LiteralExpr;
    if (typeof literal.value === 'number') return literal.value;
    if (typeof literal.value === 'boolean') return literal.value;
    // String literals are not valid in conditions
    throw new TestbenchCompilerError(
      `String literals are not valid in assertion conditions: "${literal.value}"`
    );
  }

  // Variable expression: { name: string }
  if ('name' in expr) {
    const variable = expr as VariableExpr;
    if (variable.name === 'cycle') {
      return cycle;
    }
    // Look up in port values
    const portValue = portValues.get(variable.name);
    if (portValue !== undefined) {
      return portValue;
    }
    // Unknown variable — treat as 0 rather than throwing, for robustness
    // during harness generation before wiring is complete
    return 0;
  }

  // Binary expression: { operator, left, right }
  if ('operator' in expr && 'left' in expr && 'right' in expr) {
    const binary = expr as BinaryExpr;
    const left = evaluateConditionAtCycle(binary.left, portValues, cycle);
    const right = evaluateConditionAtCycle(binary.right, portValues, cycle);

    if (typeof left === 'number' && typeof right === 'number') {
      switch (binary.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return Math.floor(left / right);
        case '&': return left & right;
        case '|': return left | right;
        case '^': return left ^ right;
        case '==': return left === right;
        case '!=': return left !== right;
        case '<': return left < right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '>=': return left >= right;
        default:
          throw new TestbenchCompilerError(`Unknown binary operator: ${binary.operator}`);
      }
    }

    if (typeof left === 'boolean' && typeof right === 'boolean') {
      switch (binary.operator) {
        case '==': return left === right;
        case '!=': return left !== right;
        default:
          throw new TestbenchCompilerError(
            `Operator '${binary.operator}' is not valid for boolean operands`
          );
      }
    }

    // Mixed number/boolean: coerce boolean to number
    const leftNum = typeof left === 'boolean' ? (left ? 1 : 0) : left;
    const rightNum = typeof right === 'boolean' ? (right ? 1 : 0) : right;
    switch (binary.operator) {
      case '==': return leftNum === rightNum;
      case '!=': return leftNum !== rightNum;
      default:
        throw new TestbenchCompilerError(
          `Type mismatch in assertion binary expression for operator '${binary.operator}'`
        );
    }
  }

  // Unary expression: { operator, operand }
  if ('operator' in expr && 'operand' in expr) {
    const unary = expr as UnaryExpr;
    const operand = evaluateConditionAtCycle(unary.operand, portValues, cycle);

    if (typeof operand === 'number') {
      switch (unary.operator) {
        case '-': return -operand;
        case '~': return ~operand;
        case '!': return operand === 0;
        default:
          throw new TestbenchCompilerError(`Unknown unary operator: ${unary.operator}`);
      }
    }

    if (typeof operand === 'boolean') {
      switch (unary.operator) {
        case '!': return !operand;
        default:
          throw new TestbenchCompilerError(
            `Unary operator '${unary.operator}' is not valid for boolean operands`
          );
      }
    }
  }

  throw new TestbenchCompilerError('Unrecognized expression shape in assertion condition');
}

// ============================================================================
// Assertion Validation
// ============================================================================

/**
 * Validate assertion signal references against DUT circuit ports.
 *
 * Checks that every variable name used in an assertion condition
 * exists as an input or output port of the DUT.
 */
export function validateAssertionSignals(
  assertBlocks: AssertBlock[],
  dut: { inputs: Array<{ name: string }>; outputs: Array<{ name: string }>; name: string }
): void {
  const allPortNames = new Set([
    ...dut.inputs.map(p => p.name),
    ...dut.outputs.map(p => p.name),
  ]);

  for (const block of assertBlocks) {
    for (const assertion of block.assertions) {
      collectSignalRefs(assertion.condition).forEach(signalName => {
        if (signalName === 'cycle') return; // Built-in variable
        if (!allPortNames.has(signalName)) {
          throw new TestbenchCompilerError(
            `Assertion references unknown signal '${signalName}' in circuit '${dut.name}'.` +
            `\n\nAvailable ports: ${Array.from(allPortNames).join(', ')}`
          );
        }
      });
    }
  }
}

/**
 * Collect all variable (signal) names referenced in an expression.
 */
function collectSignalRefs(expr: Expr): Set<string> {
  const names = new Set<string>();
  walkExpr(expr, names);
  return names;
}

function walkExpr(expr: Expr, names: Set<string>): void {
  if ('name' in expr) {
    names.add((expr as VariableExpr).name);
    return;
  }
  if ('left' in expr && 'right' in expr) {
    const binary = expr as BinaryExpr;
    walkExpr(binary.left, names);
    walkExpr(binary.right, names);
    return;
  }
  if ('operand' in expr) {
    walkExpr((expr as UnaryExpr).operand, names);
    return;
  }
  // Literal expressions have no variable refs
}

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
