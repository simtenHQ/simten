/**
 * Snippet bodies are strings, not TypeScript, so nothing type-checks them — a
 * stray brace or a mismatched tabstop default only shows up as a mangled
 * insertion when a user triggers the snippet. These tests are that check, run
 * against the data rather than a live Monaco (which would need a DOM).
 *
 * The subtle one is tabstop-default consistency. A repeated tabstop is a linked
 * edit: `${1:MyCircuit}` in two places means typing the name once fills both.
 * If the two occurrences carry *different* defaults, Monaco picks one and the
 * scaffold silently disagrees with itself — the exact thing these snippets exist
 * to prevent.
 */

import { describe, expect, it } from 'vitest';
import { SIMTEN_SNIPPETS } from './snippets';

/** Placeholder defaults per tabstop index, brace-matched so nesting survives. */
function tabstopDefaults(body: string): Map<number, string[]> {
  const found = new Map<number, string[]>();
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '$' || body[i + 1] !== '{') continue;
    const m = /^\$\{(\d+)[:}]/.exec(body.slice(i));
    if (!m) continue;
    const index = Number(m[1]);
    let depth = 0;
    let end = i + 1;
    for (; end < body.length; end++) {
      if (body[end] === '{') depth++;
      else if (body[end] === '}' && --depth === 0) break;
    }
    const inner = body.slice(i + 2 + m[1].length, end);
    const list = found.get(index) ?? [];
    list.push(inner.startsWith(':') ? inner.slice(1) : '');
    found.set(index, list);
    i = i + 1 + m[1].length;
  }
  return found;
}

/** All tabstop indices, including bare `$0` / `$1` forms. */
function tabstopIndices(body: string): Set<number> {
  const out = new Set<number>();
  for (const m of body.matchAll(/\$\{(\d+)[:}]/g)) out.add(Number(m[1]));
  for (const m of body.matchAll(/\$(\d+)(?!\w)/g)) out.add(Number(m[1]));
  return out;
}

/** Expand a snippet to the text a user gets if they tab straight through. */
function expand(body: string): string {
  let prev: string;
  let text = body;
  do {
    prev = text;
    text = text.replace(/\$\{(\d+):([^{}]*)\}/g, '$2');
  } while (text !== prev);
  return text.replace(/\$\{\d+\}/g, '').replace(/\$\d+(?!\w)/g, '');
}

const balanced = (s: string) => {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const stack: string[] = [];
  let inString: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === inString && s[i - 1] !== '\\') inString = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') inString = c;
    else if ('([{'.includes(c)) stack.push(c);
    else if (')]}'.includes(c) && stack.pop() !== pairs[c]) return false;
  }
  return stack.length === 0 && inString === null;
};

describe('snippet catalogue', () => {
  it('has unique labels', () => {
    const labels = SIMTEN_SNIPPETS.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('describes every snippet', () => {
    for (const s of SIMTEN_SNIPPETS) {
      expect(s.detail.length, `${s.label} detail`).toBeGreaterThan(0);
      expect(s.documentation.length, `${s.label} documentation`).toBeGreaterThan(20);
    }
  });
});

describe.each(SIMTEN_SNIPPETS.map((s) => [s.label, s] as const))('%s', (label, snippet) => {
  const body = snippet.body.join('\n');

  it('places the final cursor with $0', () => {
    expect(tabstopIndices(body).has(0), `${label} has no $0`).toBe(true);
  });

  it('numbers tabstops contiguously from 1', () => {
    const stops = [...tabstopIndices(body)].filter((n) => n !== 0).sort((a, b) => a - b);
    expect(stops, `${label} tabstops should be 1..${stops.length}`).toEqual(
      stops.map((_, i) => i + 1),
    );
  });

  it('gives every repeated tabstop the same default (linked edits must agree)', () => {
    for (const [index, defaults] of tabstopDefaults(body)) {
      const distinct = new Set(defaults.filter((d) => d !== ''));
      expect(
        distinct.size,
        `${label} $${index} has conflicting defaults: ${[...distinct]}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it('expands to balanced source', () => {
    expect(balanced(expand(body)), `${label} expands unbalanced:\n${expand(body)}`).toBe(true);
  });

  it('indents with spaces only', () => {
    expect(body).not.toMatch(/\t/);
  });

  it('opens with an export so a testbench can import it', () => {
    expect(body.startsWith('export const ')).toBe(true);
  });
});
