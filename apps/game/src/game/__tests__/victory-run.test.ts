// @vitest-environment jsdom

/**
 * The victory run against the grader (#541).
 *
 * The run used to drive the preview from wherever the player had left it, while
 * the grader opens a fresh session. On Counter a second run started mid-count
 * and lit `bit1` on the row the grader had just passed with `bit0`. These
 * drive the preview the way the level page does, in an in-process sandbox, and
 * read the outputs as each row ticks off.
 */

import { SandboxProvider, useSimulation } from '@simten/react';
import type { SandboxClient } from '@simten/sandbox';
import { inProcessSandbox } from '@simten/sandbox/host';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { readOutputs } from '../grade';
import { LEVELS_BY_ID } from '../levels';
import { SOLUTIONS } from '../solutions';
import type { Level } from '../types';
import { useVictoryRun } from '../useVictoryRun';

const sandboxes: SandboxClient[] = [];
afterEach(() => {
  cleanup();
  for (const s of sandboxes.splice(0)) s.dispose();
});

function levelOf(id: string): Level {
  const level = LEVELS_BY_ID.get(id);
  if (!level) throw new Error(`no ${id} level`);
  return level;
}

/** The level page's preview and victory run on the reference solution. */
function play(level: Level) {
  const sandbox = inProcessSandbox();
  sandboxes.push(sandbox);
  /** The outputs as each row was proven, from the render that ticked it off. */
  let rows: Record<string, number>[] = [];
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(SandboxProvider, { client: sandbox, children });
  const hook = renderHook(
    () => {
      const preview = useSimulation({ source: SOLUTIONS[level.id], circuit: level.target });
      const victory = useVictoryRun(level.vectors, preview.actions);
      const { portValues } = preview.state;
      if (victory.proven > rows.length && portValues) {
        rows.push(readOutputs(Object.fromEntries(portValues), level.outputs));
      }
      return { preview, victory };
    },
    { wrapper },
  );
  const run = async () => {
    rows = [];
    act(() => hook.result.current.victory.start());
    await waitFor(() => expect(hook.result.current.victory.complete).toBe(true), {
      timeout: 5_000,
    });
    return rows;
  };
  return { hook, run };
}

const expected = (level: Level) => level.vectors.map((v) => v.expect);

describe('useVictoryRun', () => {
  it('shows the same rows as the grader on a second run', { timeout: 15_000 }, async () => {
    const level = levelOf('counter');
    const { hook, run } = play(level);
    await waitFor(() => expect(hook.result.current.preview.state.ready).toBe(true));
    expect(await run()).toEqual(expected(level));
    expect(await run()).toEqual(expected(level));
  });

  it('starts from power-on, not from where the player left the preview', {
    timeout: 15_000,
  }, async () => {
    const level = levelOf('counter');
    const { hook, run } = play(level);
    await waitFor(() => expect(hook.result.current.preview.state.ready).toBe(true));
    await act(async () => {
      await hook.result.current.preview.actions.tick(3);
    });
    expect(await run()).toEqual(expected(level));
  });
});
