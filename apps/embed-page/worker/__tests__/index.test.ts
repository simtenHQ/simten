import type { ShareKV } from '@simten/app-kit/share';
import { describe, expect, it } from 'vitest';
import { type Env, handleRequest } from '../index';

const ID = '0123456789abcdef0123';

function env(entries: Record<string, string> = {}): Env & { writes: number } {
  const store = new Map(Object.entries(entries));
  const e = {
    writes: 0,
    CIRCUIT_SHARES: {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async put(key: string, value: string) {
        e.writes++;
        store.set(key, value);
      },
    } satisfies ShareKV,
  };
  return e;
}

const get = (path: string, method = 'GET') =>
  new Request(`https://embed.simten.dev${path}`, { method });

describe('GET /api/share/<id>', () => {
  it('returns the source of a share it can see, cacheable for good', async () => {
    const e = env({ [ID]: 'const x = 1;' });
    const res = await handleRequest(get(`/api/share/${ID}`), e);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ source: 'const x = 1;' });
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    expect(e.writes).toBe(0);
  });

  it('answers 404, uncached, for a share that is missing or still publishing', async () => {
    const e = env();
    const res = await handleRequest(get(`/api/share/${ID}`), e);
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    // A share that lands in KV afterwards is found by the next request.
    await e.CIRCUIT_SHARES.put(ID, 'late');
    expect((await handleRequest(get(`/api/share/${ID}`), e)).status).toBe(200);
  });

  it('answers 400 for an id hashSource could not produce', async () => {
    for (const id of ['abc', '0123456789ABCDEF0123', `${ID}0`, '..%2F..%2Fx']) {
      expect((await handleRequest(get(`/api/share/${id}`), env())).status).toBe(400);
    }
  });

  it('answers 404 for anything but GET /api/share/<id>', async () => {
    const e = env({ [ID]: 'x' });
    expect((await handleRequest(get(`/api/share/${ID}`, 'POST'), e)).status).toBe(404);
    expect((await handleRequest(get('/api/share'), e)).status).toBe(404);
    expect((await handleRequest(get(`/api/share/${ID}/x`), e)).status).toBe(404);
  });
});
