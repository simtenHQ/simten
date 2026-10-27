/**
 * Dev server or deployed build: the one place the web worker decides this.
 *
 * Vite answers it at build time. `vite dev` (what `pnpm dev` runs) sets
 * `import.meta.env.DEV`; `vite build` (what `pnpm deploy` and CI run) does not.
 * Everything that behaves differently in local dev asks this function.
 *
 * A missing binding never means dev. In a deployed build a missing rate
 * limiter, budget or service binding is a configuration error and the request
 * is refused; only the dev server skips limits and falls back to containers on
 * localhost.
 *
 * Tests switch modes with `vi.stubEnv('DEV', false)`.
 */
export function isDevServer(): boolean {
  return import.meta.env.DEV === true;
}
