/**
 * Circuit Library Store Tests
 *
 * Comprehensive test suite for the circuit library management system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useCircuitLibraryStore } from './circuit-library-store';
import { bitType, busType, type Circuit } from '../types/circuit';

// Helper to create test circuits
function createTestCircuit(name: string, isPrimitive = false): Circuit {
  return {
    id: `test:${name}`,
    name,
    parameters: [],
    inputs: [{ name: 'a', portType: bitType() }],
    outputs: [{ name: 'out', portType: bitType() }],
    clocks: [],
    state: [],
    nodes: [],
    connections: [],
    implementation: isPrimitive ? { kind: 'primitive' } : { kind: 'composite' },
    metadata: {
      description: `Test circuit: ${name}`,
    },
  };
}

describe('Circuit Library Store', () => {
  // Reset the store before each test
  beforeEach(() => {
    const store = useCircuitLibraryStore.getState();
    store.clearAll();
  });

  describe('Primitive Operations', () => {
    it('should register a primitive circuit', () => {
      const store = useCircuitLibraryStore.getState();
      const andGate = createTestCircuit('And', true);

      store.registerPrimitive(andGate);

      const retrieved = store.getPrimitive('And');
      expect(retrieved).toEqual(andGate);
    });

    it('should retrieve undefined for non-existent primitive', () => {
      const store = useCircuitLibraryStore.getState();
      const result = store.getPrimitive('NonExistent');
      expect(result).toBeUndefined();
    });

    it('should overwrite existing primitive with same name', () => {
      const store = useCircuitLibraryStore.getState();
      const andGate1 = createTestCircuit('And', true);
      const andGate2 = { ...andGate1, id: 'different-id' };

      store.registerPrimitive(andGate1);
      store.registerPrimitive(andGate2);

      const retrieved = store.getPrimitive('And');
      expect(retrieved?.id).toBe('different-id');
    });

    it('should register multiple primitives in bulk', () => {
      const store = useCircuitLibraryStore.getState();
      const circuits = [
        createTestCircuit('And', true),
        createTestCircuit('Or', true),
        createTestCircuit('Not', true),
      ];

      store.registerPrimitives(circuits);

      expect(store.getPrimitive('And')).toBeDefined();
      expect(store.getPrimitive('Or')).toBeDefined();
      expect(store.getPrimitive('Not')).toBeDefined();
    });

    it('should get all primitive names sorted', () => {
      const store = useCircuitLibraryStore.getState();
      store.registerPrimitives([
        createTestCircuit('Xor', true),
        createTestCircuit('And', true),
        createTestCircuit('Or', true),
      ]);

      const names = store.getAllPrimitiveNames();
      expect(names).toEqual(['And', 'Or', 'Xor']);
    });
  });

  describe('Standard Library Operations', () => {
    it('should register a standard circuit', () => {
      const store = useCircuitLibraryStore.getState();
      const halfAdder = createTestCircuit('HalfAdder');

      store.registerStandard(halfAdder);

      const retrieved = store.getStandard('HalfAdder');
      expect(retrieved).toEqual(halfAdder);
    });

    it('should retrieve undefined for non-existent standard circuit', () => {
      const store = useCircuitLibraryStore.getState();
      const result = store.getStandard('NonExistent');
      expect(result).toBeUndefined();
    });

    it('should register multiple standard circuits in bulk', () => {
      const store = useCircuitLibraryStore.getState();
      const circuits = [
        createTestCircuit('HalfAdder'),
        createTestCircuit('FullAdder'),
        createTestCircuit('Mux2to1'),
      ];

      store.registerStandardLibrary(circuits);

      expect(store.getStandard('HalfAdder')).toBeDefined();
      expect(store.getStandard('FullAdder')).toBeDefined();
      expect(store.getStandard('Mux2to1')).toBeDefined();
    });

    it('should get all standard library names sorted', () => {
      const store = useCircuitLibraryStore.getState();
      store.registerStandardLibrary([
        createTestCircuit('Mux2to1'),
        createTestCircuit('FullAdder'),
        createTestCircuit('HalfAdder'),
      ]);

      const names = store.getAllStandardNames();
      expect(names).toEqual(['FullAdder', 'HalfAdder', 'Mux2to1']);
    });
  });

  describe('User Circuit Operations', () => {
    it('should register a user circuit', () => {
      const store = useCircuitLibraryStore.getState();
      const myCircuit = createTestCircuit('MyCircuit');

      store.registerUser(myCircuit);

      const retrieved = store.getUser('MyCircuit');
      expect(retrieved).toEqual(myCircuit);
    });

    it('should remove a user circuit', () => {
      const store = useCircuitLibraryStore.getState();
      const myCircuit = createTestCircuit('MyCircuit');

      store.registerUser(myCircuit);
      expect(store.getUser('MyCircuit')).toBeDefined();

      store.removeUser('MyCircuit');
      expect(store.getUser('MyCircuit')).toBeUndefined();
    });

    it('should handle removing non-existent user circuit', () => {
      const store = useCircuitLibraryStore.getState();

      // Should not throw
      expect(() => store.removeUser('NonExistent')).not.toThrow();
    });

    it('should get all user circuit names sorted', () => {
      const store = useCircuitLibraryStore.getState();
      store.registerUser(createTestCircuit('ZComponent'));
      store.registerUser(createTestCircuit('AComponent'));
      store.registerUser(createTestCircuit('MComponent'));

      const names = store.getAllUserNames();
      expect(names).toEqual(['AComponent', 'MComponent', 'ZComponent']);
    });
  });

  describe('Unified Resolution', () => {
    it('should resolve primitives first', () => {
      const store = useCircuitLibraryStore.getState();
      const primitive = createTestCircuit('And', true);
      const standard = { ...createTestCircuit('And'), id: 'standard-and' };
      const user = { ...createTestCircuit('And'), id: 'user-and' };

      store.registerPrimitive(primitive);
      store.registerStandard(standard);
      store.registerUser(user);

      const resolved = store.resolveCircuit('And');
      expect(resolved?.id).toBe('test:And'); // Primitive wins
    });

    it('should resolve standard library second', () => {
      const store = useCircuitLibraryStore.getState();
      const standard = createTestCircuit('HalfAdder');
      const user = { ...createTestCircuit('HalfAdder'), id: 'user-halfadder' };

      store.registerStandard(standard);
      store.registerUser(user);

      const resolved = store.resolveCircuit('HalfAdder');
      expect(resolved?.id).toBe('test:HalfAdder'); // Standard wins
    });

    it('should resolve user circuits third', () => {
      const store = useCircuitLibraryStore.getState();
      const user = createTestCircuit('MyCircuit');

      store.registerUser(user);

      const resolved = store.resolveCircuit('MyCircuit');
      expect(resolved?.id).toBe('test:MyCircuit');
    });

    it('should return undefined for unresolvable circuit', () => {
      const store = useCircuitLibraryStore.getState();
      const resolved = store.resolveCircuit('NonExistent');
      expect(resolved).toBeUndefined();
    });

    it('should follow correct resolution order', () => {
      const store = useCircuitLibraryStore.getState();

      // Test 1: Only primitive exists
      store.clearAll();
      store.registerPrimitive(createTestCircuit('Test', true));
      expect(store.resolveCircuit('Test')?.id).toBe('test:Test');

      // Test 2: Only standard exists
      store.clearAll();
      store.registerStandard({ ...createTestCircuit('Test'), id: 'standard' });
      expect(store.resolveCircuit('Test')?.id).toBe('standard');

      // Test 3: Only user exists
      store.clearAll();
      store.registerUser({ ...createTestCircuit('Test'), id: 'user' });
      expect(store.resolveCircuit('Test')?.id).toBe('user');

      // Test 4: Primitive takes precedence over standard
      store.clearAll();
      store.registerPrimitive(createTestCircuit('Test', true));
      store.registerStandard({ ...createTestCircuit('Test'), id: 'standard' });
      expect(store.resolveCircuit('Test')?.id).toBe('test:Test');

      // Test 5: Primitive takes precedence over user
      store.clearAll();
      store.registerPrimitive(createTestCircuit('Test', true));
      store.registerUser({ ...createTestCircuit('Test'), id: 'user' });
      expect(store.resolveCircuit('Test')?.id).toBe('test:Test');

      // Test 6: Standard takes precedence over user
      store.clearAll();
      store.registerStandard({ ...createTestCircuit('Test'), id: 'standard' });
      store.registerUser({ ...createTestCircuit('Test'), id: 'user' });
      expect(store.resolveCircuit('Test')?.id).toBe('standard');

      // Test 7: Primitive takes precedence when all exist
      store.clearAll();
      store.registerPrimitive(createTestCircuit('Test', true));
      store.registerStandard({ ...createTestCircuit('Test'), id: 'standard' });
      store.registerUser({ ...createTestCircuit('Test'), id: 'user' });
      expect(store.resolveCircuit('Test')?.id).toBe('test:Test');
    });
  });

  describe('Query Operations', () => {
    it('should get all circuit names from all libraries', () => {
      const store = useCircuitLibraryStore.getState();

      store.registerPrimitive(createTestCircuit('And', true));
      store.registerStandard(createTestCircuit('HalfAdder'));
      store.registerUser(createTestCircuit('MyCircuit'));

      const allNames = store.getAllCircuitNames();
      expect(allNames).toContain('And');
      expect(allNames).toContain('HalfAdder');
      expect(allNames).toContain('MyCircuit');
      expect(allNames).toHaveLength(3);
    });

    it('should return sorted circuit names', () => {
      const store = useCircuitLibraryStore.getState();

      store.registerPrimitive(createTestCircuit('Xor', true));
      store.registerStandard(createTestCircuit('FullAdder'));
      store.registerUser(createTestCircuit('ACustom'));

      const allNames = store.getAllCircuitNames();
      expect(allNames).toEqual(['ACustom', 'FullAdder', 'Xor']);
    });

    it('should handle empty libraries', () => {
      const store = useCircuitLibraryStore.getState();

      expect(store.getAllPrimitiveNames()).toEqual([]);
      expect(store.getAllStandardNames()).toEqual([]);
      expect(store.getAllUserNames()).toEqual([]);
      expect(store.getAllCircuitNames()).toEqual([]);
    });
  });

  describe('Clear Operations', () => {
    it('should clear only user circuits', () => {
      const store = useCircuitLibraryStore.getState();

      store.registerPrimitive(createTestCircuit('And', true));
      store.registerStandard(createTestCircuit('HalfAdder'));
      store.registerUser(createTestCircuit('MyCircuit'));

      store.clearUserCircuits();

      expect(store.getPrimitive('And')).toBeDefined();
      expect(store.getStandard('HalfAdder')).toBeDefined();
      expect(store.getUser('MyCircuit')).toBeUndefined();
    });

    it('should clear all circuits', () => {
      const store = useCircuitLibraryStore.getState();

      store.registerPrimitive(createTestCircuit('And', true));
      store.registerStandard(createTestCircuit('HalfAdder'));
      store.registerUser(createTestCircuit('MyCircuit'));

      store.clearAll();

      expect(store.getPrimitive('And')).toBeUndefined();
      expect(store.getStandard('HalfAdder')).toBeUndefined();
      expect(store.getUser('MyCircuit')).toBeUndefined();
    });
  });

  describe('State Immutability', () => {
    it('should maintain separate state for different libraries', () => {
      const store = useCircuitLibraryStore.getState();
      const circuit = createTestCircuit('Test');

      store.registerPrimitive(circuit);
      store.registerStandard(circuit);
      store.registerUser(circuit);

      // All should be separate references
      const primitive = store.getPrimitive('Test');
      const standard = store.getStandard('Test');
      const user = store.getUser('Test');

      // They should all exist but be retrieved from different maps
      expect(primitive).toBeDefined();
      expect(standard).toBeDefined();
      expect(user).toBeDefined();
    });

    it('should handle concurrent operations', () => {
      const store = useCircuitLibraryStore.getState();

      // Simulate concurrent registration
      const circuits = Array.from({ length: 100 }, (_, i) =>
        createTestCircuit(`Circuit${i}`)
      );

      circuits.forEach(circuit => store.registerUser(circuit));

      const allNames = store.getAllUserNames();
      expect(allNames).toHaveLength(100);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle circuit with bus ports', () => {
      const store = useCircuitLibraryStore.getState();
      const busCircuit: Circuit = {
        id: 'bus-circuit',
        name: 'BusAdder',
        parameters: [],
        inputs: [
          { name: 'a', portType: busType(8) },
          { name: 'b', portType: busType(8) },
        ],
        outputs: [{ name: 'sum', portType: busType(8) }],
        clocks: [],
        state: [],
        nodes: [],
        connections: [],
        implementation: { kind: 'composite' },
      };

      store.registerUser(busCircuit);

      const retrieved = store.getUser('BusAdder');
      expect(retrieved?.inputs[0].portType).toEqual(busType(8));
    });

    it('should handle multiple registrations and deletions', () => {
      const store = useCircuitLibraryStore.getState();

      // Register
      store.registerUser(createTestCircuit('A'));
      store.registerUser(createTestCircuit('B'));
      store.registerUser(createTestCircuit('C'));

      expect(store.getAllUserNames()).toHaveLength(3);

      // Delete
      store.removeUser('B');
      expect(store.getAllUserNames()).toHaveLength(2);
      expect(store.getAllUserNames()).toEqual(['A', 'C']);

      // Re-register
      store.registerUser(createTestCircuit('B'));
      expect(store.getAllUserNames()).toHaveLength(3);
      expect(store.getAllUserNames()).toEqual(['A', 'B', 'C']);
    });

    it('should preserve metadata during registration', () => {
      const store = useCircuitLibraryStore.getState();
      const circuit: Circuit = {
        ...createTestCircuit('Documented'),
        metadata: {
          description: 'A well-documented circuit',
          author: 'Test Author',
          version: '1.0.0',
          tags: ['test', 'example'],
        },
      };

      store.registerUser(circuit);

      const retrieved = store.getUser('Documented');
      expect(retrieved?.metadata?.description).toBe('A well-documented circuit');
      expect(retrieved?.metadata?.author).toBe('Test Author');
      expect(retrieved?.metadata?.version).toBe('1.0.0');
      expect(retrieved?.metadata?.tags).toEqual(['test', 'example']);
    });
  });
});
