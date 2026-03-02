/**
 * show_test_results tool — pushes testbench results to the browser preview.
 *
 * Takes the output of run_testbench and sends it to the preview client
 * for display in the test results panel.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPreviewServer } from '../lib/preview-singleton.js';

const AssertionResult = z.object({
  cycle: z.number(),
  passed: z.boolean(),
  message: z.string(),
});

const TestResult = z.object({
  name: z.string().describe('Test name'),
  dutName: z.string().optional().describe('Device under test name'),
  status: z.enum(['passed', 'failed']).describe('Test status'),
  cycles: z.number().describe('Number of cycles executed'),
  failureReason: z.string().optional().describe('Reason for failure'),
  assertionSummary: z
    .object({
      total: z.number(),
      passed: z.number(),
      failed: z.number(),
      results: z.array(AssertionResult),
    })
    .optional()
    .describe('Assertion details'),
});

export function registerTestResultsTool(server: McpServer): void {
  server.tool(
    'show_test_results',
    'Push testbench results to the live circuit preview. Run run_testbench first, then pass its results here. Requires show_circuit to be running.',
    {
      results: z.array(TestResult).describe('Array of test results'),
    },
    async (params) => {
      const preview = getPreviewServer();
      if (!preview) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: No preview is running. Call show_circuit first.',
            },
          ],
          isError: true,
        };
      }

      preview.pushTestResults(params);

      const passed = params.results.filter((r) => r.status === 'passed').length;
      const failed = params.results.filter((r) => r.status === 'failed').length;

      return {
        content: [
          {
            type: 'text' as const,
            text: `Test results pushed to preview: ${passed} passed, ${failed} failed.`,
          },
        ],
      };
    }
  );
}
