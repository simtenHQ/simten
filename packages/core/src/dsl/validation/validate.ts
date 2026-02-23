/**
 * Main Validation Orchestration
 *
 * Orchestrates the 4-phase validation pipeline:
 * - Phase 1: Syntax (Chevrotain parser)
 * - Phase 2: Semantic (Validator)
 * - Phase 3: Type (IR Compilation)
 * - Phase 4: Structural (Elaboration + Cycle/Port checks)
 *
 * Design Principles:
 * - Phase guarding: Later phases don't run if blocking errors exist
 * - Deterministic output: Same input produces same diagnostic order
 * - Parser-agnostic: Swapping Chevrotain for Tree-sitter only affects Phase 1
 * - Isolated per-circuit: One broken circuit doesn't block others
 */

import { parseDSL } from '../parser/index.js';
import type { ValidationError as ParserValidationError } from '../parser/index.js';
import { compileToIR, CompilerError } from '../compiler/index.js';
import type { ComponentLibrary as CompilerLibrary } from '../compiler/index.js';
import { elaborate } from '../../simulator/elaboration.js';
import type {
  Circuit,
  ComponentLibrary,
} from '../../types/circuit.js';
import type { Program } from '../types/ast.js';

import type {
  ValidationResult,
  ValidationContext,
  Diagnostic,
  DiagnosticCode,
  ValidationPhase,
  ValidationSummary,
  AnalysisContext,
  ComponentInterface,
} from './types.js';
import {
  isBlocking,
  createDefaultValidationContext,
  formatPortType,
} from './types.js';
import { runStructuralChecks } from './structural.js';

// ============================================================================
// Diagnostic Conversion
// ============================================================================

/**
 * Convert parser/validator errors to our Diagnostic format.
 */
function convertParserErrors(errors: ParserValidationError[]): Diagnostic[] {
  return errors.map((error) => {
    // Map category to phase
    let phase: ValidationPhase = 'syntax';
    if (error.category === 'semantic') {
      phase = 'semantic';
    } else if (error.category === 'structure') {
      phase = 'syntax';
    }

    // Infer diagnostic code from message
    const code = inferDiagnosticCode(error.message, phase);

    return {
      phase,
      code,
      severity: error.severity,
      message: error.message,
      location: error.location,
      suggestions: error.suggestions,
    };
  });
}

/**
 * Infer a diagnostic code from the error message.
 */
function inferDiagnosticCode(message: string, phase: ValidationPhase): DiagnosticCode {
  const lowerMessage = message.toLowerCase();

  // Semantic errors
  if (lowerMessage.includes('unknown component')) return 'UNKNOWN_COMPONENT';
  if (lowerMessage.includes('duplicate')) return 'DUPLICATE_NAME';
  if (lowerMessage.includes('undefined port')) return 'UNDEFINED_PORT';
  if (lowerMessage.includes('undefined node')) return 'UNDEFINED_NODE';
  if (lowerMessage.includes('undefined parameter')) return 'UNDEFINED_PARAMETER';
  if (lowerMessage.includes('undefined clock')) return 'UNDEFINED_CLOCK';
  if (lowerMessage.includes('undefined variable')) return 'UNDEFINED_VARIABLE';
  if (lowerMessage.includes('undefined')) return 'UNDEFINED_REFERENCE';
  if (lowerMessage.includes('multiple drivers')) return 'MULTIPLE_DRIVERS';

  // Type errors
  if (lowerMessage.includes('width mismatch')) return 'WIDTH_MISMATCH';
  if (lowerMessage.includes('type mismatch')) return 'TYPE_MISMATCH';

  // Syntax errors
  if (phase === 'syntax') {
    if (lowerMessage.includes('unexpected')) return 'UNEXPECTED_TOKEN';
    if (lowerMessage.includes('missing')) return 'MISSING_TOKEN';
    return 'SYNTAX_ERROR';
  }

  // Default
  return 'INTERNAL_ERROR';
}

/**
 * Convert a compiler error to a Diagnostic.
 */
function compilerErrorToDiagnostic(error: Error): Diagnostic {
  const compilerError = error instanceof CompilerError ? error : null;
  const message = error.message;
  const code = inferDiagnosticCode(message, 'type');

  return {
    phase: 'type',
    code,
    severity: 'error',
    message: message,
    location: compilerError?.location
      ? {
          start: {
            line: compilerError.location.line,
            column: compilerError.location.column,
            offset: 0,
          },
          end: {
            line: compilerError.location.line,
            column: compilerError.location.column + 1,
            offset: 0,
          },
        }
      : undefined,
    suggestions: compilerError?.circuitName
      ? [`Error in circuit '${compilerError.circuitName}'`]
      : undefined,
  };
}

/**
 * Create a diagnostic for elaboration errors.
 */
