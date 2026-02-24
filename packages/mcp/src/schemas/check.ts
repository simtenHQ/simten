/**
 * Check circuit tool schema.
 */

import { z } from 'zod';

export const checkSchema = z.object({
  source: z.string().optional().describe('DSL source code as a string'),
  filePath: z.string().optional().describe('Path to a .dsl file'),
});

export type CheckParams = z.infer<typeof checkSchema>;
