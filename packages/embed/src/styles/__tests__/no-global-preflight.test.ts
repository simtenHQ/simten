/**
 * The embed's stylesheet must not restyle its host page.
 *
 * `dist/styles.css` is meant to be dropped into other people's sites with a
 * plain `<link>` tag — that is the whole point of the web component, and the
 * audience most likely to do it is someone embedding a circuit in a blog post.
 * There is no Shadow DOM to hide behind, because ReactFlow needs direct DOM
 * access (webcomponent/index.ts), so isolation is the CSS's job alone.
 *
 * It shipped Tailwind's Preflight unscoped for a while:
 *
 *   h1,h2,h3,h4,h5,h6 { font-size: inherit; font-weight: inherit }
 *   a { color: inherit; text-decoration: inherit }
 *
 * which flattened every heading and stripped every link on any page that
 * embedded a circuit. The failure lands on the host's article, not on the
 * embed, so nobody testing the embed in isolation would ever see it — which is
 * exactly why it needs a test rather than care.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '../../..');
const SOURCE = join(packageRoot, 'src/styles/embed.css');
const BUILT = join(packageRoot, 'dist/styles.css');

describe('embed.css source', () => {
  const css = readFileSync(SOURCE, 'utf8');

  it('does not import Tailwind wholesale', () => {
    // `@import "tailwindcss"` includes Preflight. The granular theme/utilities
    // imports are used instead, with the resets re-applied scoped below.
    expect(css).not.toMatch(/@import\s+["']tailwindcss["']\s*;/);
  });

  it('imports the layers it does need', () => {
    expect(css).toMatch(/@import\s+["']tailwindcss\/theme\.css["']/);
    expect(css).toMatch(/@import\s+["']tailwindcss\/utilities\.css["']/);
  });

  it('scopes every reset selector to the embed root', () => {
    // Any bare element selector here is a rule applied to somebody else's page.
    const resets = css.matchAll(/^([a-z][\w\s,>:*[\]="'-]*)\{/gim);
    const unscoped = [...resets]
      .map((m) => m[1].trim())
      .filter((sel) => !sel.includes('[data-embed-theme]') && !sel.startsWith('@'));
    expect(unscoped).toEqual([]);
  });
});

describe('built stylesheet', () => {
  // Only meaningful after a build; the source assertions above are the gate
  // that runs everywhere.
  const built = existsSync(BUILT) ? readFileSync(BUILT, 'utf8') : null;

  it.runIf(built)('carries no unscoped heading reset', () => {
    expect(built).not.toMatch(/[;}]h1,h2,h3,h4,h5,h6\{/);
  });

  it.runIf(built)('carries no unscoped anchor reset', () => {
    expect(built).not.toMatch(/[;}]a\{color:inherit/);
  });

  it.runIf(built)('still ships the scoped resets', () => {
    expect(built).toMatch(/\[data-embed-theme\] h1/);
    expect(built).toMatch(/box-sizing:border-box/);
  });
});
