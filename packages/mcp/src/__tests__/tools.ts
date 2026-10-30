/**
 * Call a tool's handler the way the SDK does: arguments parsed by its input
 * schema first, so defaults apply and unknown or mistyped parameters fail.
 * For the in-process client path, see server.test.ts.
 */

import type { McpServer } from '@modelcontextprotocol/server';
import type { z } from 'zod';

export interface ToolResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

export type ToolCall = (args?: Record<string, unknown>) => Promise<ToolResult>;

interface ToolConfig {
  description?: string;
  inputSchema?: z.ZodType;
}

type RawHandler = (args: unknown) => Promise<ToolResult>;

/** Every tool `register` adds, by name. */
export function toolsOf(register: (server: McpServer) => void): Map<string, ToolCall> {
  const tools = new Map<string, ToolCall>();
  const server = {
    registerTool: (name: string, config: ToolConfig, handler: RawHandler) => {
      tools.set(name, async (args = {}) => {
        const parsed = config.inputSchema ? config.inputSchema.parse(args) : args;
        return handler(parsed);
      });
    },
  };
  register(server as unknown as McpServer);
  return tools;
}

/** The one tool `register` adds. */
export function toolOf(register: (server: McpServer) => void): ToolCall {
  const [call, ...rest] = toolsOf(register).values();
  if (!call || rest.length > 0) throw new Error('expected exactly one tool');
  return call;
}
