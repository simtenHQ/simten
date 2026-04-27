import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveTestName } from './vcd-resolve-test.js';
import { findRepoRoot } from './repo-root.js';

describe('resolveTestName', () => {
  it('resolves a real test name to its on-disk VCD', () => {
    const r = resolveTestName('R-Type ADD basic');
    expect(r.slug).toBe('R-Type_ADD_basic');
    expect(r.path).toMatch(/hardware\/ulx3s\/projects\/cpu\/\.vcd\/R-Type_ADD_basic\.vcd$/);
  });

  it('throws vcd_not_found for an unknown test name', () => {
    expect(() => resolveTestName('definitely not a real test')).toThrow(/vcd_not_found/);
  });
});

describe('slugify single-source-of-truth contract', () => {
  // Senior pushback (parent plan §6, test matrix item 5): module-identity
  // tests are easy to spoof. The contract we actually care about is
  // "verify.ts has no inline slugify regex" — assert that directly via grep.
  it('verify.ts has no inline slugify regex (must import from @simten/core/util/test-name)', () => {
    const root = findRepoRoot();
    const verifyPath = resolve(root, 'hardware/ulx3s/projects/cpu/verify.ts');
    const src = readFileSync(verifyPath, 'utf8');
    // The canonical regex is `/[^a-zA-Z0-9_-]+/g`. Grepping for the bracket
    // class catches the inline slugify if it ever returns. Match either the
    // raw class or the function literal — anything that bypasses the import.
    expect(src).not.toMatch(/replace\(\/\[\^a-zA-Z0-9_-\]/);
    // Positive guard: the import must be present.
    expect(src).toMatch(/from ['"]@simten\/core\/util\/test-name['"]/);
  });
});
