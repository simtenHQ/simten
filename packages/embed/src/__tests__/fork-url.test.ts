import { decodeSourceFromUrl } from '@simten/ui/share';
import { describe, expect, it, vi } from 'vitest';
import { forkUrl } from '../fork-url';

const HOST = 'https://simten.dev';
const SOURCE = "const Toggle = circuit('Toggle', {})";

describe('forkUrl', () => {
  it('on simten.dev, creates a share through the site and opens its short link', async () => {
    const shareCircuit = vi.fn(async () => ({ hash: '0123456789abcdef0123' }));
    expect(await forkUrl({ source: SOURCE, shareCircuit, host: HOST })).toBe(
      `${HOST}/circuit/s/0123456789abcdef0123`,
    );
    expect(shareCircuit).toHaveBeenCalledWith(SOURCE);
  });

  it('anywhere else, puts the source in the URL and creates nothing', async () => {
    const url = await forkUrl({ source: SOURCE, shareCircuit: null, host: HOST });
    const prefix = `${HOST}/circuit/`;
    expect(url.startsWith(prefix)).toBe(true);
    expect(url).not.toContain('/circuit/s/');
    expect(decodeSourceFromUrl(url.slice(prefix.length))).toBe(SOURCE);
  });
});
