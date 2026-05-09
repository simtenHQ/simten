/**
 * Declarative Memory Tests
 *
 * Tests for reg() and mem() state type helpers.
 * Memory read/write is handled via eval/onTick with array indexing
 * (eval-synth extension — tested separately).
 */

import { describe, it, expect } from 'vitest';
import { circuit, bit, bus, reg, mem } from '../index.js';

// ── reg() and mem() helpers ──────────────────────────────────────────────

describe('reg() helper', () => {
  it('creates a RegState with correct properties', () => {
    const r = reg(8);
    expect(r.__stateKind).toBe('reg');
    expect(r.width).toBe(8);
    expect(r.initial).toBe(0);
  });

  it('accepts custom initial value', () => {
    const r = reg(32, 100);
    expect(r.width).toBe(32);
    expect(r.initial).toBe(100);
  });

  it('throws for invalid width', () => {
    expect(() => reg(0)).toThrow();
    expect(() => reg(-1)).toThrow();
    expect(() => reg(1.5)).toThrow();
  });
});

describe('mem() helper', () => {
  it('creates a MemState with correct properties', () => {
    const m = mem(256, 8);
    expect(m.__stateKind).toBe('mem');
    expect(m.depth).toBe(256);
    expect(m.width).toBe(8);
    expect(m.initial.size).toBe(0);
  });

  it('accepts initial data', () => {
    const init = new Map([[0, 42], [1, 99]]);
    const m = mem(256, 8, init);
    expect(m.initial.get(0)).toBe(42);
    expect(m.initial.get(1)).toBe(99);
  });

  it('throws for invalid dimensions', () => {
    expect(() => mem(0, 8)).toThrow();
    expect(() => mem(256, 0)).toThrow();
  });
});

// ── circuit() with reg() state ──────────────────────────────────────────

describe('circuit() with reg() state', () => {
  it('creates a sequential circuit with reg state', () => {
    const MyReg = circuit('TestRegState', {
      inputs: { data: bus(8), we: bit },
      outputs: { q: bus(8) },
      state: { value: reg(8) },
      eval: ({ value }) => ({ q: value as number }),
      onTick: ({ data, we, value }) => ({ value: we ? (data as number) : (value as number) }),
    });

    expect(MyReg.circuit.state.length).toBe(1);
    expect(MyReg.circuit.state[0].stateType).toEqual({ kind: 'bus', width: 8 });
    expect(MyReg.circuit.clocks.length).toBe(1);
    expect(MyReg.circuit.metadata?.timing).toBe('sequential');
  });

  it('creates a 1-bit reg as bit type', () => {
    const MyFF = circuit('TestBitReg', {
      inputs: { d: bit },
      outputs: { q: bit },
      state: { value: reg(1) },
      eval: ({ value }) => ({ q: value as number }),
      onTick: ({ d }) => ({ value: d as number }),
    });

    expect(MyFF.circuit.state[0].stateType).toEqual({ kind: 'bit' });
  });
});

// ── circuit() with mem() state ──────────────────────────────────────────

describe('circuit() with mem() state', () => {
  it('creates a memory state block with correct dimensions', () => {
    const MyRAM = circuit('TestMemCircuit', {
      inputs: { addr: bus(8), data_in: bus(8), we: bit },
      outputs: { data_out: bus(8) },
      state: { memory: mem(256, 8) },
      eval: ({ addr, memory }) => ({
        data_out: (memory as any)?.get?.(addr) ?? 0,
      }),
      onTick: ({ addr, data_in, we, memory }) => {
        if (!we) return { memory };
        const m = new Map<number, number>(memory as Map<number, number>);
        m.set(addr as number, data_in as number);
        return { memory: m };
      },
    });

    expect(MyRAM.circuit.state.length).toBe(1);
    expect(MyRAM.circuit.state[0].stateType.kind).toBe('memory');
    if (MyRAM.circuit.state[0].stateType.kind === 'memory') {
      expect(MyRAM.circuit.state[0].stateType.addressWidth).toBe(8);
      expect(MyRAM.circuit.state[0].stateType.dataWidth).toBe(8);
    }
    expect(MyRAM.circuit.clocks.length).toBe(1);
  });

  it('computes addressWidth from depth', () => {
    const MySmall = circuit('TestSmallMem', {
      inputs: { addr: bus(4), data_in: bus(8), we: bit },
      outputs: { data_out: bus(8) },
      state: { memory: mem(16, 8) },
      eval: ({ addr, memory }) => ({
        data_out: (memory as any)?.get?.(addr) ?? 0,
      }),
      onTick: ({ addr, data_in, we, memory }) => {
        if (!we) return { memory };
        const m = new Map<number, number>(memory as Map<number, number>);
        m.set(addr as number, data_in as number);
        return { memory: m };
      },
    });

    if (MySmall.circuit.state[0].stateType.kind === 'memory') {
      expect(MySmall.circuit.state[0].stateType.addressWidth).toBe(4); // ceil(log2(16))
    }
  });
});
