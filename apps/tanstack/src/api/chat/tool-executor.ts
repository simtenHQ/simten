/**
 * Tool Executor
 *
 * Routes tool calls to the appropriate handler.
 * Analysis tools execute server-side and return results.
 * Editor tools return a synthetic ack and collect as deferred actions.
 * write_circuit auto-validates and auto-appends a test harness.
 */

import {
  checkCircuit,
  simulateCircuit,
  getLibrary,
} from '@turing-incomplete/core/api';
import { EDITOR_TOOL_NAMES, editorToolToActions } from './editor-tools';

export interface ToolExecResult {
  /** Text result to return to the LLM */
  content: string;
  /** Deferred actions for the client (may be multiple for demo_inputs) */
  deferredActions?: Record<string, unknown>[];
}

/**
 * Execute a tool call and return the result text.
 */
export function executeTool(
  toolName: string,
  input: Record<string, unknown>
): ToolExecResult {
  // Editor action tools — defer to client
  if (EDITOR_TOOL_NAMES.has(toolName)) {
    // write_circuit: auto-validate + auto-append harness
    if (toolName === 'write_circuit' && input.code) {
      const code = input.code as string;
      const library = getLibrary();
      const validation = checkCircuit(
        { source: code, sourceName: '<inline>' },
        library
      );

      const hasErrors = validation.diagnostics.some(
        (d) => d.severity === 'error'
      );

      if (hasErrors) {
        const errorSummary = validation.diagnostics
          .filter((d) => d.severity === 'error')
          .map((d) => `Line ${d.line ?? '?'}: ${d.message}`)
          .join('\n');
        return {
          content: `Validation FAILED. Fix these errors and try write_circuit again:\n${errorSummary}`,
        };
      }

      const actions = editorToolToActions(toolName, {
        ...input,
        code,
      });

      return {
        content: `Code validated and harness auto-generated. Circuit updated in the editor.`,
        deferredActions: actions,
      };
    }

    const actions = editorToolToActions(toolName, input);
    return {
      content: `Action "${toolName}" queued for the student's editor.`,
      deferredActions: actions,
    };
  }

  // Analysis tools — execute server-side
  switch (toolName) {
    case 'simulate_circuit': {
      const result = simulateCircuit({
        source: input.source as string,
        sourceName: '<inline>',
        circuitName: input.circuitName as string | undefined,
        ticks: input.ticks as number | undefined,
        inputs: input.inputs as Record<string, number | boolean> | undefined,
      });
      if ('error' in result) {
        return { content: `Error: ${result.error}` };
      }
      return { content: JSON.stringify(result, null, 2) };
    }

    default:
      return { content: `Unknown tool: ${toolName}` };
  }
}
