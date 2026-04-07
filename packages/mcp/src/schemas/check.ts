/**
 * Check circuit tool schema.
 */

import { z } from 'zod';

export const checkSchema = z.object({
  source: z.string().optional().describe('TypeScript circuit code as a string'),
  filePath: z.string().optional().describe('Path to a .circuit.ts file'),
});

export type CheckParams = z.infer<typeof checkSchema>;
