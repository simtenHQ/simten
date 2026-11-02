/**
 * `resolveKey` on a name that is both a port and a Switch. `circuit()` rejects
 * that circuit (#545), so the check here only guards IR that didn't come
 * through it, and the scope is written out by hand.
 */

import { describe, expect, it } from 'vitest';
import { type KeyScope, resolveKey } from '../input-keys.js';

function scope(ports: { inputs?: string[]; outputs?: string[] }, switches: string[]): KeyScope {
  return {
    circuitName: 'Clash',
    inputs: new Set(ports.inputs),
    outputs: new Set(ports.outputs),
    primitives: () => new Map(switches.map((path) => [path, 'Switch'])),
    isControl: (type) => type === 'Switch',
  };
}

describe('resolveKey on a port and a Switch with the same name', () => {
  it('refuses an input port and a Switch, for set and get', () => {
    const clash = scope({ inputs: ['a'] }, ['a']);
    expect(() => resolveKey('set', 'a', clash)).toThrow(
      "set('a'): Clash has both an input port and a Switch named 'a', so the key is ambiguous. Rename one of them.",
    );
    expect(() => resolveKey('get', 'a', clash)).toThrow("get('a'): Clash has both an input port");
  });

  it('refuses an output port and a Switch for get as for set, so a toggle never reads one and writes the other', () => {
    const clash = scope({ outputs: ['y'] }, ['y']);
    expect(() => resolveKey('get', 'y', clash)).toThrow(
      "get('y'): Clash has both an output port and a Switch named 'y'",
    );
    expect(() => resolveKey('set', 'y', clash)).toThrow(
      "set('y'): Clash has both an output port and a Switch named 'y'",
    );
  });

  it('takes the same names apart', () => {
    const apart = scope({ inputs: ['a'], outputs: ['y'] }, ['s']);
    expect(resolveKey('set', 'a', apart)).toEqual({ kind: 'port', name: 'a', key: 'a' });
    expect(resolveKey('set', 's', apart)).toEqual({ kind: 'path', path: 's', key: 's.out' });
    expect(resolveKey('get', 'y', apart)).toEqual({ kind: 'output', key: 'y' });
  });
});
