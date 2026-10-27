import { describe, expect, it } from 'vitest';
import { embedSnippet, embedStyle, embedUrl } from '../embed-snippet';

const HASH = '0123456789abcdef0123';
const ORIGIN = 'https://embed.simten.dev';

describe('embedUrl', () => {
  it('keeps theme visible and leaves out the default controls', () => {
    expect(embedUrl({ hash: HASH, theme: 'auto', controls: true, origin: ORIGIN })).toBe(
      `${ORIGIN}/s/${HASH}?theme=auto`,
    );
    expect(embedUrl({ hash: HASH, theme: 'dark', controls: false, origin: ORIGIN })).toBe(
      `${ORIGIN}/s/${HASH}?theme=dark&controls=0`,
    );
  });
});

describe('embedStyle', () => {
  it('sizes by aspect ratio or fixed height, always full width and borderless', () => {
    expect(embedStyle('4:3')).toBe('width:100%; aspect-ratio:4/3; border:0');
    expect(embedStyle('16:9')).toBe('width:100%; aspect-ratio:16/9; border:0');
    expect(embedStyle('400px tall')).toBe('width:100%; height:400px; border:0');
  });
});

describe('embedSnippet', () => {
  it('matches the documented snippet', () => {
    expect(
      embedSnippet({
        hash: HASH,
        theme: 'auto',
        controls: true,
        size: '4:3',
        name: 'HalfAdder',
        origin: ORIGIN,
      }),
    ).toBe(
      [
        `<iframe src="${ORIGIN}/s/${HASH}?theme=auto"`,
        '        style="width:100%; aspect-ratio:4/3; border:0"',
        '        title="HalfAdder (Simten)" loading="lazy"></iframe>',
      ].join('\n'),
    );
  });

  it('escapes the title and URL for an HTML attribute', () => {
    const snippet = embedSnippet({
      hash: HASH,
      theme: 'light',
      controls: false,
      size: '1:1',
      name: 'A"<b>&',
      origin: ORIGIN,
    });
    expect(snippet).toContain('title="A&quot;&lt;b&gt;&amp; (Simten)"');
    expect(snippet).toContain(`src="${ORIGIN}/s/${HASH}?theme=light&amp;controls=0"`);
  });

  it('falls back to a generic title when the circuit has no name', () => {
    expect(
      embedSnippet({ hash: HASH, theme: 'auto', controls: true, size: '4:3', name: null }),
    ).toContain('title="Simten circuit"');
  });
});
