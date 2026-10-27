import { describe, expect, it } from 'vitest';
import { extractAndRewriteImports } from '../rewrite-imports';

describe('import specifiers', () => {
  it('sends bare package names to esm.sh', () => {
    const { loaderModule } = extractAndRewriteImports("import fc from 'fast-check';");
    expect(loaderModule).toContain("from 'https://esm.sh/fast-check'");
  });

  it('keeps esm.sh URLs as they are', () => {
    const { loaderModule } = extractAndRewriteImports(
      "import { sha256 } from 'https://esm.sh/@noble/hashes/sha256';",
    );
    expect(loaderModule).toContain("from 'https://esm.sh/@noble/hashes/sha256'");
  });

  it.each([
    ["import x from 'https://example.com/x.js';"],
    ["import x from 'http://esm.sh/x';"],
    ["import x from 'https://esm.sh.example.com/x';"],
    ["import x from 'data:text/javascript,export default 1';"],
    ["import x from 'node:crypto';"],
    ["import x from './x.js';"],
    ["import x from '../x.js';"],
    ["import x from '/x.js';"],
    ["import 'https://example.com/side-effect.js';"],
  ])('rejects %s', (code) => {
    expect(() => extractAndRewriteImports(code)).toThrow(/Cannot import/);
  });
});
