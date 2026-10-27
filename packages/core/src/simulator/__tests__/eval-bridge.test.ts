/**
 * Tests for the eval bridge — verifying that user-defined .eval() functions
 * produce correct outputs when wrapped and run through the fast simulation path.
 */

import { describe, expect, it } from 'vitest';
import type { Behavior, BehaviorFn } from '../../circuit/behavior.js';
import {
  createDispatchTables,
  generateEvalWrapper as generateFromBehavior,
  typeIndexFor,
} from '../eval-bridge.js';
import type { EvalContext } from '../evaluators/types.js';
import type { NumericCircuit, NumericSequentialState } from '../numeric-types.js';
import type { NumericPortValues } from '../numeric-values.js';

/** The tests' evals take numbers; behavior in general takes any named values. */
function generateEvalWrapper(
  inputNames: string[],
  outputNames: string[],
  evalFn: (inputs: Record<string, number>) => Record<string, number>,
  stateKeys?: string[],
) {
  return generateFromBehavior(inputNames, outputNames, evalFn as BehaviorFn, stateKeys);
}

// ============================================================================
// Helpers: create a minimal EvalContext for testing
// ============================================================================

function createTestContext(
  inputs: number[],
  outputCount: number,
  state?: unknown,
): { ctx: EvalContext; values: Float64Array } {
  const inputCount = inputs.length;
  const totalPorts = inputCount + outputCount;
  const values = new Float64Array(totalPorts);

  // Write input values
  for (let i = 0; i < inputCount; i++) {
    values[i] = inputs[i];
  }

  // Build minimal source port mapping: each input reads from its own index
  const inputSourcePort = new Int32Array(totalPorts);
  for (let i = 0; i < inputCount; i++) {
    inputSourcePort[i] = i; // input i reads from port index i
  }
  for (let i = inputCount; i < totalPorts; i++) {
    inputSourcePort[i] = -1; // outputs don't read from anywhere
  }

  const circuit = {
    inputSourcePort,
    nodePortStart: new Uint32Array([0]),
    nodeInputCount: new Uint8Array([inputCount]),
    nodeOutputCount: new Uint8Array([outputCount]),
    portMask: new Uint32Array(totalPorts).fill(0xffffffff),
    flatCircuit: { nodes: [{ arguments: {} }] },
  } as unknown as NumericCircuit;

  const portValues = {
    values,
    initialized: new Uint8Array(totalPorts),
  } as unknown as NumericPortValues;

  const ctx: EvalContext = {
    circuit,
    values: portValues,
    state: state as NumericSequentialState | undefined,
    queue: null as unknown as EvalContext['queue'],
    nodeIndex: 0,
    portStart: 0,
    inputCount,
    outputCount,
  };

  return { ctx, values };
}

// ============================================================================
// Wrapper generation — combinational
// ============================================================================

describe('generateEvalWrapper (combinational)', () => {
  it('wraps a simple AND gate', () => {
    const wrapper = generateEvalWrapper(['a', 'b'], ['out'], ({ a, b }) => ({
      out: a && b ? 1 : 0,
    }));

    const { ctx, values } = createTestContext([1, 1], 1);
    wrapper(ctx);
    expect(values[2]).toBe(1); // output at index 2

    // Reset and test false case
    values[0] = 1;
    values[1] = 0;
    wrapper(ctx);
    expect(values[2]).toBe(0);
  });

  it('wraps an adder with bus values', () => {
    const wrapper = generateEvalWrapper(['a', 'b'], ['sum', 'carry'], ({ a, b }) => ({
      sum: (a + b) & 0xff,
      carry: ((a + b) >> 8) & 1,
    }));

    const { ctx, values } = createTestContext([200, 100], 2);
    wrapper(ctx);
    expect(values[2]).toBe(44); // (200 + 100) & 0xFF = 300 & 255 = 44
    expect(values[3]).toBe(1); // carry
  });

  it('wraps a component with no inputs', () => {
    const wrapper = generateEvalWrapper([], ['value'], () => ({ value: 42 }));

    const { ctx, values } = createTestContext([], 1);
    wrapper(ctx);
    expect(values[0]).toBe(42);
  });

  it('merges node.arguments into eval inputs', () => {
    // Simulates Switch/Input/Constant — value comes from arguments, not a port
    const wrapper = generateEvalWrapper([], ['out'], ({ value }) => ({ out: value ? 1 : 0 }));

    const { ctx, values } = createTestContext([], 1);
    // Set the node argument (normally set when user clicks Switch)
    (ctx.circuit.flatCircuit.nodes[0] as { arguments: Record<string, unknown> }).arguments = {
      value: true,
    };
    wrapper(ctx);
    expect(values[0]).toBe(1);

    (ctx.circuit.flatCircuit.nodes[0] as { arguments: Record<string, unknown> }).arguments = {
      value: false,
    };
    wrapper(ctx);
    expect(values[0]).toBe(0);
  });

  it('port inputs take precedence over node.arguments', () => {
    // If a port and an argument have the same name, the port wins
    const wrapper = generateEvalWrapper(['value'], ['out'], ({ value }) => ({
      out: value as number,
    }));

    const { ctx, values } = createTestContext([99], 1);
    (ctx.circuit.flatCircuit.nodes[0] as { arguments: Record<string, unknown> }).arguments = {
      value: 7,
    };
    wrapper(ctx);
    expect(values[1]).toBe(99); // port input (99), not argument (7)
  });

  it('wraps a ReLU activation', () => {
    const wrapper = generateEvalWrapper(['x'], ['y'], ({ x }) => ({ y: x > 0 ? x : 0 }));

    const { ctx: ctx1, values: v1 } = createTestContext([5], 1);
    wrapper(ctx1);
    expect(v1[1]).toBe(5);

    const { ctx: ctx2, values: v2 } = createTestContext([-3], 1);
    wrapper(ctx2);
    expect(v2[1]).toBe(0);
  });
});

