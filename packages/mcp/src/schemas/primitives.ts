/**
 * Primitives tool schema.
 */

import { z } from 'zod';

export const primitivesSchema = z.object({
  kind: z
    .enum(['combinational', 'sequential', 'sink'])
    .optional()
    .describe('Filter components by kind'),
});

export type PrimitivesParams = z.infer<typeof primitivesSchema>;
