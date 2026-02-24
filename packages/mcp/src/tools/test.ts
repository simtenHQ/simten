/**
 * run_testbench tool - MCP wrapper
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runTestbenchHandler } from '../handlers/test.js';
import { readDSLSource } from '../lib/file-reader.js';

export function registerTestTool(server: McpServer): void {
  server.tool(
    'run_testbench',
    'Run a testbench against a circuit. The circuit and testbench can be provided as inline source or file paths. Returns test status, cycle count, assertion results, and signal traces.',
    {
      circuitSource: z
        .string()
        .optional()
        .describe('DSL source for the circuit under test'),
      testbenchSource: z
        .string()
        .optional()
        .describe('DSL source for the testbench'),
      circuitPath: z
        .string()
        .optional()
        .describe('File path to the circuit .dsl file'),
      testbenchPath: z
        .string()
        .optional()
        .describe('File path to the testbench .tb.dsl file'),
    },
    async ({ circuitSource, testbenchSource, circuitPath, testbenchPath }) => {
      // Read circuit source
      const circuitRead = readDSLSource({
        source: circuitSource,
        filePath: circuitPath,
      });
      if (circuitRead.error) {
        return {
          content: [
            { type: 'text' as const, text: `Circuit error: ${circuitRead.error}` },
          ],
          isError: true,
        };
      }

      // Read testbench source
      const tbRead = readDSLSource({
        source: testbenchSource,
        filePath: testbenchPath,
      });
      if (tbRead.error) {
        return {
          content: [
            { type: 'text' as const, text: `Testbench error: ${tbRead.error}` },
          ],
          isError: true,
        };
      }

      const result = runTestbenchHandler({
        circuitSource: circuitRead.source,
        circuitSourceName: circuitRead.sourceName,
        testbenchSource: tbRead.source,
        testbenchSourceName: tbRead.sourceName,
      });

      if ('error' in result) {
        return {
          content: [{ type: 'text' as const, text: result.error }],
          isError: true,
        };
      }

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );
}
