/**
 * The file name a test's VCD is written under. `hardware/ulx3s/projects/cpu`
 * writes VCDs with it and the MCP `read_waveform` tool finds them with it, so
 * both import this one copy from `@simten/core/internal`.
 */
export function slugify(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'unnamed';
}
