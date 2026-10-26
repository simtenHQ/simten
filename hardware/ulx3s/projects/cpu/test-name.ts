/**
 * The file name a test's VCD is written under. The MCP `read_waveform` tool
 * finds VCDs with its own copy (`packages/mcp/src/lib/test-name.ts`); its
 * tests check the two agree.
 */
export function slugify(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'unnamed';
}
