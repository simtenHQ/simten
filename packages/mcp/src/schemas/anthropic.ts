/**
 * Zod → Anthropic tool definition conversion.
 *
 * Converts Zod schemas to Anthropic API tool definitions
 * using zod-to-json-schema for the input_schema.
 */

import type { ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Convert a Zod schema to an Anthropic tool definition.
 */
export function zodToAnthropicTool(
  name: string,
  description: string,
  schema: ZodType
): AnthropicToolDefinition {
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });

  return {
    name,
    description,
    input_schema: jsonSchema as Record<string, unknown>,
  };
}
