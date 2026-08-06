/**
 * The truth table has to read the level shape correctly.
 *
 * When levels moved from `Record<string, PortSpec>` to a list of signal names,
 * the table kept doing `Object.keys(level.inputs)` — which on an array returns
 * indices. It rendered headers `0`, `1`, `0` and blank cells, and neither
 * TypeScript nor the suite noticed, because `Object.keys` on an array is
 * perfectly legal and nothing rendered the component.
 */

import { describe, expect, it } from 'vitest';
import { columnsFor } from '../../components/TruthTable';
import { LEVELS } from '../levels';

describe('columnsFor', () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))('%s names its signals', (_id, level) => {
    const { inputNames, outputNames } = columnsFor(level);

    // Never array indices.
    for (const name of [...inputNames, ...outputNames]) {
      expect(name).not.toMatch(/^\d+$/);
    }

    // Every column must actually resolve against the vectors it labels.
    for (const v of level.vectors) {
      for (const n of inputNames) expect(v.inputs[n]).toBeTypeOf('number');
      for (const n of outputNames) expect(v.expect[n]).toBeTypeOf('number');
    }
  });
});
