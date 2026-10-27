/**
 * Example Catalog Tests
 *
 * Drift guard for the bundled example catalog: every example's source must
 * compile cleanly, so the editor empty state and the MCP server never ship a
 * broken example. (The MCP server's get_started test also runs each one
 * through check_circuit.)
 */

import { describe, expect, it } from 'vitest';
import { simulate } from '../../simulator/simulate.js';
import type { SimulatorSnapshot } from '../../simulator/types.js';
import { executeCircuitCode } from '../../source/execute.js';
import { EXAMPLES } from '../catalog.js';

// Examples that import a non-@simten package (e.g. figlet) resolve via esm.sh
// in the editor/canvas. executeCircuitCode runs in-process and can't fetch those, so
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
    it(`"${ex.id}" compiles`, () => {
      if (hasExternalImport(ex.code)) return; // npm-importing example; see note above
      const result = executeCircuitCode(ex.code);
      expect(result.error).toBeNull();
      expect(result.circuits.length).toBeGreaterThan(0);
    });
  }

  it('"6502-computer" prints its message to the console', () => {
    const ex = EXAMPLES.find((e) => e.id === '6502-computer')!;
    const top = executeCircuitCode(ex.code).builtCircuits.find((c) => c.name === 'Computer6502')!;
    const sim = simulate(top);
    sim.tickN(400);
    const snapshot = sim.snapshot() as unknown as SimulatorSnapshot;
    const state = snapshot.sequentialState?.currentState;
    const text = [...(state?.entries() ?? [])].find(([id]) => id === 'console')?.[1];
    expect(text).toBe('Hello from the 6502!\n');
  });
});
