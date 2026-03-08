/**
 * Chat API Route
 *
 * Streaming endpoint that supports multiple AI providers (Anthropic, OpenRouter, OpenAI).
 * Runs a server-side tool loop: the LLM calls analysis tools (simulate, testbench)
 * which execute here, and editor tools (show_diff, demo_inputs, etc.) which are
 * deferred to the client.
 *
 * Primitives + grammar are baked into the system prompt (live, not hardcoded).
 * show_diff auto-validates code server-side.
 * demo_inputs batches multiple set_input actions into one tool call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt } from './system-prompt';

// Edge runtime streams without buffering
export const runtime = 'edge';
import { executeTool } from './tool-executor';
import {
  resolveProvider,
  type ToolDef,
  type ContentBlock,
  type Message,
  type ToolResult,
} from './provider';

// ============================================================================
// Tool Definitions (provider-agnostic)
// ============================================================================

// Analysis tools that execute server-side
// NOTE: get_primitives and get_grammar are baked into the system prompt.
//       check_circuit runs automatically on show_diff.
const analysisTools: ToolDef[] = [
  {
    name: 'simulate_circuit',
    description:
      'Compile and simulate a circuit. Returns per-cycle signal traces for all inputs and outputs.',
    input_schema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'DSL source code as a string',
        },
        circuitName: {
          type: 'string',
          description: 'Name of the circuit to simulate (defaults to last defined)',
        },
        ticks: {
          type: 'number',
          description: 'Number of clock ticks to simulate (default: 10, max: 10000)',
        },
        inputs: {
          type: 'object',
          description: 'Initial input values as { portName: value }',
          additionalProperties: { type: ['number', 'boolean'] },
        },
      },
      required: ['source'],
    },
  },
  {
    name: 'run_testbench',
    description:
      'Run a testbench against a circuit. Returns test status, cycle count, assertion results, and signal traces.',
    input_schema: {
      type: 'object',
      properties: {
        circuitSource: {
          type: 'string',
          description: 'DSL source for the circuit under test',
        },
        testbenchSource: {
          type: 'string',
          description: 'DSL source for the testbench',
        },
      },
      required: ['circuitSource', 'testbenchSource'],
    },
  },
];

// Editor tools deferred to client
const editorTools: ToolDef[] = [
  {
    name: 'write_circuit',
    description:
      'Write DSL code to the editor. Code is auto-validated and a test harness is auto-appended. If validation fails, you get error diagnostics back to fix.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'The full DSL circuit code' },
        explanation: { type: 'string', description: 'What the circuit does and why' },
      },
      required: ['code', 'explanation'],
    },
  },
  {
    name: 'demo_inputs',
    description:
      'Set multiple input values at once to demo the circuit live in the visual editor. Each step sets a Switch/Button value. The student sees outputs update after each step.',
    input_schema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description: 'Array of input changes to apply in order',
          items: {
            type: 'object',
            properties: {
              node: { type: 'string', description: 'Name of the Switch/Button node' },
              value: { type: 'number', description: 'Value to set (0 or 1 for Bit, 0-255 for Bus)' },
            },
            required: ['node', 'value'],
          },
        },
      },
      required: ['steps'],
    },
  },
  {
    name: 'run_simulation',
    description:
      'Run clock cycles in the visual editor. Only for sequential circuits with clocks/registers.',
    input_schema: {
      type: 'object',
      properties: {
        cycles: { type: 'number', description: 'Number of clock cycles to run (1-100)' },
        stimuli: {
          type: 'object',
          description: 'Optional input stimuli as { inputName: value }',
          additionalProperties: { type: 'number' },
        },
      },
      required: ['cycles'],
    },
  },
  {
    name: 'insert_node',
    description: 'Add a component to the visual editor.',
    input_schema: {
      type: 'object',
      properties: {
        componentRef: { type: 'string', description: 'Component type to insert (e.g., "Inverter", "ANDGate")' },
        suggestedLabel: { type: 'string', description: 'Optional label for the new node' },
        connectFrom: { type: 'string', description: 'Optional source port to connect from' },
        connectTo: { type: 'string', description: 'Optional destination port to connect to' },
      },
      required: ['componentRef'],
    },
  },
  {
    name: 'generate_harness',
    description:
      'Generate an interactive test harness for a circuit. Adds Switch/Input controls and Led/Display outputs.',
    input_schema: {
      type: 'object',
      properties: {
        circuitName: { type: 'string', description: 'Name of the circuit to generate harness for' },
      },
      required: [],
    },
  },
  {
    name: 'verify_assertion',
    description:
      'Run testbench assertions to verify circuit behavior.',
    input_schema: {
      type: 'object',
      properties: {
        targetCircuit: { type: 'string', description: 'Name of the circuit to verify (optional)' },
        maxCycles: { type: 'number', description: 'Maximum simulation cycles for verification' },
      },
      required: [],
    },
  },
];

const allTools: ToolDef[] = [...analysisTools, ...editorTools];

// ============================================================================
// Request/Response Types
// ============================================================================

interface ChatRequest {
  userMessage: string;
  dslCode: string;
  compactContext: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface StreamChunk {
  type: 'tool_call' | 'message' | 'done' | 'error';
  content?: string;
  toolCall?: { name: string; input: Record<string, unknown> };
  response?: {
    message: string;
    actions: unknown[];
    suggestedFollowUps?: string[];
  };
  usage?: { inputTokens: number; outputTokens: number; estimatedCost: number };
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function encodeChunk(chunk: StreamChunk): string {
  return JSON.stringify(chunk) + '\n';
}

// Pricing per million tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'anthropic/claude-haiku-4.5': { input: 0.80, output: 4.00 },
  'anthropic/claude-sonnet-4': { input: 3.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
};

function estimateCost(inputTokens: number, outputTokens: number): number {
  const model = process.env.AI_MODEL
    || (process.env.ANTHROPIC_API_KEY ? 'claude-haiku-4-5-20251001'
    : process.env.OPENROUTER_API_KEY ? 'anthropic/claude-haiku-4.5'
    : 'gpt-4o-mini');
  const price = PRICING[model] ?? { input: 1.0, output: 5.0 };
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

const MAX_TOOL_ITERATIONS = 10;

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;
    const { userMessage, dslCode, compactContext, conversationHistory } = body;

    if (!userMessage?.trim()) {
      return NextResponse.json(
        { error: 'userMessage is required' },
        { status: 400 }
      );
    }

    let provider;
    try {
      provider = resolveProvider();
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'No API key configured' },
        { status: 500 }
      );
    }

    // Build messages from conversation history
    const messages: Message[] = [];
    for (const msg of conversationHistory ?? []) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: 'user', content: userMessage });

    const systemPrompt = buildSystemPrompt(dslCode || '', compactContext || '');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const deferredActions: Record<string, unknown>[] = [];
        let finalMessage = '';
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        try {
          let currentMessages = [...messages];
          let iterations = 0;

          while (iterations < MAX_TOOL_ITERATIONS) {
            iterations++;

            let streamedText = '';

            const response = await provider.createCompletion({
              system: systemPrompt,
              messages: currentMessages,
              tools: allTools,
              maxTokens: 4096,
              stream: {
                onText: async (delta) => {
                  streamedText += delta;
                  finalMessage = streamedText;
                  controller.enqueue(
                    encoder.encode(
                      encodeChunk({ type: 'message', content: streamedText })
                    )
                  );
                  // Yield to event loop so the stream flushes to the client
                  await new Promise(resolve => setTimeout(resolve, 0));
                },
              },
            });

            totalInputTokens += response.usage.inputTokens;
            totalOutputTokens += response.usage.outputTokens;

            // Process response content blocks
            const assistantContent: ContentBlock[] = [];
            let hasToolUse = false;

            for (const block of response.content) {
              if (block.type === 'text') {
                finalMessage = block.text;
                assistantContent.push(block);
              } else if (block.type === 'tool_use') {
                hasToolUse = true;
                controller.enqueue(
                  encoder.encode(
                    encodeChunk({
                      type: 'tool_call',
                      toolCall: { name: block.name, input: block.input },
                    })
                  )
                );
                assistantContent.push(block);
              }
            }

            // If no tool use, we're done
            if (!hasToolUse || response.stopReason === 'end_turn') {
              break;
            }

            // Execute tool calls and build tool results
            const toolResults: ToolResult[] = [];

            for (const block of response.content) {
              if (block.type === 'tool_use') {
                try {
                  const result = executeTool(block.name, block.input);

                  if (result.deferredActions) {
                    deferredActions.push(...result.deferredActions);
                  }

                  toolResults.push({
                    tool_use_id: block.id,
                    content: result.content,
                  });
                } catch (error) {
                  toolResults.push({
                    tool_use_id: block.id,
                    content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    is_error: true,
                  });
                }
              }
            }

            // Append assistant message + tool results for next iteration
            currentMessages = [
              ...currentMessages,
              { role: 'assistant' as const, content: assistantContent },
              { role: 'user' as const, content: toolResults },
            ];
          }

          // Send done chunk with deferred actions and usage
          controller.enqueue(
            encoder.encode(
              encodeChunk({
                type: 'done',
                response: {
                  message: finalMessage,
                  actions: deferredActions,
                },
                usage: {
                  inputTokens: totalInputTokens,
                  outputTokens: totalOutputTokens,
                  estimatedCost: estimateCost(totalInputTokens, totalOutputTokens),
                },
              })
            )
          );
        } catch (error) {
          console.error('[Chat] Error:', error);
          controller.enqueue(
            encoder.encode(
              encodeChunk({
                type: 'error',
                error: error instanceof Error ? error.message : 'Failed to get response',
              })
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Chat] Request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
