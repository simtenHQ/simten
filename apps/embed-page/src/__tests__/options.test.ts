import { describe, expect, it } from 'vitest';
import { embedCsp, headersFile } from '../headers';
import { parseEmbedRequest, resolveTheme } from '../options';

const parse = (path: string) => parseEmbedRequest(new URL(`https://embed.simten.dev${path}`));

describe('parseEmbedRequest', () => {
  it('reads the share id and defaults to theme auto with controls', () => {
    expect(parse('/s/0123456789abcdef0123')).toEqual({
      id: '0123456789abcdef0123',
      theme: 'auto',
      controls: true,
    });
    expect(parse('/s/abc/').id).toBe('abc');
  });

  it('reads theme and controls, ignoring values it does not know', () => {
    expect(parse('/s/a?theme=dark&controls=0')).toMatchObject({ theme: 'dark', controls: false });
    expect(parse('/s/a?theme=light&controls=1')).toMatchObject({ theme: 'light', controls: true });
    expect(parse('/s/a?theme=neon')).toMatchObject({ theme: 'auto' });
  });

  it('has no id off the /s/<id> path', () => {
    expect(parse('/').id).toBeNull();
    expect(parse('/s/a/b').id).toBeNull();
  });
});

describe('resolveTheme', () => {
  it('follows the system only for auto', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });
});

describe('embedCsp', () => {
  it('may be framed by anyone and frames only the sandbox', () => {
    const csp = embedCsp();
    expect(csp).toContain('frame-ancestors *');
    expect(csp).toContain('frame-src https://sandbox.simtenusercontent.dev;');
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain('unsafe');
  });

  it('adds a local sandbox only when the build points at one', () => {
    expect(embedCsp('http://localhost:3002')).toContain(
      'frame-src https://sandbox.simtenusercontent.dev http://localhost:3002;',
    );
    expect(headersFile()).toContain(
      '/assets/*\n  Cache-Control: public, max-age=31536000, immutable',
    );
  });
});
