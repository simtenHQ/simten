// Viewer-only stub for `@/features/share/server`.
//
// The real module is a TanStack Start server function backed by
// `cloudflare:workers` (KV + rate limiter) — it can't run in a static,
// client-only bundle. The standalone viewer always mounts with
// `standalone={true}`, so the Share button is never rendered and these are
// never called; the alias in `vite.viewer.config.ts` swaps the real module for
// this stub purely to keep the server-fn graph out of the client build.

export async function shareCircuit(): Promise<{ hash: string }> {
  throw new Error('Sharing is not available in the standalone viewer');
}

export async function getSharedCircuit(): Promise<{ source: string } | null> {
  return null;
}
