import { beforeEach, describe, expect, it } from 'vitest';
import type { Circuit } from '../types/circuit';
import { useCircuitStore } from './circuit-store';

const testCircuit: Circuit = {
  version: 1,
  name: 'TestCircuit',
  inputs: [],
  outputs: [],
  clocks: [],
  state: [],
  nodes: [],
  connections: [],
  implementation: { kind: 'composite' },
};

describe('CircuitStore', () => {
  beforeEach(() => {
    useCircuitStore.setState({ circuit: null });
  });

  it('should set the circuit', () => {
    useCircuitStore.getState().setCircuit(testCircuit);
    expect(useCircuitStore.getState().circuit).toEqual(testCircuit);
  });

  it('should replace the circuit', () => {
    const other = { ...testCircuit, name: 'Other' };
    useCircuitStore.getState().setCircuit(testCircuit);
    useCircuitStore.getState().setCircuit(other);
    expect(useCircuitStore.getState().circuit).toBe(other);
  });

  it('should clear the circuit', () => {
    useCircuitStore.getState().setCircuit(testCircuit);
    useCircuitStore.getState().clearCircuit();
    expect(useCircuitStore.getState().circuit).toBeNull();
  });
});
