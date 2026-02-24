/**
 * Simulate circuit tool schema.
 */

import { z } from 'zod';

export const simulateSchema = z.object({
  source: z.string().optional().describe('DSL source code as a string'),
  filePath: z.string().optional().describe('Path to a .dsl file'),
  circuitName: z
    .string()
    .optional()
    .describe('Name of the circuit to simulate (defaults to last defined)'),
  ticks: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .optional()
    .default(10)
    .describe('Number of clock ticks to simulate (default: 10)'),
  inputs: z
    .record(z.union([z.number(), z.boolean()]))
    .optional()
    .describe('Initial input values as { portName: value }'),
});

export type SimulateParams = z.infer<typeof simulateSchema>;
