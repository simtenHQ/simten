/**
 * Verify API Handler: proxies to the verifier container.
 *
 * Production: uses Cloudflare service binding.
 * Local dev:  falls back to wrangler dev on localhost:55002.
 */

import { type ApiEnv, checkLimits } from './limits';
import { callService } from './service';

interface VerifyResponse {
  success: boolean;
  compileError?: string;
  simError?: string;
  results?: Array<{
    testCase: number;
    cycle: number;
    outputs: Record<string, number>;
  }>;
  simulationLog?: string;
  iverilogStderr?: string;
}

export async function handleVerify(request: Request, env: ApiEnv): Promise<Response> {
  let body: { verilog?: string; testbench?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, compileError: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.verilog !== 'string' || body.verilog.length === 0) {
    return Response.json(
      { success: false, compileError: 'verilog source is required' },
      { status: 400 },
    );
  }

  if (typeof body.testbench !== 'string' || body.testbench.length === 0) {
    return Response.json(
      { success: false, compileError: 'testbench source is required' },
      { status: 400 },
    );
  }

  const rejected = await checkLimits('verify', request.headers.get('CF-Connecting-IP'), env);
  if (rejected) {
    return Response.json(
      { success: false, compileError: rejected.error },
      { status: rejected.status },
    );
  }

  const payload = { verilog: body.verilog, testbench: body.testbench };

  const reqInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };

  try {
    const resp = await callService(
      env.VERIFIER,
      'https://verifier/verify',
      'http://localhost:55002/verify',
      reqInit,
    );

    const result: VerifyResponse = await resp.json();
    return Response.json(result, { status: resp.status });
  } catch (e) {
    return Response.json(
      {
        success: false,
        simError: `Verifier error: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }
}
