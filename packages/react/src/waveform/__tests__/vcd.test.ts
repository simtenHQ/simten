/**
 * Save VCD: the recording as a Value Change Dump. Parsed back here with a
 * strict reader of the format's grammar (IEEE 1364 §18.2), the subset GTKWave
 * needs: declarations, `$enddefinitions`, increasing timestamps, and scalar
 * and vector value changes for declared identifiers.
 */

import { describe, expect, it } from 'vitest';
import { toVcd } from '../vcd';

interface Parsed {
  module: string;
  vars: Map<string, { name: string; width: number }>;
  /** Value of each variable, by name, at each timestamp that changed something. */
  changes: Array<{ time: number; values: Map<string, number> }>;
}

function parseVcd(text: string): Parsed {
  const tokens = text.split(/\s+/).filter(Boolean);
  const vars = new Map<string, { name: string; width: number }>();
  let module = '';
  let i = 0;
  const until = (end: string) => {
    const out: string[] = [];
    while (tokens[i] !== end) {
      if (i >= tokens.length) throw new Error(`no ${end}`);
      out.push(tokens[i++]);
    }
    i++;
    return out;
  };
  for (;;) {
    const t = tokens[i++];
    if (t === undefined) throw new Error('no $enddefinitions');
    if (t === '$enddefinitions') {
      until('$end');
      break;
    }
    const body = until('$end');
    if (t === '$scope') {
      expect(body[0]).toBe('module');
      module = body[1];
    } else if (t === '$var') {
      const [kind, width, id, name] = body;
      expect(kind).toBe('wire');
      expect(Number(width)).toBeGreaterThan(0);
      expect(id).toMatch(/^[!-~]+$/);
      vars.set(id, { name, width: Number(width) });
    } else if (!['$version', '$timescale', '$upscope', '$date', '$comment'].includes(t)) {
      throw new Error(`unexpected ${t}`);
    }
  }
  const changes: Parsed['changes'] = [];
  let lastTime = -1;
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '$dumpvars' || t === '$end') continue;
    if (t.startsWith('#')) {
      const time = Number(t.slice(1));
      expect(time).toBeGreaterThan(lastTime);
      lastTime = time;
      changes.push({ time, values: new Map() });
      continue;
    }
    let id: string;
    let value: number;
    if (t.startsWith('b')) {
      expect(t.slice(1)).toMatch(/^[01]+$/);
      value = Number.parseInt(t.slice(1), 2);
      id = tokens[++i];
    } else {
      expect(t[0]).toMatch(/[01]/);
      value = Number(t[0]);
      id = t.slice(1);
    }
    const v = vars.get(id);
    if (!v) throw new Error(`undeclared identifier ${id}`);
    expect(value).toBeLessThan(2 ** v.width);
    changes.at(-1)?.values.set(v.name, value);
  }
  return { module, vars, changes };
}

describe('toVcd', () => {
  const signals = [
    { name: 'en', width: 1, values: [1, 1, 0, 0] },
    { name: 'count', width: 8, values: [3, 4, 5, 5] },
  ];

  it('declares each signal and dumps its values at each cycle, changes only', () => {
    const vcd = parseVcd(toVcd('Counter', 10, signals));
    expect(vcd.module).toBe('Counter');
    expect([...vcd.vars.values()]).toEqual([
      { name: 'en', width: 1 },
      { name: 'count', width: 8 },
    ]);
    const at = (time: number) =>
      Object.fromEntries(vcd.changes.find((c) => c.time === time)?.values ?? []);
    expect(at(10)).toEqual({ en: 1, count: 3 });
    expect(at(11)).toEqual({ count: 4 });
    expect(at(12)).toEqual({ en: 0, count: 5 });
    // Nothing changed at 13; 14 closes the last cycle.
    expect(vcd.changes.map((c) => c.time)).toEqual([10, 11, 12, 14]);
  });

  it('gives over 94 signals identifiers of their own', () => {
    const many = Array.from({ length: 200 }, (_, n) => ({
      name: `s${n}`,
      width: 1,
      values: [n % 2],
    }));
    const vcd = parseVcd(toVcd('Wide', 0, many));
    expect(vcd.vars.size).toBe(200);
  });

  it('keeps names free of whitespace', () => {
    const vcd = parseVcd(toVcd('My Circuit', 0, [{ name: 'a b', width: 1, values: [1] }]));
    expect(vcd.module).toBe('My_Circuit');
    expect([...vcd.vars.values()][0].name).toBe('a_b');
  });
});
