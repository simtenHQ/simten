import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteWideHeaders, withHeaders } from '../headers';

const HEADERS_FILE = readFileSync(join(__dirname, '../../../public/_headers'), 'utf8');

describe('siteWideHeaders', () => {
  it('reads only the /* block', () => {
    const file = [
      '# comment',
      '/assets/*',
      '  Cache-Control: immutable',
      '',
      '/*',
      '  # comment inside a block',
      '  X-One: a: b',
      '  X-Two: c',
      '/other',
      '  X-Three: d',
    ].join('\n');
    expect(siteWideHeaders(file)).toEqual([
      ['X-One', 'a: b'],
      ['X-Two', 'c'],
    ]);
  });

  it('finds the CSP in the real _headers file', () => {
    const names = siteWideHeaders(HEADERS_FILE).map(([name]) => name);
    expect(names).toContain('Content-Security-Policy');
  });

  it('lets the page frame the sandbox', () => {
    const csp = new Map(siteWideHeaders(HEADERS_FILE)).get('Content-Security-Policy');
    expect(csp).toMatch(/frame-src [^;]*https:\/\/sandbox\.simten\.dev/);
  });
});

describe('withHeaders', () => {
  it('adds headers the response does not set and keeps the ones it does', async () => {
    const res = withHeaders(new Response('body', { status: 404, headers: { 'X-Two': 'mine' } }), [
      ['X-One', 'a'],
      ['X-Two', 'b'],
    ]);
    expect(res.status).toBe(404);
    expect(res.headers.get('X-One')).toBe('a');
    expect(res.headers.get('X-Two')).toBe('mine');
    expect(await res.text()).toBe('body');
  });
});