function elaborationErrorToDiagnostic(circuitName: string, error: Error): Diagnostic {
  return {
    phase: 'structural',
    code: 'ELABORATION_ERROR',
    severity: 'error',
    message: `Failed to elaborate circuit '${circuitName}': ${error.message}`,
    suggestions: [
      'Check that all referenced components exist',
      'Verify component arguments are correct',
    ],
  };
}

// ============================================================================
// Diagnostic Sorting
// ============================================================================

/**
 * Deterministic ordering: phase → line → severity → code (alphabetical)
 * Final tie-breaker prevents nondeterministic reordering of same-line diagnostics
 */
function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  // Phase order
  const phaseOrder: ValidationPhase[] = ['syntax', 'semantic', 'type', 'structural', 'runtime'];
  const phaseCompare = phaseOrder.indexOf(a.phase) - phaseOrder.indexOf(b.phase);
  if (phaseCompare !== 0) return phaseCompare;

  // Line order
  const lineA = a.location?.start.line ?? 0;
  const lineB = b.location?.start.line ?? 0;
  if (lineA !== lineB) return lineA - lineB;

  // Column order
  const colA = a.location?.start.column ?? 0;
  const colB = b.location?.start.column ?? 0;
  if (colA !== colB) return colA - colB;

  // Severity order (error before warning before info)
  const sevOrder = ['error', 'warning', 'info'];
  const sevCompare = sevOrder.indexOf(a.severity) - sevOrder.indexOf(b.severity);
  if (sevCompare !== 0) return sevCompare;

  // Final tie-breaker: alphabetical by code for LLM stability
  return a.code.localeCompare(b.code);
}

// ============================================================================
// Summary Building
// ============================================================================

/**
 * Build summary statistics from diagnostics.
 */
function buildSummary(diagnostics: Diagnostic[]): ValidationSummary {
  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  const phasesWithDiagnostics = new Set<ValidationPhase>();

  for (const d of diagnostics) {
    if (d.severity === 'error') errorCount++;
    else if (d.severity === 'warning') warningCount++;
    else if (d.severity === 'info') infoCount++;

    phasesWithDiagnostics.add(d.phase);
  }

  return {
    errorCount,
    warningCount,
    infoCount,
    phasesWithDiagnostics: Array.from(phasesWithDiagnostics).sort(),
  };
}

// ============================================================================
// Analysis Context Building
// ============================================================================

/**
 * Build analysis context from AST and validation results.
 */
function buildAnalysisContext(
  ast: Program | undefined,
  diagnostics: Diagnostic[]
): AnalysisContext {
  const circuitsDefined: string[] = [];
  const componentsUsed = new Set<string>();
  const unresolvedReferences: string[] = [];

  // Extract circuits defined
  if (ast) {
    for (const circuit of ast.circuits) {
      circuitsDefined.push(circuit.name);

      // Extract components used
      if (circuit.impl) {
        for (const node of circuit.impl.nodes) {
          if (node.componentType) {
            componentsUsed.add(node.componentType);
          }
        }
      }
    }
  }

  // Extract unresolved references from diagnostics
  for (const d of diagnostics) {
    if (d.code === 'UNKNOWN_COMPONENT' || d.code === 'UNDEFINED_REFERENCE') {
      // Try to extract the name from the message
      const match = d.message.match(/'([^']+)'/);
      if (match) {
        unresolvedReferences.push(match[1]);
      }
    }
  }

  return {
    circuitsDefined: circuitsDefined.sort(),
    componentsUsed: Array.from(componentsUsed).sort(),
    unresolvedReferences: [...new Set(unresolvedReferences)].sort(),
  };
}

// ============================================================================
// Component Catalog Building
// ============================================================================

/**
 * Build component catalog from library.
 */
export function buildComponentCatalog(library: ComponentLibrary): ComponentInterface[] {
  const catalog: ComponentInterface[] = [];

  // Get all primitive names if available
  const primitiveNames = library.getAllPrimitiveNames?.() ?? [];

  for (const name of primitiveNames) {
    const circuit = library.resolveComponent(name);
    if (circuit) {
      catalog.push(circuitToComponentInterface(circuit));
    }
  }

  // Sort for deterministic output
  catalog.sort((a, b) => a.name.localeCompare(b.name));

  return catalog;
}

/**
 * Convert a Circuit to a ComponentInterface.
 */
function circuitToComponentInterface(circuit: Circuit): ComponentInterface {
  return {
    name: circuit.name,
    inputs: circuit.inputs.map((p) => ({
      name: p.name,
      type: formatPortType(p.portType),
    })),
    outputs: circuit.outputs.map((p) => ({
      name: p.name,
      type: formatPortType(p.portType),
    })),
    clocks: circuit.clocks.map((c) => ({ name: c.name })),
    parameters: circuit.parameters.map((p) => ({
      name: p.name,
      type: p.paramType,
      defaultValue: p.defaultValue?.toString(),
    })),
    kind: circuit.metadata?.kind,
    description: circuit.metadata?.description,
  };
}

