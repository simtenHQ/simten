/**
 * Grammar tool schema - no parameters.
 */

import { z } from 'zod';

export const grammarSchema = z.object({});

export type GrammarParams = z.infer<typeof grammarSchema>;
