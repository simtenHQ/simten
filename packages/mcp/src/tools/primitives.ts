/**
 * get_primitives tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPrimitivesHandler, getLibrary } from '@turing-incomplete/core/api';
import { readDSLSource } from '../lib/file-reader.js';

export function registerPrimitivesTool(server: McpServer): void {
  server.tool(
    'get_primitives',
    'Browse all available primitive components. Returns compact one-liner signatures by default. Optionally filter by kind. When source or filePath is provided, also includes user-defined composite circuits.',
    {
      kind: z
        .enum(['combinational', 'sequential', 'sink'])
        .optional()
        .describe('Filter components by kind'),
      source: z.string().optional().describe('DSL source code as a string'),
      filePath: z.string().optional().describe('Path to a .dsl file'),
      compact: z
        .boolean()
        .optional()
        .default(true)
        .describe('Use compact one-liner format (default: true). Set false for verbose details.'),
    },
    async ({ kind, source, filePath, compact }) => {
      const library = getLibrary();

      // Resolve source from inline or file
      let resolvedSource: string | undefined;
      let sourceName: string | undefined;

      if (source || filePath) {
        const read = readDSLSource({ source, filePath });
        if (read.error) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${read.error}` }],
            isError: true,
          };
        }
        resolvedSource = read.source;
        sourceName = read.sourceName;
      }

      const text = getPrimitivesHandler(
        { kind, source: resolvedSource, sourceName, compact },
        library
      );
      return {
        content: [{ type: 'text' as const, text }],
      };
    }
  );
}
