/**
 * Import primitives must survive the editor sandbox's eval-transfer.
 *
 * The sandbox (apps/sandbox worker) serializes every registered eval/onTick via
 * `fn.toString()` and rebuilds it with `new Function('return (' + src + ')')()`
 * — which DROPS the factory closure (and module-scope helpers like `maskOf`). So
 * the import-home primitives (Pmux/Dlatch/Mem, which appear in clean imported
 * source) must read their shape from `io` (node.arguments are merged into eval
 * inputs) and inline any masks. A closure reference here surfaces in the editor
 * as e.g. "sWidth is not defined" at runtime, with no red squiggle.
 *
 * This test reproduces that exact reconstruction and asserts the rebuilt eval
 * still computes correctly.
 */

import { describe, expect, it } from 'vitest';
import { getCircuitEval } from '../../circuit/index.js';
import { Dlatch, Mem, Pmux } from '../../rtl/index.js';

/** Mirror the sandbox: stringify → new Function → the rebuilt lambda. */
function reconstruct(fn: (...a: any[]) => any): (io: any) => any {
  return new Function(`return (${fn.toString()})`)() as (io: any) => any;
}

describe('import primitives survive sandbox eval reconstruction (new Function(toString))', () => {
  it('Pmux: one-hot select reads sWidth/width from io', () => {
    Pmux({ width: 8, sWidth: 3 });
    const evalFn = reconstruct(getCircuitEval('Pmux_8w_3s')!.evalFn);
    // s selects lane 1; b_1 = 20
    expect(evalFn({ width: 8, sWidth: 3, s: 0b010, a: 99, b_0: 10, b_1: 20, b_2: 30 })).toEqual({
      out: 20,
    });
    // no lane selected → default a
    expect(evalFn({ width: 8, sWidth: 3, s: 0, a: 99, b_0: 10, b_1: 20, b_2: 30 })).toEqual({
      out: 99,
    });
  });

  it('Dlatch: transparency reads width/enPolarity from io', () => {
    Dlatch({ width: 8, enPolarity: 1 });
    const entry = getCircuitEval('Dlatch_8w_ep1')!;
    const evalFn = reconstruct(entry.evalFn);
    const onTickFn = reconstruct(entry.onTickFn!);
    expect(evalFn({ width: 8, enPolarity: 1, en: 1, d: 42, hold: 7 })).toEqual({ q: 42 }); // transparent
    expect(evalFn({ width: 8, enPolarity: 1, en: 0, d: 42, hold: 7 })).toEqual({ q: 7 }); // held
    expect(onTickFn({ width: 8, enPolarity: 1, en: 1, d: 42, hold: 7 })).toEqual({ hold: 42 });
  });

  it('Mem: read/write reads shape from io, wraps to depth', () => {
    Mem({ rdPorts: 1, wrPorts: 1, abits: 4, width: 8, size: 16 });
    const entry = getCircuitEval('Mem_1r1w_4a_8w_16d')!;
    const evalFn = reconstruct(entry.evalFn);
    const onTickFn = reconstruct(entry.onTickFn!);
    const store: Record<number, number> = { 2: 55 };
    expect(evalFn({ rdPorts: 1, size: 16, rd_addr_0: 2, store })).toEqual({ rd_data_0: 55 });
    // write 0xAB to addr 5 (full byte enable)
    onTickFn({
      wrPorts: 1,
      width: 8,
      size: 16,
      wr_addr_0: 5,
      wr_data_0: 0xab,
      wr_en_0: 0xff,
      store,
    });
    expect(store[5]).toBe(0xab);
  });
});
