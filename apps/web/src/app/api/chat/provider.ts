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

export interface AIProvider {
  createCompletion(params: {
    system: string;
    messages: Message[];
    tools: ToolDef[];
    maxTokens: number;
  }): Promise<CompletionResult>;
}

// ============================================================================
// Anthropic provider
// ============================================================================

function createAnthropicProvider(apiKey: string, model: string): AIProvider {
  const client = new Anthropic({ apiKey });

  return {
    async createCompletion({ system, messages, tools, maxTokens }) {
      const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => {
        if (typeof m.content === 'string') {
          return { role: m.role, content: m.content };
        }
        // Content blocks (assistant with tool_use) or tool results (user)
        return {
          role: m.role,
          content: m.content as Anthropic.ContentBlockParam[],
        };
      });

      // Add cache_control to the last tool so the system prompt + all tools get cached
      const anthropicTools: Anthropic.Tool[] = tools.map((t, i) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
        ...(i === tools.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
      }));

      const response = await client.messages.create({
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
      });

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
        // Skip thinking blocks
      }

      const stopReason =
        response.stop_reason === 'end_turn'
          ? 'end_turn'
          : response.stop_reason === 'tool_use'
            ? 'tool_use'
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
    async createCompletion({ system, messages, tools, maxTokens }) {
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

      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });

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

export function resolveProvider(): AIProvider {
  // Check for keys in priority order
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Allow overriding the model via env
  const modelOverride = process.env.AI_MODEL;

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
