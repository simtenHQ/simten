/**
 * Output Formatters
 *
 * Format validation results for different consumers:
 * - Monaco: IDE markers for in-editor display
 * - CLI: Human-readable terminal output
 * - LLM: Structured JSON for AI consumption
 *
 * Design Principles:
 * - NEVER omit fields from LLM output - LLMs treat missing keys as semantic signals
 * - Use empty arrays [] not undefined/null for missing data
 * - All output is deterministically sorted
 * - Keep LLM context concise but complete
 */

import type { ComponentLibrary } from '../../../core/simulator/types';
import type {
  ValidationResult,
  Diagnostic,
  ComponentInterface,
  AnalysisContext,
} from './types';
import { getGrammarSummary, getComponentCatalog } from './catalog';

// ============================================================================
// Monaco Format
// ============================================================================

/**
 * Monaco editor marker severity values.
 * These map to monaco.MarkerSeverity enum.
 */
const MONACO_SEVERITY = {
  Hint: 1,
  Info: 2,
  Warning: 4,
  Error: 8,
} as const;

/**
 * Monaco editor marker interface.
 */
export interface MonacoMarker {
  severity: number;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  code?: string;
  source?: string;
}

/**
 * Format validation result for Monaco editor.
 */
export function formatForMonaco(result: ValidationResult): MonacoMarker[] {
  const markers: MonacoMarker[] = [];

  for (const diagnostic of result.diagnostics) {
    const marker = diagnosticToMonacoMarker(diagnostic);
    if (marker) {
      markers.push(marker);
    }
  }

  return markers;
}

/**
 * Convert a diagnostic to a Monaco marker.
 */
function diagnosticToMonacoMarker(diagnostic: Diagnostic): MonacoMarker | null {
  // Skip diagnostics without location
  if (!diagnostic.location) {
    return null;
  }

  // Map severity
  let severity: number;
  switch (diagnostic.severity) {
    case 'error':
      severity = MONACO_SEVERITY.Error;
      break;
    case 'warning':
      severity = MONACO_SEVERITY.Warning;
      break;
    case 'info':
      severity = MONACO_SEVERITY.Info;
      break;
    default:
      severity = MONACO_SEVERITY.Info;
  }

  // Build message with suggestions
  let message = diagnostic.message;
  if (diagnostic.suggestions && diagnostic.suggestions.length > 0) {
    message += '\n\nSuggestions:\n  - ' + diagnostic.suggestions.join('\n  - ');
  }

  return {
    severity,
    message,
    startLineNumber: diagnostic.location.start.line,
    startColumn: diagnostic.location.start.column,
    endLineNumber: diagnostic.location.end.line,
    endColumn: diagnostic.location.end.column,
    code: diagnostic.code,
    source: 'dsl-validator',
  };
}

// ============================================================================
// CLI Format
// ============================================================================

/**
 * Options for CLI formatting.
 */
export interface CLIFormatOptions {
  /** Use colors in output */
  colors?: boolean;
  /** Show suggestions */
  showSuggestions?: boolean;
  /** Maximum number of diagnostics to show */
  maxDiagnostics?: number;
  /** Show summary */
  showSummary?: boolean;
}

const DEFAULT_CLI_OPTIONS: CLIFormatOptions = {
  colors: true,
  showSuggestions: true,
  maxDiagnostics: 50,
  showSummary: true,
};

/**
 * ANSI color codes.
 */
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

/**
 * Format validation result for CLI output.
 */
export function formatForCLI(
  result: ValidationResult,
  options: CLIFormatOptions = {}
): string {
  const opts = { ...DEFAULT_CLI_OPTIONS, ...options };
  const lines: string[] = [];

  // No diagnostics
  if (result.diagnostics.length === 0) {
    const checkmark = opts.colors ? `${COLORS.cyan}✓${COLORS.reset}` : '✓';
    lines.push(`${checkmark} No issues found`);
    return lines.join('\n');
  }

  // Format each diagnostic
  const diagnosticsToShow = result.diagnostics.slice(0, opts.maxDiagnostics);

  for (const diagnostic of diagnosticsToShow) {
    lines.push(formatDiagnosticForCLI(diagnostic, opts));
  }

  // Show truncation message if needed
  if (result.diagnostics.length > (opts.maxDiagnostics ?? 50)) {
    const remaining = result.diagnostics.length - (opts.maxDiagnostics ?? 50);
    const msg = `... and ${remaining} more diagnostic(s)`;
    lines.push(opts.colors ? `${COLORS.gray}${msg}${COLORS.reset}` : msg);
  }

  // Summary
  if (opts.showSummary) {
    lines.push('');
    lines.push(formatSummaryForCLI(result, opts));
  }

  return lines.join('\n');
}

/**
 * Format a single diagnostic for CLI.
 */
