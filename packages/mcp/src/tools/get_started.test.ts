/**
 * get_started tests.
 *
 * The materialized form of every bundled example must satisfy the server's
 * own contract: imports from @simten/core (no import-free files) and exported
 * top-level circuits — and must still compile cleanly via checkCircuit.
 */

import { describe, it, expect } from 'vitest';
import { EXAMPLES } from '@simten/core/examples/catalog';
import { checkCircuit } from '@simten/core/api';
import { materializeExample, buildOrientation } from './get_started.js';

describe('materializeExample', () => {
  for (const ex of EXAMPLES) {
    describe(`"${ex.id}"`, () => {
      const source = materializeExample(ex);

      it('imports the builder API and stdlib', () => {
        expect(source).toMatch(/^import \{ circuit.* \} from '@simten\/core\/circuit';$/m);
        expect(source).toContain("} from '@simten/core/std';");
      });

      it('exports its top-level circuits', () => {
        expect(source).toMatch(/^export const \w+ = circuit\(/m);
        // No top-level circuit left unexported.
        expect(source).not.toMatch(/^const \w+ = circuit\(/m);
      });

      it('passes checkCircuit', () => {
        // npm-importing examples (e.g. figlet) resolve via esm.sh in the
        // editor/canvas; checkCircuit runs in-process and can't fetch them.
        if (/^\s*import\s.+from\s+['"](?!@simten)[^'".][^'"]*['"]/m.test(ex.code)) return;
        const result = checkCircuit({ source, sourceName: ex.id });
        expect(result.diagnostics).toEqual([]);
        expect(result.valid).toBe(true);
        expect(result.analysis.unresolvedReferences).toEqual([]);
      });
    });
  }
});

describe('buildOrientation', () => {
  it('lists every example id', () => {
    const text = buildOrientation();
    for (const ex of EXAMPLES) {
      expect(text).toContain(`- ${ex.id} (`);
    }
  });

  it('points at the in-browser alternative', () => {
    expect(buildOrientation()).toContain('https://simten.dev/circuit?example=');
  });
});
