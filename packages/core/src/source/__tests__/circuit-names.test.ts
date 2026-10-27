/**
 * Source-text scanning for `circuit('Name', …)`.
 *
 * Backs share-link titles in apps/web and the level-name warning in the game,
 * which previously carried a near-identical regex each. Best-effort by
 * contract, so these pin what it does handle and document what it does not.
 */

import { describe, expect, it } from 'vitest';
import { circuitNameSites, firstCircuitName } from '../circuit-names.js';

describe('circuitNameSites', () => {
  it('brackets the name itself, not the call', () => {
    const [site] = circuitNameSites(`export default circuit('And1', {`);
    expect(site).toMatchObject({ name: 'And1', line: 1 });
    expect(site.endColumn - site.column).toBe('And1'.length);
    // Column lands on the name, past the opening quote.
    expect(`export default circuit('And1', {`.slice(site.column - 1, site.endColumn - 1)).toBe(
      'And1',
    );
  });

  it('reports every declaration in source order, with line numbers', () => {
    const src = "circuit('One', {})\n\nconst x = circuit('Two', {})";
    expect(circuitNameSites(src).map((s) => [s.name, s.line])).toEqual([
      ['One', 1],
      ['Two', 3],
    ]);
  });

  it('accepts double quotes and whitespace in the call', () => {
    expect(circuitNameSites(`circuit  (  "Spaced" , {})`).map((s) => s.name)).toEqual(['Spaced']);
  });

  it('ignores names that are not valid identifiers', () => {
    expect(circuitNameSites(`circuit('9lives', {})`)).toEqual([]);
  });

  it('returns nothing for source with no circuit', () => {
    expect(circuitNameSites('const x = 1;')).toEqual([]);
  });
});

describe('firstCircuitName', () => {
  it('returns the first declaration', () => {
    expect(firstCircuitName("circuit('A', {})\ncircuit('B', {})")).toBe('A');
  });

  it('returns null when there is none', () => {
    expect(firstCircuitName('// nothing here')).toBeNull();
  });
});
