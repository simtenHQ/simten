import { describe, expect, it } from 'vitest';
import {
  containsDynamicImport,
  extractAndRewriteImports,
  hasImportStatements,
} from '../rewrite-imports';

describe('hasImportStatements', () => {
  it('finds a static import on any line', () => {
    expect(hasImportStatements("import fc from 'fast-check';")).toBe(true);
    expect(hasImportStatements("const a = 1;\n  import x from 'x';")).toBe(true);
  });

  it('ignores code without one', () => {
    expect(hasImportStatements('const important = 1;')).toBe(false);
    expect(hasImportStatements("const s = 'import x';")).toBe(false);
  });
});

describe('containsDynamicImport', () => {
  it.each([
    ["await import('https://example.com/x')"],
    ['const m = import (name);'],
    ["x.then(() => import('y'))"],
  ])('finds %s', (code) => {
    expect(containsDynamicImport(code)).toBe(true);
  });

  it('ignores static imports and lookalike names', () => {
    expect(containsDynamicImport("import fc from 'fast-check';")).toBe(false);
    expect(containsDynamicImport('reimport(x); myimport(y);')).toBe(false);
  });
});

describe('extractAndRewriteImports', () => {
  it('re-exports a default import by its local name', () => {
    const out = extractAndRewriteImports("import fc from 'fast-check';\nconst x = fc;");
    expect(out.localNames).toEqual(['fc']);
    expect(out.loaderModule).toBe("import fc from 'https://esm.sh/fast-check';\nexport { fc };");
    expect(out.codeWithoutImports).toBe('const x = fc;');
  });

  it('uses the alias for renamed named imports', () => {
    const out = extractAndRewriteImports("import { sha256 as hash, sha512 } from '@noble/hashes';");
    expect(out.localNames).toEqual(['hash', 'sha512']);
    expect(out.loaderModule).toContain("from 'https://esm.sh/@noble/hashes'");
  });

  it('handles namespace imports', () => {
    const out = extractAndRewriteImports("import * as lib from 'lodash-es';");
    expect(out.localNames).toEqual(['lib']);
    expect(out.loaderModule).toContain("import * as lib from 'https://esm.sh/lodash-es'");
  });

  it('handles a default import alongside named ones', () => {
    const out = extractAndRewriteImports("import def, { a, b as c } from 'pkg';");
    expect(out.localNames).toEqual(['a', 'c', 'def']);
  });

  it('handles imports split over several lines', () => {
    const out = extractAndRewriteImports(
      "import {\n  a,\n  b as bee,\n} from 'pkg';\nconst y = a + bee;",
    );
    expect(out.localNames).toEqual(['a', 'bee']);
    expect(out.codeWithoutImports).toBe('const y = a + bee;');
  });

  it('keeps side-effect imports in the loader without binding anything', () => {
    const out = extractAndRewriteImports("import 'polyfill';\nconst z = 1;");
    expect(out.localNames).toEqual([]);
    expect(out.loaderModule).toBe("import 'https://esm.sh/polyfill';\nexport {};");
    expect(out.codeWithoutImports).toBe('const z = 1;');
  });

  it('drops @simten/* imports, whose names are already in scope', () => {
    const out = extractAndRewriteImports(
      "import { circuit, bit } from '@simten/core/circuit';\nimport fc from 'fast-check';\ncircuit('A', {});",
    );
    expect(out.localNames).toEqual(['fc']);
    expect(out.loaderModule).not.toContain('simten');
    expect(out.codeWithoutImports).toBe("circuit('A', {});");
  });

  it('leaves dynamic import() alone for the caller to reject', () => {
    const code = "const m = await import('x');";
    const out = extractAndRewriteImports(code);
    expect(out.localNames).toEqual([]);
    expect(out.codeWithoutImports).toBe(code);
  });

  it('returns an empty loader for code with no imports', () => {
    const out = extractAndRewriteImports('const a = 1;');
    expect(out).toEqual({
      loaderModule: 'export {};',
      localNames: [],
      codeWithoutImports: 'const a = 1;',
    });
  });
});

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
