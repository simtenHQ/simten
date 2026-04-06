/**
 * File Reader
 *
 * Reads circuit source from either a `source` string param or a `filePath` param.
 * For TS builder code, executeCircuitCode handles everything — this just reads the file.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ReadResult {
  source: string;
  sourceName?: string;
  error?: string;
}

/**
 * Read circuit source from either an inline string or a file path.
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

    return { source: raw, sourceName: absPath };
  }

  return { source: '', error: 'Either "source" or "filePath" must be provided' };
}
