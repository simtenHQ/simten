/**
 * A circuit validation error carries the line of the mistake, not the line of
 * the `circuit(...)` call (#513). The editor reads `(line:column)` off the end
 * of a compile error to place its marker.
 */

import { describe, expect, it } from 'vitest';
import { executeCircuitCode } from '../execute.js';

/** The `(line:column)` an error ends with, or undefined. */
function placeOf(error: string | null): { line: number; column: number } | undefined {
  const at = error && /\((\d+):(\d+)\)$/.exec(error);
  return at ? { line: Number(at[1]), column: Number(at[2]) } : undefined;
}

/** The 1-based line of `source` that contains `text`. */
function lineOf(source: string, text: string): number {
  return source.split('\n').findIndex((l) => l.includes(text)) + 1;
}

describe('where a circuit error points', () => {
  it('points at a misspelt port, not at circuit()', () => {
    const source = `import { bit, circuit } from '@simten/core';
import { FullAdder } from '@simten/core/std';

export const Broken = circuit('Broken', {
  inputs: { a: bit, b: bit },
  outputs: { s: bit },
  nodes: { h: FullAdder },
  connect: ({ inputs, outputs, nodes: { h } }) => [
    inputs.a.to(h.a),
    inputs.b.to(h.b),
    h.summ.to(outputs.s),
  ],
});
`;
    const { error } = executeCircuitCode(source);
    expect(error).toContain("Port 'summ' does not exist on node 'h' (FullAdder)");
    expect(placeOf(error)?.line).toBe(11);
  });

  it('points at the connection an error found after connect is about', () => {
    const source = `import {
  bit,
  circuit,
} from '@simten/core';

type Unused = { a: number };

export const TwoDrivers = circuit('TwoDrivers', {
  inputs: { a: bit, b: bit },
  outputs: { y: bit },
  connect: ({ inputs, outputs }) => [
    inputs.a.to(outputs.y),
    inputs.b.to(outputs.y),
  ],
});
`;
    const { error } = executeCircuitCode(source);
    expect(error).toContain('y has multiple drivers: a, b');
    expect(placeOf(error)).toEqual({ line: lineOf(source, 'inputs.b.to'), column: 14 });
  });

  it('points at a truncating connection', () => {
    const source = `const Narrow = circuit('Narrow', {
  inputs: { a: bus(8) },
  outputs: { y: bus(4) },
  connect: ({ inputs, outputs }) => [inputs.a.to(outputs.y)],
});
`;
    const { error } = executeCircuitCode(source);
    expect(error).toContain('truncates a bus(8) into y bus(4)');
    expect(placeOf(error)?.line).toBe(4);
  });

  it('points at any other throw in the source', () => {
    const { error } = executeCircuitCode('const a = 1;\n\nnotDefined();\n');
    expect(placeOf(error)?.line).toBe(3);
  });

  it('leaves an error with nothing to point at as it was', () => {
    const { error } = executeCircuitCode(
      "circuit('Bad', { inputs: { a: bit }, outputs: { a: bit } });",
    );
    expect(error).toContain("Port name 'a' used for both input and output");
  });
});
