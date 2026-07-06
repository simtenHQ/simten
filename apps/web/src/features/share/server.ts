import { env } from 'cloudflare:workers';
import { hashSource } from '@simten/ui/share';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';

const TTL_SECONDS = 60 * 60 * 24 * 365 * 2;
const MAX_SOURCE_BYTES = 100_000;

export const shareCircuit = createServerFn({ method: 'POST' })
  .inputValidator((data: { source: string }) => {
    if (typeof data?.source !== 'string') {
      throw new Error('invalid source');
    }
    if (data.source.length > MAX_SOURCE_BYTES) {
      throw new Error('source too large');
    }
    return data;
  })
  .handler(async ({ data }) => {
    const ip = getRequestHeader('cf-connecting-ip') ?? 'unknown';
    const { success } = await env.SHARE_RL.limit({ key: ip });
    if (!success) {
      throw new Error('rate limited');
    }

    const hash = await hashSource(data.source);
    await env.CIRCUIT_SHARES.put(hash, data.source, { expirationTtl: TTL_SECONDS });
    env.ANALYTICS.writeDataPoint({
      blobs: ['share_create', hash],
      doubles: [data.source.length],
    });
    return { hash };
  });

export const getSharedCircuit = createServerFn({ method: 'GET' })
  .inputValidator((hash: string) => {
    if (typeof hash !== 'string' || !/^[0-9a-f]{20}$/.test(hash)) {
      throw new Error('invalid hash');
    }
    return hash;
  })
  .handler(async ({ data: hash }) => {
    const source = await env.CIRCUIT_SHARES.get(hash);
    if (!source) return null;
    // Refresh TTL so actively-shared links never expire.
    await env.CIRCUIT_SHARES.put(hash, source, { expirationTtl: TTL_SECONDS });
    env.ANALYTICS.writeDataPoint({ blobs: ['share_read', hash] });
    return { source };
  });
