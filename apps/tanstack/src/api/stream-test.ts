/**
 * Stream Test API Handler — simple streaming test using Anthropic SDK.
 */

import Anthropic from '@anthropic-ai/sdk';

export async function handleStreamTest(env: Record<string, string | undefined>): Promise<Response> {
  const apiKey = env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return Response.json({ error: 'No ANTHROPIC_API_KEY' }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const anthropicStream = client.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: 'Count from 1 to 20, one number per line.' }],
      });

      for await (const event of anthropicStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(event.delta.text));
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
  });
}
