/**
 * A circuit with inputs and outputs but no nodes and no eval is an empty
 * composite: nothing drives its outputs, and nothing about it is opaque.
 * Inputs only (a display) or outputs only (a switch) stay primitives.
 */
import { describe, expect, it } from 'vitest';
import { bit } from '../bit-bus.js';
import { circuit } from '../circuit.js';

describe('a circuit with no nodes and no eval', () => {
  it('is an empty composite when it has inputs and outputs', () => {
    const Todo = circuit('TodoBody', {
      inputs: { a: bit },
      outputs: { y: bit },
      nodes: {},
      connect: () => [],
    });
    expect(Todo.circuit.implementation.kind).toBe('composite');
  });

  it('stays a primitive with only outputs, like a switch', () => {
    const Source = circuit('OnlyOutputs', { outputs: { y: bit } });
    expect(Source.circuit.implementation.kind).toBe('primitive');
  });

  it('stays a primitive with only inputs, like a display', () => {
    const Sink = circuit('OnlyInputs', { inputs: { a: bit } });
    expect(Sink.circuit.implementation.kind).toBe('primitive');
  });
});
