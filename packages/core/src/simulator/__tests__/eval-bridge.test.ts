/**
 * Tests for the eval bridge — verifying that user-defined .eval() functions
 * produce correct outputs when wrapped and run through the fast simulation path.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateEvalWrapper,
  getOrAllocateTypeIndex,
  registerEvalFunction,
  resetDynamicIndices,
  resolveTypeIndex,
} from '../eval-bridge.js';
import { PRIMITIVE_TYPE_INDICES } from '../numeric-types.js';
import { EVALUATORS } from '../evaluators/index.js';
import { readInput, writeOutput, type EvalContext } from '../evaluators/types.js';
import type { NumericCircuit } from '../numeric-types.js';
import type { NumericPortValues } from '../numeric-values.js';

// ============================================================================
// Helpers: create a minimal EvalContext for testing
// ============================================================================

function createTestContext(
  inputs: number[],
  outputCount: number,
  state?: any,
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
    flatCircuit: { nodes: [{ arguments: {} }] },
  } as unknown as NumericCircuit;

  const portValues = {
    values,
  } as unknown as NumericPortValues;

  const ctx: EvalContext = {
    circuit,
    values: portValues,
    state: state ?? undefined,
    queue: null as any,
    nodeIndex: 0,
    portStart: 0,
    inputCount,
    outputCount,
  };

  return { ctx, values };
}

// ============================================================================
// Dynamic index allocation
// ============================================================================

describe('dynamic type index allocation', () => {
  beforeEach(() => {
    resetDynamicIndices();
  });

  it('returns static index for built-in primitives', () => {
    expect(getOrAllocateTypeIndex('And')).toBe(PRIMITIVE_TYPE_INDICES.And);
    expect(getOrAllocateTypeIndex('Register')).toBe(PRIMITIVE_TYPE_INDICES.Register);
  });

  it('allocates dynamic indices starting at 200', () => {
    const idx = getOrAllocateTypeIndex('MyCustomGate');
    expect(idx).toBe(200);
  });

  it('returns same index for same name', () => {
    const idx1 = getOrAllocateTypeIndex('CustomA');
    const idx2 = getOrAllocateTypeIndex('CustomA');
    expect(idx1).toBe(idx2);
  });

  it('allocates sequential indices for different names', () => {
    const idx1 = getOrAllocateTypeIndex('CustomA');
    const idx2 = getOrAllocateTypeIndex('CustomB');
    expect(idx2).toBe(idx1 + 1);
  });

  it('resolveTypeIndex returns undefined for unregistered names', () => {
    expect(resolveTypeIndex('NeverRegistered')).toBeUndefined();
  });

  it('resolveTypeIndex returns index after allocation', () => {
    const idx = getOrAllocateTypeIndex('Registered');
    expect(resolveTypeIndex('Registered')).toBe(idx);
  });

  it('reset clears dynamic allocations', () => {
    getOrAllocateTypeIndex('WillBeCleared');
    resetDynamicIndices();
    expect(resolveTypeIndex('WillBeCleared')).toBeUndefined();
    // Next allocation starts fresh at 200
    expect(getOrAllocateTypeIndex('NewAfterReset')).toBe(200);
  });
});

// ============================================================================
// Wrapper generation — combinational
// ============================================================================

describe('generateEvalWrapper (combinational)', () => {
  it('wraps a simple AND gate', () => {
    const wrapper = generateEvalWrapper(
      ['a', 'b'],
      ['out'],
      ({ a, b }) => ({ out: (a && b) ? 1 : 0 }),
    );

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
    const wrapper = generateEvalWrapper(
      ['a', 'b'],
      ['sum', 'carry'],
      ({ a, b }) => ({
        sum: (a + b) & 0xFF,
        carry: ((a + b) >> 8) & 1,
      }),
    );

    const { ctx, values } = createTestContext([200, 100], 2);
    wrapper(ctx);
    expect(values[2]).toBe(44);  // (200 + 100) & 0xFF = 300 & 255 = 44
    expect(values[3]).toBe(1);   // carry
  });

  it('wraps a component with no inputs', () => {
    const wrapper = generateEvalWrapper(
      [],
      ['value'],
      () => ({ value: 42 }),
    );

    const { ctx, values } = createTestContext([], 1);
    wrapper(ctx);
    expect(values[0]).toBe(42);
  });

  it('merges node.arguments into eval inputs', () => {
    // Simulates Switch/Input/Constant — value comes from arguments, not a port
    const wrapper = generateEvalWrapper(
      [],
      ['out'],
      ({ value }) => ({ out: value ? 1 : 0 }),
    );

    const { ctx, values } = createTestContext([], 1);
    // Set the node argument (normally set when user clicks Switch)
    (ctx.circuit.flatCircuit.nodes[0] as any).arguments = { value: true };
    wrapper(ctx);
    expect(values[0]).toBe(1);

    (ctx.circuit.flatCircuit.nodes[0] as any).arguments = { value: false };
    wrapper(ctx);
    expect(values[0]).toBe(0);
  });

  it('port inputs take precedence over node.arguments', () => {
    // If a port and an argument have the same name, the port wins
    const wrapper = generateEvalWrapper(
      ['value'],
      ['out'],
      ({ value }) => ({ out: value as number }),
    );

    const { ctx, values } = createTestContext([99], 1);
    (ctx.circuit.flatCircuit.nodes[0] as any).arguments = { value: 7 };
    wrapper(ctx);
    expect(values[1]).toBe(99); // port input (99), not argument (7)
  });

  it('wraps a ReLU activation', () => {
    const wrapper = generateEvalWrapper(
      ['x'],
      ['y'],
      ({ x }) => ({ y: x > 0 ? x : 0 }),
    );

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
// registerEvalFunction
// ============================================================================

describe('registerEvalFunction', () => {
  beforeEach(() => {
    resetDynamicIndices();
  });

  it('registers a user-defined component and assigns a type index', () => {
    const idx = registerEvalFunction(
      'MyGate',
      ['a', 'b'],
      ['out'],
      ({ a, b }) => ({ out: a ^ b }),
    );

    expect(idx).toBe(200);
    expect(EVALUATORS[idx]).toBeDefined();

    // Verify it works
    const { ctx, values } = createTestContext([1, 0], 1);
    EVALUATORS[idx]!(ctx);
    expect(values[2]).toBe(1);
  });

  it('does not overwrite existing static evaluators', () => {
    const originalEval = EVALUATORS[PRIMITIVE_TYPE_INDICES.And];
    const idx = registerEvalFunction(
      'And',
      ['a', 'b'],
      ['out'],
      ({ a, b }) => ({ out: 999 }), // Wrong on purpose
    );

    expect(idx).toBe(PRIMITIVE_TYPE_INDICES.And);
    expect(EVALUATORS[idx]).toBe(originalEval); // Not overwritten
  });
});
