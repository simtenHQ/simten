/**
 * Compile API Handler — proxies to the compiler container.
 *
 * Production: uses Cloudflare service binding (private, no public access).
 * Local dev:  falls back to Docker container on localhost:55000.
 */

interface CompilerResponse {
  success: boolean;
  binary?: number[];
  disassembly?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export async function handleCompile(
  request: Request,
  env: Record<string, unknown>,
): Promise<Response> {
  let body: { source?: string; language?: string; disassemble?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  if (typeof body.source !== "string" || body.source.length === 0) {
    return Response.json(
      { success: false, error: "source is required" },
      { status: 400 },
    );
  }

  const language = body.language ?? "c";
  if (!["c", "cpp", "rust", "asm"].includes(language)) {
    return Response.json(
      { success: false, error: `Unsupported language: "${language}"` },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = { source: body.source, language };
  if (body.disassemble) payload.disassemble = true;

  const reqInit: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };

  // Service binding (production) → local compiler worker fallback (dev)
  const compiler = env.COMPILER as { fetch: typeof fetch } | undefined;

  try {
    const resp = compiler
      ? await compiler.fetch("https://compiler/compile", reqInit)
      : await fetch("http://localhost:55001/compile", reqInit);

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
