/**
 * Preprocessor Entry Point (Node.js only)
 *
 * Separated from main dsl/index.ts because it depends on node:path/node:fs,
 * which cannot be bundled for browser environments.
 */

export {
  preprocessDSL,
  createMapFileResolver,
  createNodeFileResolver,
} from './preprocessor.js';
export type { FileResolver, PreprocessResult } from './preprocessor.js';