// ============================================================================
// Wrapper generation — sequential (with state)
// ============================================================================

describe('generateEvalWrapper (sequential)', () => {
  it('wraps a register (reads state, ignores input for output)', () => {
    const wrapper = generateEvalWrapper(
      ['d'],
      ['q'],
      ({ stored }) => ({ q: (stored as number) ?? 0 }),
      ['stored'],
    );

    // State has stored = 42
    const state = {
      currentState: [{ stored: 42 }],
      nextState: [undefined],
      clocks: new Map(),
      cycleCount: 0,
    };

    const { ctx, values } = createTestContext([99], 1, state);
    wrapper(ctx);
    expect(values[1]).toBe(42); // output comes from state, not input
  });

  it('wraps a counter (reads state + input)', () => {
    const wrapper = generateEvalWrapper(
      ['enable'],
      ['count'],
      ({ total }) => ({ count: (total as number) ?? 0 }),
      ['total'],
    );

    const state = {
      currentState: [{ total: 7 }],
      nextState: [undefined],
      clocks: new Map(),
      cycleCount: 0,
    };

    const { ctx, values } = createTestContext([1], 1, state);
    wrapper(ctx);
    expect(values[1]).toBe(7);
  });
});

// ============================================================================
// Per-compile dispatch tables
// ============================================================================

const xor: Behavior = {
  inputNames: ['a', 'b'],
  outputNames: ['out'],
  evalFn: ({ a, b }) => ({ out: (a as number) ^ (b as number) }),
};

describe('dispatch tables', () => {
  it('gives each type one index, in the order types are seen', () => {
    const tables = createDispatchTables();
    const behaviors = new Map([['Xor', xor]]);
    expect(typeIndexFor(tables, 'Xor', behaviors)).toBe(0);
    expect(typeIndexFor(tables, 'Other', behaviors)).toBe(1);
    expect(typeIndexFor(tables, 'Xor', behaviors)).toBe(0);
    expect(tables.typeNames).toEqual(['Xor', 'Other']);
  });

  it("builds an evaluator from the compile's own behavior", () => {
    const tables = createDispatchTables();
    const idx = typeIndexFor(tables, 'Xor', new Map([['Xor', xor]]));
    const { ctx, values } = createTestContext([1, 0], 1);
    tables.evaluators[idx]?.(ctx);
    expect(values[2]).toBe(1);
  });

  it('leaves a type with no behavior empty, for the engine to report', () => {
    const tables = createDispatchTables();
    const idx = typeIndexFor(tables, 'Missing', new Map());
    expect(tables.evaluators[idx]).toBeNull();
    expect(tables.onTicks[idx]).toBeUndefined();
  });

  it('two compiles of one name keep their own behavior', () => {
    const a = createDispatchTables();
    const b = createDispatchTables();
    const xnor: Behavior = {
      ...xor,
      evalFn: ({ a, b }) => ({ out: (a as number) === (b as number) ? 1 : 0 }),
    };
    typeIndexFor(a, 'Gate', new Map([['Gate', xor]]));
    typeIndexFor(b, 'Gate', new Map([['Gate', xnor]]));
    const first = createTestContext([1, 1], 1);
    a.evaluators[0]?.(first.ctx);
    const second = createTestContext([1, 1], 1);
    b.evaluators[0]?.(second.ctx);
    expect([first.values[2], second.values[2]]).toEqual([0, 1]);
  });
});
