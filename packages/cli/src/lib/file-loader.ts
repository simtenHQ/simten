import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  preprocessDSL,
  createNodeFileResolver,
} from '@turing-incomplete/core/dsl';

export interface LoadResult {
  source: string;
  filePath: string;
  errors: string[];
}

/**
 * Load a DSL file from disk and run the preprocessor.
 */
export function loadDSLFile(filePath: string): LoadResult {
  const absPath = resolve(filePath);
  const basePath = dirname(absPath);

  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf-8');
  } catch (e) {
    return {
      source: '',
      filePath: absPath,
      errors: [`Cannot read file: ${absPath}`],
    };
  }

  const resolver = createNodeFileResolver(basePath);
  const result = preprocessDSL(raw, resolver, absPath);

  return {
    source: result.source,
    filePath: absPath,
    errors: result.errors.map((e) => e.message),
  };
}
