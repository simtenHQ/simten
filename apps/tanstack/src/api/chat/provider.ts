/**
 * AI Provider Abstraction
 *
 * Detects the API key type and routes to the correct SDK:
 *   - sk-ant-*  → Anthropic SDK (direct)
 *   - sk-or-*   → OpenAI SDK via OpenRouter
 *   - sk-*      → OpenAI SDK (direct)
 *
 * Exposes a unified interface for the tool_use loop in route.ts.
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ============================================================================
// Unified types for the tool loop
// ============================================================================

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ContentBlock = TextBlock | ToolUseBlock;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

export interface CompletionResult {
  content: ContentBlock[];
  stopReason: 'end_turn' | 'tool_use' | 'other';
  usage: TokenUsage;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[] | ToolResult[];
}

// ============================================================================
// Provider interface
// ============================================================================

export interface StreamCallbacks {
  onText: (text: string) => void | Promise<void>;
}

export interface AIProvider {
  createCompletion(params: {
    system: string;
    messages: Message[];
    tools: ToolDef[];
    maxTokens: number;
    stream?: StreamCallbacks;
  }): Promise<CompletionResult>;
}

// ============================================================================
// Anthropic provider
// ============================================================================

function createAnthropicProvider(apiKey: string, model: string): AIProvider {
  const client = new Anthropic({ apiKey });

  return {
    async createCompletion({ system, messages, tools, maxTokens, stream: streamCb }) {
      const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => {
        if (typeof m.content === 'string') {
          return { role: m.role, content: m.content };
        }
        return {
          role: m.role,
          content: m.content as Anthropic.ContentBlockParam[],
        };
      });

      const anthropicTools: Anthropic.Tool[] = tools.map((t, i) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
        ...(i === tools.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
      }));

      const createParams = {
        model,
        max_tokens: maxTokens,
        system: [
          {
            type: 'text' as const,
            text: system,
            cache_control: { type: 'ephemeral' as const },
          },
        ],
        messages: anthropicMessages,
        tools: anthropicTools,
      };

      // Use streaming when callbacks provided
      if (streamCb) {
        const content: ContentBlock[] = [];
        let currentTextBlock = '';
        let currentToolId = '';
        let currentToolName = '';
        let currentToolInput = '';

        const stream = client.messages.stream(createParams);

        for await (const event of stream) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'text') {
              currentTextBlock = '';
            } else if (event.content_block.type === 'tool_use') {
              currentToolId = event.content_block.id;
              currentToolName = event.content_block.name;
              currentToolInput = '';
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              currentTextBlock += event.delta.text;
              await streamCb.onText(event.delta.text);
            } else if (event.delta.type === 'input_json_delta') {
              currentToolInput += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            if (currentTextBlock) {
              content.push({ type: 'text', text: currentTextBlock });
              currentTextBlock = '';
            }
            if (currentToolName) {
              let input: Record<string, unknown> = {};
              try {
                input = currentToolInput ? JSON.parse(currentToolInput) : {};
              } catch { /* empty */ }
              content.push({
                type: 'tool_use',
                id: currentToolId,
                name: currentToolName,
                input,
              });
              currentToolName = '';
              currentToolInput = '';
              currentToolId = '';
            }
          }
        }

        const finalMessage = await stream.finalMessage();
        const stopReason =
          finalMessage.stop_reason === 'end_turn' ? 'end_turn'
          : finalMessage.stop_reason === 'tool_use' ? 'tool_use'
          : 'other';

        const usage = finalMessage.usage as typeof finalMessage.usage & {
          cache_read_input_tokens?: number;
          cache_creation_input_tokens?: number;
        };

        return {
          content,
          stopReason,
          usage: {
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            cacheReadTokens: usage.cache_read_input_tokens,
            cacheCreationTokens: usage.cache_creation_input_tokens,
          },
        };
      }

      // Non-streaming path (unchanged)
      const response = await client.messages.create(createParams);

      const content: ContentBlock[] = [];
      for (const block of response.content) {
        if (block.type === 'text') {
          content.push({ type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          content.push({
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          });
        }
      }

      const stopReason =
        response.stop_reason === 'end_turn' ? 'end_turn'
        : response.stop_reason === 'tool_use' ? 'tool_use'
        : 'other';

      const usage = response.usage as typeof response.usage & {
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };

      return {
        content,
        stopReason,
        usage: {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheReadTokens: usage.cache_read_input_tokens,
          cacheCreationTokens: usage.cache_creation_input_tokens,
        },
      };
    },
  };
}

// ============================================================================
// OpenAI-compatible provider (OpenRouter, OpenAI direct)
// ============================================================================

