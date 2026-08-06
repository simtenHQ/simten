/**
 * The name warning has to fire while you type, not on Submit.
 *
 * Renaming the circuit used to empty the canvas and say nothing until you
 * submitted — the only way to learn the rule was to trip over it. These cover
 * the cases that decide whether the warning is helpful or just noise.
 */

import { describe, expect, it } from 'vitest';
import { nameDiagnostics } from '../level-name';
import { LEVELS } from '../levels';

describe('nameDiagnostics', () => {
  it('says nothing when the target is present', () => {
    expect(nameDiagnostics(`circuit('And1', {})`, 'And1')).toEqual([]);
  });

  it('stays quiet on a source with no circuit yet', () => {
    // Mid-keystroke. Nagging about a name nobody has written is not help.
    expect(nameDiagnostics('// thinking', 'And1')).toEqual([]);
  });

  it('warns, and names both sides, when the name diverges', () => {
    const [d] = nameDiagnostics(`export default circuit('MyAnd', {})`, 'And1');
    expect(d.severity).toBe('warning');
    expect(d.message).toContain('And1');
    expect(d.message).toContain('MyAnd');
    expect(d.line).toBe(1);
  });

  it('is a warning, never an error — the code is valid', () => {
    const ds = nameDiagnostics(`circuit('Nope', {})`, 'And1');
    expect(ds.every((d) => d.severity === 'warning')).toBe(true);
  });
});

describe('every level stub satisfies its own target', () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))('%s', (_id, level) => {
    expect(nameDiagnostics(level.stub, level.target)).toEqual([]);
  });
});
