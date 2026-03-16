/**
 * Compile API Handler — proxies to the CC65 compiler service binding.
 */

interface CompilerResponse {
  success: boolean;
  binary?: number[];
  stdout?: string;
  stderr?: string;
  error?: string;
}

export async function handleCompile(request: Request, env: Record<string, unknown>): Promise<Response> {
  let body: { source?: string; language?: string };
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
    return Response.json({ success: false, error: `Unsupported language: "${language}"` }, { status: 400 });
  }

  try {
    const compiler = env.COMPILER as { fetch: typeof fetch } | undefined;
    if (!compiler) {
      return Response.json({ success: false, error: 'Compiler service not available' }, { status: 503 });
    }

    const resp = await compiler.fetch('https://compiler/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: body.source, language }),
    });

    const result: CompilerResponse = await resp.json();
    return Response.json(result, { status: resp.status });
  } catch (e) {
    return Response.json(
      { success: false, error: `Compiler error: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