function formatDiagnosticForCLI(
  diagnostic: Diagnostic,
  opts: CLIFormatOptions
): string {
  const lines: string[] = [];

  // Severity prefix
  let severityStr: string;
  if (opts.colors) {
    switch (diagnostic.severity) {
      case 'error':
        severityStr = `${COLORS.red}${COLORS.bold}error${COLORS.reset}`;
        break;
      case 'warning':
        severityStr = `${COLORS.yellow}warning${COLORS.reset}`;
        break;
      case 'info':
        severityStr = `${COLORS.blue}info${COLORS.reset}`;
        break;
      default:
        severityStr = diagnostic.severity;
    }
  } else {
    severityStr = diagnostic.severity;
  }

  // Location
  let locationStr = '';
  if (diagnostic.location) {
    const loc = `${diagnostic.location.start.line}:${diagnostic.location.start.column}`;
    locationStr = opts.colors ? `${COLORS.gray}${loc}${COLORS.reset} - ` : `${loc} - `;
  }

  // Code
  const codeStr = opts.colors
    ? `${COLORS.gray}[${diagnostic.code}]${COLORS.reset}`
    : `[${diagnostic.code}]`;

  // Main line
  lines.push(`${locationStr}${severityStr} ${codeStr}: ${diagnostic.message}`);

  // Suggestions
  if (opts.showSuggestions && diagnostic.suggestions && diagnostic.suggestions.length > 0) {
    for (const suggestion of diagnostic.suggestions) {
      const prefix = opts.colors ? `${COLORS.gray}  → ${COLORS.reset}` : '  → ';
      lines.push(`${prefix}${suggestion}`);
    }
  }

  // Involved nodes
  if (diagnostic.involvedNodes && diagnostic.involvedNodes.length > 0) {
    const nodes = diagnostic.involvedNodes.join(', ');
    const prefix = opts.colors ? `${COLORS.gray}  nodes: ${COLORS.reset}` : '  nodes: ';
    lines.push(`${prefix}${nodes}`);
  }

  return lines.join('\n');
}

/**
 * Format summary for CLI.
 */
function formatSummaryForCLI(result: ValidationResult, opts: CLIFormatOptions): string {
  const { summary } = result;
  const parts: string[] = [];

  if (summary.errorCount > 0) {
    const str = `${summary.errorCount} error(s)`;
    parts.push(opts.colors ? `${COLORS.red}${str}${COLORS.reset}` : str);
  }

  if (summary.warningCount > 0) {
    const str = `${summary.warningCount} warning(s)`;
    parts.push(opts.colors ? `${COLORS.yellow}${str}${COLORS.reset}` : str);
  }

  if (summary.infoCount > 0) {
    const str = `${summary.infoCount} info`;
    parts.push(opts.colors ? `${COLORS.blue}${str}${COLORS.reset}` : str);
  }

  if (parts.length === 0) {
    return opts.colors
      ? `${COLORS.cyan}✓ No issues found${COLORS.reset}`
      : '✓ No issues found';
  }

  const status = result.valid
    ? opts.colors ? `${COLORS.cyan}✓${COLORS.reset}` : '✓'
    : opts.colors ? `${COLORS.red}✗${COLORS.reset}` : '✗';

  return `${status} ${parts.join(', ')}`;
}

// ============================================================================
// LLM Format
// ============================================================================

/**
 * LLM context status.
 */
export type LLMStatus = 'valid' | 'warnings' | 'errors';

/**
 * Options for LLM formatting.
 */
export interface LLMFormatOptions {
  /** Include grammar summary */
  includeGrammar?: boolean;
  /** Include full component catalog */
  includeComponents?: boolean;
  /** Maximum diagnostics to include */
  maxDiagnostics?: number;
}

const DEFAULT_LLM_OPTIONS: LLMFormatOptions = {
  includeGrammar: true,
  includeComponents: true,
  maxDiagnostics: 100,
};

/**
 * Structured LLM context output.
 * CRITICAL: All fields MUST be present (use null/[] for absent data).
 */
export interface LLMContext {
  /** Validation status */
  status: LLMStatus;
  /** All diagnostics (always present, may be []) */
  diagnostics: LLMDiagnostic[];
  /** Available components (always present, may be []) */
  components: ComponentInterface[];
  /** Grammar summary (always present) */
  grammarSummary: string;
  /** Analysis context (always present) */
  analysis: AnalysisContext;
}

/**
 * Simplified diagnostic for LLM consumption.
 */
export interface LLMDiagnostic {
  phase: string;
  code: string;
  severity: string;
  message: string;
  line?: number;
  column?: number;
  suggestions?: string[];
  involvedNodes?: string[];
}

/**
 * Format validation result for LLM consumption.
 *
 * CRITICAL: NEVER omit fields from output.
 * - Use empty arrays [] not undefined/null for missing data
 * - Use empty objects {} not undefined/null for missing structures
 * - NEVER conditionally omit blocks
 * - LLMs treat missing keys as semantic signals - consistency is critical
 */
