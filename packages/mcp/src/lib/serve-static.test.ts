import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { serveStatic } from './serve-static.js';

function mockRes() {
  const calls = { status: 0, ended: false };
  const res = {
    writeHead(code: number) {
      calls.status = code;
      return res;
    },
    end() {
      calls.ended = true;
    },
    calls,
  };
  return res as unknown as ServerResponse & { calls: typeof calls };
}

describe('serveStatic', () => {
  it('answers 400 on a malformed percent-escape instead of throwing (would crash the listener)', () => {
    const res = mockRes();
    // `GET /%` makes decodeURIComponent throw URIError; the malformed-path
    // branch returns before any filesystem access, so no bundle is required.
    expect(() => serveStatic({ url: '/%' } as IncomingMessage, res)).not.toThrow();
    expect((res as unknown as { calls: { status: number; ended: boolean } }).calls.status).toBe(
      400,
    );
    expect((res as unknown as { calls: { status: number; ended: boolean } }).calls.ended).toBe(
      true,
    );
  });
});