function createOpenAIProvider(
  apiKey: string,
  model: string,
  baseURL?: string
): AIProvider {
  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  return {
    async createCompletion({ system, messages, tools, maxTokens, stream: streamCb }) {
      // Convert messages to OpenAI format
      const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: system },
      ];

      for (const m of messages) {
        if (typeof m.content === 'string') {
          openaiMessages.push({
            role: m.role,
            content: m.content,
          });
        } else if (m.role === 'assistant') {
          // Assistant message with tool calls
          const blocks = m.content as ContentBlock[];
          const textParts = blocks.filter((b): b is TextBlock => b.type === 'text');
          const toolParts = blocks.filter((b): b is ToolUseBlock => b.type === 'tool_use');

          openaiMessages.push({
            role: 'assistant',
            content: textParts.map((t) => t.text).join('\n') || null,
            tool_calls: toolParts.length > 0
              ? toolParts.map((t) => ({
                  id: t.id,
                  type: 'function' as const,
                  function: {
                    name: t.name,
                    arguments: JSON.stringify(t.input),
                  },
                }))
              : undefined,
          });
        } else {
          // User message with tool results
          const results = m.content as ToolResult[];
          for (const r of results) {
            openaiMessages.push({
              role: 'tool',
              tool_call_id: r.tool_use_id,
              content: r.content,
            });
          }
        }
      }

      // Convert tools to OpenAI format
      const openaiTools: OpenAI.ChatCompletionTool[] = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));

      const createParams = {
        model,
        max_tokens: maxTokens,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      };

      // Streaming path
      if (streamCb) {
        const content: ContentBlock[] = [];
        let currentText = '';
        const toolCalls = new Map<number, { id: string; name: string; args: string }>();

        const stream = await client.chat.completions.create({
          ...createParams,
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            currentText += delta.content;
            await streamCb.onText(delta.content);
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolCalls.get(tc.index);
              if (!existing) {
                toolCalls.set(tc.index, {
                  id: tc.id || '',
                  name: tc.function?.name || '',
                  args: tc.function?.arguments || '',
                });
              } else {
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name += tc.function.name;
                if (tc.function?.arguments) existing.args += tc.function.arguments;
              }
            }
          }
        }

        if (currentText) {
          content.push({ type: 'text', text: currentText });
        }

        for (const [, tc] of toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.args ? JSON.parse(tc.args) : {},
          });
        }

        const hasToolCalls = toolCalls.size > 0;
        const stopReason = hasToolCalls ? 'tool_use' : 'end_turn';

        return {
          content,
          stopReason: stopReason as CompletionResult['stopReason'],
          usage: {
            inputTokens: 0,
            outputTokens: 0,
          },
        };
      }

      // Non-streaming path
      const response = await client.chat.completions.create(createParams);

      const choice = response.choices[0];
      if (!choice) throw new Error('No response from model');

      const content: ContentBlock[] = [];

      if (choice.message.content) {
        content.push({ type: 'text', text: choice.message.content });
      }

      if (choice.message.tool_calls) {
        for (const tc of choice.message.tool_calls) {
          if ('function' in tc && tc.type === 'function') {
            const fn = tc.function;
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: fn.name,
              input: fn.arguments ? JSON.parse(fn.arguments) : {},
            });
          }
        }
      }

      const stopReason =
        choice.finish_reason === 'tool_calls'
          ? 'tool_use'
          : choice.finish_reason === 'stop'
            ? 'end_turn'
            : 'other';

      return {
        content,
        stopReason,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}

// ============================================================================
// Factory
// ============================================================================

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Default models per provider
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openrouter: 'anthropic/claude-haiku-4.5',
  openai: 'gpt-4o-mini',
};

export function resolveProvider(env: Record<string, string | undefined>): AIProvider {
  // Check for keys in priority order
  const anthropicKey = env.ANTHROPIC_API_KEY;
  const openrouterKey = env.OPENROUTER_API_KEY;
  const openaiKey = env.OPENAI_API_KEY;

  // Allow overriding the model via env
  const modelOverride = env.AI_MODEL;

  if (anthropicKey) {
    const model = modelOverride || DEFAULT_MODELS.anthropic;
    return createAnthropicProvider(anthropicKey, model);
  }

  if (openrouterKey) {
    const model = modelOverride || DEFAULT_MODELS.openrouter;
    return createOpenAIProvider(openrouterKey, model, OPENROUTER_BASE_URL);
  }

  if (openaiKey) {
    const model = modelOverride || DEFAULT_MODELS.openai;
    return createOpenAIProvider(openaiKey, model);
  }

  throw new Error(
    'No AI API key configured. Set one of: ANTHROPIC_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY'
  );
}
