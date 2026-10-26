import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveTestName, VCD_PROJECT_DIR_SUFFIX } from './vcd-resolve-test.js';

describe('resolveTestName', () => {
  it('resolves a test name to its on-disk VCD', () => {
    const root = mkdtempSync(join(tmpdir(), 'vcd-'));
    mkdirSync(join(root, VCD_PROJECT_DIR_SUFFIX), { recursive: true });
    writeFileSync(join(root, VCD_PROJECT_DIR_SUFFIX, 'R-Type_ADD_basic.vcd'), '');
    const r = resolveTestName('R-Type ADD basic', root);
    expect(r.slug).toBe('R-Type_ADD_basic');
    expect(r.path).toMatch(/hardware\/ulx3s\/projects\/cpu\/\.vcd\/R-Type_ADD_basic\.vcd$/);
  });

  it('throws vcd_not_found for an unknown test name', () => {
    expect(() => resolveTestName('definitely not a real test', tmpdir())).toThrow(/vcd_not_found/);
  });
});
