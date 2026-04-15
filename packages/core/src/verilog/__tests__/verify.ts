/**
 * Verilog verifier smoke-test helper.
 *
 * Tests that use this helper POST a `{ verilog, testbench }` pair to the
 * deployed Cloudflare Workers verifier (which runs `iverilog` + `vvp` in
 * a container) and assert on the parsed response. Used to prove that the
 * exporter's output is actually buildable and runnable, not just
 * syntactically plausible.
 *
 * Two environments:
 * - Tests run in Node via vitest, so no service-binding path is available
 *   — this helper always goes over HTTP.
 * - The runtime path used by `apps/tanstack` uses a Worker-to-Worker
 *   service binding in production (see `apps/tanstack/src/api/verify.ts`).
 *
 * Usage:
 *   import { verifyVerilog, hasVerifier } from './verify.js';
 *
 *   describe.skipIf(!hasVerifier())('RAM round-trip', () => {
 *     it('writes then reads', async () => {
 *       const { verilog } = exportVerilog(circuit, library);
 *       const result = await verifyVerilog(verilog, testbench);
 *       expect(result.success).toBe(true);
 *     });
 *   });
 *
 * Set `VERIFIER_URL` to the deployed Worker endpoint (including `/verify`
 * path) or `http://localhost:55002/verify` for the local container.
 * When unset, `hasVerifier()` returns false and tests should skip.
 */

export interface VerifyResult {
  testCase: number;
  cycle: number;
  outputs: Record<string, number>;
}

export interface VerifyResponse {
  success: boolean;
  compileError?: string;
  simError?: string;
  results?: VerifyResult[];
  simulationLog?: string;
  iverilogStderr?: string;
}

/** True when VERIFIER_URL is set. Use with `describe.skipIf(!hasVerifier())`. */
export function hasVerifier(): boolean {
  return typeof process !== 'undefined' && !!process.env?.VERIFIER_URL;
}

/** Resolved verifier endpoint or null when unset. */
export function verifierUrl(): string | null {
  if (typeof process === 'undefined') return null;
  return process.env?.VERIFIER_URL ?? null;
}

/**
 * POST Verilog + testbench to the verifier and return the parsed response.
 * Throws only on network failures — compile/sim errors come back as
 * `{ success: false, compileError | simError }` on the response.
 */
export async function verifyVerilog(
  verilog: string,
  testbench: string,
): Promise<VerifyResponse> {
  const url = verifierUrl();
  if (!url) {
    throw new Error(
      'VERIFIER_URL is not set. Skip verifier tests with `describe.skipIf(!hasVerifier())`.',
    );
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verilog, testbench }),
  });

  if (!resp.ok && resp.status !== 400) {
    throw new Error(`Verifier returned HTTP ${resp.status}: ${await resp.text()}`);
  }

  return (await resp.json()) as VerifyResponse;
}
