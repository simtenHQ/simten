/**
 * Editor Action Tool Definitions
 *
 * These tools represent editor actions that are deferred to the client.
 * When the LLM calls them, we return a synthetic ack and collect them
 * as deferred actions for the client to execute.
 */

export type EditorToolName =
  | 'write_circuit'
  | 'demo_inputs'
  | 'run_simulation'
  | 'insert_node'
  | 'generate_harness'
  | 'verify_assertion';

export const EDITOR_TOOL_NAMES = new Set<string>([
  'write_circuit',
  'demo_inputs',
  'run_simulation',
  'insert_node',
  'generate_harness',
  'verify_assertion',
]);

/**
 * Map editor tool call input to the action format(s) expected by the client.
 * Most tools map 1:1. demo_inputs expands into multiple SET_INPUT actions.
 * write_circuit maps to WRITE_CIRCUIT (code is set directly, harness auto-appended server-side).
 */
export function editorToolToActions(
  toolName: string,
  input: Record<string, unknown>
): Record<string, unknown>[] {
  if (toolName === 'demo_inputs') {
    const steps = input.steps as Array<{ node: string; value: number }> | undefined;
    if (!steps || !Array.isArray(steps)) return [];
    return steps.map((step) => ({
      type: 'SET_INPUT',
      node: step.node,
      value: step.value,
    }));
  }

  if (toolName === 'write_circuit') {
    return [{
      type: 'WRITE_CIRCUIT',
      code: input.code,
      explanation: input.explanation,
    }];
  }

  const typeMap: Record<string, string> = {
    run_simulation: 'RUN_SIMULATION',
    insert_node: 'INSERT_NODE',
    generate_harness: 'GENERATE_HARNESS',
    verify_assertion: 'VERIFY_ASSERTION',
  };

  return [{
    type: typeMap[toolName] ?? toolName.toUpperCase(),
    ...input,
  }];
}
