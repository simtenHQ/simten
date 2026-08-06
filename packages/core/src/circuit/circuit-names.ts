/**
 * Finding `circuit('Name', …)` declarations in source text.
 *
 * Sits with `stripTypes`/`stripImports`/`stripExports`: text utilities for
 * circuit source that run before, or instead of, executing it. Callers use it
 * to title a shared circuit, or to tell an author which circuit they have
 * actually declared, without paying for a compile.
 *
 * Best-effort by design. It is a regex, so it is brittle on template literals,
 * escaped quotes and names split across lines. Every caller MUST have a
 * fallback for the misses — this is for labels and hints, never for anything
 * that must be correct. Use `executeCircuitCode` when it must be.
 */

/** A `circuit('Name'` occurrence, with enough position to place an editor marker. */
export interface CircuitNameSite {
  name: string;
  /** 1-based, matching editor conventions. */
  line: number;
  /** 1-based column of the name itself, excluding its quotes. */
  column: number;
  /** 1-based column just past the name. */
  endColumn: number;
}

const CIRCUIT_CALL = /\bcircuit\s*\(\s*['"`]([A-Za-z_$][\w$]*)['"`]/g;

/** Every circuit name the source declares, in source order. */
export function circuitNameSites(source: string): CircuitNameSite[] {
  const sites: CircuitNameSite[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    CIRCUIT_CALL.lastIndex = 0;
    let m: RegExpExecArray | null = CIRCUIT_CALL.exec(lines[i]);
    while (m !== null) {
      const name = m[1];
      const nameStart = lines[i].indexOf(name, m.index);
      sites.push({
        name,
        line: i + 1,
        column: nameStart + 1,
        endColumn: nameStart + 1 + name.length,
      });
      m = CIRCUIT_CALL.exec(lines[i]);
    }
  }
  return sites;
}

/** The first circuit name declared, or null. For titles and labels. */
export function firstCircuitName(source: string): string | null {
  return circuitNameSites(source)[0]?.name ?? null;
}
