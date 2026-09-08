/**
 * A stateful primitive's `stateType` must reflect its real width.
 *
 * `circuit()` classifies a bare `state:` value by its JS TYPE, not by any
 * declared width: a boolean becomes `bit`, a number becomes `bus(32)`. So
 * `Register({ width: 8 })` writing `state: { value }` recorded `bus(32)` in
 * its IR, for every width, and `DFlipFlop` only got `bit` because its default
 * happened to be `false`. Swapping that `false` for `0` — which is otherwise
 * the correct change, since a bit is 0 or 1 — silently turned the most-used
 * sequential primitive in the stdlib into a 32-bit bus.
 *
 * Both now declare their width with `reg(width, value)` instead of relying on
 * inference. Nothing caught the drift: the Verilog exporter derives `reg`
 * widths from the PORT, so the emitted Verilog was correct either way and the
 * golden hashes never moved. The wrong width lived only in the IR — which is
 * what crosses the sandbox boundary, what the canvas reads, and what any
 * future consumer of `stateType` would trust.
 */

import { describe, expect, it } from 'vitest';
import { DFlipFlop, Register } from '../index.js';

describe('declared state widths', () => {
  it('DFlipFlop stores one bit', () => {
    expect(DFlipFlop().circuit.state[0].stateType).toEqual({ kind: 'bit' });
  });

  it('Register state width tracks its port width', () => {
    for (const width of [1, 4, 8, 16, 32]) {
      expect(Register({ width }).circuit.state[0].stateType).toEqual(
        width === 1 ? { kind: 'bit' } : { kind: 'bus', width },
      );
    }
  });

  it('defaults to the documented 8-bit register', () => {
    expect(Register().circuit.state[0].stateType).toEqual({ kind: 'bus', width: 8 });
  });
});
