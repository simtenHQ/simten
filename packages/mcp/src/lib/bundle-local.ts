/**
 * One source string for a circuit file that imports sibling files.
 *
 * show_circuit sends the browser a single source string, and the sandbox there
 * has no file system: it can load npm packages from esm.sh, and `@simten/*`
 * names are already in scope, but it can't read `./half-adder`. So a file with
 * local imports is bundled here first, on the host, with the files it imports
 * inlined and every package import (`@simten/core`, npm) left for the sandbox
 * as before (#511).
 *
 * esbuild comes with tsx, which the MCP already depends on to load files.
 */

import { build } from 'esbuild';

/** Whether the source imports from a relative path (`./x`, `../x`). */
export function hasLocalImports(source: string): boolean {
  return /^[ \t]*(?:import|export)\b[^'"]*?from[ \t]*['"]\.{1,2}\//m.test(source);
}

/** An `import { … } from '@simten/…'` line, as esbuild prints one. */
const SIMTEN_IMPORT = /^import\s*\{([^}]*)\}\s*from\s*(["']@simten\/[^"']+["']);?$/gm;

/** The `// path/to/file.ts` line esbuild puts before each file's code. */
const FILE_MARKER = /^\/\/ [^\n]*\.[cm]?[jt]sx?\n/gm;

/**
 * The sandbox drops `@simten/*` imports and puts each name in scope as itself.
 * When two bundled files import the same name, esbuild renames one of them
 * (`circuit as circuit2`), which would then be undefined. So a renamed name
 * leaves the import and becomes `const circuit2 = circuit;`.
 */
function keepRenamedImports(source: string): string {
  return source.replace(SIMTEN_IMPORT, (_line, names: string, from: string) => {
    const kept: string[] = [];
    const aliases: string[] = [];
    for (const name of names.split(',').map((n) => n.trim())) {
      const [original, alias] = name.split(/\s+as\s+/);
      if (alias) aliases.push(`const ${alias} = ${original};`);
      else if (original) kept.push(original);
    }
    const line = kept.length > 0 ? [`import { ${kept.join(', ')} } from ${from};`] : [];
    return [...line, ...aliases].join('\n');
  });
}

/** The bundle as the canvas's editor shows it: no esbuild file markers. */
function tidy(source: string): string {
  return keepRenamedImports(source).replace(FILE_MARKER, '').trimStart();
}

/** The file and the local files it imports, as one ES module. */
export async function bundleLocalImports(
  file: string,
): Promise<{ source: string } | { error: string }> {
  try {
    const result = await build({
      entryPoints: [file],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      // Bare specifiers stay imports: the sandbox resolves them.
      packages: 'external',
      logLevel: 'silent',
    });
    return { source: tidy(result.outputFiles[0].text) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Could not bundle ${file} with its local imports: ${message}` };
  }
}
