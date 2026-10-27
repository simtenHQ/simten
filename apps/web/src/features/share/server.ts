import { env } from 'cloudflare:workers';
import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { createShare, loadShare, validateShareHash, validateShareInput } from './store';

export const shareCircuit = createServerFn({ method: 'POST' })
  .inputValidator(validateShareInput)
  .handler(async ({ data }) => {
    const hash = await createShare(env, getRequestHeader('cf-connecting-ip'), data.source);
    env.ANALYTICS.writeDataPoint({
      blobs: ['share_create', hash],
      doubles: [data.source.length],
    });
    return { hash };
  });

export const getSharedCircuit = createServerFn({ method: 'GET' })
  .inputValidator(validateShareHash)
  .handler(async ({ data: hash }) => {
    const source = await loadShare(env.CIRCUIT_SHARES, hash);
    if (!source) return null;
    env.ANALYTICS.writeDataPoint({ blobs: ['share_read', hash] });
    return { source };
  });