export function formatForLLM(
  result: ValidationResult,
  options: LLMFormatOptions = {}
): LLMContext {
  const opts = { ...DEFAULT_LLM_OPTIONS, ...options };

  // Determine status
  let status: LLMStatus;
  if (result.summary.errorCount > 0) {
    status = 'errors';
  } else if (result.summary.warningCount > 0) {
    status = 'warnings';
  } else {
    status = 'valid';
  }

  // Format diagnostics
  const diagnosticsToShow = result.diagnostics.slice(0, opts.maxDiagnostics);
  const diagnostics: LLMDiagnostic[] = diagnosticsToShow.map((d) => ({
    phase: d.phase,
    code: d.code,
    severity: d.severity,
    message: d.message,
    line: d.location?.start.line,
    column: d.location?.start.column,
    suggestions: d.suggestions ?? [],
    involvedNodes: d.involvedNodes ?? [],
  }));

  // Always include grammar summary
  const grammarSummary = opts.includeGrammar ? getGrammarSummary() : '';

  // Always include components (may be empty array)
  const components = opts.includeComponents ? result.availableComponents : [];

  // Always include analysis (may have empty arrays)
  const analysis: AnalysisContext = {
    circuitsDefined: result.analysis.circuitsDefined,
    componentsUsed: result.analysis.componentsUsed,
    unresolvedReferences: result.analysis.unresolvedReferences,
  };

  return {
    status,
    diagnostics,
    components,
    grammarSummary,
    analysis,
  };
}

// ============================================================================
// LLM System Prompt
// ============================================================================

/**
 * Build a system prompt for LLM hardware design assistance.
 */
export function buildLLMSystemPrompt(
  library: ComponentLibrary,
  options?: { includeExamples?: boolean }
): string {
  const lines: string[] = [];

  lines.push('You are an expert hardware design assistant for a DSL-based circuit design environment.');
  lines.push('');
  lines.push('=== DSL Grammar ===');
  lines.push(getGrammarSummary());
  lines.push('');

  // Component catalog
  const catalog = getComponentCatalog(library);
  lines.push('=== Available Components ===');
  lines.push('');

  // Group by kind
  const combinational = catalog.components.filter((c) => c.kind === 'combinational' || !c.kind);
  const sequential = catalog.components.filter((c) => c.kind === 'sequential');
  const sinks = catalog.components.filter((c) => c.kind === 'sink');

  if (combinational.length > 0) {
    lines.push('**Combinational Logic:**');
    for (const c of combinational) {
      lines.push(`- ${c.name}: ${formatPortSummary(c)}`);
    }
    lines.push('');
  }

  if (sequential.length > 0) {
    lines.push('**Sequential Logic:**');
    for (const c of sequential) {
      lines.push(`- ${c.name}: ${formatPortSummary(c)}`);
    }
    lines.push('');
  }

  if (sinks.length > 0) {
    lines.push('**Output/Display:**');
    for (const c of sinks) {
      lines.push(`- ${c.name}: ${formatPortSummary(c)}`);
    }
    lines.push('');
  }

  // Design guidelines
  lines.push('=== Design Guidelines ===');
  lines.push('- Combinational cycles are NOT allowed (use Register/DFlipFlop to break cycles)');
  lines.push('- All inputs must be connected');
  lines.push('- Each input can have only one driver');
  lines.push('- Sequential feedback is allowed through registers');
  lines.push('');

  if (options?.includeExamples) {
    lines.push('=== Example Circuit ===');
    lines.push('```');
    lines.push('circuit Counter {');
    lines.push('  input clk: Bit');
    lines.push('  output count: Bus[4]');
    lines.push('  impl {');
    lines.push('    node reg: Register<WIDTH: 4>');
    lines.push('    node inc: Adder<WIDTH: 4>');
    lines.push('    connect reg.q -> inc.a');
    lines.push('    connect 1 -> inc.b');
    lines.push('    connect inc.sum -> reg.d');
    lines.push('    connect clk -> reg.clk');
    lines.push('    connect reg.q -> count');
    lines.push('  }');
    lines.push('}');
    lines.push('```');
  }

  return lines.join('\n');
}

/**
 * Format a brief port summary for a component.
 */
function formatPortSummary(component: ComponentInterface): string {
  const inputs = component.inputs.map((p) => p.name).join(', ');
  const outputs = component.outputs.map((p) => p.name).join(', ');
  return `(${inputs}) -> (${outputs})`;
}

// ============================================================================
// JSON Format
// ============================================================================

/**
 * Format validation result as JSON string.
 * Uses stable JSON serialization for deterministic output.
 */
export function formatAsJSON(result: ValidationResult): string {
  const llmContext = formatForLLM(result);
  return JSON.stringify(llmContext, null, 2);
}
