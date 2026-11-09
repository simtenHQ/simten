/**
 * tick() leaves the string-keyed snapshot unbuilt until something reads it.
 * A read must see the same values an eager build would have, and a read after
 * the state moves on must fail rather than return the newer state.
 */

import { describe, expect, it } from 'vitest';
import { internalsOf } from '../../circuit/internals.js';
import { EXAMPLES } from '../../examples/catalog.js';
import { executeCircuitCode } from '../../source/execute.js';
import { createEngine, elaborate } from '../index.js';

function engineFor(id: string) {
  const example = EXAMPLES.find((e) => e.id === id);
  if (!example) throw new Error(`no example '${id}'`);
  const compiled = executeCircuitCode(example.code);
  if (compiled.error) throw new Error(compiled.error);
  const top = internalsOf(compiled.circuits[compiled.circuits.length - 1]).ir;
  return createEngine(elaborate(top, compiled.library.definitions), {
    library: compiled.library,
  });
}

describe('tick result', () => {
  it('reads the same values a snapshot builds', () => {
    const engine = engineFor('fibonacci');
    for (let i = 0; i < 20; i++) {
      const result = engine.tick();
      const eager = engine.snapshot();
      expect(result.portValues).toEqual(eager.portValues);
      expect(result.sequentialState).toEqual(eager.sequentialState);
    }
  });

  it('matches the values of an engine that read every tick', () => {
    const lazy = engineFor('rv32i-computer');
    const eager = engineFor('rv32i-computer');
    for (let i = 0; i < 300; i++) {
      lazy.tick();
      eager.tick().portValues;
    }
    expect(lazy.getPortValues()).toEqual(eager.getPortValues());
    expect(lazy.getState()).toEqual(eager.getState());
  });

  it('throws when read after the next tick', () => {
    const engine = engineFor('fibonacci');
    const first = engine.tick();
    engine.tick();
    expect(() => first.portValues).toThrow(/moved on/);
    expect(() => first.sequentialState).toThrow(/moved on/);
  });

  it('throws when read after a write', () => {
    const engine = engineFor('hack-alu');
    const result = engine.tick();
    engine.setInput('x', 3);
    expect(() => result.portValues).toThrow(/moved on/);
  });

  it('does not propagate again on a settled read', () => {
    const engine = engineFor('fibonacci');
    engine.tick();
    const settled = engine.runCombinational();
    expect(settled.metrics.totalEvals).toBe(0);
    expect(settled.portValues).toBe(engine.getPortValues());
  });
});
