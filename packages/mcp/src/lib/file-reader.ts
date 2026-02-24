/**
 * File Reader
 *
 * Reads DSL source from either a `source` string param or a `filePath` param.
 * Handles preprocessing (include directives) for file-based sources.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  preprocessDSL,
  createNodeFileResolver,
} from '@turing-incomplete/core/dsl/preprocessor';

export interface ReadResult {
  source: string;
  sourceName?: string;
  error?: string;
}

/**
 * Read DSL source from either an inline string or a file path.
 */
export function readDSLSource(params: {
  source?: string;
  filePath?: string;
}): ReadResult {
  if (params.source) {
    return { source: params.source, sourceName: '<inline>' };
  }

  if (params.filePath) {
    const absPath = resolve(params.filePath);

    let raw: string;
    try {
      raw = readFileSync(absPath, 'utf-8');
    } catch {
      return { source: '', error: `Cannot read file: ${absPath}` };
    }

    const basePath = dirname(absPath);
    const resolver = createNodeFileResolver(basePath);
    const result = preprocessDSL(raw, resolver, absPath);

    if (result.errors.length > 0) {
      return {
        source: '',
        error: result.errors.map((e) => e.message).join('\n'),
      };
    }

    return { source: result.source, sourceName: absPath };
  }

  return { source: '', error: 'Either "source" or "filePath" must be provided' };
}
