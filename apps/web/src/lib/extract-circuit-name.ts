/**
 * Best-effort extraction of the first `circuit('Name', ...)` invocation in a
 * source string, for SSR `<title>` / og:title. Brittle on template literals,
 * escaped quotes, multi-line declarations — that's intentional. Callers MUST
 * have a generic fallback for the misses.
 */
export function extractCircuitName(source: string): string | null {
  try {
    const m = source.match(/\bcircuit\s*\(\s*['"]([A-Za-z_$][\w$]*)['"]/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}
