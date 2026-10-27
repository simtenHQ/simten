import { describe, expect, it, vi } from 'vitest';
import { fetchShare, RETRY_DELAYS_MS } from '../fetch-share';

const ID = '0123456789abcdef0123';

/** A fetch that answers with each of `responses` in turn, repeating the last. */
function answers(...responses: Array<Response | Error>) {
  let i = 0;
  return vi.fn(async () => {
    const next = responses[Math.min(i++, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next.clone();
  });
}

const found = (source: string) => Response.json({ source });
const status = (code: number) => Response.json({ error: 'x' }, { status: code });

function deps(fetch: ReturnType<typeof answers>) {
  const slept: number[] = [];
  const onRetry = vi.fn();
  return {
    slept,
    onRetry,
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep: async (ms: number) => {
      slept.push(ms);
    },
  };
}

describe('fetchShare', () => {
  it('returns a share found on the first try, without waiting', async () => {
    const fetch = answers(found('const x = 1;'));
    const d = deps(fetch);
    expect(await fetchShare(ID, d)).toEqual({ kind: 'found', source: 'const x = 1;' });
    expect(fetch).toHaveBeenCalledWith(`/api/share/${ID}`);
    expect(d.slept).toEqual([]);
  });

  it('retries a share that is still publishing until it appears', async () => {
    const d = deps(answers(status(404), status(404), found('src')));
    expect(await fetchShare(ID, d)).toEqual({ kind: 'found', source: 'src' });
    expect(d.onRetry.mock.calls).toEqual([[1], [2]]);
    expect(d.slept).toEqual(RETRY_DELAYS_MS.slice(0, 2));
  });

  it('calls a share not found after about a minute of retries', async () => {
    const fetch = answers(status(404));
    const d = deps(fetch);
    expect(await fetchShare(ID, d)).toEqual({ kind: 'not-found' });
    expect(fetch).toHaveBeenCalledTimes(RETRY_DELAYS_MS.length + 1);
    const total = d.slept.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(50_000);
    expect(total).toBeLessThanOrEqual(70_000);
  });

  it('does not retry an id that can never exist', async () => {
    const fetch = answers(status(400));
    expect(await fetchShare('nope', deps(fetch))).toEqual({ kind: 'not-found' });
    expect(fetch).not.toHaveBeenCalled();
    expect(await fetchShare(ID, deps(fetch))).toEqual({ kind: 'not-found' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries network and server errors, then reports the error', async () => {
    const d = deps(answers(new TypeError('offline'), status(500)));
    expect(await fetchShare(ID, d)).toEqual({ kind: 'error', message: 'Simten answered 500' });
    const recovered = deps(answers(new TypeError('offline'), found('src')));
    expect(await fetchShare(ID, recovered)).toEqual({ kind: 'found', source: 'src' });
  });
});
