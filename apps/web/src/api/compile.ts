/**
 * Compile API Handler: proxies to the compiler container.
 *
 * Production: uses Cloudflare service binding (private, no public access).
 * Local dev:  falls back to wrangler dev on localhost:55001.
 */

import { type ApiEnv, checkLimits } from './limits';
import { callService } from './service';

interface CompilerResponse {
  success: boolean;
  binary?: number[];
  disassembly?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export async function handleCompile(request: Request, env: ApiEnv): Promise<Response> {
  let body: { source?: string; language?: string; disassemble?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.source !== 'string' || body.source.length === 0) {
    return Response.json({ success: false, error: 'source is required' }, { status: 400 });
  }

  const language = body.language ?? 'c';
  if (!['c', 'cpp', 'rust', 'asm'].includes(language)) {
    return Response.json(
      { success: false, error: `Unsupported language: "${language}"` },
      { status: 400 },
    );
  }

  const rejected = await checkLimits('compile', request.headers.get('CF-Connecting-IP'), env);
  if (rejected) {
    return Response.json({ success: false, error: rejected.error }, { status: rejected.status });
  }

  const payload: Record<string, unknown> = { source: body.source, language };
  if (body.disassemble) payload.disassemble = true;

  const reqInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };

  try {
    const resp = await callService(
      env.COMPILER,
      'https://compiler/compile',
      'http://localhost:55001/compile',
      reqInit,
    );

    const result: CompilerResponse = await resp.json();
    return Response.json(result, { status: resp.status });
  } catch (e) {
    return Response.json(
      {
        success: false,
        error: `Compiler error: ${e instanceof Error ? e.message : String(e)}`,
      },
      { status: 500 },
    );
  }
}
