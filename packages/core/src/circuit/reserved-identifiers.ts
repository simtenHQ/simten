/**
 * Reserved JS identifiers that a generated circuit name must not shadow.
 *
 * The serializer emits each circuit as a top-level `const <name> = circuit(...)`.
 * The editor type-checks pasted source in *script* scope with the DOM lib, so a
 * circuit named after a global `var` binding (`top`, `self`, `name`, …) collides
 * ("Cannot redeclare block-scoped variable 'top'"), and a circuit named after a
 * JS keyword (`default`, `in`, `class`, …) is a hard syntax error. Verilog top
 * modules are very often literally named `top`, so this is common, not exotic.
 *
 * Only top-level `const` declarations collide — node ids appear as object keys
 * and property accesses (`nodes.top`), which are legal for any name, so this
 * applies to circuit names alone.
 */

export const RESERVED_IDENTIFIERS: ReadonlySet<string> = new Set([
  // JS reserved words (illegal as a binding name)
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'let',
  'static',
  'await',
  'async',
  // Global `var` bindings from lib.dom.d.ts that clash with a top-level `const`
  'top',
  'self',
  'parent',
  'window',
  'document',
  'name',
  'length',
  'status',
  'origin',
  'closed',
  'frames',
  'location',
  'history',
  'navigator',
  'event',
  'screen',
  'external',
  'menubar',
  'toolbar',
  'locationbar',
  'personalbar',
  'scrollbars',
  'statusbar',
  'frameElement',
  'opener',
  'globalThis',
]);

/**
 * Map a circuit name to a safe, unique JS identifier for use as the emitted
 * `const` name and every reference to it. Reserved names are suffixed with `_`;
 * `used` guarantees uniqueness across all emitted circuits.
 */
export function safeIdentifier(name: string, used?: Set<string>): string {
  let id = RESERVED_IDENTIFIERS.has(name) ? `${name}_` : name;
  if (used) {
    let k = 2;
    while (used.has(id)) id = `${name}_${k++}`;
    used.add(id);
  }
  return id;
}
