import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import {
  preprocessDSL,
  createNodeFileResolver,
} from '@turing-incomplete/core/dsl';

export interface LoadResult {
  source: string;
  filePath: string;
  errors: string[];
  isTypeScript: boolean;
}

/**
 * Load a circuit file from disk.
 * For .dsl files: runs the DSL preprocessor (#include support).
 * For .ts/.circuit.ts files: reads raw source (no preprocessing needed).
 */
export function loadDSLFile(filePath: string): LoadResult {
  const absPath = resolve(filePath);
  const basePath = dirname(absPath);
  const ext = extname(absPath);
  const isTS = ext === '.ts';

  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf-8');
  } catch (e) {
    return {
      source: '',
      filePath: absPath,
      errors: [`Cannot read file: ${absPath}`],
      isTypeScript: isTS,
    };
  }

  if (isTS) {
    // TypeScript files don't need preprocessing
    return {
      source: raw,
      filePath: absPath,
      errors: [],
      isTypeScript: true,
    };
  }

  // DSL files get preprocessor treatment
  const resolver = createNodeFileResolver(basePath);
  const result = preprocessDSL(raw, resolver, absPath);

  return {
    source: result.source,
    filePath: absPath,
    errors: result.errors.map((e) => e.message),
    isTypeScript: false,
  };
}