// ============================================================================
// Library Adapter
// ============================================================================

/**
 * Adapt a ComponentLibrary to the compiler's interface.
 */
function adaptLibraryForCompiler(library: ComponentLibrary): CompilerLibrary {
  return {
    getCircuit: (name: string) => library.resolveComponent(name),
    hasCircuit: (name: string) => library.resolveComponent(name) !== undefined,
    addCircuit: () => {}, // No-op for validation
    getAllComponentNames: () => library.getAllPrimitiveNames?.() ?? [],
  };
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate DSL source code through all phases.
 *
 * This is the main entry point for the validation pipeline.
 * It runs phases sequentially with guarding based on blocking errors.
 */
export function validateCircuit(
  source: string,
  context: ValidationContext
): ValidationResult {
  const ctx = {
    ...createDefaultValidationContext(context.componentLibrary, context.sourceName),
    ...context,
  };

  const diagnostics: Diagnostic[] = [];
  let ast: Program | undefined;
  let circuits: Circuit[] | undefined;

  // ========== Phase 1-2: Parse + Validate ==========
  // (Always runs - parser has its own error recovery)
  if (ctx.phases?.syntax !== false || ctx.phases?.semantic !== false) {
    const parseResult = parseDSL(source, {
      sourceName: ctx.sourceName,
      componentLibrary: ctx.componentLibrary,
    });

    ast = parseResult.ast;
    diagnostics.push(...convertParserErrors(parseResult.errors));
  }

  // Check for blocking errors before continuing
  const hasBlockingAfterParse = diagnostics.some(isBlocking);

  // ========== Phase 3: IR Compilation (Type Checking) ==========
  if (ctx.phases?.type !== false && !hasBlockingAfterParse && ast) {
    try {
      const compilerLibrary = adaptLibraryForCompiler(ctx.componentLibrary);
      circuits = compileToIR(ast, compilerLibrary);
    } catch (e) {
      diagnostics.push(compilerErrorToDiagnostic(e as Error));
    }
  }

  // CRITICAL: Recompute blocking errors after type phase
  // compileToIR might succeed but push type diagnostics, or we converted exceptions
  const hasBlockingAfterType = diagnostics.some(isBlocking);

  // ========== Phase 4: Structural Checks ==========
  // Guard by blocking errors, not just "circuits exist"
  // IMPORTANT: Iterate circuits in definition order (AST order), not Object.values()
  // This ensures deterministic diagnostic ordering across runs
  if (
    ctx.phases?.structural !== false &&
    !hasBlockingAfterType &&
    circuits &&
    circuits.length > 0
  ) {
    for (const circuit of circuits) {
      // CRITICAL: Isolate per-circuit - one broken circuit must not block others
      try {
        const flat = elaborate(circuit, ctx.componentLibrary);
        const structural = runStructuralChecks(flat, ctx.componentLibrary);
        diagnostics.push(...structural.diagnostics);
      } catch (e) {
        diagnostics.push(elaborationErrorToDiagnostic(circuit.name, e as Error));
      }
    }
  }

  // Sort diagnostics deterministically for LLM stability
  diagnostics.sort(compareDiagnostics);

  // Build result
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const hasBlockingErrors = diagnostics.some(isBlocking);

  return {
    valid: errorCount === 0,
    canSimulate: !hasBlockingErrors,
    diagnostics,
    ast,
    circuits,
    availableComponents: buildComponentCatalog(ctx.componentLibrary),
    summary: buildSummary(diagnostics),
    analysis: buildAnalysisContext(ast, diagnostics),
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick validation check - returns true if valid.
 */
export function isValid(source: string, library: ComponentLibrary): boolean {
  const result = validateCircuit(source, { componentLibrary: library });
  return result.valid;
}

/**
 * Quick simulation readiness check - returns true if can simulate.
 */
export function canSimulate(source: string, library: ComponentLibrary): boolean {
  const result = validateCircuit(source, { componentLibrary: library });
  return result.canSimulate;
}

/**
 * Validate and throw on errors.
 */
export function validateOrThrow(
  source: string,
  library: ComponentLibrary
): ValidationResult {
  const result = validateCircuit(source, { componentLibrary: library });

  if (!result.valid) {
    const errorMessages = result.diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => {
        const loc = d.location
          ? ` at line ${d.location.start.line}:${d.location.start.column}`
          : '';
        return `[${d.code}] ${d.message}${loc}`;
      })
      .join('\n');

    throw new Error(`Validation failed:\n${errorMessages}`);
  }

  return result;
}
