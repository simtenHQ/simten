/**
 * Every editor snippet, tabbed straight through, compiles as the sandbox runs it.
 *
 * Snippets are the editor's starter templates: what they insert is what gets
 * saved. If a rename on the frozen surface (decision 0003) breaks one, every
 * circuit started from it carries the break. `snippets.test.ts` checks the
 * shape of the bodies; this checks the code they produce.
 */

import { executeCircuitCode } from '@simten/core/internal';
import { describe, expect, it } from 'vitest';
import { SIMTEN_SNIPPETS } from '../snippets';

/** The text a user gets by accepting every tabstop default. */
function expand(body: string): string {
  let text = body;
  for (let prev = ''; prev !== text; ) {
    prev = text;
    text = text.replace(/\$\{\d+:([^{}]*)\}/g, '$1');
  }
  return text.replace(/\$\{\d+\}/g, '').replace(/\$\d+(?!\w)/g, '');
}

describe.each(SIMTEN_SNIPPETS.map((s) => [s.label, s] as const))('%s', (_label, snippet) => {
  it('compiles to a circuit', () => {
    const result = executeCircuitCode(expand(snippet.body.join('\n')));
    expect(result.error).toBeNull();
    expect(result.circuits.length).toBeGreaterThan(0);
  });
});
