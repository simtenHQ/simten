import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

interface CompilerResponse {
  success: boolean;
  binary?: number[];
  stdout?: string;
  stderr?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  let body: { source?: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.source !== 'string' || body.source.length === 0) {
    return NextResponse.json({ success: false, error: 'source is required' }, { status: 400 });
  }

  const language = body.language ?? 'c';
  if (!['c', 'cpp', 'rust', 'asm'].includes(language)) {
    return NextResponse.json(
      { success: false, error: `Unsupported language: "${language}". Supported: c, cpp, rust, asm` },
      { status: 400 },
    );
  }

  try {
    // In production: use Cloudflare service binding
    const ctx = getCloudflareContext();
    const env = ctx.env as Record<string, unknown>;
    const compiler = env.COMPILER as { fetch: typeof fetch } | undefined;

    if (!compiler) {
      return NextResponse.json(
        { success: false, error: 'Compiler service not available' },
        { status: 503 },
      );
    }

    const resp = await compiler.fetch('https://compiler/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: body.source, language }),
    });

    const result: CompilerResponse = await resp.json();
    return NextResponse.json(result, { status: resp.status });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: `Compiler error: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
