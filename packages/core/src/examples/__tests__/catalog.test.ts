/**
 * Example Catalog Tests
 *
 * Drift guard for the bundled example catalog: every example's source must
 * compile cleanly via checkCircuit, so the editor empty state and the MCP
 * server never ship a broken example.
 */

import { describe, expect, it } from 'vitest';
import { checkCircuit } from '../../api/check.js';
import { EXAMPLES } from '../catalog.js';

// Examples that import a non-@simten package (e.g. figlet) resolve via esm.sh
// in the editor/canvas. checkCircuit runs in-process and can't fetch those, so
// the compile assertion is skipped for them (they're validated where they run).
const hasExternalImport = (code: string) =>
  /^\s*import\s.+from\s+['"](?!@simten)[^'".][^'"]*['"]/m.test(code);

describe('example catalog', () => {
  it('has examples', () => {
    expect(EXAMPLES.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const ids = EXAMPLES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has non-empty metadata', () => {
    for (const ex of EXAMPLES) {
      expect(ex.title.length, ex.id).toBeGreaterThan(0);
      expect(ex.description.length, ex.id).toBeGreaterThan(0);
      expect(ex.code.trim().length, ex.id).toBeGreaterThan(0);
    }
  });

  for (const ex of EXAMPLES) {
    it(`"${ex.id}" passes checkCircuit`, () => {
      if (hasExternalImport(ex.code)) return; // npm-importing example; see note above
      const result = checkCircuit({ source: ex.code, sourceName: ex.id });
      expect(result.diagnostics).toEqual([]);
      expect(result.valid).toBe(true);
      expect(result.analysis.unresolvedReferences).toEqual([]);
      expect(result.analysis.circuitsDefined.length).toBeGreaterThan(0);
    });
  }
});
