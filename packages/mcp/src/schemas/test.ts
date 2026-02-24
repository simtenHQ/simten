/**
 * Testbench tool schema.
 */

import { z } from 'zod';

export const testSchema = z.object({
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
});

export type TestParams = z.infer<typeof testSchema>;
