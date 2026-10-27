/**
 * The /circuit Snake example is generated from snake.ts (scripts/gen-examples.ts).
 * These tests fail when the generated file is stale or the example stops
 * building the same SnakeCore as the module.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  renderSnakeSource,
  SNAKE_MODULE,
  SNAKE_SOURCE_FILE,
} from '../../../scripts/gen-examples.js';
import { internalsOf } from '../../circuit/internals.js';
import { executeCircuitCode } from '../../source/execute.js';
import { EXAMPLES } from '../catalog.js';
import { buildSnake } from '../snake.js';

describe('Snake example source', () => {
  it('snake-source.gen.ts is up to date (run `pnpm --filter @simten/core gen:examples`)', () => {
    const expected = renderSnakeSource(readFileSync(SNAKE_MODULE, 'utf8'));
    expect(readFileSync(SNAKE_SOURCE_FILE, 'utf8')).toBe(expected);
  });

  it('the catalog example builds the same SnakeCore IR as snake.ts', () => {
    const example = EXAMPLES.find((e) => e.id === 'snake')!;
    const compiled = executeCircuitCode(example.code);
    expect(compiled.error).toBeNull();

    const { core } = buildSnake();
    const canonical = [core, ...internalsOf(core).dependencies.values()]
      .map((c) => internalsOf(c).ir)
      .filter((ir) => ir.implementation.kind === 'composite');
    expect(canonical.length).toBeGreaterThan(1);
    for (const ir of canonical) {
      const fromExample = compiled.circuits.find((c) => c.name === ir.name);
      expect(fromExample, ir.name).toEqual(ir);
    }
  });
});
