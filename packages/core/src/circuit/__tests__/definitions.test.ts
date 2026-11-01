/**
 * `createDefinitions` is the one lookup from a component's name to its
 * circuit: its own circuits first, then each fallback in turn, as a compile's
 * own circuits sit over std's.
 */

import { describe, expect, it } from 'vitest';
import type { CircuitIR } from '../../ir/circuit-ir.js';
import { createDefinitions } from '../behavior.js';

const primitive = (name: string, description = name): CircuitIR => ({
  name,
  inputs: [],
  outputs: [],
  nodes: [],
  connections: [],
  implementation: { kind: 'primitive' },
  metadata: { description },
});

const composite = (name: string): CircuitIR => ({
  ...primitive(name),
  implementation: { kind: 'composite' },
});

describe('createDefinitions', () => {
  it('looks a name up in its own circuits, then in each fallback in order', () => {
    const std = createDefinitions([primitive('Nand', 'std'), primitive('Led', 'std')]);
    const page = createDefinitions([primitive('Led', 'page'), primitive('Switch', 'page')]);
    const own = createDefinitions([primitive('Nand', 'own')], page, std);

    expect(own.resolveCircuit('Nand')?.metadata?.description).toBe('own');
    expect(own.resolveCircuit('Led')?.metadata?.description).toBe('page');
    expect(own.resolveCircuit('Switch')?.metadata?.description).toBe('page');
    expect(own.resolveCircuit('Missing')).toBeUndefined();
  });

  it('lets a later circuit of the same name replace an earlier one', () => {
    const definitions = createDefinitions([
      primitive('Nand', 'first'),
      primitive('Nand', 'second'),
    ]);
    expect(definitions.resolveCircuit('Nand')?.metadata?.description).toBe('second');
  });

  it('adds circuits to its own layer, over the fallbacks', () => {
    const std = createDefinitions([primitive('Led', 'std')]);
    const definitions = createDefinitions([], std);
    definitions.addCircuit(primitive('Led', 'added'));
    expect(definitions.resolveCircuit('Led')?.metadata?.description).toBe('added');
    expect(std.resolveCircuit('Led')?.metadata?.description).toBe('std');
    expect(definitions.getAllCircuitNames()).toEqual(['Led']);
  });

  it('lists the primitives of every layer once', () => {
    const std = createDefinitions([primitive('Nand'), primitive('Led')]);
    const own = createDefinitions([primitive('Led'), composite('HalfAdder')], std);
    expect(own.getAllPrimitiveNames().sort()).toEqual(['Led', 'Nand']);
  });
});
