/**
 * The file name a test's VCD is written under. Must match `slugify` in
 * `hardware/ulx3s/projects/cpu/test-name.ts`, which writes the files this
 * package reads; `test-name.test.ts` checks the two agree.
 */
export function slugify(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'unnamed';
}
